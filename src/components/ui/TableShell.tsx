"use client";

import { Columns3, Rows3 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

type Density = "comfortable" | "compact";

type TableShellProps = {
  children: ReactNode;
  /** Total rows for pagination label (optional). */
  rowCount?: number;
  /** Enable simple client pagination of children rows — leave false for custom tables. */
  showDensity?: boolean;
  showColumnHint?: boolean;
  footer?: ReactNode;
};

/**
 * Enterprise table chrome: sticky header surface, density, elevated panel.
 * Wrap an existing <table> without changing row data logic.
 */
export function TableShell({
  children,
  rowCount,
  showDensity = true,
  showColumnHint = true,
  footer,
}: TableShellProps) {
  const [density, setDensity] = useState<Density>("comfortable");
  const [hintOpen, setHintOpen] = useState(false);

  const densityClass =
    density === "compact"
      ? "erp-table-density-compact"
      : "erp-table-density-comfortable";

  const meta = useMemo(() => {
    if (rowCount == null) return null;
    return `${rowCount} record${rowCount === 1 ? "" : "s"}`;
  }, [rowCount]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{meta}</p>
        <div className="relative flex items-center gap-1.5">
          {showDensity ? (
            <button
              type="button"
              onClick={() =>
                setDensity((value) =>
                  value === "compact" ? "comfortable" : "compact"
                )
              }
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Rows3 className="h-3.5 w-3.5" />
              {density === "compact" ? "Compact" : "Comfortable"}
            </button>
          ) : null}
          {showColumnHint ? (
            <button
              type="button"
              onClick={() => setHintOpen((value) => !value)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Columns3 className="h-3.5 w-3.5" />
              Columns
            </button>
          ) : null}
          {hintOpen ? (
            <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground shadow-xl">
              Sticky headers are enabled. Use module filters to focus columns.
              Full column toggles are available on DataTable-powered lists.
            </div>
          ) : null}
        </div>
      </div>
      <div className={`erp-table-wrap ${densityClass}`}>{children}</div>
      {footer}
    </div>
  );
}
