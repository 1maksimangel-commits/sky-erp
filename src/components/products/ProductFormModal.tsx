"use client";

import { AlertCircle, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createProduct } from "@/lib/products/actions";
import {
  applyProductPresetSuggestions,
  matchProductPreset,
  PRODUCT_CATEGORIES,
  PRODUCT_COUNTRIES,
  PRODUCT_SPECIES_PRESETS,
} from "@/lib/products/presets";
import {
  emptyProductForm,
  type ProductFormInput,
} from "@/lib/products/types";

type ProductFormModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

type FormState = {
  sku: string;
  code: string;
  name: string;
  scientific_name: string;
  category: string;
  species: string;
  country: string;
  origin: string;
  brand: string;
  size: string;
  glaze: string;
  package_type: string;
  net_weight: string;
  gross_weight: string;
  hs_code: string;
  purchase_price: string;
  sale_price: string;
  currency: string;
  description: string;
  is_active: boolean;
};

const inputClassName =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

const labelClassName = "mb-1.5 block text-xs font-medium text-muted-foreground";

function toFormState(values: ProductFormInput): FormState {
  return {
    sku: values.sku,
    code: values.code ?? "",
    name: values.name,
    scientific_name: values.scientific_name ?? "",
    category: values.category ?? "",
    species: values.species ?? "",
    country: values.country ?? "",
    origin: values.origin ?? "",
    brand: values.brand ?? "",
    size: values.size ?? "",
    glaze: values.glaze != null ? String(values.glaze) : "",
    package_type: values.package_type ?? "",
    net_weight: values.net_weight != null ? String(values.net_weight) : "",
    gross_weight: values.gross_weight != null ? String(values.gross_weight) : "",
    hs_code: values.hs_code ?? "",
    purchase_price:
      values.purchase_price != null ? String(values.purchase_price) : "",
    sale_price: values.sale_price != null ? String(values.sale_price) : "",
    currency: values.currency ?? "USD",
    description: values.description ?? "",
    is_active: values.is_active,
  };
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

function toProductInput(form: FormState): ProductFormInput {
  return {
    image_url: null,
    sku: form.sku.trim(),
    code: form.code.trim() || null,
    name: form.name.trim(),
    scientific_name: form.scientific_name.trim() || null,
    category: form.category.trim() || null,
    species: form.species.trim() || null,
    country: form.country.trim() || null,
    origin: form.origin.trim() || null,
    brand: form.brand.trim() || null,
    size: form.size.trim() || null,
    glaze: parseOptionalNumber(form.glaze),
    package_type: form.package_type.trim() || null,
    net_weight: parseOptionalNumber(form.net_weight),
    gross_weight: parseOptionalNumber(form.gross_weight),
    hs_code: form.hs_code.trim() || null,
    purchase_price: parseOptionalNumber(form.purchase_price),
    sale_price: parseOptionalNumber(form.sale_price),
    currency: form.currency.trim() || "USD",
    description: form.description.trim() || null,
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

/** Select that can still display legacy/custom stored values. */
function OptionalSelect({
  value,
  options,
  onChange,
  blankLabel = "Select…",
}: {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  blankLabel?: string;
}) {
  const known = new Set(options);
  const legacy =
    value && !known.has(value) ? (
      <option key={`legacy-${value}`} value={value}>
        {value}
      </option>
    ) : null;

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputClassName}
    >
      <option value="">{blankLabel}</option>
      {legacy}
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

export function ProductFormModal({
  open,
  onClose,
  onSaved,
}: ProductFormModalProps) {
  const [form, setForm] = useState<FormState>(() =>
    toFormState(emptyProductForm())
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(open);

  // Reset when the dialog opens (render-time adjust; avoids effect setState).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm(toFormState(emptyProductForm()));
      setError(null);
      setSaving(false);
    }
  }

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

  function handleSpeciesChange(value: string) {
    setForm((current) => {
      const next = { ...current, species: value };
      const preset = matchProductPreset(value);
      if (!preset) {
        return next;
      }
      return applyProductPresetSuggestions(next, preset);
    });
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!form.name.trim()) {
      setError("Product name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await createProduct(toProductInput(form));

      if (!result.success) {
        setError(result.error);
        return;
      }

      onSaved();
      onClose();
    } catch (error) {
      // createProduct is not expected to throw; keep a useful fallback.
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : "Could not save product. Please try again.";
      setError(message);
    } finally {
      setSaving(false);
    }
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
        aria-labelledby="product-form-title"
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2
              id="product-form-title"
              className="text-base font-semibold text-foreground"
            >
              New Product
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Add a product to the catalog
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
              <Field label="SKU">
                <input
                  type="text"
                  value={form.sku}
                  onChange={(e) => updateField("sku", e.target.value)}
                  className={inputClassName}
                />
              </Field>
              <Field label="Code">
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => updateField("code", e.target.value)}
                  className={inputClassName}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Product Name" required>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    className={inputClassName}
                    autoFocus
                  />
                </Field>
              </div>
              <Field label="Species">
                <input
                  type="text"
                  list="product-species-presets"
                  value={form.species}
                  onChange={(e) => handleSpeciesChange(e.target.value)}
                  placeholder="e.g. Pacific Cod"
                  className={inputClassName}
                />
                <datalist id="product-species-presets">
                  {PRODUCT_SPECIES_PRESETS.map((preset) => (
                    <option key={preset.species} value={preset.species} />
                  ))}
                </datalist>
              </Field>
              <Field label="Scientific Name">
                <input
                  type="text"
                  value={form.scientific_name}
                  onChange={(e) =>
                    updateField("scientific_name", e.target.value)
                  }
                  className={inputClassName}
                />
              </Field>
              <Field label="Category">
                <OptionalSelect
                  value={form.category}
                  options={PRODUCT_CATEGORIES}
                  onChange={(value) => updateField("category", value)}
                />
              </Field>
              <Field label="Country">
                <OptionalSelect
                  value={form.country}
                  options={PRODUCT_COUNTRIES}
                  onChange={(value) => updateField("country", value)}
                />
              </Field>
              <Field label="Origin">
                <input
                  type="text"
                  value={form.origin}
                  onChange={(e) => updateField("origin", e.target.value)}
                  className={inputClassName}
                />
              </Field>
              <Field label="Brand">
                <input
                  type="text"
                  value={form.brand}
                  onChange={(e) => updateField("brand", e.target.value)}
                  className={inputClassName}
                />
              </Field>
              <Field label="Size">
                <input
                  type="text"
                  value={form.size}
                  onChange={(e) => updateField("size", e.target.value)}
                  className={inputClassName}
                />
              </Field>
              <Field label="Glaze %">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.glaze}
                  onChange={(e) => updateField("glaze", e.target.value)}
                  placeholder="0"
                  className={inputClassName}
                />
              </Field>
              <Field label="Package Type">
                <input
                  type="text"
                  value={form.package_type}
                  onChange={(e) => updateField("package_type", e.target.value)}
                  className={inputClassName}
                />
              </Field>
              <Field label="Net Weight">
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.net_weight}
                  onChange={(e) => updateField("net_weight", e.target.value)}
                  className={inputClassName}
                />
              </Field>
              <Field label="Gross Weight">
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.gross_weight}
                  onChange={(e) => updateField("gross_weight", e.target.value)}
                  className={inputClassName}
                />
              </Field>
              <Field label="HS Code">
                <input
                  type="text"
                  value={form.hs_code}
                  onChange={(e) => updateField("hs_code", e.target.value)}
                  className={inputClassName}
                />
              </Field>
              <Field label="Purchase Price">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.purchase_price}
                  onChange={(e) =>
                    updateField("purchase_price", e.target.value)
                  }
                  className={inputClassName}
                />
              </Field>
              <Field label="Sale Price">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.sale_price}
                  onChange={(e) => updateField("sale_price", e.target.value)}
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

            <div className="mt-4">
              <Field label="Description">
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  className={`${inputClassName} resize-none`}
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
