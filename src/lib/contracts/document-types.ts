export const DOCUMENT_CATEGORIES = [
  "Contract",
  "Invoice",
  "Packing List",
  "Certificate",
  "Bill of Lading",
  "Photos",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export type ContractDocument = {
  id: string;
  business_case_id: string | null;
  title: string | null;
  document_type: string | null;
  storage_path: string;
  mime_type: string | null;
  uploaded_at: string | null;
  company_id?: string | null;
};
