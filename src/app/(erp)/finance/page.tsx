import { FinanceDashboard } from "@/components/finance/FinanceDashboard";
import { getFinanceDashboardStats } from "@/lib/finance/db";

export default async function FinancePage() {
  const { data, error } = await getFinanceDashboardStats();

  return <FinanceDashboard stats={data} error={error} />;
}
