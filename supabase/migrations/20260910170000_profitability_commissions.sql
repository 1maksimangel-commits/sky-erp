-- One commission accrual model, explicit revisions and canonical payment allocation.
alter table public.deal_commission_links
 add column managed_accrual boolean not null default false,
 add column family_id uuid references public.deal_commission_links(id) on delete restrict,
 add column supersedes_id uuid references public.deal_commission_links(id) on delete restrict,
 add column revision integer not null default 0,
 add column beneficiary_name text,
 add column beneficiary_type text,
 add column beneficiary_snapshot jsonb,
 add column calculation_base text,
 add column calculation_snapshot jsonb,
 add column calculated_amount numeric,
 add column override_amount numeric,
 add column override_reason text,
 add column notes text;
create unique index commission_revision_unique on public.deal_commission_links(family_id,revision) where managed_accrual;
alter table public.payment_allocations alter column invoice_id drop not null;
alter table public.payment_allocations add column commission_id uuid references public.deal_commission_links(id) on delete restrict;
alter table public.payment_allocations add constraint payment_allocation_one_obligation check(num_nonnulls(invoice_id,commission_id)=1);
create index on public.payment_allocations(commission_id);

create function erp_private.commission_live_base(c public.deal_commission_links) returns numeric
language plpgsql stable security invoker set search_path='' as $$
declare result numeric;
begin
 if c.calculation_base='contract_amount' then
   select amount into result from public.contracts where id=c.contract_id and currency=c.currency;
 elsif c.calculation_base='contract_net_weight' then
   select case when count(*)>0 and bool_and(net_weight is not null and lower(unit) in ('kg','mt')) then
     sum(net_weight*case when lower(unit)='mt' then 1000 else 1 end)/case when c.basis='per_mt' then 1000 else 1 end end
   into result from public.contract_products where contract_id=c.contract_id;
 elsif c.calculation_base='deal_net_weight' then
   select case when count(*)>0 and bool_and(net_weight is not null and lower(unit) in ('kg','mt')) then
     sum(net_weight*case when lower(unit)='mt' then 1000 else 1 end)/case when c.basis='per_mt' then 1000 else 1 end end
   into result from public.deal_products where business_case_id=c.business_case_id and company_id=c.company_id;
 end if;
 return result;
end $$;

create function erp_private.commission_accrual_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare prior public.deal_commission_links; cp public.counterparties; used numeric; current_base numeric;
begin
 if tg_op='DELETE' then
   if old.managed_accrual then raise exception 'Commission history must be retained'; end if; return old;
 end if;
 if tg_op='UPDATE' and old.managed_accrual and not new.managed_accrual then raise exception 'Commission accrual mode cannot be cleared'; end if;
 if not new.managed_accrual then
   if new.family_id is not null or new.supersedes_id is not null or new.revision<>0 or new.beneficiary_snapshot is not null or new.calculation_snapshot is not null or new.override_amount is not null then raise exception 'Revision and override metadata require canonical commission accrual'; end if;
   return new;
 end if;
 if not erp_private.has_permission(new.company_id,'finance','write') then raise exception 'Commission company access denied' using errcode='42501'; end if;
 if tg_op='UPDATE' and old.status<>'Draft' then
   -- No recalculation of posted snapshots, even after source records change.
   if (to_jsonb(new)-array['expected_amount','calculated_amount']) is distinct from (to_jsonb(old)-array['expected_amount','calculated_amount']) then raise exception 'Posted commission is immutable; create a revision'; end if;
   new.expected_amount=old.expected_amount; new.calculated_amount=old.calculated_amount; return new;
 end if;
 if new.status not in ('Draft','Posted') or new.status is null then raise exception 'Commission requires Draft or Posted state'; end if;
 if coalesce(btrim(new.beneficiary_name),'')='' or new.beneficiary_type not in ('agent','broker','intermediary','external_counterparty','company','person','other') or new.beneficiary_type is null then raise exception 'Explicit beneficiary name and type required'; end if;
 if new.calculation_base not in ('quantity','net_weight','gross_weight','sale_revenue','purchase_value','gross_profit','manual','contract_amount','contract_net_weight','deal_net_weight') or new.calculation_base is null then raise exception 'Explicit calculation base required'; end if;
 if new.calculation_base in ('sale_revenue','purchase_value','gross_profit') and new.basis<>'percentage' or new.calculation_base in ('quantity','net_weight','gross_weight') and new.basis not in ('per_mt','per_kg') then raise exception 'Captured calculation base does not match commission method'; end if;
 if new.calculation_base='contract_amount' and new.basis<>'percentage' or new.calculation_base in ('contract_net_weight','deal_net_weight') and new.basis not in ('per_mt','per_kg') then raise exception 'Calculation base does not match commission method'; end if;
 if new.beneficiary_id is not null then
   select * into cp from public.counterparties where id=new.beneficiary_id;
   if cp.id is null or cp.company_id is distinct from new.company_id then raise exception 'Beneficiary company mismatch' using errcode='42501'; end if;
 end if;
 if tg_op='INSERT' then
   if new.supersedes_id is null then new.family_id=null; new.revision=1;
   else
     if new.status<>'Posted' then raise exception 'Commission revisions must be posted atomically'; end if;
     select * into prior from public.deal_commission_links where id=new.supersedes_id for update;
     if prior.id is null or prior.status<>'Posted' or prior.company_id is distinct from new.company_id or prior.business_case_id is distinct from new.business_case_id or prior.currency is distinct from new.currency then raise exception 'Revision must retain posted commission Company, Deal and currency'; end if;
     new.family_id=coalesce(prior.family_id,prior.id);
     perform 1 from public.deal_commission_links where id=new.family_id for update;
     if exists(select 1 from public.deal_commission_links where family_id=new.family_id and revision>prior.revision) then raise exception 'Revise the latest commission version'; end if;
     new.revision=greatest(prior.revision,1)+1;
     if exists(select 1 from public.payment_allocations a join public.payments p on p.id=a.payment_id where a.commission_id=new.family_id and p.status<>'Cancelled')
       and new.beneficiary_id is distinct from prior.beneficiary_id then raise exception 'Settled commission beneficiary cannot change'; end if;
   end if;
 elsif (new.family_id,new.supersedes_id,new.revision,new.company_id,new.business_case_id,new.currency) is distinct from (old.family_id,old.supersedes_id,old.revision,old.company_id,old.business_case_id,old.currency) then raise exception 'Commission family identity is immutable';
 end if;
 current_base=erp_private.commission_live_base(new);
 if new.calculation_base in ('contract_amount','contract_net_weight','deal_net_weight') then
   if current_base is null then raise exception 'Selected canonical calculation base is unavailable or has mixed/unknown units'; end if;
   if new.calculation_base='contract_amount' then new.base_amount=current_base; else new.base_quantity=current_base; end if;
 end if;
 new.calculated_amount=round(case new.basis when 'fixed' then new.rate when 'percentage' then new.rate*new.base_amount/100 else new.rate*new.base_quantity end,2);
 if new.override_amount is not null and (new.override_amount<0 or new.override_amount::text in ('NaN','Infinity','-Infinity') or new.override_amount<>round(new.override_amount,2) or coalesce(btrim(new.override_reason),'')='') then raise exception 'Override requires finite cent amount and reason'; end if;
 new.expected_amount=round(coalesce(new.override_amount,new.calculated_amount),2);
 select coalesce(sum(a.amount),0) into used from public.payment_allocations a join public.payments p on p.id=a.payment_id where a.commission_id=new.family_id and p.status<>'Cancelled';
 if new.expected_amount<used then raise exception 'Revised accrued amount cannot be below allocated payments'; end if;
 new.beneficiary_snapshot=jsonb_build_object('counterparty_id',new.beneficiary_id,'name',new.beneficiary_name,'type',new.beneficiary_type,'legal_name',cp.legal_name);
 new.calculation_snapshot=jsonb_build_object('basis',new.basis,'rate',new.rate::text,'base_quantity',new.base_quantity::text,'base_amount',new.base_amount::text,'calculation_base',new.calculation_base,'canonical_base',current_base::text,'calculated_amount',new.calculated_amount::text,'override_amount',new.override_amount::text,'override_reason',new.override_reason,'accrued_amount',new.expected_amount::text);
 return new;
end $$;
create trigger b_commission_accrual before insert or update or delete on public.deal_commission_links for each row execute function erp_private.commission_accrual_guard();

-- Keep the existing invoice validator and its total-payment cap intact.
alter function erp_private.finance_allocation_guard() rename to finance_invoice_allocation_guard;
create function erp_private.finance_allocation_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare p public.payments; c public.deal_commission_links; root_id uuid; used numeric;
begin
 if tg_op='UPDATE' and (new.payment_id,new.commission_id,new.invoice_id) is distinct from (old.payment_id,old.commission_id,old.invoice_id) then raise exception 'Allocation endpoints are immutable'; end if;
 if new.invoice_id is not null then return new; end if;
 if new.commission_id is null then raise exception 'Allocation obligation required'; end if;
 select * into p from public.payments where id=new.payment_id for update;
 select coalesce(family_id,id) into root_id from public.deal_commission_links where id=new.commission_id;
 perform 1 from public.deal_commission_links where id=root_id for update;
 select * into c from public.deal_commission_links where coalesce(family_id,id)=root_id and status='Posted' order by revision desc limit 1;
 if p.id is null or c.id is null or p.company_id is distinct from c.company_id or p.currency is distinct from c.currency or p.status not in ('Pending','Paid') or p.status is null then raise exception 'Accessible same-company/currency active payment and posted commission required'; end if;
 if c.beneficiary_id is null then raise exception 'Link a canonical beneficiary Counterparty before settlement'; end if;
 if p.payer_company_id is distinct from c.company_id or p.payee_counterparty_id is distinct from c.beneficiary_id then raise exception 'Payment payer/beneficiary do not match commission'; end if;
 if new.company_id is not null and new.company_id is distinct from c.company_id then raise exception 'Commission allocation company mismatch'; end if;
 if new.amount is null or new.amount<=0 or new.amount<>round(new.amount,2) or new.amount::text in ('NaN','Infinity','-Infinity') then raise exception 'Positive exact allocation amount required'; end if;
 select coalesce(sum(amount),0) into used from public.payment_allocations where payment_id=p.id and id<>new.id;
 if used+new.amount>p.amount then raise exception 'Allocation exceeds original payment amount'; end if;
 select coalesce(sum(a.amount),0) into used from public.payment_allocations a join public.payments pp on pp.id=a.payment_id where a.commission_id=root_id and a.id<>new.id and pp.status<>'Cancelled';
 if used+new.amount>c.expected_amount then raise exception 'Allocation exceeds commission accrued amount'; end if;
 new.commission_id=root_id; new.company_id=c.company_id; return new;
end $$;
-- Conditional triggers preserve the invoice path while enabling one allocation table.
create or replace trigger a_finance_allocation before insert or update on public.payment_allocations for each row when(new.invoice_id is not null) execute function erp_private.finance_invoice_allocation_guard();
create trigger a_finance_commission_allocation before insert or update on public.payment_allocations for each row execute function erp_private.finance_allocation_guard();
alter policy member_read on public.payment_allocations using(
 (invoice_id is not null and erp_private.finance_can_read_invoice(invoice_id)) or
 (commission_id is not null and erp_private.has_permission(company_id,'finance','read')));

create function public.profitability_save_commission(p_id uuid,p_previous uuid,p_input jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare saved uuid; row public.deal_commission_links; allocation jsonb; state text;
begin
 if not erp_private.has_permission((p_input->>'company_id')::uuid,'finance','write') then raise exception 'Commission company access denied' using errcode='42501'; end if;
 state=coalesce(p_input->>'status','Draft');
 row=jsonb_populate_record(null::public.deal_commission_links,p_input);
 if row.calculation_base in ('contract_amount','contract_net_weight','deal_net_weight') then
   if row.calculation_base='contract_amount' then p_input=p_input||jsonb_build_object('base_amount',erp_private.commission_live_base(row));
   else p_input=p_input||jsonb_build_object('base_quantity',erp_private.commission_live_base(row)); end if;
 end if;
 if p_previous is not null and state<>'Posted' then raise exception 'Review a revision before posting it atomically'; end if;
 if state='Posted' and (p_input->>'confirmed')::boolean is distinct from true then raise exception 'Review and confirm commission before posting'; end if;
 if p_id is not null and p_previous is not null then raise exception 'Choose edit or revision'; end if;
 if p_id is not null then select * into row from public.deal_commission_links where id=p_id for update; if row.id is null or not row.managed_accrual or row.status<>'Draft' then raise exception 'Only a Draft commission may be edited'; end if; end if;
 saved=coalesce(p_id,gen_random_uuid());
 insert into public.deal_commission_links(id,managed_accrual,supersedes_id,company_id,business_case_id,contract_id,beneficiary_id,beneficiary_name,beneficiary_type,label,basis,rate,base_quantity,base_amount,currency,calculation_base,override_amount,override_reason,status,notes)
 values(saved,true,p_previous,(p_input->>'company_id')::uuid,(p_input->>'business_case_id')::uuid,(p_input->>'contract_id')::uuid,(p_input->>'beneficiary_id')::uuid,p_input->>'beneficiary_name',p_input->>'beneficiary_type',p_input->>'label',p_input->>'basis',(p_input->>'rate')::numeric,(p_input->>'base_quantity')::numeric,(p_input->>'base_amount')::numeric,p_input->>'currency',p_input->>'calculation_base',(p_input->>'override_amount')::numeric,p_input->>'override_reason',state,p_input->>'notes')
 on conflict(id) do update set contract_id=excluded.contract_id,beneficiary_id=excluded.beneficiary_id,beneficiary_name=excluded.beneficiary_name,beneficiary_type=excluded.beneficiary_type,label=excluded.label,basis=excluded.basis,rate=excluded.rate,base_quantity=excluded.base_quantity,base_amount=excluded.base_amount,calculation_base=excluded.calculation_base,override_amount=excluded.override_amount,override_reason=excluded.override_reason,status=excluded.status,notes=excluded.notes;
 select * into row from public.deal_commission_links where id=saved;
 if state='Posted' and row.expected_amount>0 then
   allocation=p_input->'allocation';
   if allocation->>'scope' not in ('deal','contract','contract_product','deal_product') or allocation->>'scope' is null then raise exception 'Choose explicit commission allocation scope'; end if;
   if allocation->>'scope'='contract' and row.contract_id is null or allocation->>'scope'='contract_product' and allocation->>'contract_product_id' is null or allocation->>'scope'='deal_product' and allocation->>'deal_product_id' is null then raise exception 'Selected allocation target required'; end if;
   perform public.economics_allocate_cost(jsonb_build_object('company_id',row.company_id,'commission_id',saved,'business_case_id',row.business_case_id,'contract_id',row.contract_id,
     'contract_product_id',case when allocation->>'scope'='contract_product' then allocation->>'contract_product_id' end,
     'deal_product_id',case when allocation->>'scope'='deal_product' then allocation->>'deal_product_id' end,
     'basis','direct','amount',row.expected_amount::text,'currency',row.currency,'notes','Explicitly confirmed commission allocation'));
 end if;
 return saved;
end $$;

create function public.profitability_preview_commission(p_input jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare c public.deal_commission_links; base numeric; calculated numeric;
begin
 c=jsonb_populate_record(null::public.deal_commission_links,p_input);
 if not erp_private.has_permission(c.company_id,'finance','read') then raise exception 'Commission company access denied' using errcode='42501'; end if;
 if c.basis not in ('fixed','per_mt','per_kg','percentage') or c.basis is null or c.rate is null or c.rate<0 or c.rate::text in ('NaN','Infinity','-Infinity') then raise exception 'Explicit valid commission method and rate required'; end if;
 if c.calculation_base in ('contract_amount','contract_net_weight','deal_net_weight') then
   base=erp_private.commission_live_base(c);
   if base is null then raise exception 'Canonical base unavailable or mixed units/currency'; end if;
   if c.calculation_base='contract_amount' then c.base_amount=base; else c.base_quantity=base; end if;
 end if;
 if c.basis='percentage' then base=c.base_amount; elsif c.basis in ('per_mt','per_kg') then base=c.base_quantity; end if;
 if c.basis<>'fixed' and (base is null or base<0 or base::text in ('NaN','Infinity','-Infinity')) then raise exception 'Explicit finite calculation base required'; end if;
 calculated=round(case c.basis when 'fixed' then c.rate when 'percentage' then c.rate*c.base_amount/100 else c.rate*c.base_quantity end,2);
 if c.override_amount is not null and (c.override_amount<0 or c.override_amount::text in ('NaN','Infinity','-Infinity') or coalesce(btrim(c.override_reason),'')='') then raise exception 'Override requires finite amount and reason'; end if;
 return jsonb_build_object('calculated_amount',calculated::text,'final_amount',round(coalesce(c.override_amount,calculated),2)::text,'base_value',base::text);
end $$;

create function public.profitability_commission_inputs(p_deal_id uuid,p_company_ids uuid[]) returns jsonb
language sql stable security invoker set search_path='' as $$
 with latest as (
 select distinct on(coalesce(family_id,id)) * from public.deal_commission_links
 where business_case_id=p_deal_id and company_id=any(p_company_ids) and status in ('Draft','Posted')
 order by coalesce(family_id,id),revision desc
 ), rows as (
 select c.*,coalesce((select sum(a.amount) from public.payment_allocations a join public.payments p on p.id=a.payment_id where a.commission_id=coalesce(c.family_id,c.id) and p.status='Paid'),0) settled
 from latest c
 ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'family_id',coalesce(family_id,id),'revision',revision,'company_id',company_id,'business_case_id',business_case_id,'contract_id',contract_id,
 'beneficiary_id',beneficiary_id,'beneficiary_name',coalesce(beneficiary_name,label),'beneficiary_type',coalesce(beneficiary_type,'other'),'label',label,'notes',notes,'basis',basis,'rate',rate::text,
 'base_quantity',base_quantity::text,'base_amount',base_amount::text,'calculation_base',calculation_base,'calculation_snapshot',calculation_snapshot,
 'calculated_amount',round(coalesce(calculated_amount,expected_amount),2)::text,'accrued_amount',round(expected_amount,2)::text,'expected_amount',round(expected_amount,2)::text,'paid_amount',round(settled,2)::text,'outstanding_amount',round(greatest(expected_amount-settled,0),2)::text,'currency',currency,
 'status',status,'is_current',true,'is_agent',coalesce(beneficiary_type in ('agent','broker','intermediary'),false),'root_id',coalesce(family_id,id),
 'basis_changed',case when calculation_base in ('contract_amount','contract_net_weight','deal_net_weight') then erp_private.commission_live_base((select t from public.deal_commission_links t where t.id=rows.id)) is distinct from (calculation_snapshot->>'canonical_base')::numeric else false end)), '[]'::jsonb) from rows;
$$;
revoke all on function erp_private.commission_live_base(public.deal_commission_links),erp_private.commission_accrual_guard(),erp_private.finance_allocation_guard() from public,anon;
grant execute on function erp_private.commission_live_base(public.deal_commission_links) to authenticated;
revoke all on function public.profitability_save_commission(uuid,uuid,jsonb),public.profitability_commission_inputs(uuid,uuid[]),public.profitability_preview_commission(jsonb) from public,anon;
grant execute on function public.profitability_save_commission(uuid,uuid,jsonb),public.profitability_commission_inputs(uuid,uuid[]),public.profitability_preview_commission(jsonb) to authenticated;
notify pgrst,'reload schema';
