import { WarehouseView } from "@/components/warehouse/WarehouseView";
import { getWarehouseBoard } from "@/lib/warehouse/db";

export default async function WarehousePage() {
  const { data, stats, warehouses, products, error } = await getWarehouseBoard();

  return (
    <WarehouseView
      lots={data}
      stats={stats}
      warehouses={warehouses}
      products={products}
      error={error}
    />
  );
}
