"use client";

import { AlertCircle, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createCounterparty, updateCounterparty } from "@/lib/counterparties/actions";
import {
  COUNTERPARTY_TYPES,
  emptyCounterpartyForm,
  type CounterpartyFormInput,
} from "@/lib/counterparties/types";
import { useResetWhenOpened } from "@/lib/ui/open-state";
import type { Company } from "@/lib/companies";

type CounterpartyFormModalProps = {
  existingId?: string;
  initialValues?: CounterpartyFormInput;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  companies?: Company[];
};

type FormState = {
  source_company_id: string | null;
  code: string;
  legal_name: string;
  short_name: string;
  counterparty_type: string;
  country: string;
  city: string;
  address: string;
  tax_id: string;
  registration_number: string;
  email: string;
  phone: string;
  website: string;
  authorized_signer_name: string;
  authorized_signer_title: string;
  bank_account_name: string;
  bank_name: string;
  bank_address: string;
  account_number: string;
  iban: string;
  swift: string;
  bank_currency: string;
  is_active: boolean;
};

const inputClassName =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

const labelClassName = "mb-1.5 block text-xs font-medium text-muted-foreground";

function toFormState(values: CounterpartyFormInput): FormState {
  return {
    source_company_id: values.source_company_id ?? null,
    code: values.code,
    legal_name: values.legal_name,
    short_name: values.short_name ?? "",
    counterparty_type: COUNTERPARTY_TYPES.find(type => type.toLowerCase() === values.counterparty_type?.toLowerCase()) ?? values.counterparty_type ?? "",
    country: values.country ?? "",
    city: values.city ?? "",
    address: values.address ?? "",
    tax_id: values.tax_id ?? "",
    registration_number: values.registration_number ?? "",
    email: values.email ?? "",
    phone: values.phone ?? "",
    website: values.website ?? "",
    authorized_signer_name: values.authorized_signer_name ?? "",
    authorized_signer_title: values.authorized_signer_title ?? "",
    bank_account_name: values.bank_account_name ?? "",
    bank_name: values.bank_name ?? "",
    bank_address: values.bank_address ?? "",
    account_number: values.account_number ?? "",
    iban: values.iban ?? "",
    swift: values.swift ?? "",
    bank_currency: values.bank_currency ?? "USD",
    is_active: values.is_active,
  };
}

function toFormInput(form: FormState): CounterpartyFormInput {
  return {
    source_company_id: form.source_company_id,
    code: form.code.trim(),
    legal_name: form.legal_name.trim(),
    short_name: form.short_name.trim() || null,
    counterparty_type: form.counterparty_type.trim() || null,
    country: form.country.trim() || null,
    city: form.city.trim() || null,
    address: form.address.trim() || null,
    tax_id: form.tax_id.trim() || null,
    registration_number: form.registration_number.trim() || null,
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    website: form.website.trim() || null,
    authorized_signer_name: form.authorized_signer_name.trim() || null,
    authorized_signer_title: form.authorized_signer_title.trim() || null,
    bank_account_name: form.bank_account_name.trim() || null,
    bank_name: form.bank_name.trim() || null,
    bank_address: form.bank_address.trim() || null,
    account_number: form.account_number.trim() || null,
    iban: form.iban.trim() || null,
    swift: form.swift.trim().toUpperCase() || null,
    bank_currency: form.bank_currency.trim().toUpperCase() || "USD",
    is_active: form.is_active,
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

export function CounterpartyFormModal({
  open,
  existingId,
  initialValues,
  onClose,
  onSaved,
  companies = [],
}: CounterpartyFormModalProps) {
  const [form, setForm] = useState<FormState>(() =>
    toFormState(initialValues ?? emptyCounterpartyForm())
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useResetWhenOpened(open, () => {
    setForm(toFormState(initialValues ?? emptyCounterpartyForm()));
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

  function handleCompanyChange(companyId: string) {
    const company = companies.find((item) => item.id === companyId);
    if (!company) {
      updateField("source_company_id", companyId || null);
      return;
    }
    const bank = company.bank_accounts[0] ?? null;
    setForm((current) => ({
      ...current,
      source_company_id: company.id,
      code: company.code,
      legal_name: company.name,
      short_name: company.short_name ?? "",
      country: company.country ?? "",
      city: company.city ?? "",
      address: company.address ?? "",
      tax_id: company.tax_id ?? "",
      registration_number: company.registration_number ?? "",
      email: company.email ?? "",
      phone: company.phone ?? "",
      website: company.website ?? "",
      authorized_signer_name: company.authorized_signer_name ?? "",
      authorized_signer_title: company.authorized_signer_title ?? "",
      bank_account_name: bank?.name ?? "",
      bank_name: bank?.bank_name ?? "",
      bank_address: bank?.bank_address ?? "",
      account_number: bank?.account_number ?? "",
      iban: bank?.iban ?? "",
      swift: bank?.swift ?? "",
      bank_currency: bank?.currency ?? "USD",
    }));
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!form.legal_name.trim()) {
      setError("Legal name is required.");
      return;
    }

    if (!form.counterparty_type.trim()) {
      setError("Counterparty type is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const result = await (existingId ? updateCounterparty(existingId, toFormInput(form)) : createCounterparty(toFormInput(form)));

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
        aria-labelledby="counterparty-form-title"
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2
              id="counterparty-form-title"
              className="text-base font-semibold text-foreground"
            >
              {existingId ? "Edit Counterparty" : "New Counterparty"}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Add a buyer, supplier, or business partner
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
              <Field label="Code">
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => updateField("code", e.target.value)}
                  className={inputClassName}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Legal Name" required>
                  <input
                    type="text"
                    value={form.legal_name}
                    onChange={(e) => updateField("legal_name", e.target.value)}
                    className={inputClassName}
                  />
                </Field>
              </div>
              <Field label="Short Name">
                <input
                  type="text"
                  value={form.short_name}
                  onChange={(e) => updateField("short_name", e.target.value)}
                  className={inputClassName}
                />
              </Field>
              <Field label="Counterparty Type" required>
                <select
                  value={form.counterparty_type}
                  onChange={(e) =>
                    updateField("counterparty_type", e.target.value)
                  }
                  className={inputClassName}
                >
                  <option value="">Select type</option>
                  {COUNTERPARTY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Linked Company">
                <select value={form.source_company_id ?? ""} onChange={(e) => handleCompanyChange(e.target.value)} className={inputClassName}>
                  <option value="">No linked company</option>
                  {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                </select>
              </Field>
              <Field label="Country">
                <input
                  type="text"
                  value={form.country}
                  onChange={(e) => updateField("country", e.target.value)}
                  className={inputClassName}
                />
              </Field>
              <Field label="City">
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => updateField("city", e.target.value)}
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
              <Field label="Tax ID">
                <input
                  type="text"
                  value={form.tax_id}
                  onChange={(e) => updateField("tax_id", e.target.value)}
                  className={inputClassName}
                />
              </Field>
              <Field label="Registration Number">
                <input
                  type="text"
                  value={form.registration_number}
                  onChange={(e) =>
                    updateField("registration_number", e.target.value)
                  }
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
              <Field label="Phone">
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className={inputClassName}
                />
              </Field>
              <Field label="Website">
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => updateField("website", e.target.value)}
                  placeholder="https://"
                  className={inputClassName}
                />
              </Field>
              <Field label="Authorized signer name">
                <input type="text" value={form.authorized_signer_name} onChange={(e) => updateField("authorized_signer_name", e.target.value)} className={inputClassName} />
              </Field>
              <Field label="Authorized signer title">
                <input type="text" value={form.authorized_signer_title} onChange={(e) => updateField("authorized_signer_title", e.target.value)} className={inputClassName} />
              </Field>
              <Field label="Bank account name">
                <input type="text" value={form.bank_account_name} onChange={(e) => updateField("bank_account_name", e.target.value)} className={inputClassName} />
              </Field>
              <Field label="Bank name">
                <input type="text" value={form.bank_name} onChange={(e) => updateField("bank_name", e.target.value)} className={inputClassName} />
              </Field>
              <Field label="Bank address">
                <input type="text" value={form.bank_address} onChange={(e) => updateField("bank_address", e.target.value)} className={inputClassName} />
              </Field>
              <Field label="Account number">
                <input type="text" value={form.account_number} onChange={(e) => updateField("account_number", e.target.value)} className={inputClassName} />
              </Field>
              <Field label="IBAN">
                <input type="text" value={form.iban} onChange={(e) => updateField("iban", e.target.value)} className={inputClassName} />
              </Field>
              <Field label="SWIFT">
                <input type="text" value={form.swift} onChange={(e) => updateField("swift", e.target.value)} className={inputClassName} />
              </Field>
              <Field label="Bank currency">
                <input type="text" value={form.bank_currency} onChange={(e) => updateField("bank_currency", e.target.value)} className={inputClassName} />
              </Field>
              <Field label="Active">
                <label className="flex h-[38px] cursor-pointer items-center gap-2.5 rounded-md border border-border bg-background px-3">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => updateField("is_active", e.target.checked)}
                    className="h-4 w-4 rounded border-border bg-background accent-foreground"
                  />
                  <span className="text-sm text-foreground">
                    {form.is_active ? "Active" : "Inactive"}
                  </span>
                </label>
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
