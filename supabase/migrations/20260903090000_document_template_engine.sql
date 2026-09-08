alter table public.document_templates
  add column if not exists template_content text,
  add column if not exists variable_schema jsonb not null default '[]'::jsonb,
  add column if not exists status text not null default 'Active';

alter table public.document_templates
  drop constraint if exists document_templates_document_type_check;
alter table public.document_templates
  add constraint document_templates_document_type_check
  check (document_type in ('contract','supplement','annex','invoice','packing_list','certificate','bl','commission_invoice','acceptance_transfer_act'));

alter table public.document_templates
  drop constraint if exists document_templates_status_check;
alter table public.document_templates
  add constraint document_templates_status_check
  check (status in ('Draft','Active','Archived','Unconfigured','Ready'));

create index if not exists document_templates_scope_type_idx
  on public.document_templates(company_id, document_type, language, version desc);
