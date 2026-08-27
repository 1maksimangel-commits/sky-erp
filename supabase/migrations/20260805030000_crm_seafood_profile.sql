-- Expand CRM into a seafood trading customer profile
-- Company / Contacts / Business / Timeline / Attachments / Notes

-- ---------------------------------------------------------------------------
-- Customers: company + business fields
-- ---------------------------------------------------------------------------
alter table public.crm_customers
  add column if not exists legal_name text,
  add column if not exists short_name text,
  add column if not exists customer_type text,
  add column if not exists interested_products text,
  add column if not exists markets text,
  add column if not exists annual_volume text,
  add column if not exists preferred_incoterms text,
  add column if not exists preferred_currency text,
  add column if not exists preferred_payment_terms text;

-- Backfill legal_name from company_name
update public.crm_customers
set legal_name = company_name
where legal_name is null
  and company_name is not null;

-- Keep company_name in sync for list views (trigger)
create or replace function public.crm_sync_company_name()
returns trigger
language plpgsql
as $$
begin
  if new.legal_name is not null and btrim(new.legal_name) <> '' then
    new.company_name := btrim(new.legal_name);
  end if;
  if new.legal_name is null or btrim(coalesce(new.legal_name, '')) = '' then
    new.legal_name := new.company_name;
  end if;
  return new;
end;
$$;

drop trigger if exists crm_customers_sync_company_name on public.crm_customers;
create trigger crm_customers_sync_company_name
before insert or update on public.crm_customers
for each row execute function public.crm_sync_company_name();

create index if not exists crm_customers_legal_name_idx
  on public.crm_customers (legal_name);
create index if not exists crm_customers_customer_type_idx
  on public.crm_customers (customer_type);

-- ---------------------------------------------------------------------------
-- Contacts: seafood trading contact card
-- ---------------------------------------------------------------------------
alter table public.crm_contacts
  add column if not exists position text,
  add column if not exists mobile text,
  add column if not exists office_phone text,
  add column if not exists whatsapp text,
  add column if not exists telegram text,
  add column if not exists language text,
  add column if not exists birthday date;

-- Backfill from legacy columns
update public.crm_contacts
set
  position = coalesce(position, title),
  mobile = coalesce(mobile, phone)
where position is null
   or mobile is null;

-- ---------------------------------------------------------------------------
-- Notes: rich text support
-- ---------------------------------------------------------------------------
alter table public.crm_notes
  add column if not exists body_html text,
  add column if not exists is_rich_text boolean not null default false;

update public.crm_notes
set body_html = coalesce(body_html, body)
where body_html is null;

-- ---------------------------------------------------------------------------
-- Timeline activity feed
-- ---------------------------------------------------------------------------
create table if not exists public.crm_timeline_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.crm_customers (id) on delete cascade,
  event_type text not null
    check (event_type in (
      'Call', 'Meeting', 'Email', 'Quote', 'Contract', 'Shipment', 'Payment', 'Note'
    )),
  title text not null,
  description text null,
  event_at timestamptz not null default now(),
  related_entity_type text null,
  related_entity_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_by_name text null,
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists crm_timeline_customer_event_idx
  on public.crm_timeline_events (customer_id, event_at desc);
create index if not exists crm_timeline_event_type_idx
  on public.crm_timeline_events (event_type);

alter table public.crm_timeline_events enable row level security;

drop policy if exists "Public select crm_timeline_events" on public.crm_timeline_events;
create policy "Public select crm_timeline_events"
  on public.crm_timeline_events for select to public using (true);

drop policy if exists "Public insert crm_timeline_events" on public.crm_timeline_events;
create policy "Public insert crm_timeline_events"
  on public.crm_timeline_events for insert to public with check (true);

drop policy if exists "Public update crm_timeline_events" on public.crm_timeline_events;
create policy "Public update crm_timeline_events"
  on public.crm_timeline_events for update to public using (true) with check (true);

drop policy if exists "Public delete crm_timeline_events" on public.crm_timeline_events;
create policy "Public delete crm_timeline_events"
  on public.crm_timeline_events for delete to public using (true);

-- Auto timeline from notes
create or replace function public.crm_note_timeline()
returns trigger
language plpgsql
as $$
begin
  insert into public.crm_timeline_events (
    customer_id, event_type, title, description, event_at, created_by_name, created_by
  ) values (
    new.customer_id,
    'Note',
    'Note added',
    left(regexp_replace(coalesce(new.body, ''), '<[^>]+>', '', 'g'), 280),
    coalesce(new.created_at, now()),
    new.created_by_name,
    new.created_by
  );
  return new;
end;
$$;

drop trigger if exists crm_notes_timeline on public.crm_notes;
create trigger crm_notes_timeline
after insert on public.crm_notes
for each row execute function public.crm_note_timeline();

-- Auto timeline from communications
create or replace function public.crm_communication_timeline()
returns trigger
language plpgsql
as $$
declare
  mapped text;
begin
  mapped := case
    when lower(new.channel) in ('phone', 'call') then 'Call'
    when lower(new.channel) = 'meeting' then 'Meeting'
    when lower(new.channel) = 'email' then 'Email'
    else 'Email'
  end;

  insert into public.crm_timeline_events (
    customer_id, event_type, title, description, event_at, created_by_name, created_by
  ) values (
    new.customer_id,
    mapped,
    coalesce(nullif(btrim(new.subject), ''), new.channel || ' · ' || new.direction),
    left(coalesce(new.body, ''), 280),
    coalesce(new.contacted_at, now()),
    new.created_by_name,
    new.created_by
  );
  return new;
end;
$$;

drop trigger if exists crm_communications_timeline on public.crm_communications;
create trigger crm_communications_timeline
after insert on public.crm_communications
for each row execute function public.crm_communication_timeline();

-- ---------------------------------------------------------------------------
-- Attachments (CRM-native files; also supports DMS entity_type = crm_customer)
-- ---------------------------------------------------------------------------
create table if not exists public.crm_attachments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.crm_customers (id) on delete cascade,
  title text null,
  file_name text not null,
  file_path text not null,
  mime_type text null,
  file_size bigint null,
  uploaded_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists crm_attachments_customer_id_idx
  on public.crm_attachments (customer_id, created_at desc);

alter table public.crm_attachments enable row level security;

drop policy if exists "Public select crm_attachments" on public.crm_attachments;
create policy "Public select crm_attachments"
  on public.crm_attachments for select to public using (true);

drop policy if exists "Public insert crm_attachments" on public.crm_attachments;
create policy "Public insert crm_attachments"
  on public.crm_attachments for insert to public with check (true);

drop policy if exists "Public update crm_attachments" on public.crm_attachments;
create policy "Public update crm_attachments"
  on public.crm_attachments for update to public using (true) with check (true);

drop policy if exists "Public delete crm_attachments" on public.crm_attachments;
create policy "Public delete crm_attachments"
  on public.crm_attachments for delete to public using (true);
