import { notFound } from "next/navigation";
import { DealWorkspace } from "@/components/deals/DealWorkspace";
import { getCounterparties } from "@/lib/counterparties";
import { getDealWorkspaceData } from "@/lib/deals/db";
import { getEntityWorkspaceBundle } from "@/lib/platform/entity-bundle";
import { getProducts } from "@/lib/products";

export default async function BusinessCaseDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const [dealResult, bundle, counterpartiesResult, productsResult] =
    await Promise.all([
      getDealWorkspaceData(id),
      getEntityWorkspaceBundle("business_case", id),
      getCounterparties(),
      getProducts(),
    ]);

  if (dealResult.error && !dealResult.error.toLowerCase().includes("not found")) {
    return <p role="alert" className="rounded-lg border border-border p-5 text-sm">Unable to load this record: {dealResult.error}</p>;
  }
  if (dealResult.error || !dealResult.data) {
    notFound();
  }

  return (
    <DealWorkspace
      data={dealResult.data}
      timeline={bundle.timeline}
      activity={bundle.activity}
      documents={bundle.documents}
      documentUrls={bundle.documentUrls}
      counterparties={counterpartiesResult.data ?? []}
      products={productsResult.data ?? []}
    />
  );
}
