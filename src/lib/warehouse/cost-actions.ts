"use server";

import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/platform/permissions";

export type InventoryCostInput = {
  movement_id: string; company_id: string; warehouse_id: string; product_id: string;
  lot_id: string; lot_number: string; business_case_id: string | null;
  contract_id: string | null; shipment_id: string | null; unit: string | null;
  quantity: string; unit_cost: string | null; currency: string | null;
  cost_amount: string | null; transfer_source_id: string | null;
  remaining_quantity: string; lot_unit_cost: string | null; lot_currency: string | null;
  remaining_cost_amount: string | null; cost_known: boolean;
};

export async function getInventoryCostInput(movementId: string): Promise<{ data: InventoryCostInput | null; error: string | null }> {
  const db = await createClient();
  // The invoker RPC applies the existing warehouse RLS to every joined record.
  const { data, error } = await db.rpc("warehouse_cost_input", { p_movement_id: movementId });
  return { data, error: error?.message || null };
}

// Decimal text crosses the API unchanged; PostgreSQL numeric owns cost arithmetic.
export async function receiveCostedInventory(input: {
  company_id: string; warehouse_id: string; product_id: string; quantity: string;
  lot_number: string; unit_cost: string; currency: string;
  contract_id?: string; shipment_id?: string; business_case_id?: string; reference?: string;
}) {
  if (!await can("warehouse.write", input.company_id)) return { success: false, error: "Warehouse access denied." };
  if (!/^\d+(?:\.\d+)?$/.test(input.quantity) || !/^\d+(?:\.\d+)?$/.test(input.unit_cost) || !/^[A-Z]{3}$/.test(input.currency)) return { success: false, error: "Enter decimal quantity, cost and a three-letter currency." };
  const db = await createClient();
  const { data, error } = await db.rpc("warehouse_receive_costed", {
    p_company_id: input.company_id, p_warehouse_id: input.warehouse_id, p_product_id: input.product_id,
    p_quantity: input.quantity, p_lot_number: input.lot_number, p_unit_cost: input.unit_cost, p_currency: input.currency,
    p_contract_id: input.contract_id || null, p_shipment_id: input.shipment_id || null,
    p_business_case_id: input.business_case_id || null, p_reference: input.reference || null,
  });
  return error ? { success: false, error: error.message } : { success: true, id: data };
}
