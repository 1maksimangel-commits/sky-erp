-- Recovered prehistory for CLEAN reconstruction, before the first preserved migration.
-- Only objects never created by the historical chain belong here. Do not precreate
-- shipments, invoices, expenses, documents, or other tables owned by later migrations.
-- Existing databases require a separately reviewed adoption plan; this is not a repair
-- script for the retired .codex-local-bootstrap schema. No permissions are granted.

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  short_name text,
  country text,
  city text,
  address text,
  tax_id text,
  registration_number text,
  email text,
  phone text,
  website text,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.counterparties (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  legal_name text not null,
  short_name text,
  counterparty_type text,
  country text,
  city text,
  address text,
  tax_id text,
  registration_number text,
  email text,
  phone text,
  website text,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id),
  code text unique,
  sku text,
  name text not null,
  description text,
  scientific_name text,
  category text,
  species text,
  origin text,
  country text,
  brand text,
  size text,
  size_grade text,
  unit text,
  glaze numeric,
  package_type text,
  net_weight numeric,
  gross_weight numeric,
  hs_code text,
  image_url text,
  purchase_price numeric,
  sale_price numeric,
  currency text,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  contract_number text not null unique,
  title text,
  company_id uuid references public.companies(id),
  buyer_id uuid references public.counterparties(id),
  supplier_id uuid references public.counterparties(id),
  currency text,
  amount numeric,
  incoterms text,
  contract_date date,
  expiry_date date,
  status text default 'Draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  amount numeric,
  currency text,
  status text default 'Paid',
  payment_date date,
  notes text,
  created_at timestamptz default now()
);

-- Fail closed on the recovered masters. Historical policies replay unchanged.
alter table public.companies enable row level security;
alter table public.counterparties enable row level security;
alter table public.products enable row level security;
alter table public.contracts enable row level security;
alter table public.payments enable row level security;
