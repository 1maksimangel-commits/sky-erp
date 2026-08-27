"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  AdjustInventoryInput,
  IssueInventoryInput,
  ReceiveInventoryInput,
  TransferInventoryInput,
} from "@/lib/warehouse/types";
import {
  validateAdjustInventoryInput,
  validateIssueInventoryInput,
  validateReceiveInventoryInput,
  validateTransferInventoryInput,
} from "@/lib/warehouse/validation";
import { recordEntityEvent } from "@/lib/platform/audit";
import { assertCan } from "@/lib/platform/permissions";

export type WarehouseActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

function nullIfEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formatRpcError(error: { message: string }): string {
  if (
    /warehouse_|inventory|stock_movements|schema cache|does not exist|PGRST202|PGRST205|42703/i.test(
      error.message
    )
  ) {
    return "Warehouse schema is incomplete. Apply supabase/migrations/20260804170000_warehouse_module.sql in the Supabase SQL Editor.";
  }

  return error.message.replace(/^ERROR:\s*/i, "").replace(/\n/g, " ") ||
    "Warehouse operation failed. Please try again.";
}

function revalidateWarehousePaths() {
  revalidatePath("/warehouse");
  revalidatePath("/products");
}

export async function receiveInventory(
  input: ReceiveInventoryInput
): Promise<WarehouseActionResult> {
  const denied = assertCan("warehouse.write");
  if (denied) {
    return { success: false, error: denied };
  }

  const validationError = validateReceiveInventoryInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("warehouse_receive_stock", {
    p_warehouse_id: input.warehouse_id,
    p_product_id: input.product_id,
    p_quantity: input.quantity,
    p_lot_number: input.lot_number.trim(),
    p_production_date: nullIfEmpty(input.production_date),
    p_expiry_date: nullIfEmpty(input.expiry_date),
    p_reference: nullIfEmpty(input.reference),
    p_contract_id: nullIfEmpty(input.contract_id),
    p_shipment_id: nullIfEmpty(input.shipment_id),
    p_business_case_id: nullIfEmpty(input.business_case_id),
  });

  if (error) {
    return { success: false, error: formatRpcError(error) };
  }

  const lotId = data as string;
  await recordEntityEvent({
    entityType: "warehouse_lot",
    entityId: lotId,
    action: "received",
    eventType: "warehouse_received",
    title: "Warehouse received",
    summary: `Received ${input.quantity} on lot ${input.lot_number.trim()}`,
    newValue: {
      quantity: input.quantity,
      lot_number: input.lot_number.trim(),
      product_id: input.product_id,
    },
    notify: {
      title: "Warehouse received",
      body: input.lot_number.trim(),
      category: "warehouse",
      href: `/warehouse/lots/${lotId}`,
    },
    fanout: [
      ...(input.shipment_id
        ? [{ entityType: "shipment", entityId: input.shipment_id }]
        : []),
      ...(input.contract_id
        ? [{ entityType: "contract", entityId: input.contract_id }]
        : []),
      ...(input.business_case_id
        ? [{ entityType: "business_case", entityId: input.business_case_id }]
        : []),
    ],
  });

  revalidateWarehousePaths();
  return { success: true, id: lotId };
}

export async function issueInventory(
  input: IssueInventoryInput
): Promise<WarehouseActionResult> {
  const denied = assertCan("warehouse.write");
  if (denied) {
    return { success: false, error: denied };
  }

  const validationError = validateIssueInventoryInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("warehouse_issue_stock", {
    p_warehouse_id: input.warehouse_id,
    p_product_id: input.product_id,
    p_quantity: input.quantity,
    p_lot_number: input.lot_number.trim(),
    p_reference: nullIfEmpty(input.reference),
    p_contract_id: nullIfEmpty(input.contract_id),
    p_shipment_id: nullIfEmpty(input.shipment_id),
    p_business_case_id: nullIfEmpty(input.business_case_id),
  });

  if (error) {
    return { success: false, error: formatRpcError(error) };
  }

  revalidateWarehousePaths();
  return { success: true, id: data as string };
}

export async function transferInventory(
  input: TransferInventoryInput
): Promise<WarehouseActionResult> {
  const denied = assertCan("warehouse.write");
  if (denied) {
    return { success: false, error: denied };
  }

  const validationError = validateTransferInventoryInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("warehouse_transfer_stock", {
    p_from_location: input.from_location,
    p_to_location: input.to_location,
    p_product_id: input.product_id,
    p_quantity: input.quantity,
    p_lot_number: input.lot_number.trim(),
    p_transfer_date: nullIfEmpty(input.transfer_date),
    p_reference: nullIfEmpty(input.reference),
  });

  if (error) {
    return { success: false, error: formatRpcError(error) };
  }

  revalidateWarehousePaths();
  return { success: true, id: data as string };
}

export async function adjustInventory(
  input: AdjustInventoryInput
): Promise<WarehouseActionResult> {
  const denied = assertCan("warehouse.write");
  if (denied) {
    return { success: false, error: denied };
  }

  const validationError = validateAdjustInventoryInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("warehouse_adjust_stock", {
    p_warehouse_id: input.warehouse_id,
    p_product_id: input.product_id,
    p_quantity: input.quantity,
    p_lot_number: input.lot_number.trim(),
    p_reason: nullIfEmpty(input.reason),
    p_production_date: nullIfEmpty(input.production_date),
    p_expiry_date: nullIfEmpty(input.expiry_date),
  });

  if (error) {
    return { success: false, error: formatRpcError(error) };
  }

  revalidateWarehousePaths();
  return { success: true, id: data as string };
}
