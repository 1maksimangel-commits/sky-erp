import {
  asNumber,
  asString,
  type ContractExtractionResult,
} from "@/lib/ai/contracts/schema";
import type { ContractFormInput } from "@/lib/contracts/form-types";
import { validateContractFormInput } from "@/lib/contracts/validation";
import type {
  ContractImportReviewPayload,
  ImportValidationIssue,
} from "@/lib/contracts/import/types";

const SUPPORTED_CURRENCIES = new Set(["USD", "EUR", "GBP", "CNY", "JPY"]);
const KNOWN_INCOTERMS = new Set([
  "EXW",
  "FCA",
  "CPT",
  "CIP",
  "DAP",
  "DPU",
  "DDP",
  "FAS",
  "FOB",
  "CFR",
  "CIF",
]);

export function validateImportReview(input: {
  payload: ContractImportReviewPayload;
  extraction: ContractExtractionResult | null;
}): { errors: ImportValidationIssue[]; warnings: ImportValidationIssue[] } {
  const errors: ImportValidationIssue[] = [];
  const warnings: ImportValidationIssue[] = [];
  const form = input.payload.form;

  const formError = validateContractFormInput({
    ...form,
    company_id: input.payload.matches.companyId,
    buyer_id: input.payload.matches.buyerId,
    supplier_id: input.payload.matches.supplierId,
  });
  if (formError) {
    errors.push({ level: "error", code: "form", message: formError });
  }

  if (!input.payload.matches.companyId) {
    errors.push({
      level: "error",
      code: "company",
      message: "Internal company must be selected.",
    });
  }
  if (!input.payload.matches.buyerId) {
    errors.push({
      level: "error",
      code: "buyer",
      message: "Buyer must be selected or created.",
    });
  }
  if (!input.payload.matches.supplierId) {
    errors.push({
      level: "error",
      code: "supplier",
      message: "Supplier must be selected or created.",
    });
  }
  if (
    input.payload.matches.buyerId &&
    input.payload.matches.supplierId &&
    input.payload.matches.buyerId === input.payload.matches.supplierId
  ) {
    errors.push({
      level: "error",
      code: "buyer_supplier",
      message: "Buyer and supplier cannot be the same.",
    });
  }

  if (form.amount != null && form.amount < 0) {
    errors.push({
      level: "error",
      code: "amount",
      message: "Amount cannot be negative.",
    });
  }

  if (!SUPPORTED_CURRENCIES.has((form.currency || "").toUpperCase())) {
    errors.push({
      level: "error",
      code: "currency",
      message: "Currency must be one of USD, EUR, GBP, CNY, JPY.",
    });
  }

  if (
    form.contract_date &&
    form.expiry_date &&
    form.contract_date > form.expiry_date
  ) {
    errors.push({
      level: "error",
      code: "dates",
      message: "Contract date cannot be after expiry date.",
    });
  }

  const extraction = input.extraction;
  if (extraction) {
    const advance = asNumber(extraction.commercial.advance_payment_percent);
    const balance = asNumber(extraction.commercial.balance_payment_percent);
    if (advance != null && advance > 100) {
      errors.push({
        level: "error",
        code: "advance_pct",
        message: "Advance payment percent cannot exceed 100%.",
      });
    }
    if (balance != null && balance > 100) {
      errors.push({
        level: "error",
        code: "balance_pct",
        message: "Balance payment percent cannot exceed 100%.",
      });
    }
    if (advance != null && balance != null && advance + balance > 100.01) {
      warnings.push({
        level: "warning",
        code: "payment_pct_sum",
        message: "Advance + balance payment percentages exceed 100%.",
      });
    }

    const lineTotal = extraction.products.reduce((sum, line) => {
      const amount = asNumber(line.line_amount);
      if (amount != null) return sum + amount;
      const unit = asNumber(line.unit_price);
      const qty = asNumber(line.quantity);
      if (unit != null && qty != null) return sum + unit * qty;
      return sum;
    }, 0);

    if (
      form.amount != null &&
      lineTotal > 0 &&
      Math.abs(form.amount - lineTotal) / Math.max(form.amount, 1) > 0.05
    ) {
      warnings.push({
        level: "warning",
        code: "line_total_mismatch",
        message: `Calculated items total (${lineTotal.toFixed(2)}) differs from contract total (${form.amount}).`,
      });
    }

    if (extraction.signatures.seller_signature_present.value === false) {
      warnings.push({
        level: "warning",
        code: "signatures",
        message: "Missing seller signature.",
      });
    }
    if (!asString(extraction.commercial.payment_terms)) {
      warnings.push({
        level: "warning",
        code: "payment_terms",
        message: "Missing payment terms.",
      });
    }
    if (!asString(extraction.commercial.delivery_deadline)) {
      warnings.push({
        level: "warning",
        code: "delivery_terms",
        message: "Missing delivery terms.",
      });
    }

    const incoterm = (form.incoterms || "").trim().toUpperCase().split(/\s+/)[0];
    if (incoterm && !KNOWN_INCOTERMS.has(incoterm)) {
      warnings.push({
        level: "warning",
        code: "incoterm",
        message: `Unknown Incoterm: ${form.incoterms}.`,
      });
    }
  }

  for (const line of input.payload.productLines) {
    if (line.action === "ignore") continue;
    if (line.action === "link" && !line.productId) {
      errors.push({
        level: "error",
        code: "product_link",
        message: `Product line ${line.lineIndex + 1} needs a matched product.`,
      });
    }
    if (line.action === "create" && !line.create?.name?.trim()) {
      errors.push({
        level: "error",
        code: "product_create",
        message: `Product line ${line.lineIndex + 1} needs a name to create.`,
      });
    }
    if (line.quantity < 0) {
      errors.push({
        level: "error",
        code: "product_qty",
        message: `Product line ${line.lineIndex + 1} quantity cannot be negative.`,
      });
    }
  }

  return { errors, warnings };
}

export function extractionToFormDefaults(
  extraction: ContractExtractionResult
): ContractFormInput {
  const status = asString(extraction.general.status) || "Draft";
  const normalizedStatus = ["Draft", "Active", "Closed", "Cancelled"].includes(
    status
  )
    ? status
    : "Draft";

  return {
    contract_number: asString(extraction.general.contract_number) ?? "",
    title: asString(extraction.general.title),
    company_id: null,
    buyer_id: null,
    supplier_id: null,
    business_case_id: null,
    currency: (asString(extraction.commercial.currency) || "USD").toUpperCase(),
    amount: asNumber(extraction.commercial.total_amount),
    incoterms: asString(extraction.commercial.incoterms),
    contract_date: asString(extraction.general.contract_date),
    expiry_date: asString(extraction.general.expiry_date),
    status: normalizedStatus,
  };
}
