-- Platform integration: master links, global docs, timeline, activity, notifications, roles
-- Idempotent and additive only. Safe to rerun. Does not DROP or recreate tables.

-- =============================================================================
-- Master FK: Contract → Business Case
-- =============================================================================
alter table public.contracts
  add column if not exists business_case_id uuid references public.business_cases (id) on delete set null;

create index if not exists contracts_business_case_id_idx
  on public.contracts (business_case_id);

-- Backfill contract → business case from matching contract_number
update public.contracts c
set business_case_id = bc.id
from public.business_cases bc
where c.business_case_id is null
  and bc.contract_number is not null
  and bc.contract_number = c.contract_number;

-- =============================================================================
-- documents
-- Existing live table may only have BC-scoped columns. CREATE TABLE IF NOT EXISTS
-- is a no-op when present, so every required column is added via ALTER below.
-- =============================================================================
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  business_case_id uuid references public.business_cases (id) on delete set null,
  title text,
  document_type text,
  storage_path text,
  mime_type text,
  uploaded_at timestamptz default now()
);

alter table public.documents
  add column if not exists business_case_id uuid references public.business_cases (id) on delete set null;

alter table public.documents
  add column if not exists title text;

alter table public.documents
  add column if not exists document_type text;

alter table public.documents
  add column if not exists storage_path text;

alter table public.documents
  add column if not exists mime_type text;

alter table public.documents
  add column if not exists uploaded_at timestamptz default now();

-- uploaded_by stores auth.users.id — must remain uuid (never text / never 'system')
alter table public.documents
  add column if not exists uploaded_by uuid;

alter table public.documents
  add column if not exists file_name text;

alter table public.documents
  add column if not exists file_size bigint;

alter table public.documents
  add column if not exists entity_type text;

alter table public.documents
  add column if not exists entity_id uuid;

alter table public.documents
  add column if not exists contract_id uuid references public.contracts (id) on delete set null;

alter table public.documents
  add column if not exists shipment_id uuid references public.shipments (id) on delete set null;

alter table public.documents
  add column if not exists invoice_id uuid references public.invoices (id) on delete set null;

alter table public.documents
  add column if not exists created_by text;

alter table public.documents
  add column if not exists user_id uuid;

-- Backfill polymorphic link from business_case_id when missing
update public.documents
set entity_type = 'business_case',
    entity_id = business_case_id
where entity_type is null
  and business_case_id is not null;

create index if not exists documents_entity_idx
  on public.documents (entity_type, entity_id);

create index if not exists documents_business_case_id_idx
  on public.documents (business_case_id);

create index if not exists documents_contract_id_idx
  on public.documents (contract_id);

create index if not exists documents_shipment_id_idx
  on public.documents (shipment_id);

create index if not exists documents_invoice_id_idx
  on public.documents (invoice_id);

-- =============================================================================
-- activity_log
-- =============================================================================
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);

alter table public.activity_log
  add column if not exists entity_type text;

alter table public.activity_log
  add column if not exists entity_id uuid;

alter table public.activity_log
  add column if not exists action text;

alter table public.activity_log
  add column if not exists summary text;

alter table public.activity_log
  add column if not exists actor text;

alter table public.activity_log
  add column if not exists old_value jsonb;

alter table public.activity_log
  add column if not exists new_value jsonb;

alter table public.activity_log
  add column if not exists metadata jsonb;

alter table public.activity_log
  add column if not exists created_at timestamptz default now();

alter table public.activity_log
  add column if not exists created_by text;

alter table public.activity_log
  add column if not exists user_id uuid;

update public.activity_log
set action = coalesce(action, 'updated'),
    summary = coalesce(summary, 'Activity recorded'),
    entity_type = coalesce(entity_type, 'unknown'),
    entity_id = coalesce(entity_id, '00000000-0000-0000-0000-000000000000'::uuid)
where action is null
   or summary is null
   or entity_type is null
   or entity_id is null;

create index if not exists activity_log_entity_idx
  on public.activity_log (entity_type, entity_id, created_at desc);

create index if not exists activity_log_created_at_idx
  on public.activity_log (created_at desc);

-- =============================================================================
-- timeline_events
-- =============================================================================
create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);

alter table public.timeline_events
  add column if not exists entity_type text;

alter table public.timeline_events
  add column if not exists entity_id uuid;

alter table public.timeline_events
  add column if not exists event_type text;

alter table public.timeline_events
  add column if not exists title text;

alter table public.timeline_events
  add column if not exists description text;

alter table public.timeline_events
  add column if not exists event_date timestamptz default now();

alter table public.timeline_events
  add column if not exists related_entity_type text;

alter table public.timeline_events
  add column if not exists related_entity_id uuid;

alter table public.timeline_events
  add column if not exists created_at timestamptz default now();

alter table public.timeline_events
  add column if not exists created_by text;

alter table public.timeline_events
  add column if not exists user_id uuid;

update public.timeline_events
set event_type = coalesce(event_type, 'event'),
    title = coalesce(title, 'Timeline event'),
    entity_type = coalesce(entity_type, 'unknown'),
    entity_id = coalesce(entity_id, '00000000-0000-0000-0000-000000000000'::uuid),
    event_date = coalesce(event_date, created_at, now())
where event_type is null
   or title is null
   or entity_type is null
   or entity_id is null
   or event_date is null;

create index if not exists timeline_events_entity_idx
  on public.timeline_events (entity_type, entity_id, event_date desc);

create index if not exists timeline_events_event_date_idx
  on public.timeline_events (event_date desc);

-- =============================================================================
-- notifications
-- =============================================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);

alter table public.notifications
  add column if not exists title text;

alter table public.notifications
  add column if not exists body text;

alter table public.notifications
  add column if not exists category text default 'general';

alter table public.notifications
  add column if not exists notification_type text;

alter table public.notifications
  add column if not exists severity text default 'info';

alter table public.notifications
  add column if not exists entity_type text;

alter table public.notifications
  add column if not exists entity_id uuid;

alter table public.notifications
  add column if not exists href text;

alter table public.notifications
  add column if not exists is_read boolean default false;

alter table public.notifications
  add column if not exists created_at timestamptz default now();

alter table public.notifications
  add column if not exists created_by text;

alter table public.notifications
  add column if not exists user_id uuid;

update public.notifications
set title = coalesce(title, 'Notification'),
    category = coalesce(category, notification_type, 'general'),
    notification_type = coalesce(notification_type, category, 'general'),
    severity = coalesce(severity, 'info'),
    is_read = coalesce(is_read, false)
where title is null
   or category is null
   or notification_type is null
   or severity is null
   or is_read is null;

create index if not exists notifications_created_at_idx
  on public.notifications (created_at desc);

create index if not exists notifications_is_read_idx
  on public.notifications (is_read, created_at desc);

create index if not exists notifications_entity_idx
  on public.notifications (entity_type, entity_id);

-- =============================================================================
-- roles & user_profiles
-- =============================================================================
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);

alter table public.roles
  add column if not exists code text;

alter table public.roles
  add column if not exists name text;

alter table public.roles
  add column if not exists permissions jsonb default '[]'::jsonb;

alter table public.roles
  add column if not exists created_at timestamptz default now();

update public.roles
set code = coalesce(code, id::text),
    name = coalesce(name, code, 'Role'),
    permissions = coalesce(permissions, '[]'::jsonb)
where code is null
   or name is null
   or permissions is null;

create unique index if not exists roles_code_uidx
  on public.roles (code);

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);

alter table public.user_profiles
  add column if not exists email text;

alter table public.user_profiles
  add column if not exists full_name text;

alter table public.user_profiles
  add column if not exists role_code text;

alter table public.user_profiles
  add column if not exists user_id uuid;

alter table public.user_profiles
  add column if not exists is_active boolean default true;

alter table public.user_profiles
  add column if not exists created_at timestamptz default now();

alter table public.user_profiles
  add column if not exists updated_at timestamptz default now();

alter table public.user_profiles
  add column if not exists created_by text;

create unique index if not exists user_profiles_email_uidx
  on public.user_profiles (email);

-- Seed roles (requires unique code)
insert into public.roles (code, name, permissions) values
  ('admin', 'Admin', '["*"]'::jsonb),
  ('finance', 'Finance', '["finance.*","documents.read","contracts.read","business_cases.read"]'::jsonb),
  ('sales', 'Sales', '["business_cases.*","contracts.*","counterparties.*","products.read","documents.*"]'::jsonb),
  ('logistics', 'Logistics', '["logistics.*","contracts.read","warehouse.read","documents.*"]'::jsonb),
  ('warehouse', 'Warehouse', '["warehouse.*","products.read","logistics.read","documents.read"]'::jsonb),
  ('management', 'Management', '["*.read","dashboard.*","reports.*"]'::jsonb),
  ('readonly', 'Read-only', '["*.read"]'::jsonb)
on conflict (code) do nothing;

insert into public.user_profiles (email, full_name, role_code)
values ('admin@sky-erp.local', 'SKY Admin', 'admin')
on conflict (email) do nothing;

-- =============================================================================
-- Helper RPCs
-- =============================================================================
create or replace function public.log_activity(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_summary text,
  p_actor text default null,
  p_old_value jsonb default null,
  p_new_value jsonb default null,
  p_metadata jsonb default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.activity_log (
    entity_type, entity_id, action, summary, actor, old_value, new_value, metadata
  )
  values (
    p_entity_type, p_entity_id, p_action, p_summary, p_actor, p_old_value, p_new_value, p_metadata
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.add_timeline_event(
  p_entity_type text,
  p_entity_id uuid,
  p_event_type text,
  p_title text,
  p_description text default null,
  p_event_date timestamptz default now(),
  p_related_entity_type text default null,
  p_related_entity_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.timeline_events (
    entity_type, entity_id, event_type, title, description, event_date,
    related_entity_type, related_entity_id
  )
  values (
    p_entity_type, p_entity_id, p_event_type, p_title, p_description, coalesce(p_event_date, now()),
    p_related_entity_type, p_related_entity_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.create_notification(
  p_title text,
  p_body text default null,
  p_category text default 'general',
  p_severity text default 'info',
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_href text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.notifications (
    title, body, category, notification_type, severity, entity_type, entity_id, href, is_read
  )
  values (
    p_title,
    p_body,
    coalesce(p_category, 'general'),
    coalesce(p_category, 'general'),
    coalesce(p_severity, 'info'),
    p_entity_type,
    p_entity_id,
    p_href,
    false
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.log_activity(text, uuid, text, text, text, jsonb, jsonb, jsonb) to anon, authenticated, service_role;
grant execute on function public.add_timeline_event(text, uuid, text, text, text, timestamptz, text, uuid) to anon, authenticated, service_role;
grant execute on function public.create_notification(text, text, text, text, text, uuid, text) to anon, authenticated, service_role;

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.documents enable row level security;
alter table public.activity_log enable row level security;
alter table public.timeline_events enable row level security;
alter table public.notifications enable row level security;
alter table public.roles enable row level security;
alter table public.user_profiles enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'documents',
    'activity_log',
    'timeline_events',
    'notifications',
    'roles',
    'user_profiles'
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

-- =============================================================================
-- Storage bucket for document files (idempotent)
-- Live probe previously returned: Bucket not found / NoSuchBucket
-- =============================================================================
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

drop policy if exists "Public update documents bucket" on storage.objects;
create policy "Public update documents bucket"
  on storage.objects for update to public
  using (bucket_id = 'documents')
  with check (bucket_id = 'documents');

drop policy if exists "Public delete documents bucket" on storage.objects;
create policy "Public delete documents bucket"
  on storage.objects for delete to public
  using (bucket_id = 'documents');

notify pgrst, 'reload schema';
