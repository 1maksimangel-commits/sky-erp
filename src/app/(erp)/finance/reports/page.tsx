import { ReportsView } from "@/components/finance/ReportsView";
import { getFinanceReports } from "@/lib/finance/db";

export default async function FinanceReportsPage() {
  const { data, error } = await getFinanceReports();

  return <ReportsView reports={data} error={error} />;
}
