"use server";

import { revalidatePath } from "next/cache";
import type { CompanyFormInput } from "@/lib/companies/types";
import { createClient } from "@/lib/supabase/server";
import { uploadDocument } from "@/lib/documents/actions";

export type CreateCompanyResult =
  | { success: true; id?: string }
  | { success: false; error: string };

export type UpdateCompanyResult = CreateCompanyResult;

export async function uploadCompanyApprovalMark(input: {
  companyId: string;
  kind: "seal" | "signature";
  formData: FormData;
}): Promise<CreateCompanyResult> {
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
    return "Permission denied. Unable to create company. Apply an INSERT policy on public.companies.";
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

function bankInputToRow(companyId: string, input: CompanyFormInput) {
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

export async function createCompany(
  input: CompanyFormInput
): Promise<CreateCompanyResult> {
  // Never throw: Next.js 16 can surface "TypeError: args.map is not a function"
  // when server actions rethrow.
  try {
    if (!input || typeof input !== "object") {
      return {
        success: false,
        error: "Invalid company payload. Please reload and try again.",
      };
    }

    const code = (input.code ?? "").trim();
    const name = (input.name ?? "").trim();

    if (!code) {
      return { success: false, error: "Code is required." };
    }

    if (!name) {
      return { success: false, error: "Name is required." };
    }

    const supabase = await createClient();

    const { data: existing, error: lookupError } = await supabase
      .from("companies")
      .select("id")
      .eq("code", code)
      .maybeSingle();

    if (lookupError) {
      return { success: false, error: formatSupabaseError(lookupError) };
    }

    if (existing) {
      return { success: false, error: "Code must be unique." };
    }

    const { data, error } = await supabase
      .from("companies")
      .insert(formInputToRow({ ...input, code, name }))
      .select("id")
      .single();

    if (error) {
      return { success: false, error: formatSupabaseError(error) };
    }

    if (hasBankDetails(input)) {
      const { error: bankError } = await supabase
        .from("bank_accounts")
        .insert({ ...bankInputToRow(data.id, input), opening_balance: 0, current_balance: 0 });
      if (bankError) {
        return {
          success: false,
          error: `Company was created, but bank details could not be saved: ${bankError.message}`,
        };
      }
    }

    revalidatePath("/companies");
    revalidatePath("/contracts");
    revalidatePath("/business-cases");
    return { success: true, id: data.id };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save company.";
    return { success: false, error: message };
  }
}

export async function updateCompany(
  id: string,
  input: CompanyFormInput
): Promise<UpdateCompanyResult> {
  try {
    if (!id?.trim() || !input || typeof input !== "object") {
      return { success: false, error: "Invalid company payload. Please reload and try again." };
    }
    const code = (input.code ?? "").trim();
    const name = (input.name ?? "").trim();
    if (!code) return { success: false, error: "Code is required." };
    if (!name) return { success: false, error: "Name is required." };

    const supabase = await createClient();
    const { data: currentCompany, error: currentCompanyError } = await supabase
      .from("companies")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (currentCompanyError) return { success: false, error: formatSupabaseError(currentCompanyError) };
    if (!currentCompany) return { success: false, error: "Company was not found." };

    const { data: duplicate, error: lookupError } = await supabase
      .from("companies")
      .select("id")
      .eq("code", code)
      .neq("id", id)
      .maybeSingle();
    if (lookupError) return { success: false, error: formatSupabaseError(lookupError) };
    if (duplicate) return { success: false, error: "Code must be unique." };

    const { error } = await supabase
      .from("companies")
      .update(formInputToRow({ ...input, code, name }))
      .eq("id", id);
    if (error) {
      if (error.code === "42501") {
        return { success: false, error: "Permission denied. Company update policy is not configured." };
      }
      return { success: false, error: formatSupabaseError(error) };
    }
    if (hasBankDetails(input)) {
      const { data: existingBank, error: bankLookupError } = await supabase
        .from("bank_accounts")
        .select("id")
        .eq("company_id", id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (bankLookupError) return { success: false, error: bankLookupError.message };
      const bankRow = bankInputToRow(id, input);
      const bankResult = existingBank
        ? await supabase.from("bank_accounts").update(bankRow).eq("id", existingBank.id)
        : await supabase
            .from("bank_accounts")
            .insert({ ...bankRow, opening_balance: 0, current_balance: 0 });
      if (bankResult.error) {
        return {
          success: false,
          error: `Company was updated, but bank details could not be saved: ${bankResult.error.message}`,
        };
      }
    }

    revalidatePath("/companies");
    revalidatePath(`/companies/${id}`);
    revalidatePath("/contracts");
    revalidatePath("/business-cases");
    return { success: true, id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to update company.",
    };
  }
}
