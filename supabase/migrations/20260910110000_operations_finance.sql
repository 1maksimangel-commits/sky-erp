-- Phase 6: explicit financial parties and atomic obligation/payment ledgers.
-- Existing records and historical migrations are preserved. No FX conversion or profit.
alter table public.invoices
  add column issuer_company_id uuid references public.companies(id) on delete restrict,
  add column issuer_counterparty_id uuid references public.counterparties(id) on delete restrict,
  add column recipient_company_id uuid references public.companies(id) on delete restrict,
  add column recipient_counterparty_id uuid references public.counterparties(id) on delete restrict,
  add column party_snapshot jsonb,
  add column generated_document_id uuid references public.generated_documents(id) on delete restrict;
alter table public.payments
  add column payer_company_id uuid references public.companies(id) on delete restrict,
  add column payer_counterparty_id uuid references public.counterparties(id) on delete restrict,
  add column payee_company_id uuid references public.companies(id) on delete restrict,
  add column payee_counterparty_id uuid references public.counterparties(id) on delete restrict;
alter table public.expenses add column shipment_id uuid references public.shipments(id) on delete restrict;
alter table public.expenses add constraint expenses_finite_amount check(amount::text not in ('NaN','Infinity','-Infinity')) not valid;
alter table public.invoice_items add constraint invoice_items_finite_values check(quantity::text not in ('NaN','Infinity','-Infinity') and unit_price::text not in ('NaN','Infinity','-Infinity') and tax_rate::text not in ('NaN','Infinity','-Infinity') and line_total::text not in ('NaN','Infinity','-Infinity')) not valid;
alter table public.bank_accounts add constraint bank_accounts_finite_values check(opening_balance::text not in ('NaN','Infinity','-Infinity') and current_balance::text not in ('NaN','Infinity','-Infinity')) not valid;
alter table public.exchange_rates add constraint exchange_rates_finite_values check(rate::text not in ('NaN','Infinity','-Infinity')) not valid;
alter table public.bank_accounts
  add column counterparty_id uuid references public.counterparties(id) on delete restrict,
  add column account_holder text,
  add column correspondent_details text;
alter table public.deal_commission_links
  add column contract_id uuid references public.contracts(id) on delete restrict,
  add column basis text,
  add column rate numeric,
  add column base_quantity numeric,
  add column base_amount numeric,
  add column status text not null default 'Draft';
comment on column public.deal_commission_links.expected_amount is 'Canonical commission amount, calculated from explicit basis/rate using PostgreSQL numeric when basis is supplied.';
comment on column public.invoices.invoice_type is 'Legacy display category only; receivable/payable perspective derives from explicit issuer and recipient.';
comment on column public.payments.amount is 'Original transaction amount in payments.currency. Never replaced by an FX conversion.';

create function erp_private.finance_can_read_invoice(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.invoices i where i.id=target and (
 erp_private.has_permission(i.company_id,'finance','read') or
 erp_private.has_permission(i.issuer_company_id,'finance','read') or
 erp_private.has_permission(i.recipient_company_id,'finance','read')));
$$;
revoke all on function erp_private.finance_can_read_invoice(uuid) from public,anon;
grant execute on function erp_private.finance_can_read_invoice(uuid) to authenticated;
alter policy member_read on public.invoices using(erp_private.finance_can_read_invoice(id));
alter policy member_read on public.invoice_items using(erp_private.finance_can_read_invoice(invoice_id));
alter policy member_read on public.payments using(erp_private.has_permission(company_id,'finance','read') or erp_private.has_permission(payer_company_id,'finance','read') or erp_private.has_permission(payee_company_id,'finance','read'));
-- Allocation visibility follows its obligation; bank details remain owner-private.
alter policy member_read on public.payment_allocations using(erp_private.finance_can_read_invoice(invoice_id));

-- Narrow replacement for finance ownership only. Cross-workspace references are
-- allowed solely to explicit legal parties or the selected canonical Contract's Deal.
create function erp_private.finance_ownership() returns trigger
language plpgsql security definer set search_path='' as $$
declare j jsonb:=to_jsonb(new); prior jsonb; owner_id uuid; parent_id uuid;
 c public.contracts; i public.invoices; sh public.shipments; fk record; target uuid; target_owner uuid;
begin
 if tg_op='UPDATE' then prior=to_jsonb(old); end if;
 owner_id=nullif(j->>'company_id','')::uuid;
 if tg_table_name in ('invoices','expenses') and j->>'shipment_id' is not null then
   select * into sh from public.shipments where id=(j->>'shipment_id')::uuid;
   if sh.id is null then raise exception 'Shipment not found'; end if;
   if j->>'contract_id' is not null and (j->>'contract_id')::uuid is distinct from sh.contract_id then raise exception 'Shipment and Contract mismatch'; end if;
   if j->>'business_case_id' is not null and (j->>'business_case_id')::uuid is distinct from sh.business_case_id then raise exception 'Shipment and Deal mismatch'; end if;
   j=j||jsonb_build_object('contract_id',sh.contract_id,'business_case_id',sh.business_case_id);
 end if;
 if tg_table_name='payments' and j->>'invoice_id' is not null then
   select * into i from public.invoices where id=(j->>'invoice_id')::uuid;
   owner_id=coalesce(owner_id,i.company_id);
   if owner_id is distinct from i.company_id then raise exception 'Payment company must match obligation owner'; end if;
   if j->>'contract_id' is not null and (j->>'contract_id')::uuid is distinct from i.contract_id then raise exception 'Payment Contract mismatch'; end if;
   if j->>'business_case_id' is not null and (j->>'business_case_id')::uuid is distinct from i.business_case_id then raise exception 'Payment Deal mismatch'; end if;
   j=j||jsonb_build_object('contract_id',i.contract_id,'business_case_id',i.business_case_id,
     'payer_company_id',i.recipient_company_id,'payer_counterparty_id',i.recipient_counterparty_id,
     'payee_company_id',i.issuer_company_id,'payee_counterparty_id',i.issuer_counterparty_id);
 end if;
 if j->>'contract_id' is not null then
   select * into c from public.contracts where id=(j->>'contract_id')::uuid;
   owner_id=coalesce(owner_id,c.company_id);
   if owner_id is distinct from c.company_id and not exists(select 1 from public.contract_parties cp where cp.contract_id=c.id and cp.role_code in ('seller','buyer') and cp.internal_company_id=owner_id) then raise exception 'Company is not a Contract party'; end if;
   if j->>'business_case_id' is not null and (j->>'business_case_id')::uuid is distinct from c.business_case_id then raise exception 'Contract and Deal mismatch'; end if;
   j=j||jsonb_build_object('business_case_id',c.business_case_id);
 end if;
 owner_id=coalesce(owner_id,public.active_company_id());
 if auth.uid() is not null and not erp_private.has_permission(owner_id,'finance','write') then raise exception 'Finance company access denied' using errcode='42501'; end if;
 if tg_op='UPDATE' and owner_id is distinct from (prior->>'company_id')::uuid then raise exception 'Financial ownership is immutable' using errcode='42501'; end if;
 j=j||jsonb_build_object('company_id',owner_id);
 if tg_table_name='expenses' and j->>'bank_account_id' is not null and not exists(select 1 from public.bank_accounts b where b.id=(j->>'bank_account_id')::uuid and b.company_id=owner_id and b.currency=j->>'currency' and b.is_active and b.counterparty_id is null) then raise exception 'Expense bank company and original currency must match'; end if;
 for fk in select a.attname as col,t.relname as tbl from pg_catalog.pg_constraint con
 join pg_catalog.pg_attribute a on a.attrelid=con.conrelid and a.attnum=con.conkey[1]
 join pg_catalog.pg_class t on t.oid=con.confrelid
 join pg_catalog.pg_namespace ns on ns.oid=t.relnamespace
 where con.conrelid=tg_relid and con.contype='f' and array_length(con.conkey,1)=1 and ns.nspname='public' and a.attname<>'company_id'
 and (t.relname='companies' or exists(select 1 from pg_catalog.pg_attribute x where x.attrelid=t.oid and x.attname='company_id' and not x.attisdropped)) loop
   target=nullif(j->>fk.col,'')::uuid; if target is null then continue; end if;
   if fk.tbl='companies' then target_owner=target; else execute format('select company_id from public.%I where id=$1',fk.tbl) into target_owner using target; end if;
   if target_owner=owner_id then continue; end if;
   if fk.col='contract_id' and target=c.id then continue; end if;
   if fk.col='business_case_id' and target=c.business_case_id then continue; end if;
   if fk.col in ('issuer_company_id','issuer_counterparty_id','recipient_company_id','recipient_counterparty_id','payer_company_id','payer_counterparty_id','payee_company_id','payee_counterparty_id')
     and exists(select 1 from public.contract_parties cp where cp.contract_id=c.id and cp.role_code in ('seller','buyer') and (cp.internal_company_id=target or cp.counterparty_id=target)) then continue; end if;
   if target_owner is null and owner_id is null and erp_private.is_admin() then continue; end if;
   raise exception 'Cross-company financial relationship rejected: %.%',tg_table_name,fk.col using errcode='42501';
 end loop;
 new=jsonb_populate_record(new,j); return new;
end $$;
create or replace trigger enforce_company_ownership before insert or update on public.invoices for each row execute function erp_private.finance_ownership();
create or replace trigger enforce_company_ownership before insert or update on public.payments for each row execute function erp_private.finance_ownership();
create or replace trigger enforce_company_ownership before insert or update on public.expenses for each row execute function erp_private.finance_ownership();
create or replace trigger enforce_company_ownership before insert or update on public.deal_commission_links for each row execute function erp_private.finance_ownership();

create function erp_private.finance_invoice_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare seller public.contract_parties; buyer public.contract_parties; paid numeric; sub numeric; tax numeric;
begin
 if tg_op='DELETE' then
   if old.party_snapshot is not null then raise exception 'Cancel financial obligations instead of deleting history'; end if;
   return old;
 end if;
 if tg_op='INSERT' then
   select * into seller from public.contract_parties where contract_id=new.contract_id and role_code='seller';
   select * into buyer from public.contract_parties where contract_id=new.contract_id and role_code='buyer';
   if seller.id is not null and buyer.id is not null then
     if num_nonnulls(new.issuer_company_id,new.issuer_counterparty_id)=0 then new.issuer_company_id=seller.internal_company_id; new.issuer_counterparty_id=seller.counterparty_id; end if;
     if num_nonnulls(new.recipient_company_id,new.recipient_counterparty_id)=0 then new.recipient_company_id=buyer.internal_company_id; new.recipient_counterparty_id=buyer.counterparty_id; end if;
     if new.issuer_company_id is distinct from seller.internal_company_id or new.issuer_counterparty_id is distinct from seller.counterparty_id or new.recipient_company_id is distinct from buyer.internal_company_id or new.recipient_counterparty_id is distinct from buyer.counterparty_id then raise exception 'Invoice legal parties must match the explicitly selected Contract'; end if;
     new.party_snapshot=jsonb_build_object('issuer',seller.snapshot,'recipient',buyer.snapshot);
   end if;
 end if;
 if tg_op='UPDATE' and old.party_snapshot is not null and new.party_snapshot is null then raise exception 'Legal invoice snapshot cannot be cleared'; end if;
 if tg_op='INSERT' and auth.uid() is not null and new.party_snapshot is null then raise exception 'Explicit reviewed issuer and recipient are required for new invoices'; end if;
 if auth.uid() is not null and new.company_id is not null and not erp_private.has_permission(new.company_id,'finance','write') then raise exception 'Invoice company access denied' using errcode='42501'; end if;
 if tg_op='UPDATE' and new.company_id is distinct from old.company_id then raise exception 'Invoice ownership is immutable' using errcode='42501'; end if;
 if new.party_snapshot is not null then
   if new.company_id is null then select company_id into new.company_id from public.contracts where id=new.contract_id; end if;
   perform pg_advisory_xact_lock(hashtextextended(new.company_id::text||':'||new.invoice_number,0));
   if exists(select 1 from public.invoices where company_id=new.company_id and invoice_number=new.invoice_number and id<>new.id) then raise exception 'Invoice number already exists for this company'; end if;
   if num_nonnulls(new.issuer_company_id,new.issuer_counterparty_id)<>1 or num_nonnulls(new.recipient_company_id,new.recipient_counterparty_id)<>1 then raise exception 'Explicit issuer and recipient required'; end if;
   if new.company_id is distinct from new.issuer_company_id and new.company_id is distinct from new.recipient_company_id then raise exception 'Invoice company must be an internal issuer or recipient'; end if;
   if new.amount<0 or new.amount::text in ('NaN','Infinity','-Infinity') or not exists(select 1 from public.currencies where code=new.currency) then raise exception 'Valid original amount and currency required'; end if;
   if new.status not in ('Draft','Issued','Partially Paid','Paid','Overdue','Cancelled') then raise exception 'Invalid Invoice status'; end if;
   if tg_op='UPDATE' and old.party_snapshot is not null then
     if new.issuer_company_id is distinct from old.issuer_company_id or new.issuer_counterparty_id is distinct from old.issuer_counterparty_id or new.recipient_company_id is distinct from old.recipient_company_id or new.recipient_counterparty_id is distinct from old.recipient_counterparty_id or new.party_snapshot is distinct from old.party_snapshot or new.contract_id is distinct from old.contract_id then raise exception 'Financial legal parties and source are immutable'; end if;
     if old.status<>'Draft' and (to_jsonb(new)-array['status','paid_amount','outstanding','updated_at']) is distinct from (to_jsonb(old)-array['status','paid_amount','outstanding','updated_at']) then raise exception 'Issued obligation values are immutable'; end if;
     if old.status='Cancelled' and new.status<>'Cancelled' then raise exception 'Cancelled obligation cannot reopen'; end if;
     if old.status<>'Draft' and new.status='Draft' then raise exception 'Issued obligation cannot return to Draft'; end if;
     if new.status='Cancelled' and old.paid_amount>0 then raise exception 'Cannot cancel a paid obligation'; end if;
   end if;
   select coalesce(sum(round(quantity*unit_price,2)),0),coalesce(sum(round(quantity*unit_price*tax_rate/100,2)),0) into sub,tax from public.invoice_items where invoice_id=new.id;
   new.subtotal=sub; new.tax_amount=tax; new.amount=sub+tax;
   select coalesce(sum(x.amount),0) into paid from (
     select a.amount from public.payment_allocations a join public.payments p on p.id=a.payment_id where a.invoice_id=new.id and p.status='Paid'
     union all select p.amount from public.payments p where p.invoice_id=new.id and p.status='Paid' and p.payer_company_id is null and p.payee_company_id is null and not exists(select 1 from public.payment_allocations a where a.payment_id=p.id)
   ) x;
   new.paid_amount=paid; new.outstanding=case when new.status='Cancelled' then 0 else greatest(new.amount-paid,0) end;
   new.status=case when new.status='Cancelled' then 'Cancelled' when paid>0 and paid>=new.amount then 'Paid' when paid>0 then 'Partially Paid' when new.status='Draft' then 'Draft' when new.due_date<current_date then 'Overdue' else 'Issued' end;
 end if;
 if new.generated_document_id is not null and not exists(select 1 from public.generated_documents g where g.id=new.generated_document_id and g.contract_id=new.contract_id and g.document_type='invoice') then raise exception 'Generated invoice document must refer to the same Contract'; end if;
 return new;
end $$;
create trigger a_finance_invoice_guard before insert or update or delete on public.invoices for each row execute function erp_private.finance_invoice_guard();

create function erp_private.finance_item_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare i public.invoices;
begin
 if tg_op='DELETE' then select * into i from public.invoices where id=old.invoice_id;
 else select * into i from public.invoices where id=new.invoice_id; end if;
 if auth.uid() is not null and not erp_private.has_permission(i.company_id,'finance','write') then raise exception 'Invoice line access denied' using errcode='42501'; end if;
 if tg_op<>'DELETE' and new.company_id is not null and new.company_id is distinct from i.company_id then raise exception 'Invoice line company mismatch' using errcode='42501'; end if;
 if tg_op='UPDATE' and to_jsonb(new)=to_jsonb(old) then return new; end if;
 if i.party_snapshot is not null and i.status<>'Draft' then raise exception 'Issued invoice lines are immutable'; end if;
 if exists(select 1 from public.payment_allocations a join public.payments p on p.id=a.payment_id where a.invoice_id=i.id and p.status<>'Cancelled') then raise exception 'Allocated invoice lines are immutable; remove allocations before correcting a Draft'; end if;
 if tg_op='DELETE' then return old; end if;
 if tg_op='UPDATE' and new.invoice_id<>old.invoice_id then raise exception 'Invoice line cannot move between obligations'; end if;
 if new.product_id is not null and not exists(select 1 from public.products p where p.id=new.product_id and p.company_id=i.company_id)
 and not exists(select 1 from public.contract_products cp where cp.contract_id=i.contract_id and cp.product_id=new.product_id) then raise exception 'Product does not belong to invoice company or Contract'; end if;
 new.company_id=i.company_id;
 if new.quantity<=0 or new.unit_price<0 or new.tax_rate<0 or new.tax_rate>100 then raise exception 'Invalid invoice quantities and prices'; end if;
 new.line_total=round(new.quantity*new.unit_price,2)+round(new.quantity*new.unit_price*new.tax_rate/100,2);
 return new;
end $$;
create or replace trigger enforce_company_ownership before insert or update or delete on public.invoice_items for each row execute function erp_private.finance_item_guard();

create function erp_private.finance_items_changed() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='DELETE' then update public.invoices set updated_at=now() where id=old.invoice_id; return old; end if;
 update public.invoices set updated_at=now() where id=new.invoice_id; return new;
end $$;
create trigger finance_items_changed after insert or update or delete on public.invoice_items for each row execute function erp_private.finance_items_changed();

create function public.finance_save_invoice(p_id uuid,p_invoice jsonb,p_items jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare saved uuid:=coalesce(p_id,gen_random_uuid()); item jsonb; v_subtotal numeric:=0; v_tax numeric:=0; q numeric; price numeric; tr numeric; previous public.invoices;
begin
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)=0 then raise exception 'At least one invoice line is required'; end if;
 if coalesce(btrim(p_invoice->>'invoice_number'),'')='' or coalesce(p_invoice->>'status','Draft') not in ('Draft','Issued') then raise exception 'Invoice number and Draft/Issued status required'; end if;
 if not exists(select 1 from public.contract_parties where contract_id=(p_invoice->>'contract_id')::uuid and role_code='seller') then raise exception 'Review explicit Contract parties before invoicing'; end if;
 for item in select value from jsonb_array_elements(p_items) loop
   q=(item->>'quantity')::numeric; price=(item->>'unit_price')::numeric; tr=coalesce((item->>'tax_rate')::numeric,0);
   if q is null or price is null or q<=0 or price<0 or tr<0 or tr>100 or q::text in ('NaN','Infinity','-Infinity') or price::text in ('NaN','Infinity','-Infinity') or tr::text in ('NaN','Infinity','-Infinity') or coalesce(btrim(item->>'description'),'')='' then raise exception 'Invalid invoice line'; end if;
   v_subtotal=v_subtotal+round(q*price,2); v_tax=v_tax+round(q*price*tr/100,2);
 end loop;
 if p_id is null then
   insert into public.invoices(id,invoice_number,invoice_type,contract_id,business_case_id,company_id,shipment_id,currency,issue_date,due_date,payment_terms,notes,status,subtotal,tax_amount,amount,outstanding,generated_document_id)
   values(saved,btrim(p_invoice->>'invoice_number'),coalesce(p_invoice->>'invoice_type','Sales Invoice'),(p_invoice->>'contract_id')::uuid,(p_invoice->>'business_case_id')::uuid,(p_invoice->>'company_id')::uuid,(p_invoice->>'shipment_id')::uuid,p_invoice->>'currency',(p_invoice->>'issue_date')::date,(p_invoice->>'due_date')::date,p_invoice->>'payment_terms',p_invoice->>'notes','Draft',v_subtotal,v_tax,v_subtotal+v_tax,v_subtotal+v_tax,(p_invoice->>'generated_document_id')::uuid);
 else
   select * into previous from public.invoices where id=p_id for update;
   if not found or previous.status<>'Draft' or previous.paid_amount<>0 then raise exception 'Only unpaid Draft invoices may be edited'; end if;
   if exists(select 1 from public.payment_allocations a join public.payments p on p.id=a.payment_id where a.invoice_id=saved and p.status<>'Cancelled') then raise exception 'Allocated Draft cannot be edited'; end if;
   update public.invoices set invoice_number=btrim(p_invoice->>'invoice_number'),currency=p_invoice->>'currency',issue_date=(p_invoice->>'issue_date')::date,due_date=(p_invoice->>'due_date')::date,payment_terms=p_invoice->>'payment_terms',notes=p_invoice->>'notes',subtotal=v_subtotal,tax_amount=v_tax,amount=v_subtotal+v_tax,outstanding=v_subtotal+v_tax where id=saved;
   delete from public.invoice_items where invoice_id=saved;
 end if;
 for item in select value from jsonb_array_elements(p_items) loop
   insert into public.invoice_items(invoice_id,product_id,description,quantity,unit_price,tax_rate,line_total)
   values(saved,(item->>'product_id')::uuid,item->>'description',(item->>'quantity')::numeric,(item->>'unit_price')::numeric,coalesce((item->>'tax_rate')::numeric,0),round((item->>'quantity')::numeric*(item->>'unit_price')::numeric,2)+round((item->>'quantity')::numeric*(item->>'unit_price')::numeric*coalesce((item->>'tax_rate')::numeric,0)/100,2));
 end loop;
 update public.invoices set status=coalesce(p_invoice->>'status','Draft') where id=saved;
 return saved;
end $$;
revoke all on function public.finance_save_invoice(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.finance_save_invoice(uuid,jsonb,jsonb) to authenticated;

-- Allocations reserve only a payment's original currency/amount, lock both rows,
-- and may not exceed either invoice or payment. Pending money is never settled.
create function erp_private.finance_allocation_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare p public.payments; i public.invoices; used numeric; owed numeric;
begin
 if tg_op='UPDATE' and (new.payment_id<>old.payment_id or new.invoice_id<>old.invoice_id) then raise exception 'Allocation endpoints are immutable'; end if;
 select * into p from public.payments where id=new.payment_id for update;
 select * into i from public.invoices where id=new.invoice_id for update;
 if new.company_id is not null and new.company_id is distinct from i.company_id then raise exception 'Allocation ownership mismatch' using errcode='42501'; end if;
 if p.id is null or i.id is null or p.company_id is distinct from i.company_id or p.currency is distinct from i.currency or p.status='Cancelled' or i.status='Cancelled' then raise exception 'Allocation requires accessible same-company, same-currency active records'; end if;
 if p.payer_company_id is distinct from i.recipient_company_id or p.payer_counterparty_id is distinct from i.recipient_counterparty_id or p.payee_company_id is distinct from i.issuer_company_id or p.payee_counterparty_id is distinct from i.issuer_counterparty_id then raise exception 'Allocation parties do not match'; end if;
 if new.amount<=0 or new.amount::text in ('NaN','Infinity','-Infinity') then raise exception 'Positive finite allocation required'; end if;
 select coalesce(sum(amount),0) into used from public.payment_allocations where payment_id=p.id and id<>new.id;
 if used+new.amount>p.amount then raise exception 'Allocation exceeds original payment amount'; end if;
 select coalesce(sum(a.amount),0) into used from public.payment_allocations a join public.payments pp on pp.id=a.payment_id where a.invoice_id=i.id and a.id<>new.id and pp.status<>'Cancelled';
 select coalesce(sum(pp.amount),0) into owed from public.payments pp where pp.invoice_id=i.id and pp.id<>p.id and pp.status='Paid' and pp.payer_company_id is null and pp.payee_company_id is null and not exists(select 1 from public.payment_allocations a where a.payment_id=pp.id);
 if used+owed+new.amount>i.amount then raise exception 'Allocation exceeds invoice amount'; end if;
 new.company_id=i.company_id; return new;
end $$;
create trigger a_finance_allocation before insert or update on public.payment_allocations for each row execute function erp_private.finance_allocation_guard();

create or replace function public.refresh_invoice_balances(p_invoice_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare i public.invoices; paid numeric;
begin
 select * into i from public.invoices where id=p_invoice_id for update;
 if not found then return; end if;
 select coalesce(sum(x.amount),0) into paid from (
 select a.amount from public.payment_allocations a join public.payments p on p.id=a.payment_id where a.invoice_id=i.id and p.status='Paid'
 union all select p.amount from public.payments p where p.invoice_id=i.id and p.status='Paid' and p.payer_company_id is null and p.payee_company_id is null and not exists(select 1 from public.payment_allocations a where a.payment_id=p.id)
 ) x;
 update public.invoices set paid_amount=paid,outstanding=case when status='Cancelled' then 0 else greatest(amount-paid,0) end,
 status=case when status='Cancelled' then status when paid>=amount and paid>0 then 'Paid' when paid>0 then 'Partially Paid' when status='Draft' then status when due_date<current_date then 'Overdue' else 'Issued' end,updated_at=now() where id=i.id;
end $$;

create function erp_private.finance_refresh_allocations() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op<>'INSERT' then perform public.refresh_invoice_balances(old.invoice_id); end if;
 if tg_op<>'DELETE' then perform public.refresh_invoice_balances(new.invoice_id); return new; end if;
 return old;
end $$;
create trigger finance_refresh_allocations after insert or update or delete on public.payment_allocations for each row execute function erp_private.finance_refresh_allocations();

create function erp_private.finance_payment_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='DELETE' then
   if old.payer_company_id is not null or old.payee_company_id is not null then raise exception 'Cancel payment instead of deleting its history'; end if;
   return old;
 end if;
 if tg_op='INSERT' and auth.uid() is not null and new.payer_company_id is null and new.payee_company_id is null then raise exception 'Explicit payer, payee and internal company context required'; end if;
 if tg_op='UPDATE' and (old.payer_company_id is not null or old.payee_company_id is not null) and new.payer_company_id is null and new.payee_company_id is null then raise exception 'Payment internal parties cannot be cleared'; end if;
 if new.payer_company_id is not null or new.payee_company_id is not null then
   if num_nonnulls(new.payer_company_id,new.payer_counterparty_id)<>1 or num_nonnulls(new.payee_company_id,new.payee_counterparty_id)<>1 then raise exception 'Explicit payer and payee required'; end if;
   if new.payer_company_id is not null and new.payer_company_id=new.payee_company_id or new.payer_counterparty_id is not null and new.payer_counterparty_id=new.payee_counterparty_id then raise exception 'Payment payer and payee must differ'; end if;
   if new.company_id is distinct from new.payer_company_id and new.company_id is distinct from new.payee_company_id then raise exception 'Company must be a payment party'; end if;
   if new.amount is null or new.amount<=0 or new.amount::text in ('NaN','Infinity','-Infinity') or not exists(select 1 from public.currencies where code=new.currency) then raise exception 'Valid original payment amount and currency required'; end if;
   if new.status not in ('Pending','Paid','Cancelled') then raise exception 'Invalid Payment status'; end if;
   if new.status='Paid' and exists(select 1 from public.payment_allocations a join public.invoices i on i.id=a.invoice_id where a.payment_id=new.id and i.status='Cancelled') then raise exception 'Cannot post a payment allocated to a cancelled obligation'; end if;
   if tg_op='UPDATE' and (to_jsonb(new)-'status') is distinct from (to_jsonb(old)-'status') then raise exception 'Payment originals are immutable; cancel and register a corrected payment'; end if;
   if tg_op='UPDATE' and old.status='Cancelled' and new.status<>'Cancelled' then raise exception 'Cancelled payment cannot reopen'; end if;
   if new.bank_account_id is not null and not exists(select 1 from public.bank_accounts b where b.id=new.bank_account_id and b.company_id=new.company_id and b.counterparty_id is null and b.currency=new.currency and b.is_active) then raise exception 'Bank must be an active internal account with matching company and currency'; end if;
 end if;
 return new;
end $$;
create trigger z_finance_payment_guard before insert or update or delete on public.payments for each row execute function erp_private.finance_payment_guard();

create function erp_private.finance_payment_changed() returns trigger
language plpgsql security invoker set search_path='' as $$
declare target uuid;
begin
 if tg_op<>'DELETE' then
   perform public.refresh_invoice_balances(new.invoice_id);
   for target in select invoice_id from public.payment_allocations where payment_id=new.id loop perform public.refresh_invoice_balances(target); end loop;
   if new.bank_account_id is not null then update public.bank_accounts set current_balance=public.finance_bank_balance(new.bank_account_id) where id=new.bank_account_id; end if;
   return new;
 end if;
 perform public.refresh_invoice_balances(old.invoice_id); return old;
end $$;
create trigger finance_payment_changed after insert or update or delete on public.payments for each row execute function erp_private.finance_payment_changed();

create or replace function public.finance_register_payment(p_invoice_id uuid,p_amount numeric,p_currency text,p_payment_date date default current_date,p_bank_account_id uuid default null,p_reference text default null,p_notes text default null,p_status text default 'Paid') returns uuid
language plpgsql security invoker set search_path='' as $$
declare i public.invoices; saved uuid; direction integer;
begin
 select * into i from public.invoices where id=p_invoice_id for update;
 if not found or (auth.uid() is not null and not erp_private.has_permission(i.company_id,'finance','write')) then raise exception 'Invoice access denied' using errcode='42501'; end if;
 if i.status='Cancelled' or p_amount is null or p_amount<=0 or p_amount>i.outstanding or p_amount::text in ('NaN','Infinity','-Infinity') then raise exception 'Payment must be positive and not exceed outstanding balance'; end if;
 if p_currency is distinct from i.currency then raise exception 'Payment currency must match invoice currency'; end if;
 if p_status not in ('Pending','Paid') then raise exception 'New payment must be Pending or Paid'; end if;
 if i.party_snapshot is null then raise exception 'Review explicit Invoice parties before registering payment'; end if;
 direction=case when i.company_id=i.recipient_company_id then -1 when i.company_id=i.issuer_company_id then 1 else null end;
 if direction is null then raise exception 'Company is not an invoice party'; end if;
 insert into public.payments(invoice_id,contract_id,business_case_id,company_id,bank_account_id,amount,currency,status,payment_date,reference,notes)
 values(i.id,i.contract_id,i.business_case_id,i.company_id,p_bank_account_id,p_amount,p_currency,p_status,coalesce(p_payment_date,current_date),p_reference,p_notes) returning id into saved;
 insert into public.payment_allocations(payment_id,invoice_id,amount) values(saved,i.id,p_amount);
 -- Bank balances derive from posted canonical payments; no duplicate bank row is generated.
 return saved;
end $$;

create function erp_private.finance_commission_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' and auth.uid() is not null and new.basis is null then raise exception 'Explicit commission basis required'; end if;
 if tg_op='UPDATE' and old.basis is not null and new.basis is null then raise exception 'Commission basis cannot be cleared'; end if;
 if new.basis is null then return new; end if;
 if new.basis not in ('fixed','per_mt','per_kg','percentage') or new.rate is null or new.rate<0 or new.rate::text in ('NaN','Infinity','-Infinity') then raise exception 'Valid commission basis and rate required'; end if;
 if new.basis in ('per_mt','per_kg') and (new.base_quantity is null or new.base_quantity<0 or new.base_quantity::text in ('NaN','Infinity','-Infinity')) then raise exception 'Commission quantity required'; end if;
 if new.basis='percentage' and (new.base_amount is null or new.base_amount<0 or new.base_amount::text in ('NaN','Infinity','-Infinity')) then raise exception 'Commission base amount required'; end if;
 if not exists(select 1 from public.currencies where code=new.currency) then raise exception 'Original commission currency required'; end if;
 if new.status not in ('Draft','Posted','Cancelled') then raise exception 'Invalid commission status'; end if;
 new.expected_amount=round(case new.basis when 'fixed' then new.rate when 'percentage' then new.rate*new.base_amount/100 else new.rate*new.base_quantity end,2);
 return new;
end $$;
create trigger a_finance_commission before insert or update on public.deal_commission_links for each row execute function erp_private.finance_commission_guard();

create function public.finance_bank_balance(p_bank_account_id uuid) returns numeric
language sql stable security invoker set search_path='' as $$
 select b.opening_balance+coalesce((select sum(case when p.payer_company_id=b.company_id then -p.amount when p.payee_company_id=b.company_id then p.amount else 0 end) from public.payments p where p.bank_account_id=b.id and p.status='Paid' and p.currency=b.currency),0)
 +coalesce((select sum(t.amount) from public.bank_transactions t where t.bank_account_id=b.id and t.currency=b.currency and not exists(select 1 from public.payments p where p.id=t.payment_id and (p.payer_company_id is not null or p.payee_company_id is not null))),0)
 -coalesce((select sum(e.amount) from public.expenses e where e.bank_account_id=b.id and e.currency=b.currency and e.status='Posted' and not exists(select 1 from public.bank_transactions t where t.expense_id=e.id)),0)
 from public.bank_accounts b where b.id=p_bank_account_id;
$$;
revoke all on function public.finance_bank_balance(uuid) from public,anon;
grant execute on function public.finance_bank_balance(uuid) to authenticated;
create function erp_private.finance_bank_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare has_history boolean;
begin
 if tg_op='INSERT' then new.current_balance=new.opening_balance; return new; end if;
 if new.company_id is distinct from old.company_id then raise exception 'Bank ownership is immutable' using errcode='42501'; end if;
 if new.id is distinct from old.id then raise exception 'Bank identifier is immutable'; end if;
 select exists(select 1 from public.payments where bank_account_id=old.id)
   or exists(select 1 from public.bank_transactions where bank_account_id=old.id)
   or exists(select 1 from public.expenses where bank_account_id=old.id and status='Posted') into has_history;
 if has_history and (new.currency is distinct from old.currency or new.opening_balance is distinct from old.opening_balance or new.counterparty_id is distinct from old.counterparty_id) then raise exception 'Bank currency, opening balance and economic owner are locked after transactions'; end if;
 new.current_balance=new.opening_balance+coalesce(public.finance_bank_balance(old.id)-old.opening_balance,0);
 return new;
end $$;
create trigger a_finance_bank_guard before insert or update on public.bank_accounts for each row execute function erp_private.finance_bank_guard();
revoke all on function erp_private.finance_bank_guard() from public,anon;
create function erp_private.finance_expense_changed() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op<>'INSERT' and old.bank_account_id is not null then update public.bank_accounts set current_balance=public.finance_bank_balance(old.bank_account_id) where id=old.bank_account_id; end if;
 if tg_op<>'DELETE' then
   if new.bank_account_id is not null then update public.bank_accounts set current_balance=public.finance_bank_balance(new.bank_account_id) where id=new.bank_account_id; end if;
   return new;
 end if;
 return old;
end $$;
create trigger finance_expense_changed after insert or update or delete on public.expenses for each row execute function erp_private.finance_expense_changed();
revoke all on function erp_private.finance_ownership(),erp_private.finance_invoice_guard(),erp_private.finance_item_guard(),erp_private.finance_items_changed(),erp_private.finance_allocation_guard(),erp_private.finance_refresh_allocations(),erp_private.finance_payment_guard(),erp_private.finance_payment_changed(),erp_private.finance_commission_guard(),erp_private.finance_expense_changed() from public,anon;
notify pgrst,'reload schema';
