"use client";

import { AlertCircle, Loader2, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createInvoice, updateInvoice } from "@/lib/finance/actions";
import type { FinanceOptionBundles } from "@/lib/finance/db";
import {
  FINANCE_CURRENCIES,
  emptyInvoiceForm,
  type InvoiceFormInput,
  type InvoiceItemInput,
} from "@/lib/finance/types";
import { validateInvoiceFormInput } from "@/lib/finance/validation";
import { useResetWhenOpened } from "@/lib/ui/open-state";

type InvoiceFormModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  options: FinanceOptionBundles;
  invoiceId?: string;
  initial?: InvoiceFormInput;
};

type FormState = {
  invoice_number: string;
  invoice_type: string;
  contract_id: string;
  business_case_id: string;
  shipment_id: string;
  company_id: string;
  buyer_id: string;
  supplier_id: string;
  currency: string;
  issue_date: string;
  due_date: string;
  payment_terms: string;
  tax_rate: string;
  status: string;
  notes: string;
  items: Array<{
    product_id: string;
    description: string;
    quantity: string;
    unit_price: string;
    tax_rate: string;
  }>;
};

const inputClassName =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";
const labelClassName = "mb-1.5 block text-xs font-medium text-muted-foreground";

function toFormState(values: InvoiceFormInput): FormState {
  return {
    invoice_number: values.invoice_number,
    invoice_type: values.invoice_type,
    contract_id: values.contract_id,
    business_case_id: values.business_case_id ?? "",
    shipment_id: values.shipment_id ?? "",
    company_id: values.company_id ?? "",
    buyer_id: values.buyer_id ?? "",
    supplier_id: values.supplier_id ?? "",
    currency: values.currency,
    issue_date: values.issue_date ?? "",
    due_date: values.due_date ?? "",
    payment_terms: values.payment_terms ?? "",
    tax_rate: String(values.tax_rate ?? 0),
    status: values.status,
    notes: values.notes ?? "",
    items: values.items.map((item) => ({
      product_id: item.product_id ?? "",
      description: item.description,
      quantity: String(item.quantity),
      unit_price: String(item.unit_price),
      tax_rate: String(item.tax_rate),
    })),
  };
}

function toFormInput(form: FormState): InvoiceFormInput {
  return {
    invoice_number: form.invoice_number,
    invoice_type: form.invoice_type,
    contract_id: form.contract_id,
    business_case_id: form.business_case_id || null,
    shipment_id: form.shipment_id || null,
    company_id: form.company_id || null,
    buyer_id: form.buyer_id || null,
    supplier_id: form.supplier_id || null,
    currency: form.currency,
    issue_date: form.issue_date || null,
    due_date: form.due_date || null,
    payment_terms: form.payment_terms || null,
    tax_rate: Number(form.tax_rate) || 0,
    status: form.status,
    notes: form.notes || null,
    items: form.items.map(
      (item): InvoiceItemInput => ({
        product_id: item.product_id || null,
        description: item.description,
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.unit_price) || 0,
        tax_rate: Number(item.tax_rate) || 0,
      })
    ),
  };
}

function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className={labelClassName}>
        {label}
        {required ? <span className="text-red-400"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function InvoiceFormModal({
  open,
  onClose,
  onSaved,
  options,
  invoiceId,
  initial,
}: InvoiceFormModalProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(initial ?? emptyInvoiceForm()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currencies = options.currencies.length
    ? options.currencies
    : [...FINANCE_CURRENCIES];

  const filteredShipments = useMemo(() => {
    if (!form.contract_id) return options.shipments ?? [];
    return (options.shipments ?? []).filter(
      (item) => !item.contract_id || item.contract_id === form.contract_id
    );
  }, [form.contract_id, options.shipments]);

  const filteredBusinessCases = useMemo(() => {
    const contract = options.contracts.find((item) => item.id === form.contract_id);
    if (!contract) return options.businessCases;
    return options.businessCases.filter(
      (item) =>
        item.id === contract.business_case_id
    );
  }, [form.contract_id, options.businessCases, options.contracts]);

  const totals = useMemo(() => {
    const subtotal = form.items.reduce(
      (sum, item) =>
        sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
      0
    );
    const tax = form.items.reduce((sum, item) => {
      const base = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
      return sum + (base * (Number(item.tax_rate) || 0)) / 100;
    }, 0);
    return { subtotal, tax, total: subtotal + tax };
  }, [form.items]);

  useResetWhenOpened(open, () => {
    setForm(toFormState(initial ?? emptyInvoiceForm()));
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

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function updateItem(
    index: number,
    key: keyof FormState["items"][number],
    value: string
  ) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, i) =>
        i === index ? { ...item, [key]: value } : item
      ),
    }));
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const input = toFormInput(form);
    const validationError = validateInvoiceFormInput(input);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    const result = invoiceId ? await updateInvoice(invoiceId, input) : await createInvoice(input);
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
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-semibold text-foreground">{invoiceId ? "Edit Draft Invoice" : "Create Invoice"}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Record an obligation linked to its Contract and Deal
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
            {error ? (
              <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            ) : null}

            <Section title="General">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Invoice Number" required>
                  <input
                    className={inputClassName}
                    value={form.invoice_number}
                    onChange={(e) => updateField("invoice_number", e.target.value)}
                  />
                </Field>
                <p className="text-sm text-muted-foreground">Issuer and recipient come from the selected Contract. Direction is relative to the selected company.</p>
                <Field label="Status" required>
                  <select
                    className={inputClassName}
                    value={form.status}
                    onChange={(e) => updateField("status", e.target.value)}
                  >
                    {["Draft", "Issued"].map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Company">
                  <select
                    className={inputClassName}
                    value={form.company_id}
                    onChange={(e) => updateField("company_id", e.target.value)}
                  >
                    <option value="">Select company</option>
                    {options.companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </Section>

            <Section title="Commercial">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Contract" required>
                  <select
                    className={inputClassName}
                    value={form.contract_id}
                    onChange={(e) => {
                      const contract = options.contracts.find(
                        (item) => item.id === e.target.value
                      );
                      setForm((current) => ({
                        ...current,
                        contract_id: e.target.value,
                        business_case_id: contract?.business_case_id ?? "",
                        shipment_id: "",
                        company_id: current.company_id || contract?.company_id || "",
                        buyer_id: contract?.buyer_id ?? current.buyer_id,
                        supplier_id: contract?.supplier_id ?? current.supplier_id,
                        currency: contract?.currency ?? current.currency,
                      }));
                    }}
                  >
                    <option value="">Select contract</option>
                    {options.contracts.map((contract) => (
                      <option key={contract.id} value={contract.id}>
                        {contract.contract_number}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Business Case">
                  <select
                    className={inputClassName}
                    value={form.business_case_id}
                    onChange={(e) =>
                      updateField("business_case_id", e.target.value)
                    }
                  >
                    <option value="">Select business case</option>
                    {filteredBusinessCases.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.case_number}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Shipment">
                  <select
                    className={inputClassName}
                    value={form.shipment_id}
                    onChange={(e) => updateField("shipment_id", e.target.value)}
                  >
                    <option value="">Select shipment</option>
                    {filteredShipments.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.container || item.id.slice(0, 8)}
                        {item.status ? ` (${item.status})` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                <p className="text-sm sm:col-span-2">
                  {options.contracts.find(c => c.id === form.contract_id)?.parties.map(p =>
                    p.role_code === "seller" || p.role_code === "buyer" ? <span className="mr-4" key={p.role_code}>{p.role_code === "seller" ? "Issuer" : "Recipient"}: {p.snapshot.legal_name ?? "Review Contract party"}</span> : null)}
                </p>
              </div>
            </Section>

            <Section title="Items">
              <div className="space-y-3">
                {form.items.map((item, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-6"
                  >
                    <Field label="Product" className="sm:col-span-2">
                      <select
                        className={inputClassName}
                        value={item.product_id}
                        onChange={(e) => {
                          const product = options.products.find(
                            (p) => p.id === e.target.value
                          );
                          updateItem(index, "product_id", e.target.value);
                          if (product) {
                            updateItem(
                              index,
                              "description",
                              `${product.sku} — ${product.name}`
                            );
                          }
                        }}
                      >
                        <option value="">Optional product</option>
                        {options.products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.sku} — {product.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Description" required className="sm:col-span-2">
                      <input
                        className={inputClassName}
                        value={item.description}
                        onChange={(e) =>
                          updateItem(index, "description", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="Qty" required>
                      <input
                        type="number"
                        step="any"
                        className={inputClassName}
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(index, "quantity", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="Unit Price" required>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="any"
                          className={inputClassName}
                          value={item.unit_price}
                          onChange={(e) =>
                            updateItem(index, "unit_price", e.target.value)
                          }
                        />
                        {form.items.length > 1 ? (
                          <button
                            type="button"
                            aria-label="Remove item"
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                items: current.items.filter((_, i) => i !== index),
                              }))
                            }
                            className="rounded-md p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </Field>
                    <Field label="Tax %" className="sm:col-span-2">
                      <input
                        type="number"
                        step="any"
                        className={inputClassName}
                        value={item.tax_rate}
                        onChange={(e) =>
                          updateItem(index, "tax_rate", e.target.value)
                        }
                      />
                    </Field>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      items: [
                        ...current.items,
                        {
                          product_id: "",
                          description: "",
                          quantity: "1",
                          unit_price: "0",
                          tax_rate: current.tax_rate || "0",
                        },
                      ],
                    }))
                  }
                  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-accent"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add line
                </button>
              </div>
            </Section>

            <Section title="Taxes & Payment">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Currency" required>
                  <select
                    className={inputClassName}
                    value={form.currency}
                    onChange={(e) => updateField("currency", e.target.value)}
                  >
                    {currencies.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Default Tax %">
                  <input
                    type="number"
                    step="any"
                    className={inputClassName}
                    value={form.tax_rate}
                    onChange={(e) => updateField("tax_rate", e.target.value)}
                  />
                </Field>
                <Field label="Issue Date">
                  <input
                    type="date"
                    className={inputClassName}
                    value={form.issue_date}
                    onChange={(e) => updateField("issue_date", e.target.value)}
                  />
                </Field>
                <Field label="Due Date">
                  <input
                    type="date"
                    className={inputClassName}
                    value={form.due_date}
                    onChange={(e) => updateField("due_date", e.target.value)}
                  />
                </Field>
                <Field label="Payment Terms" className="sm:col-span-2">
                  <input
                    className={inputClassName}
                    value={form.payment_terms}
                    onChange={(e) => updateField("payment_terms", e.target.value)}
                    placeholder="Net 30, CAD, TT against docs..."
                  />
                </Field>
              </div>
              <div className="rounded-lg border border-border bg-accent/20 px-4 py-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="mt-1 flex justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span>{totals.tax.toFixed(2)}</span>
                </div>
                <div className="mt-2 flex justify-between font-medium text-foreground">
                  <span>Total</span>
                  <span>
                    {totals.total.toFixed(2)} {form.currency}
                  </span>
                </div>
              </div>
            </Section>

            <Section title="Notes">
              <textarea
                className={inputClassName}
                rows={3}
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
              />
            </Section>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Invoice"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
