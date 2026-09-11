-- Phase 7: immutable realization, intercompany acquisition lineage and explicit FX.
alter table public.financial_reporting_snapshots add column contract_id uuid references public.contracts(id) on delete restrict,
 add column stock_movement_id uuid references public.stock_movements(id) on delete restrict;
alter table public.financial_reporting_snapshots drop constraint financial_reporting_snapshots_check;
alter table public.financial_reporting_snapshots add constraint financial_reporting_sources_one check(num_nonnulls(invoice_id,payment_id,expense_id,commission_id,bank_transaction_id,contract_id,stock_movement_id)=1);
create or replace function erp_private.economic_source(p_kind text,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare source jsonb;
begin
 case p_kind
 when 'invoice' then select to_jsonb(t) into source from public.invoices t where id=p_id for update;
 when 'payment' then select to_jsonb(t) into source from public.payments t where id=p_id for update;
 when 'expense' then select to_jsonb(t) into source from public.expenses t where id=p_id for update;
 when 'commission' then select to_jsonb(t) into source from public.deal_commission_links t where id=p_id for update;
 when 'contract' then select to_jsonb(t) into source from public.contracts t where id=p_id for update;
 when 'stock_movement' then select to_jsonb(t)||jsonb_build_object('amount',abs(t.cost_amount),'currency',t.cost_currency) into source from public.stock_movements t where id=p_id for update;
 when 'bank_transaction' then select to_jsonb(t) into source from public.bank_transactions t where id=p_id for update;
 else raise exception 'Unsupported economic source';
 end case;
 if source is null then raise exception 'Economic source unavailable' using errcode='42501'; end if;
 if not ( (p_kind='contract' and exists(select 1 from public.contract_parties where contract_id=p_id and role_code in ('seller','buyer') and erp_private.has_permission(internal_company_id,'finance','read'))) or erp_private.has_permission((source->>'company_id')::uuid,'finance','read')
   or (p_kind='invoice' and (erp_private.has_permission((source->>'issuer_company_id')::uuid,'finance','read') or erp_private.has_permission((source->>'recipient_company_id')::uuid,'finance','read')))
   or (p_kind='payment' and (erp_private.has_permission((source->>'payer_company_id')::uuid,'finance','read') or erp_private.has_permission((source->>'payee_company_id')::uuid,'finance','read')))) then raise exception 'Economic source unavailable' using errcode='42501'; end if;
 return source;
end $$;
revoke all on function erp_private.economic_source(text,uuid) from public,anon;
grant execute on function erp_private.economic_source(text,uuid) to authenticated;

create or replace function erp_private.reporting_snapshot_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare s jsonb; r public.exchange_rates; original numeric; source_currency text;
begin
 if tg_op<>'INSERT' then raise exception 'Reporting inputs are immutable; retain the original snapshot'; end if;
 if not erp_private.has_permission(new.company_id,'finance','write') then raise exception 'Reporting company access denied' using errcode='42501'; end if;
 new.source_kind=case when new.invoice_id is not null then 'invoice' when new.payment_id is not null then 'payment' when new.expense_id is not null then 'expense' when new.commission_id is not null then 'commission' when new.contract_id is not null then 'contract' when new.stock_movement_id is not null then 'stock_movement' else 'bank_transaction' end;
 new.source_id=coalesce(new.invoice_id,new.payment_id,new.expense_id,new.commission_id,new.bank_transaction_id,new.contract_id,new.stock_movement_id);
 s=erp_private.economic_source(new.source_kind,new.source_id);
 if new.company_id is distinct from (s->>'company_id')::uuid
   and (new.source_kind='invoice' and new.company_id in ((s->>'issuer_company_id')::uuid,(s->>'recipient_company_id')::uuid)) is not true
   and (new.source_kind='contract' and exists(select 1 from public.contract_parties where contract_id=new.source_id and internal_company_id=new.company_id and role_code in ('seller','buyer'))) is not true
   and (new.source_kind='payment' and new.company_id in ((s->>'payer_company_id')::uuid,(s->>'payee_company_id')::uuid)) is not true then
   raise exception 'Company is not an economic party' using errcode='42501';
 end if;
 if (case new.source_kind when 'invoice' then s->>'status' in ('Issued','Partially Paid','Paid','Overdue')
   when 'payment' then s->>'status'='Paid' when 'expense' then s->>'status'='Posted'
   when 'contract' then s->>'status' in ('Active','Closed') and (s->>'parties_reviewed')::boolean and s->>'deleted_at' is null
   when 'stock_movement' then (s->>'ledger_posted')::boolean and s->>'cost_unit_amount' is not null
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
create or replace function public.economics_capture_reporting_input(p_input jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare saved uuid;
begin
 insert into public.financial_reporting_snapshots(company_id,invoice_id,payment_id,expense_id,commission_id,bank_transaction_id,contract_id,stock_movement_id,reporting_currency,reporting_date,exchange_rate_id)
 values((p_input->>'company_id')::uuid,(p_input->>'invoice_id')::uuid,(p_input->>'payment_id')::uuid,(p_input->>'expense_id')::uuid,(p_input->>'commission_id')::uuid,(p_input->>'bank_transaction_id')::uuid,(p_input->>'contract_id')::uuid,(p_input->>'stock_movement_id')::uuid,p_input->>'reporting_currency',(p_input->>'reporting_date')::date,(p_input->>'exchange_rate_id')::uuid)
 returning id into saved; return saved;
end $$;

create table public.sale_realizations (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete restrict,
 invoice_item_id uuid not null references public.invoice_items(id) on delete restrict,
 stock_movement_id uuid not null references public.stock_movements(id) on delete restrict,
 contract_product_id uuid not null references public.contract_products(id) on delete restrict,
 business_case_id uuid not null references public.business_cases(id) on delete restrict,
 quantity numeric not null,
 unit text not null,
 recognition_date date not null,
 created_at timestamptz not null default now(),
 created_by uuid not null references auth.users(id) on delete restrict
);
create index on public.sale_realizations(invoice_item_id);
create index on public.sale_realizations(stock_movement_id);
create index on public.sale_realizations(business_case_id,company_id);
create table public.intercompany_inventory_links (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete restrict,
 receipt_movement_id uuid not null unique references public.stock_movements(id) on delete restrict,
 seller_realization_id uuid not null references public.sale_realizations(id) on delete restrict,
 quantity numeric not null,
 created_at timestamptz not null default now(),
 created_by uuid not null references auth.users(id) on delete restrict
);
create index on public.intercompany_inventory_links(seller_realization_id);
do $$ declare t text; begin
 foreach t in array array['sale_realizations','intercompany_inventory_links'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('create policy member_read on public.%I for select to authenticated using(erp_private.has_permission(company_id,''finance'',''read''))',t);
  execute format('create policy member_insert on public.%I for insert to authenticated with check(erp_private.has_permission(company_id,''finance'',''write''))',t);
  execute format('create policy immutable_update on public.%I for update to authenticated using(false) with check(false)',t);
  execute format('create policy immutable_delete on public.%I for delete to authenticated using(false)',t);
 end loop;
end $$;

create function erp_private.sale_realization_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare line public.invoice_items; inv public.invoices; movement public.stock_movements; cp public.contract_products; used numeric;
begin
 if tg_op<>'INSERT' then raise exception 'Sale realizations are immutable'; end if;
 if not erp_private.has_permission(new.company_id,'finance','write') then raise exception 'Sale recognition access denied' using errcode='42501'; end if;
 if new.quantity is null or new.quantity<=0 or new.quantity::text in ('NaN','Infinity','-Infinity') then raise exception 'Positive finite realization quantity required'; end if;
 select * into line from public.invoice_items where id=new.invoice_item_id;
 select * into inv from public.invoices where id=line.invoice_id for update;
 select * into line from public.invoice_items where id=new.invoice_item_id for update;
 select * into movement from public.stock_movements where id=new.stock_movement_id for update;
 select * into cp from public.contract_products where id=new.contract_product_id for update;
 if inv.id is null or inv.issuer_company_id is distinct from new.company_id or movement.company_id is distinct from new.company_id then raise exception 'Invoice issuer and release must belong to recognition company' using errcode='42501'; end if;
 if inv.status not in ('Issued','Partially Paid','Paid','Overdue') or inv.status is null then raise exception 'Only issued sales may be recognized'; end if;
 if movement.quantity>=0 or movement.movement_type<>'outbound' or not movement.ledger_posted then raise exception 'Recognition requires an actual outbound release, not adjustment or transfer'; end if;
 if cp.id is null or cp.contract_id is distinct from inv.contract_id or movement.contract_id is distinct from inv.contract_id or
   line.product_id is null or line.product_id is distinct from movement.product_id or cp.product_id is distinct from movement.product_id or
   cp.unit is distinct from movement.unit or inv.business_case_id is null or movement.business_case_id is distinct from inv.business_case_id then
   raise exception 'Invoice, release and explicit legal product line must agree on Deal, Contract, Product and unit';
 end if;
 select coalesce(sum(quantity),0) into used from public.sale_realizations where invoice_item_id=line.id;
 if used+new.quantity>line.quantity then raise exception 'Realization exceeds invoice line quantity'; end if;
 select coalesce(sum(quantity),0) into used from public.sale_realizations where stock_movement_id=movement.id;
 if used+new.quantity>-movement.quantity then raise exception 'Realization exceeds physically released quantity'; end if;
 new.unit:=movement.unit; new.business_case_id:=inv.business_case_id;
 new.created_by:=auth.uid(); new.created_at:=now(); return new;
end $$;
create trigger sale_realization_guard before insert or update or delete on public.sale_realizations for each row execute function erp_private.sale_realization_guard();

create function erp_private.inventory_link_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare receipt public.stock_movements; realization public.sale_realizations; release public.stock_movements; inv public.invoices; prior record; used numeric; sale_price numeric;
begin
 if tg_op<>'INSERT' then raise exception 'Intercompany inventory lineage is immutable'; end if;
 select * into realization from public.sale_realizations where id=new.seller_realization_id for update;
 select * into receipt from public.stock_movements where id=new.receipt_movement_id for update;
 select * into release from public.stock_movements where id=realization.stock_movement_id;
 select i.* into inv from public.invoices i join public.invoice_items l on l.invoice_id=i.id where l.id=realization.invoice_item_id for share of i;
 select unit_price into sale_price from public.invoice_items where id=realization.invoice_item_id;
 if not erp_private.has_permission(new.company_id,'finance','write') or not erp_private.has_permission(realization.company_id,'finance','write') then raise exception 'Both companies must authorize intercompany stock lineage' using errcode='42501'; end if;
 if receipt.id is null or realization.id is null or receipt.company_id is distinct from new.company_id or inv.recipient_company_id is distinct from new.company_id or inv.issuer_company_id is distinct from realization.company_id or new.company_id=realization.company_id then raise exception 'Internal invoice legal parties must match both stock owners'; end if;
 if inv.status not in ('Issued','Partially Paid','Paid','Overdue') or inv.status is null then raise exception 'Cancelled or draft internal sale cannot establish acquisition lineage'; end if;
 if receipt.quantity<=0 or receipt.movement_type<>'inbound' or receipt.cost_unit_amount is null or receipt.contract_id is distinct from inv.contract_id or receipt.business_case_id is distinct from realization.business_case_id or receipt.product_id is distinct from release.product_id or receipt.unit is distinct from release.unit then raise exception 'Receipt must retain the internal sale Product, unit, Contract and Deal with its own known acquisition basis'; end if;
 if receipt.cost_currency is distinct from inv.currency or receipt.cost_unit_amount is distinct from sale_price then raise exception 'Buyer acquisition basis must match the explicit internal invoice line price and currency'; end if;
 perform pg_advisory_xact_lock(hashtextextended(receipt.company_id::text||receipt.warehouse_id::text||receipt.product_id::text||btrim(receipt.lot_number),0));
 -- Strict chronological ancestry prevents cycles, including later A→B→A legs.
 if receipt.created_at<=release.created_at then raise exception 'Intercompany receipt must follow its seller release'; end if;
 new.quantity:=receipt.quantity;
 select coalesce(sum(quantity),0) into used from public.intercompany_inventory_links where seller_realization_id=realization.id;
 if used+new.quantity>realization.quantity then raise exception 'Receipt lineage exceeds the realized internal sale quantity'; end if;
 -- Same-price receiving lots still cannot mix different upstream acquisition lots.
 for prior in select s.* from public.intercompany_inventory_links x join public.stock_movements r on r.id=x.receipt_movement_id join public.sale_realizations z on z.id=x.seller_realization_id join public.stock_movements s on s.id=z.stock_movement_id
 where r.company_id=receipt.company_id and r.warehouse_id=receipt.warehouse_id and r.product_id=receipt.product_id and btrim(r.lot_number)=btrim(receipt.lot_number) loop
   if prior.company_id is distinct from release.company_id or prior.warehouse_id is distinct from release.warehouse_id or prior.product_id is distinct from release.product_id or btrim(prior.lot_number) is distinct from btrim(release.lot_number) then raise exception 'Distinct upstream acquisition lots require distinct receiving lots'; end if;
 end loop;
 new.created_by:=auth.uid(); new.created_at:=now(); return new;
end $$;
create trigger inventory_link_guard before insert or update or delete on public.intercompany_inventory_links for each row execute function erp_private.inventory_link_guard();

create function erp_private.recognition_source_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare target_contract uuid;
begin
 if tg_table_name='contracts' then target_contract:=old.id; else target_contract:=old.contract_id; end if;
 if exists(select 1 from public.financial_reporting_snapshots where source_kind='contract' and source_id=target_contract)
 or exists(select 1 from public.sale_realizations r join public.contract_products p on p.id=r.contract_product_id where p.contract_id=target_contract) then
  if tg_op='DELETE' then raise exception 'Recognized or captured Contract history must be retained'; end if;
  if (to_jsonb(new)-array['status','deleted_at','updated_at']) is distinct from (to_jsonb(old)-array['status','deleted_at','updated_at']) then raise exception 'Captured Contract economic values are immutable'; end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger zz_recognition_source_guard before update or delete on public.contracts for each row execute function erp_private.recognition_source_guard();
create trigger zz_recognition_source_guard before update or delete on public.contract_products for each row execute function erp_private.recognition_source_guard();
create trigger zz_recognition_source_guard before update or delete on public.contract_parties for each row execute function erp_private.recognition_source_guard();

create function public.profitability_realize_sale(p_input jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare saved uuid;
begin
 insert into public.sale_realizations(company_id,invoice_item_id,stock_movement_id,contract_product_id,quantity,recognition_date)
 values((p_input->>'company_id')::uuid,(p_input->>'invoice_item_id')::uuid,(p_input->>'stock_movement_id')::uuid,(p_input->>'contract_product_id')::uuid,(p_input->>'quantity')::numeric,(p_input->>'recognition_date')::date) returning id into saved;
 return saved;
end $$;
create function public.profitability_link_receipt(p_input jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare saved uuid;
begin
 insert into public.intercompany_inventory_links(company_id,receipt_movement_id,seller_realization_id)
 values((p_input->>'company_id')::uuid,(p_input->>'receipt_movement_id')::uuid,(p_input->>'seller_realization_id')::uuid) returning id into saved;
 return saved;
end $$;
revoke all on function public.profitability_realize_sale(jsonb),public.profitability_link_receipt(jsonb) from public,anon;
grant execute on function public.profitability_realize_sale(jsonb),public.profitability_link_receipt(jsonb) to authenticated;
revoke all on function erp_private.sale_realization_guard(),erp_private.inventory_link_guard(),erp_private.recognition_source_guard() from public,anon,authenticated;

create function erp_private.profitability_stock_origin(p_movement_id uuid,p_seen uuid[] default '{}'::uuid[]) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare m public.stock_movements; receipt public.stock_movements; lot public.inventory_lots; linked record; candidate jsonb; origin jsonb; receipts integer:=0; paths jsonb:='[]'::jsonb;
begin
 if p_movement_id=any(p_seen) or cardinality(p_seen)>=64 then return null; end if;
 select * into m from public.stock_movements where id=p_movement_id;
 if m.id is null or m.cost_unit_amount is null or not erp_private.has_permission(m.company_id,'finance','read') then return null; end if;
 select l.* into lot from public.inventory_lots l join public.inventory i on i.id=l.inventory_id where i.company_id=m.company_id and i.warehouse_id=m.warehouse_id and i.product_id=m.product_id and l.lot_number=btrim(m.lot_number);
 if lot.id is null or lot.opening_quantity<>0 then return null; end if;
 for receipt in select * from public.stock_movements where company_id=m.company_id and warehouse_id=m.warehouse_id and product_id=m.product_id and btrim(lot_number)=btrim(m.lot_number) and quantity>0 and created_at<=m.created_at order by created_at,id loop
  receipts:=receipts+1;
  if receipt.movement_type='transfer' and receipt.cost_transfer_source_id is not null then
   candidate:=erp_private.profitability_stock_origin(receipt.cost_transfer_source_id,p_seen||p_movement_id);
  elsif receipt.movement_type='inbound' and receipt.cost_unit_amount is not null then
   if exists(select 1 from public.contracts where id=receipt.contract_id and status in ('Active','Closed') and parties_reviewed and deleted_at is null)
    and exists(select 1 from public.contract_parties where contract_id=receipt.contract_id and role_code='seller' and counterparty_id is not null)
    and exists(select 1 from public.contract_parties where contract_id=receipt.contract_id and role_code='buyer' and internal_company_id=receipt.company_id) then
    candidate:=jsonb_build_object('movement_id',receipt.id,'company_id',receipt.company_id,'unit_cost',receipt.cost_unit_amount::text,'currency',receipt.cost_currency,'source_ids',jsonb_build_array(receipt.id));
   else
    select r.stock_movement_id,i.status into linked from public.intercompany_inventory_links x join public.sale_realizations r on r.id=x.seller_realization_id join public.invoice_items it on it.id=r.invoice_item_id join public.invoices i on i.id=it.invoice_id where x.receipt_movement_id=receipt.id;
    if not found or linked.status not in ('Issued','Partially Paid','Paid','Overdue') then return null; end if;
    candidate:=erp_private.profitability_stock_origin(linked.stock_movement_id,p_seen||p_movement_id);
   end if;
  else return null;
  end if;
  if candidate is null then return null; end if;
  if origin is not null and origin->>'movement_id' is distinct from candidate->>'movement_id' then return null; end if;
  origin:=candidate; paths:=paths||coalesce(candidate->'source_ids','[]'::jsonb)||jsonb_build_array(receipt.id);
 end loop;
 if receipts=0 then return null; end if;
 return origin||jsonb_build_object('source_ids',paths||jsonb_build_array(p_movement_id));
end $$;
revoke all on function erp_private.profitability_stock_origin(uuid,uuid[]) from public,anon;
grant execute on function erp_private.profitability_stock_origin(uuid,uuid[]) to authenticated;

-- Own acquisition direction is public to its own company even when upstream
-- seller acquisition costs are private. Do not infer direction from hidden costs.
create function erp_private.profitability_stock_acquisition(p_movement_id uuid,p_seen uuid[] default '{}'::uuid[]) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare m public.stock_movements; receipt public.stock_movements; seller public.contract_parties; candidate jsonb; result jsonb;
begin
 if p_movement_id=any(p_seen) or cardinality(p_seen)>=64 then return null; end if;
 select * into m from public.stock_movements where id=p_movement_id;
 if m.id is null or not erp_private.has_permission(m.company_id,'finance','read') then return null; end if;
 for receipt in select * from public.stock_movements where company_id=m.company_id and warehouse_id=m.warehouse_id and product_id=m.product_id and btrim(lot_number)=btrim(m.lot_number) and quantity>0 and created_at<=m.created_at loop
  if receipt.movement_type='transfer' and receipt.cost_transfer_source_id is not null then candidate:=erp_private.profitability_stock_acquisition(receipt.cost_transfer_source_id,p_seen||p_movement_id);
  elsif receipt.movement_type='inbound' then
   select * into seller from public.contract_parties where contract_id=receipt.contract_id and role_code='seller';
   if seller.id is null or not exists(select 1 from public.contract_parties where contract_id=receipt.contract_id and role_code='buyer' and internal_company_id=m.company_id) then return null; end if;
   candidate:=jsonb_build_object('internal',seller.internal_company_id is not null,'seller_company_id',seller.internal_company_id);
  else return null;
  end if;
  if candidate is null or (result is not null and candidate is distinct from result) then return null; end if;
  result:=candidate;
 end loop;
 return result;
end $$;
revoke all on function erp_private.profitability_stock_acquisition(uuid,uuid[]) from public,anon;
grant execute on function erp_private.profitability_stock_acquisition(uuid,uuid[]) to authenticated;

create function public.profitability_inventory_inputs(p_deal_id uuid,p_company_ids uuid[],p_reporting_currency text) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare r record; origin jsonb; acquisition jsonb; local_fx public.financial_reporting_snapshots; origin_fx public.financial_reporting_snapshots; local_rate numeric; origin_rate numeric; result jsonb:='[]'::jsonb;
begin
 if cardinality(p_company_ids)=0 or p_company_ids is null then raise exception 'Explicit reporting companies required'; end if;
 if exists(select 1 from unnest(p_company_ids) c where not erp_private.has_permission(c,'finance','read')) then raise exception 'Every reporting company must authorize financial reads' using errcode='42501'; end if;
 if not exists(select 1 from public.currencies where code=p_reporting_currency) then raise exception 'Registered reporting currency required'; end if;
 for r in select z.*,m.product_id,m.contract_id,m.cost_unit_amount,m.cost_currency,m.id movement_id,it.invoice_id,i.status invoice_status from public.sale_realizations z join public.stock_movements m on m.id=z.stock_movement_id join public.invoice_items it on it.id=z.invoice_item_id join public.invoices i on i.id=it.invoice_id where z.business_case_id=p_deal_id and z.company_id=any(p_company_ids) loop
  origin:=erp_private.profitability_stock_origin(r.movement_id);
  acquisition:=erp_private.profitability_stock_acquisition(r.movement_id);
  select * into local_fx from public.financial_reporting_snapshots where company_id=r.company_id and source_kind='stock_movement' and source_id=r.movement_id and reporting_currency=p_reporting_currency;
  select * into origin_fx from public.financial_reporting_snapshots where company_id=(origin->>'company_id')::uuid and source_kind='stock_movement' and source_id=(origin->>'movement_id')::uuid and reporting_currency=p_reporting_currency;
  local_rate:=case when r.cost_currency=p_reporting_currency then 1 else local_fx.fx_rate end;
  origin_rate:=case when origin->>'currency'=p_reporting_currency then 1 else origin_fx.fx_rate end;
  result:=result||jsonb_build_array(jsonb_build_object(
   'realization_id',r.id,'company_id',r.company_id,'invoice_id',r.invoice_id,'invoice_item_id',r.invoice_item_id,
   'contract_id',r.contract_id,'contract_product_id',r.contract_product_id,'product_id',r.product_id,
   'stock_movement_id',r.movement_id,'quantity',r.quantity::text,'unit',r.unit,'recognition_date',r.recognition_date,
   'invoice_status',r.invoice_status,'local_unit_cost',r.cost_unit_amount::text,'local_currency',r.cost_currency,
   'local_fx_rate',local_rate::text,'local_snapshot_id',local_fx.id,
   'ultimate_unit_cost',origin->>'unit_cost','ultimate_currency',origin->>'currency',
   'ultimate_fx_rate',origin_rate::text,'ultimate_snapshot_id',origin_fx.id,
   'ultimate_source_movement_id',origin->>'movement_id','ultimate_company_id',origin->>'company_id',
   'acquisition_internal',(acquisition->>'internal')::boolean,'acquisition_seller_company_id',acquisition->>'seller_company_id',
   'lineage_gap',origin is null,'fx_gap',local_rate is null or (origin is not null and origin_rate is null),
   'source_ids',coalesce(origin->'source_ids',jsonb_build_array(r.movement_id))));
 end loop;
 return result;
end $$;
revoke all on function public.profitability_inventory_inputs(uuid,uuid[],text) from public,anon;
grant execute on function public.profitability_inventory_inputs(uuid,uuid[],text) to authenticated;
notify pgrst,'reload schema';
