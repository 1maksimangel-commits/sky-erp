"use client";

import {
  AlertCircle,
  Briefcase,
  DollarSign,
  FileText,
  Plus,
  Search,
  TrendingUp,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BusinessCaseFormModal } from "@/components/business-cases/BusinessCaseFormModal";
import { PageActions } from "@/components/layout/ShellContext";
import { TableShell } from "@/components/ui/TableShell";
import { Toast } from "@/components/ui/Toast";
import type { BusinessCase, BusinessCaseStats } from "@/lib/business-cases";
import type { Company } from "@/lib/companies";
import type { Counterparty } from "@/lib/counterparties";
import { emptyBusinessCaseForm } from "@/lib/business-cases/types";
import { setDealArchived } from "@/lib/deals/actions";
import { useSearchParamOpen } from "@/lib/ui/open-state";

type BusinessCasesViewProps = {
  businessCases: BusinessCase[] | null;
  stats: BusinessCaseStats | null;
  error: string | null;
  companies: Company[];
  counterparties: Counterparty[];
};

function formatAmount(value: number | null, currency: string | null): string {
  if (value == null) {
    return "—";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency ?? "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toLocaleString()} ${currency ?? ""}`.trim();
  }
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function StatusBadge({ status }: { status: string | null }) {
  const label = status ?? "Draft";

  const className =
    label === "Draft"
      ? "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20"
      : label === "Closed"
        ? "bg-blue-500/10 text-blue-400 ring-blue-500/20"
        : label === "Cancelled"
          ? "bg-red-500/10 text-red-400 ring-red-500/20"
          : "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20";

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
    <div className="rounded-lg border border-card-border bg-card p-5">
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
            Failed to load business cases
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
      <Briefcase className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium text-foreground">
        {filtered ? "No business cases match your filters" : "No business cases yet"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {filtered
          ? "Try adjusting your search or status filter."
          : "Create your first business case to start tracking deals."}
      </p>
    </div>
  );
}

export function BusinessCasesView({
  businessCases,
  stats,
  error,
  companies,
  counterparties,
}: BusinessCasesViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<BusinessCase | null>(null);
  const [formOpen, setFormOpen] = useSearchParamOpen();
  const [toast, setToast] = useState<string | null>(null);

  const statuses = useMemo(() => {
    if (!businessCases) {
      return [];
    }

    return [
      ...new Set(
        businessCases.map((item) => item.status ?? "Draft").filter(Boolean)
      ),
    ].sort();
  }, [businessCases]);

  const filteredCases = useMemo(() => {
    if (!businessCases) {
      return [];
    }

    const query = search.trim().toLowerCase();

    return businessCases.filter((item) => {
      if (statusFilter !== "all" && (item.status ?? "Draft") !== statusFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        item.case_number,
        item.title,
        item.case_type,
        item.contract_number,
        item.buyer?.legal_name,
        item.supplier?.legal_name,
        item.consignee?.legal_name,
        item.company?.name,
        item.status,
        item.incoterms,
      ].some((field) => field?.toLowerCase().includes(query));
    });
  }, [businessCases, search, statusFilter]);

  const hasFilters = search.trim().length > 0 || statusFilter !== "all";

  return (
    <div className="space-y-6">
      <PageActions>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-foreground px-3.5 py-2 text-xs font-medium text-background transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          New Deal
        </button>
      </PageActions>

      <BusinessCaseFormModal
        key={editing?.id ?? "create"}
        existingId={editing?.id}
        initialValues={editing ? { ...emptyBusinessCaseForm(), ...editing, status: editing.status ?? "Draft", currency: editing.currency ?? "USD" } : undefined}
        open={formOpen || Boolean(editing)}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          if (searchParams.get("new") === "1") {
            router.replace("/business-cases");
          }
        }}
        onSaved={() => {
          router.refresh();
          setToast("Business case saved successfully.");
          if (searchParams.get("new") === "1") {
            router.replace("/business-cases");
          }
        }}
        companies={companies}
        counterparties={counterparties}
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
              title="Total Cases"
              value={String(stats?.total ?? 0)}
              icon={<Briefcase className="h-4 w-4" />}
            />
            <KpiCard
              title="Draft"
              value={String(stats?.draft ?? 0)}
              icon={<FileText className="h-4 w-4" />}
            />
            <KpiCard
              title="Active"
              value={String(stats?.active ?? 0)}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <KpiCard
              title="Legacy Contract Value"
              value={formatAmount(stats?.totalContractAmount ?? 0, "USD")}
              icon={<DollarSign className="h-4 w-4" />}
            />
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search by case number, title, buyer, supplier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {filteredCases.length === 0 ? (
            <EmptyState filtered={hasFilters && (businessCases?.length ?? 0) > 0} />
          ) : (
            <TableShell rowCount={filteredCases.length}>
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                        Deal Number
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                        Title
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                        Type
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                        Buyer
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                        Supplier
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                        Contract
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                        Incoterms
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                        Contract Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredCases.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => router.push(`/business-cases/${item.id}`)}
                        className="cursor-pointer transition-colors hover:bg-accent/20"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-foreground">
                          {item.case_number}
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          {item.title ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {item.case_type ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {item.buyer?.legal_name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {item.supplier?.legal_name ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={item.archived_at ? "Archived" : item.status} />
                          <button type="button" className="ml-3 text-xs underline" onClick={event => { event.stopPropagation(); setEditing(item); }}>Edit</button>
                          <button type="button" className="ml-3 text-xs underline" onClick={event => { event.stopPropagation(); void setDealArchived(item.id, !item.archived_at).then(result => { setToast(result.success ? "Status updated." : result.error); if (result.success) router.refresh(); }); }}>{item.archived_at ? "Restore" : "Archive"}</button>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {item.contract_number ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatAmount(item.contract_amount, item.currency)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {item.incoterms ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(item.contract_date)}
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
