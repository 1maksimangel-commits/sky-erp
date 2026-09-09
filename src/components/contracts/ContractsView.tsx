"use client";
import { contractDirection, partyName } from "@/lib/contracts/parties";

import {
  AlertCircle,
  CalendarClock,
  FileSignature,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Upload,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ContractDeleteDialog } from "@/components/contracts/ContractDeleteDialog";
import { ContractFormModal } from "@/components/contracts/ContractFormModal";
import { ContractImportReviewWorkspace } from "@/components/contracts/import/ContractImportReviewWorkspace";
import { ContractPdfImportWizard } from "@/components/contracts/import/ContractPdfImportWizard";
import { PageActions } from "@/components/layout/ShellContext";
import { TableShell } from "@/components/ui/TableShell";
import { Toast } from "@/components/ui/Toast";
import type { Company } from "@/lib/companies";
import type { Contract, ContractStats } from "@/lib/contracts/db";
import type { ContractImportRecord } from "@/lib/contracts/import/types";
import { CONTRACT_STATUSES } from "@/lib/contracts/form-types";
import type { Counterparty } from "@/lib/counterparties";
import type { Product } from "@/lib/products";
import { useSearchParamOpen } from "@/lib/ui/open-state";

type ContractsViewProps = {
  contracts: Contract[] | null;
  stats: ContractStats | null;
  error: string | null;
  companies: Company[];
  counterparties: Counterparty[];
  products?: Product[];
  businessCases?: { id: string; case_number: string; title: string | null }[];
  aiImportConfigured?: boolean;
  aiImportMessage?: string | null;
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
            Failed to load contracts
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
      <FileSignature className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium text-foreground">
        {filtered ? "No contracts match your filters" : "No contracts yet"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {filtered
          ? "Try adjusting your search or filter criteria."
          : "Create your first contract to start tracking agreements."}
      </p>
    </div>
  );
}

export function ContractsView({
  contracts,
  stats,
  error,
  companies,
  counterparties,
  products = [],
  businessCases = [],
  aiImportConfigured = false,
  aiImportMessage = null,
}: ContractsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [buyerFilter, setBuyerFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [formOpen, setFormOpen] = useSearchParamOpen();
  const [importOpen, setImportOpen] = useState(false);
  const [reviewState, setReviewState] = useState<{
    importRecord: ContractImportRecord;
    previewUrl: string | null;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const newFlagged = searchParams.get("new") === "1";
  const [prevNewFlagged, setPrevNewFlagged] = useState(newFlagged);
  if (newFlagged !== prevNewFlagged) {
    setPrevNewFlagged(newFlagged);
    if (newFlagged) {
      setEditingContract(null);
    }
  }

  const filteredContracts = useMemo(() => {
    if (!contracts) {
      return [];
    }

    const query = search.trim().toLowerCase();

    return contracts.filter((item) => {
      if (statusFilter !== "all" && (item.status ?? "Draft") !== statusFilter) {
        return false;
      }

      if (companyFilter !== "all" && item.company?.id !== companyFilter && !item.parties.some(p => p.internal_company_id === companyFilter)) {
        return false;
      }

      if (buyerFilter !== "all" && !item.parties.some(p => p.role_code === "buyer" && p.counterparty_id === buyerFilter)) {
        return false;
      }

      if (supplierFilter !== "all" && !item.parties.some(p => p.role_code === "seller" && p.counterparty_id === supplierFilter)) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        item.contract_number,
        item.title,
        item.company?.name,
        partyName(item.parties, "buyer"),
        partyName(item.parties, "seller"),
      ].some((field) => field?.toLowerCase().includes(query));
    });
  }, [
    contracts,
    search,
    statusFilter,
    companyFilter,
    buyerFilter,
    supplierFilter,
  ]);

  const hasFilters =
    search.trim().length > 0 ||
    statusFilter !== "all" ||
    companyFilter !== "all" ||
    buyerFilter !== "all" ||
    supplierFilter !== "all";

  function openCreateModal() {
    setEditingContract(null);
    setFormOpen(true);
  }

  function openEditModal(contract: Contract) {
    if (contract.status !== "Draft") { router.push(`/contracts/${contract.id}`); return; }
    setEditingContract(contract);
    setFormOpen(true);
  }

  const defaultBusinessCaseId = searchParams.get("business_case_id");

  function closeFormModal() {
    setFormOpen(false);
    setEditingContract(null);
    if (
      searchParams.get("new") === "1" ||
      searchParams.get("business_case_id")
    ) {
      router.replace("/contracts");
    }
  }

  return (
    <div className="space-y-6">
      <PageActions>
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Upload className="h-3.5 w-3.5" />
          Import PDF / DOCX
        </button>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-3.5 py-2 text-xs font-medium text-background transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          New Contract
        </button>
      </PageActions>

      <ContractFormModal
        products={products}
        open={formOpen}
        contract={editingContract}
        onClose={closeFormModal}
        onSaved={(message) => {
          router.refresh();
          setToast(message);
        }}
        companies={companies}
        counterparties={counterparties}
        businessCases={businessCases}
        defaultBusinessCaseId={
          editingContract ? null : defaultBusinessCaseId
        }
      />

      <ContractPdfImportWizard
        open={importOpen}
        aiConfigured={aiImportConfigured}
        aiMessage={aiImportMessage}
        onClose={() => setImportOpen(false)}
        onReady={(data) => {
          setImportOpen(false);
          setReviewState(data);
        }}
      />

      {reviewState ? (
        <ContractImportReviewWorkspace
          importRecord={reviewState.importRecord}
          previewUrl={reviewState.previewUrl}
          companies={companies}
          counterparties={counterparties}
          products={products}
          businessCases={businessCases}
          onClose={() => setReviewState(null)}
          onCompleted={(message, href) => {
            setReviewState(null);
            router.refresh();
            setToast(message);
            if (href) router.push(href);
          }}
        />
      ) : null}

      <ContractDeleteDialog
        open={Boolean(deleteTarget)}
        contract={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          router.refresh();
          setToast("Contract removed successfully.");
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
              title="Total contracts"
              value={String(stats?.total ?? 0)}
              icon={<FileSignature className="h-4 w-4" />}
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
              title="Expired"
              value={String(stats?.expired ?? 0)}
              icon={<CalendarClock className="h-4 w-4" />}
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search by contract number, title, company, buyer, supplier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">All statuses</option>
                {CONTRACT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">All companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
              <select
                value={buyerFilter}
                onChange={(e) => setBuyerFilter(e.target.value)}
                className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">All buyers</option>
                {counterparties.map((counterparty) => (
                  <option key={counterparty.id} value={counterparty.id}>
                    {counterparty.legal_name}
                  </option>
                ))}
              </select>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">All suppliers</option>
                {counterparties.map((counterparty) => (
                  <option key={counterparty.id} value={counterparty.id}>
                    {counterparty.legal_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredContracts.length === 0 ? (
            <EmptyState filtered={hasFilters && (contracts?.length ?? 0) > 0} />
          ) : (
            <TableShell rowCount={filteredContracts.length}>
                <table className="w-full min-w-[1280px] text-left text-sm">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                        Contract Number
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                        Title
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                        Company
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                        Buyer
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                        Seller / direction
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                        Contract Date
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                        Expiry Date
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                        Currency
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredContracts.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => router.push(`/contracts/${item.id}`)}
                        className="cursor-pointer transition-colors hover:bg-accent/20"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-foreground">
                          {item.contract_number}
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          {item.title ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {item.company?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {partyName(item.parties, "buyer")}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {partyName(item.parties, "seller")}<span className="block text-xs text-muted-foreground">{contractDirection(item.parties, companyFilter === "all" ? null : companyFilter)}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(item.contract_date)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(item.expiry_date)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {item.currency ?? "—"}
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          {formatAmount(item.amount, item.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={`Edit ${item.contract_number}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditModal(item);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="hidden xl:inline">Edit</span>
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${item.contract_number}`}
                              title="Delete contract"
                              onClick={(event) => {
                                event.stopPropagation();
                                setDeleteTarget(item);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 px-2 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-500/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="hidden xl:inline">Delete</span>
                            </button>
                          </div>
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
