import { createClient } from "@/lib/supabase/server";

export type ContractProductLine = {
  id: string;
  contract_id: string;
  product_id: string;
  quantity: number | null;
  reserved: number | null;
  packed: number | null;
  loaded: number | null;
  remaining: number | null;
  product: { id: string; sku: string; name: string } | null;
};

type ContractProductRow = {
  id: string;
  contract_id: string;
  product_id: string;
  quantity: number | null;
  reserved: number | null;
  packed: number | null;
  loaded: number | null;
  remaining: number | null;
  product:
    | { id: string; sku: string; name: string }
    | { id: string; sku: string; name: string }[]
    | null;
};

function normalizeProduct(
  value: ContractProductRow["product"]
): ContractProductLine["product"] {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export type ContractProductsResult =
  | { data: ContractProductLine[]; error: null }
  | { data: null; error: string };

export async function getContractProducts(
  contractId: string
): Promise<ContractProductsResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contract_products")
    .select(
      `
      id,
      contract_id,
      product_id,
      quantity,
      reserved,
      packed,
      loaded,
      remaining,
      product:product_id ( id, sku, name )
    `
    )
    .eq("contract_id", contractId)
    .order("created_at", { ascending: true });

  if (error) {
    return { data: null, error: error.message };
  }

  const lines = ((data ?? []) as ContractProductRow[]).map((row) => ({
    id: row.id,
    contract_id: row.contract_id,
    product_id: row.product_id,
    quantity: row.quantity,
    reserved: row.reserved,
    packed: row.packed,
    loaded: row.loaded,
    remaining: row.remaining,
    product: normalizeProduct(row.product),
  }));

  return { data: lines, error: null };
}
