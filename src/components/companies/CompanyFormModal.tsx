"use client";

import { AlertCircle, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createCompany, updateCompany, uploadCompanyApprovalMark } from "@/lib/companies/actions";
import {
  emptyCompanyForm,
  type CompanyFormInput,
} from "@/lib/companies/types";
import { useResetWhenOpened } from "@/lib/ui/open-state";

type CompanyFormModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existingId?: string | null;
  initialValues?: CompanyFormInput | null;
};

type FormState = {
  business_role: "Seller" | "Buyer" | "Agent" | "Other" | null;
  code: string;
  name: string;
  short_name: string;
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

function toFormState(values: CompanyFormInput): FormState {
  return {
    business_role: values.business_role ?? null,
    code: values.code,
    name: values.name,
    short_name: values.short_name ?? "",
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
    bank_currency: values.bank_currency || "USD",
    is_active: values.is_active,
  };
}

function toFormInput(form: FormState): CompanyFormInput {
  return {
    business_role: form.business_role,
    code: form.code.trim(),
    name: form.name.trim(),
    short_name: form.short_name.trim() || null,
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

export function CompanyFormModal({
  open,
  onClose,
  onSaved,
  existingId = null,
  initialValues = null,
}: CompanyFormModalProps) {
  const [form, setForm] = useState<FormState>(() =>
    toFormState(emptyCompanyForm())
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sealRef = useRef<HTMLInputElement>(null);
  const signatureRef = useRef<HTMLInputElement>(null);

  useResetWhenOpened(open, () => {
    setForm(toFormState(initialValues ?? emptyCompanyForm()));
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

    if (!form.code.trim()) {
      setError("Code is required.");
      return;
    }

    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const input = toFormInput(form);
    const result = existingId
      ? await updateCompany(existingId, input)
      : await createCompany(input);

    setSaving(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    const companyId = result.id;
    if (companyId) {
      for (const [kind, ref] of [["seal", sealRef], ["signature", signatureRef]] as const) {
        const file = ref.current?.files?.[0];
        if (!file) continue;
        const markForm = new FormData();
        markForm.set("file", file);
        const markResult = await uploadCompanyApprovalMark({ companyId, kind, formData: markForm });
        if (!markResult.success) {
          setSaving(false);
          setError(markResult.error);
          return;
        }
      }
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
        aria-labelledby="company-form-title"
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2
              id="company-form-title"
              className="text-base font-semibold text-foreground"
            >
              {existingId ? "Edit Company" : "New Company"}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {existingId ? "Update legal entity details" : "Add a legal entity or subsidiary"}
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
              <Field label="Code" required>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => updateField("code", e.target.value)}
                  className={inputClassName}
                  autoFocus
                />
              </Field>
              <Field label="Name" required>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className={inputClassName}
                />
              </Field>
              <Field label="Business role">
                <select
                  value={form.business_role ?? ""}
                  onChange={(e) => updateField("business_role", (e.target.value || null) as FormState["business_role"])}
                  className={inputClassName}
                >
                  <option value="">Not specified</option>
                  <option value="Seller">Seller</option>
                  <option value="Buyer">Buyer</option>
                  <option value="Agent">Agent</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
              <Field label="Short Name">
                <input
                  type="text"
                  value={form.short_name}
                  onChange={(e) => updateField("short_name", e.target.value)}
                  className={inputClassName}
                />
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
                <Field label="Registered address">
                  <textarea
                    value={form.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    className={`${inputClassName} min-h-20 resize-y`}
                    placeholder="Full legal address"
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
              <div className="sm:col-span-2 border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground">Bank details</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Primary account used in generated contracts and commercial invoices.
                </p>
              </div>
              <Field label="Account label">
                <input value={form.bank_account_name} onChange={(e) => updateField("bank_account_name", e.target.value)} className={inputClassName} placeholder="USD operating account" />
              </Field>
              <Field label="Bank name">
                <input value={form.bank_name} onChange={(e) => updateField("bank_name", e.target.value)} className={inputClassName} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Bank address">
                  <textarea
                    value={form.bank_address}
                    onChange={(e) => updateField("bank_address", e.target.value)}
                    className={`${inputClassName} min-h-20 resize-y`}
                    placeholder="Full bank address"
                  />
                </Field>
              </div>
              <Field label="Account number">
                <input value={form.account_number} onChange={(e) => updateField("account_number", e.target.value)} className={inputClassName} />
              </Field>
              <Field label="IBAN">
                <input value={form.iban} onChange={(e) => updateField("iban", e.target.value)} className={inputClassName} />
              </Field>
              <Field label="SWIFT / BIC">
                <input value={form.swift} onChange={(e) => updateField("swift", e.target.value)} className={inputClassName} />
              </Field>
              <Field label="Account currency">
                <input value={form.bank_currency} onChange={(e) => updateField("bank_currency", e.target.value)} className={inputClassName} maxLength={3} />
              </Field>
              <div className="sm:col-span-2 border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground">Authorized signatory</p>
              </div>
              <Field label="Full name">
                <input value={form.authorized_signer_name} onChange={(e) => updateField("authorized_signer_name", e.target.value)} className={inputClassName} placeholder="Surname First name" />
              </Field>
              <Field label="Position / title">
                <input value={form.authorized_signer_title} onChange={(e) => updateField("authorized_signer_title", e.target.value)} className={inputClassName} placeholder="Director" />
              </Field>
              <div className="sm:col-span-2 border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground">Approval marks</p>
                <p className="mt-1 text-xs text-muted-foreground">PNG or JPEG, up to 5 MB. Stored in this company&apos;s Documents.</p>
              </div>
              <Field label="Company seal image">
                <input ref={sealRef} type="file" accept="image/png,image/jpeg" className="block w-full text-xs" />
              </Field>
              <Field label="Authorized signature image">
                <input ref={signatureRef} type="file" accept="image/png,image/jpeg" className="block w-full text-xs" />
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
