"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FinanceOptionBundles } from "@/lib/finance/db";
import { saveCommission, saveExpense } from "@/lib/finance/operational-actions";

export type OperationalFinanceRow = {
  id: string; company_id: string | null; business_case_id: string | null;
  contract_id: string | null; currency: string | null; status: string;
  description?: string | null; label?: string | null; amount?: number;
  expected_amount?: number; basis?: string | null; rate?: number | null;
  base_quantity?: number | null; base_amount?: number | null;
  supplier_id?: string | null; beneficiary_id?: string | null;
  category_id?: string | null; shipment_id?: string | null; expense_date?: string;
};

export function OperationalRecordsView({ kind, rows, options, categories, recordId }: {
  kind: "expenses" | "commissions"; rows: OperationalFinanceRow[];
  options: FinanceOptionBundles; categories: { id: string; name: string }[];
  recordId?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<OperationalFinanceRow | null>(rows.find(r => r.id === recordId) ?? null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [company, setCompany] = useState(selected?.company_id ?? "");
  const [contract, setContract] = useState(selected?.contract_id ?? "");
  const expense = kind === "expenses";
  const input = "w-full rounded-md border border-border bg-background p-2 text-sm";
  async function save(form: FormData) {
    setBusy(true); setError("");
    const text = (key: string) => String(form.get(key) ?? "");
    const optional = (key: string) => text(key) || null;
    const scope = { company_id: text("company_id"), contract_id: optional("contract_id"), business_case_id: optional("business_case_id"), currency: text("currency") };
    const result = expense ? await saveExpense(selected?.id ?? null, {
      ...scope, description: text("description"), amount: Number(text("amount")),
      expense_date: text("date"), supplier_id: optional("party_id"), category_id: optional("category_id"),
      shipment_id: optional("shipment_id"), status: text("status") === "Cancelled" ? "Cancelled" : text("status") === "Draft" ? "Draft" : "Posted",
    }) : await saveCommission(selected?.id ?? null, {
      ...scope, business_case_id: text("business_case_id"), label: text("description"),
      beneficiary_id: optional("party_id"), rate: Number(text("rate")),
      basis: text("basis") === "percentage" ? "percentage" : text("basis") === "per_mt" ? "per_mt" : text("basis") === "per_kg" ? "per_kg" : "fixed",
      base_quantity: text("base_quantity") ? Number(text("base_quantity")) : null,
      base_amount: text("base_amount") ? Number(text("base_amount")) : null,
      status: text("status") === "Cancelled" ? "Cancelled" : text("status") === "Draft" ? "Draft" : "Posted",
    });
    setBusy(false);
    if (!result.success) { setError(result.error); return; }
    router.refresh();
  }
  return <div className="space-y-5">
    <h1 className="text-xl font-semibold">{expense ? "Expenses" : "Commissions"}</h1>
    <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-sm"><thead><tr><th className="p-3 text-left">Description</th><th>Company</th><th>Amount</th><th>Status</th><th /></tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t border-border"><td className="p-3">{row.description ?? row.label}</td><td>{options.companies.find(c => c.id === row.company_id)?.name ?? "Shared transaction"}</td><td>{row.currency} {row.amount ?? row.expected_amount}</td><td>{row.status}</td><td><button className="p-2 underline" onClick={() => { setSelected(row); setCompany(row.company_id ?? ""); setContract(row.contract_id ?? ""); }}>Edit</button></td></tr>)}</tbody></table></div>
    <button className="rounded-md border border-border px-3 py-2" onClick={() => { setSelected(null); setCompany(""); setContract(""); }}>New {expense ? "expense" : "commission"}</button>
    <form key={selected?.id ?? "new"} action={save} className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
      <label>Description<input required name="description" className={input} defaultValue={selected?.description ?? selected?.label ?? ""} /></label>
      <label>Company<select required name="company_id" className={input} value={company} onChange={e => setCompany(e.target.value)}><option value="">Select company</option>{options.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Contract<select name="contract_id" className={input} value={contract} onChange={e => setContract(e.target.value)}><option value="">No Contract</option>{options.contracts.map(c => <option key={c.id} value={c.id}>{c.contract_number}</option>)}</select></label>
      <label>Deal<select required={!expense} name="business_case_id" className={input} defaultValue={selected?.business_case_id ?? ""}><option value="">{expense ? "No Deal" : "Select Deal"}</option>{options.businessCases.map(d => <option key={d.id} value={d.id}>{d.case_number}</option>)}</select></label>
      <label>{expense ? "Supplier" : "Beneficiary"}<select name="party_id" className={input} defaultValue={selected?.supplier_id ?? selected?.beneficiary_id ?? ""}><option value="">None</option>{options.counterparties.map(c => <option key={c.id} value={c.id}>{c.legal_name}</option>)}</select></label>
      <label>Original currency<select name="currency" className={input} defaultValue={selected?.currency ?? "USD"}>{options.currencies.map(c => <option key={c}>{c}</option>)}</select></label>
      {expense ? <>
        <label>Amount<input name="amount" type="number" min="0" step="0.01" required className={input} defaultValue={selected?.amount ?? ""} /></label>
        <label>Date<input name="date" type="date" required className={input} defaultValue={selected?.expense_date ?? new Date().toISOString().slice(0, 10)} /></label>
        <label>Category<select name="category_id" className={input} defaultValue={selected?.category_id ?? ""}><option value="">Select category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Shipment<select name="shipment_id" className={input} defaultValue={selected?.shipment_id ?? ""}><option value="">No shipment</option>{options.shipments.filter(s => !contract || s.contract_id === contract).map(s => <option key={s.id} value={s.id}>{s.container ?? s.id}</option>)}</select></label>
      </> : <>
        <label>Basis<select name="basis" className={input} defaultValue={selected?.basis ?? "fixed"}><option value="fixed">Fixed amount</option><option value="per_mt">Per MT</option><option value="per_kg">Per KG</option><option value="percentage">Percentage</option></select></label>
        <label>Rate<input required type="number" step="any" min="0" name="rate" className={input} defaultValue={selected?.rate ?? ""} /></label>
        <label>Quantity in selected basis unit<input type="number" step="any" min="0" name="base_quantity" className={input} defaultValue={selected?.base_quantity ?? ""} /></label>
        <label>Base amount for percentage<input type="number" step="0.01" min="0" name="base_amount" className={input} defaultValue={selected?.base_amount ?? ""} /></label>
      </>}
      <label>Status<select name="status" className={input} defaultValue={selected?.status ?? "Draft"}>{["Draft", "Posted", "Cancelled"].map(s => <option key={s}>{s}</option>)}</select></label>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <button disabled={busy} className="rounded-md bg-primary px-4 py-2 text-primary-foreground">{busy ? "Saving…" : "Save record"}</button>
    </form>
  </div>;
}
