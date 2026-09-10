"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertCan } from "@/lib/platform/permissions";

const id = z.string().uuid();
const optionalId = id.nullable().optional();
const decimal = z.string().regex(/^\d+(?:\.\d{1,12})?$/, "Enter an exact positive decimal value.").max(100);
const snapshotSchema = z.object({
  company_id: id, invoice_id: optionalId, payment_id: optionalId,
  expense_id: optionalId, commission_id: optionalId, bank_transaction_id: optionalId,
  reporting_currency: z.string().regex(/^[A-Z]{3}$/), reporting_date: z.string().date(),
  exchange_rate_id: optionalId,
});
const allocationSchema = z.object({
  company_id: id, expense_id: optionalId, commission_id: optionalId,
  business_case_id: optionalId, contract_id: optionalId, shipment_id: optionalId,
  product_id: optionalId, contract_product_id: optionalId, deal_product_id: optionalId,
  basis: z.enum(["direct", "quantity", "net_weight", "gross_weight", "value", "percentage", "manual"]),
  basis_value: decimal.nullable().optional(), amount: decimal,
  currency: z.string().regex(/^[A-Z]{3}$/), notes: z.string().max(4000).optional(),
});

/** Explicitly capture posted source values; database derives immutable FX inputs. */
export async function captureReportingInput(input: z.infer<typeof snapshotSchema>) {
  const denied = await assertCan("finance.write");
  if (denied) return { success: false, error: denied };
  const parsed = snapshotSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const db = await createClient();
  const result = await db.rpc("economics_capture_reporting_input", { p_input: parsed.data });
  if (result.error) return { success: false, error: result.error.message };
  return { success: true, id: result.data as string };
}

/** Amounts and basis are explicit; this never guesses splits or computes profit. */
export async function allocateOperationalCost(input: z.infer<typeof allocationSchema>) {
  const denied = await assertCan("finance.write");
  if (denied) return { success: false, error: denied };
  const parsed = allocationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const db = await createClient();
  const result = await db.rpc("economics_allocate_cost", { p_input: parsed.data });
  if (result.error) return { success: false, error: result.error.message };
  return { success: true, id: result.data as string };
}

export async function getReportingInput(snapshotId: string) {
  if (!id.safeParse(snapshotId).success) return { data: null, error: "Invalid snapshot identifier." };
  const db = await createClient();
  const result = await db.rpc("economics_reporting_input", { p_id: snapshotId });
  return { data: result.data, error: result.error?.message ?? null };
}
