import { Suspense } from "react";
import { CounterpartiesView } from "@/components/counterparties/CounterpartiesView";
import { getCounterparties } from "@/lib/counterparties";

export default async function CounterpartiesPage() {
  const { data, stats, error } = await getCounterparties();

  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
      <CounterpartiesView counterparties={data} stats={stats} error={error} />
    </Suspense>
  );
}
