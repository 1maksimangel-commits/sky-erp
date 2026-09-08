create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  document_type text not null,
  name text not null,
  storage_path text not null,
  version integer not null default 1,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_templates_document_type_check check (document_type in ('contract','annex','invoice','packing_list','certificate','bl','commission_invoice')),
  constraint document_templates_version_check check (version > 0)
);

create index if not exists document_templates_company_type_idx
  on public.document_templates(company_id, document_type, is_default);

alter table public.document_templates enable row level security;

drop policy if exists "Public read document templates" on public.document_templates;
create policy "Public read document templates"
  on public.document_templates for select to public using (true);

drop policy if exists "Public insert document templates" on public.document_templates;
create policy "Public insert document templates"
  on public.document_templates for insert to public with check (true);

drop policy if exists "Public update document templates" on public.document_templates;
create policy "Public update document templates"
  on public.document_templates for update to public using (true) with check (true);

drop policy if exists "Public delete document templates" on public.document_templates;
create policy "Public delete document templates"
  on public.document_templates for delete to public using (true);

create or replace function public.set_document_template_default()
returns trigger
language plpgsql
security invoker
as $$
begin
  if new.is_default then
    update public.document_templates
      set is_default = false, updated_at = now()
      where document_type = new.document_type
        and company_id is not distinct from new.company_id
        and id <> new.id;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists document_templates_default_trigger on public.document_templates;
create trigger document_templates_default_trigger
before insert or update on public.document_templates
for each row execute function public.set_document_template_default();

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
