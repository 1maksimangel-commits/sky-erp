import { notFound } from "next/navigation";
import { DetailGrid, DetailItem } from "@/components/platform/DetailGrid";
import { EntityWorkspace } from "@/components/platform/EntityWorkspace";
import { formatMoney } from "@/lib/finance/format";
import { getEntityWorkspaceBundle } from "@/lib/platform/entity-bundle";
import { getProductById } from "@/lib/products";

export default async function ProductDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const [{ data: product, error }, bundle] = await Promise.all([
    getProductById(id),
    getEntityWorkspaceBundle("product", id),
  ]);

  if (error && !error.toLowerCase().includes("not found")) {
    return <p role="alert" className="rounded-lg border border-border p-5 text-sm">Unable to load this record: {error}</p>;
  }
  if (error || !product) {
    notFound();
  }

  return (
    <EntityWorkspace
      entityType="product"
      entityId={id}
      title={product.name}
      subtitle={product.sku}
      status={product.is_active ? "Active" : "Inactive"}
      breadcrumbHref="/products"
      breadcrumbLabel="Products"
      timeline={bundle.timeline}
      activity={bundle.activity}
      documents={bundle.documents}
      documentUrls={bundle.documentUrls}
      linked={bundle.linked}
      productId={id}
      overview={
        <DetailGrid>
          <DetailItem label="SKU" value={product.sku} />
          <DetailItem label="Name" value={product.name} />
          <DetailItem label="Scientific Name" value={product.scientific_name} />
          <DetailItem label="Category" value={product.category} />
          <DetailItem label="Country" value={product.country} />
          <DetailItem label="Size" value={product.size} />
          <DetailItem
            label="Purchase Price"
            value={formatMoney(product.purchase_price, product.currency)}
          />
          <DetailItem
            label="Sale Price"
            value={formatMoney(product.sale_price, product.currency)}
          />
        </DetailGrid>
      }
    />
  );
}
