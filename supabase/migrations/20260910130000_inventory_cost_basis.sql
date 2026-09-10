-- Phase 7 prerequisites only: specific identification by immutable owned lot.
-- Different acquisition prices/currencies require different lot numbers. Legacy
-- uncosted lots remain unknown; no purchase invoice amount is assumed to be COGS.
alter table public.inventory_lots add column acquisition_unit_cost numeric,
  add column acquisition_currency text references public.currencies(code);
alter table public.inventory_lots add constraint inventory_lot_cost_pair check (
  (acquisition_unit_cost is null and acquisition_currency is null) or
  (acquisition_unit_cost is not null and acquisition_currency is not null and
   acquisition_unit_cost>=0 and acquisition_unit_cost::text not in ('NaN','Infinity','-Infinity') and acquisition_currency ~ '^[A-Z]{3}$'));
alter table public.stock_movements add column cost_unit_amount numeric,
  add column cost_currency text references public.currencies(code),
  add column cost_transfer_source_id uuid references public.stock_movements(id) on delete restrict,
  add column cost_amount numeric generated always as (quantity * cost_unit_amount) stored;
alter table public.stock_movements add constraint stock_movement_cost_pair check (
  (cost_unit_amount is null and cost_currency is null) or
  (cost_unit_amount is not null and cost_currency is not null and cost_unit_amount>=0 and
   cost_unit_amount::text not in ('NaN','Infinity','-Infinity') and cost_currency ~ '^[A-Z]{3}$'));
create unique index stock_cost_transfer_once on public.stock_movements(cost_transfer_source_id) where cost_transfer_source_id is not null;

create function erp_private.lot_cost_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and (old.acquisition_unit_cost is not null or old.acquisition_currency is not null) and
    (new.acquisition_unit_cost is distinct from old.acquisition_unit_cost or new.acquisition_currency is distinct from old.acquisition_currency) then
   raise exception 'Acquisition cost is immutable; use a distinct lot for another acquisition cost' using errcode='42501';
 end if;
 if current_user in ('authenticated','anon') and
   ((tg_op='INSERT' and (new.acquisition_unit_cost is not null or new.acquisition_currency is not null)) or
    (tg_op='UPDATE' and (new.acquisition_unit_cost is distinct from old.acquisition_unit_cost or new.acquisition_currency is distinct from old.acquisition_currency))) then
   raise exception 'Set acquisition cost through a costed receipt' using errcode='42501';
 end if;
 return new;
end $$;
create trigger lot_cost_guard before insert or update on public.inventory_lots for each row execute function erp_private.lot_cost_guard();

-- Runs after z_post_stock: its owner/location/product lock and posting checks
-- remain authoritative. Any cost rejection rolls the complete receipt back.
create function erp_private.snapshot_stock_cost() returns trigger language plpgsql security definer set search_path='' as $$
declare lot public.inventory_lots; inv public.inventory; source public.stock_movements; wanted_cost numeric; wanted_currency text;
begin
 select * into inv from public.inventory where company_id=new.company_id and warehouse_id=new.warehouse_id and product_id=new.product_id;
 select * into lot from public.inventory_lots where inventory_id=inv.id and lot_number=btrim(new.lot_number) for update;
 wanted_cost:=new.cost_unit_amount; wanted_currency:=new.cost_currency;
 if (wanted_cost is null)<>(wanted_currency is null) then raise exception 'Acquisition cost and currency must both be supplied'; end if;
 if new.cost_transfer_source_id is not null then
   select * into source from public.stock_movements where id=new.cost_transfer_source_id for update;
   if not found or source.company_id is distinct from new.company_id or source.product_id is distinct from new.product_id or
     source.unit is distinct from new.unit or source.warehouse_id=new.warehouse_id or source.lot_number is distinct from new.lot_number or
     source.movement_type<>'transfer' or new.movement_type<>'transfer' or source.quantity>=0 or new.quantity<>-source.quantity then
     raise exception 'Transfer cost source must be the matching owned release';
   end if;
   if wanted_cost is not null and (wanted_cost is distinct from source.cost_unit_amount or wanted_currency is distinct from source.cost_currency) then raise exception 'Transfer cannot change acquisition cost'; end if;
   wanted_cost:=source.cost_unit_amount; wanted_currency:=source.cost_currency;
 elsif new.movement_type='transfer' and new.quantity>0 then
   raise exception 'Transfer receipt requires its explicit source movement';
 end if;
 if lot.acquisition_unit_cost is not null then
   if new.quantity>0 and new.movement_type in ('inbound','transfer') and wanted_cost is null then raise exception 'Costed lot receipt requires the same explicit acquisition cost'; end if;
   if wanted_cost is not null and (wanted_cost is distinct from lot.acquisition_unit_cost or wanted_currency is distinct from lot.acquisition_currency) then raise exception 'Different acquisition cost requires a distinct lot'; end if;
   new.cost_unit_amount:=lot.acquisition_unit_cost; new.cost_currency:=lot.acquisition_currency;
 elsif wanted_cost is not null then
   if new.quantity<=0 or new.movement_type not in ('inbound','transfer') or lot.opening_quantity<>0 or
     exists(select 1 from public.stock_movements m where m.company_id=new.company_id and m.warehouse_id=new.warehouse_id and m.product_id=new.product_id and btrim(m.lot_number)=btrim(new.lot_number)) then
     raise exception 'Historical unknown stock cannot be assigned a guessed acquisition cost';
   end if;
   update public.inventory_lots set acquisition_unit_cost=wanted_cost,acquisition_currency=wanted_currency where id=lot.id;
   new.cost_unit_amount:=wanted_cost; new.cost_currency:=wanted_currency;
 else new.cost_unit_amount:=null; new.cost_currency:=null;
 end if;
 return new;
end $$;
create trigger zz_snapshot_stock_cost before insert on public.stock_movements for each row execute function erp_private.snapshot_stock_cost();

create function public.warehouse_receive_costed(p_company_id uuid,p_warehouse_id uuid,p_product_id uuid,p_quantity numeric,p_lot_number text,p_unit_cost numeric,p_currency text,p_contract_id uuid default null,p_shipment_id uuid default null,p_business_case_id uuid default null,p_reference text default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare result_id uuid;
begin
 if p_quantity<=0 or p_unit_cost is null or p_currency is null then raise exception 'Positive quantity, explicit cost and currency required'; end if;
 insert into public.stock_movements(company_id,warehouse_id,product_id,quantity,lot_number,movement_type,cost_unit_amount,cost_currency,contract_id,shipment_id,business_case_id,reference)
 values(p_company_id,p_warehouse_id,p_product_id,p_quantity,btrim(p_lot_number),'inbound',p_unit_cost,p_currency,p_contract_id,p_shipment_id,p_business_case_id,p_reference) returning id into result_id;
 return result_id;
end $$;
revoke all on function public.warehouse_receive_costed(uuid,uuid,uuid,numeric,text,numeric,text,uuid,uuid,uuid,text) from public,anon;
grant execute on function public.warehouse_receive_costed(uuid,uuid,uuid,numeric,text,numeric,text,uuid,uuid,uuid,text) to authenticated;

-- Reporting inputs cross JSON as decimal text, never lossy JSON numbers.
-- This is a cost-input DTO, not a COGS/profit calculation. Current owned-lot
-- quantity is separate from the immutable movement quantity and unit cost.
create function public.warehouse_cost_input(p_movement_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
   'movement_id',m.id,'company_id',m.company_id,'warehouse_id',m.warehouse_id,
   'product_id',m.product_id,'lot_id',l.id,'lot_number',l.lot_number,
   'business_case_id',m.business_case_id,'contract_id',m.contract_id,'shipment_id',m.shipment_id,
   'unit',m.unit,'quantity',m.quantity::text,'unit_cost',m.cost_unit_amount::text,
   'currency',m.cost_currency,'cost_amount',m.cost_amount::text,
   'transfer_source_id',m.cost_transfer_source_id,
   'remaining_quantity',l.quantity::text,'lot_unit_cost',l.acquisition_unit_cost::text,
   'lot_currency',l.acquisition_currency,
   'remaining_cost_amount',(l.quantity*l.acquisition_unit_cost)::text,
   'cost_known',m.cost_unit_amount is not null)
 from public.stock_movements m
 join public.inventory i on i.company_id=m.company_id and i.warehouse_id=m.warehouse_id and i.product_id=m.product_id
 join public.inventory_lots l on l.inventory_id=i.id and l.lot_number=btrim(m.lot_number)
 where m.id=p_movement_id;
$$;
revoke all on function public.warehouse_cost_input(uuid) from public,anon;
grant execute on function public.warehouse_cost_input(uuid) to authenticated;

-- Preserve existing API and quantity/date/unit safeguards; pair actual ledger
-- IDs so transfer carries its original basis without lot-name guessing.
create or replace function public.warehouse_transfer_owned(p_company_id uuid,p_from_location uuid,p_to_location uuid,p_product_id uuid,p_quantity numeric,p_lot_number text,p_transfer_date date default current_date,p_reference text default null,p_contract_id uuid default null,p_shipment_id uuid default null,p_business_case_id uuid default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare result_id uuid; source_id uuid; source_production date; source_expiry date; source_unit text; destination_unit text;
begin
 if p_quantity<=0 or p_from_location=p_to_location then raise exception 'Positive quantity and distinct locations required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_company_id::text||least(p_from_location,p_to_location)::text||p_product_id::text,0));
 perform pg_advisory_xact_lock(hashtextextended(p_company_id::text||greatest(p_from_location,p_to_location)::text||p_product_id::text,0));
 select l.production_date,l.expiry_date into source_production,source_expiry from public.inventory_lots l join public.inventory i on i.id=l.inventory_id where i.company_id=p_company_id and i.warehouse_id=p_from_location and i.product_id=p_product_id and l.lot_number=btrim(p_lot_number);
 select unit into source_unit from public.inventory where company_id=p_company_id and warehouse_id=p_from_location and product_id=p_product_id;
 select unit into destination_unit from public.inventory where company_id=p_company_id and warehouse_id=p_to_location and product_id=p_product_id;
 if not found then select unit into destination_unit from public.products where id=p_product_id; end if;
 if source_unit is distinct from destination_unit then raise exception 'Transfer units differ; explicit unit reconciliation is required'; end if;
 source_id:=public.warehouse_post_movement(p_company_id,p_from_location,p_product_id,-p_quantity,p_lot_number,'transfer',p_reference,p_contract_id,p_shipment_id,p_business_case_id);
 insert into public.stock_movements(company_id,warehouse_id,product_id,quantity,lot_number,movement_type,reference,contract_id,shipment_id,business_case_id,production_date,expiry_date,cost_transfer_source_id)
 values(p_company_id,p_to_location,p_product_id,p_quantity,btrim(p_lot_number),'transfer',p_reference,p_contract_id,p_shipment_id,p_business_case_id,source_production,source_expiry,source_id);
 insert into public.warehouse_transfers(company_id,from_location,to_location,product_id,quantity,lot_number,transfer_date) values(p_company_id,p_from_location,p_to_location,p_product_id,p_quantity,p_lot_number,p_transfer_date) returning id into result_id;
 return result_id;
end $$;
revoke all on function erp_private.lot_cost_guard(),erp_private.snapshot_stock_cost() from public,anon,authenticated;
notify pgrst,'reload schema';
