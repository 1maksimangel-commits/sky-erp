-- SKY ERP Document Management System (complete)
-- Additive / idempotent. Safe to rerun. No DROP TABLE / no data loss.

-- =============================================================================
-- documents: ensure required columns
-- =============================================================================
alter table public.documents add column if not exists entity_type text;
alter table public.documents add column if not exists entity_id uuid;
alter table public.documents add column if not exists document_type text;
alter table public.documents add column if not exists title text;
alter table public.documents add column if not exists file_name text;
alter table public.documents add column if not exists file_path text;
alter table public.documents add column if not exists storage_path text;
alter table public.documents add column if not exists mime_type text;
alter table public.documents add column if not exists file_size bigint;
alter table public.documents add column if not exists version integer default 1;
alter table public.documents add column if not exists version_no integer default 1;
alter table public.documents add column if not exists tags text[] default '{}'::text[];
alter table public.documents add column if not exists notes text;
-- uploaded_by stores auth.users.id — must remain uuid (never text / never 'system')
alter table public.documents add column if not exists uploaded_by uuid;
alter table public.documents add column if not exists created_by text;
alter table public.documents add column if not exists uploaded_at timestamptz default now();
alter table public.documents add column if not exists created_at timestamptz default now();
alter table public.documents add column if not exists updated_at timestamptz default now();
alter table public.documents add column if not exists is_current boolean default true;
alter table public.documents add column if not exists root_document_id uuid;

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
  if to_regclass('public.payments') is not null then
    alter table public.documents
      add column if not exists payment_id uuid references public.payments (id) on delete set null;
  else
    alter table public.documents add column if not exists payment_id uuid;
  end if;
  if to_regclass('public.products') is not null then
    alter table public.documents
      add column if not exists product_id uuid references public.products (id) on delete set null;
  else
    alter table public.documents add column if not exists product_id uuid;
  end if;
end $$;

update public.documents set file_path = storage_path where file_path is null and storage_path is not null;
update public.documents set storage_path = file_path where storage_path is null and file_path is not null;
update public.documents set version = coalesce(version, version_no, 1) where version is null;
update public.documents set version_no = coalesce(version_no, version, 1) where version_no is null;
update public.documents set created_at = coalesce(created_at, uploaded_at, now()) where created_at is null;
update public.documents set updated_at = coalesce(updated_at, uploaded_at, created_at, now()) where updated_at is null;
update public.documents set uploaded_at = coalesce(uploaded_at, created_at, now()) where uploaded_at is null;
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
end $$;

update public.documents set tags = coalesce(tags, '{}'::text[]) where tags is null;
update public.documents set is_current = coalesce(is_current, true) where is_current is null;
update public.documents set root_document_id = id where root_document_id is null;

create index if not exists documents_entity_idx on public.documents (entity_type, entity_id);
create index if not exists documents_document_type_idx on public.documents (document_type);
create index if not exists documents_created_at_idx on public.documents (created_at desc);
create index if not exists documents_is_current_idx on public.documents (is_current);
create index if not exists documents_root_document_id_idx on public.documents (root_document_id);

-- =============================================================================
-- document_versions: immutable history (never overwrite storage objects)
-- =============================================================================
create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  version integer not null default 1,
  title text,
  file_name text,
  file_path text not null,
  mime_type text,
  file_size bigint,
  notes text,
  uploaded_by uuid,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  unique (document_id, version)
);

alter table public.document_versions add column if not exists document_id uuid;
alter table public.document_versions add column if not exists version integer default 1;
alter table public.document_versions add column if not exists title text;
alter table public.document_versions add column if not exists file_name text;
alter table public.document_versions add column if not exists file_path text;
alter table public.document_versions add column if not exists mime_type text;
alter table public.document_versions add column if not exists file_size bigint;
alter table public.document_versions add column if not exists notes text;
alter table public.document_versions add column if not exists uploaded_by uuid;
alter table public.document_versions add column if not exists is_current boolean default false;
alter table public.document_versions add column if not exists created_at timestamptz default now();

create index if not exists document_versions_document_id_idx
  on public.document_versions (document_id, version desc);

create index if not exists document_versions_is_current_idx
  on public.document_versions (document_id, is_current);

-- Seed version history for existing documents that have no versions yet.
-- Resolve uploaded_by as uuid only (never 'system'); leave NULL when unknown.
do $$
declare
  docs_uploaded_by_type text;
  docs_created_by_type text;
  vers_uploaded_by_type text;
  uploaded_by_select text;
begin
  select c.data_type into docs_uploaded_by_type
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'documents' and c.column_name = 'uploaded_by';

  select c.data_type into docs_created_by_type
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'documents' and c.column_name = 'created_by';

  select c.data_type into vers_uploaded_by_type
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'document_versions' and c.column_name = 'uploaded_by';

  if vers_uploaded_by_type is distinct from 'uuid' then
    raise notice 'document_versions.uploaded_by is %, expected uuid — seeding with NULL uploaded_by',
      coalesce(vers_uploaded_by_type, 'missing');
    uploaded_by_select := 'null::uuid';
  elsif docs_uploaded_by_type = 'uuid' and docs_created_by_type = 'uuid' then
    uploaded_by_select := 'coalesce(d.uploaded_by, d.created_by)';
  elsif docs_uploaded_by_type = 'uuid' and docs_created_by_type in ('text', 'character varying', 'character') then
    uploaded_by_select := $sel$
      coalesce(
        d.uploaded_by,
        case
          when d.created_by is not null
            and d.created_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then d.created_by::uuid
          else null
        end
      )
    $sel$;
  elsif docs_uploaded_by_type = 'uuid' then
    uploaded_by_select := 'd.uploaded_by';
  else
    uploaded_by_select := 'null::uuid';
  end if;

  execute format(
    $sql$
      insert into public.document_versions (
        document_id, version, title, file_name, file_path, mime_type, file_size,
        notes, uploaded_by, is_current, created_at
      )
      select
        d.id,
        coalesce(d.version, d.version_no, 1),
        d.title,
        d.file_name,
        coalesce(d.file_path, d.storage_path),
        d.mime_type,
        d.file_size,
        d.notes,
        %s,
        true,
        coalesce(d.created_at, d.uploaded_at, now())
      from public.documents d
      where coalesce(d.file_path, d.storage_path) is not null
        and not exists (
          select 1 from public.document_versions v where v.document_id = d.id
        )
    $sql$,
    uploaded_by_select
  );
end $$;

-- =============================================================================
-- Storage bucket + policies
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',
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
alter table public.document_versions enable row level security;

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

drop policy if exists "Public read document_versions" on public.document_versions;
create policy "Public read document_versions"
  on public.document_versions for select to public using (true);

drop policy if exists "Public insert document_versions" on public.document_versions;
create policy "Public insert document_versions"
  on public.document_versions for insert to public with check (true);

drop policy if exists "Public update document_versions" on public.document_versions;
create policy "Public update document_versions"
  on public.document_versions for update to public using (true) with check (true);

drop policy if exists "Public delete document_versions" on public.document_versions;
create policy "Public delete document_versions"
  on public.document_versions for delete to public using (true);

notify pgrst, 'reload schema';
