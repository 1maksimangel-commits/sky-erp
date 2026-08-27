import { ContractHistoryTab } from "@/components/contracts/ContractHistoryTab";
import { EntityActivityPanel } from "@/components/platform/EntityActivityPanel";
import { EntityLinkedPanel } from "@/components/platform/EntityLinkedPanel";
import { EntityTimelinePanel } from "@/components/platform/EntityTimelinePanel";
import { getContractById } from "@/lib/contracts/db";
import { getContractHistory } from "@/lib/contracts/history";
import { getEntityActivity } from "@/lib/platform/activity-db";
import { getLinkedRecords } from "@/lib/platform/linked";
import { getEntityTimeline } from "@/lib/platform/timeline-db";

export default async function ContractHistoryPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const { data: contract } = await getContractById(id);

  if (!contract) {
    return null;
  }

  const [
    { data: history, error },
    { data: timeline },
    { data: activity },
    { data: linked },
  ] = await Promise.all([
    getContractHistory(contract),
    getEntityTimeline("contract", id),
    getEntityActivity("contract", id),
    getLinkedRecords("contract", id),
  ]);

  return (
    <div className="space-y-6">
      <ContractHistoryTab events={history} error={error} />
      <div className="grid gap-4 xl:grid-cols-2">
        <EntityTimelinePanel
          entityType="contract"
          entityId={id}
          events={timeline}
        />
        <EntityActivityPanel entries={activity} />
      </div>
      <EntityLinkedPanel records={linked} />
    </div>
  );
}
