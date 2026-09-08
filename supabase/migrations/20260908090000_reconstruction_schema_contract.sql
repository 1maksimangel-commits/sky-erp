-- Forward reconciliation of existing application writes with the preserved schema.
-- No business rows are rewritten; no policies, grants, or authentication change.

-- Both the legacy and canonical create actions remain supported. Preserve explicitly
-- supplied identifiers; fill only an absent alias on INSERT. Existing rows and edits
-- are untouched. The legacy NOT NULL / unique constraint remains in force.
create or replace function public.fill_business_case_numbers()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.number := coalesce(new.number, new.case_number);
  new.case_number := coalesce(new.case_number, new.number);
  return new;
end;
$$;

create trigger business_cases_fill_numbers
before insert on public.business_cases
for each row execute function public.fill_business_case_numbers();

-- createTextDocumentTemplate already stores content without an uploaded file.
alter table public.document_templates alter column storage_path drop not null;
alter table public.document_templates
  add constraint document_templates_source_required
  check (storage_path is not null or template_content is not null);

-- The existing Contract generator saves supplements in the Document Center.
alter table public.documents drop constraint if exists documents_document_type_check;
alter table public.documents add constraint documents_document_type_check
  check (document_type is null or document_type in (
    'contract', 'supplement', 'annex', 'invoice', 'commercial_invoice',
    'proforma_invoice', 'specification', 'packing_list', 'bill_of_lading', 'bl',
    'certificate', 'certificate_of_origin', 'health_certificate',
    'veterinary_certificate', 'customs_declaration', 'payment_confirmation',
    'swift', 'inspection_report', 'commission_invoice', 'letter', 'photo',
    'video', 'other'
  ));

-- uploadDocumentTemplate already accepts DOTX. Preserve every existing MIME type.
update storage.buckets
set allowed_mime_types = array_append(allowed_mime_types,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.template')
where id = 'documents'
  and allowed_mime_types is not null
  and not ('application/vnd.openxmlformats-officedocument.wordprocessingml.template' = any(allowed_mime_types));

notify pgrst, 'reload schema';
