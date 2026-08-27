-- Contract hub tables (apply when missing from live database)

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  container text,
  vessel text,
  port_of_loading text,
  port_of_destination text,
  etd date,
  eta date,
  status text default 'Planned',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.contract_products (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  product_id uuid not null references public.products (id),
  quantity numeric default 0,
  reserved numeric default 0,
  packed numeric default 0,
  loaded numeric default 0,
  remaining numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (contract_id, product_id)
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  invoice_number text not null,
  amount numeric default 0,
  currency text default 'USD',
  status text default 'Draft',
  due_date date,
  paid_amount numeric default 0,
  outstanding numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.shipments enable row level security;
alter table public.contract_products enable row level security;
alter table public.invoices enable row level security;

drop policy if exists "Public read shipments" on public.shipments;
create policy "Public read shipments"
  on public.shipments for select to public using (true);

drop policy if exists "Public read contract_products" on public.contract_products;
create policy "Public read contract_products"
  on public.contract_products for select to public using (true);

drop policy if exists "Public read invoices" on public.invoices;
create policy "Public read invoices"
  on public.invoices for select to public using (true);

drop policy if exists "Public insert shipments" on public.shipments;
create policy "Public insert shipments"
  on public.shipments for insert to public with check (true);

drop policy if exists "Public insert contract_products" on public.contract_products;
create policy "Public insert contract_products"
  on public.contract_products for insert to public with check (true);

drop policy if exists "Public insert invoices" on public.invoices;
create policy "Public insert invoices"
  on public.invoices for insert to public with check (true);

drop policy if exists "Public update shipments" on public.shipments;
create policy "Public update shipments"
  on public.shipments for update to public using (true);

drop policy if exists "Public update contract_products" on public.contract_products;
create policy "Public update contract_products"
  on public.contract_products for update to public using (true);

drop policy if exists "Public update invoices" on public.invoices;
create policy "Public update invoices"
  on public.invoices for update to public using (true);

drop policy if exists "Public delete shipments" on public.shipments;
create policy "Public delete shipments"
  on public.shipments for delete to public using (true);

drop policy if exists "Public delete contract_products" on public.contract_products;
create policy "Public delete contract_products"
  on public.contract_products for delete to public using (true);

drop policy if exists "Public delete invoices" on public.invoices;
create policy "Public delete invoices"
  on public.invoices for delete to public using (true);

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "Public read documents bucket" on storage.objects;
create policy "Public read documents bucket"
  on storage.objects for select to public
  using (bucket_id = 'documents');

drop policy if exists "Public upload documents bucket" on storage.objects;
create policy "Public upload documents bucket"
  on storage.objects for insert to public
  with check (bucket_id = 'documents');
