"use client";

import { AlertCircle, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Toast } from "@/components/ui/Toast";
import { createBankAccount } from "@/lib/finance/actions";
import type { BankAccount, FinanceOptionBundles } from "@/lib/finance/db";
import { formatMoney } from "@/lib/finance/format";
import { FINANCE_CURRENCIES, emptyBankAccountForm } from "@/lib/finance/types";

type BankAccountsViewProps = {
  accounts: BankAccount[] | null;
  options: FinanceOptionBundles;
  error: string | null;
};

export function BankAccountsView({
  accounts,
  options,
  error,
}: BankAccountsViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    company_id: "",
    name: "",
    bank_name: "",
    bank_address: "",
    account_number: "",
    iban: "",
    swift: "",
    currency: "USD",
    opening_balance: "0",
  });

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    const result = await createBankAccount({
      ...emptyBankAccountForm(),
      company_id: form.company_id,
      name: form.name,
      bank_name: form.bank_name || null,
      bank_address: form.bank_address || null,
      account_number: form.account_number || null,
      iban: form.iban || null,
      swift: form.swift || null,
      currency: form.currency,
      opening_balance: Number(form.opening_balance) || 0,
      is_active: true,
    });

    setSaving(false);

    if (!result.success) {
      setFormError(result.error);
      return;
    }

    setOpen(false);
    setToast("Bank account created successfully.");
    startTransition(() => router.refresh());
  }

  return (
    <div className={`space-y-4 ${isPending ? "opacity-70" : ""}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Multi-company operating accounts (ALTAY FISH, ORDA FZCO, MAREX CARGO, …)
        </p>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-3.5 py-2 text-xs font-medium text-background"
        >
          <Plus className="h-3.5 w-3.5" />
          New Account
        </button>
      </div>

      {toast ? <Toast message={toast} onClose={() => setToast(null)} /> : null}

      {open ? (
        <form
          onSubmit={handleCreate}
          className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {formError ? (
            <p className="text-sm text-red-300 sm:col-span-2 xl:col-span-4">
              {formError}
            </p>
          ) : null}
          <select
            required
            value={form.company_id}
            onChange={(e) => setForm((c) => ({ ...c, company_id: e.target.value }))}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Company *</option>
            {options.companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
          <input
            required
            placeholder="Account name *"
            value={form.name}
            onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            placeholder="Bank name"
            value={form.bank_name}
            onChange={(e) => setForm((c) => ({ ...c, bank_name: e.target.value }))}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <select
            value={form.currency}
            onChange={(e) => setForm((c) => ({ ...c, currency: e.target.value }))}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {(options.currencies.length
              ? options.currencies
              : [...FINANCE_CURRENCIES]
            ).map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          <input
            placeholder="Account number"
            value={form.account_number}
            onChange={(e) =>
              setForm((c) => ({ ...c, account_number: e.target.value }))
            }
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            placeholder="Bank address"
            value={form.bank_address}
            onChange={(e) => setForm((c) => ({ ...c, bank_address: e.target.value }))}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            placeholder="IBAN"
            value={form.iban}
            onChange={(e) => setForm((c) => ({ ...c, iban: e.target.value }))}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            placeholder="SWIFT"
            value={form.swift}
            onChange={(e) => setForm((c) => ({ ...c, swift: e.target.value }))}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="any"
            placeholder="Opening balance"
            value={form.opening_balance}
            onChange={(e) =>
              setForm((c) => ({ ...c, opening_balance: e.target.value }))
            }
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background disabled:opacity-50 sm:col-span-2 xl:col-span-4"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save Account
          </button>
        </form>
      ) : null}

      {!accounts?.length ? (
        <div className="rounded-lg border border-card-border bg-card p-12 text-center text-sm text-muted-foreground">
          No bank accounts yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-card-border bg-card">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-accent/30">
                {["Company", "Account", "Bank", "Bank address", "Currency", "Balance", "Status"].map(
                  (label) => (
                    <th
                      key={label}
                      className="px-4 py-3 text-xs font-medium text-muted-foreground"
                    >
                      {label}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {accounts.map((account) => (
                <tr key={account.id} className="hover:bg-accent/20">
                  <td className="px-4 py-3">{account.company?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{account.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {account.account_number || account.iban || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3">{account.bank_name ?? "—"}</td>
                  <td className="max-w-xs whitespace-normal px-4 py-3 text-muted-foreground">
                    {account.bank_address ?? "—"}
                  </td>
                  <td className="px-4 py-3">{account.currency}</td>
                  <td className="px-4 py-3">
                    {formatMoney(account.current_balance, account.currency)}
                  </td>
                  <td className="px-4 py-3">
                    {account.is_active ? "Active" : "Inactive"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
