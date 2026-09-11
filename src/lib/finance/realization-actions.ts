"use server";

import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/platform/permissions";

export type InventoryProfitabilityInput = {
  realization_id: string; company_id: string; invoice_id: string; invoice_item_id: string;
  contract_id: string; contract_product_id: string; product_id: string; stock_movement_id: string;
  quantity: string; unit: string; recognition_date: string; invoice_status: string;
  local_unit_cost: string | null; local_currency: string | null; local_fx_rate: string | null; local_snapshot_id: string | null;
  ultimate_unit_cost: string | null; ultimate_currency: string | null; ultimate_fx_rate: string | null;
  ultimate_snapshot_id: string | null; ultimate_source_movement_id: string | null; ultimate_company_id: string | null;
  acquisition_internal: boolean | null; acquisition_seller_company_id: string | null;
  lineage_gap: boolean; fx_gap: boolean; source_ids: string[];
};

export async function createSaleRealization(input: {
  company_id: string; invoice_item_id: string; stock_movement_id: string;
  contract_product_id: string; quantity: string; recognition_date: string;
}) {
  if (!await can("finance.write", input.company_id)) return { success: false, error: "Sale recognition access denied." };
  if (!/^\d+(?:\.\d+)?$/.test(input.quantity)) return { success: false, error: "Enter an exact positive decimal quantity." };
  const db = await createClient();
  const { data, error } = await db.rpc("profitability_realize_sale", { p_input: input });
  return error ? { success: false, error: error.message } : { success: true, id: data };
}

export async function linkIntercompanyReceipt(input: {
  company_id: string; receipt_movement_id: string; seller_realization_id: string;
}) {
  if (!await can("finance.write", input.company_id)) return { success: false, error: "Receipt lineage access denied." };
  const db = await createClient();
  const { data, error } = await db.rpc("profitability_link_receipt", { p_input: input });
  return error ? { success: false, error: error.message } : { success: true, id: data };
}

export async function getProfitabilityInventoryInputs(dealId: string, companyIds: string[], reportingCurrency: string): Promise<{ data: InventoryProfitabilityInput[]; error: string | null }> {
  const db = await createClient();
  const { data, error } = await db.rpc("profitability_inventory_inputs", { p_deal_id: dealId, p_company_ids: companyIds, p_reporting_currency: reportingCurrency });
  return { data: data || [], error: error?.message || null };
}

export async function captureRecognitionReportingInput(input: {
  company_id: string; contract_id?: string; stock_movement_id?: string;
  reporting_currency: string; reporting_date: string; exchange_rate_id?: string;
}) {
  if (!await can("finance.write", input.company_id)) return { success: false, error: "Reporting input access denied." };
  const db = await createClient();
  const { data, error } = await db.rpc("economics_capture_reporting_input", { p_input: input });
  return error ? { success: false, error: error.message } : { success: true, id: data };
}

export async function getRealizationChoices(dealId: string) {
  const db = await createClient();
  const [invoices, movements, realizations, contracts] = await Promise.all([
    db.from("invoices").select("id,invoice_number,issuer_company_id,recipient_company_id,items:invoice_items(id,description,product_id)").eq("business_case_id", dealId).in("status", ["Issued", "Partially Paid", "Paid", "Overdue"]),
    db.from("stock_movements").select("id,company_id,contract_id,product_id,lot_number,movement_type").eq("business_case_id", dealId),
    db.from("sale_realizations").select("id,company_id,invoice_item_id,stock_movement_id").eq("business_case_id", dealId),
    db.from("contracts").select("id").eq("business_case_id", dealId),
  ]);
  const contractProducts = contracts.data?.length
    ? await db.from("contract_products").select("id,contract_id,product_id,description,unit").in("contract_id", contracts.data.map(row => row.id))
    : { data: [], error: null };
  return { invoices: invoices.data || [], movements: movements.data || [], realizations: realizations.data || [], contractProducts: contractProducts.data || [], error: (invoices.error || movements.error || realizations.error || contracts.error || contractProducts.error)?.message || null };
}
