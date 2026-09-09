import { CANONICAL_KEYS, variableLabel } from "./variables";
export const DOCUMENT_TEMPLATE_TYPES = [
  "contract",
  "supplement",
  "invoice",
  "packing_list",
  "certificate",
  "bl",
  "commission_invoice",
  "acceptance_transfer_act",
  "specification", "proforma_invoice", "other",
] as const;

export type DocumentTemplateType = (typeof DOCUMENT_TEMPLATE_TYPES)[number];

export const DOCUMENT_TEMPLATE_LABELS: Record<DocumentTemplateType, string> = {
  contract: "Contract",
  supplement: "Supplement",
  invoice: "Commercial Invoice",
  packing_list: "Packing List",
  certificate: "Certificate",
  bl: "Bill of Lading",
  commission_invoice: "Commission Invoice",
  acceptance_transfer_act: "Acceptance / Transfer Act",
  specification: "Specification", proforma_invoice: "Proforma Invoice", other: "Other document",
};

export type DocumentTemplate = {
  id: string;
  company_id: string | null;
  document_type: DocumentTemplateType;
  name: string;
  storage_path: string;
  version: number;
  is_default: boolean;
  language: string;
  is_active: boolean;
  supersedes_id: string | null;
  uploaded_by: string | null;
  change_reason: string | null;
  created_at: string;
  updated_at: string;
  template_content?: string | null;
  original_hash?: string | null;
  original_filename?: string | null;
  configured_storage_path?: string | null;
  configured_hash?: string | null;
  status?: "Unconfigured" | "Ready";
};

export type TemplateVariableCategory = "AUTO" | "EDITABLE" | "MANUAL";
export type TemplateVariable = { key: string; label: string; category: TemplateVariableCategory; sourcePath?: string; };

export const TEMPLATE_VARIABLES: TemplateVariable[] = CANONICAL_KEYS.filter(key => key.includes(".")).map(key => ({ key, label: variableLabel(key), category: key.startsWith("manual.") ? "MANUAL" : "AUTO", sourcePath: key }));
