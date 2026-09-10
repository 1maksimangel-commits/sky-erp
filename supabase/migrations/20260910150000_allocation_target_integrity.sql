-- Preserve allocation identity, without freezing unrelated business descriptions.
-- Row locks serialize target validation against concurrent relationship edits.
create function erp_private.lock_allocation_targets() returns trigger
language plpgsql security definer set search_path='' as $$
declare shipment public.shipments; cp public.contract_products; dp public.deal_products;
 ids uuid[]; target uuid;
begin
 if not erp_private.has_permission(new.company_id,'finance','write') then raise exception 'Allocation company access denied' using errcode='42501'; end if;
 if new.shipment_id is not null then select * into shipment from public.shipments where id=new.shipment_id for share; end if;
 if new.contract_product_id is not null then select * into cp from public.contract_products where id=new.contract_product_id for share; end if;
 if new.deal_product_id is not null then select * into dp from public.deal_products where id=new.deal_product_id for share; end if;
 ids=array[new.contract_id,shipment.contract_id,cp.contract_id];
 for target in select distinct value from unnest(ids) value where value is not null order by value loop
   perform 1 from public.contracts where id=target for share;
 end loop;
 -- Parent references are stable after the preceding locks.
 for target in select distinct value from (
   select unnest(array[new.business_case_id,shipment.business_case_id,dp.business_case_id]) value
   union select business_case_id from public.contracts where id=any(ids)
 ) refs where value is not null order by value loop
   perform 1 from public.business_cases where id=target for share;
 end loop;
 for target in select distinct value from unnest(array[new.product_id,cp.product_id,dp.product_id]) value where value is not null order by value loop
   perform 1 from public.products where id=target for share;
 end loop;
 return new;
end $$;
create trigger a_lock_allocation_targets before insert on public.cost_allocations
for each row execute function erp_private.lock_allocation_targets();

create function erp_private.allocated_target_identity_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare referenced boolean; fields text[]; field text;
begin
 case tg_table_name
 when 'shipments' then
   select exists(select 1 from public.cost_allocations where shipment_id=old.id) into referenced;
   fields=array['company_id','contract_id','business_case_id'];
 when 'contracts' then
   select exists(select 1 from public.cost_allocations where contract_id=old.id) into referenced;
   fields=array['company_id','business_case_id','deal_id'];
 when 'contract_products' then
   select exists(select 1 from public.cost_allocations where contract_product_id=old.id) into referenced;
   fields=array['company_id','contract_id','product_id'];
 when 'deal_products' then
   select exists(select 1 from public.cost_allocations where deal_product_id=old.id) into referenced;
   fields=array['company_id','business_case_id','product_id'];
 when 'business_cases' then
   select exists(select 1 from public.cost_allocations where business_case_id=old.id) into referenced;
   fields=array['company_id'];
 when 'products' then
   select exists(select 1 from public.cost_allocations where product_id=old.id) into referenced;
   fields=array['company_id'];
 end case;
 if referenced then
   foreach field in array fields loop
     if to_jsonb(new)->field is distinct from to_jsonb(old)->field then
       raise exception 'Allocated target relationship is immutable: %.%',tg_table_name,field using errcode='23514';
     end if;
   end loop;
 end if;
 return new;
end $$;
do $$ declare name text; begin
 foreach name in array array['shipments','contracts','contract_products','deal_products','business_cases','products'] loop
   execute format('create trigger zz_allocated_target_identity before update on public.%I for each row execute function erp_private.allocated_target_identity_guard()',name);
 end loop;
end $$;
revoke all on function erp_private.lock_allocation_targets(),erp_private.allocated_target_identity_guard() from public,anon;
notify pgrst,'reload schema';
