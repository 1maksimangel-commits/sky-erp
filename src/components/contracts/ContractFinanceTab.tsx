"use client";

import { AlertCircle, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Toast } from "@/components/ui/Toast";
import {
  createInvoiceForContract,
  registerPaymentForContract,
} from "@/lib/contracts/hub-actions";
import type {
  ContractFinanceSummary,
  Invoice,
  Payment,
} from "@/lib/contracts/finance";
import { formatContractAmount } from "@/lib/contracts/format";

type ContractFinanceTabProps = {
  contractId: string;
  contractNumber: string;
  hasBusinessCase: boolean;
  summary: ContractFinanceSummary;
  invoices: Invoice[];
  payments: Payment[];
  error: string | null;
};

const inputClassName =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-accent/10 px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function ContractFinanceTab({
  contractId,
  contractNumber,
  hasBusinessCase,
  summary,
  invoices,
  payments,
  error,
}: ContractFinanceTabProps) {
  const router = useRouter();
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const payableInvoices = invoices.filter(
    (invoice) => (invoice.outstanding ?? 0) > 0 && invoice.status !== "Cancelled"
  );
  const [invoiceForm, setInvoiceForm] = useState({
    invoice_number: "",
    amount: "",
    currency: summary.currency,
    status: "Draft",
    due_date: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    invoice_id: payableInvoices[0]?.id ?? "",
    amount: "",
    currency: summary.currency,
    status: "Paid",
    payment_date: "",
    notes: "",
  });

  async function handleCreateInvoice(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    const amount = invoiceForm.amount.trim()
      ? Number(invoiceForm.amount)
      : null;

    const result = await createInvoiceForContract(contractId, {
      invoice_number: invoiceForm.invoice_number,
      amount,
      currency: invoiceForm.currency,
      status: invoiceForm.status,
      due_date: invoiceForm.due_date || null,
    });

    setSaving(false);

    if (!result.success) {
      setFormError(result.error);
      return;
    }

    setInvoiceOpen(false);
    setToast("Invoice created via finance module.");
    router.refresh();
  }

  async function handleRegisterPayment(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    const amount = paymentForm.amount.trim()
      ? Number(paymentForm.amount)
      : null;

    const result = await registerPaymentForContract(contractId, {
      invoice_id: paymentForm.invoice_id,
      amount,
      currency: paymentForm.currency,
      status: paymentForm.status,
      payment_date: paymentForm.payment_date || null,
      notes: paymentForm.notes || null,
    });

    setSaving(false);

    if (!result.success) {
      setFormError(result.error);
      return;
    }

    setPaymentOpen(false);
    setToast("Payment registered against the selected invoice.");
    router.refresh();
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">Finance</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Invoices and payments for {contractNumber} (finance module path)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/finance/reports"
            className="inline-flex items-center gap-2 rounded-md border border-border px-3.5 py-2 text-xs font-medium text-foreground hover:bg-accent"
          >
            Profit reports
          </Link>
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setInvoiceOpen((value) => !value);
              setPaymentOpen(false);
            }}
            disabled={!hasBusinessCase}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3.5 py-2 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Invoice
          </button>
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setPaymentForm((current) => ({
                ...current,
                invoice_id: payableInvoices[0]?.id ?? "",
              }));
              setPaymentOpen((value) => !value);
              setInvoiceOpen(false);
            }}
            className="inline-flex items-center gap-2 rounded-md bg-foreground px-3.5 py-2 text-xs font-medium text-background hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            Register Payment
          </button>
        </div>
      </div>

      {!hasBusinessCase ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div className="space-y-1 text-sm text-amber-100">
            <p>
              Link a business case before invoicing so profit rolls up to the
              deal.
            </p>
            <Link
              href={`/contracts/${contractId}/business-case`}
              className="underline-offset-4 hover:underline"
            >
              Open Business Case tab
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Contract Amount"
          value={formatContractAmount(summary.contractAmount, summary.currency)}
        />
        <SummaryCard
          label="Paid"
          value={formatContractAmount(summary.paid, summary.currency)}
        />
        <SummaryCard
          label="Remaining"
          value={formatContractAmount(summary.remaining, summary.currency)}
        />
        <SummaryCard label="Currency" value={summary.currency} />
        <SummaryCard label="Invoices" value={String(summary.invoiceCount)} />
        <SummaryCard label="Payments" value={String(summary.paymentCount)} />
        <SummaryCard
          label="Outstanding"
          value={formatContractAmount(summary.outstanding, summary.currency)}
        />
      </div>

      {invoiceOpen ? (
        <form
          onSubmit={handleCreateInvoice}
          className="space-y-4 rounded-lg border border-border bg-card p-4"
        >
          {formError ? (
            <p className="text-sm text-red-300">{formError}</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <input
              required
              placeholder="Invoice number"
              value={invoiceForm.invoice_number}
              onChange={(e) =>
                setInvoiceForm((current) => ({
                  ...current,
                  invoice_number: e.target.value,
                }))
              }
              className={inputClassName}
            />
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              placeholder="Amount"
              value={invoiceForm.amount}
              onChange={(e) =>
                setInvoiceForm((current) => ({
                  ...current,
                  amount: e.target.value,
                }))
              }
              className={inputClassName}
            />
            <input
              type="date"
              value={invoiceForm.due_date}
              onChange={(e) =>
                setInvoiceForm((current) => ({
                  ...current,
                  due_date: e.target.value,
                }))
              }
              className={inputClassName}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save Invoice
          </button>
        </form>
      ) : null}

      {paymentOpen ? (
        <form
          onSubmit={handleRegisterPayment}
          className="space-y-4 rounded-lg border border-border bg-card p-4"
        >
          {formError ? (
            <p className="text-sm text-red-300">{formError}</p>
          ) : null}
          {!payableInvoices.length ? (
            <p className="text-sm text-muted-foreground">
              Create an invoice with outstanding balance before registering a
              payment.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <select
                required
                value={paymentForm.invoice_id}
                onChange={(e) =>
                  setPaymentForm((current) => ({
                    ...current,
                    invoice_id: e.target.value,
                  }))
                }
                className={inputClassName}
              >
                <option value="">Select invoice</option>
                {payableInvoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number} — outstanding{" "}
                    {formatContractAmount(
                      invoice.outstanding,
                      invoice.currency
                    )}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="Amount"
                value={paymentForm.amount}
                onChange={(e) =>
                  setPaymentForm((current) => ({
                    ...current,
                    amount: e.target.value,
                  }))
                }
                className={inputClassName}
              />
              <input
                type="date"
                value={paymentForm.payment_date}
                onChange={(e) =>
                  setPaymentForm((current) => ({
                    ...current,
                    payment_date: e.target.value,
                  }))
                }
                className={inputClassName}
              />
              <input
                placeholder="Notes"
                value={paymentForm.notes}
                onChange={(e) =>
                  setPaymentForm((current) => ({
                    ...current,
                    notes: e.target.value,
                  }))
                }
                className={`${inputClassName} sm:col-span-2 xl:col-span-3`}
              />
            </div>
          )}
          <button
            type="submit"
            disabled={saving || !payableInvoices.length}
            className="inline-flex items-center gap-2 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save Payment
          </button>
        </form>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Invoices</h4>
          {!invoices.length ? (
            <p className="text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-card-border bg-card">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-accent/30">
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Number
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Due
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="px-4 py-3 font-mono text-xs">
                        <Link
                          href={`/finance/invoices/${invoice.id}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {invoice.invoice_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {formatContractAmount(
                          invoice.amount,
                          invoice.currency
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {formatDate(invoice.due_date)}
                      </td>
                      <td className="px-4 py-3">{invoice.status ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Payments</h4>
          {!payments.length ? (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-card-border bg-card">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-accent/30">
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Date
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-4 py-3">
                        <Link
                          href={`/finance/payments/${payment.id}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {formatDate(payment.payment_date)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {formatContractAmount(
                          payment.amount,
                          payment.currency
                        )}
                      </td>
                      <td className="px-4 py-3">{payment.status ?? "—"}</td>
                      <td className="px-4 py-3">{payment.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {toast ? (
        <Toast message={toast} onClose={() => setToast(null)} />
      ) : null}
    </div>
  );
}
