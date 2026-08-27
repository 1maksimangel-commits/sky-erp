-- Hotfix: add DMS columns missing from live public.documents
-- Root cause observed in app: column documents.file_path does not exist (42703)
-- Additive / idempotent. Safe to rerun. Does not drop tables or data.

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

-- Backfill aliases so app can use either column name
update public.documents
set file_path = storage_path
where file_path is null
  and storage_path is not null;

update public.documents
set storage_path = file_path
where storage_path is null
  and file_path is not null;

update public.documents
set version = coalesce(version, version_no, 1)
where version is null;

update public.documents
set version_no = coalesce(version_no, version, 1)
where version_no is null;

update public.documents
set created_at = coalesce(created_at, uploaded_at, now())
where created_at is null;

update public.documents
set updated_at = coalesce(updated_at, uploaded_at, created_at, now())
where updated_at is null;

update public.documents
set tags = coalesce(tags, '{}'::text[])
where tags is null;

update public.documents
set is_current = coalesce(is_current, true)
where is_current is null;

update public.documents
set root_document_id = id
where root_document_id is null;

-- Version history table (optional but required for replace-version UX)
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

alter table public.document_versions enable row level security;

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
