"use client";

import { AlertCircle, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  adjustInventory,
  issueInventory,
  receiveInventory,
  transferInventory,
} from "@/lib/warehouse/actions";
import type {
  WarehouseLocation,
  WarehouseProductOption,
} from "@/lib/warehouse/db";
import type { WarehouseOperationType } from "@/lib/warehouse/types";
import { useResetWhenOpened } from "@/lib/ui/open-state";

type WarehouseOperationModalProps = {
  open: boolean;
  operation: WarehouseOperationType;
  onClose: () => void;
  onSaved: (message: string) => void;
  warehouses: WarehouseLocation[];
  products: WarehouseProductOption[];
  defaultWarehouseId?: string;
  defaultProductId?: string;
  defaultLotNumber?: string;
};

type FormState = {
  warehouse_id: string;
  from_location: string;
  to_location: string;
  product_id: string;
  lot_number: string;
  quantity: string;
  production_date: string;
  expiry_date: string;
  transfer_date: string;
  reference: string;
  reason: string;
};

const inputClassName =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

const labelClassName = "mb-1.5 block text-xs font-medium text-muted-foreground";

const titles: Record<WarehouseOperationType, string> = {
  receive: "Receive Inventory",
  issue: "Issue Inventory",
  transfer: "Transfer Inventory",
  adjust: "Adjust Inventory",
};

const successMessages: Record<WarehouseOperationType, string> = {
  receive: "Inventory received successfully.",
  issue: "Inventory issued successfully.",
  transfer: "Inventory transferred successfully.",
  adjust: "Inventory adjusted successfully.",
};

function emptyForm(
  defaultWarehouseId?: string,
  defaultProductId?: string,
  defaultLotNumber?: string
): FormState {
  return {
    warehouse_id: defaultWarehouseId ?? "",
    from_location: defaultWarehouseId ?? "",
    to_location: "",
    product_id: defaultProductId ?? "",
    lot_number: defaultLotNumber ?? "",
    quantity: "",
    production_date: "",
    expiry_date: "",
    transfer_date: new Date().toISOString().slice(0, 10),
    reference: "",
    reason: "",
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

export function WarehouseOperationModal({
  open,
  operation,
  onClose,
  onSaved,
  warehouses,
  products,
  defaultWarehouseId,
  defaultProductId,
  defaultLotNumber,
}: WarehouseOperationModalProps) {
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(defaultWarehouseId, defaultProductId, defaultLotNumber)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeWarehouses = useMemo(
    () => warehouses.filter((item) => (item.status ?? "Active") === "Active"),
    [warehouses]
  );

  useResetWhenOpened(open, () => {
    setForm(emptyForm(defaultWarehouseId, defaultProductId, defaultLotNumber));
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
    const quantity = Number(form.quantity);

    if (!Number.isFinite(quantity)) {
      setError("Enter a valid quantity.");
      return;
    }

    setSaving(true);
    setError(null);

    let result;

    if (operation === "receive") {
      result = await receiveInventory({
        warehouse_id: form.warehouse_id,
        product_id: form.product_id,
        quantity,
        lot_number: form.lot_number,
        production_date: form.production_date || null,
        expiry_date: form.expiry_date || null,
        reference: form.reference || null,
        contract_id: null,
        shipment_id: null,
        business_case_id: null,
      });
    } else if (operation === "issue") {
      result = await issueInventory({
        warehouse_id: form.warehouse_id,
        product_id: form.product_id,
        quantity,
        lot_number: form.lot_number,
        reference: form.reference || null,
        contract_id: null,
        shipment_id: null,
        business_case_id: null,
      });
    } else if (operation === "transfer") {
      result = await transferInventory({
        from_location: form.from_location,
        to_location: form.to_location,
        product_id: form.product_id,
        quantity,
        lot_number: form.lot_number,
        transfer_date: form.transfer_date || null,
        reference: form.reference || null,
      });
    } else {
      result = await adjustInventory({
        warehouse_id: form.warehouse_id,
        product_id: form.product_id,
        quantity,
        lot_number: form.lot_number,
        reason: form.reason || null,
        production_date: form.production_date || null,
        expiry_date: form.expiry_date || null,
      });
    }

    setSaving(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    onSaved(successMessages[operation]);
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
        aria-labelledby="warehouse-operation-title"
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2
              id="warehouse-operation-title"
              className="text-base font-semibold text-foreground"
            >
              {titles[operation]}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Updates inventory balances and writes a stock movement
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
          <div className="space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
            {error ? (
              <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              {operation === "transfer" ? (
                <>
                  <Field label="From Warehouse" required>
                    <select
                      value={form.from_location}
                      onChange={(e) =>
                        updateField("from_location", e.target.value)
                      }
                      className={inputClassName}
                    >
                      <option value="">Select warehouse</option>
                      {activeWarehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.code} — {warehouse.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="To Warehouse" required>
                    <select
                      value={form.to_location}
                      onChange={(e) =>
                        updateField("to_location", e.target.value)
                      }
                      className={inputClassName}
                    >
                      <option value="">Select warehouse</option>
                      {activeWarehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.code} — {warehouse.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              ) : (
                <Field label="Warehouse" required>
                  <select
                    value={form.warehouse_id}
                    onChange={(e) =>
                      updateField("warehouse_id", e.target.value)
                    }
                    className={inputClassName}
                  >
                    <option value="">Select warehouse</option>
                    {activeWarehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.code} — {warehouse.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              <Field label="Product" required>
                <select
                  value={form.product_id}
                  onChange={(e) => updateField("product_id", e.target.value)}
                  className={inputClassName}
                >
                  <option value="">Select product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.sku} — {product.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Lot Number" required>
                <input
                  type="text"
                  value={form.lot_number}
                  onChange={(e) => updateField("lot_number", e.target.value)}
                  className={inputClassName}
                />
              </Field>

              <Field
                label={
                  operation === "adjust"
                    ? "Adjustment Qty (+/-)"
                    : "Quantity"
                }
                required
              >
                <input
                  type="number"
                  step="any"
                  value={form.quantity}
                  onChange={(e) => updateField("quantity", e.target.value)}
                  className={inputClassName}
                  placeholder={operation === "adjust" ? "e.g. -5 or 10" : "0"}
                />
              </Field>

              {operation === "receive" || operation === "adjust" ? (
                <>
                  <Field label="Production Date">
                    <input
                      type="date"
                      value={form.production_date}
                      onChange={(e) =>
                        updateField("production_date", e.target.value)
                      }
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="Expiry Date">
                    <input
                      type="date"
                      value={form.expiry_date}
                      onChange={(e) =>
                        updateField("expiry_date", e.target.value)
                      }
                      className={inputClassName}
                    />
                  </Field>
                </>
              ) : null}

              {operation === "transfer" ? (
                <Field label="Transfer Date">
                  <input
                    type="date"
                    value={form.transfer_date}
                    onChange={(e) =>
                      updateField("transfer_date", e.target.value)
                    }
                    className={inputClassName}
                  />
                </Field>
              ) : null}

              {operation === "adjust" ? (
                <Field label="Reason" className="sm:col-span-2">
                  <input
                    type="text"
                    value={form.reason}
                    onChange={(e) => updateField("reason", e.target.value)}
                    className={inputClassName}
                    placeholder="Cycle count, damage, write-off..."
                  />
                </Field>
              ) : (
                <Field
                  label="Reference"
                  className={
                    operation === "transfer" ||
                    operation === "receive" ||
                    operation === "issue"
                      ? "sm:col-span-2"
                      : undefined
                  }
                >
                  <input
                    type="text"
                    value={form.reference}
                    onChange={(e) => updateField("reference", e.target.value)}
                    className={inputClassName}
                    placeholder="PO, BL, packing list..."
                  />
                </Field>
              )}
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
