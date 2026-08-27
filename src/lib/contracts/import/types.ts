import type {
  ContractExtractionResult,
  ContractImportMatchBundle,
  ContractImportStatus,
  ExtractedField,
} from "@/lib/ai/contracts/schema";
import type { ContractFormInput } from "@/lib/contracts/form-types";

export type ContractImportRecord = {
  id: string;
  file_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  status: ContractImportStatus | string;
  detected_language: string | null;
  extracted_text: string | null;
  extraction_json: ContractExtractionResult | null;
  match_json: ContractImportMatchBundle | null;
  warnings: string[];
  error_message: string | null;
  created_contract_id: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ReviewedProductLine = {
  lineIndex: number;
  action: "link" | "create" | "ignore";
  productId: string | null;
  create?: {
    sku: string;
    name: string;
    scientific_name: string | null;
    size: string | null;
    hs_code: string | null;
    brand: string | null;
    country: string | null;
    currency: string | null;
    sale_price: number | null;
    description: string | null;
  };
  quantity: number;
};

export type ContractImportReviewPayload = {
  importId: string;
  form: ContractFormInput;
  matches: {
    companyId: string;
    buyerId: string;
    supplierId: string;
    consigneeId: string | null;
  };
  productLines: ReviewedProductLine[];
  fieldOverrides?: Record<string, unknown>;
  saveAsDraft?: boolean;
};

export type ImportValidationIssue = {
  level: "error" | "warning";
  code: string;
  message: string;
};

export type ConfidenceFormMeta = {
  path: string;
  field: ExtractedField<unknown>;
};

export function fieldValue<T>(
  field: ExtractedField<T> | null | undefined
): T | null {
  return field?.value ?? null;
}
