import { Suspense } from "react";
import { CounterpartiesView } from "@/components/counterparties/CounterpartiesView";
import { getCounterparties } from "@/lib/counterparties";
import { getActiveCompanies } from "@/lib/companies";

export default async function CounterpartiesPage() {
  const [{ data, stats, error }, { data: companies }] = await Promise.all([getCounterparties(), getActiveCompanies()]);

  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
      <CounterpartiesView counterparties={data} stats={stats} error={error} companies={companies ?? []} />
    </Suspense>
  );
}
