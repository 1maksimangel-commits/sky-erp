"use client";

import { AlertCircle, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CompanyFormModal } from "@/components/companies/CompanyFormModal";
import { addCompanyAsCounterparty } from "@/lib/counterparties/actions";
import { PageActions } from "@/components/layout/ShellContext";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toast } from "@/components/ui/Toast";
import type { Company } from "@/lib/companies";
import type { CompanyFormInput } from "@/lib/companies/types";
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

function companyToFormInput(company: Company): CompanyFormInput {
  const bank = company.bank_accounts[0] ?? null;
  return {
    business_role: company.business_role,
    code: company.code,
    name: company.name,
    short_name: company.short_name,
    country: company.country,
    city: company.city,
    address: company.address,
    tax_id: company.tax_id,
    registration_number: company.registration_number,
    email: company.email,
    phone: company.phone,
    website: company.website,
    authorized_signer_name: company.authorized_signer_name,
    authorized_signer_title: company.authorized_signer_title,
    bank_account_name: bank?.name ?? null,
    bank_name: bank?.bank_name ?? null,
    bank_address: bank?.bank_address ?? null,
    account_number: bank?.account_number ?? null,
    iban: bank?.iban ?? null,
    swift: bank?.swift ?? null,
    bank_currency: bank?.currency ?? "USD",
    is_active: company.is_active,
  };
}

function getColumns(onEdit: (company: Company) => void, onAddCounterparty: (company: Company) => void): DataTableColumn<Company>[] {
  return [
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
  {
    id: "actions",
    header: "",
    hideable: false,
    accessor: (row) => row.id,
    cell: (row) => (
      <div>
        <button
        type="button"
        onClick={() => onEdit(row)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
        </button>
        <button type="button" onClick={() => onAddCounterparty(row)} className="ml-2 inline-flex items-center rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">Add as Counterparty</button>
      </div>
    ),
  },
  ];
}

export function CompaniesView({ companies, error }: CompaniesViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formOpen, setFormOpen] = useSearchParamOpen();
  const [toast, setToast] = useState<string | null>(null);
  const [editing, setEditing] = useState<Company | null>(null);
  const columns = getColumns((company) => {
    setEditing(company);
    setFormOpen(true);
  }, (company) => {
    void addCompanyAsCounterparty(company.id).then((result) => {
      setToast(result.success ? "Company added to Counterparties." : result.error);
      if (result.success) router.refresh();
    });
  });

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
        existingId={editing?.id ?? null}
        initialValues={editing ? companyToFormInput(editing) : null}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          if (searchParams.get("new") === "1") {
            router.replace("/companies");
          }
        }}
        onSaved={() => {
          router.refresh();
          setToast("Company saved successfully.");
          setEditing(null);
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
