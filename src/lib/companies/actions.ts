"use server";

import { revalidatePath } from "next/cache";
import type { CompanyFormInput } from "@/lib/companies/types";
import { createClient } from "@/lib/supabase/server";

export type CreateCompanyResult =
  | { success: true; id?: string }
  | { success: false; error: string };

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
    code: input.code.trim(),
    name: input.name.trim(),
    short_name: nullIfEmpty(input.short_name),
    country: nullIfEmpty(input.country),
    city: nullIfEmpty(input.city),
    tax_id: nullIfEmpty(input.tax_id),
    registration_number: nullIfEmpty(input.registration_number),
    email: nullIfEmpty(input.email),
    phone: nullIfEmpty(input.phone),
    website: nullIfEmpty(input.website),
    is_active: input.is_active,
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
