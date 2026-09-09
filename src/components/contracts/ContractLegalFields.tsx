"use client";

import type { Company } from "@/lib/companies";
import type { Counterparty } from "@/lib/counterparties";
import type { Product } from "@/lib/products";
import { CONTRACT_PARTY_ROLES, contractLineAmount, type ContractPartyInput, type ContractLineInput } from "@/lib/contracts/parties";

const inputClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

export function ContractPartyFields({ value, onChange, companies, counterparties, disabled = false }: {
  value: ContractPartyInput[]; onChange: (value: ContractPartyInput[]) => void;
  companies: Company[]; counterparties: Counterparty[]; disabled?: boolean;
}) {
  return <section className="space-y-4 rounded-lg border border-border p-4">
    <h3 className="text-sm font-medium">Legal parties</h3>
    <p className="text-xs text-muted-foreground">Seller and Buyer are independent of the owning workspace. Review the agreed legal names and addresses; these snapshots remain on this Contract.</p>
    {CONTRACT_PARTY_ROLES.map(role => {
      const party = value.find(p => p.role_code === role);
      const selected = party ? `${party.internal_company_id ? "company" : "counterparty"}:${party.internal_company_id || party.counterparty_id}` : "";
      return <div key={role} className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs capitalize">{role}{role === "seller" || role === "buyer" ? " *" : ""}
          <select aria-label={role} className={inputClass} disabled={disabled} value={selected} onChange={event => {
            const [kind, id] = event.target.value.split(":");
            if (!id) { onChange(value.filter(p => p.role_code !== role)); return; }
            const company = kind === "company" ? companies.find(c => c.id === id) : null;
            const counterparty = kind === "counterparty" ? counterparties.find(c => c.id === id) : null;
            const entity = company || counterparty;
            if (!entity) return;
            const next: ContractPartyInput = { role_code: role, internal_company_id: company?.id ?? null, counterparty_id: counterparty?.id ?? null,
              snapshot: { legal_name: company?.name ?? counterparty?.legal_name ?? "", address: entity.address, tax_id: entity.tax_id, registration_number: entity.registration_number } };
            onChange([...value.filter(p => p.role_code !== role), next]);
          }}>
            <option value="">Select legal entity</option>
            {party && !companies.some(c => c.id === party.internal_company_id) && !counterparties.some(c => c.id === party.counterparty_id) ? <option value={selected}>{party.snapshot.legal_name} (retained reference)</option> : null}
            <optgroup label="Internal Companies">{companies.map(c => <option key={c.id} value={`company:${c.id}`}>{c.name}</option>)}</optgroup>
            <optgroup label="External Counterparties">{counterparties.map(c => <option key={c.id} value={`counterparty:${c.id}`}>{c.legal_name}</option>)}</optgroup>
          </select>
        </label>
        {party ? ["legal_name", "address", "registration_number", "tax_id", "bank_details"].map(field => <label key={field} className="text-xs">{field.replaceAll("_", " ")}
          <input aria-label={`${role} ${field}`} disabled={disabled} className={inputClass} value={party.snapshot[field] ?? ""} onChange={e => onChange(value.map(p => p.role_code === role ? { ...p, snapshot: { ...p.snapshot, [field]: e.target.value } } : p))} />
        </label>) : null}
        {party ? <details className="sm:col-span-3"><summary className="cursor-pointer text-xs">Agreed bank and signatory details for documents</summary><div className="mt-2 grid gap-2 sm:grid-cols-3">{["bank_name", "bank_account", "bank_swift", "bank_address", "signatory_name", "signatory_title"].map(field => <label key={field} className="text-xs">{field.replaceAll("_", " ")}<input disabled={disabled} className={inputClass} value={party.snapshot[field] ?? ""} onChange={e => onChange(value.map(p => p.role_code === role ? { ...p, snapshot: { ...p.snapshot, [field]: e.target.value } } : p))} /></label>)}</div><p className="mt-2 text-xs text-muted-foreground">These agreed values stay with this Contract when master records change.</p></details> : null}
      </div>;
    })}
    <a href="/counterparties?new=1" target="_blank" rel="noreferrer" className="text-xs underline">Create an external Counterparty</a>
  </section>;
}

export function ContractLineFields({ value, onChange, currency, products = [], disabled = false }: {
  value: ContractLineInput[]; onChange: (value: ContractLineInput[]) => void; currency: string; products?: Product[]; disabled?: boolean;
}) {
  const patch = (index: number, fields: Partial<ContractLineInput>) => onChange(value.map((line, i) => i === index ? { ...line, ...fields } : line));
  return <section className="space-y-3 rounded-lg border border-border p-4">
    <h3 className="text-sm font-medium">Agreed product lines</h3>
    {value.map((line, index) => <div key={line.id ?? index} className="grid gap-2 border-b border-border pb-3 sm:grid-cols-3">
      <label className="text-xs">Legal description<input className={inputClass} disabled={disabled} value={line.description} onChange={e => patch(index, { description: e.target.value })} /></label>
      <label className="text-xs">Product (optional)<select className={inputClass} disabled={disabled} value={line.product_id ?? ""} onChange={e => patch(index, { product_id: e.target.value || null })}><option value="">Legal description only</option>{line.product_id && !products.some(p => p.id === line.product_id) ? <option value={line.product_id}>Retained Product link</option> : null}{products.map(p => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></label>
      {(["quantity", "unit_price", "net_weight", "gross_weight", "agreed_amount"] as const).map(field => <label className="text-xs" key={field}>{field.replaceAll("_", " ")}<input type="number" step="any" min="0" className={inputClass} disabled={disabled} value={line[field] ?? ""} onChange={e => patch(index, { [field]: e.target.value === "" && field !== "quantity" && field !== "unit_price" ? null : Number(e.target.value) })} /></label>)}
      {(["unit", "currency", "size_grade", "packing", "origin", "notes"] as const).map(field => <label className="text-xs" key={field}>{field.replaceAll("_", " ")}<input className={inputClass} disabled={disabled} value={line[field] ?? ""} onChange={e => patch(index, { [field]: e.target.value })} /></label>)}
      <p className="text-xs">Calculated amount: {contractLineAmount(line)} {line.currency}</p>
      {!line.id && !disabled ? <button type="button" onClick={() => onChange(value.filter((_, i) => i !== index))} className="text-xs underline">Remove unsaved line</button> : null}
    </div>)}
    {!disabled ? <button type="button" className="text-sm underline" onClick={() => onChange([...value, { product_id: null, description: "", quantity: 1, unit: "kg", unit_price: 0, currency }])}>Add product line</button> : null}
  </section>;
}
