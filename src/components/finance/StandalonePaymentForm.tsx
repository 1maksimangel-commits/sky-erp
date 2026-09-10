"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FinanceOptionBundles } from "@/lib/finance/db";
import { registerStandalonePayment } from "@/lib/finance/operational-actions";

export function StandalonePaymentForm({ options }: { options: FinanceOptionBundles }) {
  const router = useRouter(), [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const input = "rounded-md border border-border bg-background p-2 text-sm";
  const entities = <><option value="">Select legal entity</option><optgroup label="Internal companies">{options.companies.map(c => <option key={c.id} value={`company:${c.id}`}>{c.name}</option>)}</optgroup><optgroup label="External counterparties">{options.counterparties.map(c => <option key={c.id} value={`counterparty:${c.id}`}>{c.legal_name}</option>)}</optgroup></>;
  return <details className="rounded-lg border border-border p-4"><summary className="cursor-pointer text-sm">Record a payment before allocating it to invoices</summary>
    <form className="mt-4 grid gap-3 sm:grid-cols-2" action={async form => {
      setSaving(true); setError("");
      const get = (key: string) => String(form.get(key) ?? ""), [payerType,payer] = get("payer").split(":"), [payeeType,payee] = get("payee").split(":");
      const result = await registerStandalonePayment({ company_id: get("company"), contract_id: get("contract") || null, business_case_id: get("deal") || null,
        payer_company_id: payerType === "company" ? payer : null, payer_counterparty_id: payerType === "counterparty" ? payer : null,
        payee_company_id: payeeType === "company" ? payee : null, payee_counterparty_id: payeeType === "counterparty" ? payee : null,
        amount: Number(get("amount")), currency: get("currency"), payment_date: get("date"), bank_account_id: get("bank") || null, reference: get("reference"), status: get("status") === "Paid" ? "Paid" : "Pending",
      });
      setSaving(false);
      if (!result.success) setError(result.error); else router.push(`/finance/payments/${result.id}`);
    }}>
      <label>Internal company<select name="company" required className={`w-full ${input}`}><option value="">Select company</option>{options.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Contract<select name="contract" className={`w-full ${input}`}><option value="">No Contract</option>{options.contracts.map(c => <option key={c.id} value={c.id}>{c.contract_number}</option>)}</select></label>
      <label>Deal<select name="deal" className={`w-full ${input}`}><option value="">No Deal</option>{options.businessCases.map(d => <option key={d.id} value={d.id}>{d.case_number}</option>)}</select></label>
      <label>Bank<select name="bank" className={`w-full ${input}`}><option value="">No bank account</option>{options.bankAccounts.filter(b => !b.counterparty_id && b.is_active).map(b => <option key={b.id} value={b.id}>{b.name} ({b.currency})</option>)}</select></label>
      <label>Payer<select required name="payer" className={`w-full ${input}`}>{entities}</select></label>
      <label>Payee<select required name="payee" className={`w-full ${input}`}>{entities}</select></label>
      <label>Original amount<input required name="amount" type="number" step="0.01" min="0.01" className={`w-full ${input}`} /></label>
      <label>Original currency<select name="currency" className={`w-full ${input}`} defaultValue="USD">{options.currencies.map(c => <option key={c}>{c}</option>)}</select></label>
      <label>Date<input required type="date" name="date" defaultValue={new Date().toISOString().slice(0,10)} className={`w-full ${input}`} /></label>
      <label>Reference<input name="reference" className={`w-full ${input}`} /></label>
      <label>Status<select name="status" className={`w-full ${input}`}><option>Pending</option><option>Paid</option></select></label>
      <button disabled={saving} className="rounded-md bg-primary px-3 py-2 text-primary-foreground">{saving ? "Saving…" : "Record payment"}</button>
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </form>
  </details>;
}
