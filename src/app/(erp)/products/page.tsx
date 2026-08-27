import { Suspense } from "react";
import { ProductsView } from "@/components/products/ProductsView";
import { getProducts } from "@/lib/products";

export default async function ProductsPage() {
  const { data, stats, error } = await getProducts();

  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
      <ProductsView products={data} stats={stats} error={error} />
    </Suspense>
  );
}
