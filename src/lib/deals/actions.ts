"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertCan } from "@/lib/platform/permissions";
import { assertCompanyAccess } from "@/lib/platform/company-scope";
import { recordEntityEvent } from "@/lib/platform/audit";
import {
  validateDealForm,
  validateDealParticipant,
  validateDealProduct,
} from "@/lib/deals/validation";
import type {
  DealFormInput,
  DealParticipantInput,
  DealProductInput,
} from "@/lib/deals/types";

export type DealActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

function nullIfEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function schemaMessage(message: string): string {
  if (/deal_|loading_port|expected_|purchase_currency|schema cache|PGRST204|PGRST205|42703|does not exist/i.test(message)) {
    return "Canonical Deal schema is not available. Review and apply the Sprint 1 migration before using this action.";
  }
  return message;
}

async function authorizeDealWrite(id: string) {
  const denied = assertCan("business_cases.write");
  if (denied) return { error: denied, companyId: null };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_cases")
    .select("id, company_id")
    .eq("id", id)
    .maybeSingle();
  if (error) return { error: error.message, companyId: null };
  if (!data) return { error: "Deal not found.", companyId: null };
  const companyError = assertCompanyAccess(data.company_id);
  return { error: companyError, companyId: data.company_id };
}

export async function updateDeal(
  id: string,
  input: DealFormInput
): Promise<DealActionResult> {
  const validation = validateDealForm(input);
  if (validation) return { success: false, error: validation };
  const access = await authorizeDealWrite(id);
  if (access.error) return { success: false, error: access.error };
  const supabase = await createClient();
  const { data: previous } = await supabase
    .from("business_cases")
    .select("title, status, incoterms, loading_port, destination_port, payment_terms")
    .eq("id", id)
    .maybeSingle();
  const row = {
    title: nullIfEmpty(input.title),
    status: input.status,
    incoterms: nullIfEmpty(input.incoterms),
    loading_port: nullIfEmpty(input.loading_port),
    destination_port: nullIfEmpty(input.destination_port),
    payment_terms: nullIfEmpty(input.payment_terms),
    expected_shipment_date: nullIfEmpty(input.expected_shipment_date),
    eta: nullIfEmpty(input.eta),
    purchase_currency: nullIfEmpty(input.purchase_currency)?.toUpperCase() ?? null,
    sales_currency: nullIfEmpty(input.sales_currency)?.toUpperCase() ?? null,
    purchase_value: input.purchase_value,
    sales_value: input.sales_value,
    expected_expenses: input.expected_expenses,
    expected_expenses_currency:
      nullIfEmpty(input.expected_expenses_currency)?.toUpperCase() ?? null,
    expected_commission: input.expected_commission,
    expected_commission_currency:
      nullIfEmpty(input.expected_commission_currency)?.toUpperCase() ?? null,
    notes: nullIfEmpty(input.notes),
  };
  const { error } = await supabase.from("business_cases").update(row).eq("id", id);
  if (error) return { success: false, error: schemaMessage(error.message) };
  await recordEntityEvent({
    entityType: "business_case",
    entityId: id,
    action: previous?.status !== row.status ? "status_changed" : "updated",
    eventType: previous?.status !== row.status ? "deal_status_changed" : "deal_updated",
    title: previous?.status !== row.status ? "Deal status changed" : "Deal updated",
    summary:
      previous?.status !== row.status
        ? `Status changed from ${previous?.status ?? "—"} to ${row.status}`
        : "Commercial terms updated",
    oldValue: previous,
    newValue: row,
  });
  revalidatePath(`/business-cases/${id}`);
  revalidatePath("/business-cases");
  return { success: true, id };
}

export async function addDealParticipant(
  input: DealParticipantInput
): Promise<DealActionResult> {
  const validation = validateDealParticipant(input);
  if (validation) return { success: false, error: validation };
  const access = await authorizeDealWrite(input.business_case_id);
  if (access.error) return { success: false, error: access.error };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_participants")
    .insert({
      business_case_id: input.business_case_id,
      counterparty_id: input.counterparty_id,
      role_code: input.role_code,
      notes: nullIfEmpty(input.notes),
    })
    .select("id")
    .single();
  if (error) return { success: false, error: schemaMessage(error.message) };
  await recordEntityEvent({
    entityType: "business_case",
    entityId: input.business_case_id,
    action: "participant_added",
    eventType: "deal_participant_changed",
    title: "Deal participant added",
    summary: `${input.role_code.replaceAll("_", " ")} participant linked`,
    newValue: { counterparty_id: input.counterparty_id, role_code: input.role_code },
    relatedEntityType: "counterparty",
    relatedEntityId: input.counterparty_id,
  });
  revalidatePath(`/business-cases/${input.business_case_id}`);
  return { success: true, id: data.id };
}

export async function addDealProduct(input: DealProductInput): Promise<DealActionResult> {
  const validation = validateDealProduct(input);
  if (validation) return { success: false, error: validation };
  const access = await authorizeDealWrite(input.business_case_id);
  if (access.error) return { success: false, error: access.error };
  const supabase = await createClient();
  const row = {
    business_case_id: input.business_case_id,
    product_id: nullIfEmpty(input.product_id),
    product_description: nullIfEmpty(input.product_description),
    size_grade: nullIfEmpty(input.size_grade),
    quantity: input.quantity,
    unit: input.unit.trim(),
    net_weight: input.net_weight,
    gross_weight: input.gross_weight,
    purchase_price: input.purchase_price,
    sales_price: input.sales_price,
    purchase_currency: nullIfEmpty(input.purchase_currency)?.toUpperCase() ?? null,
    sales_currency: nullIfEmpty(input.sales_currency)?.toUpperCase() ?? null,
  };
  const { data, error } = await supabase
    .from("deal_products")
    .insert(row)
    .select("id")
    .single();
  if (error) return { success: false, error: schemaMessage(error.message) };
  await recordEntityEvent({
    entityType: "business_case",
    entityId: input.business_case_id,
    action: "product_added",
    eventType: "deal_product_changed",
    title: "Deal product added",
    summary: `${input.quantity} ${input.unit} added to Deal`,
    newValue: row,
    relatedEntityType: input.product_id ? "product" : null,
    relatedEntityId: input.product_id,
  });
  revalidatePath(`/business-cases/${input.business_case_id}`);
  return { success: true, id: data.id };
}

export async function classifyDealContract(input: {
  dealId: string;
  contractId: string;
  role: string;
  parentContractId?: string | null;
}): Promise<DealActionResult> {
  if (!input.dealId.trim() || !input.contractId.trim()) {
    return { success: false, error: "Deal and contract are required." };
  }
  if (!['purchase', 'sales', 'annex', 'amendment', 'other'].includes(input.role)) {
    return { success: false, error: "Select a valid contract relationship." };
  }
  const access = await authorizeDealWrite(input.dealId);
  if (access.error) return { success: false, error: access.error };
  const supabase = await createClient();
  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select("id, company_id")
    .eq("id", input.contractId)
    .maybeSingle();
  if (contractError) return { success: false, error: contractError.message };
  if (!contract) return { success: false, error: "Contract not found." };
  if (!access.companyId || !contract.company_id) {
    return { success: false, error: "Deal and contract must both have company ownership." };
  }
  if (access.companyId !== contract.company_id) {
    return { success: false, error: "Contract and Deal must belong to the same company." };
  }
  const { error } = await supabase
    .from("contracts")
    .update({
      business_case_id: input.dealId,
      deal_contract_role: input.role,
      parent_contract_id: nullIfEmpty(input.parentContractId),
    })
    .eq("id", input.contractId);
  if (error) return { success: false, error: schemaMessage(error.message) };
  await recordEntityEvent({
    entityType: "business_case",
    entityId: input.dealId,
    action: "contract_linked",
    eventType: "deal_contract_linked",
    title: "Contract linked",
    summary: `Contract classified as ${input.role}`,
    relatedEntityType: "contract",
    relatedEntityId: input.contractId,
    newValue: { role: input.role, parent_contract_id: input.parentContractId ?? null },
  });
  revalidatePath(`/business-cases/${input.dealId}`);
  revalidatePath(`/contracts/${input.contractId}`);
  return { success: true, id: input.contractId };
}
