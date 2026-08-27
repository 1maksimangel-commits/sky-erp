"use client";

import { AlertCircle, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createShipment, updateShipment } from "@/lib/logistics/actions";
import type {
  BusinessCaseOption,
  ContractOption,
  Shipment,
} from "@/lib/logistics/db";
import {
  SHIPMENT_STATUSES,
  emptyShipmentForm,
  shipmentToFormInput,
  type ShipmentFormInput,
} from "@/lib/logistics/types";
import { validateShipmentFormInput } from "@/lib/logistics/validation";
import { useResetWhenOpened } from "@/lib/ui/open-state";

type ShipmentFormModalProps = {
  open: boolean;
  shipment?: Shipment | null;
  defaultContractId?: string;
  onClose: () => void;
  onSaved: () => void;
  contracts: ContractOption[];
  businessCases: BusinessCaseOption[];
};

type FormState = {
  contract_id: string;
  business_case_id: string;
  company_id: string;
  container: string;
  container_type: string;
  seal_number: string;
  bl_number: string;
  vessel: string;
  voyage: string;
  shipping_line: string;
  booking_number: string;
  tracking_number: string;
  freight_forwarder: string;
  port_of_loading: string;
  port_of_destination: string;
  consignee: string;
  notify_party: string;
  etd: string;
  eta: string;
  etd_actual: string;
  eta_actual: string;
  atd: string;
  ata: string;
  status: string;
  remarks: string;
};

const inputClassName =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

const labelClassName = "mb-1.5 block text-xs font-medium text-muted-foreground";

function toFormState(
  values: ShipmentFormInput,
  defaultContractId?: string
): FormState {
  return {
    contract_id: values.contract_id || defaultContractId || "",
    business_case_id: values.business_case_id ?? "",
    company_id: values.company_id ?? "",
    container: values.container ?? "",
    container_type: values.container_type ?? "",
    seal_number: values.seal_number ?? "",
    bl_number: values.bl_number ?? "",
    vessel: values.vessel ?? "",
    voyage: values.voyage ?? "",
    shipping_line: values.shipping_line ?? "",
    booking_number: values.booking_number ?? "",
    tracking_number: values.tracking_number ?? "",
    freight_forwarder: values.freight_forwarder ?? "",
    port_of_loading: values.port_of_loading ?? "",
    port_of_destination: values.port_of_destination ?? "",
    consignee: values.consignee ?? "",
    notify_party: values.notify_party ?? "",
    etd: values.etd ?? "",
    eta: values.eta ?? "",
    etd_actual: values.etd_actual ?? "",
    eta_actual: values.eta_actual ?? "",
    atd: values.atd ?? "",
    ata: values.ata ?? "",
    status: values.status,
    remarks: values.remarks ?? "",
  };
}

function toFormInput(form: FormState): ShipmentFormInput {
  return {
    contract_id: form.contract_id,
    business_case_id: form.business_case_id || null,
    company_id: form.company_id || null,
    container: form.container.trim() || null,
    container_type: form.container_type.trim() || null,
    seal_number: form.seal_number.trim() || null,
    bl_number: form.bl_number.trim() || null,
    vessel: form.vessel.trim() || null,
    voyage: form.voyage.trim() || null,
    shipping_line: form.shipping_line.trim() || null,
    booking_number: form.booking_number.trim() || null,
    tracking_number: form.tracking_number.trim() || null,
    freight_forwarder: form.freight_forwarder.trim() || null,
    port_of_loading: form.port_of_loading.trim() || null,
    port_of_destination: form.port_of_destination.trim() || null,
    consignee: form.consignee.trim() || null,
    notify_party: form.notify_party.trim() || null,
    etd: form.etd || null,
    eta: form.eta || null,
    etd_actual: form.etd_actual || null,
    eta_actual: form.eta_actual || null,
    atd: form.atd || null,
    ata: form.ata || null,
    status: form.status.trim(),
    remarks: form.remarks.trim() || null,
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

export function ShipmentFormModal({
  open,
  shipment,
  defaultContractId,
  onClose,
  onSaved,
  contracts,
  businessCases,
}: ShipmentFormModalProps) {
  const isEditing = Boolean(shipment);
  const [form, setForm] = useState<FormState>(() =>
    toFormState(emptyShipmentForm(), defaultContractId)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredBusinessCases = useMemo(() => {
    if (!form.contract_id) {
      return businessCases;
    }

    const contract = contracts.find((item) => item.id === form.contract_id);
    if (!contract) {
      return businessCases;
    }

    return businessCases.filter(
      (item) =>
        !item.contract_number ||
        item.contract_number === contract.contract_number
    );
  }, [businessCases, contracts, form.contract_id]);

  useResetWhenOpened(open, () => {
    const base = toFormState(
      shipment ? shipmentToFormInput(shipment) : emptyShipmentForm(),
      defaultContractId
    );
    const contract = contracts.find(
      (item) => item.id === (base.contract_id || defaultContractId)
    );
    setForm({
      ...base,
      company_id: base.company_id || contract?.company_id || "",
      business_case_id:
        base.business_case_id || contract?.business_case_id || "",
    });
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

    const input = toFormInput(form);
    const validationError = validateShipmentFormInput(input);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    const result = shipment
      ? await updateShipment(shipment.id, input, shipment.status)
      : await createShipment(input);

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
        aria-labelledby="shipment-form-title"
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2
              id="shipment-form-title"
              className="text-base font-semibold text-foreground"
            >
              {isEditing ? "Edit Shipment" : "New Shipment"}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isEditing
                ? "Update shipment routing and tracking details"
                : "Create a shipment linked to a contract"}
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
            {(() => {
              const selectedContract = contracts.find(
                (item) => item.id === form.contract_id
              );
              const missingCompany = Boolean(
                form.contract_id && !selectedContract?.company_id
              );
              const missingBusinessCase = Boolean(
                form.contract_id && !selectedContract?.business_case_id
              );
              if (!missingCompany && !missingBusinessCase) return null;
              return (
                <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <div className="space-y-1 text-sm text-amber-100">
                    <p>
                      Selected contract is missing ownership required for
                      shipment create.
                    </p>
                    {missingCompany ? (
                      <p>Set company on the contract overview first.</p>
                    ) : null}
                    {missingBusinessCase ? (
                      <p>
                        Link a business case on the contract Business Case tab
                        first.
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })()}
            {error ? (
              <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contract" required>
                <select
                  value={form.contract_id}
                  onChange={(e) => {
                    const contractId = e.target.value;
                    const contract = contracts.find((item) => item.id === contractId);
                    setForm((current) => ({
                      ...current,
                      contract_id: contractId,
                      business_case_id: contract?.business_case_id ?? "",
                      company_id: contract?.company_id ?? "",
                    }));
                    setError(null);
                  }}
                  className={inputClassName}
                  disabled={Boolean(defaultContractId) && !isEditing}
                >
                  <option value="">Select contract</option>
                  {contracts.map((contract) => (
                    <option key={contract.id} value={contract.id}>
                      {contract.contract_number}
                      {contract.title ? ` — ${contract.title}` : ""}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Business Case" required>
                <select
                  value={form.business_case_id}
                  onChange={(e) =>
                    updateField("business_case_id", e.target.value)
                  }
                  className={inputClassName}
                >
                  <option value="">Select business case</option>
                  {filteredBusinessCases.map((businessCase) => (
                    <option key={businessCase.id} value={businessCase.id}>
                      {businessCase.case_number}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Container Number">
                <input
                  type="text"
                  value={form.container}
                  onChange={(e) => updateField("container", e.target.value)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Bill of Lading">
                <input
                  type="text"
                  value={form.bl_number}
                  onChange={(e) => updateField("bl_number", e.target.value)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Container Type">
                <input
                  type="text"
                  value={form.container_type}
                  onChange={(e) =>
                    updateField("container_type", e.target.value)
                  }
                  placeholder="e.g. 40RF"
                  className={inputClassName}
                />
              </Field>

              <Field label="Seal Number">
                <input
                  type="text"
                  value={form.seal_number}
                  onChange={(e) => updateField("seal_number", e.target.value)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Status" required>
                <select
                  value={form.status}
                  onChange={(e) => updateField("status", e.target.value)}
                  className={inputClassName}
                >
                  {SHIPMENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Vessel">
                <input
                  type="text"
                  value={form.vessel}
                  onChange={(e) => updateField("vessel", e.target.value)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Voyage">
                <input
                  type="text"
                  value={form.voyage}
                  onChange={(e) => updateField("voyage", e.target.value)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Shipping Line">
                <input
                  type="text"
                  value={form.shipping_line}
                  onChange={(e) =>
                    updateField("shipping_line", e.target.value)
                  }
                  className={inputClassName}
                />
              </Field>

              <Field label="Freight Forwarder">
                <input
                  type="text"
                  value={form.freight_forwarder}
                  onChange={(e) =>
                    updateField("freight_forwarder", e.target.value)
                  }
                  className={inputClassName}
                />
              </Field>

              <Field label="Booking Number">
                <input
                  type="text"
                  value={form.booking_number}
                  onChange={(e) =>
                    updateField("booking_number", e.target.value)
                  }
                  className={inputClassName}
                />
              </Field>

              <Field label="Tracking Number">
                <input
                  type="text"
                  value={form.tracking_number}
                  onChange={(e) =>
                    updateField("tracking_number", e.target.value)
                  }
                  className={inputClassName}
                />
              </Field>

              <Field label="Port of Loading">
                <input
                  type="text"
                  value={form.port_of_loading}
                  onChange={(e) =>
                    updateField("port_of_loading", e.target.value)
                  }
                  className={inputClassName}
                />
              </Field>

              <Field label="Port of Destination">
                <input
                  type="text"
                  value={form.port_of_destination}
                  onChange={(e) =>
                    updateField("port_of_destination", e.target.value)
                  }
                  className={inputClassName}
                />
              </Field>

              <Field label="Consignee">
                <input
                  type="text"
                  value={form.consignee}
                  onChange={(e) => updateField("consignee", e.target.value)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Notify Party">
                <input
                  type="text"
                  value={form.notify_party}
                  onChange={(e) => updateField("notify_party", e.target.value)}
                  className={inputClassName}
                />
              </Field>

              <Field label="ETD">
                <input
                  type="date"
                  value={form.etd}
                  onChange={(e) => updateField("etd", e.target.value)}
                  className={inputClassName}
                />
              </Field>

              <Field label="ETA">
                <input
                  type="date"
                  value={form.eta}
                  onChange={(e) => updateField("eta", e.target.value)}
                  className={inputClassName}
                />
              </Field>

              <Field label="ETD Actual">
                <input
                  type="date"
                  value={form.etd_actual}
                  onChange={(e) => updateField("etd_actual", e.target.value)}
                  className={inputClassName}
                />
              </Field>

              <Field label="ETA Actual">
                <input
                  type="date"
                  value={form.eta_actual}
                  onChange={(e) => updateField("eta_actual", e.target.value)}
                  className={inputClassName}
                />
              </Field>

              <Field label="ATD">
                <input
                  type="date"
                  value={form.atd}
                  onChange={(e) => updateField("atd", e.target.value)}
                  className={inputClassName}
                />
              </Field>

              <Field label="ATA">
                <input
                  type="date"
                  value={form.ata}
                  onChange={(e) => updateField("ata", e.target.value)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Remarks" className="sm:col-span-2">
                <textarea
                  value={form.remarks}
                  onChange={(e) => updateField("remarks", e.target.value)}
                  rows={3}
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
