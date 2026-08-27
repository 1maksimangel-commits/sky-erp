import Link from "next/link";
import type { LinkedRecord } from "@/lib/platform/linked";
import type { EntityType } from "@/lib/platform/types";

type EntityFinancialsPanelProps = {
  entityType: EntityType;
  entityId: string;
  linked: LinkedRecord[];
  children?: React.ReactNode;
};

export function EntityFinancialsPanel({
  linked,
  children,
}: EntityFinancialsPanelProps) {
  const financial = linked.filter((item) =>
    ["Invoice", "Payment"].includes(item.type)
  );

  if (children) {
    return <>{children}</>;
  }

  if (!financial.length) {
    return (
      <div className="rounded-lg border border-card-border bg-card p-8 text-center text-sm text-muted-foreground">
        No financial records linked yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {financial.map((item) => (
        <Link
          key={`${item.type}-${item.id}`}
          href={item.href}
          className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 hover:bg-accent/20"
        >
          <div>
            <p className="text-xs uppercase text-muted-foreground">{item.type}</p>
            <p className="text-sm font-medium text-foreground">{item.label}</p>
          </div>
          <span className="text-xs text-muted-foreground">{item.meta}</span>
        </Link>
      ))}
    </div>
  );
}
