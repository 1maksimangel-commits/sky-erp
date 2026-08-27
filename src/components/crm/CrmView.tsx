"use client";

import {
  AlertCircle,
  Archive,
  CalendarClock,
  ContactRound,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CustomerFormModal } from "@/components/crm/CustomerFormModal";
import { PageActions } from "@/components/layout/ShellContext";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableShell } from "@/components/ui/TableShell";
import { Toast } from "@/components/ui/Toast";
import {
  archiveCrmCustomer,
  deleteCrmCustomer,
} from "@/lib/crm/actions";
import { formatCrmDate } from "@/lib/crm/format";
import {
  CRM_CATEGORIES,
  CRM_STATUSES,
  displayLegalName,
  type CrmCustomer,
  type CrmDashboardStats,
} from "@/lib/crm/types";
import { useSearchParamOpen } from "@/lib/ui/open-state";

const PAGE_SIZE = 15;

type CrmViewProps = {
  customers: CrmCustomer[] | null;
  stats: CrmDashboardStats;
  error: string | null;
};

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "Active"
      ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
      : status === "Prospect"
        ? "bg-sky-500/10 text-sky-400 ring-sky-500/20"
        : status === "Archived"
          ? "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20"
          : "bg-amber-500/10 text-amber-300 ring-amber-500/20";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {status}
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

export function CrmView({ customers, stats, error }: CrmViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [managerFilter, setManagerFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useSearchParamOpen();
  const [editing, setEditing] = useState<CrmCustomer | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const newFlagged = searchParams.get("new") === "1";
  const [prevNewFlagged, setPrevNewFlagged] = useState(newFlagged);
  if (newFlagged !== prevNewFlagged) {
    setPrevNewFlagged(newFlagged);
    if (newFlagged) {
      setEditing(null);
    }
  }

  const managers = useMemo(() => {
    const set = new Set<string>();
    for (const row of customers ?? []) {
      if (row.manager) set.add(row.manager);
    }
    return [...set].sort();
  }, [customers]);

  const filtered = useMemo(() => {
    const rows = customers ?? [];
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (categoryFilter !== "all" && row.category !== categoryFilter) {
        return false;
      }
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (managerFilter !== "all" && (row.manager ?? "") !== managerFilter) {
        return false;
      }
      if (!query) return true;
      return [
        row.company_name,
        row.legal_name,
        row.short_name,
        row.contact_person,
        row.country,
        row.phone,
        row.email,
        row.wechat,
        row.category,
        row.customer_type,
        row.manager,
        row.status,
      ].some((field) => field?.toLowerCase().includes(query));
    });
  }, [customers, search, categoryFilter, statusFilter, managerFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  async function handleArchive(customer: CrmCustomer) {
    setBusyId(customer.id);
    const result = await archiveCrmCustomer(customer.id);
    setBusyId(null);
    if (!result.success) {
      setToast(result.error);
      return;
    }
    setToast("Customer archived.");
    router.refresh();
  }

  async function handleDelete(customer: CrmCustomer) {
    if (
      !window.confirm(
        `Delete ${displayLegalName(customer)}? This cannot be undone.`
      )
    ) {
      return;
    }
    setBusyId(customer.id);
    const result = await deleteCrmCustomer(customer.id);
    setBusyId(null);
    if (!result.success) {
      setToast(result.error);
      return;
    }
    setToast("Customer deleted.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageActions>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-3.5 py-2 text-xs font-medium text-background hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          New Customer
        </button>
      </PageActions>

      <CustomerFormModal
        open={formOpen}
        customer={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          if (searchParams.get("new") === "1") router.replace("/crm");
        }}
        onSaved={(id) => {
          router.refresh();
          setToast(editing ? "Customer updated." : "Customer created.");
          if (searchParams.get("new") === "1") router.replace("/crm");
          if (id && !editing) router.push(`/crm/${id}`);
        }}
      />

      {toast ? (
        <Toast
          message={toast}
          onClose={() => setToast(null)}
          variant={toast.toLowerCase().includes("denied") || toast.toLowerCase().includes("failed") || toast.toLowerCase().includes("missing") ? "error" : "success"}
        />
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <div>
              <h3 className="text-sm font-medium text-red-300">CRM unavailable</h3>
              <p className="mt-1 text-sm text-red-400/90">{error}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Total customers"
          value={String(stats.totalCustomers)}
          icon={<Users className="h-4 w-4" />}
        />
        <KpiCard
          title="Active customers"
          value={String(stats.activeCustomers)}
          icon={<ContactRound className="h-4 w-4" />}
        />
        <KpiCard
          title="Prospects"
          value={String(stats.prospects)}
          icon={<Search className="h-4 w-4" />}
        />
        <KpiCard
          title="Suppliers"
          value={String(stats.suppliers)}
          icon={<Archive className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="erp-panel p-4">
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Recently contacted
            </h3>
          </div>
          {stats.recentlyContacted.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent contacts yet.</p>
          ) : (
            <ul className="space-y-2">
              {stats.recentlyContacted.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/crm/${row.id}`}
                    className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-accent/50"
                  >
                    <span className="text-sm text-foreground">
                      {displayLegalName(row)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatCrmDate(row.last_contact_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="erp-panel p-4">
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Upcoming follow-ups
            </h3>
          </div>
          {stats.upcomingFollowUps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming follow-ups.</p>
          ) : (
            <ul className="space-y-2">
              {stats.upcomingFollowUps.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/crm/${row.id}`}
                    className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-accent/50"
                  >
                    <span className="text-sm text-foreground">
                      {displayLegalName(row)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatCrmDate(row.next_follow_up_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search company, contact, WeChat, manager..."
            className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(0);
          }}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="all">All categories</option>
          {CRM_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(0);
          }}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          {CRM_STATUSES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          value={managerFilter}
          onChange={(e) => {
            setManagerFilter(e.target.value);
            setPage(0);
          }}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="all">All managers</option>
          {managers.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {!pageRows.length ? (
        <EmptyState
          iconName="contact-round"
          title="No CRM customers yet"
          description="Create your first customer, prospect, or supplier account to start relationship tracking."
          action={
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-md bg-foreground px-3.5 py-2 text-xs font-medium text-background"
            >
              <Plus className="h-3.5 w-3.5" />
              New Customer
            </button>
          }
        />
      ) : (
        <TableShell
          rowCount={filtered.length}
          footer={
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Page {safePage + 1} of {pageCount}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={safePage <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="rounded-md border border-border px-2 py-1 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  className="rounded-md border border-border px-2 py-1 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          }
        >
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead>
              <tr>
                {[
                  "Company",
                  "Short name",
                  "Contact person",
                  "Country",
                  "Phone",
                  "Email",
                  "WeChat",
                  "Type",
                  "Manager",
                  "Status",
                  "Last contact",
                  "Next follow-up",
                  "Actions",
                ].map((label) => (
                  <th
                    key={label}
                    className="px-4 py-3 text-xs font-medium text-muted-foreground"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => router.push(`/crm/${row.id}`)}
                  className="cursor-pointer hover:bg-accent/20"
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {displayLegalName(row)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.short_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.contact_person ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.country ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.wechat ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.customer_type ?? row.category}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.manager ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatCrmDate(row.last_contact_at)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatCrmDate(row.next_follow_up_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Edit"
                        disabled={busyId === row.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditing(row);
                          setFormOpen(true);
                        }}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Archive"
                        disabled={busyId === row.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleArchive(row);
                        }}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete"
                        disabled={busyId === row.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDelete(row);
                        }}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      )}
    </div>
  );
}
