"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext, can } from "@/lib/platform/permissions";
import type { AdjustInventoryInput, IssueInventoryInput, ReceiveInventoryInput, TransferInventoryInput } from "./types";
import { validateAdjustInventoryInput, validateIssueInventoryInput, validateReceiveInventoryInput, validateTransferInventoryInput } from "./validation";

export type WarehouseActionResult = { success: true; id?: string } | { success: false; error: string };

async function post(input: ReceiveInventoryInput | IssueInventoryInput | AdjustInventoryInput, type: "inbound" | "outbound" | "adjustment"): Promise<WarehouseActionResult> {
  const context = await getAccessContext();
  const company = input.company_id || context?.companyId;
  if (!company || !await can("warehouse.write", company)) return { success: false, error: "Select an authorized stock owner company." };
  const db = await createClient();
  const { data, error } = await db.rpc("warehouse_post_movement", {
    p_company_id: company, p_warehouse_id: input.warehouse_id, p_product_id: input.product_id,
    p_quantity: type === "outbound" ? -input.quantity : input.quantity, p_lot_number: input.lot_number.trim(),
    p_movement_type: type, p_reference: ("reason" in input ? input.reason : input.reference) || null,
    p_contract_id: input.contract_id || null, p_shipment_id: input.shipment_id || null, p_business_case_id: input.business_case_id || null,
    p_production_date: "production_date" in input ? input.production_date || null : null,
    p_expiry_date: "expiry_date" in input ? input.expiry_date || null : null,
  });
  if (error) return { success: false, error: error.message };
  revalidatePath("/warehouse");
  if (input.business_case_id) revalidatePath(`/business-cases/${input.business_case_id}`);
  if (input.contract_id) revalidatePath(`/contracts/${input.contract_id}`);
  return { success: true, id: data };
}

export async function receiveInventory(input: ReceiveInventoryInput): Promise<WarehouseActionResult> { const error = validateReceiveInventoryInput(input); return error ? { success: false, error } : post(input, "inbound"); }
export async function issueInventory(input: IssueInventoryInput): Promise<WarehouseActionResult> { const error = validateIssueInventoryInput(input); return error ? { success: false, error } : post(input, "outbound"); }
export async function adjustInventory(input: AdjustInventoryInput): Promise<WarehouseActionResult> { const error = validateAdjustInventoryInput(input); return error ? { success: false, error } : post(input, "adjustment"); }

export async function transferInventory(input: TransferInventoryInput): Promise<WarehouseActionResult> {
  const invalid = validateTransferInventoryInput(input);
  if (invalid) return { success: false, error: invalid };
  const context = await getAccessContext();
  const company = input.company_id || context?.companyId;
  if (!company || !await can("warehouse.write", company)) return { success: false, error: "Select an authorized stock owner company." };
  const db = await createClient();
  const { data, error } = await db.rpc("warehouse_transfer_owned", {
    p_company_id: company, p_from_location: input.from_location, p_to_location: input.to_location,
    p_product_id: input.product_id, p_quantity: input.quantity, p_lot_number: input.lot_number.trim(),
    p_transfer_date: input.transfer_date || null, p_reference: input.reference || null,
    p_contract_id: input.contract_id || null, p_shipment_id: input.shipment_id || null, p_business_case_id: input.business_case_id || null,
  });
  if (error) return { success: false, error: error.message };
  revalidatePath("/warehouse");
  return { success: true, id: data };
}

export async function getWarehouseOperationChoices() {
  const db = await createClient();
  const context = await getAccessContext();
  const [companies, contracts, deals, shipments] = await Promise.all([
    db.from("companies").select("id, name").order("name"),
    db.from("contracts").select("id, contract_number, business_case_id").order("contract_number"),
    db.from("business_cases").select("id, title").order("title"),
    db.from("shipments").select("id, container, contract_id").order("created_at", { ascending: false }),
  ]);
  const error = companies.error || contracts.error || deals.error || shipments.error;
  return { companies: companies.data || [], contracts: contracts.data || [], deals: deals.data || [], shipments: shipments.data || [], companyId: context?.companyId || null, error: error?.message || null };
}
