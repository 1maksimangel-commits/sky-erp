"use client";

import { AlertCircle, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { registerPayment } from "@/lib/finance/actions";
import type { FinanceInvoice, FinanceOptionBundles } from "@/lib/finance/db";
import { formatMoney } from "@/lib/finance/format";
import { emptyPaymentForm, type PaymentFormInput } from "@/lib/finance/types";
import { validatePaymentFormInput } from "@/lib/finance/validation";
import { useResetWhenOpened } from "@/lib/ui/open-state";

type PaymentFormModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  invoices: FinanceInvoice[];
  options: FinanceOptionBundles;
  defaultInvoiceId?: string | null;
};

const inputClassName =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";
const labelClassName = "mb-1.5 block text-xs font-medium text-muted-foreground";

export function PaymentFormModal({
  open,
  onClose,
  onSaved,
  invoices,
  options,
  defaultInvoiceId = null,
}: PaymentFormModalProps) {
  const [form, setForm] = useState({
    invoice_id: "",
    amount: "",
    currency: "USD",
    payment_date: new Date().toISOString().slice(0, 10),
    bank_account_id: "",
    reference: "",
    notes: "",
    status: "Paid",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openInvoices = useMemo(
    () =>
      invoices.filter(
        (item) =>
          item.outstanding > 0 &&
          item.status !== "Cancelled" &&
          item.status !== "Paid"
      ),
    [invoices]
  );

  const selectedInvoice = openInvoices.find((item) => item.id === form.invoice_id);

  useResetWhenOpened(open, () => {
    const preferred =
      (defaultInvoiceId
        ? openInvoices.find((item) => item.id === defaultInvoiceId)
        : null) ?? openInvoices[0];
    setForm({
      invoice_id: preferred?.id ?? "",
      amount: preferred ? String(preferred.outstanding) : "",
      currency: preferred?.currency ?? "USD",
      payment_date: new Date().toISOString().slice(0, 10),
      bank_account_id: "",
      reference: "",
      notes: "",
      status: "Paid",
    });
    setError(null);
  });

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose, saving]);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const input: PaymentFormInput = {
      ...emptyPaymentForm(),
      invoice_id: form.invoice_id,
      amount: Number(form.amount),
      currency: form.currency,
      payment_date: form.payment_date || null,
      bank_account_id: form.bank_account_id || null,
      reference: form.reference || null,
      notes: form.notes || null,
      status: form.status,
    };

    const validationError = validatePaymentFormInput(input);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    const result = await registerPayment(input);
    setSaving(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={saving ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Register Payment</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Partial payments update invoice balance automatically
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          {error ? (
            <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          ) : null}

          <div>
            <label className={labelClassName}>Invoice *</label>
            <select
              className={inputClassName}
              value={form.invoice_id}
              onChange={(e) => {
                const invoice = openInvoices.find((item) => item.id === e.target.value);
                setForm((current) => ({
                  ...current,
                  invoice_id: e.target.value,
                  amount: invoice ? String(invoice.outstanding) : current.amount,
                  currency: invoice?.currency ?? current.currency,
                }));
              }}
            >
              <option value="">Select invoice</option>
              {openInvoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoice_number} · bal{" "}
                  {formatMoney(invoice.outstanding, invoice.currency)}
                </option>
              ))}
            </select>
          </div>

          {selectedInvoice ? (
            <p className="text-xs text-muted-foreground">
              Outstanding: {formatMoney(selectedInvoice.outstanding, selectedInvoice.currency)}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClassName}>Amount *</label>
              <input
                type="number"
                step="any"
                className={inputClassName}
                value={form.amount}
                onChange={(e) =>
                  setForm((current) => ({ ...current, amount: e.target.value }))
                }
              />
            </div>
            <div>
              <label className={labelClassName}>Currency *</label>
              <input
                className={inputClassName}
                value={form.currency}
                onChange={(e) =>
                  setForm((current) => ({ ...current, currency: e.target.value }))
                }
              />
            </div>
            <div>
              <label className={labelClassName}>Date</label>
              <input
                type="date"
                className={inputClassName}
                value={form.payment_date}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    payment_date: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className={labelClassName}>Bank Account</label>
              <select
                className={inputClassName}
                value={form.bank_account_id}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    bank_account_id: e.target.value,
                  }))
                }
              >
                <option value="">Optional</option>
                {options.bankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClassName}>Reference</label>
            <input
              className={inputClassName}
              value={form.reference}
              onChange={(e) =>
                setForm((current) => ({ ...current, reference: e.target.value }))
              }
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
