-- Phase 4. Additive canonical contract model; historical rows are not guessed.
alter table public.contracts
  add column parties_reviewed boolean not null default false,
  add column legal_snapshot jsonb not null default '{}'::jsonb;
alter table public.contract_products alter column product_id drop not null;
alter table public.contract_products
  add column packing text,
  add column origin text,
  add column notes text,
  add column agreed_amount numeric;
alter table public.contract_imports
  add column file_hash text check(file_hash is null or file_hash ~ '^[a-f0-9]{64}$'),
  add column review_result jsonb,
  add column confirmed_by uuid references auth.users(id),
  add column confirmed_at timestamptz;
create unique index contract_imports_company_hash on public.contract_imports(company_id,file_hash) where file_hash is not null;

create table public.contract_parties (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  contract_id uuid not null references public.contracts(id) on delete restrict,
  role_code text not null check(role_code in ('seller','buyer','consignee','payer','beneficiary','manufacturer')),
  internal_company_id uuid references public.companies(id) on delete restrict,
  counterparty_id uuid references public.counterparties(id) on delete restrict,
  snapshot jsonb not null check(jsonb_typeof(snapshot)='object' and coalesce(length(btrim(snapshot->>'legal_name')),0)>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(num_nonnulls(internal_company_id,counterparty_id)=1),
  unique(contract_id,role_code)
);
create index contract_parties_internal_company on public.contract_parties(internal_company_id,contract_id);
create index contract_parties_counterparty on public.contract_parties(counterparty_id);
alter table public.contract_parties enable row level security;
revoke all on public.contract_parties from public,anon;
grant select,insert,update,delete on public.contract_parties to authenticated;

-- Definer helpers expose only authorization booleans, never master records.
create function erp_private.can_read_contract(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.contracts c where c.id=target and (
    erp_private.has_permission(c.company_id,'contracts','read') or exists(
      select 1 from public.contract_parties p where p.contract_id=c.id
      and p.role_code in ('seller','buyer')
      and erp_private.has_permission(p.internal_company_id,'contracts','read')
    )
  ));
$$;
revoke all on function erp_private.can_read_contract(uuid) from public,anon;
grant execute on function erp_private.can_read_contract(uuid) to authenticated;
alter policy member_read on public.contracts using(erp_private.has_permission(company_id,'contracts','read') or erp_private.can_read_contract(id));
alter policy member_read on public.contract_products using(erp_private.has_permission(company_id,'contracts','read') or erp_private.can_read_contract(contract_id));
alter policy member_read on public.contract_imports using(erp_private.has_permission(company_id,'contracts','read') or erp_private.can_read_contract(created_contract_id));
create policy member_read on public.contract_parties for select to authenticated using(erp_private.has_permission(company_id,'contracts','read') or erp_private.can_read_contract(contract_id));
create policy member_insert on public.contract_parties for insert to authenticated with check(erp_private.has_permission(company_id,'contracts','write'));
create policy member_update on public.contract_parties for update to authenticated using(erp_private.has_permission(company_id,'contracts','write')) with check(erp_private.has_permission(company_id,'contracts','write'));
create policy member_delete on public.contract_parties for delete to authenticated using(erp_private.has_permission(company_id,'contracts','write'));

create function erp_private.guard_contract_party() returns trigger
language plpgsql security invoker set search_path='' as $$
declare owner_id uuid; parent_status text;
begin
  select company_id,status into owner_id,parent_status from public.contracts where id=coalesce(new.contract_id,old.contract_id) for update;
  if not erp_private.has_permission(owner_id,'contracts','write') then raise exception 'Contract write access denied' using errcode='42501'; end if;
  if parent_status <> 'Draft' then raise exception 'Legal parties are locked outside Draft'; end if;
  if tg_op='DELETE' then return old; end if;
  if new.company_id is distinct from owner_id then raise exception 'Parent company mismatch' using errcode='42501'; end if;
  if tg_op='UPDATE' and (new.company_id,new.contract_id) is distinct from (old.company_id,old.contract_id) then raise exception 'Party cannot be reassigned' using errcode='42501'; end if;
  if new.internal_company_id is not null and not erp_private.has_permission(new.internal_company_id,'companies','read') then
    -- Unchanged references remain editable when master access changes, using the legal snapshot.
    if tg_op='INSERT' or new.internal_company_id is distinct from old.internal_company_id then raise exception 'Internal legal entity access denied' using errcode='42501'; end if;
  end if;
  if new.counterparty_id is not null and not exists(select 1 from public.counterparties where id=new.counterparty_id and company_id=owner_id) then raise exception 'Counterparty company mismatch' using errcode='42501'; end if;
  new.updated_at=now();
  return new;
end $$;
create trigger guard_contract_party before insert or update or delete on public.contract_parties for each row execute function erp_private.guard_contract_party();

create function erp_private.guard_contract_history() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' then
    if old.parties_reviewed then raise exception 'Archive canonical Contracts instead of deleting legal history'; end if;
    return old;
  end if;
  if tg_op='UPDATE' then
    if old.parties_reviewed and not new.parties_reviewed then raise exception 'Party review cannot be undone'; end if;
    if old.status <> 'Draft' and
      (to_jsonb(new)-array['status','deleted_at','updated_at']) is distinct from (to_jsonb(old)-array['status','deleted_at','updated_at'])
      then raise exception 'Legal Contract values are locked outside Draft'; end if;
    if old.status <> 'Draft' and new.status='Draft' then raise exception 'Final Contract cannot return to Draft'; end if;
    if old.status in ('Closed','Cancelled') and new.status<>old.status then raise exception 'Completed or cancelled Contract cannot be reopened'; end if;
  end if;
  if new.parties_reviewed then
    if new.status is null or not exists(select 1 from public.currencies where code=new.currency) then raise exception 'Valid status and registered currency required'; end if;
    if new.status not in ('Draft','Active','Closed','Cancelled') or coalesce(btrim(new.contract_number),'')='' or coalesce(new.currency,'') !~ '^[A-Z]{3}$' or new.amount<0 or new.amount::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid canonical Contract fields'; end if;
    if new.business_case_id is not null and new.deal_id is not null and new.business_case_id<>new.deal_id then raise exception 'Conflicting Deal references'; end if;
    new.deal_id=coalesce(new.deal_id,new.business_case_id);
    new.business_case_id=new.deal_id;
    if new.business_role is not null or new.deal_contract_role is not null then raise exception 'Contract perspective must be derived from legal parties'; end if;
  end if;
  new.updated_at=now();
  return new;
end $$;
create trigger a_contract_history before insert or update or delete on public.contracts for each row execute function erp_private.guard_contract_history();

create function erp_private.require_contract_parties() returns trigger
language plpgsql security definer set search_path='' as $$
declare target uuid; seller public.contract_parties; buyer public.contract_parties;
begin
  if tg_table_name='contracts' then target=coalesce(new.id,old.id); else target=coalesce(new.contract_id,old.contract_id); end if;
  if not exists(select 1 from public.contracts where id=target and parties_reviewed) then return null; end if;
  select * into seller from public.contract_parties where contract_id=target and role_code='seller';
  select * into buyer from public.contract_parties where contract_id=target and role_code='buyer';
  if seller.id is null or buyer.id is null then raise exception 'Explicit Seller and Buyer are required'; end if;
  if (seller.internal_company_id,seller.counterparty_id) is not distinct from (buyer.internal_company_id,buyer.counterparty_id) then raise exception 'Seller and Buyer must differ'; end if;
  return null;
end $$;
create constraint trigger require_contract_parties after insert or update on public.contracts deferrable initially deferred for each row execute function erp_private.require_contract_parties();
create constraint trigger preserve_contract_parties after insert or update or delete on public.contract_parties deferrable initially deferred for each row execute function erp_private.require_contract_parties();

create function erp_private.guard_contract_line() returns trigger
language plpgsql security invoker set search_path='' as $$
declare parent public.contracts;
begin
  select * into parent from public.contracts where id=coalesce(new.contract_id,old.contract_id) for update;
  if parent.parties_reviewed and parent.status<>'Draft' then
    if tg_op<>'UPDATE' or (to_jsonb(new)-array['loaded','packed','remaining','reserved','updated_at']) is distinct from (to_jsonb(old)-array['loaded','packed','remaining','reserved','updated_at']) then raise exception 'Legal product lines are locked outside Draft'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  if tg_op='UPDATE' and new.contract_id<>old.contract_id then raise exception 'Contract line cannot be reassigned'; end if;
  if parent.parties_reviewed and (new.quantity is null or new.quantity<=0 or new.quantity::text in ('NaN','Infinity','-Infinity') or new.unit_price is null or new.unit_price<0 or new.unit_price::text in ('NaN','Infinity','-Infinity') or coalesce(btrim(new.description),'')='' or coalesce(btrim(new.unit),'')='' or coalesce(new.currency,'') !~ '^[A-Z]{3}$' or new.net_weight<0 or new.gross_weight<0 or new.agreed_amount<0) then raise exception 'Invalid legal product line'; end if;
  return new;
end $$;
create trigger a_contract_line before insert or update or delete on public.contract_products for each row execute function erp_private.guard_contract_line();

create function erp_private.guard_import_source() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' then
    if old.file_hash is not null then raise exception 'Original Contract imports must be retained'; end if;
    return old;
  end if;
  if tg_op='INSERT' and auth.uid() is not null then new.created_by=auth.uid(); new.created_at=now(); end if;
  if tg_op='UPDATE' and old.file_hash is not null then
    if (new.file_path,new.file_name,new.file_hash,new.mime_type,new.file_size,new.created_by,new.created_at,new.company_id) is distinct from (old.file_path,old.file_name,old.file_hash,old.mime_type,old.file_size,old.created_by,old.created_at,old.company_id) then raise exception 'Original source metadata is immutable'; end if;
    if old.created_contract_id is not null and to_jsonb(new) is distinct from to_jsonb(old) then raise exception 'Confirmed import audit is immutable'; end if;
  end if;
  return new;
end $$;
create trigger a_import_source before insert or update or delete on public.contract_imports for each row execute function erp_private.guard_import_source();

create function erp_private.guard_confirmed_field_review() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if exists(select 1 from public.contract_imports where id in (new.import_id,old.import_id) and created_contract_id is not null and file_hash is not null) then raise exception 'Confirmed field review is immutable'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger guard_confirmed_field_review before insert or update or delete on public.contract_import_field_reviews for each row execute function erp_private.guard_confirmed_field_review();

create function erp_private.contract_source_access(object_name text, protect boolean) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.contract_imports i where i.file_path=object_name and
    case when protect then i.file_hash is not null else i.created_contract_id is not null and erp_private.can_read_contract(i.created_contract_id) end);
$$;
revoke all on function erp_private.contract_source_access(text,boolean) from public,anon;
grant execute on function erp_private.contract_source_access(text,boolean) to authenticated;
alter policy erp_storage_read on storage.objects using(bucket_id='documents' and (erp_private.storage_access(name,'read') or erp_private.contract_source_access(name,false)));
create policy contract_source_no_overwrite on storage.objects as restrictive for update to authenticated using(not (bucket_id='documents' and erp_private.contract_source_access(name,true))) with check(not (bucket_id='documents' and erp_private.contract_source_access(name,true)));
create policy contract_source_no_delete on storage.objects as restrictive for delete to authenticated using(not (bucket_id='documents' and erp_private.contract_source_access(name,true)));

-- One transaction for header, parties, product lines and reviewed import audit.
-- SECURITY INVOKER keeps all ownership checks and RLS active.
create function public.save_contract(p_id uuid, p_contract jsonb, p_parties jsonb, p_lines jsonb, p_import_id uuid default null, p_review jsonb default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare saved uuid:=coalesce(p_id,gen_random_uuid()); owner_id uuid; item jsonb; prior public.contracts; source public.contract_imports; next_status text; line_id uuid;
begin
  owner_id=(p_contract->>'company_id')::uuid;
  if not erp_private.has_permission(owner_id,'contracts','write') then raise exception 'Contract write access denied' using errcode='42501'; end if;
  if coalesce(btrim(p_contract->>'contract_number'),'')='' or coalesce(p_contract->>'currency','') !~ '^[A-Z]{3}$' then raise exception 'Contract number and currency are required'; end if;
  next_status=coalesce(p_contract->>'status','Draft');
  if next_status not in ('Draft','Active','Closed','Cancelled') then raise exception 'Invalid Contract status'; end if;
  if jsonb_typeof(p_parties)<>'array' or jsonb_typeof(p_lines)<>'array' or p_parties is null or p_lines is null then raise exception 'Explicit parties and product lines required'; end if;
  if p_import_id is not null then
    select * into source from public.contract_imports where id=p_import_id for update;
    if not found or source.company_id is distinct from owner_id then raise exception 'Import ownership mismatch' using errcode='42501'; end if;
    if source.created_contract_id is not null then return source.created_contract_id; end if;
    if p_id is not null or next_status<>'Draft' or source.status not in ('review','draft') or source.extraction_json is null or p_review is null then raise exception 'Review before creating a Draft Contract is required'; end if;
    if source.file_hash is null or not exists(select 1 from storage.objects where bucket_id='documents' and name=source.file_path) then raise exception 'Verified original document is required'; end if;
  end if;
  if p_id is not null then
    select * into prior from public.contracts where id=p_id and company_id=owner_id for update;
    if not found then raise exception 'Contract not found or access denied' using errcode='42501'; end if;
    if prior.status<>'Draft' then
      if (to_jsonb(prior)->>'contract_number') is distinct from (p_contract->>'contract_number') then raise exception 'Legal Contract values are locked outside Draft'; end if;
      -- Final-state changes use the dedicated lifecycle RPC, never replace snapshots.
      raise exception 'Use Contract lifecycle action for a final Contract';
    end if;
  end if;
  insert into public.contracts(id,company_id,contract_number,title,currency,amount,incoterms,contract_date,expiry_date,status,business_case_id,deal_id,parties_reviewed,legal_snapshot,payment_terms,delivery_place,destination_port,loading_port,expected_shipment_date)
  values(saved,owner_id,btrim(p_contract->>'contract_number'),p_contract->>'title',p_contract->>'currency',(p_contract->>'amount')::numeric,p_contract->>'incoterms',(p_contract->>'contract_date')::date,(p_contract->>'expiry_date')::date,'Draft',coalesce((p_contract->>'deal_id')::uuid,(p_contract->>'business_case_id')::uuid),coalesce((p_contract->>'deal_id')::uuid,(p_contract->>'business_case_id')::uuid),true,coalesce(p_contract->'legal_snapshot','{}'::jsonb),p_contract->>'payment_terms',p_contract->>'delivery_place',p_contract->>'destination_port',p_contract->>'loading_port',(p_contract->>'expected_shipment_date')::date)
  on conflict(id) do update set contract_number=excluded.contract_number,title=excluded.title,currency=excluded.currency,amount=excluded.amount,incoterms=excluded.incoterms,contract_date=excluded.contract_date,expiry_date=excluded.expiry_date,business_case_id=excluded.business_case_id,deal_id=excluded.deal_id,parties_reviewed=true,business_role=null,deal_contract_role=null,legal_snapshot=excluded.legal_snapshot,payment_terms=excluded.payment_terms,delivery_place=excluded.delivery_place,destination_port=excluded.destination_port,loading_port=excluded.loading_port,expected_shipment_date=excluded.expected_shipment_date;
  for item in select value from jsonb_array_elements(p_parties) loop
    insert into public.contract_parties(company_id,contract_id,role_code,internal_company_id,counterparty_id,snapshot)
    values(owner_id,saved,item->>'role_code',(item->>'internal_company_id')::uuid,(item->>'counterparty_id')::uuid,item->'snapshot')
    on conflict(contract_id,role_code) do update set internal_company_id=excluded.internal_company_id,counterparty_id=excluded.counterparty_id,snapshot=excluded.snapshot;
  end loop;
  delete from public.contract_parties where contract_id=saved and role_code not in (select value->>'role_code' from jsonb_array_elements(p_parties));
  for item in select value from jsonb_array_elements(p_lines) loop
    line_id=coalesce((item->>'id')::uuid,gen_random_uuid());
    if exists(select 1 from public.contract_products where id=line_id and contract_id<>saved) then raise exception 'Product line belongs to another Contract'; end if;
    insert into public.contract_products(id,company_id,contract_id,product_id,description,quantity,unit,unit_price,currency,net_weight,gross_weight,size_grade,packing,origin,notes,agreed_amount)
    values(line_id,owner_id,saved,(item->>'product_id')::uuid,item->>'description',(item->>'quantity')::numeric,item->>'unit',(item->>'unit_price')::numeric,item->>'currency',(item->>'net_weight')::numeric,(item->>'gross_weight')::numeric,item->>'size_grade',item->>'packing',item->>'origin',item->>'notes',(item->>'agreed_amount')::numeric)
    on conflict(id) do update set product_id=excluded.product_id,description=excluded.description,quantity=excluded.quantity,unit=excluded.unit,unit_price=excluded.unit_price,currency=excluded.currency,net_weight=excluded.net_weight,gross_weight=excluded.gross_weight,size_grade=excluded.size_grade,packing=excluded.packing,origin=excluded.origin,notes=excluded.notes,agreed_amount=excluded.agreed_amount;
    -- Attach generated IDs to the local payload for exact removal of omitted Draft lines.
    item=jsonb_set(item,'{id}',to_jsonb(line_id));
  end loop;
  -- Existing line IDs are preserved; omission is rejected to avoid orphaning warehouse links.
  if p_id is not null and exists(select 1 from public.contract_products cp where cp.contract_id=saved and cp.created_at<transaction_timestamp() and not exists(select 1 from jsonb_array_elements(p_lines) l where l->>'id'=cp.id::text)) then raise exception 'Existing product lines must be retained'; end if;
  update public.contracts set status=next_status where id=saved;
  if p_import_id is not null then
    insert into public.contract_import_field_reviews(company_id,import_id,field_path,extracted_value,confirmed_value,review_status,reviewed_by,reviewed_at)
    values(owner_id,p_import_id,'contract_review',source.extraction_json,p_review,'confirmed',auth.uid(),now());
    update public.contract_imports set status='confirmed',created_contract_id=saved,review_result=p_review,confirmed_by=auth.uid(),confirmed_at=now(),error_message=null where id=p_import_id;
  end if;
  return saved;
end $$;
revoke all on function public.save_contract(uuid,jsonb,jsonb,jsonb,uuid,jsonb) from public,anon;
grant execute on function public.save_contract(uuid,jsonb,jsonb,jsonb,uuid,jsonb) to authenticated;
comment on column public.contracts.company_id is 'Owning workspace. Never infer Seller or Buyer from ownership.';
comment on column public.contracts.business_role is 'Legacy perspective only. Canonical contracts derive direction per internal Company from contract_parties.';
