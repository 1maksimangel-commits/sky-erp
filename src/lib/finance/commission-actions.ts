"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertCan } from "@/lib/platform/permissions";
import type { CommissionInput, CommissionRecord } from "./commissiontypes";

const id = z.string().uuid();
const optionalId = id.nullable().optional();
const decimal = z.string().regex(/^\d+(?:\.\d{1,12})?$/).max(100);
const schema = z.object({
  company_id: id, business_case_id: id, contract_id: optionalId, beneficiary_id: optionalId,
  beneficiary_name: z.string().trim().min(1).max(500), beneficiary_type: z.enum(["agent", "broker", "intermediary", "external_counterparty", "company", "person", "other"]),
  label: z.string().trim().min(1).max(500), basis: z.enum(["fixed", "per_mt", "per_kg", "percentage"]),
  rate: decimal, base_quantity: decimal.nullable().optional(), base_amount: decimal.nullable().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/), calculation_base: z.enum(["quantity", "net_weight", "gross_weight", "sale_revenue", "purchase_value", "gross_profit", "manual", "contract_amount", "contract_net_weight", "deal_net_weight"]),
  override_amount: decimal.nullable().optional(), override_reason: z.string().max(4000).nullable().optional(),
  status: z.enum(["Draft", "Posted"]), confirmed: z.boolean(), notes: z.string().max(4000).nullable().optional(),
  allocation: z.object({ scope: z.enum(["deal", "contract", "contract_product", "deal_product"]), contract_product_id: optionalId, deal_product_id: optionalId }),
});

export async function previewCommission(input: CommissionInput): Promise<
  { success: true; data: { calculated_amount: string; final_amount: string; base_value: string | null } } | { success: false; error: string }
> {
  const denied = await assertCan("finance.read");
  if (denied) return { success: false, error: denied };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const db = await createClient();
  const result = await db.rpc("profitability_preview_commission", { p_input: parsed.data });
  if (result.error) return { success: false, error: result.error.message };
  return { success: true, data: result.data };
}

async function save(idValue: string | null, previous: string | null, input: CommissionInput) {
  const denied = await assertCan("finance.write");
  if (denied) return { success: false as const, error: denied };
  if ((idValue && !id.safeParse(idValue).success) || (previous && !id.safeParse(previous).success)) return { success: false as const, error: "Invalid commission identifier." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message };
  const db = await createClient();
  const result = await db.rpc("profitability_save_commission", { p_id: idValue, p_previous: previous, p_input: parsed.data });
  if (result.error) return { success: false as const, error: result.error.message };
  revalidatePath(`/business-cases/${input.business_case_id}`);
  revalidatePath("/finance/commissions");
  return { success: true as const, id: String(result.data) };
}

export async function saveProfitabilityCommission(idValue: string | null, input: CommissionInput) { return save(idValue, null, input); }
export async function reviseProfitabilityCommission(previousId: string, input: CommissionInput) { return save(null, previousId, input); }

export async function allocateCommissionPayment(commissionId: string, paymentId: string, amount: string) {
  const denied = await assertCan("finance.write");
  if (denied) return { success: false as const, error: denied };
  if (!id.safeParse(commissionId).success || !id.safeParse(paymentId).success || !decimal.safeParse(amount).success) return { success: false as const, error: "Select canonical commission/payment and enter an exact amount." };
  const db = await createClient();
  const result = await db.from("payment_allocations").insert({ commission_id: commissionId, payment_id: paymentId, amount }).select("id").single();
  if (result.error) return { success: false as const, error: result.error.message };
  revalidatePath("/finance/commissions"); revalidatePath("/finance/payments"); revalidatePath("/business-cases");
  return { success: true as const, id: String(result.data.id) };
}

export async function getCommissionInputs(dealId: string, companyIds: string[]): Promise<{ data: CommissionRecord[]; error: string | null }> {
  if (!id.safeParse(dealId).success || !z.array(id).min(1).safeParse(companyIds).success) return { data: [], error: "Select a valid Deal and companies." };
  const db = await createClient();
  const result = await db.rpc("profitability_commission_inputs", { p_deal_id: dealId, p_company_ids: companyIds });
  return { data: result.data ?? [], error: result.error?.message ?? null };
}

export async function getCommissionChoices(dealId: string, companyId: string) {
  if (!id.safeParse(dealId).success || !id.safeParse(companyId).success) return { counterparties: [], payments: [], error: "Select a valid Deal and Company." };
  const denied = await assertCan("finance.read");
  if (denied) return { counterparties: [], payments: [], error: denied };
  const db = await createClient();
  const [parties, payments] = await Promise.all([
    db.from("counterparties").select("id,legal_name").eq("company_id", companyId).eq("is_active", true).order("legal_name"),
    db.from("payments").select("id,reference,currency,amount,status,payee_counterparty_id").eq("company_id", companyId).eq("business_case_id", dealId).in("status", ["Paid", "Pending"]),
  ]);
  return { counterparties: parties.data ?? [], payments: payments.data ?? [], error: parties.error?.message ?? payments.error?.message ?? null };
}
