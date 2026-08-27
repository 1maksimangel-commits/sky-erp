"use client";

import { AlertCircle, Plus, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import { PaymentFormModal } from "@/components/finance/PaymentFormModal";
import { Toast } from "@/components/ui/Toast";
import type {
  FinanceInvoice,
  FinanceOptionBundles,
  FinancePayment,
} from "@/lib/finance/db";
import { formatFinanceDate, formatMoney } from "@/lib/finance/format";

type PaymentsViewProps = {
  payments: FinancePayment[] | null;
  invoices: FinanceInvoice[];
  options: FinanceOptionBundles;
  error: string | null;
};

export function PaymentsView({
  payments,
  invoices,
  options,
  error,
}: PaymentsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const defaultInvoiceId = searchParams.get("invoice_id");
  const openTrigger =
    searchParams.get("new") === "1"
      ? "new"
      : defaultInvoiceId
        ? `invoice:${defaultInvoiceId}`
        : "";
  const [formOpen, setFormOpen] = useState(Boolean(openTrigger));
  const [prevOpenTrigger, setPrevOpenTrigger] = useState(openTrigger);
  if (openTrigger !== prevOpenTrigger) {
    setPrevOpenTrigger(openTrigger);
    if (openTrigger) {
      setFormOpen(true);
    }
  }
  const [toast, setToast] = useState<string | null>(null);
  const [optimisticPayments, addOptimisticPayment] = useOptimistic(
    payments ?? [],
    (state, payment: FinancePayment) => [payment, ...state]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return optimisticPayments;
    return optimisticPayments.filter((item) =>
      [
        item.invoice?.invoice_number,
        item.business_case?.case_number,
        item.contract?.contract_number,
        item.bank_account?.name,
        item.reference,
        item.status,
      ].some((field) => field?.toLowerCase().includes(query))
    );
  }, [optimisticPayments, search]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div>
            <h3 className="text-sm font-medium text-red-300">Failed to load payments</h3>
            <p className="mt-1 text-sm text-red-400/90">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${isPending ? "opacity-70" : ""}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Incoming and outgoing settlements with partial payment support
        </p>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-3.5 py-2 text-xs font-medium text-background hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Register Payment
        </button>
      </div>

      <PaymentFormModal
        open={formOpen}
        defaultInvoiceId={defaultInvoiceId}
        onClose={() => {
          setFormOpen(false);
          if (searchParams.get("new") === "1" || defaultInvoiceId) {
            router.replace("/finance/payments");
          }
        }}
        onSaved={() => {
          startTransition(() => {
            addOptimisticPayment({
              id: `temp-${Date.now()}`,
              payment_date: new Date().toISOString().slice(0, 10),
              invoice_id: null,
              business_case_id: null,
              contract_id: null,
              bank_account_id: null,
              amount: 0,
              currency: "USD",
              reference: "Saving…",
              status: "Paid",
              notes: null,
              invoice: null,
              business_case: null,
              contract: null,
              bank_account: null,
            });
            router.refresh();
          });
          setToast("Payment registered successfully.");
        }}
        invoices={invoices}
        options={options}
      />

      {toast ? <Toast message={toast} onClose={() => setToast(null)} /> : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search invoice, business case, contract, bank, reference..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {!filtered.length ? (
        <div className="rounded-lg border border-card-border bg-card p-12 text-center text-sm text-muted-foreground">
          No payments recorded yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-card-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-accent/30">
                  {[
                    "Date",
                    "Invoice",
                    "Business Case",
                    "Contract",
                    "Bank",
                    "Currency",
                    "Amount",
                    "Reference",
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
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => router.push(`/finance/payments/${item.id}`)}
                    className="cursor-pointer hover:bg-accent/20"
                  >
                    <td className="px-4 py-3">
                      {formatFinanceDate(item.payment_date)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {item.invoice?.invoice_number ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {item.business_case?.case_number ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {item.contract?.contract_number ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {item.bank_account?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">{item.currency ?? "USD"}</td>
                    <td className="px-4 py-3">
                      {formatMoney(item.amount, item.currency)}
                    </td>
                    <td className="px-4 py-3">{item.reference ?? "—"}</td>
                    <td className="px-4 py-3">{item.status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
