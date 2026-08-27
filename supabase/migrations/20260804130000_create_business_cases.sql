create table public.business_cases (
  id uuid primary key default gen_random_uuid(),
  number text unique not null,
  title text,
  company_id uuid references public.companies (id),
  buyer_id uuid references public.counterparties (id),
  supplier_id uuid references public.counterparties (id),
  status text default 'Draft',
  incoterm text,
  currency text default 'USD',
  purchase_amount numeric default 0,
  sale_amount numeric default 0,
  gross_profit numeric default 0,
  net_profit numeric default 0,
  departure_port text,
  destination_port text,
  etd date,
  eta date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.business_cases enable row level security;

create policy "Public read access"
  on public.business_cases
  for select
  to public
  using (true);
