"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertCan } from "@/lib/platform/permissions";
import type { FinanceActionResult } from "./actions";
import { basisDecimal, moneyDecimal } from "./decimal";

const optionalId = z.string().uuid().nullable().optional();
const scope = {
  company_id: z.string().uuid(),
  business_case_id: optionalId,
  contract_id: optionalId,
};
function decimalInput(convert: (value: number | string) => string) {
  return z.union([z.number(), z.string()]).transform((value, context) => {
    try {
      const normalized = convert(value);
      if (normalized.startsWith("-") || String(value).trim().startsWith("-")) throw new Error("Value must be nonnegative.");
      return normalized;
    } catch (error) {
      context.addIssue({ code: "custom", message: error instanceof Error ? error.message : "Invalid decimal value." });
      return z.NEVER;
    }
  });
}
const amount = decimalInput(moneyDecimal);
const positiveAmount = amount.refine(value => value !== "0.00", "Amount must be greater than zero after monetary rounding.");
const basisValue = decimalInput(basisDecimal);
const expenseSchema = z.object({ ...scope, shipment_id: optionalId,
  supplier_id: optionalId, category_id: optionalId, bank_account_id: optionalId,
  expense_date: z.string().date(), currency: z.string().regex(/^[A-Z]{3}$/),
  amount, description: z.string().trim().min(1), reference: z.string().nullable().optional(),
  status: z.enum(["Draft", "Posted", "Cancelled"]),
});
const commissionSchema = z.object({ ...scope, business_case_id: z.string().uuid(),
  beneficiary_id: optionalId, label: z.string().trim().min(1),
  currency: z.string().regex(/^[A-Z]{3}$/), basis: z.enum(["fixed", "per_mt", "per_kg", "percentage"]),
  rate: basisValue, base_quantity: basisValue.nullable().optional(), base_amount: amount.nullable().optional(),
  status: z.enum(["Draft", "Posted", "Cancelled"]),
});
export type ExpenseInput = z.input<typeof expenseSchema>;
export type CommissionInput = z.input<typeof commissionSchema>;

const paymentSchema = z.object({ ...scope, payer_company_id: optionalId, payer_counterparty_id: optionalId,
  payee_company_id: optionalId, payee_counterparty_id: optionalId, bank_account_id: optionalId,
  amount: positiveAmount, currency: z.string().regex(/^[A-Z]{3}$/),
  payment_date: z.string().date(), reference: z.string().nullable().optional(), notes: z.string().nullable().optional(),
  status: z.enum(["Pending", "Paid"]),
});
export type StandalonePaymentInput = z.input<typeof paymentSchema>;

export async function registerStandalonePayment(input: StandalonePaymentInput): Promise<FinanceActionResult> {
  const denied = await assertCan("finance.write");
  if (denied) return { success: false, error: denied };
  const checked = paymentSchema.safeParse(input);
  if (!checked.success) return { success: false, error: checked.error.issues[0].message };
  const db = await createClient();
  const result = await db.from("payments").insert(checked.data).select("id").single();
  if (result.error) return { success: false, error: result.error.message };
  revalidatePath("/finance/payments");
  return { success: true, id: result.data.id };
}

export async function saveExpense(id: string | null, input: ExpenseInput): Promise<FinanceActionResult> {
  const denied = await assertCan("finance.write");
  if (denied) return { success: false, error: denied };
  const checked = expenseSchema.safeParse(input);
  if (!checked.success) return { success: false, error: checked.error.issues[0].message };
  const db = await createClient();
  const result = id ? await db.from("expenses").update(checked.data).eq("id", id).select("id").single() : await db.from("expenses").insert(checked.data).select("id").single();
  if (result.error) return { success: false, error: result.error.message };
  revalidatePath("/finance/expenses"); revalidatePath("/business-cases");
  return { success: true, id: result.data.id };
}

export async function saveCommission(id: string | null, input: CommissionInput): Promise<FinanceActionResult> {
  const denied = await assertCan("finance.write");
  if (denied) return { success: false, error: denied };
  const checked = commissionSchema.safeParse(input);
  if (!checked.success) return { success: false, error: checked.error.issues[0].message };
  const db = await createClient();
  const result = id ? await db.from("deal_commission_links").update(checked.data).eq("id", id).select("id").single() : await db.from("deal_commission_links").insert(checked.data).select("id").single();
  if (result.error) return { success: false, error: result.error.message };
  revalidatePath("/finance/commissions"); revalidatePath("/business-cases");
  return { success: true, id: result.data.id };
}

export async function allocatePayment(paymentId: string, invoiceId: string, allocationAmount: number | string): Promise<FinanceActionResult> {
  const denied = await assertCan("finance.write");
  if (denied) return { success: false, error: denied };
  const checked = positiveAmount.safeParse(allocationAmount);
  if (!z.string().uuid().safeParse(paymentId).success || !z.string().uuid().safeParse(invoiceId).success || !checked.success) return { success: false, error: "Valid payment, invoice and positive exact amount required." };
  const db = await createClient();
  const result = await db.from("payment_allocations").insert({ payment_id: paymentId, invoice_id: invoiceId, amount: checked.data }).select("id").single();
  if (result.error) return { success: false, error: result.error.message };
  revalidatePath("/finance/invoices"); revalidatePath("/finance/payments");
  return { success: true, id: result.data.id };
}

export async function setPaymentStatus(id: string, status: "Pending" | "Paid" | "Cancelled"): Promise<FinanceActionResult> {
  const denied = await assertCan("finance.write");
  if (denied) return { success: false, error: denied };
  if (!["Pending", "Paid", "Cancelled"].includes(status)) return { success: false, error: "Invalid payment status." };
  const db = await createClient();
  const result = await db.from("payments").update({ status }).eq("id", id).select("id").single();
  if (result.error) return { success: false, error: result.error.message };
  revalidatePath("/finance/invoices"); revalidatePath("/finance/payments");
  return { success: true, id: result.data.id };
}
