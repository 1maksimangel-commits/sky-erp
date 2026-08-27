-- Contract PDF import workflow
-- Additive / idempotent. Safe to rerun. Does not drop tables or data.

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

alter table public.contract_import_field_reviews add column if not exists import_id uuid;
alter table public.contract_import_field_reviews add column if not exists field_path text;
alter table public.contract_import_field_reviews add column if not exists extracted_value jsonb;
alter table public.contract_import_field_reviews add column if not exists confirmed_value jsonb;
alter table public.contract_import_field_reviews add column if not exists confidence numeric;
alter table public.contract_import_field_reviews add column if not exists source_text text;
alter table public.contract_import_field_reviews add column if not exists page_number integer;
alter table public.contract_import_field_reviews add column if not exists review_status text;
alter table public.contract_import_field_reviews add column if not exists reviewed_by uuid;
alter table public.contract_import_field_reviews add column if not exists reviewed_at timestamptz;

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

notify pgrst, 'reload schema';
