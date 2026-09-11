-- Read-only, permission-complete source boundary for the canonical exact engine.
create function erp_private.profitability_scope(p_deal_id uuid,p_company_id uuid) returns uuid[]
language plpgsql stable security definer set search_path='' as $$
declare owners uuid[]; selected uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not exists(select 1 from public.business_cases where id=p_deal_id) then raise exception 'Deal economics unavailable' using errcode='42501'; end if;
 select array_agg(distinct company_id) filter(where company_id is not null) into owners from (
   select company_id from public.business_cases where id=p_deal_id
   union all select c.company_id from public.contracts c where c.business_case_id=p_deal_id
   union all select cp.internal_company_id from public.contract_parties cp join public.contracts c on c.id=cp.contract_id where c.business_case_id=p_deal_id and cp.role_code in ('seller','buyer')
   union all select company_id from public.expenses where business_case_id=p_deal_id
   union all select company_id from public.deal_commission_links where business_case_id=p_deal_id
   union all select company_id from public.cost_allocations where business_case_id=p_deal_id
   union all select company_id from public.stock_movements where business_case_id=p_deal_id
   union all select company_id from public.payments where business_case_id=p_deal_id
 ) x;
 if p_company_id is not null then
   if not coalesce(p_company_id=any(owners),false) or not erp_private.has_permission(p_company_id,'finance','read') then raise exception 'Company economics unavailable' using errcode='42501'; end if;
   return array[p_company_id];
 end if;
 if coalesce(cardinality(owners),0)=0 then raise exception 'Explicit internal company context required'; end if;
 foreach selected in array owners loop
   if not erp_private.has_permission(selected,'finance','read') then raise exception 'Consolidation requires finance access to every participating company' using errcode='42501'; end if;
 end loop;
 return owners;
end $$;
revoke all on function erp_private.profitability_scope(uuid,uuid) from public,anon;
grant execute on function erp_private.profitability_scope(uuid,uuid) to authenticated;

create function public.profitability_inputs(p_deal_id uuid,p_company_id uuid,p_reporting_currency text) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare owners uuid[]; contract_ids uuid[]; invoice_ids uuid[]; payment_ids uuid[]; result jsonb;
begin
 owners=erp_private.profitability_scope(p_deal_id,p_company_id);
 if not exists(select 1 from public.currencies where code=p_reporting_currency) then raise exception 'Unknown reporting currency'; end if;
 select coalesce(array_agg(c.id),'{}'::uuid[]) into contract_ids from public.contracts c where c.business_case_id=p_deal_id and (c.company_id=any(owners) or exists(select 1 from public.contract_parties cp where cp.contract_id=c.id and cp.role_code in ('seller','buyer') and cp.internal_company_id=any(owners)));
 select coalesce(array_agg(i.id),'{}'::uuid[]) into invoice_ids from public.invoices i where i.business_case_id=p_deal_id and (i.company_id=any(owners) or i.issuer_company_id=any(owners) or i.recipient_company_id=any(owners));
 select coalesce(array_agg(p.id),'{}'::uuid[]) into payment_ids from public.payments p where (p.business_case_id=p_deal_id or exists(select 1 from public.payment_allocations a where a.payment_id=p.id and (a.invoice_id=any(invoice_ids) or exists(select 1 from public.deal_commission_links c where c.id=a.commission_id and c.business_case_id=p_deal_id)))) and (p.company_id=any(owners) or p.payer_company_id=any(owners) or p.payee_company_id=any(owners));
 result=jsonb_build_object('deal_id',p_deal_id,'company_id',p_company_id,'reporting_currency',p_reporting_currency,
 'companies',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]') from public.companies where id=any(owners)),
 'contracts',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'company_id',c.company_id,'contract_number',c.contract_number,'currency',c.currency,'status',c.status,'parties_reviewed',c.parties_reviewed,
   'seller_company_id',(select cp.internal_company_id from public.contract_parties cp where cp.contract_id=c.id and cp.role_code='seller'),
   'buyer_company_id',(select cp.internal_company_id from public.contract_parties cp where cp.contract_id=c.id and cp.role_code='buyer'),'party_alias_conflict',exists(select 1 from public.contract_parties cp join public.counterparties cc on cc.id=cp.counterparty_id where cp.contract_id=c.id and cp.role_code in ('seller','buyer') and cc.source_company_id is not null))),'[]') from public.contracts c where c.id=any(contract_ids)),
 'contract_lines',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'contract_id',l.contract_id,'product_id',l.product_id,'description',l.description,'quantity',l.quantity::text,'unit_price',l.unit_price::text,'agreed_amount',l.agreed_amount::text,'currency',l.currency,'unit',l.unit)),'[]') from public.contract_products l where l.contract_id=any(contract_ids)),
 'invoices',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'company_id',i.company_id,'contract_id',i.contract_id,'invoice_number',i.invoice_number,'currency',i.currency,'status',i.status,'issuer_company_id',i.issuer_company_id,'recipient_company_id',i.recipient_company_id,'amount',i.amount::text,'subtotal',i.subtotal::text,'outstanding',i.outstanding::text)),'[]') from public.invoices i where i.id=any(invoice_ids)),
 'invoice_lines',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'invoice_id',l.invoice_id,'product_id',l.product_id,'description',l.description,'quantity',l.quantity::text,'unit_price',l.unit_price::text,'unit',null)),'[]') from public.invoice_items l where l.invoice_id=any(invoice_ids)),
 'payments',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'company_id',p.company_id,'business_case_id',p.business_case_id,'payer_company_id',p.payer_company_id,'payee_company_id',p.payee_company_id,'amount',p.amount::text,'currency',p.currency,'status',p.status,'party_alias_conflict',exists(select 1 from public.counterparties cc where cc.id in (p.payer_counterparty_id,p.payee_counterparty_id) and cc.source_company_id is not null))),'[]') from public.payments p where p.id=any(payment_ids)),
 'payment_allocations',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'payment_id',a.payment_id,'invoice_id',a.invoice_id,'commission_id',a.commission_id,'amount',a.amount::text)),'[]') from public.payment_allocations a where a.payment_id=any(payment_ids)),
 'expenses',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'company_id',e.company_id,'business_case_id',e.business_case_id,'contract_id',e.contract_id,'amount',e.amount::text,'currency',e.currency,'status',e.status,'category',coalesce(ec.code,'other'),'description',e.description,'internal_beneficiary',coalesce((select cc.source_company_id is not null from public.counterparties cc where cc.id=e.supplier_id),false))),'[]') from public.expenses e left join public.expense_categories ec on ec.id=e.category_id where e.company_id=any(owners) and (e.business_case_id=p_deal_id or exists(select 1 from public.cost_allocations a where a.expense_id=e.id and a.business_case_id=p_deal_id))),
 'allocations',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'company_id',a.company_id,'business_case_id',a.business_case_id,'expense_id',a.expense_id,'commission_id',a.commission_id,'product_id',coalesce(a.product_id,cp.product_id,dp.product_id),'contract_product_id',a.contract_product_id,'deal_product_id',a.deal_product_id,'amount',a.amount::text,'currency',a.currency)),'[]') from public.cost_allocations a left join public.contract_products cp on cp.id=a.contract_product_id left join public.deal_products dp on dp.id=a.deal_product_id where a.company_id=any(owners) and (a.business_case_id=p_deal_id or a.expense_id in (select e.id from public.expenses e where e.business_case_id=p_deal_id) or a.commission_id in (select c.id from public.deal_commission_links c where c.business_case_id=p_deal_id))),
 'snapshots',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'company_id',s.company_id,'source_kind',s.source_kind,'source_id',s.source_id,'reporting_currency',s.reporting_currency,'original_currency',s.original_currency,'original_amount',s.original_amount::text,'fx_rate',s.fx_rate::text,'fx_rate_date',s.fx_rate_date,'reporting_date',s.reporting_date)),'[]') from public.financial_reporting_snapshots s where s.company_id=any(owners) and s.reporting_currency=p_reporting_currency),
 'products',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name)),'[]') from public.products p where p.id in (select l.product_id from public.invoice_items l where l.invoice_id=any(invoice_ids)) or p.id in (select l.product_id from public.contract_products l where l.contract_id=any(contract_ids))),
 'deal_lines',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'product_id',l.product_id)),'[]') from public.deal_products l where l.business_case_id=p_deal_id),
 'realizations',public.profitability_inventory_inputs(p_deal_id,owners,p_reporting_currency),
 'commissions',public.profitability_commission_inputs(p_deal_id,owners),
 'internal_commission_ids',(select coalesce(jsonb_agg(c.id),'[]') from public.deal_commission_links c join public.counterparties cc on cc.id=c.beneficiary_id where c.business_case_id=p_deal_id and c.company_id=any(owners) and cc.source_company_id is not null));
 return result;
end $$;
revoke all on function public.profitability_inputs(uuid,uuid,text) from public,anon;
grant execute on function public.profitability_inputs(uuid,uuid,text) to authenticated;
notify pgrst,'reload schema';
