"use server";

import { randomUUID, createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { isContractAiConfigured } from "@/lib/ai/contracts/client";
import type { ContractExtractionResult } from "@/lib/ai/contracts/schema";
import { validateContractFormInput } from "@/lib/contracts/validation";
import { asNumber, asString } from "@/lib/ai/contracts/schema";
import { validateImportReview } from "@/lib/contracts/import/review-validation";
import {
  asWarnings,
  mapImportRow,
} from "@/lib/contracts/import/service";
import type {
  ContractImportRecord,
  ContractImportReviewPayload,
} from "@/lib/contracts/import/types";
import { createCounterparty } from "@/lib/counterparties/actions";
import type { CounterpartyFormInput } from "@/lib/counterparties/types";
import { assertCan } from "@/lib/platform/permissions";
import { createProduct } from "@/lib/products/actions";
import type { ProductFormInput } from "@/lib/products/types";
import { createClient } from "@/lib/supabase/server";

export type ImportActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function getContractOriginals(contractId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("contract_imports").select("id, file_path, file_name, mime_type, file_hash, created_at").eq("created_contract_id", contractId);
  if (error) return { data: [], error: error.message };
  const originals = await Promise.all((data ?? []).map(async row => {
    if (!row.file_path) return { ...row, url: "", error: "Original Contract source path is missing." };
    const { data: signed, error: signingError } = await supabase.storage.from("documents").createSignedUrl(row.file_path, 300);
    return { ...row, url: signed?.signedUrl ?? "", error: signingError ? "Unable to authorize original Contract document." : null };
  }));
  return { data: originals.filter(source => source.url), error: originals.find(source => source.error)?.error ?? null };
}

export async function getContractImportAiStatus(): Promise<{
  configured: boolean;
  message: string | null;
}> {
  const configured = isContractAiConfigured();
  if (!configured) {
    console.warn(
      "[contract-ai] getContractImportAiStatus -> configured=false reason=missing_api_key"
    );
    return {
      configured: false,
      message:
        "AI contract import is not configured. Set CONTRACT_AI_API_KEY or OPENAI_API_KEY.",
    };
  }
  console.info("[contract-ai] getContractImportAiStatus -> configured=true");
  return { configured: true, message: null };
}

export async function getContractImport(
  importId: string
): Promise<
  ImportActionResult<{
    importRecord: ContractImportRecord;
    previewUrl: string | null;
  }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contract_imports")
    .select("*")
    .eq("id", importId)
    .maybeSingle();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Import not found." };
  }

  let previewUrl: string | null = null;
  if (data.file_path) {
    const { data: signed } = await supabase.storage
      .from("documents")
      .createSignedUrl(data.file_path, 60 * 60);
    previewUrl = signed?.signedUrl ?? null;
  }

  return {
    success: true,
    data: {
      importRecord: mapImportRow(data as Record<string, unknown>),
      previewUrl,
    },
  };
}

export async function createCounterpartyFromImport(input: {
  legalName: string;
  address?: string | null;
  registrationNumber?: string | null;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  type?: string | null;
}): Promise<ImportActionResult<{ id: string }>> {
  const denied = await assertCan("contracts.write");
  if (denied) return { success: false, error: denied };

  const payload: CounterpartyFormInput = {
    code: "",
    legal_name: input.legalName,
    short_name: null,
    counterparty_type: (input.type || "buyer").toLowerCase(),
    country: null,
    city: null,
    address: input.address ?? null,
    tax_id: input.taxId ?? null,
    registration_number: input.registrationNumber ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    website: null,
    authorized_signer_name: null,
    authorized_signer_title: null,
    bank_account_name: null,
    bank_name: null,
    bank_address: null,
    account_number: null,
    iban: null,
    swift: null,
    bank_currency: "USD",
    is_active: true,
  };

  const result = await createCounterparty(payload);
  if (!result.success) {
    return { success: false, error: result.error };
  }
  if (!result.id) {
    return {
      success: false,
      error: "Counterparty created but ID was not returned.",
    };
  }
  return { success: true, data: { id: result.id } };
}

export async function createProductFromImport(input: {
  sku?: string;
  name: string;
  scientificName?: string | null;
  size?: string | null;
  hsCode?: string | null;
  brand?: string | null;
  country?: string | null;
  currency?: string | null;
  salePrice?: number | null;
  description?: string | null;
}): Promise<ImportActionResult<{ id: string }>> {
  const denied = await assertCan("contracts.write");
  if (denied) return { success: false, error: denied };

  const sku =
    input.sku?.trim() ||
    `IMP-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;

  const payload: ProductFormInput = {
    image_url: null,
    sku,
    code: null,
    name: input.name,
    scientific_name: input.scientificName ?? null,
    category: null,
    species: null,
    origin: null,
    country: input.country ?? null,
    brand: input.brand ?? null,
    size: input.size ?? null,
    glaze: null,
    package_type: null,
    net_weight: null,
    gross_weight: null,
    hs_code: input.hsCode ?? null,
    purchase_price: null,
    sale_price: input.salePrice ?? null,
    currency: input.currency ?? "USD",
    description: input.description ?? null,
    is_active: true,
  };

  const result = await createProduct(payload);
  if (!result.success) {
    return { success: false, error: result.error };
  }
  if (!result.id) {
    return {
      success: false,
      error: "Product created but ID was not returned.",
    };
  }
  return { success: true, data: { id: result.id } };
}

export async function confirmContractImport(
  payload: ContractImportReviewPayload
): Promise<
  ImportActionResult<{ contractId: string; message: string; href?: string }>
> {
  const denied = await assertCan("contracts.write");
  if (denied) return { success: false, error: denied };

  const supabase = await createClient();
  const { data: importRow, error: loadError } = await supabase
    .from("contract_imports")
    .select("*")
    .eq("id", payload.importId)
    .maybeSingle();

  if (loadError || !importRow) {
    return {
      success: false,
      error: loadError?.message ?? "Import record not found.",
    };
  }

  if (importRow.created_contract_id) {
    return {
      success: false,
      error: `This import already created a contract. Open /contracts/${importRow.created_contract_id}.`,
    };
  }

  const status = String(importRow.status ?? "");
  if (status === "processing" || status === "uploaded") {
    return {
      success: false,
      error:
        "Import is still processing or has no extraction yet. Wait for review status before confirming.",
    };
  }

  const extraction =
    (importRow.extraction_json as ContractExtractionResult | null) ?? null;
  if (!extraction && !payload.saveAsDraft) {
    return {
      success: false,
      error: "Extraction data is missing. Re-run extraction before confirming.",
    };
  }

  const { errors, warnings } = validateImportReview({ payload, extraction });
  if (errors.length > 0) {
    return { success: false, error: errors.map((item) => item.message).join(" ") };
  }

  if (payload.saveAsDraft) {
    const { error: draftError } = await supabase
      .from("contract_imports")
      .update({
        status: "draft",
        match_json: {
          ...(importRow.match_json as object),
          reviewDraft: payload,
        },
        warnings: [
          ...asWarnings(importRow.warnings),
          ...warnings.map((item) => item.message),
        ],
      })
      .eq("id", payload.importId);
    if (draftError) return { success: false, error: draftError.message };
    return {
      success: true,
      data: {
        contractId: "",
        message: "Import draft saved. Contract was not created yet.",
      },
    };
  }

  const productLines = payload.form.product_lines ?? payload.productLines.filter(line => line.action !== "ignore").map(line => {
    const extracted = extraction?.products[line.lineIndex];
    return {
      product_id: line.productId,
      description: asString(extracted?.description) || asString(extracted?.product_name) || "",
      quantity: line.quantity,
      unit: asString(extracted?.quantity_unit) || "",
      unit_price: asNumber(extracted?.unit_price) ?? 0,
      currency: asString(extracted?.currency) || payload.form.currency,
      net_weight: asNumber(extracted?.net_weight_kg),
      gross_weight: asNumber(extracted?.gross_weight_kg),
      agreed_amount: asNumber(extracted?.line_amount),
      size_grade: asString(extracted?.size),
      packing: asString(extracted?.packaging),
      origin: asString(extracted?.country_of_origin),
    };
  });
  const form = {
    ...payload.form,
    company_id: importRow.company_id,
    status: "Draft",
    business_role: null,
    product_lines: productLines,
    legal_snapshot: { ...payload.form.legal_snapshot, extraction, field_overrides: payload.fieldOverrides ?? {} },
    payment_terms: payload.form.payment_terms ?? asString(extraction?.commercial.payment_terms),
    delivery_place: payload.form.delivery_place ?? asString(extraction?.commercial.incoterms_location),
    destination_port: payload.form.destination_port ?? asString(extraction?.logistics.port_of_discharge),
    loading_port: payload.form.loading_port ?? asString(extraction?.logistics.port_of_loading),
  };
  if (payload.form.company_id !== importRow.company_id || payload.matches.companyId !== importRow.company_id) {
    return { success: false, error: "Import belongs to a different workspace. Switch workspace and upload there." };
  }
  const validation = validateContractFormInput(form);
  if (validation) return { success: false, error: validation };
  const { data: duplicate, error: lookupError } = await supabase.from("contracts").select("id").eq("company_id", form.company_id).eq("contract_number", form.contract_number.trim()).maybeSingle();
  if (lookupError) return { success: false, error: lookupError.message };
  if (duplicate) return { success: false, error: `Contract number already exists. Open /contracts/${duplicate.id} to review the existing Contract.` };
  // Upgrade only this explicitly reviewed legacy import's source identity.
  // Read the retained bytes; never fabricate a hash or replace the original.
  if (!importRow.file_hash && importRow.file_path) {
    const { data: original, error: sourceError } = await supabase.storage.from("documents").download(importRow.file_path);
    if (sourceError || !original) return { success: false, error: "Retained original is unavailable. Confirmation was not applied." };
    const hash = createHash("sha256").update(Buffer.from(await original.arrayBuffer())).digest("hex");
    const { error: hashError } = await supabase.from("contract_imports").update({ file_hash: hash }).eq("id", payload.importId).is("file_hash", null);
    if (hashError) return { success: false, error: "Original is already registered or its identity could not be verified." };
  }
  const { data: contractId, error } = await supabase.rpc("save_contract", {
    p_id: null, p_contract: form, p_parties: form.parties ?? [], p_lines: productLines,
    p_import_id: payload.importId, p_review: { ...payload, form, reviewedWarnings: warnings },
  });
  if (error) return { success: false, error: error.message };
  revalidatePath("/contracts");
  revalidatePath(`/contracts/${contractId}`);
  return { success: true, data: { contractId: String(contractId), message: "Reviewed Draft Contract created. Original source retained.", href: `/contracts/${contractId}` } };
}
