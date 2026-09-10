"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { shipmentLineSchema, type ShipmentLine } from "./lines";

export async function getShipmentLines(shipmentId: string): Promise<{ data: ShipmentLine[]; error: string | null }> {
  if (!z.string().uuid().safeParse(shipmentId).success) return { data: [], error: "Invalid shipment." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("shipment_lines").select("id,shipment_id,company_id,contract_product_id,product_id,description,quantity,unit,net_weight,gross_weight,origin,packing,notes").eq("shipment_id", shipmentId).order("created_at").order("id");
  return { data: data ?? [], error: error?.message ?? null };
}

export async function getShipmentContractProducts(contractId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("contract_products").select("id,product_id,description,quantity,unit").eq("contract_id", contractId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(row => ({ ...row, description: row.description ?? "Contract product", quantity: Number(row.quantity ?? 0), unit: row.unit ?? "MT" }));
}

export async function saveShipmentLines(shipmentId: string, raw: unknown): Promise<{ success: boolean; error?: string }> {
  const parsed = z.array(shipmentLineSchema).safeParse(raw);
  if (!z.string().uuid().safeParse(shipmentId).success || !parsed.success) return { success: false, error: parsed.error?.issues[0]?.message ?? "Invalid shipment." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("replace_shipment_lines", { shipment: shipmentId, lines: parsed.data });
  if (error) return { success: false, error: error.message };
  revalidatePath(`/logistics/${shipmentId}`);
  return { success: true };
}
