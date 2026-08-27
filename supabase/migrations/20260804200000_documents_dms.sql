-- Document Management System: align documents table + ensure storage bucket
-- Additive / idempotent. Does not drop or recreate tables.

-- =============================================================================
-- Required DMS columns (live DB already has many; add only what's missing)
-- =============================================================================
alter table public.documents
  add column if not exists entity_type text;

alter table public.documents
  add column if not exists entity_id uuid;

alter table public.documents
  add column if not exists document_type text;

alter table public.documents
  add column if not exists title text;

alter table public.documents
  add column if not exists file_name text;

-- Canonical storage key used by the app (keep storage_path for backward compat)
alter table public.documents
  add column if not exists file_path text;

alter table public.documents
  add column if not exists storage_path text;

alter table public.documents
  add column if not exists mime_type text;

alter table public.documents
  add column if not exists file_size bigint;

alter table public.documents
  add column if not exists version integer default 1;

alter table public.documents
  add column if not exists version_no integer default 1;

alter table public.documents
  add column if not exists tags text[] default '{}'::text[];

alter table public.documents
  add column if not exists notes text;

-- uploaded_by stores auth.users.id — must remain uuid (never text / never 'system')
alter table public.documents
  add column if not exists uploaded_by uuid;

alter table public.documents
  add column if not exists created_by text;

alter table public.documents
  add column if not exists uploaded_at timestamptz default now();

alter table public.documents
  add column if not exists created_at timestamptz default now();

alter table public.documents
  add column if not exists updated_at timestamptz default now();

-- Optional typed FKs for common entities (polymorphic entity_* remains source of truth)
alter table public.documents
  add column if not exists business_case_id uuid references public.business_cases (id) on delete set null;

alter table public.documents
  add column if not exists contract_id uuid references public.contracts (id) on delete set null;

alter table public.documents
  add column if not exists shipment_id uuid references public.shipments (id) on delete set null;

alter table public.documents
  add column if not exists invoice_id uuid references public.invoices (id) on delete set null;

alter table public.documents
  add column if not exists company_id uuid references public.companies (id) on delete set null;

alter table public.documents
  add column if not exists counterparty_id uuid references public.counterparties (id) on delete set null;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'payments'
  ) then
    alter table public.documents
      add column if not exists payment_id uuid references public.payments (id) on delete set null;
  else
    alter table public.documents
      add column if not exists payment_id uuid;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'products'
  ) then
    alter table public.documents
      add column if not exists product_id uuid references public.products (id) on delete set null;
  else
    alter table public.documents
      add column if not exists product_id uuid;
  end if;
end $$;

-- Backfill file_path ↔ storage_path
update public.documents
set file_path = storage_path
where file_path is null
  and storage_path is not null;

update public.documents
set storage_path = file_path
where storage_path is null
  and file_path is not null;

-- Backfill version ↔ version_no
update public.documents
set version = coalesce(version, version_no, 1)
where version is null;

update public.documents
set version_no = coalesce(version_no, version, 1)
where version_no is null;

-- Backfill timestamps
update public.documents
set created_at = coalesce(created_at, uploaded_at, now())
where created_at is null;

update public.documents
set updated_at = coalesce(updated_at, uploaded_at, created_at, now())
where updated_at is null;

update public.documents
set uploaded_at = coalesce(uploaded_at, created_at, now())
where uploaded_at is null;

-- Backfill uploaded_by from created_by only when types are compatible.
-- Never write text 'system' into uuid uploaded_by; leave NULL for anonymous/system rows.
do $$
declare
  uploaded_by_type text;
  created_by_type text;
begin
  select c.data_type
    into uploaded_by_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'documents'
    and c.column_name = 'uploaded_by';

  select c.data_type
    into created_by_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'documents'
    and c.column_name = 'created_by';

  if uploaded_by_type is distinct from 'uuid' then
    raise notice 'documents.uploaded_by is %, expected uuid — skipping uploaded_by backfill',
      coalesce(uploaded_by_type, 'missing');
    return;
  end if;

  if created_by_type = 'uuid' then
    update public.documents
    set uploaded_by = coalesce(uploaded_by, created_by)
    where uploaded_by is null;
  elsif created_by_type in ('text', 'character varying', 'character') then
    update public.documents
    set uploaded_by = coalesce(
      uploaded_by,
      case
        when created_by is not null
          and created_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then created_by::uuid
        else null
      end
    )
    where uploaded_by is null;
  end if;
  -- else: created_by missing/other type — leave uploaded_by null
end $$;

update public.documents
set tags = coalesce(tags, '{}'::text[])
where tags is null;

-- Backfill entity link from typed FKs when polymorphic fields are empty
update public.documents
set entity_type = 'business_case',
    entity_id = business_case_id
where entity_type is null
  and business_case_id is not null;

update public.documents
set entity_type = 'contract',
    entity_id = contract_id
where entity_type is null
  and contract_id is not null;

update public.documents
set entity_type = 'shipment',
    entity_id = shipment_id
where entity_type is null
  and shipment_id is not null;

update public.documents
set entity_type = 'invoice',
    entity_id = invoice_id
where entity_type is null
  and invoice_id is not null;

create index if not exists documents_entity_idx
  on public.documents (entity_type, entity_id);

create index if not exists documents_document_type_idx
  on public.documents (document_type);

create index if not exists documents_created_at_idx
  on public.documents (created_at desc);

create index if not exists documents_file_path_idx
  on public.documents (file_path);

create index if not exists documents_tags_gin_idx
  on public.documents using gin (tags);

-- Keep updated_at fresh
create or replace function public.set_documents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  -- Keep dual path columns in sync
  if new.file_path is null and new.storage_path is not null then
    new.file_path = new.storage_path;
  end if;
  if new.storage_path is null and new.file_path is not null then
    new.storage_path = new.file_path;
  end if;
  if new.version is null and new.version_no is not null then
    new.version = new.version_no;
  end if;
  if new.version_no is null and new.version is not null then
    new.version_no = new.version;
  end if;
  return new;
end;
$$;

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before insert or update on public.documents
  for each row
  execute function public.set_documents_updated_at();

-- =============================================================================
-- Storage bucket (currently missing in live project)
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  52428800, -- 50 MB
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'text/plain',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

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

alter table public.documents enable row level security;

drop policy if exists "Public read documents" on public.documents;
create policy "Public read documents"
  on public.documents for select to public using (true);

drop policy if exists "Public insert documents" on public.documents;
create policy "Public insert documents"
  on public.documents for insert to public with check (true);

drop policy if exists "Public update documents" on public.documents;
create policy "Public update documents"
  on public.documents for update to public using (true) with check (true);

drop policy if exists "Public delete documents" on public.documents;
create policy "Public delete documents"
  on public.documents for delete to public using (true);

notify pgrst, 'reload schema';
