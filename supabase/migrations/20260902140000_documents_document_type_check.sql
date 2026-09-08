-- Align the legacy documents constraint with the document types supported by
-- the current Document Center and contract generator.
alter table public.documents
  drop constraint if exists documents_document_type_check;

alter table public.documents
  add constraint documents_document_type_check
  check (document_type is null or document_type in (
    'contract',
    'annex',
    'invoice',
    'commercial_invoice',
    'proforma_invoice',
    'specification',
    'packing_list',
    'bill_of_lading',
    'bl',
    'certificate',
    'certificate_of_origin',
    'health_certificate',
    'veterinary_certificate',
    'customs_declaration',
    'payment_confirmation',
    'swift',
    'inspection_report',
    'commission_invoice',
    'letter',
    'photo',
    'video',
    'other'
  ));
