"use client";

import { AlertCircle, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createBusinessCase } from "@/lib/business-cases/actions";
import {
  emptyBusinessCaseForm,
  type BusinessCaseFormInput,
} from "@/lib/business-cases/types";
import type { Company } from "@/lib/companies";
import type { Counterparty } from "@/lib/counterparties";
import { useResetWhenOpened } from "@/lib/ui/open-state";

type BusinessCaseFormModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  companies: Company[];
  counterparties: Counterparty[];
};

type FormState = {
  case_number: string;
  case_type: string;
  title: string;
  company_id: string;
  buyer_id: string;
  supplier_id: string;
  consignee_id: string;
  status: string;
  contract_number: string;
  contract_date: string;
  currency: string;
  contract_amount: string;
  incoterms: string;
};

const inputClassName =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

const labelClassName = "mb-1.5 block text-xs font-medium text-muted-foreground";

function toFormState(values: BusinessCaseFormInput): FormState {
  return {
    case_number: values.case_number,
    case_type: values.case_type ?? "",
    title: values.title ?? "",
    company_id: values.company_id ?? "",
    buyer_id: values.buyer_id ?? "",
    supplier_id: values.supplier_id ?? "",
    consignee_id: values.consignee_id ?? "",
    status: values.status,
    contract_number: values.contract_number ?? "",
    contract_date: values.contract_date ?? "",
    currency: values.currency ?? "USD",
    contract_amount:
      values.contract_amount != null ? String(values.contract_amount) : "",
    incoterms: values.incoterms ?? "",
  };
}

function toFormInput(form: FormState): BusinessCaseFormInput {
  const amount = form.contract_amount.trim();
  const parsedAmount = amount ? Number(amount) : null;

  return {
    case_number: form.case_number.trim(),
    case_type: form.case_type.trim() || null,
    title: form.title.trim() || null,
    company_id: form.company_id || null,
    buyer_id: form.buyer_id || null,
    supplier_id: form.supplier_id || null,
    consignee_id: form.consignee_id || null,
    status: form.status.trim() || "Draft",
    contract_number: form.contract_number.trim() || null,
    contract_date: form.contract_date || null,
    currency: form.currency.trim() || "USD",
    contract_amount:
      parsedAmount != null && Number.isFinite(parsedAmount) ? parsedAmount : null,
    incoterms: form.incoterms.trim() || null,
  };
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClassName}>
        {label}
        {required ? <span className="text-red-400"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

export function BusinessCaseFormModal({
  open,
  onClose,
  onSaved,
  companies,
  counterparties,
}: BusinessCaseFormModalProps) {
  const [form, setForm] = useState<FormState>(() =>
    toFormState(emptyBusinessCaseForm())
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useResetWhenOpened(open, () => {
    setForm(toFormState(emptyBusinessCaseForm()));
    setError(null);
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose, saving]);

  if (!open) {
    return null;
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!form.case_number.trim()) {
      setError("Case number is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const result = await createBusinessCase(toFormInput(form));

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
        aria-labelledby="business-case-form-title"
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2
              id="business-case-form-title"
              className="text-base font-semibold text-foreground"
            >
              New Deal
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Create a core trading entity for this deal
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="overflow-y-auto px-5 py-5 sm:px-6">
            {error ? (
              <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Deal Number" required>
                <input
                  type="text"
                  value={form.case_number}
                  onChange={(e) => updateField("case_number", e.target.value)}
                  placeholder="BC-2026-001"
                  className={inputClassName}
                />
              </Field>
              <Field label="Case Type">
                <input
                  type="text"
                  value={form.case_type}
                  onChange={(e) => updateField("case_type", e.target.value)}
                  placeholder="Import, Export..."
                  className={inputClassName}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Title">
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => updateField("title", e.target.value)}
                    className={inputClassName}
                  />
                </Field>
              </div>
              <Field label="Company">
                <select
                  required
                  value={form.company_id}
                  onChange={(e) => updateField("company_id", e.target.value)}
                  className={inputClassName}
                >
                  <option value="">Select company</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) => updateField("status", e.target.value)}
                  className={inputClassName}
                >
                  <option value="Draft">Draft</option>
                  <option value="Active">Active</option>
                  <option value="Documentation">Documentation</option>
                  <option value="In Transit">In Transit</option>
                  <option value="Payment">Payment</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Closed">Closed (legacy)</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </Field>
              <Field label="Buyer">
                <select
                  value={form.buyer_id}
                  onChange={(e) => updateField("buyer_id", e.target.value)}
                  className={inputClassName}
                >
                  <option value="">Select buyer</option>
                  {counterparties.map((counterparty) => (
                    <option key={counterparty.id} value={counterparty.id}>
                      {counterparty.legal_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Supplier">
                <select
                  value={form.supplier_id}
                  onChange={(e) => updateField("supplier_id", e.target.value)}
                  className={inputClassName}
                >
                  <option value="">Select supplier</option>
                  {counterparties.map((counterparty) => (
                    <option key={counterparty.id} value={counterparty.id}>
                      {counterparty.legal_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Consignee">
                <select
                  value={form.consignee_id}
                  onChange={(e) => updateField("consignee_id", e.target.value)}
                  className={inputClassName}
                >
                  <option value="">Select consignee</option>
                  {counterparties.map((counterparty) => (
                    <option key={counterparty.id} value={counterparty.id}>
                      {counterparty.legal_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Contract Number">
                <input
                  type="text"
                  value={form.contract_number}
                  onChange={(e) =>
                    updateField("contract_number", e.target.value)
                  }
                  className={inputClassName}
                />
              </Field>
              <Field label="Contract Date">
                <input
                  type="date"
                  value={form.contract_date}
                  onChange={(e) => updateField("contract_date", e.target.value)}
                  className={inputClassName}
                />
              </Field>
              <Field label="Contract Amount">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.contract_amount}
                  onChange={(e) =>
                    updateField("contract_amount", e.target.value)
                  }
                  className={inputClassName}
                />
              </Field>
              <Field label="Currency">
                <select
                  value={form.currency}
                  onChange={(e) => updateField("currency", e.target.value)}
                  className={inputClassName}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="CNY">CNY</option>
                  <option value="JPY">JPY</option>
                </select>
              </Field>
              <Field label="Incoterms">
                <input
                  type="text"
                  value={form.incoterms}
                  onChange={(e) => updateField("incoterms", e.target.value)}
                  placeholder="CFR, FOB..."
                  className={inputClassName}
                />
              </Field>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
