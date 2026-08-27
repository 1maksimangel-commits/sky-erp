"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CounterpartyFormInput } from "@/lib/counterparties/types";

export type CreateCounterpartyResult =
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
    return "Permission denied. Unable to create counterparty.";
  }

  return error.message || "Unable to save counterparty. Please try again.";
}

function formInputToRow(input: CounterpartyFormInput) {
  return {
    code: nullIfEmpty(input.code),
    legal_name: input.legal_name.trim(),
    short_name: nullIfEmpty(input.short_name),
    counterparty_type: nullIfEmpty(input.counterparty_type),
    country: nullIfEmpty(input.country),
    city: nullIfEmpty(input.city),
    address: nullIfEmpty(input.address),
    tax_id: nullIfEmpty(input.tax_id),
    registration_number: nullIfEmpty(input.registration_number),
    email: nullIfEmpty(input.email),
    phone: nullIfEmpty(input.phone),
    website: nullIfEmpty(input.website),
    is_active: input.is_active,
  };
}

export async function createCounterparty(
  input: CounterpartyFormInput
): Promise<CreateCounterpartyResult> {
  // Never throw: Next.js 16 can surface "TypeError: args.map is not a function"
  // when server actions rethrow.
  try {
    if (!input || typeof input !== "object") {
      return {
        success: false,
        error: "Invalid counterparty payload. Please reload and try again.",
      };
    }

    const legalName = (input.legal_name ?? "").trim();
    const counterpartyType = input.counterparty_type?.trim() ?? "";
    const code = (input.code ?? "").trim();

    if (!legalName) {
      return { success: false, error: "Legal name is required." };
    }

    if (!counterpartyType) {
      return { success: false, error: "Counterparty type is required." };
    }

    const supabase = await createClient();

    if (code) {
      const { data: existing, error: lookupError } = await supabase
        .from("counterparties")
        .select("id")
        .eq("code", code)
        .maybeSingle();

      if (lookupError) {
        return { success: false, error: formatSupabaseError(lookupError) };
      }

      if (existing) {
        return { success: false, error: "Code must be unique." };
      }
    }

    const { data, error } = await supabase
      .from("counterparties")
      .insert(formInputToRow({ ...input, legal_name: legalName, code }))
      .select("id")
      .single();

    if (error) {
      return { success: false, error: formatSupabaseError(error) };
    }

    revalidatePath("/counterparties");
    revalidatePath("/business-cases");
    return { success: true, id: data.id };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to save counterparty.";
    return { success: false, error: message };
  }
}
