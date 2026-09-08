create table if not exists public.document_generation_batches (
  id uuid primary key default gen_random_uuid(),
  batch_number text not null unique,
  deal_id uuid references public.business_cases(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.generated_documents add column if not exists batch_id uuid references public.document_generation_batches(id) on delete set null;
alter table public.generated_documents add column if not exists document_number text;
alter table public.generated_documents add column if not exists deal_id uuid references public.business_cases(id) on delete set null;
alter table public.generated_documents add column if not exists docx_storage_path text;
alter table public.generated_documents add column if not exists pdf_storage_path text;
alter table public.generated_documents add column if not exists finalized_at timestamptz;
create index if not exists generated_documents_batch_idx on public.generated_documents(batch_id, document_type, version);
alter table public.document_generation_batches enable row level security;
drop policy if exists "Public read generation batches" on public.document_generation_batches;
create policy "Public read generation batches" on public.document_generation_batches for select to public using (true);
drop policy if exists "Public write generation batches" on public.document_generation_batches;
create policy "Public write generation batches" on public.document_generation_batches for all to public using (true) with check (true);
drop policy if exists "Public write generated documents" on public.generated_documents;
create policy "Public write generated documents" on public.generated_documents for all to public using (true) with check (true);
