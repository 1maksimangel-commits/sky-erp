create table if not exists public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  business_case_id uuid references public.business_cases(id) on delete set null,
  contract_id uuid references public.contracts(id) on delete set null,
  document_type text not null,
  title text not null,
  status text not null default 'Draft' check (status in ('Draft','Final','Issued')),
  version integer not null default 1,
  source_template_id uuid references public.document_templates(id) on delete set null,
  source_template_version integer,
  storage_path text,
  snapshot_data jsonb not null default '{}'::jsonb,
  snapshot_hash text not null,
  supersedes_id uuid references public.generated_documents(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  issued_at timestamptz
);
create index if not exists generated_documents_contract_idx on public.generated_documents(contract_id, document_type, version desc);
alter table public.generated_documents enable row level security;
drop policy if exists "Public read generated documents" on public.generated_documents;
create policy "Public read generated documents" on public.generated_documents for select to public using (true);
