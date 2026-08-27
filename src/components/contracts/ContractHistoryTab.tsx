import { AlertCircle } from "lucide-react";
import type { HistoryEvent } from "@/lib/contracts/history";

type ContractHistoryTabProps = {
  events: HistoryEvent[] | null;
  error: string | null;
};

const TYPE_LABELS: Record<HistoryEvent["type"], string> = {
  created: "Created",
  updated: "Updated",
  status: "Status",
  payment: "Payment",
  document: "Document",
  shipment: "Shipment",
};

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function ContractHistoryTab({
  events,
  error,
}: ContractHistoryTabProps) {
  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">History</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Timeline of contract activity across modules
        </p>
      </div>

      {!events?.length ? (
        <div className="rounded-lg border border-card-border bg-card p-10 text-center text-sm text-muted-foreground">
          No history events recorded yet.
        </div>
      ) : (
        <ol className="relative space-y-0 border-l border-border pl-6">
          {events.map((event) => (
            <li key={event.id} className="pb-6 last:pb-0">
              <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-border bg-card" />
              <div className="rounded-lg border border-border bg-card px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {TYPE_LABELS[event.type]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {event.title}
                </p>
                {event.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {event.description}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
