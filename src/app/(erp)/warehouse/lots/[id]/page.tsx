import { notFound } from "next/navigation";
import { DetailGrid, DetailItem } from "@/components/platform/DetailGrid";
import { EntityWorkspace } from "@/components/platform/EntityWorkspace";
import { formatWarehouseDate } from "@/lib/warehouse/format";
import { getWarehouseLotById } from "@/lib/warehouse/db";
import { getEntityWorkspaceBundle } from "@/lib/platform/entity-bundle";

export default async function WarehouseLotDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const [{ data: lot }, bundle] = await Promise.all([
    getWarehouseLotById(id),
    getEntityWorkspaceBundle("warehouse_lot", id),
  ]);

  if (!lot) {
    notFound();
  }

  return (
    <EntityWorkspace
      entityType="warehouse_lot"
      entityId={id}
      title={lot.lot_number}
      subtitle={lot.product?.name}
      status={lot.status}
      breadcrumbHref="/warehouse"
      breadcrumbLabel="Warehouse"
      timeline={bundle.timeline}
      activity={bundle.activity}
      documents={bundle.documents}
      documentUrls={bundle.documentUrls}
      linked={bundle.linked}
      overview={
        <DetailGrid>
          <DetailItem label="Lot Number" value={lot.lot_number} />
          <DetailItem label="Product" value={lot.product?.name} />
          <DetailItem label="SKU" value={lot.product?.sku} />
          <DetailItem label="Warehouse" value={lot.warehouse?.name} />
          <DetailItem label="Available" value={lot.available} />
          <DetailItem label="Reserved" value={lot.reserved} />
          <DetailItem label="Total" value={lot.total} />
          <DetailItem
            label="Production Date"
            value={formatWarehouseDate(lot.production_date)}
          />
          <DetailItem
            label="Expiry"
            value={formatWarehouseDate(lot.expiry_date)}
          />
          <DetailItem label="Status" value={lot.status} />
        </DetailGrid>
      }
    />
  );
}
