-- Sprint 1: canonical Deal Engine.
--
-- Compatibility decision: public.business_cases remains the canonical Deal table.
-- This migration is additive, preserves all existing records, and does not add
-- permissive RLS policies. Apply only after reviewing the target schema and
-- adding approved company-scoped policies for the new child tables.

alter table public.business_cases
  add column if not exists case_number text,
  add column if not exists case_type text,
  add column if not exists contract_number text,
  add column if not exists contract_date date,
  add column if not exists contract_amount numeric,
  add column if not exists incoterms text,
  add column if not exists consignee_id uuid references public.counterparties (id) on delete set null,
  add column if not exists loading_port text,
  add column if not exists destination_port text,
  add column if not exists payment_terms text,
  add column if not exists expected_shipment_date date,
  add column if not exists purchase_currency text,
  add column if not exists sales_currency text,
  add column if not exists purchase_value numeric,
  add column if not exists sales_value numeric,
  add column if not exists expected_expenses numeric default 0,
  add column if not exists expected_expenses_currency text,
  add column if not exists expected_commission numeric default 0,
  add column if not exists expected_commission_currency text,
  add column if not exists notes text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- Backfill only when legacy columns exist. Existing non-null canonical values win.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'business_cases' and column_name = 'number'
  ) then
    execute 'update public.business_cases set case_number = number where case_number is null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'business_cases' and column_name = 'incoterm'
  ) then
    execute 'update public.business_cases set incoterms = incoterm where incoterms is null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'business_cases' and column_name = 'departure_port'
  ) then
    execute 'update public.business_cases set loading_port = departure_port where loading_port is null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'business_cases' and column_name = 'eta'
  ) then
    execute 'update public.business_cases set expected_shipment_date = eta where expected_shipment_date is null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'business_cases' and column_name = 'purchase_amount'
  ) then
    execute 'update public.business_cases set purchase_value = purchase_amount where purchase_value is null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'business_cases' and column_name = 'sale_amount'
  ) then
    execute 'update public.business_cases set sales_value = sale_amount where sales_value is null';
  end if;
end
$$;

create unique index if not exists business_cases_case_number_key
  on public.business_cases (case_number)
  where case_number is not null;

create table if not exists public.deal_participants (
  id uuid primary key default gen_random_uuid(),
  business_case_id uuid not null references public.business_cases (id) on delete cascade,
  counterparty_id uuid not null references public.counterparties (id) on delete restrict,
  role_code text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deal_participants_role_code_check
    check (role_code ~ '^[a-z][a-z0-9_]*$'),
  constraint deal_participants_unique_role_party
    unique (business_case_id, counterparty_id, role_code)
);

create table if not exists public.deal_products (
  id uuid primary key default gen_random_uuid(),
  business_case_id uuid not null references public.business_cases (id) on delete cascade,
  product_id uuid references public.products (id) on delete restrict,
  product_description text,
  size_grade text,
  quantity numeric not null,
  unit text not null,
  net_weight numeric,
  gross_weight numeric,
  purchase_price numeric,
  sales_price numeric,
  purchase_currency text,
  sales_currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deal_products_quantity_positive check (quantity > 0),
  constraint deal_products_net_weight_nonnegative check (net_weight is null or net_weight >= 0),
  constraint deal_products_gross_weight_nonnegative check (gross_weight is null or gross_weight >= 0),
  constraint deal_products_purchase_price_nonnegative check (purchase_price is null or purchase_price >= 0),
  constraint deal_products_sales_price_nonnegative check (sales_price is null or sales_price >= 0)
);

-- Sprint 1 placeholder: stores one or more expected commission links/amounts.
-- The calculation method and settlement lifecycle belong to the later Commission Engine.
create table if not exists public.deal_commission_links (
  id uuid primary key default gen_random_uuid(),
  business_case_id uuid not null references public.business_cases (id) on delete cascade,
  beneficiary_id uuid references public.counterparties (id) on delete restrict,
  label text,
  expected_amount numeric not null default 0,
  currency text,
  commission_id uuid,
  created_at timestamptz not null default now(),
  constraint deal_commission_links_expected_nonnegative check (expected_amount >= 0)
);

alter table public.contracts
  add column if not exists deal_contract_role text,
  add column if not exists parent_contract_id uuid references public.contracts (id) on delete set null;

create index if not exists deal_participants_business_case_id_idx
  on public.deal_participants (business_case_id);
create index if not exists deal_products_business_case_id_idx
  on public.deal_products (business_case_id);
create index if not exists deal_commission_links_business_case_id_idx
  on public.deal_commission_links (business_case_id);
create index if not exists contracts_parent_contract_id_idx
  on public.contracts (parent_contract_id);

alter table public.deal_participants enable row level security;
alter table public.deal_products enable row level security;
alter table public.deal_commission_links enable row level security;

comment on table public.business_cases is
  'Canonical Deal entity. The business_cases name is retained for backward compatibility.';
comment on column public.contracts.deal_contract_role is
  'Deal relationship: purchase, sales, annex, amendment, or other.';
comment on column public.contracts.parent_contract_id is
  'Optional parent contract for an annex or amendment.';

create or replace function public.touch_canonical_deal_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'touch_canonical_deal_updated_at'
  ) then
    create trigger touch_canonical_deal_updated_at
    before update on public.business_cases
    for each row execute function public.touch_canonical_deal_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'touch_deal_participant_updated_at'
  ) then
    create trigger touch_deal_participant_updated_at
    before update on public.deal_participants
    for each row execute function public.touch_canonical_deal_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'touch_deal_product_updated_at'
  ) then
    create trigger touch_deal_product_updated_at
    before update on public.deal_products
    for each row execute function public.touch_canonical_deal_updated_at();
  end if;
end
$$;
