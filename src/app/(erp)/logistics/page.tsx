import { Suspense } from "react";
import { LogisticsView } from "@/components/logistics/LogisticsView";
import {
  getBusinessCaseOptions,
  getContractOptions,
  getShipments,
} from "@/lib/logistics/db";

export default async function LogisticsPage() {
  const [
    { data, stats, error },
    contracts,
    businessCases,
  ] = await Promise.all([
    getShipments(),
    getContractOptions(),
    getBusinessCaseOptions(),
  ]);

  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
      <LogisticsView
        shipments={data}
        stats={stats}
        error={error}
        contracts={contracts}
        businessCases={businessCases}
      />
    </Suspense>
  );
}
