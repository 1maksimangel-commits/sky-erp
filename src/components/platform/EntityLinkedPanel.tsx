import Link from "next/link";
import type { LinkedRecord } from "@/lib/platform/linked";

export function EntityLinkedPanel({ records }: { records: LinkedRecord[] }) {
  if (!records.length) {
    return (
      <div className="rounded-lg border border-card-border bg-card p-8 text-center text-sm text-muted-foreground">
        No linked records yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {records.map((record) => (
        <Link
          key={`${record.type}-${record.id}`}
          href={record.href}
          className="rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-accent/30"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {record.type}
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {record.label}
          </p>
          {record.meta ? (
            <p className="mt-1 text-xs text-muted-foreground">{record.meta}</p>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
