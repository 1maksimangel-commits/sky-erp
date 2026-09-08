export const DOCUMENT_TEMPLATE_TYPES = [
  "contract",
  "supplement",
  "invoice",
  "packing_list",
  "certificate",
  "bl",
  "commission_invoice",
] as const;

export type DocumentTemplateType = (typeof DOCUMENT_TEMPLATE_TYPES)[number];

export const DOCUMENT_TEMPLATE_LABELS: Record<DocumentTemplateType, string> = {
  contract: "Contract",
  supplement: "Supplement",
  invoice: "Invoice",
  packing_list: "Packing List",
  certificate: "Certificate",
  bl: "Bill of Lading",
  commission_invoice: "Commission Invoice",
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
  status?: "Unconfigured" | "Ready";
};

export type TemplateVariableCategory = "AUTO" | "EDITABLE" | "MANUAL";
export type TemplateVariable = { key: string; label: string; category: TemplateVariableCategory; sourcePath?: string; };

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { key: "deal.number", label: "Deal → Number", category: "AUTO", sourcePath: "deal.number" },
  { key: "contract.number", label: "Contract → Number", category: "AUTO", sourcePath: "contract.number" },
  { key: "seller.name", label: "Seller → Legal Name", category: "AUTO", sourcePath: "company.name" },
  { key: "seller.legal_name", label: "Seller → Legal Name", category: "AUTO", sourcePath: "company.name" },
  { key: "buyer.name", label: "Buyer → Legal Name", category: "AUTO", sourcePath: "buyer.legal_name" },
  { key: "buyer.legal_name", label: "Buyer → Legal Name", category: "AUTO", sourcePath: "buyer.legal_name" },
  { key: "consignee.name", label: "Consignee → Legal Name", category: "AUTO", sourcePath: "consignee.legal_name" },
  { key: "product.name", label: "Product → Name", category: "AUTO", sourcePath: "products[0].name" },
  { key: "product.quantity", label: "Product → Quantity", category: "AUTO", sourcePath: "products[0].quantity" },
  { key: "product.unit_price", label: "Product → Unit Price", category: "AUTO", sourcePath: "products[0].unitPrice" },
  { key: "product.amount", label: "Product → Amount", category: "AUTO", sourcePath: "products[0].lineAmount" },
  { key: "commercial.price", label: "Commercial → Price", category: "EDITABLE", sourcePath: "contract.amount" },
  { key: "commercial.currency", label: "Commercial → Currency", category: "AUTO", sourcePath: "contract.currency" },
  { key: "incoterms", label: "Commercial → Incoterms", category: "EDITABLE", sourcePath: "contract.incoterms" },
  { key: "manual.notes", label: "Manual → Notes", category: "MANUAL" },
];
