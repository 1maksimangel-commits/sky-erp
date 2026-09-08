-- Controlled company seal/signature document references.
-- The binary originals remain in Document Center; companies only store links.

alter table public.companies
  add column if not exists seal_document_id uuid references public.documents (id) on delete set null,
  add column if not exists signature_document_id uuid references public.documents (id) on delete set null;

create index if not exists companies_seal_document_id_idx
  on public.companies (seal_document_id);
create index if not exists companies_signature_document_id_idx
  on public.companies (signature_document_id);

notify pgrst, 'reload schema';
