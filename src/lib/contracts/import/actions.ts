"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { isContractAiConfigured } from "@/lib/ai/contracts/client";
import type { ContractExtractionResult } from "@/lib/ai/contracts/schema";
import { createContract } from "@/lib/contracts/actions";
import { addContractProductLine } from "@/lib/contracts/hub-actions";
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
import { uploadDocument } from "@/lib/documents/actions";
import { recordEntityEvent } from "@/lib/platform/audit";
import { assertCan } from "@/lib/platform/permissions";
import { createProduct } from "@/lib/products/actions";
import type { ProductFormInput } from "@/lib/products/types";
import { createClient } from "@/lib/supabase/server";

export type ImportActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

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
  const denied = assertCan("contracts.write");
  if (denied) return { success: false, error: denied };

  const payload: CounterpartyFormInput = {
    code: "",
    legal_name: input.legalName,
    short_name: null,
    counterparty_type: input.type || "Other",
    country: null,
    city: null,
    address: input.address ?? null,
    tax_id: input.taxId ?? null,
    registration_number: input.registrationNumber ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    website: null,
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
  const denied = assertCan("contracts.write");
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
  const denied = assertCan("contracts.write");
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
      error: "This import already created a contract.",
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
    await supabase
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
    return {
      success: true,
      data: {
        contractId: "",
        message: "Import draft saved. Contract was not created yet.",
      },
    };
  }

  const form = {
    ...payload.form,
    company_id: payload.matches.companyId,
    buyer_id: payload.matches.buyerId,
    supplier_id: payload.matches.supplierId,
  };

  const created = await createContract(form);
  if (!created.success || !created.id) {
    return {
      success: false,
      error: created.success ? "Contract ID missing." : created.error,
    };
  }

  const contractId = created.id;
  let linkedProducts = 0;

  try {
    for (const line of payload.productLines) {
      if (line.action === "ignore") continue;

      let productId = line.productId;
      if (line.action === "create" && line.create) {
        const createdProduct = await createProductFromImport({
          sku: line.create.sku,
          name: line.create.name,
          scientificName: line.create.scientific_name,
          size: line.create.size,
          hsCode: line.create.hs_code,
          brand: line.create.brand,
          country: line.create.country,
          currency: line.create.currency,
          salePrice: line.create.sale_price,
          description: line.create.description,
        });
        if (!createdProduct.success) {
          throw new Error(
            `Product line ${line.lineIndex + 1}: ${createdProduct.error}`
          );
        }
        productId = createdProduct.data.id;
      }

      if (!productId) continue;

      const lineResult = await addContractProductLine(contractId, {
        product_id: productId,
        quantity: line.quantity || 0,
      });
      if (!lineResult.success) {
        throw new Error(
          `Product line ${line.lineIndex + 1}: ${lineResult.error}`
        );
      }
      linkedProducts += 1;
    }

    if (importRow.file_path && importRow.file_name) {
      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from("documents")
        .download(importRow.file_path);
      if (downloadError || !fileBlob) {
        throw new Error(
          downloadError?.message ?? "Failed to attach original PDF."
        );
      }

      const file = new File([fileBlob], importRow.file_name, {
        type: "application/pdf",
      });
      const formData = new FormData();
      formData.set("file", file);
      formData.set(
        "title",
        payload.form.title || payload.form.contract_number || importRow.file_name
      );
      formData.set("document_type", "contract");
      formData.set("version", "1");

      const uploadResult = await uploadDocument({
        entityType: "contract",
        entityId: contractId,
        contractId,
        documentType: "contract",
        title:
          payload.form.title ||
          payload.form.contract_number ||
          importRow.file_name,
        version: 1,
        formData,
      });

      if (!uploadResult.success) {
        throw new Error(uploadResult.error);
      }
    }

    await recordEntityEvent({
      entityType: "contract",
      entityId: contractId,
      action: "imported",
      eventType: "contract_imported_from_pdf",
      title: "Contract imported from PDF",
      summary: `Contract ${payload.form.contract_number} imported from PDF`,
      oldValue: {
        extraction: extraction,
      },
      newValue: {
        reviewed_form: form,
        field_overrides: payload.fieldOverrides ?? {},
        product_lines: payload.productLines,
        warnings: warnings.map((item) => item.message),
      },
      notify: {
        title: "Contract imported from PDF",
        body: payload.form.contract_number,
        category: "contract",
        href: `/contracts/${contractId}`,
      },
    });

    await supabase
      .from("contract_imports")
      .update({
        status: "confirmed",
        created_contract_id: contractId,
        warnings: [
          ...asWarnings(importRow.warnings),
          ...warnings.map((item) => item.message),
        ],
        error_message: null,
      })
      .eq("id", payload.importId);

    revalidatePath("/contracts");
    revalidatePath("/documents");
    revalidatePath(`/contracts/${contractId}`);
    revalidatePath(`/contracts/${contractId}/documents`);

    return {
      success: true,
      data: {
        contractId,
        message: `Contract created successfully${
          linkedProducts > 0
            ? ` with ${linkedProducts} product line${linkedProducts === 1 ? "" : "s"}`
            : ""
        }. Original PDF linked.`,
        href: `/contracts/${contractId}`,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Confirm failed.";
    // Contract row may already exist — keep the link and mark confirmed with error
    // so retries are blocked and the operator can open the contract.
    await supabase
      .from("contract_imports")
      .update({
        status: "confirmed",
        error_message: `Partial finalization: ${message}`,
        created_contract_id: contractId,
        warnings: [
          ...asWarnings(importRow.warnings),
          ...warnings.map((item) => item.message),
          message,
        ],
      })
      .eq("id", payload.importId);

    return {
      success: false,
      error: `Contract was created (${contractId}), but finalization failed: ${message}`,
    };
  }
}
