"use server";

import { assertCan } from "@/lib/platform/permissions";
import { requireCoreCompany } from "@/lib/core/ownership";
import { counterpartyInputSchema, validationError, uuid } from "@/lib/core/validation";
import { getCompanyById } from "@/lib/companies";
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
    const denied = await assertCan("counterparties.write");
    if (denied) return { success: false, error: denied };
    // source_company_id is the ownership parent under the canonical Phase 2
    // trigger. This profile belongs to the represented Company, not active UI scope.
    const ownerId = await requireCoreCompany(companyId);
    const supabase = await createClient();
    const { data: company, error: companyError } = await getCompanyById(companyId);
    if (companyError || !company) return { success: false, error: companyError ?? "Company not found." };
    const bank = Array.isArray(company.bank_accounts) ? company.bank_accounts[0] : null;
    const existing = await supabase.from("counterparties").select("id, code").eq("company_id", ownerId).eq("source_company_id", companyId).maybeSingle();
    if (existing.error) return { success: false, error: existing.error.message };
    // If the link was removed earlier, reuse the old row by its company code
    // instead of inserting a second row with the same unique code.
    const codeMatch = company.code
      ? await supabase.from("counterparties").select("id, source_company_id, legal_name").eq("company_id", ownerId).eq("code", company.code).maybeSingle()
      : { data: null, error: null };
    if (codeMatch.error) return { success: false, error: codeMatch.error.message };
    const reusable = !existing.data && codeMatch.data && !codeMatch.data.source_company_id && codeMatch.data.legal_name === company.name
      ? codeMatch.data
      : null;
    const profile = { code: company.code && (!codeMatch.data || reusable || codeMatch.data.id === existing.data?.id) ? company.code : existing.data?.code ?? null, legal_name: company.name, short_name: company.short_name, counterparty_type: "buyer", country: company.country, city: company.city, address: company.address, tax_id: company.tax_id, registration_number: company.registration_number, email: company.email, phone: company.phone, website: company.website, authorized_signer_name: company.authorized_signer_name, authorized_signer_title: company.authorized_signer_title, bank_account_name: bank?.name ?? null, bank_name: bank?.bank_name ?? null, bank_address: bank?.bank_address ?? null, account_number: bank?.account_number ?? null, iban: bank?.iban ?? null, swift: bank?.swift ?? null, bank_currency: bank?.currency ?? "USD", is_active: true };
    const result = existing.data?.id
      ? await supabase.from("counterparties").update(profile).eq("company_id", ownerId).eq("id", existing.data.id).select("id").single()
      : reusable
        ? await supabase.from("counterparties").update({ source_company_id: company.id, ...profile }).eq("company_id", ownerId).eq("id", reusable.id).select("id").single()
      : await supabase.from("counterparties").insert({ company_id: ownerId, source_company_id: company.id, ...profile }).select("id").single();
    const { data, error } = result;
    if (error) return { success: false, error: error.message };
    revalidatePath("/companies"); revalidatePath("/counterparties"); revalidatePath("/contracts");
    return { success: true, id: data.id };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Unable to add company as counterparty." }; }
}

export async function unlinkCompanyFromCounterparty(counterpartyId: string): Promise<CreateCounterpartyResult> {
  const denied = await assertCan("counterparties.write");
  if (denied) return { success: false, error: denied };
  if (!uuid.safeParse(counterpartyId).success) return { success: false, error: "Invalid counterparty ID." };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("counterparties").update({ source_company_id: null }).eq("id", counterpartyId).select("id").maybeSingle();
    if (error || !data) return { success: false, error: error?.message ?? "Counterparty not found or access denied." };
    revalidatePath("/counterparties"); revalidatePath("/companies");
    return { success: true };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Unable to remove company link." }; }
}

/** Compatibility export: archive instead of deleting commercial history. */
export async function deleteCounterparty(id: string): Promise<CreateCounterpartyResult> {
  return setCounterpartyActive(id, false);
}
export async function setCounterpartyActive(id: string, active: boolean): Promise<CreateCounterpartyResult> {
  const denied = await assertCan("counterparties.write");
  if (denied) return { success: false, error: denied };
  if (!uuid.safeParse(id).success || typeof active !== "boolean") return { success: false, error: "Invalid counterparty status request." };
  const client = await createClient();
  const { data, error } = await client.from("counterparties").update({ is_active: active }).eq("id", id).select("id").maybeSingle();
  if (error || !data) return { success: false, error: error?.message ?? "Counterparty not found or access denied." };
  revalidatePath("/counterparties"); revalidatePath(`/counterparties/${id}`);
  return { success: true, id };
}

export async function updateCounterparty(id: string, input: CounterpartyFormInput): Promise<CreateCounterpartyResult> {
  try {
    const denied = await assertCan("counterparties.write");
    if (denied) return { success: false, error: denied };
    const invalid = validationError(counterpartyInputSchema, input);
    if (invalid || !uuid.safeParse(id).success) return { success: false, error: invalid ?? "Invalid counterparty ID." };
    const client = await createClient();
    const { data, error } = await client.from("counterparties").update(formInputToRow(input)).eq("id", id).select("id").maybeSingle();
    if (error || !data) return { success: false, error: error ? formatSupabaseError(error) : "Counterparty not found or access denied." };
    revalidatePath("/counterparties"); revalidatePath(`/counterparties/${id}`);
    return { success: true, id };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Unable to update counterparty." }; }
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

    const denied = await assertCan("counterparties.write");
    if (denied) return { success: false, error: denied };
    const invalid = validationError(counterpartyInputSchema, input);
    if (invalid) return { success: false, error: invalid };
    const companyId = await requireCoreCompany(input.source_company_id);
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
        .eq("company_id", companyId)
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
      .insert({ ...formInputToRow({ ...input, legal_name: legalName, code }), company_id: companyId })
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
