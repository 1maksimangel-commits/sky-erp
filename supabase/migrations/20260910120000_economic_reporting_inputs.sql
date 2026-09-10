-- Phase 7 prerequisites only: immutable conversion inputs and explicit cost splits.
-- No profit, P&L, margin or automatic cost allocation is computed here.
create table public.financial_reporting_snapshots (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete restrict,
 invoice_id uuid references public.invoices(id) on delete restrict,
 payment_id uuid references public.payments(id) on delete restrict,
 expense_id uuid references public.expenses(id) on delete restrict,
 commission_id uuid references public.deal_commission_links(id) on delete restrict,
 bank_transaction_id uuid references public.bank_transactions(id) on delete restrict,
 source_kind text not null,
 source_id uuid not null,
 original_amount numeric not null,
 original_currency text not null references public.currencies(code),
 source_snapshot jsonb not null,
 reporting_currency text not null references public.currencies(code),
 reporting_date date not null,
 exchange_rate_id uuid references public.exchange_rates(id) on delete restrict,
 fx_rate numeric not null,
 fx_rate_date date not null,
 fx_source text not null,
 reporting_amount numeric not null,
 created_at timestamptz not null default now(),
 created_by uuid not null references auth.users(id) on delete restrict,
 check(num_nonnulls(invoice_id,payment_id,expense_id,commission_id,bank_transaction_id)=1),
 unique(company_id,source_kind,source_id,reporting_currency)
);
create table public.cost_allocations (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete restrict,
 expense_id uuid references public.expenses(id) on delete restrict,
 commission_id uuid references public.deal_commission_links(id) on delete restrict,
 business_case_id uuid references public.business_cases(id) on delete restrict,
 contract_id uuid references public.contracts(id) on delete restrict,
 shipment_id uuid references public.shipments(id) on delete restrict,
 product_id uuid references public.products(id) on delete restrict,
 contract_product_id uuid references public.contract_products(id) on delete restrict,
 deal_product_id uuid references public.deal_products(id) on delete restrict,
 basis text not null check(basis in ('direct','quantity','net_weight','gross_weight','value','percentage','manual')),
 basis_value numeric,
 amount numeric not null,
 currency text not null references public.currencies(code),
 source_amount numeric not null,
 source_snapshot jsonb not null,
 notes text,
 created_at timestamptz not null default now(),
 created_by uuid not null references auth.users(id) on delete restrict,
 check(num_nonnulls(expense_id,commission_id)=1)
);
create index on public.cost_allocations(expense_id);
create index on public.cost_allocations(commission_id);
create index on public.cost_allocations(business_case_id,company_id);
create index on public.financial_reporting_snapshots(company_id,source_kind,source_id);

-- Fixed whitelist with explicit permission checks, including bilateral legal parties.
-- Locks serialize capture,
-- allocation and edits of the source. JSONB numeric values stay decimal in PostgreSQL.
create function erp_private.economic_source(p_kind text,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare source jsonb;
begin
 case p_kind
 when 'invoice' then select to_jsonb(t) into source from public.invoices t where id=p_id for update;
 when 'payment' then select to_jsonb(t) into source from public.payments t where id=p_id for update;
 when 'expense' then select to_jsonb(t) into source from public.expenses t where id=p_id for update;
 when 'commission' then select to_jsonb(t) into source from public.deal_commission_links t where id=p_id for update;
 when 'bank_transaction' then select to_jsonb(t) into source from public.bank_transactions t where id=p_id for update;
 else raise exception 'Unsupported economic source';
 end case;
 if source is null then raise exception 'Economic source unavailable' using errcode='42501'; end if;
 if not (erp_private.has_permission((source->>'company_id')::uuid,'finance','read')
   or (p_kind='invoice' and (erp_private.has_permission((source->>'issuer_company_id')::uuid,'finance','read') or erp_private.has_permission((source->>'recipient_company_id')::uuid,'finance','read')))
   or (p_kind='payment' and (erp_private.has_permission((source->>'payer_company_id')::uuid,'finance','read') or erp_private.has_permission((source->>'payee_company_id')::uuid,'finance','read')))) then raise exception 'Economic source unavailable' using errcode='42501'; end if;
 return source;
end $$;
revoke all on function erp_private.economic_source(text,uuid) from public,anon;
grant execute on function erp_private.economic_source(text,uuid) to authenticated;

create function erp_private.reporting_snapshot_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare s jsonb; r public.exchange_rates; original numeric; source_currency text;
begin
 if tg_op<>'INSERT' then raise exception 'Reporting inputs are immutable; retain the original snapshot'; end if;
 if not erp_private.has_permission(new.company_id,'finance','write') then raise exception 'Reporting company access denied' using errcode='42501'; end if;
 new.source_kind=case when new.invoice_id is not null then 'invoice' when new.payment_id is not null then 'payment' when new.expense_id is not null then 'expense' when new.commission_id is not null then 'commission' else 'bank_transaction' end;
 new.source_id=coalesce(new.invoice_id,new.payment_id,new.expense_id,new.commission_id,new.bank_transaction_id);
 s=erp_private.economic_source(new.source_kind,new.source_id);
 if new.company_id is distinct from (s->>'company_id')::uuid
   and (new.source_kind='invoice' and new.company_id in ((s->>'issuer_company_id')::uuid,(s->>'recipient_company_id')::uuid)) is not true
   and (new.source_kind='payment' and new.company_id in ((s->>'payer_company_id')::uuid,(s->>'payee_company_id')::uuid)) is not true then
   raise exception 'Company is not an economic party' using errcode='42501';
 end if;
 if (case new.source_kind when 'invoice' then s->>'status' in ('Issued','Partially Paid','Paid','Overdue')
   when 'payment' then s->>'status'='Paid' when 'expense' then s->>'status'='Posted'
   when 'commission' then s->>'status'='Posted' when 'bank_transaction' then true else false end) is not true then raise exception 'Capture requires a posted economic source'; end if;
 original=case when new.source_kind='commission' then (s->>'expected_amount')::numeric else (s->>'amount')::numeric end;
 source_currency=s->>'currency';
 if original is null or original::text in ('NaN','Infinity','-Infinity') then raise exception 'Finite original amount required'; end if;
 if new.reporting_date is null then raise exception 'Explicit reporting date required'; end if;
 if source_currency=new.reporting_currency then
   if new.exchange_rate_id is not null then raise exception 'Same-currency input does not use an FX rate'; end if;
   new.fx_rate=1; new.fx_rate_date=new.reporting_date; new.fx_source='same currency';
 else
   select * into r from public.exchange_rates where id=new.exchange_rate_id for share;
   if r.id is null or r.base_currency is distinct from source_currency or r.quote_currency is distinct from new.reporting_currency then raise exception 'Select an explicit original-to-reporting currency rate'; end if;
   if r.rate<=0 or r.rate::text in ('NaN','Infinity','-Infinity') or r.rate_date>new.reporting_date then raise exception 'Invalid rate or rate date'; end if;
   new.fx_rate=r.rate; new.fx_rate_date=r.rate_date; new.fx_source=coalesce(r.source,'explicit rate record');
 end if;
 new.original_amount=original; new.original_currency=source_currency;
 new.reporting_amount=round(original*new.fx_rate,2);
 new.source_snapshot=s; new.created_by=auth.uid(); new.created_at=now();
 return new;
end $$;
create trigger reporting_snapshot_guard before insert or update or delete on public.financial_reporting_snapshots
for each row execute function erp_private.reporting_snapshot_guard();

create function erp_private.cost_allocation_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare s jsonb; origin_amount numeric; allocated numeric; sh public.shipments; c public.contracts;
 cp public.contract_products; dp public.deal_products;
begin
 if tg_op<>'INSERT' then raise exception 'Cost allocations are immutable'; end if;
 if not erp_private.has_permission(new.company_id,'finance','write') then raise exception 'Allocation company access denied' using errcode='42501'; end if;
 s=erp_private.economic_source(case when new.expense_id is not null then 'expense' else 'commission' end,coalesce(new.expense_id,new.commission_id));
 if new.company_id is distinct from (s->>'company_id')::uuid then raise exception 'Allocation must retain source economic owner' using errcode='42501'; end if;
 if s->>'status' is distinct from 'Posted' then raise exception 'Only posted costs may be allocated'; end if;
 origin_amount=case when new.expense_id is not null then (s->>'amount')::numeric else (s->>'expected_amount')::numeric end;
 if new.currency is distinct from s->>'currency' then raise exception 'Allocation retains original currency'; end if;
 if new.amount is null or new.amount<=0 or new.amount::text in ('NaN','Infinity','-Infinity') or new.amount<>round(new.amount,2) then raise exception 'Positive allocation with at most two decimal places required'; end if;
 if new.basis not in ('direct','manual') then
   if new.basis_value is null or new.basis_value<=0 or new.basis_value::text in ('NaN','Infinity','-Infinity') then raise exception 'Explicit allocation basis value required'; end if;
 end if;
 if new.basis='percentage' and (new.basis_value>100 or new.amount<>round(origin_amount*new.basis_value/100,2)) then raise exception 'Percentage does not match explicit allocation amount'; end if;
 if new.shipment_id is not null then
   select * into sh from public.shipments where id=new.shipment_id;
   if sh.id is null or sh.company_id<>new.company_id then raise exception 'Shipment allocation owner mismatch' using errcode='42501'; end if;
   if new.contract_id is not null and new.contract_id is distinct from sh.contract_id then raise exception 'Shipment and Contract allocation mismatch'; end if;
   new.contract_id=sh.contract_id;
   if new.business_case_id is not null and new.business_case_id is distinct from sh.business_case_id then raise exception 'Shipment and Deal allocation mismatch'; end if;
   new.business_case_id=sh.business_case_id;
 end if;
 if new.contract_product_id is not null then
   select * into cp from public.contract_products where id=new.contract_product_id;
   if cp.id is null or (new.contract_id is not null and cp.contract_id<>new.contract_id) then raise exception 'Contract product allocation mismatch'; end if;
   new.contract_id=cp.contract_id;
   if new.product_id is not null and new.product_id is distinct from cp.product_id then raise exception 'Canonical Product mismatch'; end if;
   new.product_id=cp.product_id;
 end if;
 if new.deal_product_id is not null then
   select * into dp from public.deal_products where id=new.deal_product_id;
   if dp.id is null or dp.company_id<>new.company_id or (new.business_case_id is not null and dp.business_case_id<>new.business_case_id) then raise exception 'Deal product allocation mismatch'; end if;
   new.business_case_id=dp.business_case_id;
   if new.product_id is not null and new.product_id is distinct from dp.product_id then raise exception 'Canonical Product mismatch'; end if;
   new.product_id=dp.product_id;
 end if;
 if new.contract_id is not null then
   select * into c from public.contracts where id=new.contract_id;
   if c.id is null or (c.company_id<>new.company_id and not exists(select 1 from public.contract_parties where contract_id=c.id and role_code in ('seller','buyer') and internal_company_id=new.company_id)) then raise exception 'Contract allocation company mismatch' using errcode='42501'; end if;
   if new.business_case_id is not null and new.business_case_id is distinct from c.business_case_id then raise exception 'Contract and Deal allocation mismatch'; end if;
   new.business_case_id=c.business_case_id;
 elsif new.business_case_id is not null and not exists(select 1 from public.business_cases where id=new.business_case_id and company_id=new.company_id) then raise exception 'Deal allocation company mismatch' using errcode='42501';
 end if;
 if new.product_id is not null and new.contract_product_id is null and new.deal_product_id is null and not exists(select 1 from public.products where id=new.product_id and company_id=new.company_id) then raise exception 'Product allocation company mismatch' using errcode='42501'; end if;
 -- A source with a known direct origin cannot be silently reallocated elsewhere.
 if s->>'business_case_id' is not null and (s->>'business_case_id')::uuid is distinct from new.business_case_id then raise exception 'Source Deal allocation mismatch'; end if;
 if s->>'contract_id' is not null and (s->>'contract_id')::uuid is distinct from new.contract_id then raise exception 'Source Contract allocation mismatch'; end if;
 if s->>'shipment_id' is not null and (s->>'shipment_id')::uuid is distinct from new.shipment_id then raise exception 'Source Shipment allocation mismatch'; end if;
 select coalesce(sum(amount),0) into allocated from public.cost_allocations where expense_id=new.expense_id or commission_id=new.commission_id;
 if allocated+new.amount>origin_amount then raise exception 'Allocation exceeds original cost'; end if;
 new.source_amount=origin_amount; new.source_snapshot=s;
 new.created_by=auth.uid(); new.created_at=now(); return new;
end $$;
create trigger cost_allocation_guard before insert or update or delete on public.cost_allocations
for each row execute function erp_private.cost_allocation_guard();

-- Do not let subsequent source edits invalidate captured reporting inputs/splits.
create function erp_private.economic_source_history_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare protected boolean; j jsonb:=to_jsonb(old); kind text;
begin
 kind=case tg_table_name when 'invoices' then 'invoice' when 'payments' then 'payment' when 'expenses' then 'expense' when 'deal_commission_links' then 'commission' else 'bank_transaction' end;
 select exists(select 1 from public.financial_reporting_snapshots where source_kind=kind and source_id=old.id)
 or exists(select 1 from public.cost_allocations where (kind='expense' and expense_id=old.id) or (kind='commission' and commission_id=old.id)) into protected;
 if protected then
   if tg_op='DELETE' then raise exception 'Economic source has immutable reporting history'; end if;
   if (to_jsonb(new)-array['status','paid_amount','outstanding','updated_at','notes']) is distinct from (j-array['status','paid_amount','outstanding','updated_at','notes']) then raise exception 'Captured economic source values are immutable'; end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['invoices','payments','expenses','deal_commission_links','bank_transactions'] loop
 execute format('create trigger zz_economic_source_history before update or delete on public.%I for each row execute function erp_private.economic_source_history_guard()',t);
 end loop;
 foreach t in array array['financial_reporting_snapshots','cost_allocations'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('create policy member_read on public.%I for select to authenticated using(erp_private.has_permission(company_id,''finance'',''read''))',t);
 execute format('create policy member_insert on public.%I for insert to authenticated with check(erp_private.has_permission(company_id,''finance'',''write''))',t);
 execute format('create policy immutable_update on public.%I for update to authenticated using(false) with check(false)',t);
 execute format('create policy immutable_delete on public.%I for delete to authenticated using(false)',t);
 end loop;
end $$;
revoke all on function erp_private.reporting_snapshot_guard(),erp_private.cost_allocation_guard(),erp_private.economic_source_history_guard() from public,anon;
-- Future reporting consumes decimal text, never browser/JS Number aggregates.
create function public.economics_reporting_input(p_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',id,'company_id',company_id,'source_kind',source_kind,'source_id',source_id,
 'original_amount',original_amount::text,'original_currency',original_currency,
 'reporting_currency',reporting_currency,'reporting_date',reporting_date,
 'fx_rate',fx_rate::text,'fx_rate_date',fx_rate_date,'fx_source',fx_source,
 'reporting_amount',reporting_amount::text,'source_status',source_snapshot->>'status')
 from public.financial_reporting_snapshots where id=p_id;
$$;
revoke all on function public.economics_reporting_input(uuid) from public,anon;
grant execute on function public.economics_reporting_input(uuid) to authenticated;
create function public.economics_capture_reporting_input(p_input jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare saved uuid;
begin
 insert into public.financial_reporting_snapshots(company_id,invoice_id,payment_id,expense_id,commission_id,bank_transaction_id,reporting_currency,reporting_date,exchange_rate_id)
 values((p_input->>'company_id')::uuid,(p_input->>'invoice_id')::uuid,(p_input->>'payment_id')::uuid,(p_input->>'expense_id')::uuid,(p_input->>'commission_id')::uuid,(p_input->>'bank_transaction_id')::uuid,p_input->>'reporting_currency',(p_input->>'reporting_date')::date,(p_input->>'exchange_rate_id')::uuid)
 returning id into saved; return saved;
end $$;
create function public.economics_allocate_cost(p_input jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare saved uuid;
begin
 insert into public.cost_allocations(company_id,expense_id,commission_id,business_case_id,contract_id,shipment_id,product_id,contract_product_id,deal_product_id,basis,basis_value,amount,currency,notes)
 values((p_input->>'company_id')::uuid,(p_input->>'expense_id')::uuid,(p_input->>'commission_id')::uuid,(p_input->>'business_case_id')::uuid,(p_input->>'contract_id')::uuid,(p_input->>'shipment_id')::uuid,(p_input->>'product_id')::uuid,(p_input->>'contract_product_id')::uuid,(p_input->>'deal_product_id')::uuid,p_input->>'basis',(p_input->>'basis_value')::numeric,(p_input->>'amount')::numeric,p_input->>'currency',p_input->>'notes')
 returning id into saved; return saved;
end $$;
revoke all on function public.economics_capture_reporting_input(jsonb),public.economics_allocate_cost(jsonb) from public,anon;
grant execute on function public.economics_capture_reporting_input(jsonb),public.economics_allocate_cost(jsonb) to authenticated;
notify pgrst,'reload schema';
