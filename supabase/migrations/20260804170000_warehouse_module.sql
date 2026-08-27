-- Warehouse module: locations, inventory, lots, movements, transfers, reservations

create table if not exists public.warehouse_locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  type text default 'Cold Storage',
  status text default 'Active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouse_locations (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity numeric not null default 0 check (quantity >= 0),
  available_quantity numeric not null default 0 check (available_quantity >= 0),
  reserved_quantity numeric not null default 0 check (reserved_quantity >= 0),
  updated_at timestamptz default now(),
  unique (warehouse_id, product_id),
  check (available_quantity + reserved_quantity = quantity)
);

create table if not exists public.inventory_lots (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventory (id) on delete cascade,
  lot_number text not null,
  production_date date,
  expiry_date date,
  quantity numeric not null default 0 check (quantity >= 0),
  status text not null default 'Available',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (inventory_id, lot_number)
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  warehouse_id uuid not null references public.warehouse_locations (id) on delete restrict,
  movement_type text not null check (
    movement_type in ('inbound', 'outbound', 'transfer', 'adjustment', 'reservation')
  ),
  quantity numeric not null check (quantity <> 0),
  contract_id uuid references public.contracts (id) on delete set null,
  shipment_id uuid references public.shipments (id) on delete set null,
  business_case_id uuid references public.business_cases (id) on delete set null,
  lot_number text,
  reference text,
  created_at timestamptz default now()
);

create table if not exists public.warehouse_transfers (
  id uuid primary key default gen_random_uuid(),
  from_location uuid not null references public.warehouse_locations (id) on delete restrict,
  to_location uuid not null references public.warehouse_locations (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  lot_number text,
  quantity numeric not null check (quantity > 0),
  status text not null default 'Completed',
  transfer_date date default current_date,
  created_at timestamptz default now(),
  check (from_location <> to_location)
);

create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventory (id) on delete cascade,
  contract_id uuid references public.contracts (id) on delete set null,
  shipment_id uuid references public.shipments (id) on delete set null,
  quantity numeric not null check (quantity > 0),
  status text not null default 'Active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists inventory_warehouse_id_idx on public.inventory (warehouse_id);
create index if not exists inventory_product_id_idx on public.inventory (product_id);
create index if not exists inventory_lots_inventory_id_idx on public.inventory_lots (inventory_id);
create index if not exists inventory_lots_lot_number_idx on public.inventory_lots (lot_number);
create index if not exists stock_movements_product_id_idx on public.stock_movements (product_id);
create index if not exists stock_movements_warehouse_id_idx on public.stock_movements (warehouse_id);
create index if not exists stock_movements_created_at_idx on public.stock_movements (created_at desc);
create index if not exists warehouse_transfers_from_location_idx on public.warehouse_transfers (from_location);
create index if not exists warehouse_transfers_to_location_idx on public.warehouse_transfers (to_location);
create index if not exists inventory_reservations_inventory_id_idx on public.inventory_reservations (inventory_id);

-- Atomic stock helpers

create or replace function public._ensure_inventory_row(
  p_warehouse_id uuid,
  p_product_id uuid
) returns public.inventory
language plpgsql
as $$
declare
  v_row public.inventory;
begin
  select * into v_row
  from public.inventory
  where warehouse_id = p_warehouse_id
    and product_id = p_product_id
  for update;

  if found then
    return v_row;
  end if;

  insert into public.inventory (
    warehouse_id,
    product_id,
    quantity,
    available_quantity,
    reserved_quantity,
    updated_at
  )
  values (
    p_warehouse_id,
    p_product_id,
    0,
    0,
    0,
    now()
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.warehouse_receive_stock(
  p_warehouse_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_lot_number text,
  p_production_date date default null,
  p_expiry_date date default null,
  p_reference text default null,
  p_contract_id uuid default null,
  p_shipment_id uuid default null,
  p_business_case_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inventory public.inventory;
  v_lot public.inventory_lots;
  v_movement_id uuid;
  v_qty numeric := abs(p_quantity);
begin
  if v_qty <= 0 then
    raise exception 'Quantity must be greater than zero.';
  end if;

  if p_lot_number is null or btrim(p_lot_number) = '' then
    raise exception 'Lot number is required.';
  end if;

  v_inventory := public._ensure_inventory_row(p_warehouse_id, p_product_id);

  select * into v_lot
  from public.inventory_lots
  where inventory_id = v_inventory.id
    and lot_number = btrim(p_lot_number)
  for update;

  if found then
    update public.inventory_lots
    set
      quantity = quantity + v_qty,
      production_date = coalesce(p_production_date, production_date),
      expiry_date = coalesce(p_expiry_date, expiry_date),
      status = case when status = 'Depleted' then 'Available' else status end,
      updated_at = now()
    where id = v_lot.id;
  else
    insert into public.inventory_lots (
      inventory_id,
      lot_number,
      production_date,
      expiry_date,
      quantity,
      status
    )
    values (
      v_inventory.id,
      btrim(p_lot_number),
      p_production_date,
      p_expiry_date,
      v_qty,
      'Available'
    );
  end if;

  update public.inventory
  set
    quantity = quantity + v_qty,
    available_quantity = available_quantity + v_qty,
    updated_at = now()
  where id = v_inventory.id;

  insert into public.stock_movements (
    product_id,
    warehouse_id,
    movement_type,
    quantity,
    contract_id,
    shipment_id,
    business_case_id,
    lot_number,
    reference
  )
  values (
    p_product_id,
    p_warehouse_id,
    'inbound',
    v_qty,
    p_contract_id,
    p_shipment_id,
    p_business_case_id,
    btrim(p_lot_number),
    p_reference
  )
  returning id into v_movement_id;

  return v_movement_id;
end;
$$;

create or replace function public.warehouse_issue_stock(
  p_warehouse_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_lot_number text,
  p_reference text default null,
  p_contract_id uuid default null,
  p_shipment_id uuid default null,
  p_business_case_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inventory public.inventory;
  v_lot public.inventory_lots;
  v_movement_id uuid;
  v_qty numeric := abs(p_quantity);
begin
  if v_qty <= 0 then
    raise exception 'Quantity must be greater than zero.';
  end if;

  if p_lot_number is null or btrim(p_lot_number) = '' then
    raise exception 'Lot number is required.';
  end if;

  select * into v_inventory
  from public.inventory
  where warehouse_id = p_warehouse_id
    and product_id = p_product_id
  for update;

  if not found then
    raise exception 'No inventory found for this product and warehouse.';
  end if;

  select * into v_lot
  from public.inventory_lots
  where inventory_id = v_inventory.id
    and lot_number = btrim(p_lot_number)
  for update;

  if not found then
    raise exception 'Lot % not found.', btrim(p_lot_number);
  end if;

  if v_lot.quantity < v_qty then
    raise exception 'Insufficient lot quantity. Available: %.', v_lot.quantity;
  end if;

  if v_inventory.available_quantity < v_qty then
    raise exception 'Insufficient available quantity. Available: %.', v_inventory.available_quantity;
  end if;

  update public.inventory_lots
  set
    quantity = quantity - v_qty,
    status = case when quantity - v_qty = 0 then 'Depleted' else status end,
    updated_at = now()
  where id = v_lot.id;

  update public.inventory
  set
    quantity = quantity - v_qty,
    available_quantity = available_quantity - v_qty,
    updated_at = now()
  where id = v_inventory.id;

  insert into public.stock_movements (
    product_id,
    warehouse_id,
    movement_type,
    quantity,
    contract_id,
    shipment_id,
    business_case_id,
    lot_number,
    reference
  )
  values (
    p_product_id,
    p_warehouse_id,
    'outbound',
    -v_qty,
    p_contract_id,
    p_shipment_id,
    p_business_case_id,
    btrim(p_lot_number),
    p_reference
  )
  returning id into v_movement_id;

  return v_movement_id;
end;
$$;

create or replace function public.warehouse_transfer_stock(
  p_from_location uuid,
  p_to_location uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_lot_number text,
  p_transfer_date date default current_date,
  p_reference text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer_id uuid;
  v_qty numeric := abs(p_quantity);
  v_from_inventory public.inventory;
  v_to_inventory public.inventory;
  v_from_lot public.inventory_lots;
  v_to_lot public.inventory_lots;
  v_lot_number text := btrim(p_lot_number);
  v_ref text := coalesce(nullif(btrim(coalesce(p_reference, '')), ''), 'Warehouse transfer');
begin
  if p_from_location = p_to_location then
    raise exception 'Source and destination warehouses must be different.';
  end if;

  if v_qty <= 0 then
    raise exception 'Quantity must be greater than zero.';
  end if;

  if v_lot_number is null or v_lot_number = '' then
    raise exception 'Lot number is required.';
  end if;

  select * into v_from_inventory
  from public.inventory
  where warehouse_id = p_from_location
    and product_id = p_product_id
  for update;

  if not found then
    raise exception 'No inventory found at source warehouse.';
  end if;

  select * into v_from_lot
  from public.inventory_lots
  where inventory_id = v_from_inventory.id
    and lot_number = v_lot_number
  for update;

  if not found then
    raise exception 'Lot % not found at source warehouse.', v_lot_number;
  end if;

  if v_from_lot.quantity < v_qty then
    raise exception 'Insufficient lot quantity at source. Available: %.', v_from_lot.quantity;
  end if;

  if v_from_inventory.available_quantity < v_qty then
    raise exception 'Insufficient available quantity at source. Available: %.', v_from_inventory.available_quantity;
  end if;

  update public.inventory_lots
  set
    quantity = quantity - v_qty,
    status = case when quantity - v_qty = 0 then 'Depleted' else status end,
    updated_at = now()
  where id = v_from_lot.id;

  update public.inventory
  set
    quantity = quantity - v_qty,
    available_quantity = available_quantity - v_qty,
    updated_at = now()
  where id = v_from_inventory.id;

  v_to_inventory := public._ensure_inventory_row(p_to_location, p_product_id);

  select * into v_to_lot
  from public.inventory_lots
  where inventory_id = v_to_inventory.id
    and lot_number = v_lot_number
  for update;

  if found then
    update public.inventory_lots
    set
      quantity = quantity + v_qty,
      production_date = coalesce(production_date, v_from_lot.production_date),
      expiry_date = coalesce(expiry_date, v_from_lot.expiry_date),
      status = case when status = 'Depleted' then 'Available' else status end,
      updated_at = now()
    where id = v_to_lot.id;
  else
    insert into public.inventory_lots (
      inventory_id,
      lot_number,
      production_date,
      expiry_date,
      quantity,
      status
    )
    values (
      v_to_inventory.id,
      v_lot_number,
      v_from_lot.production_date,
      v_from_lot.expiry_date,
      v_qty,
      'Available'
    );
  end if;

  update public.inventory
  set
    quantity = quantity + v_qty,
    available_quantity = available_quantity + v_qty,
    updated_at = now()
  where id = v_to_inventory.id;

  insert into public.stock_movements (
    product_id, warehouse_id, movement_type, quantity, lot_number, reference
  ) values
    (p_product_id, p_from_location, 'transfer', -v_qty, v_lot_number, v_ref),
    (p_product_id, p_to_location, 'transfer', v_qty, v_lot_number, v_ref);

  insert into public.warehouse_transfers (
    from_location,
    to_location,
    product_id,
    lot_number,
    quantity,
    status,
    transfer_date
  )
  values (
    p_from_location,
    p_to_location,
    p_product_id,
    v_lot_number,
    v_qty,
    'Completed',
    coalesce(p_transfer_date, current_date)
  )
  returning id into v_transfer_id;

  return v_transfer_id;
end;
$$;

create or replace function public.warehouse_adjust_stock(
  p_warehouse_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_lot_number text,
  p_reason text default null,
  p_production_date date default null,
  p_expiry_date date default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inventory public.inventory;
  v_lot public.inventory_lots;
  v_movement_id uuid;
  v_delta numeric := p_quantity;
begin
  if v_delta = 0 then
    raise exception 'Adjustment quantity cannot be zero.';
  end if;

  if p_lot_number is null or btrim(p_lot_number) = '' then
    raise exception 'Lot number is required.';
  end if;

  v_inventory := public._ensure_inventory_row(p_warehouse_id, p_product_id);

  select * into v_lot
  from public.inventory_lots
  where inventory_id = v_inventory.id
    and lot_number = btrim(p_lot_number)
  for update;

  if not found then
    if v_delta < 0 then
      raise exception 'Cannot decrease a lot that does not exist.';
    end if;

    insert into public.inventory_lots (
      inventory_id,
      lot_number,
      production_date,
      expiry_date,
      quantity,
      status
    )
    values (
      v_inventory.id,
      btrim(p_lot_number),
      p_production_date,
      p_expiry_date,
      v_delta,
      'Available'
    );
  else
    if v_lot.quantity + v_delta < 0 then
      raise exception 'Adjustment would make lot quantity negative.';
    end if;

    if v_inventory.available_quantity + v_delta < 0 then
      raise exception 'Adjustment would make available quantity negative.';
    end if;

    update public.inventory_lots
    set
      quantity = quantity + v_delta,
      production_date = coalesce(p_production_date, production_date),
      expiry_date = coalesce(p_expiry_date, expiry_date),
      status = case
        when quantity + v_delta = 0 then 'Depleted'
        when status = 'Depleted' and quantity + v_delta > 0 then 'Available'
        else status
      end,
      updated_at = now()
    where id = v_lot.id;
  end if;

  update public.inventory
  set
    quantity = quantity + v_delta,
    available_quantity = available_quantity + v_delta,
    updated_at = now()
  where id = v_inventory.id;

  insert into public.stock_movements (
    product_id,
    warehouse_id,
    movement_type,
    quantity,
    lot_number,
    reference
  )
  values (
    p_product_id,
    p_warehouse_id,
    'adjustment',
    v_delta,
    btrim(p_lot_number),
    p_reason
  )
  returning id into v_movement_id;

  return v_movement_id;
end;
$$;

grant execute on function public.warehouse_receive_stock(
  uuid, uuid, numeric, text, date, date, text, uuid, uuid, uuid
) to anon, authenticated, service_role;

grant execute on function public.warehouse_issue_stock(
  uuid, uuid, numeric, text, text, uuid, uuid, uuid
) to anon, authenticated, service_role;

grant execute on function public.warehouse_transfer_stock(
  uuid, uuid, uuid, numeric, text, date, text
) to anon, authenticated, service_role;

grant execute on function public.warehouse_adjust_stock(
  uuid, uuid, numeric, text, text, date, date
) to anon, authenticated, service_role;

alter table public.warehouse_locations enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_lots enable row level security;
alter table public.stock_movements enable row level security;
alter table public.warehouse_transfers enable row level security;
alter table public.inventory_reservations enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'warehouse_locations',
    'inventory',
    'inventory_lots',
    'stock_movements',
    'warehouse_transfers',
    'inventory_reservations'
  ]
  loop
    execute format('drop policy if exists "Public read %1$s" on public.%1$I', t);
    execute format(
      'create policy "Public read %1$s" on public.%1$I for select to public using (true)',
      t
    );

    execute format('drop policy if exists "Public insert %1$s" on public.%1$I', t);
    execute format(
      'create policy "Public insert %1$s" on public.%1$I for insert to public with check (true)',
      t
    );

    execute format('drop policy if exists "Public update %1$s" on public.%1$I', t);
    execute format(
      'create policy "Public update %1$s" on public.%1$I for update to public using (true)',
      t
    );

    execute format('drop policy if exists "Public delete %1$s" on public.%1$I', t);
    execute format(
      'create policy "Public delete %1$s" on public.%1$I for delete to public using (true)',
      t
    );
  end loop;
end
$$;

insert into public.warehouse_locations (code, name, type, status)
values
  ('WH-MAIN', 'Main Cold Store', 'Cold Storage', 'Active'),
  ('WH-DOCK', 'Export Dock', 'Staging', 'Active')
on conflict (code) do nothing;

notify pgrst, 'reload schema';
