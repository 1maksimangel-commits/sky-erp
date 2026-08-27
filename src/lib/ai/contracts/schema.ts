import { z } from "zod";

export const ExtractedFieldSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  confidence: z.number(),
  source_text: z.string().nullable(),
  page_number: z.number().nullable(),
  warning: z.string().nullable(),
});

export type ExtractedField<T = string | number | boolean | null> = {
  value: T;
  confidence: number;
  source_text: string | null;
  page_number: number | null;
  warning: string | null;
};

export type ConfidenceLevel = "high" | "medium" | "low" | "missing";

export function confidenceLevel(
  field: ExtractedField<unknown> | null | undefined
): ConfidenceLevel {
  if (field == null || field.value == null || field.value === "") return "missing";
  if (field.confidence >= 0.9) return "high";
  if (field.confidence >= 0.7) return "medium";
  return "low";
}

export function emptyField<T extends string | number | boolean | null = null>(
  value: T = null as T,
  confidence = 0
): ExtractedField<T> {
  return {
    value,
    confidence,
    source_text: null,
    page_number: null,
    warning: null,
  };
}

const ProductLineSchema = z.object({
  description: ExtractedFieldSchema,
  product_name: ExtractedFieldSchema,
  scientific_name: ExtractedFieldSchema,
  sku: ExtractedFieldSchema,
  grade: ExtractedFieldSchema,
  size: ExtractedFieldSchema,
  packaging: ExtractedFieldSchema,
  quantity: ExtractedFieldSchema,
  quantity_unit: ExtractedFieldSchema,
  net_weight_kg: ExtractedFieldSchema,
  gross_weight_kg: ExtractedFieldSchema,
  unit_price: ExtractedFieldSchema,
  price_unit: ExtractedFieldSchema,
  line_amount: ExtractedFieldSchema,
  currency: ExtractedFieldSchema,
  country_of_origin: ExtractedFieldSchema,
  hs_code: ExtractedFieldSchema,
  producer: ExtractedFieldSchema,
  brand: ExtractedFieldSchema,
  freezing_method: ExtractedFieldSchema,
  glaze_percent: ExtractedFieldSchema,
});

export const ContractExtractionZodSchema = z.object({
  general: z.object({
    contract_number: ExtractedFieldSchema,
    title: ExtractedFieldSchema,
    contract_type: ExtractedFieldSchema,
    contract_date: ExtractedFieldSchema,
    expiry_date: ExtractedFieldSchema,
    language: ExtractedFieldSchema,
    status: ExtractedFieldSchema,
  }),
  company: z.object({
    company_legal_name: ExtractedFieldSchema,
    company_registration_number: ExtractedFieldSchema,
    company_tax_id: ExtractedFieldSchema,
    company_address: ExtractedFieldSchema,
  }),
  buyer: z.object({
    buyer_legal_name: ExtractedFieldSchema,
    buyer_short_name: ExtractedFieldSchema,
    buyer_registration_number: ExtractedFieldSchema,
    buyer_tax_id: ExtractedFieldSchema,
    buyer_address: ExtractedFieldSchema,
    buyer_country: ExtractedFieldSchema,
    buyer_city: ExtractedFieldSchema,
    buyer_contact: ExtractedFieldSchema,
    buyer_email: ExtractedFieldSchema,
    buyer_phone: ExtractedFieldSchema,
  }),
  supplier: z.object({
    supplier_legal_name: ExtractedFieldSchema,
    supplier_short_name: ExtractedFieldSchema,
    supplier_registration_number: ExtractedFieldSchema,
    supplier_tax_id: ExtractedFieldSchema,
    supplier_address: ExtractedFieldSchema,
    supplier_country: ExtractedFieldSchema,
    supplier_city: ExtractedFieldSchema,
    supplier_contact: ExtractedFieldSchema,
    supplier_email: ExtractedFieldSchema,
    supplier_phone: ExtractedFieldSchema,
  }),
  consignee: z.object({
    consignee_legal_name: ExtractedFieldSchema,
    consignee_address: ExtractedFieldSchema,
    notify_party: ExtractedFieldSchema,
  }),
  commercial: z.object({
    currency: ExtractedFieldSchema,
    total_amount: ExtractedFieldSchema,
    incoterms: ExtractedFieldSchema,
    incoterms_location: ExtractedFieldSchema,
    payment_terms: ExtractedFieldSchema,
    advance_payment_percent: ExtractedFieldSchema,
    balance_payment_percent: ExtractedFieldSchema,
    delivery_deadline: ExtractedFieldSchema,
    delivery_period: ExtractedFieldSchema,
  }),
  banking: z.object({
    bank_name: ExtractedFieldSchema,
    bank_account_name: ExtractedFieldSchema,
    bank_account_number: ExtractedFieldSchema,
    bank_iban: ExtractedFieldSchema,
    bank_swift: ExtractedFieldSchema,
    bank_address: ExtractedFieldSchema,
  }),
  logistics: z.object({
    port_of_loading: ExtractedFieldSchema,
    port_of_discharge: ExtractedFieldSchema,
    final_destination: ExtractedFieldSchema,
    shipment_period: ExtractedFieldSchema,
    vessel: ExtractedFieldSchema,
    voyage: ExtractedFieldSchema,
    container_requirements: ExtractedFieldSchema,
    container_numbers: ExtractedFieldSchema,
    temperature_requirements: ExtractedFieldSchema,
  }),
  legal: z.object({
    governing_law: ExtractedFieldSchema,
    arbitration: ExtractedFieldSchema,
    dispute_resolution: ExtractedFieldSchema,
    force_majeure: ExtractedFieldSchema,
    claims_period: ExtractedFieldSchema,
    inspection_terms: ExtractedFieldSchema,
    special_conditions: ExtractedFieldSchema,
    referenced_annexes: ExtractedFieldSchema,
  }),
  signatures: z.object({
    seller_signature_present: ExtractedFieldSchema,
    buyer_signature_present: ExtractedFieldSchema,
    seller_seal_present: ExtractedFieldSchema,
    buyer_seal_present: ExtractedFieldSchema,
  }),
  products: z.array(ProductLineSchema),
});

export type ContractExtractionResult = z.infer<typeof ContractExtractionZodSchema>;
export type ExtractedProductLine = z.infer<typeof ProductLineSchema>;

export type MatchState =
  | "exact"
  | "probable"
  | "none"
  | "multiple"
  | "confirmed";

export type EntityMatchCandidate = {
  id: string;
  label: string;
  score: number;
  reason: string;
};

export type EntityMatchResult = {
  role: "company" | "buyer" | "supplier" | "consignee";
  extractedName: string | null;
  state: MatchState;
  selectedId: string | null;
  candidates: EntityMatchCandidate[];
  requiresConfirmation: boolean;
};

export type ProductLineMatch = {
  lineIndex: number;
  state: MatchState | "ignore" | "create";
  selectedProductId: string | null;
  candidates: EntityMatchCandidate[];
  extractedLabel: string | null;
  quantity: number | null;
};

export type ContractImportMatchBundle = {
  company: EntityMatchResult;
  buyer: EntityMatchResult;
  supplier: EntityMatchResult;
  consignee: EntityMatchResult;
  products: ProductLineMatch[];
};

export type ContractImportStatus =
  | "uploaded"
  | "processing"
  | "review"
  | "ready_for_review"
  | "failed"
  | "confirmed"
  | "draft";

export function asString(
  field: ExtractedField<unknown> | null | undefined
): string | null {
  const value = field?.value;
  if (value == null || value === "") return null;
  return String(value);
}

export function asNumber(
  field: ExtractedField<unknown> | null | undefined
): number | null {
  const value = field?.value;
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function asBoolean(
  field: ExtractedField<unknown> | null | undefined
): boolean | null {
  const value = field?.value;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "1"].includes(normalized)) return true;
    if (["false", "no", "0"].includes(normalized)) return false;
  }
  return null;
}
