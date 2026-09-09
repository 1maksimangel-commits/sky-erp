"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BusinessCaseFormInput } from "@/lib/business-cases/types";
import { recordEntityEvent } from "@/lib/platform/audit";
import { assertCan } from "@/lib/platform/permissions";

export type CreateBusinessCaseResult =
  | { success: true; id?: string }
  | { success: false; error: string };

function nullIfEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isUniqueViolation(error: { code?: string; message: string }): boolean {
  return error.code === "23505" || /unique|duplicate/i.test(error.message);
}

function formInputToRow(input: BusinessCaseFormInput) {
  return {
    case_number: input.case_number.trim(),
    case_type: nullIfEmpty(input.case_type),
    title: nullIfEmpty(input.title),
    company_id: nullIfEmpty(input.company_id),
    buyer_id: nullIfEmpty(input.buyer_id),
    supplier_id: nullIfEmpty(input.supplier_id),
    consignee_id: nullIfEmpty(input.consignee_id),
    status: nullIfEmpty(input.status) ?? "Draft",
    contract_number: nullIfEmpty(input.contract_number),
    contract_date: nullIfEmpty(input.contract_date),
    currency: nullIfEmpty(input.currency) ?? "USD",
    contract_amount: input.contract_amount,
    incoterms: nullIfEmpty(input.incoterms),
  };
}

export async function createBusinessCase(
  input: BusinessCaseFormInput
): Promise<CreateBusinessCaseResult> {
  const denied = await assertCan("business_cases.write");
  if (denied) {
    return { success: false, error: denied };
  }

  const caseNumber = input.case_number.trim();

  if (!caseNumber) {
    return { success: false, error: "Case number is required." };
  }

  if (!nullIfEmpty(input.company_id)) {
    return {
      success: false,
      error: "Company is required for every Deal.",
    };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("business_cases")
    .select("id")
    .eq("case_number", caseNumber)
    .maybeSingle();

  if (existing) {
    return { success: false, error: "Case number must be unique." };
  }

  const { data, error } = await supabase
    .from("business_cases")
    .insert(formInputToRow(input))
    .select("id, case_number")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      return { success: false, error: "Case number must be unique." };
    }

    return { success: false, error: error.message };
  }

  await recordEntityEvent({
    entityType: "business_case",
    entityId: data.id,
    action: "created",
    eventType: "business_case_created",
    title: "Deal created",
    summary: `Deal ${data.case_number} created`,
    newValue: { case_number: data.case_number, status: input.status },
    notify: {
      title: "Deal created",
      body: data.case_number,
      category: "business_case",
      href: `/business-cases/${data.id}`,
    },
  });

  revalidatePath("/business-cases");
  revalidatePath("/dashboard");
  return { success: true, id: data.id };
}
