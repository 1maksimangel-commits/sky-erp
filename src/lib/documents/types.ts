export const DOCUMENT_ENTITY_TYPES = [
  "business_case",
  "contract",
  "supplement",
  "invoice",
  "certificate",
  "bl",
  "commission_invoice",
  "letter",
  "shipment",
  "invoice",
  "payment",
  "company",
  "counterparty",
  "product",
  "warehouse_lot",
  "crm_customer",
] as const;

export type DocumentEntityType = (typeof DOCUMENT_ENTITY_TYPES)[number];

export const DOCUMENT_TYPES = [
  "contract",
  "supplement",
  "annex",
  "invoice",
  "certificate",
  "bl",
  "commission_invoice",
  "letter",
  "specification",
  "commercial_invoice",
  "proforma_invoice",
  "packing_list",
  "bill_of_lading",
  "health_certificate",
  "certificate_of_origin",
  "veterinary_certificate",
  "customs_declaration",
  "payment_confirmation",
  "swift",
  "inspection_report",
  "photo",
  "video",
  "other",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  contract: "Contract",
  supplement: "Supplement",
  annex: "Annex (legacy)",
  invoice: "Invoice",
  certificate: "Certificate",
  bl: "Bill of Lading",
  commission_invoice: "Commission Invoice",
  letter: "Letter",
  specification: "Specification",
  commercial_invoice: "Commercial Invoice",
  proforma_invoice: "Proforma Invoice",
  packing_list: "Packing List",
  bill_of_lading: "Bill of Lading",
  health_certificate: "Health Certificate",
  certificate_of_origin: "Certificate of Origin",
  veterinary_certificate: "Veterinary Certificate",
  customs_declaration: "Customs Declaration",
  payment_confirmation: "Payment Confirmation",
  swift: "SWIFT",
  inspection_report: "Inspection Report",
  photo: "Photo",
  video: "Video",
  other: "Other",
};

export const ACCEPTED_DOCUMENT_EXTENSIONS =
  ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.mp4,.mov";

export const ACCEPTED_EXTENSION_SET = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "mp4",
  "mov",
]);

export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;

export type ErpDocument = {
  id: string;
  entity_type: DocumentEntityType | string | null;
  entity_id: string | null;
  document_type: string | null;
  title: string | null;
  file_name: string | null;
  file_path: string | null;
  storage_path: string | null;
  mime_type: string | null;
  file_size: number | null;
  version: number | null;
  tags: string[];
  notes: string | null;
  uploaded_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  uploaded_at: string | null;
  is_current: boolean;
  root_document_id: string | null;
  business_case_id: string | null;
  contract_id: string | null;
  shipment_id: string | null;
  invoice_id: string | null;
  payment_id: string | null;
  company_id: string | null;
  counterparty_id: string | null;
  product_id: string | null;
  // enriched for search/display
  entity_label?: string | null;
};

export type DocumentVersion = {
  id: string;
  document_id: string;
  version: number;
  title: string | null;
  file_name: string | null;
  file_path: string;
  mime_type: string | null;
  file_size: number | null;
  notes: string | null;
  uploaded_by: string | null;
  is_current: boolean;
  created_at: string;
};

export type DocumentUploadInput = {
  entityType: DocumentEntityType | string;
  entityId: string;
  documentType?: string;
  title?: string;
  notes?: string | null;
  tags?: string[];
  version?: number;
  formData: FormData;
  businessCaseId?: string | null;
  contractId?: string | null;
  shipmentId?: string | null;
  invoiceId?: string | null;
  paymentId?: string | null;
  companyId?: string | null;
  counterpartyId?: string | null;
  productId?: string | null;
};

export type DocumentListFilters = {
  query?: string;
  entityType?: string;
  documentType?: string;
  fileType?: string;
  uploadedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  currentOnly?: boolean;
  limit?: number;
};

export type DocumentLibraryStats = {
  total: number;
  contracts: number;
  logistics: number;
  finance: number;
  certificates: number;
};
