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

function normalizeCounterpartyType(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "buyer" || normalized === "supplier" || normalized === "agent") return normalized;
  return normalized || null;
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
    source_company_id: input.source_company_id ?? null,
    code: nullIfEmpty(input.code),
    legal_name: input.legal_name.trim(),
    short_name: nullIfEmpty(input.short_name),
    counterparty_type: normalizeCounterpartyType(input.counterparty_type),
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
    bank_account_name: nullIfEmpty(input.bank_account_name),
    bank_name: nullIfEmpty(input.bank_name),
    bank_address: nullIfEmpty(input.bank_address),
    account_number: nullIfEmpty(input.account_number),
    iban: nullIfEmpty(input.iban),
    swift: nullIfEmpty(input.swift)?.toUpperCase() ?? null,
    bank_currency: nullIfEmpty(input.bank_currency)?.toUpperCase() ?? "USD",
    is_active: input.is_active,
  };
}

export async function addCompanyAsCounterparty(companyId: string): Promise<CreateCounterpartyResult> {
  try {
    const supabase = await createClient();
    const { data: company, error: companyError } = await supabase.from("companies").select("id, name, code, short_name, country, city, address, tax_id, registration_number, email, phone, website, authorized_signer_name, authorized_signer_title, bank_accounts ( name, bank_name, bank_address, account_number, iban, swift, currency )").eq("id", companyId).maybeSingle();
    if (companyError || !company) return { success: false, error: companyError?.message ?? "Company not found." };
    const bank = Array.isArray(company.bank_accounts) ? company.bank_accounts[0] : null;
    const existing = await supabase.from("counterparties").select("id").eq("source_company_id", companyId).maybeSingle();
    // If the link was removed earlier, reuse the old row by its company code
    // instead of inserting a second row with the same unique code.
    const codeMatch = !existing.data?.id && company.code
      ? await supabase.from("counterparties").select("id, source_company_id, legal_name").eq("code", company.code).maybeSingle()
      : { data: null };
    const reusable = codeMatch.data && !codeMatch.data.source_company_id && codeMatch.data.legal_name === company.name
      ? codeMatch.data
      : null;
    const profile = { code: company.code && (!codeMatch.data || reusable) ? company.code : null, legal_name: company.name, short_name: company.short_name, counterparty_type: "buyer", country: company.country, city: company.city, address: company.address, tax_id: company.tax_id, registration_number: company.registration_number, email: company.email, phone: company.phone, website: company.website, authorized_signer_name: company.authorized_signer_name, authorized_signer_title: company.authorized_signer_title, bank_account_name: bank?.name ?? null, bank_name: bank?.bank_name ?? null, bank_address: bank?.bank_address ?? null, account_number: bank?.account_number ?? null, iban: bank?.iban ?? null, swift: bank?.swift ?? null, bank_currency: bank?.currency ?? "USD", is_active: true };
    const result = existing.data?.id
      ? await supabase.from("counterparties").update(profile).eq("id", existing.data.id).select("id").single()
      : reusable
        ? await supabase.from("counterparties").update({ source_company_id: company.id, ...profile }).eq("id", reusable.id).select("id").single()
      : await supabase.from("counterparties").insert({ source_company_id: company.id, ...profile }).select("id").single();
    const { data, error } = result;
    if (error) return { success: false, error: error.message };
    revalidatePath("/companies"); revalidatePath("/counterparties"); revalidatePath("/contracts");
    return { success: true, id: data.id };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Unable to add company as counterparty." }; }
}

export async function unlinkCompanyFromCounterparty(counterpartyId: string): Promise<CreateCounterpartyResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("counterparties").update({ source_company_id: null }).eq("id", counterpartyId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/counterparties"); revalidatePath("/companies");
    return { success: true };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Unable to remove company link." }; }
}

export async function deleteCounterparty(counterpartyId: string): Promise<CreateCounterpartyResult> {
  try {
    if (!counterpartyId?.trim()) return { success: false, error: "Counterparty was not specified." };
    const supabase = await createClient();
    const { error } = await supabase.from("counterparties").delete().eq("id", counterpartyId);
    if (error) {
      if (error.code === "23503") return { success: false, error: "This counterparty is used in business records and cannot be deleted." };
      return { success: false, error: error.message || "Unable to delete counterparty." };
    }
    revalidatePath("/counterparties");
    revalidatePath("/companies");
    revalidatePath("/contracts");
    revalidatePath("/business-cases");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to delete counterparty." };
  }
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
