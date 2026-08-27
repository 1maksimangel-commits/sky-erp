"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ContractFormInput } from "@/lib/contracts/form-types";
import { validateContractFormInput } from "@/lib/contracts/validation";
import { recordEntityEvent } from "@/lib/platform/audit";
import { assertCan } from "@/lib/platform/permissions";

export type ContractActionResult =
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
    return "Contract number must be unique.";
  }

  if (error.code === "23502") {
    return "A required database field is missing. Check your input and try again.";
  }

  if (error.code === "42501") {
    return "Permission denied. Unable to save contract.";
  }

  return error.message || "Unable to save contract. Please try again.";
}

function formInputToRow(input: ContractFormInput) {
  return {
    contract_number: input.contract_number.trim(),
    title: nullIfEmpty(input.title),
    company_id: input.company_id!.trim(),
    buyer_id: input.buyer_id!.trim(),
    supplier_id: input.supplier_id!.trim(),
    business_case_id: nullIfEmpty(input.business_case_id),
    currency: nullIfEmpty(input.currency) ?? "USD",
    amount: input.amount,
    incoterms: nullIfEmpty(input.incoterms),
    contract_date: nullIfEmpty(input.contract_date),
    expiry_date: nullIfEmpty(input.expiry_date),
    status: input.status.trim(),
  };
}

async function assertUniqueContractNumber(
  contractNumber: string,
  excludeId?: string
): Promise<ContractActionResult | null> {
  const supabase = await createClient();

  let query = supabase
    .from("contracts")
    .select("id")
    .eq("contract_number", contractNumber);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data: existing, error: lookupError } = await query.maybeSingle();

  if (lookupError) {
    return { success: false, error: formatSupabaseError(lookupError) };
  }

  if (existing) {
    return { success: false, error: "Contract number must be unique." };
  }

  return null;
}

function revalidateContractPaths(contractId?: string) {
  revalidatePath("/logistics");
  revalidatePath("/contracts");
  if (contractId) {
    revalidatePath(`/contracts/${contractId}`);
    revalidatePath(`/contracts/${contractId}/business-case`);
    revalidatePath(`/contracts/${contractId}/logistics`);
    revalidatePath(`/contracts/${contractId}/warehouse`);
    revalidatePath(`/contracts/${contractId}/finance`);
    revalidatePath(`/contracts/${contractId}/documents`);
    revalidatePath(`/contracts/${contractId}/history`);
  }
}

export async function createContract(
  input: ContractFormInput
): Promise<ContractActionResult> {
  const denied = assertCan("contracts.write");
  if (denied) {
    return { success: false, error: denied };
  }

  const validationError = validateContractFormInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const contractNumber = input.contract_number.trim();
  const uniquenessError = await assertUniqueContractNumber(contractNumber);
  if (uniquenessError) {
    return uniquenessError;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contracts")
    .insert(formInputToRow(input))
    .select("id, contract_number, status, business_case_id")
    .single();

  if (error) {
    return { success: false, error: formatSupabaseError(error) };
  }

  const signed = /signed|active/i.test(data.status ?? "");
  await recordEntityEvent({
    entityType: "contract",
    entityId: data.id,
    action: "created",
    eventType: signed ? "contract_signed" : "contract_created",
    title: signed ? "Contract signed" : "Contract created",
    summary: `Contract ${data.contract_number} created`,
    newValue: { contract_number: data.contract_number, status: data.status },
    notify: {
      title: "Contract created",
      body: data.contract_number,
      category: "contract",
      href: `/contracts/${data.id}`,
    },
    fanout: data.business_case_id
      ? [
          {
            entityType: "business_case",
            entityId: data.business_case_id,
            title: `Contract ${data.contract_number} linked`,
          },
        ]
      : [],
  });

  revalidateContractPaths();
  return { success: true, id: data.id };
}

export async function updateContract(
  id: string,
  input: ContractFormInput
): Promise<ContractActionResult> {
  const denied = assertCan("contracts.write");
  if (denied) {
    return { success: false, error: denied };
  }

  const validationError = validateContractFormInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const contractNumber = input.contract_number.trim();
  const uniquenessError = await assertUniqueContractNumber(contractNumber, id);
  if (uniquenessError) {
    return uniquenessError;
  }

  const supabase = await createClient();
  const { data: previous } = await supabase
    .from("contracts")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("contracts")
    .update(formInputToRow(input))
    .eq("id", id);

  if (error) {
    return { success: false, error: formatSupabaseError(error) };
  }

  const closed = /closed/i.test(input.status);
  await recordEntityEvent({
    entityType: "contract",
    entityId: id,
    action: "updated",
    eventType: closed ? "contract_closed" : "contract_updated",
    title: closed ? "Contract closed" : "Contract updated",
    summary: `Contract ${contractNumber} updated`,
    oldValue: { status: previous?.status ?? null },
    newValue: { status: input.status, contract_number: contractNumber },
  });

  revalidateContractPaths(id);
  return { success: true, id };
}

export async function deleteContract(id: string): Promise<ContractActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.from("contracts").delete().eq("id", id);

  if (error) {
    return { success: false, error: formatSupabaseError(error) };
  }

  revalidateContractPaths(id);
  return { success: true };
}
