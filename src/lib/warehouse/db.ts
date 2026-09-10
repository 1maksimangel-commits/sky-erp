import { createClient } from "@/lib/supabase/server";
import { LOW_STOCK_THRESHOLD } from "@/lib/warehouse/types";

export type WarehouseLocation = {
  id: string;
  code: string;
  name: string;
  type: string | null;
  status: string | null;
};

export type WarehouseProductOption = {
  id: string;
  sku: string;
  name: string;
  unit?: string | null;
};

export type InventoryLotRow = {
  company_id: string;
  owner_name: string;
  unit: string | null;
  id: string;
  lot_number: string;
  production_date: string | null;
  expiry_date: string | null;
  quantity: number;
  status: string;
  available: number;
  reserved: number;
  total: number;
  warehouse: WarehouseLocation | null;
  product: WarehouseProductOption | null;
  inventory_id: string;
  warehouse_id: string;
  product_id: string;
};

export type WarehouseStats = {
  unitTotals: { unit: string; totalStock: number; reserved: number; available: number }[];
  totalStock: number;
  reserved: number;
  available: number;
  lowStock: number;
};

export type WarehouseBoardResult =
  | {
      data: InventoryLotRow[];
      stats: WarehouseStats;
      warehouses: WarehouseLocation[];
      products: WarehouseProductOption[];
      error: null;
    }
  | {
      data: null;
      stats: null;
      warehouses: WarehouseLocation[];
      products: WarehouseProductOption[];
      error: string;
    };

type InventoryRelation = {
  product_name: string | null;
  product_sku: string | null;
  unit: string | null;
  company_id: string;
  owner: { name: string } | { name: string }[] | null;
  id: string;
  warehouse_id: string;
  product_id: string;
  quantity: number | string | null;
  available_quantity: number | string | null;
  reserved_quantity: number | string | null;
  warehouse: WarehouseLocation | WarehouseLocation[] | null;
  product: WarehouseProductOption | WarehouseProductOption[] | null;
};

type LotQueryRow = {
  id: string;
  lot_number: string;
  production_date: string | null;
  expiry_date: string | null;
  quantity: number | string | null;
  status: string;
  inventory: InventoryRelation | InventoryRelation[] | null;
};

function toNumber(value: number | string | null | undefined): number {
  if (value == null) {
    return 0;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeLot(row: LotQueryRow): InventoryLotRow | null {
  const inventory = firstRelation(row.inventory);
  if (!inventory) {
    return null;
  }

  const warehouse = firstRelation(inventory.warehouse);
  const product = firstRelation(inventory.product) || (inventory.product_name ? { id: inventory.product_id, name: inventory.product_name, sku: inventory.product_sku || "", unit: inventory.unit } : null);
  const lotQty = toNumber(row.quantity);
  const invAvailable = toNumber(inventory.available_quantity);
  const invReserved = toNumber(inventory.reserved_quantity);
  const invTotal = toNumber(inventory.quantity);

  // Spread inventory reserved across lots by quantity share for row display.
  const reservedShare =
    invTotal > 0 ? (lotQty / invTotal) * invReserved : 0;
  const availableShare =
    invTotal > 0 ? (lotQty / invTotal) * invAvailable : lotQty;

  return {
    company_id: inventory.company_id,
    owner_name: firstRelation(inventory.owner)?.name || "Unassigned owner",
    unit: inventory.unit,
    id: row.id,
    lot_number: row.lot_number,
    production_date: row.production_date,
    expiry_date: row.expiry_date,
    quantity: lotQty,
    status: row.status,
    available: Number(availableShare.toFixed(3)),
    reserved: Number(reservedShare.toFixed(3)),
    total: lotQty,
    warehouse,
    product,
    inventory_id: inventory.id,
    warehouse_id: inventory.warehouse_id,
    product_id: inventory.product_id,
  };
}

function computeStatsFromInventory(
  rows: {
    unit?: string | null;
    quantity: number | string | null;
    available_quantity: number | string | null;
    reserved_quantity: number | string | null;
  }[]
): WarehouseStats {
  let totalStock = 0;
  let reserved = 0;
  let available = 0;
  let lowStock = 0;
  const byUnit = new Map<string, { unit: string; totalStock: number; reserved: number; available: number }>();

  for (const item of rows) {
    const total = toNumber(item.quantity);
    const avail = toNumber(item.available_quantity);
    const res = toNumber(item.reserved_quantity);
    totalStock += total;
    reserved += res;
    available += avail;
    const unit = item.unit || "unspecified unit";
    const totals = byUnit.get(unit) || { unit, totalStock: 0, reserved: 0, available: 0 };
    totals.totalStock += total; totals.reserved += res; totals.available += avail;
    byUnit.set(unit, totals);
    if (avail > 0 && avail <= LOW_STOCK_THRESHOLD) {
      lowStock += 1;
    }
  }

  return {
    unitTotals: Array.from(byUnit.values()),
    totalStock: Number(totalStock.toFixed(3)),
    reserved: Number(reserved.toFixed(3)),
    available: Number(available.toFixed(3)),
    lowStock,
  };
}

const MISSING_SCHEMA_HINT =
  "Warehouse data is unavailable. Ask your administrator to verify the canonical database replay gate.";

function formatLoadError(message: string): string {
  if (
    /warehouse_locations|inventory_lots|stock_movements|warehouse_transfers|inventory_reservations|schema cache|does not exist|PGRST205|42703/i.test(
      message
    )
  ) {
    return MISSING_SCHEMA_HINT;
  }
  return message || "Unable to load warehouse data from Supabase.";
}

export async function getWarehouseLocations(): Promise<WarehouseLocation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("warehouse_locations")
    .select("id, code, name, type, status")
    .order("code");

  if (error) {
    return [];
  }

  return data ?? [];
}

export async function getWarehouseProductOptions(): Promise<
  WarehouseProductOption[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, sku, name, unit")
    .eq("is_active", true)
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  const ownedStock = await supabase.from("inventory").select("product_id, product_name, product_sku, unit");
  if (ownedStock.error) throw new Error(ownedStock.error.message);
  const options = new Map<string, WarehouseProductOption>((data || []).map((item) => [item.id, item]));
  for (const item of ownedStock.data || []) {
    if (!options.has(item.product_id) && item.product_name) options.set(item.product_id, { id: item.product_id, name: item.product_name, sku: item.product_sku || "", unit: item.unit });
    const option = options.get(item.product_id);
    if (option && item.unit) options.set(item.product_id, { ...option, unit: item.unit });
  }
  return Array.from(options.values());
}

export async function getWarehouseBoard(): Promise<WarehouseBoardResult> {
  const supabase = await createClient();

  const [lotsResult, inventoryResult, warehouses, products] = await Promise.all([
    supabase
      .from("inventory_lots")
      .select(
        `
        id,
        lot_number,
        production_date,
        expiry_date,
        quantity,
        status,
        inventory:inventory_id (
          product_name,
          product_sku,
          unit,
          company_id,
          owner:company_id ( name ),
          id,
          warehouse_id,
          product_id,
          quantity,
          available_quantity,
          reserved_quantity,
          warehouse:warehouse_id ( id, code, name, type, status ),
          product:product_id ( id, sku, name )
        )
      `
      )
      .order("expiry_date", { ascending: true, nullsFirst: false })
      .order("lot_number", { ascending: true }),
    supabase
      .from("inventory")
      .select("quantity, available_quantity, reserved_quantity, unit"),
    getWarehouseLocations(),
    getWarehouseProductOptions(),
  ]);

  if (lotsResult.error) {
    return {
      data: null,
      stats: null,
      warehouses,
      products,
      error: formatLoadError(lotsResult.error.message),
    };
  }

  if (inventoryResult.error) {
    return {
      data: null,
      stats: null,
      warehouses,
      products,
      error: formatLoadError(inventoryResult.error.message),
    };
  }

  const rows = ((lotsResult.data ?? []) as unknown as LotQueryRow[])
    .map(normalizeLot)
    .filter((row): row is InventoryLotRow => Boolean(row));

  return {
    data: rows,
    stats: computeStatsFromInventory(inventoryResult.data ?? []),
    warehouses,
    products,
    error: null,
  };
}

export async function getWarehouseLotById(
  id: string
): Promise<
  | { data: InventoryLotRow; error: null }
  | { data: null; error: string }
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_lots")
    .select(
      `
      id,
      lot_number,
      production_date,
      expiry_date,
      quantity,
      status,
      inventory:inventory_id (
        product_name,
        product_sku,
        unit,
        company_id,
        owner:company_id ( name ),
        id,
        warehouse_id,
        product_id,
        quantity,
        available_quantity,
        reserved_quantity,
        warehouse:warehouse_id ( id, code, name, type, status ),
        product:product_id ( id, sku, name )
      )
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { data: null, error: formatLoadError(error.message) };
  }

  if (!data) {
    return { data: null, error: "Lot not found." };
  }

  const lot = normalizeLot(data as unknown as LotQueryRow);
  if (!lot) {
    return {
      data: null,
      error: "Lot inventory relation is missing.",
    };
  }

  return { data: lot, error: null };
}
