-- SKY ERP CRM module: customers, contacts, notes, communications, tasks

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
create table if not exists public.crm_customers (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_person text null,
  country text null,
  city text null,
  address text null,
  phone text null,
  email text null,
  wechat text null,
  category text not null default 'Customer'
    check (category in ('Customer', 'Prospect', 'Supplier', 'Partner', 'Other')),
  manager text null,
  status text not null default 'Active'
    check (status in ('Active', 'Inactive', 'Prospect', 'Archived')),
  last_contact_at timestamptz null,
  next_follow_up_at timestamptz null,
  website text null,
  tax_id text null,
  notes_summary text null,
  counterparty_id uuid null references public.counterparties (id) on delete set null,
  company_id uuid null references public.companies (id) on delete set null,
  archived_at timestamptz null,
  created_by uuid null references auth.users (id) on delete set null,
  updated_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_customers_company_name_idx
  on public.crm_customers (company_name);
create index if not exists crm_customers_category_idx
  on public.crm_customers (category);
create index if not exists crm_customers_status_idx
  on public.crm_customers (status);
create index if not exists crm_customers_manager_idx
  on public.crm_customers (manager);
create index if not exists crm_customers_next_follow_up_idx
  on public.crm_customers (next_follow_up_at);
create index if not exists crm_customers_last_contact_idx
  on public.crm_customers (last_contact_at desc);
create index if not exists crm_customers_counterparty_id_idx
  on public.crm_customers (counterparty_id);

-- ---------------------------------------------------------------------------
-- Contacts
-- ---------------------------------------------------------------------------
create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.crm_customers (id) on delete cascade,
  full_name text not null,
  title text null,
  phone text null,
  email text null,
  wechat text null,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_contacts_customer_id_idx
  on public.crm_contacts (customer_id);

-- ---------------------------------------------------------------------------
-- Notes
-- ---------------------------------------------------------------------------
create table if not exists public.crm_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.crm_customers (id) on delete cascade,
  body text not null,
  created_by_name text null,
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_notes_customer_id_idx
  on public.crm_notes (customer_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Communication history
-- ---------------------------------------------------------------------------
create table if not exists public.crm_communications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.crm_customers (id) on delete cascade,
  channel text not null default 'Email'
    check (channel in ('Email', 'Phone', 'WeChat', 'Meeting', 'Other')),
  subject text null,
  body text null,
  direction text not null default 'Outbound'
    check (direction in ('Inbound', 'Outbound')),
  contacted_at timestamptz not null default now(),
  created_by_name text null,
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists crm_communications_customer_id_idx
  on public.crm_communications (customer_id, contacted_at desc);

-- ---------------------------------------------------------------------------
-- Tasks / follow-ups
-- ---------------------------------------------------------------------------
create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.crm_customers (id) on delete cascade,
  title text not null,
  description text null,
  due_at timestamptz null,
  status text not null default 'Open'
    check (status in ('Open', 'Done', 'Cancelled')),
  assignee text null,
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null
);

create index if not exists crm_tasks_customer_id_idx
  on public.crm_tasks (customer_id, due_at);
create index if not exists crm_tasks_status_due_idx
  on public.crm_tasks (status, due_at);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists crm_customers_set_updated_at on public.crm_customers;
create trigger crm_customers_set_updated_at
before update on public.crm_customers
for each row execute function public.set_updated_at();

drop trigger if exists crm_contacts_set_updated_at on public.crm_contacts;
create trigger crm_contacts_set_updated_at
before update on public.crm_contacts
for each row execute function public.set_updated_at();

drop trigger if exists crm_notes_set_updated_at on public.crm_notes;
create trigger crm_notes_set_updated_at
before update on public.crm_notes
for each row execute function public.set_updated_at();

drop trigger if exists crm_tasks_set_updated_at on public.crm_tasks;
create trigger crm_tasks_set_updated_at
before update on public.crm_tasks
for each row execute function public.set_updated_at();

-- Keep customer last_contact_at in sync when a communication is logged
create or replace function public.crm_sync_last_contact()
returns trigger
language plpgsql
as $$
begin
  update public.crm_customers
  set
    last_contact_at = greatest(
      coalesce(last_contact_at, 'epoch'::timestamptz),
      new.contacted_at
    ),
    updated_at = now()
  where id = new.customer_id;
  return new;
end;
$$;

drop trigger if exists crm_communications_sync_last_contact on public.crm_communications;
create trigger crm_communications_sync_last_contact
after insert on public.crm_communications
for each row execute function public.crm_sync_last_contact();

-- Sync next_follow_up_at from earliest open task due date
create or replace function public.crm_sync_next_follow_up()
returns trigger
language plpgsql
as $$
declare
  target uuid;
  next_due timestamptz;
begin
  target := coalesce(new.customer_id, old.customer_id);
  select min(due_at)
  into next_due
  from public.crm_tasks
  where customer_id = target
    and status = 'Open'
    and due_at is not null;

  update public.crm_customers
  set next_follow_up_at = next_due, updated_at = now()
  where id = target;

  return coalesce(new, old);
end;
$$;

drop trigger if exists crm_tasks_sync_follow_up on public.crm_tasks;
create trigger crm_tasks_sync_follow_up
after insert or update or delete on public.crm_tasks
for each row execute function public.crm_sync_next_follow_up();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.crm_customers enable row level security;
alter table public.crm_contacts enable row level security;
alter table public.crm_notes enable row level security;
alter table public.crm_communications enable row level security;
alter table public.crm_tasks enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'crm_customers',
    'crm_contacts',
    'crm_notes',
    'crm_communications',
    'crm_tasks'
  ]
  loop
    execute format('drop policy if exists "Public select %1$s" on public.%1$I', t);
    execute format(
      'create policy "Public select %1$s" on public.%1$I for select to public using (true)',
      t
    );
    execute format('drop policy if exists "Public insert %1$s" on public.%1$I', t);
    execute format(
      'create policy "Public insert %1$s" on public.%1$I for insert to public with check (true)',
      t
    );
    execute format('drop policy if exists "Public update %1$s" on public.%1$I', t);
    execute format(
      'create policy "Public update %1$s" on public.%1$I for update to public using (true) with check (true)',
      t
    );
    execute format('drop policy if exists "Public delete %1$s" on public.%1$I', t);
    execute format(
      'create policy "Public delete %1$s" on public.%1$I for delete to public using (true)',
      t
    );
  end loop;
end;
$$;
