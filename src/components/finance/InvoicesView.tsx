"use client";

import { AlertCircle, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { InvoiceFormModal } from "@/components/finance/InvoiceFormModal";
import { PageActions } from "@/components/layout/ShellContext";
import { TableShell } from "@/components/ui/TableShell";
import { Toast } from "@/components/ui/Toast";
import type { FinanceInvoice, FinanceOptionBundles } from "@/lib/finance/db";
import { formatFinanceDate, formatMoney } from "@/lib/finance/format";
import { FINANCE_CURRENCIES, INVOICE_STATUSES } from "@/lib/finance/types";
import { useSearchParamOpen } from "@/lib/ui/open-state";

const PAGE_SIZE = 10;

type InvoicesViewProps = {
  invoices: FinanceInvoice[] | null;
  error: string | null;
  options: FinanceOptionBundles;
};

function StatusBadge({ status }: { status: string | null }) {
  const label = status ?? "Draft";
  const className =
    label === "Paid"
      ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
      : label === "Partially Paid" || label === "Issued"
        ? "bg-blue-500/10 text-blue-400 ring-blue-500/20"
        : label === "Overdue" || label === "Cancelled"
          ? "bg-red-500/10 text-red-400 ring-red-500/20"
          : "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {label}
    </span>
  );
}

export function InvoicesView({ invoices, error, options }: InvoicesViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [buyerFilter, setBuyerFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useSearchParamOpen();
  const [toast, setToast] = useState<string | null>(null);

  const buyers = useMemo(
    () =>
      [...new Map(
        (invoices ?? [])
          .filter((item) => item.buyer)
          .map((item) => [item.buyer!.id, item.buyer!.legal_name])
      )],
    [invoices]
  );

  const suppliers = useMemo(
    () =>
      [...new Map(
        (invoices ?? [])
          .filter((item) => item.supplier)
          .map((item) => [item.supplier!.id, item.supplier!.legal_name])
      )],
    [invoices]
  );

  const filtered = useMemo(() => {
    if (!invoices) return [];
    const query = search.trim().toLowerCase();

    return invoices.filter((item) => {
      if (statusFilter !== "all" && (item.status ?? "Draft") !== statusFilter) {
        return false;
      }
      if (buyerFilter !== "all" && item.buyer_id !== buyerFilter) return false;
      if (supplierFilter !== "all" && item.supplier_id !== supplierFilter) {
        return false;
      }
      if (currencyFilter !== "all" && (item.currency ?? "USD") !== currencyFilter) {
        return false;
      }
      if (companyFilter !== "all" && item.company_id !== companyFilter) {
        return false;
      }
      if (!query) return true;
      return [
        item.invoice_number,
        item.business_case?.case_number,
        item.contract?.contract_number,
        item.buyer?.legal_name,
        item.supplier?.legal_name,
      ].some((field) => field?.toLowerCase().includes(query));
    });
  }, [
    invoices,
    search,
    statusFilter,
    buyerFilter,
    supplierFilter,
    currencyFilter,
    companyFilter,
  ]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div>
            <h3 className="text-sm font-medium text-red-300">Failed to load invoices</h3>
            <p className="mt-1 text-sm text-red-400/90">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${isPending ? "opacity-70" : ""}`}>
      <PageActions>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-3.5 py-2 text-xs font-medium text-background hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Invoice
        </button>
      </PageActions>

      <InvoiceFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          if (searchParams.get("new") === "1") {
            router.replace("/finance/invoices");
          }
        }}
        onSaved={() => {
          startTransition(() => router.refresh());
          setToast("Invoice created successfully.");
          if (searchParams.get("new") === "1") {
            router.replace("/finance/invoices");
          }
        }}
        options={options}
      />

      {toast ? <Toast message={toast} onClose={() => setToast(null)} /> : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search invoice, business case, contract, buyer, supplier..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          {INVOICE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          value={buyerFilter}
          onChange={(e) => {
            setBuyerFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="all">All buyers</option>
          {buyers.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={supplierFilter}
          onChange={(e) => {
            setSupplierFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="all">All suppliers</option>
          {suppliers.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={currencyFilter}
          onChange={(e) => {
            setCurrencyFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="all">All currencies</option>
          {(options.currencies.length
            ? options.currencies
            : [...FINANCE_CURRENCIES]
          ).map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        <select
          value={companyFilter}
          onChange={(e) => {
            setCompanyFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="all">All companies</option>
          {options.companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </div>

      {!pageRows.length ? (
        <div className="erp-panel p-12 text-center text-sm text-muted-foreground">
          No invoices match your filters.
        </div>
      ) : (
        <TableShell
          rowCount={filtered.length}
          showColumnHint={false}
          footer={
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {filtered.length} invoice{filtered.length === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-md p-1.5 hover:bg-accent disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span>
                  Page {currentPage} / {pageCount}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  className="rounded-md p-1.5 hover:bg-accent disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          }
        >
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead>
              <tr>
                {[
                  "Invoice Number",
                  "Type",
                  "Business Case",
                  "Contract",
                  "Buyer",
                  "Supplier",
                  "Currency",
                  "Amount",
                  "Paid",
                  "Balance",
                  "Due Date",
                  "Status",
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
              {pageRows.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => router.push(`/finance/invoices/${item.id}`)}
                  className="cursor-pointer hover:bg-accent/20"
                >
                  <td className="px-4 py-3 font-mono text-xs">
                    {item.invoice_number}
                  </td>
                  <td className="px-4 py-3">{item.invoice_type ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {item.business_case?.case_number ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {item.contract?.contract_number ?? "—"}
                  </td>
                  <td className="px-4 py-3">{item.buyer?.legal_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    {item.supplier?.legal_name ?? "—"}
                  </td>
                  <td className="px-4 py-3">{item.currency ?? "USD"}</td>
                  <td className="px-4 py-3">
                    {formatMoney(item.amount, item.currency)}
                  </td>
                  <td className="px-4 py-3">
                    {formatMoney(item.paid_amount, item.currency)}
                  </td>
                  <td className="px-4 py-3">
                    {formatMoney(item.outstanding, item.currency)}
                  </td>
                  <td className="px-4 py-3">
                    {formatFinanceDate(item.due_date)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.status} />
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
