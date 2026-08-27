import { EmptyState } from "@/components/ui/EmptyState";

export default function ReportsPage() {
  return (
    <EmptyState
      iconName="chart-column"
      title="Enterprise reports"
      description="Cross-module analytics will consolidate here. Finance reports are available now while the shared reporting layer expands."
      actionHref="/finance/reports"
      actionLabel="Open finance reports"
    />
  );
}
