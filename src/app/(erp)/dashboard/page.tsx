import { OperationsDashboard } from "@/components/dashboard/OperationsDashboard";
import { getDashboardData } from "@/lib/platform/dashboard";

export default async function DashboardPage() {
  const data = await getDashboardData();
  return <OperationsDashboard data={data} />;
}
