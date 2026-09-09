"use server";
import { companyStoragePath } from "@/lib/documents/storage-scope";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createBusinessCase } from "@/lib/business-cases/actions";
import type { BusinessCaseFormInput } from "@/lib/business-cases/types";
import { getBusinessCaseIdForContract } from "@/lib/contracts/relations";
import type { DocumentCategory } from "@/lib/contracts/document-types";
import { createInvoice, registerPayment } from "@/lib/finance/actions";
import { createShipmentForContract as createLogisticsShipment } from "@/lib/logistics/actions";
import type { ShipmentFormInput } from "@/lib/logistics/types";

export type HubActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

function revalidateContract(contractId: string) {
  revalidatePath(`/contracts/${contractId}`);
  revalidatePath(`/contracts/${contractId}/business-case`);
  revalidatePath(`/contracts/${contractId}/logistics`);
  revalidatePath(`/contracts/${contractId}/warehouse`);
  revalidatePath(`/contracts/${contractId}/finance`);
  revalidatePath(`/contracts/${contractId}/documents`);
  revalidatePath(`/contracts/${contractId}/history`);
  revalidatePath("/contracts");
}

function formatSupabaseError(error: { message: string }): string {
  return error.message || "Operation failed. Please try again.";
}

export async function createShipmentForContract(
  contractId: string,
  input: Omit<ShipmentFormInput, "contract_id">
): Promise<HubActionResult> {
  const result = await createLogisticsShipment(contractId, input);

  if (!result.success) {
    return result;
  }

  revalidateContract(contractId);
  return { success: true };
}

/**
 * Create a sales invoice via the finance module (line item + BC stamp).
 */
export async function createInvoiceForContract(
  contractId: string,
  input: {
    invoice_number: string;
    amount: number | null;
    currency: string;
    status: string;
    due_date?: string | null;
  }
): Promise<HubActionResult> {
  if (!input.invoice_number.trim()) {
    return { success: false, error: "Invoice number is required." };
  }

  const amount = input.amount ?? 0;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Invoice amount must be greater than zero." };
  }

  const supabase = await createClient();
  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select(
      "id, contract_number, company_id, buyer_id, supplier_id, business_case_id"
    )
    .eq("id", contractId)
    .maybeSingle();

  if (contractError) {
    return { success: false, error: formatSupabaseError(contractError) };
  }
  if (!contract) {
    return { success: false, error: "Contract was not found." };
  }
  if (!contract.company_id) {
    return {
      success: false,
      error: "Contract has no company. Set company on the contract first.",
    };
  }

  const result = await createInvoice({
    invoice_number: input.invoice_number.trim(),
    invoice_type: "Sales Invoice",
    contract_id: contractId,
    business_case_id: contract.business_case_id ?? null,
    shipment_id: null,
    company_id: contract.company_id,
    buyer_id: contract.buyer_id ?? null,
    supplier_id: contract.supplier_id ?? null,
    currency: input.currency.trim() || "USD",
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: input.due_date || null,
    payment_terms: null,
    tax_rate: 0,
    status: input.status.trim() || "Draft",
    notes: null,
    items: [
      {
        product_id: null,
        description: `Settlement for contract ${contract.contract_number}`,
        quantity: 1,
        unit_price: amount,
        tax_rate: 0,
      },
    ],
  });

  if (!result.success) {
    return result;
  }

  revalidateContract(contractId);
  revalidatePath("/finance");
  revalidatePath("/finance/invoices");
  revalidatePath("/finance/reports");
  return { success: true, id: result.id };
}

/**
 * Register payment against a contract invoice via finance_register_payment.
 */
export async function registerPaymentForContract(
  contractId: string,
  input: {
    invoice_id: string;
    amount: number | null;
    currency: string;
    status: string;
    payment_date?: string | null;
    notes?: string | null;
  }
): Promise<HubActionResult> {
  if (!input.invoice_id?.trim()) {
    return {
      success: false,
      error: "Select an invoice before registering a payment.",
    };
  }

  if (input.amount == null || !Number.isFinite(input.amount) || input.amount <= 0) {
    return { success: false, error: "Payment amount must be greater than zero." };
  }

  const supabase = await createClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, contract_id")
    .eq("id", input.invoice_id)
    .maybeSingle();

  if (invoiceError) {
    return { success: false, error: formatSupabaseError(invoiceError) };
  }
  if (!invoice || invoice.contract_id !== contractId) {
    return {
      success: false,
      error: "Selected invoice does not belong to this contract.",
    };
  }

  const result = await registerPayment({
    invoice_id: input.invoice_id,
    amount: input.amount,
    currency: input.currency.trim() || "USD",
    payment_date: input.payment_date || new Date().toISOString().slice(0, 10),
    bank_account_id: null,
    reference: null,
    notes: input.notes?.trim() || null,
    status: input.status.trim() || "Paid",
  });

  if (!result.success) {
    return result;
  }

  revalidateContract(contractId);
  revalidatePath("/finance");
  revalidatePath("/finance/payments");
  revalidatePath("/finance/invoices");
  revalidatePath("/finance/reports");
  return { success: true, id: result.id };
}

export async function createBusinessCaseForContract(
  contractId: string,
  input: BusinessCaseFormInput
): Promise<HubActionResult> {
  if (!input.company_id?.trim()) {
    return {
      success: false,
      error: "Company is required. Set company on the contract first.",
    };
  }

  const result = await createBusinessCase(input);

  if (!result.success) {
    return result;
  }

  if (!result.id) {
    return {
      success: false,
      error: "Business case was created but no id was returned.",
    };
  }

  const supabase = await createClient();
  const { error: linkError } = await supabase
    .from("contracts")
    .update({
      business_case_id: result.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contractId);

  if (linkError) {
    return {
      success: false,
      error: `Business case created, but linking failed: ${formatSupabaseError(linkError)}`,
    };
  }

  revalidateContract(contractId);
  revalidatePath(`/business-cases/${result.id}`);
  revalidatePath("/business-cases");
  return { success: true, id: result.id };
}

export async function uploadContractDocument(
  contractId: string,
  contractNumber: string,
  formData: FormData
): Promise<HubActionResult> {
  const businessCaseId = await getBusinessCaseIdForContract(
    contractNumber,
    contractId
  );

  if (!businessCaseId) {
    return {
      success: false,
      error: "Link or create a business case before uploading documents.",
    };
  }

  const file = formData.get("file");
  const category = formData.get("category");
  const title = formData.get("title");

  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "A file is required." };
  }

  if (typeof category !== "string" || !category.trim()) {
    return { success: false, error: "Document category is required." };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = await companyStoragePath(`${contractId}/${Date.now()}-${safeName}`, { type: "contract", id: contractId });
  const supabase = await createClient();

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return { success: false, error: formatSupabaseError(uploadError) };
  }

  const { data: contractRow } = await supabase
    .from("contracts")
    .select("company_id")
    .eq("id", contractId)
    .maybeSingle();

  const { error: insertError } = await supabase.from("documents").insert({
    business_case_id: businessCaseId,
    contract_id: contractId,
    company_id: contractRow?.company_id ?? null,
    title:
      typeof title === "string" && title.trim()
        ? title.trim()
        : file.name,
    document_type: category.trim() as DocumentCategory,
    storage_path: storagePath,
    file_path: storagePath,
    mime_type: file.type || null,
    uploaded_at: new Date().toISOString(),
  });

  if (insertError) {
    await supabase.storage.from("documents").remove([storagePath]);
    return { success: false, error: formatSupabaseError(insertError) };
  }

  revalidateContract(contractId);
  return { success: true };
}

export async function addContractProductLine(
  contractId: string,
  input: {
    product_id: string;
    quantity: number;
    reserved?: number;
    packed?: number;
    loaded?: number;
  }
): Promise<HubActionResult> {
  if (!input.product_id) {
    return { success: false, error: "Product is required." };
  }

  const quantity = input.quantity ?? 0;
  const loaded = input.loaded ?? 0;
  const remaining = Math.max(quantity - loaded, 0);

  const supabase = await createClient();

  const { error } = await supabase.from("contract_products").insert({
    contract_id: contractId,
    product_id: input.product_id,
    quantity,
    reserved: input.reserved ?? 0,
    packed: input.packed ?? 0,
    loaded,
    remaining,
  });

  if (error) {
    return { success: false, error: formatSupabaseError(error) };
  }

  revalidateContract(contractId);
  return { success: true };
}
