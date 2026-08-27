"use client";

import { AlertCircle, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CompanyFormModal } from "@/components/companies/CompanyFormModal";
import { PageActions } from "@/components/layout/ShellContext";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toast } from "@/components/ui/Toast";
import type { Company } from "@/lib/companies";
import { useSearchParamOpen } from "@/lib/ui/open-state";

type CompaniesViewProps = {
  companies: Company[] | null;
  error: string | null;
};

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

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
        <div>
          <h3 className="text-sm font-medium text-red-300">
            Failed to load companies
          </h3>
          <p className="mt-1 text-sm text-red-400/90">{message}</p>
        </div>
      </div>
    </div>
  );
}

const columns: DataTableColumn<Company>[] = [
  {
    id: "name",
    header: "Name",
    sortable: true,
    hideable: false,
    accessor: (row) => row.name,
    cell: (row) => (
      <Link
        href={`/companies/${row.id}`}
        className="font-medium text-foreground hover:underline"
      >
        {row.name}
      </Link>
    ),
  },
  {
    id: "code",
    header: "Code",
    sortable: true,
    accessor: (row) => row.code,
    cell: (row) => (
      <span className="font-mono text-xs text-muted-foreground">{row.code}</span>
    ),
  },
  {
    id: "short_name",
    header: "Short name",
    sortable: true,
    accessor: (row) => row.short_name,
    cell: (row) => row.short_name ?? "—",
  },
  {
    id: "country",
    header: "Country",
    sortable: true,
    accessor: (row) => row.country,
    cell: (row) => row.country ?? "—",
  },
  {
    id: "city",
    header: "City",
    sortable: true,
    accessor: (row) => row.city,
    cell: (row) => row.city ?? "—",
  },
  {
    id: "status",
    header: "Status",
    sortable: true,
    accessor: (row) => (row.is_active ? "Active" : "Inactive"),
    cell: (row) => <StatusBadge isActive={row.is_active} />,
  },
];

export function CompaniesView({ companies, error }: CompaniesViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formOpen, setFormOpen] = useSearchParamOpen();
  const [toast, setToast] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <PageActions>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-foreground px-3.5 py-2 text-xs font-medium text-background transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          New Company
        </button>
      </PageActions>

      <CompanyFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          if (searchParams.get("new") === "1") {
            router.replace("/companies");
          }
        }}
        onSaved={() => {
          router.refresh();
          setToast("Company saved successfully.");
          if (searchParams.get("new") === "1") {
            router.replace("/companies");
          }
        }}
      />

      {toast ? (
        <Toast message={toast} onClose={() => setToast(null)} />
      ) : null}

      {error ? (
        <ErrorCard message={error} />
      ) : (
        <DataTable
          rows={companies ?? []}
          columns={columns}
          rowKey={(row) => row.id}
          empty={
            <EmptyState
              iconName="building-2"
              title="No companies yet"
              description="Create your first legal entity to structure contracts, finance, and warehouse ownership."
              action={
                <button
                  type="button"
                  onClick={() => setFormOpen(true)}
                  className="inline-flex items-center gap-2 rounded-md bg-foreground px-3.5 py-2 text-xs font-medium text-background"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Company
                </button>
              }
            />
          }
        />
      )}
    </div>
  );
}
