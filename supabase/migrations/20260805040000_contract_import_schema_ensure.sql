-- Ensure contract PDF import schema + documents storage bucket for imports/
-- Idempotent. Safe to rerun. Does not disable RLS.

-- ---------------------------------------------------------------------------
-- Tables (same as 20260804230000; re-asserted for environments that skipped it)
-- ---------------------------------------------------------------------------
create table if not exists public.contract_imports (
  id uuid primary key default gen_random_uuid(),
  file_path text,
  file_name text,
  mime_type text,
  file_size bigint,
  status text not null default 'uploaded',
  detected_language text,
  extracted_text text,
  extraction_json jsonb,
  match_json jsonb,
  warnings jsonb default '[]'::jsonb,
  error_message text,
  created_contract_id uuid references public.contracts (id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contract_imports add column if not exists file_path text;
alter table public.contract_imports add column if not exists file_name text;
alter table public.contract_imports add column if not exists mime_type text;
alter table public.contract_imports add column if not exists file_size bigint;
alter table public.contract_imports add column if not exists status text;
alter table public.contract_imports add column if not exists detected_language text;
alter table public.contract_imports add column if not exists extracted_text text;
alter table public.contract_imports add column if not exists extraction_json jsonb;
alter table public.contract_imports add column if not exists match_json jsonb;
alter table public.contract_imports add column if not exists warnings jsonb;
alter table public.contract_imports add column if not exists error_message text;
alter table public.contract_imports add column if not exists created_contract_id uuid;
alter table public.contract_imports add column if not exists created_by uuid;
alter table public.contract_imports add column if not exists created_at timestamptz;
alter table public.contract_imports add column if not exists updated_at timestamptz;

create table if not exists public.contract_import_field_reviews (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.contract_imports (id) on delete cascade,
  field_path text not null,
  extracted_value jsonb,
  confirmed_value jsonb,
  confidence numeric,
  source_text text,
  page_number integer,
  review_status text not null default 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists contract_imports_status_idx
  on public.contract_imports (status, created_at desc);

create index if not exists contract_imports_created_contract_id_idx
  on public.contract_imports (created_contract_id);

create index if not exists contract_import_field_reviews_import_id_idx
  on public.contract_import_field_reviews (import_id);

create or replace function public.set_contract_imports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists contract_imports_set_updated_at on public.contract_imports;
create trigger contract_imports_set_updated_at
  before update on public.contract_imports
  for each row
  execute function public.set_contract_imports_updated_at();

alter table public.contract_imports enable row level security;
alter table public.contract_import_field_reviews enable row level security;

drop policy if exists "Public read contract_imports" on public.contract_imports;
create policy "Public read contract_imports"
  on public.contract_imports for select to public using (true);

drop policy if exists "Public insert contract_imports" on public.contract_imports;
create policy "Public insert contract_imports"
  on public.contract_imports for insert to public with check (true);

drop policy if exists "Public update contract_imports" on public.contract_imports;
create policy "Public update contract_imports"
  on public.contract_imports for update to public using (true) with check (true);

drop policy if exists "Public delete contract_imports" on public.contract_imports;
create policy "Public delete contract_imports"
  on public.contract_imports for delete to public using (true);

drop policy if exists "Public read contract_import_field_reviews" on public.contract_import_field_reviews;
create policy "Public read contract_import_field_reviews"
  on public.contract_import_field_reviews for select to public using (true);

drop policy if exists "Public insert contract_import_field_reviews" on public.contract_import_field_reviews;
create policy "Public insert contract_import_field_reviews"
  on public.contract_import_field_reviews for insert to public with check (true);

drop policy if exists "Public update contract_import_field_reviews" on public.contract_import_field_reviews;
create policy "Public update contract_import_field_reviews"
  on public.contract_import_field_reviews for update to public using (true) with check (true);

drop policy if exists "Public delete contract_import_field_reviews" on public.contract_import_field_reviews;
create policy "Public delete contract_import_field_reviews"
  on public.contract_import_field_reviews for delete to public using (true);

-- ---------------------------------------------------------------------------
-- Storage: ensure documents bucket exists (used by imports/{id}/...)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  52428800,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'video/mp4', 'video/quicktime']::text[]
)
on conflict (id) do update
set file_size_limit = excluded.file_size_limit;

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
