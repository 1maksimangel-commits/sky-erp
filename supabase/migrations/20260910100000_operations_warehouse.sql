-- Phase 6: movements are the write path; balances are protected projections.
-- Existing stock is retained. No historical ownership is guessed.
alter table public.inventory drop constraint inventory_warehouse_id_product_id_key;
alter table public.inventory add constraint inventory_owner_location_product_key unique(company_id,warehouse_id,product_id);
alter table public.inventory add column opening_quantity numeric not null default 0;
alter table public.inventory add column unit text, add column product_name text, add column product_sku text;
update public.inventory i set unit=p.unit from public.products p where i.product_id=p.id and p.unit is not null;
alter table public.inventory_lots add column opening_quantity numeric not null default 0;
update public.inventory set opening_quantity=quantity where quantity<>0;
update public.inventory_lots set opening_quantity=quantity where quantity<>0;
alter table public.stock_movements add column ledger_posted boolean not null default false,
  add column production_date date, add column expiry_date date, add column unit text;
create table public.warehouse_company_access (
  warehouse_id uuid not null references public.warehouse_locations(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete restrict,
  primary key(warehouse_id,company_id)
);
alter table public.warehouse_company_access enable row level security;
revoke all on public.warehouse_company_access from public,anon;
grant select,insert,update,delete on public.warehouse_company_access to authenticated;
create policy member_read on public.warehouse_company_access for select to authenticated using(erp_private.has_permission(company_id,'warehouse','read'));
create policy admin_write on public.warehouse_company_access for all to authenticated using(erp_private.is_admin()) with check(erp_private.is_admin());
create function erp_private.warehouse_shared(location_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.warehouse_company_access where warehouse_id=location_id and erp_private.has_permission(company_id,'warehouse','read'));
$$;
revoke all on function erp_private.warehouse_shared(uuid) from public,anon;
grant execute on function erp_private.warehouse_shared(uuid) to authenticated;
alter policy member_read on public.warehouse_locations using(erp_private.has_permission(company_id,'warehouse','read') or erp_private.warehouse_shared(id));

create function erp_private.warehouse_owner() returns trigger language plpgsql security definer set search_path='' as $$
declare owner_id uuid; parent_id uuid; row_data jsonb:=to_jsonb(new);
begin
 owner_id:=nullif(row_data->>'company_id','')::uuid;
 if tg_table_name in ('inventory_lots','inventory_reservations') then
   select company_id into parent_id from public.inventory where id=(row_data->>'inventory_id')::uuid;
   if owner_id is not null and owner_id is distinct from parent_id then raise exception 'Inventory owner mismatch' using errcode='42501'; end if;
   owner_id:=parent_id;
 else owner_id:=coalesce(owner_id,public.active_company_id()); end if;
 if tg_op='UPDATE' and owner_id is distinct from old.company_id then raise exception 'Stock ownership is immutable' using errcode='42501'; end if;
 if auth.uid() is not null and not erp_private.has_permission(owner_id,'warehouse','write') then raise exception 'Warehouse owner access denied' using errcode='42501'; end if;
 if tg_table_name='inventory' then
   if not exists(select 1 from public.warehouse_locations where id=(row_data->>'warehouse_id')::uuid and company_id=owner_id)
    and not exists(select 1 from public.warehouse_company_access where warehouse_id=(row_data->>'warehouse_id')::uuid and company_id=owner_id) then raise exception 'Warehouse owner assignment required' using errcode='42501'; end if;
   if tg_op='INSERT' and not erp_private.is_admin() and not exists(select 1 from public.products where id=(row_data->>'product_id')::uuid and company_id=owner_id)
     and not exists(select 1 from public.inventory where product_id=(row_data->>'product_id')::uuid and company_id=owner_id) then raise exception 'Product ownership required for new inventory' using errcode='42501'; end if;
 end if;
 new:=jsonb_populate_record(new,row_data||jsonb_build_object('company_id',owner_id)); return new;
end $$;
create or replace trigger enforce_company_ownership before insert or update on public.inventory for each row execute function erp_private.warehouse_owner();
create or replace trigger enforce_company_ownership before insert or update on public.inventory_lots for each row execute function erp_private.warehouse_owner();
create or replace trigger enforce_company_ownership before insert or update on public.stock_movements for each row execute function erp_private.warehouse_owner();
create or replace trigger enforce_company_ownership before insert or update on public.warehouse_transfers for each row execute function erp_private.warehouse_owner();

create function erp_private.post_stock() returns trigger language plpgsql security definer set search_path='' as $$
declare inv public.inventory; lot public.inventory_lots; location_owner uuid; product_owner uuid; parent_deal uuid; source_contract uuid; source_deal uuid; product_unit text;
begin
 if not erp_private.has_permission(new.company_id,'warehouse','write') then raise exception 'Warehouse access denied' using errcode='42501'; end if;
 if new.quantity is null or new.quantity=0 or new.quantity::text in ('NaN','Infinity','-Infinity') then raise exception 'Finite non-zero quantity required'; end if;
 if new.movement_type='reservation' then raise exception 'Reservation is not a physical movement'; end if;
 if (new.movement_type='inbound' and new.quantity<0) or (new.movement_type='outbound' and new.quantity>0) then raise exception 'Movement direction and quantity disagree'; end if;
 if nullif(btrim(new.lot_number),'') is null then raise exception 'Lot number is required'; end if;
 select company_id into location_owner from public.warehouse_locations where id=new.warehouse_id;
 if not found or (location_owner is distinct from new.company_id and not exists(select 1 from public.warehouse_company_access where warehouse_id=new.warehouse_id and company_id=new.company_id)) then raise exception 'Warehouse is not assigned to stock owner' using errcode='42501'; end if;
 select company_id,unit into product_owner,product_unit from public.products where id=new.product_id;
 if not found or (product_owner is distinct from new.company_id and not erp_private.is_admin() and not exists(select 1 from public.inventory where company_id=new.company_id and product_id=new.product_id)) then raise exception 'Product access denied' using errcode='42501'; end if;
 if new.shipment_id is not null then
   select contract_id into source_contract from public.shipments where id=new.shipment_id and company_id=new.company_id;
   if not found then raise exception 'Shipment access denied' using errcode='42501'; end if;
   if new.contract_id is not null and new.contract_id is distinct from source_contract then raise exception 'Shipment and Contract mismatch'; end if;
   new.contract_id:=source_contract;
   if source_contract is not null then
     select business_case_id into source_deal from public.contracts where id=source_contract;
     if new.business_case_id is not null and new.business_case_id is distinct from source_deal then raise exception 'Shipment and Deal mismatch'; end if;
     new.business_case_id:=source_deal;
   end if;
 end if;
 if new.contract_id is not null then
   select business_case_id into parent_deal from public.contracts c where c.id=new.contract_id and (c.company_id=new.company_id or exists(select 1 from public.contract_parties p where p.contract_id=c.id and p.internal_company_id=new.company_id and p.role_code in ('seller','buyer')));
   if not found then raise exception 'Contract does not involve stock owner' using errcode='42501'; end if;
   if new.business_case_id is not null and new.business_case_id is distinct from parent_deal then raise exception 'Contract and Deal mismatch'; end if;
   new.business_case_id:=parent_deal;
 end if;
 if new.business_case_id is not null and new.contract_id is null and not exists(select 1 from public.business_cases where id=new.business_case_id and company_id=new.company_id) then raise exception 'Deal access denied' using errcode='42501'; end if;
 if new.shipment_id is not null and not exists(select 1 from public.shipments where id=new.shipment_id and company_id=new.company_id and (new.contract_id is null or contract_id=new.contract_id)) then raise exception 'Shipment relationship mismatch' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.company_id::text||new.warehouse_id::text||new.product_id::text,0));
 insert into public.inventory(company_id,warehouse_id,product_id,unit,product_name,product_sku)
 select new.company_id,new.warehouse_id,new.product_id,product_unit,p.name,p.sku from public.products p where p.id=new.product_id
 on conflict(company_id,warehouse_id,product_id) do nothing;
 select * into inv from public.inventory where company_id=new.company_id and warehouse_id=new.warehouse_id and product_id=new.product_id for update;
 if inv.unit is null then update public.inventory set unit=product_unit where id=inv.id; inv.unit:=product_unit; end if;
 new.unit:=inv.unit;
 insert into public.inventory_lots(company_id,inventory_id,lot_number) values(new.company_id,inv.id,btrim(new.lot_number)) on conflict(inventory_id,lot_number) do nothing;
 select * into lot from public.inventory_lots where inventory_id=inv.id and lot_number=btrim(new.lot_number) for update;
 if inv.available_quantity+new.quantity<0 or lot.quantity+new.quantity<0 then raise exception 'Insufficient stock; negative inventory is not allowed'; end if;
 update public.inventory set quantity=quantity+new.quantity,available_quantity=available_quantity+new.quantity,updated_at=now() where id=inv.id;
 update public.inventory_lots set quantity=quantity+new.quantity,status=case when quantity+new.quantity=0 then 'Depleted' else 'Available' end,
 production_date=coalesce(new.production_date,production_date),expiry_date=coalesce(new.expiry_date,expiry_date),updated_at=now() where id=lot.id;
 new.ledger_posted:=true; return new;
end $$;
create trigger z_post_stock before insert on public.stock_movements for each row execute function erp_private.post_stock();

create function erp_private.stock_history_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and new is not distinct from old then return new; end if;
 raise exception 'Stock movement history is immutable; post a correcting adjustment' using errcode='42501';
end $$;
create trigger stock_history_guard before update or delete on public.stock_movements for each row execute function erp_private.stock_history_guard();
create function erp_private.stock_cache_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user in ('authenticated','anon') then
  if tg_op='INSERT' and (new.quantity<>0 or new.opening_quantity<>0 or coalesce((to_jsonb(new)->>'available_quantity')::numeric,0)<>0 or coalesce((to_jsonb(new)->>'reserved_quantity')::numeric,0)<>0) then raise exception 'Use stock movements to change inventory' using errcode='42501'; end if;
  if tg_op='UPDATE' and (to_jsonb(new)->'unit' is distinct from to_jsonb(old)->'unit' or new.quantity is distinct from old.quantity or new.opening_quantity is distinct from old.opening_quantity or to_jsonb(new)->'available_quantity' is distinct from to_jsonb(old)->'available_quantity' or to_jsonb(new)->'reserved_quantity' is distinct from to_jsonb(old)->'reserved_quantity' or to_jsonb(new)->'product_id' is distinct from to_jsonb(old)->'product_id' or to_jsonb(new)->'warehouse_id' is distinct from to_jsonb(old)->'warehouse_id' or to_jsonb(new)->'inventory_id' is distinct from to_jsonb(old)->'inventory_id' or to_jsonb(new)->'lot_number' is distinct from to_jsonb(old)->'lot_number') then raise exception 'Use stock movements to change inventory' using errcode='42501'; end if;
  if tg_op='DELETE' and (old.quantity<>0 or (tg_table_name='inventory' and exists(select 1 from public.stock_movements where company_id=old.company_id and product_id=(to_jsonb(old)->>'product_id')::uuid and warehouse_id=(to_jsonb(old)->>'warehouse_id')::uuid)) or (tg_table_name='inventory_lots' and exists(select 1 from public.stock_movements m join public.inventory i on i.product_id=m.product_id and i.warehouse_id=m.warehouse_id and i.company_id=m.company_id where i.id=(to_jsonb(old)->>'inventory_id')::uuid and m.lot_number=to_jsonb(old)->>'lot_number'))) then raise exception 'Stock history must be retained' using errcode='42501'; end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger stock_cache_guard before insert or update or delete on public.inventory for each row execute function erp_private.stock_cache_guard();
create trigger stock_cache_guard before insert or update or delete on public.inventory_lots for each row execute function erp_private.stock_cache_guard();

create function erp_private.reserve_stock() returns trigger language plpgsql security definer set search_path='' as $$
declare target uuid; delta numeric:=0; inv public.inventory;
begin
 target:=case when tg_op='DELETE' then old.inventory_id else new.inventory_id end;
 if tg_op='UPDATE' and new.inventory_id is distinct from old.inventory_id then raise exception 'Reservation inventory cannot change'; end if;
 select * into inv from public.inventory where id=target for update;
 if not erp_private.has_permission(inv.company_id,'warehouse','write') then raise exception 'Reservation access denied' using errcode='42501'; end if;
 if tg_op<>'INSERT' and old.status='Active' then delta:=delta-old.quantity; end if;
 if tg_op<>'DELETE' and new.status='Active' then delta:=delta+new.quantity; end if;
 if inv.available_quantity<delta then raise exception 'Insufficient available stock to reserve'; end if;
 update public.inventory set reserved_quantity=reserved_quantity+delta,available_quantity=available_quantity-delta where id=target;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger reserve_stock after insert or update or delete on public.inventory_reservations for each row execute function erp_private.reserve_stock();

create function public.warehouse_post_movement(p_company_id uuid,p_warehouse_id uuid,p_product_id uuid,p_quantity numeric,p_lot_number text,p_movement_type text,p_reference text default null,p_contract_id uuid default null,p_shipment_id uuid default null,p_business_case_id uuid default null,p_production_date date default null,p_expiry_date date default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare result_id uuid;
begin
 insert into public.stock_movements(company_id,warehouse_id,product_id,quantity,lot_number,movement_type,reference,contract_id,shipment_id,business_case_id,production_date,expiry_date)
 values(p_company_id,p_warehouse_id,p_product_id,p_quantity,p_lot_number,p_movement_type,p_reference,p_contract_id,p_shipment_id,p_business_case_id,p_production_date,p_expiry_date) returning id into result_id;
 return result_id;
end $$;
revoke all on function public.warehouse_post_movement(uuid,uuid,uuid,numeric,text,text,text,uuid,uuid,uuid,date,date) from public,anon;
grant execute on function public.warehouse_post_movement(uuid,uuid,uuid,numeric,text,text,text,uuid,uuid,uuid,date,date) to authenticated;

create or replace function public._ensure_inventory_row(p_warehouse_id uuid,p_product_id uuid) returns public.inventory language plpgsql security invoker set search_path='' as $$
declare result_row public.inventory; owner_id uuid:=public.active_company_id();
begin
 if owner_id is null then raise exception 'Select a stock owner company'; end if;
 insert into public.inventory(company_id,warehouse_id,product_id) values(owner_id,p_warehouse_id,p_product_id) on conflict(company_id,warehouse_id,product_id) do nothing;
 select * into result_row from public.inventory where company_id=owner_id and warehouse_id=p_warehouse_id and product_id=p_product_id for update;
 return result_row;
end $$;

create or replace function public.warehouse_receive_stock(p_warehouse_id uuid,p_product_id uuid,p_quantity numeric,p_lot_number text,p_production_date date default null,p_expiry_date date default null,p_reference text default null,p_contract_id uuid default null,p_shipment_id uuid default null,p_business_case_id uuid default null) returns uuid language plpgsql security invoker set search_path='' as $$
begin
 if p_quantity<=0 then raise exception 'Quantity must be greater than zero'; end if;
 return public.warehouse_post_movement(public.active_company_id(),p_warehouse_id,p_product_id,p_quantity,p_lot_number,'inbound',p_reference,p_contract_id,p_shipment_id,p_business_case_id,p_production_date,p_expiry_date);
end $$;
create or replace function public.warehouse_issue_stock(p_warehouse_id uuid,p_product_id uuid,p_quantity numeric,p_lot_number text,p_reference text default null,p_contract_id uuid default null,p_shipment_id uuid default null,p_business_case_id uuid default null) returns uuid language plpgsql security invoker set search_path='' as $$
begin
 if p_quantity<=0 then raise exception 'Quantity must be greater than zero'; end if;
 return public.warehouse_post_movement(public.active_company_id(),p_warehouse_id,p_product_id,-p_quantity,p_lot_number,'outbound',p_reference,p_contract_id,p_shipment_id,p_business_case_id);
end $$;
create or replace function public.warehouse_adjust_stock(p_warehouse_id uuid,p_product_id uuid,p_quantity numeric,p_lot_number text,p_reason text default null,p_production_date date default null,p_expiry_date date default null) returns uuid language sql security invoker set search_path='' as $$
 select public.warehouse_post_movement(public.active_company_id(),p_warehouse_id,p_product_id,p_quantity,p_lot_number,'adjustment',p_reason,null,null,null,p_production_date,p_expiry_date);
$$;
create function public.warehouse_transfer_owned(p_company_id uuid,p_from_location uuid,p_to_location uuid,p_product_id uuid,p_quantity numeric,p_lot_number text,p_transfer_date date default current_date,p_reference text default null,p_contract_id uuid default null,p_shipment_id uuid default null,p_business_case_id uuid default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare result_id uuid; source_production date; source_expiry date; source_unit text; destination_unit text;
begin
 if p_quantity<=0 or p_from_location=p_to_location then raise exception 'Positive quantity and distinct locations required'; end if;
 -- Stable lock order prevents opposite-direction transfers deadlocking.
 perform pg_advisory_xact_lock(hashtextextended(p_company_id::text||least(p_from_location,p_to_location)::text||p_product_id::text,0));
 perform pg_advisory_xact_lock(hashtextextended(p_company_id::text||greatest(p_from_location,p_to_location)::text||p_product_id::text,0));
 select l.production_date,l.expiry_date into source_production,source_expiry from public.inventory_lots l join public.inventory i on i.id=l.inventory_id where i.company_id=p_company_id and i.warehouse_id=p_from_location and i.product_id=p_product_id and l.lot_number=btrim(p_lot_number);
 select unit into source_unit from public.inventory where company_id=p_company_id and warehouse_id=p_from_location and product_id=p_product_id;
 select unit into destination_unit from public.inventory where company_id=p_company_id and warehouse_id=p_to_location and product_id=p_product_id;
 if not found then select unit into destination_unit from public.products where id=p_product_id; end if;
 if source_unit is distinct from destination_unit then raise exception 'Transfer units differ; explicit unit reconciliation is required'; end if;
 perform public.warehouse_post_movement(p_company_id,p_from_location,p_product_id,-p_quantity,p_lot_number,'transfer',p_reference,p_contract_id,p_shipment_id,p_business_case_id);
 perform public.warehouse_post_movement(p_company_id,p_to_location,p_product_id,p_quantity,p_lot_number,'transfer',p_reference,p_contract_id,p_shipment_id,p_business_case_id,source_production,source_expiry);
 insert into public.warehouse_transfers(company_id,from_location,to_location,product_id,quantity,lot_number,transfer_date) values(p_company_id,p_from_location,p_to_location,p_product_id,p_quantity,p_lot_number,p_transfer_date) returning id into result_id;
 return result_id;
end $$;
revoke all on function public.warehouse_transfer_owned(uuid,uuid,uuid,uuid,numeric,text,date,text,uuid,uuid,uuid) from public,anon;
grant execute on function public.warehouse_transfer_owned(uuid,uuid,uuid,uuid,numeric,text,date,text,uuid,uuid,uuid) to authenticated;
create or replace function public.warehouse_transfer_stock(p_from_location uuid,p_to_location uuid,p_product_id uuid,p_quantity numeric,p_lot_number text,p_transfer_date date default current_date,p_reference text default null) returns uuid language sql security invoker set search_path='' as $$
 select public.warehouse_transfer_owned(public.active_company_id(),p_from_location,p_to_location,p_product_id,p_quantity,p_lot_number,p_transfer_date,p_reference);
$$;
-- Trigger functions are not application RPCs; trigger execution does not need
-- caller EXECUTE privileges. Preserve invoker access only to reviewed public APIs.
revoke all on function erp_private.warehouse_owner(),erp_private.post_stock(),erp_private.stock_history_guard(),erp_private.stock_cache_guard(),erp_private.reserve_stock() from public,anon,authenticated;
notify pgrst,'reload schema';
