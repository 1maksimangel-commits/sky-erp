-- Finance module: extend invoices/payments and add supporting ledgers

create table if not exists public.currencies (
  code text primary key,
  name text not null,
  symbol text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency text not null references public.currencies (code),
  quote_currency text not null references public.currencies (code),
  rate numeric not null check (rate > 0),
  rate_date date not null default current_date,
  source text,
  created_at timestamptz default now(),
  unique (base_currency, quote_currency, rate_date)
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  account_type text not null check (
    account_type in ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense')
  ),
  currency text references public.currencies (code),
  company_id uuid references public.companies (id) on delete set null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  bank_name text,
  account_number text,
  iban text,
  swift text,
  currency text not null default 'USD' references public.currencies (code),
  opening_balance numeric not null default 0,
  current_balance numeric not null default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references public.bank_accounts (id) on delete cascade,
  transaction_date date not null default current_date,
  description text,
  reference text,
  amount numeric not null,
  currency text not null default 'USD' references public.currencies (code),
  transaction_type text not null check (
    transaction_type in ('credit', 'debit', 'transfer', 'fee')
  ),
  payment_id uuid,
  expense_id uuid,
  created_at timestamptz default now()
);

-- Extend existing invoices (additive only)
alter table public.invoices
  add column if not exists business_case_id uuid references public.business_cases (id) on delete set null;

alter table public.invoices
  add column if not exists company_id uuid references public.companies (id) on delete set null;

alter table public.invoices
  add column if not exists buyer_id uuid references public.counterparties (id) on delete set null;

alter table public.invoices
  add column if not exists supplier_id uuid references public.counterparties (id) on delete set null;

alter table public.invoices
  add column if not exists invoice_type text default 'Sales Invoice';

alter table public.invoices
  add column if not exists issue_date date default current_date;

alter table public.invoices
  add column if not exists tax_amount numeric default 0;

alter table public.invoices
  add column if not exists tax_rate numeric default 0;

alter table public.invoices
  add column if not exists subtotal numeric default 0;

alter table public.invoices
  add column if not exists notes text;

alter table public.invoices
  add column if not exists payment_terms text;

alter table public.invoices
  add column if not exists shipment_id uuid references public.shipments (id) on delete set null;

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  description text not null,
  quantity numeric not null default 1 check (quantity > 0),
  unit_price numeric not null default 0,
  tax_rate numeric not null default 0,
  line_total numeric not null default 0,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Extend existing payments (additive only)
alter table public.payments
  add column if not exists invoice_id uuid references public.invoices (id) on delete set null;

alter table public.payments
  add column if not exists contract_id uuid references public.contracts (id) on delete set null;

alter table public.payments
  add column if not exists bank_account_id uuid references public.bank_accounts (id) on delete set null;

alter table public.payments
  add column if not exists reference text;

alter table public.payments
  add column if not exists company_id uuid references public.companies (id) on delete set null;

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount numeric not null check (amount > 0),
  created_at timestamptz default now()
);

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete set null,
  category_id uuid references public.expense_categories (id) on delete set null,
  supplier_id uuid references public.counterparties (id) on delete set null,
  business_case_id uuid references public.business_cases (id) on delete set null,
  contract_id uuid references public.contracts (id) on delete set null,
  bank_account_id uuid references public.bank_accounts (id) on delete set null,
  expense_date date not null default current_date,
  description text,
  amount numeric not null check (amount >= 0),
  currency text not null default 'USD' references public.currencies (code),
  status text not null default 'Posted',
  reference text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Optional FKs for bank_transactions after payments/expenses exist
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bank_transactions_payment_id_fkey'
  ) then
    alter table public.bank_transactions
      add constraint bank_transactions_payment_id_fkey
      foreign key (payment_id) references public.payments (id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'bank_transactions_expense_id_fkey'
  ) then
    alter table public.bank_transactions
      add constraint bank_transactions_expense_id_fkey
      foreign key (expense_id) references public.expenses (id) on delete set null;
  end if;
end $$;

create index if not exists invoices_contract_id_idx on public.invoices (contract_id);
create index if not exists invoices_business_case_id_idx on public.invoices (business_case_id);
create index if not exists invoices_status_idx on public.invoices (status);
create index if not exists invoices_due_date_idx on public.invoices (due_date);
create index if not exists invoice_items_invoice_id_idx on public.invoice_items (invoice_id);
create index if not exists payments_invoice_id_idx on public.payments (invoice_id);
create index if not exists payments_contract_id_idx on public.payments (contract_id);
create index if not exists payment_allocations_payment_id_idx on public.payment_allocations (payment_id);
create index if not exists payment_allocations_invoice_id_idx on public.payment_allocations (invoice_id);
create index if not exists bank_accounts_company_id_idx on public.bank_accounts (company_id);
create index if not exists bank_transactions_bank_account_id_idx on public.bank_transactions (bank_account_id);
create index if not exists expenses_company_id_idx on public.expenses (company_id);
create index if not exists exchange_rates_rate_date_idx on public.exchange_rates (rate_date desc);

-- Recalculate invoice paid/outstanding/status from allocations + direct payments
create or replace function public.refresh_invoice_balances(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric;
  v_paid numeric;
  v_status text;
  v_due date;
begin
  select coalesce(amount, 0), due_date, status
  into v_amount, v_due, v_status
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    return;
  end if;

  if v_status = 'Cancelled' then
    update public.invoices
    set outstanding = 0, updated_at = now()
    where id = p_invoice_id;
    return;
  end if;

  select coalesce(sum(amount), 0) into v_paid
  from (
    select amount from public.payment_allocations where invoice_id = p_invoice_id
    union all
    select amount from public.payments
    where invoice_id = p_invoice_id
      and id not in (select payment_id from public.payment_allocations)
      and coalesce(status, '') <> 'Cancelled'
  ) paid_rows;

  v_paid := least(greatest(v_paid, 0), v_amount);

  update public.invoices
  set
    paid_amount = v_paid,
    outstanding = greatest(v_amount - v_paid, 0),
    status = case
      when v_status = 'Draft' and v_paid = 0 then 'Draft'
      when v_paid <= 0 and v_due is not null and v_due < current_date then 'Overdue'
      when v_paid <= 0 then coalesce(nullif(v_status, 'Paid'), 'Issued')
      when v_paid < v_amount then 'Partially Paid'
      else 'Paid'
    end,
    updated_at = now()
  where id = p_invoice_id;
end;
$$;

create or replace function public.finance_register_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_currency text,
  p_payment_date date default current_date,
  p_bank_account_id uuid default null,
  p_reference text default null,
  p_notes text default null,
  p_status text default 'Paid'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices;
  v_payment_id uuid;
  v_contract public.contracts;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;

  select * into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'Invoice not found.';
  end if;

  if v_invoice.status = 'Cancelled' then
    raise exception 'Cannot pay a cancelled invoice.';
  end if;

  if p_amount > coalesce(v_invoice.outstanding, v_invoice.amount, 0) + 0.0001 then
    raise exception 'Payment exceeds outstanding balance (%).', coalesce(v_invoice.outstanding, 0);
  end if;

  if v_invoice.contract_id is not null then
    select * into v_contract from public.contracts where id = v_invoice.contract_id;
  end if;

  insert into public.payments (
    invoice_id,
    contract_id,
    business_case_id,
    company_id,
    bank_account_id,
    amount,
    currency,
    status,
    payment_date,
    reference,
    notes
  )
  values (
    p_invoice_id,
    v_invoice.contract_id,
    v_invoice.business_case_id,
    v_invoice.company_id,
    p_bank_account_id,
    p_amount,
    coalesce(nullif(btrim(p_currency), ''), v_invoice.currency, 'USD'),
    coalesce(nullif(btrim(p_status), ''), 'Paid'),
    coalesce(p_payment_date, current_date),
    p_reference,
    p_notes
  )
  returning id into v_payment_id;

  insert into public.payment_allocations (payment_id, invoice_id, amount)
  values (v_payment_id, p_invoice_id, p_amount);

  if p_bank_account_id is not null then
    insert into public.bank_transactions (
      bank_account_id,
      transaction_date,
      description,
      reference,
      amount,
      currency,
      transaction_type,
      payment_id
    )
    values (
      p_bank_account_id,
      coalesce(p_payment_date, current_date),
      'Payment ' || v_invoice.invoice_number,
      p_reference,
      case
        when coalesce(v_invoice.invoice_type, 'Sales Invoice') in ('Purchase Invoice')
          then -abs(p_amount)
        else abs(p_amount)
      end,
      coalesce(nullif(btrim(p_currency), ''), v_invoice.currency, 'USD'),
      case
        when coalesce(v_invoice.invoice_type, 'Sales Invoice') in ('Purchase Invoice')
          then 'debit'
        else 'credit'
      end,
      v_payment_id
    );

    update public.bank_accounts
    set
      current_balance = current_balance + case
        when coalesce(v_invoice.invoice_type, 'Sales Invoice') in ('Purchase Invoice')
          then -abs(p_amount)
        else abs(p_amount)
      end,
      updated_at = now()
    where id = p_bank_account_id;
  end if;

  perform public.refresh_invoice_balances(p_invoice_id);

  return v_payment_id;
end;
$$;

grant execute on function public.refresh_invoice_balances(uuid) to anon, authenticated, service_role;
grant execute on function public.finance_register_payment(
  uuid, numeric, text, date, uuid, text, text, text
) to anon, authenticated, service_role;

-- Seeds
insert into public.currencies (code, name, symbol) values
  ('USD', 'US Dollar', '$'),
  ('EUR', 'Euro', '€'),
  ('RUB', 'Russian Ruble', '₽'),
  ('CNY', 'Chinese Yuan', '¥'),
  ('JPY', 'Japanese Yen', '¥'),
  ('KRW', 'Korean Won', '₩'),
  ('AED', 'UAE Dirham', 'د.إ')
on conflict (code) do nothing;

insert into public.exchange_rates (base_currency, quote_currency, rate, rate_date, source)
values
  ('USD', 'EUR', 0.92, current_date, 'seed'),
  ('USD', 'RUB', 92.50, current_date, 'seed'),
  ('USD', 'CNY', 7.25, current_date, 'seed'),
  ('USD', 'JPY', 149.80, current_date, 'seed'),
  ('USD', 'KRW', 1380.00, current_date, 'seed'),
  ('USD', 'AED', 3.6725, current_date, 'seed'),
  ('USD', 'USD', 1, current_date, 'seed')
on conflict (base_currency, quote_currency, rate_date) do nothing;

insert into public.accounts (code, name, account_type, currency)
values
  ('1000', 'Cash', 'Asset', 'USD'),
  ('1100', 'Accounts Receivable', 'Asset', 'USD'),
  ('2000', 'Accounts Payable', 'Liability', 'USD'),
  ('4000', 'Sales Revenue', 'Revenue', 'USD'),
  ('5000', 'Cost of Goods Sold', 'Expense', 'USD'),
  ('5100', 'Operating Expenses', 'Expense', 'USD')
on conflict (code) do nothing;

insert into public.expense_categories (code, name)
values
  ('FREIGHT', 'Freight & Logistics'),
  ('DUTY', 'Customs & Duty'),
  ('STORAGE', 'Cold Storage'),
  ('INSURANCE', 'Cargo Insurance'),
  ('BANK', 'Bank Charges'),
  ('OTHER', 'Other Expenses')
on conflict (code) do nothing;

-- Seed bank accounts for known companies when present
insert into public.bank_accounts (company_id, name, bank_name, currency, opening_balance, current_balance)
select c.id, c.name || ' USD Operating', 'Primary Bank', 'USD', 0, 0
from public.companies c
where c.is_active = true
  and not exists (
    select 1 from public.bank_accounts b where b.company_id = c.id and b.currency = 'USD'
  );

alter table public.currencies enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.accounts enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.bank_transactions enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'currencies',
    'exchange_rates',
    'accounts',
    'bank_accounts',
    'bank_transactions',
    'invoice_items',
    'payment_allocations',
    'expense_categories',
    'expenses'
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
end $$;

-- Ensure payments table has write policies (may already exist)
drop policy if exists "Public read payments" on public.payments;
create policy "Public read payments"
  on public.payments for select to public using (true);
drop policy if exists "Public insert payments" on public.payments;
create policy "Public insert payments"
  on public.payments for insert to public with check (true);
drop policy if exists "Public update payments" on public.payments;
create policy "Public update payments"
  on public.payments for update to public using (true);
drop policy if exists "Public delete payments" on public.payments;
create policy "Public delete payments"
  on public.payments for delete to public using (true);

alter table public.payments enable row level security;

notify pgrst, 'reload schema';
