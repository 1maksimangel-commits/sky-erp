"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { calculateDealProfitability } from "./profitability-engine";
import type { ProfitabilityInputs } from "./profitability-inputs";
import type { DealProfitabilityReport } from "./profitability-types";

const scope = z.object({ deal_id: z.string().uuid(), company_id: z.string().uuid().nullable(), reporting_currency: z.string().regex(/^[A-Z]{3}$/) });
export async function getDealProfitability(input: z.infer<typeof scope>): Promise<{ data: DealProfitabilityReport | null; error: string | null }> {
  const parsed = scope.safeParse(input);
  if (!parsed.success) return { data: null, error: parsed.error.issues[0].message };
  const db = await createClient();
  const result = await db.rpc("profitability_inputs", { p_deal_id: parsed.data.deal_id, p_company_id: parsed.data.company_id, p_reporting_currency: parsed.data.reporting_currency });
  if (result.error) return { data: null, error: result.error.message };
  try { return { data: calculateDealProfitability(result.data as ProfitabilityInputs), error: null }; }
  catch (error) { return { data: null, error: error instanceof Error ? error.message : "Economic inputs are incomplete or invalid." }; }
}
