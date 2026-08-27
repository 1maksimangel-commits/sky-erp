import { Suspense } from "react";
import { BusinessCasesView } from "@/components/business-cases/BusinessCasesView";
import { getBusinessCases } from "@/lib/business-cases";
import { getCompanies } from "@/lib/companies";
import { getCounterparties } from "@/lib/counterparties";

export default async function BusinessCasesPage() {
  const [
    { data, stats, error },
    { data: companies },
    { data: counterparties },
  ] = await Promise.all([
    getBusinessCases(),
    getCompanies(),
    getCounterparties(),
  ]);

  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
      <BusinessCasesView
        businessCases={data}
        stats={stats}
        error={error}
        companies={companies ?? []}
        counterparties={counterparties ?? []}
      />
    </Suspense>
  );
}
