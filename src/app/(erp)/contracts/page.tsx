import { Suspense } from "react";
import { ContractsView } from "@/components/contracts/ContractsView";
import { getBusinessCases } from "@/lib/business-cases";
import { getActiveCompanies } from "@/lib/companies";
import { getContracts } from "@/lib/contracts/db";
import { getContractImportAiStatus } from "@/lib/contracts/import/actions";
import { getActiveCounterparties } from "@/lib/counterparties";
import { getProducts } from "@/lib/products";

export default async function ContractsPage() {
  const [
    { data, stats, error },
    { data: companies },
    { data: counterparties },
    { data: businessCases },
    { data: products },
    aiStatus,
  ] = await Promise.all([
    getContracts(),
    getActiveCompanies(),
    getActiveCounterparties(),
    getBusinessCases(),
    getProducts(),
    getContractImportAiStatus(),
  ]);

  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
      <ContractsView
        contracts={data}
        stats={stats}
        error={error}
        companies={companies ?? []}
        counterparties={counterparties ?? []}
        products={products ?? []}
        businessCases={(businessCases ?? []).map((item) => ({
          id: item.id,
          case_number: item.case_number,
          title: item.title,
        }))}
        aiImportConfigured={aiStatus.configured}
        aiImportMessage={aiStatus.message}
      />
    </Suspense>
  );
}
