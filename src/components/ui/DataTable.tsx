"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Rows3,
} from "lucide-react";
import { useMemo, useState } from "react";

export type DataTableColumn<T> = {
  id: string;
  header: string;
  sortable?: boolean;
  accessor: (row: T) => string | number | null | undefined;
  cell: (row: T) => React.ReactNode;
  hideable?: boolean;
  className?: string;
};

type Density = "comfortable" | "compact";

type DataTableProps<T> = {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  pageSizeOptions?: number[];
  empty?: React.ReactNode;
  initialDensity?: Density;
};

function compareValues(a: string | number | null | undefined, b: string | number | null | undefined) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  pageSizeOptions = [10, 25, 50],
  empty,
  initialDensity = "comfortable",
}: DataTableProps<T>) {
  const [sortId, setSortId] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(pageSizeOptions[0] ?? 10);
  const [density, setDensity] = useState<Density>(initialDensity);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [columnsOpen, setColumnsOpen] = useState(false);

  const visibleColumns = columns.filter((column) => !hidden[column.id]);

  const sortedRows = useMemo(() => {
    if (!sortId) return rows;
    const column = columns.find((item) => item.id === sortId);
    if (!column) return rows;
    const copy = [...rows];
    copy.sort((left, right) => {
      const result = compareValues(column.accessor(left), column.accessor(right));
      return sortDir === "asc" ? result : -result;
    });
    return copy;
  }, [columns, rows, sortDir, sortId]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sortedRows.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize
  );

  function toggleSort(columnId: string) {
    if (sortId === columnId) {
      setSortDir((value) => (value === "asc" ? "desc" : "asc"));
      return;
    }
    setSortId(columnId);
    setSortDir("asc");
  }

  if (!rows.length && empty) {
    return <>{empty}</>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {sortedRows.length} record{sortedRows.length === 1 ? "" : "s"}
        </p>
        <div className="relative flex items-center gap-1.5">
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
          <button
            type="button"
            onClick={() => setColumnsOpen((value) => !value)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Columns3 className="h-3.5 w-3.5" />
            Columns
          </button>
          {columnsOpen ? (
            <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-border bg-card p-2 shadow-xl">
              {columns.map((column) => (
                <label
                  key={column.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-foreground hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={!hidden[column.id]}
                    disabled={column.hideable === false}
                    onChange={(event) => {
                      setHidden((current) => ({
                        ...current,
                        [column.id]: !event.target.checked,
                      }));
                    }}
                    className="accent-foreground"
                  />
                  {column.header}
                </label>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={[
          "erp-table-wrap",
          density === "compact"
            ? "erp-table-density-compact"
            : "erp-table-density-comfortable",
        ].join(" ")}
      >
        <table className="min-w-[720px] text-left text-sm">
          <thead>
            <tr>
              {visibleColumns.map((column) => {
                const active = sortId === column.id;
                return (
                  <th
                    key={column.id}
                    className={`px-4 py-3 text-xs font-medium text-muted-foreground ${column.className ?? ""}`}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.id)}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        {column.header}
                        {active ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-50" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageRows.map((row) => (
              <tr
                key={rowKey(row)}
                className="transition-colors hover:bg-accent/25"
              >
                {visibleColumns.map((column) => (
                  <td
                    key={column.id}
                    className={`px-4 text-muted-foreground ${column.className ?? ""}`}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(0);
            }}
            className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Page {safePage + 1} of {pageCount}
          </span>
          <button
            type="button"
            disabled={safePage <= 0}
            onClick={() => setPage((value) => Math.max(0, value - 1))}
            className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={safePage >= pageCount - 1}
            onClick={() =>
              setPage((value) => Math.min(pageCount - 1, value + 1))
            }
            className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-40"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
