-- Operational shipment quantities are separate from legally agreed contract lines.
create table public.shipment_lines (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  contract_product_id uuid references public.contract_products(id),
  product_id uuid references public.products(id),
  description text not null check (btrim(description) <> ''),
  quantity numeric(18,6) not null check(quantity > 0 and quantity::text not in ('NaN','Infinity','-Infinity')),
  unit text not null check(btrim(unit) <> ''),
  net_weight numeric(18,6) check(net_weight >= 0 and net_weight::text not in ('NaN','Infinity','-Infinity')),
  gross_weight numeric(18,6) check(gross_weight >= 0 and gross_weight::text not in ('NaN','Infinity','-Infinity')),
  origin text, packing text, notes text,
  created_at timestamptz not null default now(),
  check(gross_weight is null or net_weight is null or gross_weight >= net_weight)
);
create index shipment_lines_shipment_idx on public.shipment_lines(shipment_id);
create index shipment_lines_company_idx on public.shipment_lines(company_id);
alter table public.shipment_lines enable row level security;
revoke all on public.shipment_lines from public,anon;
grant select,insert,update,delete on public.shipment_lines to authenticated;
create policy member_read on public.shipment_lines for select to authenticated using(erp_private.has_permission(company_id,'logistics','read'));
create policy member_insert on public.shipment_lines for insert to authenticated with check(erp_private.has_permission(company_id,'logistics','write'));
create policy member_update on public.shipment_lines for update to authenticated using(erp_private.has_permission(company_id,'logistics','write')) with check(erp_private.has_permission(company_id,'logistics','write'));
create policy member_delete on public.shipment_lines for delete to authenticated using(erp_private.has_permission(company_id,'logistics','write'));

create function erp_private.validate_shipment_line() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.shipments; p public.contract_products;
begin
  if tg_op='UPDATE' and (new.shipment_id is distinct from old.shipment_id or new.company_id is distinct from old.company_id) then raise exception 'Shipment line ownership is immutable' using errcode='42501'; end if;
  if tg_op='DELETE' then
    select * into s from public.shipments where id=old.shipment_id for update;
    if s.status='Delivered' then raise exception 'Delivered shipment quantities are immutable'; end if;
    return old;
  end if;
  select * into s from public.shipments where id=new.shipment_id for update;
  if new.company_id is distinct from s.company_id then raise exception 'Shipment line company mismatch' using errcode='42501'; end if;
  if s.status='Delivered' then raise exception 'Delivered shipment quantities are immutable'; end if;
  if new.contract_product_id is not null then
    select * into p from public.contract_products where id=new.contract_product_id;
    if p.contract_id is distinct from s.contract_id then raise exception 'Shipment line must refer to its own contract'; end if;
    if new.product_id is not null and new.product_id is distinct from p.product_id then raise exception 'Shipment product does not match contract product'; end if;
  elsif new.product_id is not null and not exists(select 1 from public.products where id=new.product_id and company_id=s.company_id) then
    raise exception 'Shipment product company mismatch' using errcode='42501';
  end if;
  return new;
end $$;
create trigger validate_shipment_line before insert or update or delete on public.shipment_lines for each row execute function erp_private.validate_shipment_line();

create function erp_private.validate_shipment_origin() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.contracts;
begin
  if tg_op='DELETE' then
    if old.status='Delivered' then raise exception 'Delivered shipment history cannot be deleted'; end if;
    return old;
  end if;
  select * into c from public.contracts where id=new.contract_id;
  if c.id is null then raise exception 'Shipment contract is required'; end if;
  if new.status not in ('Planned','In Transit','Delivered','Delayed') then raise exception 'Invalid shipment status'; end if;
  if tg_op='UPDATE' and old.status='Planned' and new.status='Delivered' then raise exception 'Shipment must enter In Transit before Delivered'; end if;
  if tg_op='UPDATE' and old.status='In Transit' and new.status='Planned' then raise exception 'Invalid shipment status transition'; end if;
  if tg_op='UPDATE' and old.status='Delivered' and new is distinct from old then raise exception 'Delivered shipment is immutable'; end if;
  if new.etd > new.eta or new.atd > new.ata or new.etd_actual > new.eta_actual then raise exception 'Shipment dates are out of order'; end if;
  new.company_id:=coalesce(new.company_id,c.company_id);
  if auth.uid() is not null and not erp_private.has_permission(new.company_id,'logistics','write') then raise exception 'Shipment company access denied' using errcode='42501'; end if;
  if new.company_id is distinct from c.company_id and not exists(select 1 from public.contract_parties where contract_id=c.id and role_code in ('seller','buyer') and internal_company_id=new.company_id) then raise exception 'Shipment company must own or be a legal party of its contract' using errcode='42501'; end if;
  if tg_op='UPDATE' and old.company_id is distinct from new.company_id then raise exception 'Shipment owner is immutable' using errcode='42501'; end if;
  if c.business_case_id is not null then
    if new.business_case_id is not null and new.business_case_id is distinct from c.business_case_id then raise exception 'Shipment Deal must match its contract'; end if;
    new.business_case_id:=c.business_case_id;
  elsif new.business_case_id is not null and not exists(select 1 from public.business_cases where id=new.business_case_id and company_id=new.company_id) then
    raise exception 'Shipment Deal company mismatch' using errcode='42501';
  end if;
  if tg_op='UPDATE' and old.contract_id is distinct from new.contract_id and exists(select 1 from public.shipment_lines where shipment_id=old.id) then raise exception 'Cannot change contract while shipment product lines exist'; end if;
  return new;
end $$;
-- Replace the generic parent-company assumption only for this explicit operational model.
drop trigger enforce_company_ownership on public.shipments;
create trigger enforce_company_ownership before insert or update or delete on public.shipments for each row execute function erp_private.validate_shipment_origin();

create function public.replace_shipment_lines(shipment uuid, lines jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare owner uuid; state text;
begin
  select company_id,status into owner,state from public.shipments where id=shipment for update;
  if not found or not erp_private.has_permission(owner,'logistics','write') then raise exception 'Shipment write access denied' using errcode='42501'; end if;
  if state='Delivered' then raise exception 'Delivered shipment quantities are immutable'; end if;
  if jsonb_typeof(lines) is distinct from 'array' then raise exception 'Product lines must be an array'; end if;
  delete from public.shipment_lines where shipment_id=shipment;
  insert into public.shipment_lines(shipment_id,company_id,contract_product_id,product_id,description,quantity,unit,net_weight,gross_weight,origin,packing,notes)
    select shipment,owner,x.contract_product_id,x.product_id,x.description,x.quantity,x.unit,x.net_weight,x.gross_weight,x.origin,x.packing,x.notes
    from jsonb_to_recordset(lines) as x(contract_product_id uuid,product_id uuid,description text,quantity numeric,unit text,net_weight numeric,gross_weight numeric,origin text,packing text,notes text);
end $$;
revoke all on function public.replace_shipment_lines(uuid,jsonb) from public,anon;
grant execute on function public.replace_shipment_lines(uuid,jsonb) to authenticated;
comment on table public.shipment_lines is 'Actual shipment quantities, linked to canonical contract and product IDs. Legal parties are inherited through shipment.contract_id -> contract_parties.';
