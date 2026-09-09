-- Phase 2: canonical authenticated access. Historical migrations are preserved.
-- No anonymous ERP access. No ownership guessed or business records rewritten.
create schema if not exists erp_private;
revoke all on schema erp_private from public, anon;
grant usage on schema erp_private to authenticated;

create unique index user_profiles_user_id_unique on public.user_profiles(user_id);
alter table public.user_profiles
  add constraint user_profiles_auth_user_fk foreign key(user_id) references auth.users(id) on delete cascade,
  add column active_company_id uuid references public.companies(id) on delete set null;

create table public.company_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  role_code text not null references public.roles(code),
  primary key(user_id, company_id)
);
alter table public.company_memberships enable row level security;

-- The database is the only permission registry; UI reads this registry too.
update public.roles set permissions = case code
  when 'admin' then '["*"]'::jsonb
  when 'sales' then '["*.read","business_cases.write","contracts.write","counterparties.write","products.write","crm.write","documents.write","platform.write"]'::jsonb
  when 'finance' then '["*.read","finance.write","documents.write","platform.write"]'::jsonb
  when 'warehouse' then '["*.read","warehouse.write","documents.write","platform.write"]'::jsonb
  when 'logistics' then '["*.read","logistics.write","documents.write","platform.write"]'::jsonb
  else '["*.read"]'::jsonb end
where code in ('admin','sales','finance','warehouse','logistics','management','readonly');

create function erp_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.user_profiles
    where user_id = auth.uid() and is_active and role_code = 'admin');
$$;
create function erp_private.has_permission(company uuid, domain text, operation text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    erp_private.is_admin() or exists (
      select 1 from public.company_memberships m
      join public.user_profiles p on p.user_id = m.user_id and p.is_active
      join public.roles r on r.code = m.role_code
      where m.user_id = auth.uid() and m.company_id = company
        and not (operation = 'write' and domain in ('companies','roles','user_profiles','company_memberships'))
        and (r.permissions ? '*' or r.permissions ? (domain || '.*')
          or r.permissions ? (domain || '.' || operation)
          or (operation = 'read' and r.permissions ? '*.read'))
    )
  );
$$;
create function public.authorize_permission(permission text, company_id uuid default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select erp_private.is_admin() or exists (
    select 1 from public.company_memberships m where m.user_id = auth.uid()
      and ($2 is null or m.company_id = $2)
      and erp_private.has_permission(m.company_id, split_part(permission,'.',1), split_part(permission,'.',2))
  );
$$;
create function public.active_company_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.active_company_id from public.user_profiles p where p.user_id = auth.uid() and p.is_active
      and erp_private.has_permission(p.active_company_id,'companies','read')),
    (select m.company_id from public.company_memberships m
      where m.user_id = auth.uid() and erp_private.has_permission(m.company_id,'companies','read')
      order by m.company_id limit 1)
  );
$$;
create function public.set_active_company(company_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not erp_private.has_permission(company_id,'companies','read') then
    raise exception 'Company access denied' using errcode = '42501';
  end if;
  update public.user_profiles set active_company_id = company_id where user_id = auth.uid() and is_active;
end $$;
create function erp_private.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Never trust user-supplied metadata for roles or membership. No auto-admin.
  insert into public.user_profiles(user_id, email, full_name, role_code, is_active)
  values (new.id, case when exists(select 1 from public.user_profiles where email = new.email) then null else new.email end, '', 'readonly', true);
  return new;
end $$;
create trigger sky_create_profile after insert on auth.users
for each row execute function erp_private.create_profile();

-- Existing authenticated identities receive the same unprivileged profile.
-- Email collisions never bind an identity to the historical seeded Admin.
insert into public.user_profiles(user_id,email,full_name,role_code,is_active)
select u.id,case when exists(select 1 from public.user_profiles p where p.email=u.email) then null else u.email end,
  '', 'readonly', true
from auth.users u where not exists(select 1 from public.user_profiles p where p.user_id=u.id);

-- All private operational records carry ownership. Child ownership is derived
-- from its parent below, never from a browser-supplied company alone.
do $$ declare t text; begin
  foreach t in array array[
    'accounts','counterparties','products','business_cases','contracts','shipments','payments','invoices','expenses',
    'contract_products','shipment_timeline_events','warehouse_locations','inventory','inventory_lots',
    'stock_movements','warehouse_transfers','inventory_reservations','bank_accounts','bank_transactions',
    'invoice_items','payment_allocations','documents','document_versions','contract_imports',
    'contract_import_field_reviews','crm_customers','crm_contacts','crm_notes','crm_communications',
    'crm_tasks','crm_timeline_events','crm_attachments','deal_participants','deal_products',
    'deal_commission_links','document_templates','generated_documents','template_mappings',
    'document_generation_batches','notifications','timeline_events','activity_log'
  ] loop
    execute format('alter table public.%I add column if not exists company_id uuid references public.companies(id)',t);
    execute format('create index if not exists %I on public.%I(company_id)',t || '_auth_company_idx',t);
  end loop;
end $$;

create function erp_private.entity_company(entity_type text, entity_id uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare t text; c uuid;
begin
  t := case entity_type
    when 'company' then 'companies' when 'counterparty' then 'counterparties'
    when 'product' then 'products' when 'business_case' then 'business_cases'
    when 'contract' then 'contracts' when 'shipment' then 'shipments'
    when 'invoice' then 'invoices' when 'payment' then 'payments'
    when 'warehouse' then 'warehouse_locations' when 'warehouse_lot' then 'inventory_lots'
    when 'document' then 'documents' when 'crm_customer' then 'crm_customers'
    else null end;
  if t is null or entity_id is null then return null; end if;
  if t = 'companies' then select id into c from public.companies where id = entity_id;
  else execute format('select company_id from public.%I where id = $1',t) into c using entity_id;
  end if;
  return c;
end $$;

-- Copying a historical document version may reuse its old object name, but
-- only if trusted metadata already associates that object with this company.
create function erp_private.legacy_path_owned(object_name text, owner_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select erp_private.is_admin() or (erp_private.has_permission(owner_company,'documents','write') and (
    exists(select 1 from public.documents where company_id=owner_company and (file_path=object_name or storage_path=object_name))
    or exists(select 1 from public.document_versions where company_id=owner_company and file_path=object_name)
    or exists(select 1 from public.document_templates where company_id=owner_company and storage_path=object_name)
    or exists(select 1 from public.generated_documents where company_id=owner_company and (docx_storage_path=object_name or pdf_storage_path=object_name))
    or exists(select 1 from public.contract_imports where company_id=owner_company and file_path=object_name)
    or exists(select 1 from public.crm_attachments where company_id=owner_company and file_path=object_name)
  ));
$$;

create function erp_private.enforce_ownership() returns trigger
language plpgsql security definer set search_path = '' as $$
declare row_data jsonb := to_jsonb(new); old_data jsonb;
  company uuid; parent_company uuid; fk record; field text; target uuid; actor uuid := auth.uid();
begin
  if tg_op = 'UPDATE' then old_data := to_jsonb(old); end if;
  company := nullif(row_data->>'company_id','')::uuid;
  if tg_nargs > 0 and row_data->>tg_argv[0] is not null then
    execute format('select %I from public.%I where id = $1',case when tg_argv[1]='companies' then 'id' else 'company_id' end,tg_argv[1])
      into parent_company using (row_data->>tg_argv[0])::uuid;
    if company is not null and parent_company is distinct from company and actor is not null then
      raise exception 'Parent company mismatch' using errcode = '42501';
    end if;
    company := coalesce(parent_company, company);
  end if;
  if row_data->>'entity_id' is not null then
    parent_company := erp_private.entity_company(row_data->>'entity_type',(row_data->>'entity_id')::uuid);
    if actor is not null and parent_company is null and not erp_private.is_admin() then raise exception 'Entity ownership is unresolved' using errcode = '42501'; end if;
    if company is not null and parent_company is not null and company <> parent_company then raise exception 'Entity company mismatch' using errcode = '42501'; end if;
    company := coalesce(parent_company,company);
  end if;
  if row_data->>'related_entity_id' is not null and actor is not null then
    parent_company := erp_private.entity_company(row_data->>'related_entity_type',(row_data->>'related_entity_id')::uuid);
    if parent_company is distinct from company then raise exception 'Related entity company mismatch' using errcode = '42501'; end if;
  end if;
  if tg_op = 'INSERT' then company := coalesce(company,public.active_company_id()); end if;
  -- Preserve quarantine on edits to unassigned legacy rows. Only a separately
  -- reviewed ownership migration may assign them; global Admin can still edit.
  if tg_op = 'UPDATE' and actor is not null and erp_private.is_admin()
    and old_data->>'company_id' is null and row_data->>'company_id' is null then company := null; end if;
  if tg_op = 'UPDATE' and actor is not null and company is distinct from (old_data->>'company_id')::uuid then
    raise exception 'Company ownership cannot be reassigned through the application' using errcode = '42501';
  end if;
  row_data := row_data || jsonb_build_object('company_id',company);
  -- Reject cross-company FK grafting, including products, contracts, invoices,
  -- storage metadata versions and generation batches. Identifiers are catalog-derived.
  for fk in
    select a.attname as column_name, target.relname as target_table
    from pg_catalog.pg_constraint con
    join pg_catalog.pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
    join pg_catalog.pg_class target on target.oid = con.confrelid
    join pg_catalog.pg_namespace ns on ns.oid = target.relnamespace
    where con.conrelid = tg_relid and con.contype = 'f' and array_length(con.conkey,1) = 1
      and ns.nspname = 'public' and a.attname <> 'company_id'
      and (target.relname = 'companies' or exists(select 1 from pg_catalog.pg_attribute ac where ac.attrelid = target.oid and ac.attname = 'company_id' and not ac.attisdropped))
  loop
    target := nullif(row_data->>fk.column_name,'')::uuid;
    if target is null then continue; end if;
    if fk.target_table = tg_table_name and target = (row_data->>'id')::uuid then continue; end if;
    if fk.target_table = 'companies' then parent_company := target;
    else execute format('select company_id from public.%I where id = $1',fk.target_table) into parent_company using target; end if;
    if (actor is not null or (company is not null and parent_company is not null)) and parent_company is distinct from company
      and not (erp_private.is_admin() and (company is null or parent_company is null)) then
      raise exception 'Cross-company relationship rejected: %.%',tg_table_name,fk.column_name using errcode = '42501';
    end if;
  end loop;
  if actor is not null then
    foreach field in array array['file_path','storage_path','docx_storage_path','pdf_storage_path'] loop
      if row_data->>field is not null and (tg_op = 'INSERT' or row_data->>field is distinct from old_data->>field) then
        if split_part(row_data->>field,'/',1) <> 'companies' and erp_private.legacy_path_owned(row_data->>field,company) then continue; end if;
        if not (company is null and erp_private.is_admin() and split_part(row_data->>field,'/',1) = 'global')
          and (split_part(row_data->>field,'/',1) <> 'companies' or split_part(row_data->>field,'/',2) is distinct from company::text) then
          raise exception 'Storage path company mismatch' using errcode = '42501';
        end if;
      end if;
    end loop;
    foreach field in array array['user_id','uploaded_by'] loop
      if row_data ? field then
        if tg_op = 'INSERT' then row_data := row_data || jsonb_build_object(field,actor);
        elsif row_data->field is distinct from old_data->field then raise exception 'Actor cannot be reassigned' using errcode = '42501'; end if;
      end if;
    end loop;
  end if;
  new := jsonb_populate_record(new,row_data);
  return new;
end $$;

-- Deliberately replace accumulated permissive policies, in this forward migration.
do $$ declare p record; r record; expression text; begin
  for p in select tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I',p.policyname,p.tablename);
  end loop;
  revoke all on all tables in schema public from public, anon, authenticated;
  alter default privileges for role postgres in schema public revoke all on tables from public, anon, authenticated;
  alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
  grant usage on schema public to authenticated;
  for r in select * from (values
    ('counterparties','counterparties','source_company_id','companies'),('products','products',null,null),
    ('business_cases','business_cases',null,null),('contracts','contracts',null,null),
    ('shipments','logistics','contract_id','contracts'),('payments','finance','invoice_id','invoices'),
    ('invoices','finance','contract_id','contracts'),('expenses','finance',null,null),
    ('contract_products','contracts','contract_id','contracts'),('shipment_timeline_events','logistics','shipment_id','shipments'),
    ('warehouse_locations','warehouse',null,null),('inventory','warehouse','warehouse_id','warehouse_locations'),
    ('inventory_lots','warehouse','inventory_id','inventory'),('stock_movements','warehouse','warehouse_id','warehouse_locations'),
    ('warehouse_transfers','warehouse','from_location','warehouse_locations'),('inventory_reservations','warehouse','inventory_id','inventory'),
    ('accounts','finance',null,null),('bank_accounts','finance',null,null),('bank_transactions','finance','bank_account_id','bank_accounts'),
    ('invoice_items','finance','invoice_id','invoices'),('payment_allocations','finance','invoice_id','invoices'),
    ('documents','documents',null,null),('document_versions','documents','document_id','documents'),
    ('contract_imports','contracts',null,null),('contract_import_field_reviews','contracts','import_id','contract_imports'),
    ('crm_customers','crm',null,null),('crm_contacts','crm','customer_id','crm_customers'),
    ('crm_notes','crm','customer_id','crm_customers'),('crm_communications','crm','customer_id','crm_customers'),
    ('crm_tasks','crm','customer_id','crm_customers'),('crm_timeline_events','crm','customer_id','crm_customers'),
    ('crm_attachments','documents','customer_id','crm_customers'),
    ('deal_participants','business_cases','business_case_id','business_cases'),('deal_products','business_cases','business_case_id','business_cases'),
    ('deal_commission_links','finance','business_case_id','business_cases'),
    ('document_templates','documents',null,null),('generated_documents','documents',null,null),
    ('template_mappings','documents','template_id','document_templates'),('document_generation_batches','documents','deal_id','business_cases'),
    ('notifications','platform',null,null),('timeline_events','platform',null,null),('activity_log','platform',null,null)
  ) as m(t,domain,parent_column,parent_table) loop
    execute format('alter table public.%I enable row level security',r.t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',r.t);
    execute format('create policy member_read on public.%I for select to authenticated using (erp_private.has_permission(company_id,%L,''read''))',r.t,r.domain);
    execute format('create policy member_insert on public.%I for insert to authenticated with check (erp_private.has_permission(company_id,%L,''write''))',r.t,r.domain);
    execute format('create policy member_update on public.%I for update to authenticated using (erp_private.has_permission(company_id,%L,''write'')) with check (erp_private.has_permission(company_id,%L,''write''))',r.t,r.domain,r.domain);
    execute format('create policy member_delete on public.%I for delete to authenticated using (erp_private.has_permission(company_id,%L,''write''))',r.t,r.domain);
    if r.parent_column is null then expression := ''; else expression := format('%L,%L',r.parent_column,r.parent_table); end if;
    execute format('create trigger enforce_company_ownership before insert or update on public.%I for each row execute function erp_private.enforce_ownership(%s)',r.t,expression);
  end loop;
  -- Shared non-business reference data: authenticated reads; controlled writes.
  foreach expression in array array['currencies','exchange_rates','expense_categories','roles'] loop
    execute format('alter table public.%I enable row level security',expression);
    execute format('grant select,insert,update,delete on public.%I to authenticated',expression);
    execute format('create policy reference_read on public.%I for select to authenticated using (public.authorize_permission(''companies.read''))',expression);
    if expression = 'exchange_rates' then
      execute 'create policy reference_finance_write on public.exchange_rates for all to authenticated using (public.authorize_permission(''finance.write'')) with check (public.authorize_permission(''finance.write''))';
    else
      execute format('create policy reference_admin_write on public.%I for all to authenticated using (erp_private.is_admin()) with check (erp_private.is_admin())',expression);
    end if;
  end loop;
end $$;

grant select,insert,update,delete on public.companies, public.user_profiles, public.company_memberships to authenticated;
create policy company_read on public.companies for select to authenticated using (erp_private.has_permission(id,'companies','read'));
create policy company_admin on public.companies for all to authenticated using (erp_private.is_admin()) with check (erp_private.is_admin());
create policy profile_self_read on public.user_profiles for select to authenticated using (user_id = auth.uid() or erp_private.is_admin());
create policy profile_admin on public.user_profiles for all to authenticated using (erp_private.is_admin()) with check (erp_private.is_admin());
create policy membership_self_read on public.company_memberships for select to authenticated using (user_id = auth.uid() or erp_private.is_admin());
create policy membership_admin on public.company_memberships for all to authenticated using (erp_private.is_admin()) with check (erp_private.is_admin());

-- Existing transactional RPCs keep their bodies and signatures; invoker security
-- makes the SAME row policies apply to direct queries and RPC calls.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'log_activity','add_timeline_event','create_notification','soft_delete_contract',
      'refresh_invoice_balances','finance_register_payment','_ensure_inventory_row',
      'warehouse_receive_stock','warehouse_issue_stock','warehouse_transfer_stock','warehouse_adjust_stock'
    ) loop
    execute format('alter function %s security invoker',f.signature);
  end loop;
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','erp_private') and p.prokind = 'f' and not exists (
      select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e'
    ) loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  end loop;
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'authorize_permission','active_company_id','set_active_company',
      'log_activity','add_timeline_event','create_notification','soft_delete_contract',
      'refresh_invoice_balances','finance_register_payment','_ensure_inventory_row',
      'warehouse_receive_stock','warehouse_issue_stock','warehouse_transfer_stock','warehouse_adjust_stock'
    ) loop execute format('grant execute on function %s to authenticated',f.signature); end loop;
end $$;
grant execute on function erp_private.is_admin(), erp_private.has_permission(uuid,text,text) to authenticated;

-- New storage is company-prefixed; existing private objects remain readable only
-- through metadata visible under RLS (or by the authenticated global Admin).
create function erp_private.storage_access(object_name text, operation text) returns boolean
language plpgsql stable security invoker set search_path = '' as $$
declare c uuid;
begin
  if erp_private.is_admin() then return true; end if;
  if split_part(object_name,'/',1) = 'companies' then
    begin c := split_part(object_name,'/',2)::uuid; exception when invalid_text_representation then return false; end;
    return erp_private.has_permission(c,'documents',operation);
  end if;
  if operation <> 'read' then return false; end if;
  return exists(select 1 from public.documents where file_path = object_name or storage_path = object_name)
    or exists(select 1 from public.document_versions where file_path = object_name)
    or exists(select 1 from public.document_templates where storage_path = object_name)
    or exists(select 1 from public.generated_documents where docx_storage_path = object_name or pdf_storage_path = object_name)
    or exists(select 1 from public.contract_imports where file_path = object_name)
    or exists(select 1 from public.crm_attachments where file_path = object_name);
end $$;
revoke all on function erp_private.storage_access(text,text) from public,anon;
grant execute on function erp_private.storage_access(text,text) to authenticated;
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' loop
    execute format('drop policy %I on storage.objects',p.policyname);
  end loop;
end $$;
create policy erp_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'documents' and erp_private.storage_access(name,'read'));
create policy erp_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and erp_private.storage_access(name,'write'));
create policy erp_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'documents' and erp_private.storage_access(name,'write'))
  with check (bucket_id = 'documents' and erp_private.storage_access(name,'write'));
create policy erp_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and erp_private.storage_access(name,'write'));

notify pgrst, 'reload schema';

create function public.storage_company_for_entity(entity_type text, entity_id uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare c uuid;
begin
  c := erp_private.entity_company(entity_type,entity_id);
  if not erp_private.has_permission(c,'documents','write') then raise exception 'Document company access denied' using errcode = '42501'; end if;
  return c;
end $$;
revoke all on function public.storage_company_for_entity(text,uuid) from public,anon;
grant execute on function public.storage_company_for_entity(text,uuid) to authenticated;
