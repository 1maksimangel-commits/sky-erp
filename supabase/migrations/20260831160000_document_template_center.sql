alter table public.document_templates
  add column if not exists language text not null default 'en',
  add column if not exists is_active boolean not null default true,
  add column if not exists supersedes_id uuid references public.document_templates(id) on delete set null,
  add column if not exists uploaded_by uuid references auth.users(id) on delete set null,
  add column if not exists change_reason text;

create index if not exists document_templates_active_default_idx
  on public.document_templates(company_id, document_type, language, is_active, is_default);

drop policy if exists "Public read document templates" on public.document_templates;
create policy "Public read document templates"
  on public.document_templates for select to public using (true);
