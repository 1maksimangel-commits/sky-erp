"use server";

import { revalidatePath } from "next/cache";
import type { CompanyFormInput } from "@/lib/companies/types";
import { createClient } from "@/lib/supabase/server";
import { uploadDocument } from "@/lib/documents/actions";
import { assertCan } from "@/lib/platform/permissions";
import { companyInputSchema, validationError, uuid } from "@/lib/core/validation";

export type CreateCompanyResult =
  | { success: true; id?: string }
  | { success: false; error: string };

export type UpdateCompanyResult = CreateCompanyResult;

export async function uploadCompanyApprovalMark(input: {
  companyId: string;
  kind: "seal" | "signature";
  formData: FormData;
}): Promise<CreateCompanyResult> {
  const denied = await assertCan("companies.write");
  if (denied) return { success: false, error: denied };
  const file = input.formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { success: false, error: "Image file is required." };
  if (!new Set(["image/png", "image/jpeg"]).has(file.type)) return { success: false, error: "Use a PNG or JPEG image." };
  if (file.size > 5 * 1024 * 1024) return { success: false, error: "Image must not exceed 5 MB." };
  const title = input.kind === "seal" ? "Authorized company seal" : "Authorized company signature";
  const uploaded = await uploadDocument({
    entityType: "company",
    entityId: input.companyId,
    companyId: input.companyId,
    formData: input.formData,
    documentType: "other",
    title,
    tags: ["company-approval-mark", input.kind],
  });
  if (!uploaded.success) return uploaded;
  const supabase = await createClient();
  const column = input.kind === "seal" ? "seal_document_id" : "signature_document_id";
  const { error } = await supabase.from("companies").update({ [column]: uploaded.id }).eq("id", input.companyId);
  if (error) return { success: false, error: `Image uploaded, but profile link failed: ${error.message}` };
  revalidatePath("/companies");
  revalidatePath(`/companies/${input.companyId}`);
  return { success: true, id: uploaded.id };
}

function nullIfEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isUniqueViolation(error: { code?: string; message: string }): boolean {
  return error.code === "23505" || /unique|duplicate/i.test(error.message);
}

function formatSupabaseError(error: { code?: string; message: string }): string {
  if (isUniqueViolation(error)) {
    return "Code must be unique.";
  }

  if (error.code === "23502") {
    return "A required database field is missing. Check your input and try again.";
  }

  if (error.code === "42501") {
    return "Permission denied. Company administration requires an active Admin account.";
  }

  return error.message || "Unable to save company. Please try again.";
}

function formInputToRow(input: CompanyFormInput) {
  return {
    business_role: input.business_role || null,
    code: input.code.trim(),
    name: input.name.trim(),
    short_name: nullIfEmpty(input.short_name),
    country: nullIfEmpty(input.country),
    city: nullIfEmpty(input.city),
    address: nullIfEmpty(input.address),
    tax_id: nullIfEmpty(input.tax_id),
    registration_number: nullIfEmpty(input.registration_number),
    email: nullIfEmpty(input.email),
    phone: nullIfEmpty(input.phone),
    website: nullIfEmpty(input.website),
    authorized_signer_name: nullIfEmpty(input.authorized_signer_name),
    authorized_signer_title: nullIfEmpty(input.authorized_signer_title),
    is_active: input.is_active,
  };
}

function hasBankDetails(input: CompanyFormInput): boolean {
  return Boolean(
    input.bank_account_name?.trim() ||
      input.bank_name?.trim() ||
      input.bank_address?.trim() ||
      input.account_number?.trim() ||
      input.iban?.trim() ||
      input.swift?.trim()
  );
}

function bankInputToRow(companyId: string | null, input: CompanyFormInput) {
  return {
    company_id: companyId,
    name: input.bank_account_name?.trim() || `${input.name.trim()} ${input.bank_currency || "USD"}`,
    bank_name: nullIfEmpty(input.bank_name),
    bank_address: nullIfEmpty(input.bank_address),
    account_number: nullIfEmpty(input.account_number),
    iban: nullIfEmpty(input.iban),
    swift: nullIfEmpty(input.swift)?.toUpperCase() ?? null,
    currency: input.bank_currency?.trim().toUpperCase() || "USD",
    is_active: true,
    updated_at: new Date().toISOString(),
  };
}

async function saveCompany(id: string | null, input: CompanyFormInput): Promise<CreateCompanyResult> {
  try {
    const denied = await assertCan("companies.write");
    if (denied) return { success: false, error: denied };
    const invalid = validationError(companyInputSchema, input);
    if (invalid) return { success: false, error: invalid };
    if (id && !uuid.safeParse(id).success) return { success: false, error: "Invalid Company ID." };
    const client = await createClient();
    const { data, error } = await client.rpc("save_company_core", {
      p_id: id, p_company: formInputToRow(input),
      p_bank: hasBankDetails(input) ? bankInputToRow(id, input) : null,
    });
    if (error) return { success: false, error: formatSupabaseError(error) };
    if (typeof data !== "string") return { success: false, error: "Company save did not return an ID." };
    revalidatePath("/companies"); revalidatePath(`/companies/${data}`);
    return { success: true, id: data };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Unable to save Company." }; }
}

export async function createCompany(input: CompanyFormInput): Promise<CreateCompanyResult> {
  return saveCompany(null, input);
}
export async function updateCompany(id: string, input: CompanyFormInput): Promise<UpdateCompanyResult> {
  return saveCompany(id, input);
}
export async function setCompanyActive(id: string, active: boolean): Promise<CreateCompanyResult> {
  const denied = await assertCan("companies.write");
  if (denied) return { success: false, error: denied };
  if (!uuid.safeParse(id).success || typeof active !== "boolean") return { success: false, error: "Invalid Company status request." };
  const client = await createClient();
  const { data, error } = await client.from("companies").update({ is_active: active }).eq("id", id).select("id").maybeSingle();
  if (error || !data) return { success: false, error: error?.message ?? "Company not found or access denied." };
  revalidatePath("/companies"); revalidatePath(`/companies/${id}`);
  return { success: true, id };
}
