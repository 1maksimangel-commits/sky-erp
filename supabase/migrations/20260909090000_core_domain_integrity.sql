-- Phase 3: core integrity only. Historical migrations and Phase 2 RLS preserved.
alter table public.business_cases add column archived_at timestamptz;
alter table public.deal_products add column notes text;

-- SKU prechecks alone raced and allowed duplicate imports in one company.
create unique index products_company_sku_key on public.products(company_id,lower(btrim(sku)))
where company_id is not null and sku is not null and btrim(sku) <> '';

-- GBP was already offered by core forms but absent from the currency dictionary.
insert into public.currencies(code,name,symbol) values ('GBP','Pound Sterling','£') on conflict(code) do nothing;
alter table public.products add constraint products_currency_fk foreign key(currency) references public.currencies(code);
alter table public.business_cases add constraint business_cases_currency_fk foreign key(currency) references public.currencies(code);
alter table public.deal_products
  add constraint deal_products_purchase_currency_fk foreign key(purchase_currency) references public.currencies(code),
  add constraint deal_products_sales_currency_fk foreign key(sales_currency) references public.currencies(code);
alter table public.counterparties add constraint counterparties_bank_currency_fk foreign key(bank_currency) references public.currencies(code);

-- NOT VALID preserves pre-existing legacy rows; new writes/edits are checked.
alter table public.companies add constraint companies_core_names check(btrim(name) <> '' and btrim(code) <> '') not valid;
alter table public.counterparties add constraint counterparties_core_name check(btrim(legal_name) <> '') not valid;
alter table public.products add constraint products_core_values check(
 btrim(name) <> '' and (glaze is null or glaze between 0 and 100)
 and (purchase_price is null or purchase_price between 0 and 1000000000)
 and (sale_price is null or sale_price between 0 and 1000000000)
 and (net_weight is null or net_weight between 0 and 1000000000)
 and (gross_weight is null or gross_weight between 0 and 1000000000)
 and (gross_weight is null or net_weight is null or gross_weight >= net_weight)
) not valid;
alter table public.deal_products add constraint deal_products_core_values check(
 quantity > 0 and quantity <= 1000000000 and btrim(unit) <> ''
 and (purchase_price is null or purchase_price between 0 and 1000000000)
 and (sales_price is null or sales_price between 0 and 1000000000)
 and (purchase_price is null or purchase_currency is not null)
 and (sales_price is null or sales_currency is not null)
 and (net_weight is null or net_weight between 0 and 1000000000)
 and (gross_weight is null or gross_weight between 0 and 1000000000)
 and (gross_weight is null or net_weight is null or gross_weight >= net_weight)
) not valid;

create function public.sync_core_deal_number() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.case_number is distinct from old.case_number and new.number is not distinct from old.number then new.number:=new.case_number;
  elsif new.number is distinct from old.number and new.case_number is not distinct from old.case_number then new.case_number:=new.number;
  elsif (new.number is distinct from old.number or new.case_number is distinct from old.case_number) and new.number is distinct from new.case_number then
   raise exception 'Deal number aliases must agree' using errcode='23514';
  end if;
 elsif new.number is not null and new.case_number is not null and new.number <> new.case_number then
  raise exception 'Deal number aliases must agree' using errcode='23514';
 end if;
 return new;
end $$;
create trigger a_core_deal_number before insert or update on public.business_cases for each row execute function public.sync_core_deal_number();
create trigger core_company_timestamp before update on public.companies for each row execute function public.touch_canonical_deal_updated_at();
create trigger core_counterparty_timestamp before update on public.counterparties for each row execute function public.touch_canonical_deal_updated_at();
create trigger core_product_timestamp before update on public.products for each row execute function public.touch_canonical_deal_updated_at();

-- A Company and its optional primary bank details save in one transaction.
-- Invoker security retains every Phase 2 grant, policy and ownership trigger.
create function public.save_company_core(p_id uuid, p_company jsonb, p_bank jsonb default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare c public.companies; b public.bank_accounts; saved uuid; bank_id uuid;
begin
 if not public.authorize_permission('companies.write') then raise exception 'Company administration requires Admin' using errcode='42501'; end if;
 c:=jsonb_populate_record(null::public.companies,p_company);
 if p_id is null then
  insert into public.companies(business_role,code,name,short_name,country,city,address,tax_id,registration_number,email,phone,website,authorized_signer_name,authorized_signer_title,is_active) values(c.business_role,c.code,c.name,c.short_name,c.country,c.city,c.address,c.tax_id,c.registration_number,c.email,c.phone,c.website,c.authorized_signer_name,c.authorized_signer_title,c.is_active) returning id into saved;
 else
  update public.companies set business_role=c.business_role,code=c.code,name=c.name,short_name=c.short_name,country=c.country,city=c.city,address=c.address,tax_id=c.tax_id,registration_number=c.registration_number,email=c.email,phone=c.phone,website=c.website,authorized_signer_name=c.authorized_signer_name,authorized_signer_title=c.authorized_signer_title,is_active=c.is_active where id=p_id returning id into saved;
  if saved is null then raise exception 'Company not found or access denied' using errcode='42501'; end if;
 end if;
 if p_bank is not null then
  b:=jsonb_populate_record(null::public.bank_accounts,p_bank);
  select id into bank_id from public.bank_accounts where company_id=saved order by created_at,id limit 1 for update;
  if bank_id is null then
   insert into public.bank_accounts(company_id,name,bank_name,bank_address,account_number,iban,swift,currency) values(saved,b.name,b.bank_name,b.bank_address,b.account_number,b.iban,b.swift,b.currency);
  else
   update public.bank_accounts set name=b.name,bank_name=b.bank_name,bank_address=b.bank_address,account_number=b.account_number,iban=b.iban,swift=b.swift,currency=b.currency,updated_at=now() where id=bank_id;
  end if;
 end if;
 return saved;
end $$;
revoke all on function public.save_company_core(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_company_core(uuid,jsonb,jsonb) to authenticated;
revoke all on function public.sync_core_deal_number() from public,anon,authenticated;

-- The existing import parser compares SKUs without case. Match that rule in
-- both its batched preview lookup and the database's authoritative unique key.
create function public.find_core_product_skus(p_skus text[]) returns setof text
language sql stable security invoker set search_path='' as $$
 select p.sku from public.products p
 where (public.active_company_id() is null or p.company_id=public.active_company_id())
 and lower(btrim(p.sku)) in (select lower(btrim(value)) from unnest(p_skus) as value)
$$;
revoke all on function public.find_core_product_skus(text[]) from public,anon;
grant execute on function public.find_core_product_skus(text[]) to authenticated;
notify pgrst,'reload schema';
