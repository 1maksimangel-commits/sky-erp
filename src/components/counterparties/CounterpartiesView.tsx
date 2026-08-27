"use client";

import {
  AlertCircle,
  Layers,
  Plus,
  Search,
  ToggleLeft,
  Users,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CounterpartyFormModal } from "@/components/counterparties/CounterpartyFormModal";
import { PageActions } from "@/components/layout/ShellContext";
import { TableShell } from "@/components/ui/TableShell";
import { Toast } from "@/components/ui/Toast";
import type { Counterparty, CounterpartyStats } from "@/lib/counterparties";
import { useSearchParamOpen } from "@/lib/ui/open-state";

type CounterpartiesViewProps = {
  counterparties: Counterparty[] | null;
  stats: CounterpartyStats | null;
  error: string | null;
};

type StatusFilter = "all" | "active" | "inactive";

function StatusBadge({ isActive }: { isActive: boolean }) {
  const label = isActive ? "Active" : "Inactive";
  const className = isActive
    ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
    : "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {label}
    </span>
  );
}

function KpiCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="erp-panel p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
        </div>
        <div className="rounded-md bg-accent p-2 text-muted-foreground">{icon}</div>
      </div>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-5">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
        <div>
          <h3 className="text-sm font-medium text-red-300">
            Failed to load counterparties
          </h3>
          <p className="mt-1 text-sm text-red-400/90">{message}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="rounded-lg border border-card-border bg-card p-12 text-center">
      <Users className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium text-foreground">
        {filtered
          ? "No counterparties match your filters"
          : "No counterparties found"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {filtered
          ? "Try adjusting your search or filter criteria."
          : "Add your first counterparty to start building the directory."}
      </p>
    </div>
  );
}

export function CounterpartiesView({
  counterparties,
  stats,
  error,
}: CounterpartiesViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [formOpen, setFormOpen] = useSearchParamOpen();
  const [toast, setToast] = useState<string | null>(null);

  const types = useMemo(() => {
    if (!counterparties) {
      return [];
    }

    return [
      ...new Set(
        counterparties
          .map((item) => item.counterparty_type)
          .filter((type): type is string => Boolean(type))
      ),
    ].sort();
  }, [counterparties]);

  const filteredCounterparties = useMemo(() => {
    if (!counterparties) {
      return [];
    }

    const query = search.trim().toLowerCase();

    return counterparties.filter((item) => {
      if (typeFilter !== "all" && item.counterparty_type !== typeFilter) {
        return false;
      }

      if (statusFilter === "active" && !item.is_active) {
        return false;
      }

      if (statusFilter === "inactive" && item.is_active) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        item.legal_name,
        item.short_name,
        item.code,
        item.country,
        item.city,
      ].some((field) => field?.toLowerCase().includes(query));
    });
  }, [counterparties, search, typeFilter, statusFilter]);

  const hasFilters =
    search.trim().length > 0 ||
    typeFilter !== "all" ||
    statusFilter !== "all";

  return (
    <div className="space-y-6">
      <PageActions>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-foreground px-3.5 py-2 text-xs font-medium text-background transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          New Counterparty
        </button>
      </PageActions>

      <CounterpartyFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          if (searchParams.get("new") === "1") router.replace("/counterparties");
        }}
        onSaved={() => {
          router.refresh();
          setToast("Counterparty saved successfully.");
          if (searchParams.get("new") === "1") router.replace("/counterparties");
        }}
      />

      {toast ? (
        <Toast message={toast} onClose={() => setToast(null)} />
      ) : null}

      {error ? (
        <ErrorCard message={error} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Total counterparties"
              value={String(stats?.total ?? 0)}
              icon={<Users className="h-4 w-4" />}
            />
            <KpiCard
              title="Active"
              value={String(stats?.active ?? 0)}
              icon={<ToggleLeft className="h-4 w-4" />}
            />
            <KpiCard
              title="Inactive"
              value={String(stats?.inactive ?? 0)}
              icon={<ToggleLeft className="h-4 w-4" />}
            />
            <KpiCard
              title="Counterparty types"
              value={String(stats?.types ?? 0)}
              icon={<Layers className="h-4 w-4" />}
            />
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search by legal name, short name, code, country, city..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">All types</option>
                {types.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as StatusFilter)
                }
                className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {filteredCounterparties.length === 0 ? (
            <EmptyState
              filtered={hasFilters && (counterparties?.length ?? 0) > 0}
            />
          ) : (
            <TableShell rowCount={filteredCounterparties.length}>
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Legal Name
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Code
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Type
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Country
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      City
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Email
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Phone
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCounterparties.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() =>
                        router.push(`/counterparties/${item.id}`)
                      }
                      className="cursor-pointer transition-colors hover:bg-accent/20"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {item.legal_name}
                          </p>
                          {item.short_name ? (
                            <p className="text-xs text-muted-foreground">
                              {item.short_name}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {item.code || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.counterparty_type ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.country ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.city ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.email ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.phone ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge isActive={item.is_active} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          )}
        </>
      )}
    </div>
  );
}
