"use client";

import { AlertCircle, Check, Loader2, Pencil, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Toast } from "@/components/ui/Toast";
import { updateContract } from "@/lib/contracts/actions";
import type { Contract } from "@/lib/contracts/db";
import {
  CONTRACT_STATUSES,
  contractToFormInput,
  type ContractFormInput,
} from "@/lib/contracts/form-types";
import {
  formatContractAmount,
  formatContractDate,
} from "@/lib/contracts/format";
import { validateContractFormInput } from "@/lib/contracts/validation";
import type { Company } from "@/lib/companies";
import type { Counterparty } from "@/lib/counterparties";

type ContractOverviewEditorProps = {
  contract: Contract;
  companies: Company[];
  counterparties: Counterparty[];
};

type FormState = {
  contract_number: string;
  title: string;
  company_id: string;
  buyer_id: string;
  supplier_id: string;
  consignee_id: string;
  business_case_id: string;
  deal_id: string;
  business_role: string;
  currency: string;
  amount: string;
  incoterms: string;
  contract_date: string;
  expiry_date: string;
  status: string;
};

const inputClassName =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

function toFormState(contract: Contract): FormState {
  const input = contractToFormInput(contract);

  return {
    contract_number: input.contract_number,
    title: input.title ?? "",
    company_id: input.company_id ?? "",
    buyer_id: input.buyer_id ?? "",
    supplier_id: input.supplier_id ?? "",
    consignee_id: input.consignee_id ?? "",
    business_case_id: input.business_case_id ?? "",
    deal_id: input.deal_id ?? "",
    business_role: input.business_role ?? "",
    currency: input.currency ?? "USD",
    amount: input.amount != null ? String(input.amount) : "",
    incoterms: input.incoterms ?? "",
    contract_date: input.contract_date ?? "",
    expiry_date: input.expiry_date ?? "",
    status: input.status,
  };
}

function toFormInput(form: FormState): ContractFormInput {
  const amount = form.amount.trim();
  const parsedAmount = amount ? Number(amount) : null;

  return {
    contract_number: form.contract_number.trim(),
    title: form.title.trim() || null,
    company_id: form.company_id,
    buyer_id: form.buyer_id,
    supplier_id: form.supplier_id,
    consignee_id: form.consignee_id,
    business_case_id: form.business_case_id.trim() || null,
    deal_id: form.deal_id.trim() || null,
    business_role: form.business_role.trim() || null,
    currency: form.currency.trim() || "USD",
    amount:
      parsedAmount != null && Number.isFinite(parsedAmount) ? parsedAmount : null,
    incoterms: form.incoterms.trim() || null,
    contract_date: form.contract_date || null,
    expiry_date: form.expiry_date || null,
    status: form.status.trim(),
  };
}

function StatusBadge({ status }: { status: string | null }) {
  const label = status ?? "Draft";

  const className =
    label === "Draft"
      ? "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20"
      : label === "Closed"
        ? "bg-blue-500/10 text-blue-400 ring-blue-500/20"
        : label === "Cancelled"
          ? "bg-red-500/10 text-red-400 ring-red-500/20"
          : "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {label}
    </span>
  );
}

function Field({
  label,
  editing,
  children,
  value,
}: {
  label: string;
  editing: boolean;
  children?: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-accent/10 px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm text-foreground">
        {editing ? children : value}
      </div>
    </div>
  );
}

export function ContractOverviewEditor({
  contract,
  companies,
  counterparties,
}: ContractOverviewEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(() => toFormState(contract));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function startEditing() {
    setForm(toFormState(contract));
    setError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setForm(toFormState(contract));
    setError(null);
    setEditing(false);
  }

  async function handleSave() {
    const input = toFormInput(form);
    const validationError = validateContractFormInput(input);

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    const result = await updateContract(contract.id, input);
    setSaving(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setEditing(false);
    setToast("Contract updated successfully.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">Overview</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Contract header and commercial summary
          </p>
        </div>
        {editing ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={cancelEditing}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Save
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        )}
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Field
          label="Contract Number"
          editing={editing}
          value={contract.contract_number}
        >
          <input
            type="text"
            value={form.contract_number}
            onChange={(e) =>
              setForm((current) => ({
                ...current,
                contract_number: e.target.value,
              }))
            }
            className={inputClassName}
          />
        </Field>

        <Field label="Title" editing={editing} value={contract.title ?? "—"}>
          <input
            type="text"
            value={form.title}
            onChange={(e) =>
              setForm((current) => ({ ...current, title: e.target.value }))
            }
            className={inputClassName}
          />
        </Field>

        <Field
          label="Seller"
          editing={editing}
          value={
            contract.company?.id ? (
              <Link
                href={`/companies/${contract.company.id}`}
                className="text-foreground underline-offset-4 hover:underline"
              >
                {contract.company.name}
              </Link>
            ) : (
              "—"
            )
          }
        >
          <select
            value={form.company_id}
            onChange={(e) =>
              setForm((current) => ({ ...current, company_id: e.target.value }))
            }
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

        <Field
          label="Buyer"
          editing={editing}
          value={
            contract.buyer?.id ? (
              <Link
                href={`/counterparties/${contract.buyer.id}`}
                className="text-foreground underline-offset-4 hover:underline"
              >
                {contract.buyer.legal_name}
              </Link>
            ) : (
              "—"
            )
          }
        >
          <select
            value={form.buyer_id}
            onChange={(e) =>
              setForm((current) => ({ ...current, buyer_id: e.target.value }))
            }
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

        <Field
          label="Consignee / грузополучатель"
          editing={editing}
          value={
            contract.consignee?.id ? (
              <Link
                href={`/counterparties/${contract.consignee.id}`}
                className="text-foreground underline-offset-4 hover:underline"
              >
                {contract.consignee.legal_name}
              </Link>
            ) : (
              "—"
            )
          }
        >
          <select
            value={form.consignee_id}
            onChange={(e) =>
              setForm((current) => ({
                ...current,
                consignee_id: e.target.value,
              }))
            }
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

        <Field
          label="Currency"
          editing={editing}
          value={contract.currency ?? "—"}
        >
          <select
            value={form.currency}
            onChange={(e) =>
              setForm((current) => ({ ...current, currency: e.target.value }))
            }
            className={inputClassName}
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="CNY">CNY</option>
            <option value="JPY">JPY</option>
          </select>
        </Field>

        <Field label="Business role" editing={editing} value={contract.business_role ?? "—"}>
          <select value={form.business_role} onChange={(e) => setForm((current) => ({ ...current, business_role: e.target.value }))} className={inputClassName}>
            <option value="">Not specified</option>
            {(["Purchase", "Sale", "Commission", "Logistics", "Other"] as const).map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </Field>

        <Field label="Deal link (optional)" editing={editing} value={contract.deal_id ? <Link href={`/business-cases/${contract.deal_id}`} className="underline-offset-4 hover:underline">{contract.deal_id}</Link> : "Unlinked"}>
          <input type="text" placeholder="Deal ID" value={form.deal_id} onChange={(e) => setForm((current) => ({ ...current, deal_id: e.target.value }))} className={inputClassName} />
          <p className="mt-1 text-xs text-muted-foreground">Paste an existing Deal ID, or leave empty.</p>
        </Field>

        <Field
          label="Amount"
          editing={editing}
          value={formatContractAmount(contract.amount, contract.currency)}
        >
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(e) =>
              setForm((current) => ({ ...current, amount: e.target.value }))
            }
            className={inputClassName}
          />
        </Field>

        <Field
          label="Incoterms"
          editing={editing}
          value={contract.incoterms ?? "—"}
        >
          <input
            type="text"
            value={form.incoterms}
            onChange={(e) =>
              setForm((current) => ({ ...current, incoterms: e.target.value }))
            }
            className={inputClassName}
          />
        </Field>

        <Field
          label="Contract Date"
          editing={editing}
          value={formatContractDate(contract.contract_date)}
        >
          <input
            type="date"
            value={form.contract_date}
            onChange={(e) =>
              setForm((current) => ({
                ...current,
                contract_date: e.target.value,
              }))
            }
            className={inputClassName}
          />
        </Field>

        <Field
          label="Expiry Date"
          editing={editing}
          value={formatContractDate(contract.expiry_date)}
        >
          <input
            type="date"
            value={form.expiry_date}
            onChange={(e) =>
              setForm((current) => ({
                ...current,
                expiry_date: e.target.value,
              }))
            }
            className={inputClassName}
          />
        </Field>

        <Field
          label="Status"
          editing={editing}
          value={<StatusBadge status={contract.status} />}
        >
          <select
            value={form.status}
            onChange={(e) =>
              setForm((current) => ({ ...current, status: e.target.value }))
            }
            className={inputClassName}
          >
            {CONTRACT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {toast ? (
        <Toast message={toast} onClose={() => setToast(null)} />
      ) : null}
    </div>
  );
}
