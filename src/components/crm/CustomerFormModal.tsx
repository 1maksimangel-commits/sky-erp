"use client";

import { AlertCircle, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  createCrmCustomer,
  updateCrmCustomer,
} from "@/lib/crm/actions";
import { dateInputToIso, toDateInputValue } from "@/lib/crm/format";
import {
  CRM_CATEGORIES,
  CRM_CUSTOMER_TYPES,
  CRM_STATUSES,
  emptyCrmCustomerForm,
  type CrmCustomer,
  type CrmCustomerFormInput,
} from "@/lib/crm/types";
import { useResetWhenOpened } from "@/lib/ui/open-state";

type CustomerFormModalProps = {
  open: boolean;
  customer?: CrmCustomer | null;
  onClose: () => void;
  onSaved: (id?: string) => void;
};

type FormState = {
  legal_name: string;
  short_name: string;
  contact_person: string;
  country: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  wechat: string;
  category: string;
  manager: string;
  status: string;
  last_contact_at: string;
  next_follow_up_at: string;
  website: string;
  tax_id: string;
  notes_summary: string;
  customer_type: string;
  interested_products: string;
  markets: string;
  annual_volume: string;
  preferred_incoterms: string;
  preferred_currency: string;
  preferred_payment_terms: string;
};

const inputClassName =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";
const labelClassName = "mb-1.5 block text-xs font-medium text-muted-foreground";

function toFormState(customer?: CrmCustomer | null): FormState {
  if (!customer) {
    const empty = emptyCrmCustomerForm();
    return {
      legal_name: "",
      short_name: "",
      contact_person: "",
      country: "",
      city: "",
      address: "",
      phone: "",
      email: "",
      wechat: "",
      category: empty.category,
      manager: "",
      status: empty.status,
      last_contact_at: "",
      next_follow_up_at: "",
      website: "",
      tax_id: "",
      notes_summary: "",
      customer_type: "",
      interested_products: "",
      markets: "",
      annual_volume: "",
      preferred_incoterms: "",
      preferred_currency: "",
      preferred_payment_terms: "",
    };
  }

  return {
    legal_name: customer.legal_name ?? customer.company_name,
    short_name: customer.short_name ?? "",
    contact_person: customer.contact_person ?? "",
    country: customer.country ?? "",
    city: customer.city ?? "",
    address: customer.address ?? "",
    phone: customer.phone ?? "",
    email: customer.email ?? "",
    wechat: customer.wechat ?? "",
    category: customer.category,
    manager: customer.manager ?? "",
    status: customer.status,
    last_contact_at: toDateInputValue(customer.last_contact_at),
    next_follow_up_at: toDateInputValue(customer.next_follow_up_at),
    website: customer.website ?? "",
    tax_id: customer.tax_id ?? "",
    notes_summary: customer.notes_summary ?? "",
    customer_type: customer.customer_type ?? "",
    interested_products: customer.interested_products ?? "",
    markets: customer.markets ?? "",
    annual_volume: customer.annual_volume ?? "",
    preferred_incoterms: customer.preferred_incoterms ?? "",
    preferred_currency: customer.preferred_currency ?? "",
    preferred_payment_terms: customer.preferred_payment_terms ?? "",
  };
}

function toInput(form: FormState): CrmCustomerFormInput {
  const legal = form.legal_name.trim();
  return {
    company_name: legal,
    legal_name: legal || null,
    short_name: form.short_name.trim() || null,
    contact_person: form.contact_person.trim() || null,
    country: form.country.trim() || null,
    city: form.city.trim() || null,
    address: form.address.trim() || null,
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    wechat: form.wechat.trim() || null,
    category: form.category as CrmCustomerFormInput["category"],
    manager: form.manager.trim() || null,
    status: form.status as CrmCustomerFormInput["status"],
    last_contact_at: dateInputToIso(form.last_contact_at),
    next_follow_up_at: dateInputToIso(form.next_follow_up_at),
    website: form.website.trim() || null,
    tax_id: form.tax_id.trim() || null,
    notes_summary: form.notes_summary.trim() || null,
    customer_type: form.customer_type.trim() || null,
    interested_products: form.interested_products.trim() || null,
    markets: form.markets.trim() || null,
    annual_volume: form.annual_volume.trim() || null,
    preferred_incoterms: form.preferred_incoterms.trim() || null,
    preferred_currency: form.preferred_currency.trim() || null,
    preferred_payment_terms: form.preferred_payment_terms.trim() || null,
    counterparty_id: null,
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

export function CustomerFormModal({
  open,
  customer,
  onClose,
  onSaved,
}: CustomerFormModalProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(customer));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(customer);

  useResetWhenOpened(open, () => {
    setForm(toFormState(customer));
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.legal_name.trim()) {
      setError("Legal name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    const payload = toInput(form);
    const result = customer
      ? await updateCrmCustomer(customer.id, payload)
      : await createCrmCustomer(payload);
    setSaving(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    onSaved(result.data.id);
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
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {editing ? "Edit customer" : "New customer"}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Seafood trading CRM account
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-50"
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

            <div className="space-y-6">
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Company
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field label="Legal name" required>
                      <input
                        value={form.legal_name}
                        onChange={(e) =>
                          updateField("legal_name", e.target.value)
                        }
                        className={inputClassName}
                        autoFocus
                      />
                    </Field>
                  </div>
                  <Field label="Short name">
                    <input
                      value={form.short_name}
                      onChange={(e) =>
                        updateField("short_name", e.target.value)
                      }
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="Status">
                    <select
                      value={form.status}
                      onChange={(e) => updateField("status", e.target.value)}
                      className={inputClassName}
                    >
                      {CRM_STATUSES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Country">
                    <input
                      value={form.country}
                      onChange={(e) => updateField("country", e.target.value)}
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="City">
                    <input
                      value={form.city}
                      onChange={(e) => updateField("city", e.target.value)}
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="Website">
                    <input
                      value={form.website}
                      onChange={(e) => updateField("website", e.target.value)}
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="Tax ID">
                    <input
                      value={form.tax_id}
                      onChange={(e) => updateField("tax_id", e.target.value)}
                      className={inputClassName}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Address">
                      <textarea
                        rows={2}
                        value={form.address}
                        onChange={(e) => updateField("address", e.target.value)}
                        className={`${inputClassName} resize-none`}
                      />
                    </Field>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Business
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Customer type">
                    <select
                      value={form.customer_type}
                      onChange={(e) =>
                        updateField("customer_type", e.target.value)
                      }
                      className={inputClassName}
                    >
                      <option value="">Select type</option>
                      {CRM_CUSTOMER_TYPES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Category">
                    <select
                      value={form.category}
                      onChange={(e) => updateField("category", e.target.value)}
                      className={inputClassName}
                    >
                      {CRM_CATEGORIES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Interested products">
                    <input
                      value={form.interested_products}
                      onChange={(e) =>
                        updateField("interested_products", e.target.value)
                      }
                      placeholder="e.g. Salmon, Crab, Shrimp"
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="Markets">
                    <input
                      value={form.markets}
                      onChange={(e) => updateField("markets", e.target.value)}
                      placeholder="e.g. China, EU, Japan"
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="Annual volume">
                    <input
                      value={form.annual_volume}
                      onChange={(e) =>
                        updateField("annual_volume", e.target.value)
                      }
                      placeholder="e.g. 2,000 MT"
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="Preferred Incoterms">
                    <input
                      value={form.preferred_incoterms}
                      onChange={(e) =>
                        updateField("preferred_incoterms", e.target.value)
                      }
                      placeholder="e.g. CIF, FOB"
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="Preferred currency">
                    <input
                      value={form.preferred_currency}
                      onChange={(e) =>
                        updateField("preferred_currency", e.target.value)
                      }
                      placeholder="e.g. USD"
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="Preferred payment terms">
                    <input
                      value={form.preferred_payment_terms}
                      onChange={(e) =>
                        updateField("preferred_payment_terms", e.target.value)
                      }
                      placeholder="e.g. TT 30%"
                      className={inputClassName}
                    />
                  </Field>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Relationship
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Primary contact">
                    <input
                      value={form.contact_person}
                      onChange={(e) =>
                        updateField("contact_person", e.target.value)
                      }
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="Manager">
                    <input
                      value={form.manager}
                      onChange={(e) => updateField("manager", e.target.value)}
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="Phone">
                    <input
                      value={form.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="Last contact">
                    <input
                      type="date"
                      value={form.last_contact_at}
                      onChange={(e) =>
                        updateField("last_contact_at", e.target.value)
                      }
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="Next follow-up">
                    <input
                      type="date"
                      value={form.next_follow_up_at}
                      onChange={(e) =>
                        updateField("next_follow_up_at", e.target.value)
                      }
                      className={inputClassName}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Summary notes">
                      <textarea
                        rows={3}
                        value={form.notes_summary}
                        onChange={(e) =>
                          updateField("notes_summary", e.target.value)
                        }
                        className={`${inputClassName} resize-none`}
                      />
                    </Field>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
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
