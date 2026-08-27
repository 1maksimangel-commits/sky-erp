import { Suspense } from "react";
import { CrmView } from "@/components/crm/CrmView";
import { getCrmCustomers, getCrmDashboardStats } from "@/lib/crm/db";

export default async function CrmPage() {
  const [{ data: customers, error }, { data: stats, error: statsError }] =
    await Promise.all([getCrmCustomers(), getCrmDashboardStats()]);

  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading CRM…</div>}>
      <CrmView
        customers={customers}
        stats={stats}
        error={error ?? statsError}
      />
    </Suspense>
  );
}
