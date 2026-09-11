import { notFound } from "next/navigation";
import { DealWorkspace } from "@/components/deals/DealWorkspace";
import { getCounterparties } from "@/lib/counterparties";
import { getDealWorkspaceData } from "@/lib/deals/db";
import { getEntityWorkspaceBundle } from "@/lib/platform/entity-bundle";
import { getProducts } from "@/lib/products";
import { OperationalRecords } from "@/components/operations/OperationalRecords";
import { DealEconomics } from "@/components/economics/DealEconomics";

export default async function BusinessCaseDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string }>;
}>) {
  const { id } = await params;
  const initialTab = (await searchParams)?.tab === "economics" ? "economics" : "overview";
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
      initialTab={initialTab}
      operations={<OperationalRecords source={{ dealId: id }} />}
      economics={initialTab === "economics" ? <DealEconomics dealId={id} companyId={dealResult.data.deal.company_id}
        contracts={dealResult.data.contracts.map(contract => ({ id: contract.id, label: contract.contract_number }))}
        dealLines={dealResult.data.products.map(product => ({ id: product.id, label: product.product_name ?? product.product_description ?? "Deal product" }))} /> : null}
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
