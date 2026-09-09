"use client";

import { useRef, useState } from "react";
import { Loader2, RefreshCw, X } from "lucide-react";
import { ConfidenceField } from "@/components/contracts/import/ConfidenceField";
import { ContractPartyFields, ContractLineFields } from "@/components/contracts/ContractLegalFields";
import { extractedLegalParties, extractedLegalLines } from "@/lib/contracts/import/review-defaults";
import { extractionToFormDefaults, validateImportReview } from "@/lib/contracts/import/review-validation";
import { confirmContractImport, createCounterpartyFromImport } from "@/lib/contracts/import/actions";
import { reextractContractImportViaApi } from "@/lib/contracts/import/browser-upload";
import { asString, type ExtractedField } from "@/lib/ai/contracts/schema";
import type { ContractImportRecord, ContractImportReviewPayload } from "@/lib/contracts/import/types";
import { emptyContractForm, type ContractFormInput } from "@/lib/contracts/form-types";
import type { Company } from "@/lib/companies";
import type { Counterparty } from "@/lib/counterparties";
import { getContractCounterpartyOptions } from "@/lib/contracts/actions";
import type { Product } from "@/lib/products";
import type { ContractPartyRole } from "@/lib/contracts/parties";

type Props = {
  importRecord: ContractImportRecord; previewUrl: string | null;
  companies: Company[]; counterparties: Counterparty[]; products: Product[];
  businessCases?: { id: string; case_number: string; title: string | null }[];
  onClose: () => void; onCompleted: (message: string, href?: string) => void;
};
const inputClassName = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
const buttonClassName = "rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-50";
function isField(value: unknown): value is ExtractedField<unknown> {
  return typeof value === "object" && value !== null && "value" in value && "confidence" in value && "source_text" in value && "page_number" in value && "warning" in value;
}
function savedReview(record: ContractImportRecord): ContractFormInput | null {
  const matches: unknown = record.match_json;
  if (typeof matches !== "object" || !matches || !("reviewDraft" in matches)) return null;
  const draft = matches.reviewDraft;
  if (typeof draft !== "object" || !draft || !("form" in draft)) return null;
  const form = draft.form;
  if (typeof form !== "object" || !form || !("contract_number" in form) || typeof form.contract_number !== "string") return null;
  // Persisted draft is validated again by the server before confirmation.
  return { ...emptyContractForm(), ...form, contract_number: form.contract_number };
}
function defaults(record: ContractImportRecord, companies: Company[], counterparties: Counterparty[]): ContractFormInput {
  const saved = savedReview(record);
  const extraction = record.extraction_json;
  if (saved) return { ...saved, company_id: record.company_id, parties: saved.parties ?? [], product_lines: saved.product_lines ?? (extraction ? extractedLegalLines(extraction) : []) };
  if (!extraction) return { ...emptyContractForm(), company_id: record.company_id };
  return { ...extractionToFormDefaults(extraction), company_id: record.company_id,
    parties: extractedLegalParties(extraction, companies, counterparties),
    product_lines: extractedLegalLines(extraction),
    payment_terms: asString(extraction.commercial.payment_terms),
    delivery_place: asString(extraction.commercial.incoterms_location),
    legal_snapshot: {},
  };
}

export function ContractImportReviewWorkspace({ importRecord: initialRecord, previewUrl: initialUrl, companies, counterparties, products, businessCases = [], onClose, onCompleted }: Props) {
  const [record, setRecord] = useState(initialRecord);
  const [previewUrl, setPreviewUrl] = useState(initialUrl);
  const [localParties, setLocalParties] = useState(counterparties);
  const [form, setForm] = useState(() => defaults(initialRecord, companies, counterparties));
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, unknown>>(() => {
    const matches: unknown = initialRecord.match_json;
    if (!matches || typeof matches !== "object" || !("reviewDraft" in matches)) return {};
    const draft = matches.reviewDraft;
    if (!draft || typeof draft !== "object" || !("fieldOverrides" in draft)) return {};
    const overrides = draft.fieldOverrides;
    return overrides && typeof overrides === "object" && !Array.isArray(overrides) ? Object.fromEntries(Object.entries(overrides)) : {};
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [newParty, setNewParty] = useState({ role: "seller" as ContractPartyRole, name: "" });
  const lock = useRef(false);
  const extraction = record.extraction_json;
  const payload = (saveAsDraft = false): ContractImportReviewPayload => ({
    importId: record.id, form: { ...form, status: "Draft", company_id: record.company_id },
    matches: { companyId: record.company_id, buyerId: null, supplierId: null, consigneeId: null },
    productLines: [], fieldOverrides, saveAsDraft,
  });
  const validation = validateImportReview({ payload: payload(), extraction });
  const patch = (fields: Partial<ContractFormInput>) => setForm(current => ({ ...current, ...fields }));
  async function confirm(saveAsDraft: boolean) {
    if (lock.current) return;
    lock.current = true; setSaving(true); setError(null);
    try {
      const result = await confirmContractImport(payload(saveAsDraft));
      if (!result.success) { setError(result.error); return; }
      onCompleted(result.data.message, result.data.href);
      if (!saveAsDraft) onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save reviewed Contract."); }
    finally { lock.current = false; setSaving(false); }
  }
  async function reextract() {
    if (lock.current) return;
    lock.current = true; setSaving(true); setError(null);
    try {
      const result = await reextractContractImportViaApi(record.id);
      setRecord(result.importRecord); setPreviewUrl(result.previewUrl);
      // Keep user corrections; re-extraction updates evidence, not agreed values.
      if (!extraction) setForm(defaults(result.importRecord, companies, localParties));
    } catch (e) { setError(e instanceof Error ? e.message : "Extraction failed."); }
    finally { lock.current = false; setSaving(false); }
  }
  async function createParty() {
    if (lock.current) return;
    lock.current = true; setSaving(true); setError(null);
    try {
      const result = await createCounterpartyFromImport({ legalName: newParty.name, type: newParty.role === "seller" ? "supplier" : newParty.role === "buyer" ? "buyer" : "other" });
      if (!result.success) { setError(result.error); return; }
      const refreshed = await getContractCounterpartyOptions();
      if (refreshed.error) { setError(refreshed.error); return; }
      setLocalParties(refreshed.data ?? []);
      patch({ parties: [...(form.parties ?? []).filter(p => p.role_code !== newParty.role), { role_code: newParty.role, internal_company_id: null, counterparty_id: result.data.id, snapshot: { legal_name: newParty.name } }] });
      setNewParty({ ...newParty, name: "" });
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create Counterparty."); }
    finally { lock.current = false; setSaving(false); }
  }
  const generalFields = [
    ["contract_number", "Contract number", extraction?.general.contract_number],
    ["title", "Title", extraction?.general.title],
    ["contract_date", "Contract date", extraction?.general.contract_date],
    ["expiry_date", "Expiry date", extraction?.general.expiry_date],
    ["currency", "Currency", extraction?.commercial.currency],
    ["incoterms", "Incoterms", extraction?.commercial.incoterms],
    ["payment_terms", "Payment terms", extraction?.commercial.payment_terms],
    ["delivery_place", "Delivery terms/place", extraction?.commercial.incoterms_location],
    ["loading_port", "Loading port", extraction?.logistics.port_of_loading],
    ["destination_port", "Destination port", extraction?.logistics.port_of_discharge],
    ["expected_shipment_date", "Expected shipment date", extraction?.commercial.delivery_deadline],
  ] as const;
  return <div className="fixed inset-0 z-50 flex flex-col bg-background">
    <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div><h2 className="text-base font-semibold">Review imported contract</h2><p className="text-xs text-muted-foreground">{record.file_name} · Original retained · Creates Draft only</p></div>
      <div className="flex gap-2">
        <button className={buttonClassName} disabled={saving || Boolean(record.created_contract_id)} onClick={() => void reextract()}><RefreshCw className="inline h-3 w-3" /> Re-extract</button>
        <button className={buttonClassName} disabled={saving || Boolean(record.created_contract_id)} onClick={() => void confirm(true)}>Save review draft</button>
        <button className={buttonClassName} disabled={saving || !extraction || validation.errors.length > 0 || Boolean(record.created_contract_id)} onClick={() => void confirm(false)}>{saving ? <Loader2 className="inline h-3 w-3 animate-spin" /> : null} Confirm &amp; Create Contract</button>
        <button className={buttonClassName} aria-label="Close review" disabled={saving} onClick={onClose}><X className="h-4 w-4" /></button>
      </div>
    </header>
    <div className="grid min-h-0 flex-1 lg:grid-cols-2">
      <section className="flex min-h-0 flex-col border-r border-border">
        <div className="flex gap-3 p-3">
          {previewUrl ? <a href={previewUrl} target="_blank" rel="noreferrer" className="text-xs underline">Open original document</a> : null}
          <label className="text-xs">Page <input type="number" min="1" className="w-16 bg-background" value={page} onChange={e => setPage(Math.max(1,Number(e.target.value)))} /></label>
          <label className="text-xs">Zoom <input type="number" min="25" max="250" className="w-16 bg-background" value={zoom} onChange={e => setZoom(Number(e.target.value))} /></label>
        </div>
        {previewUrl && record.mime_type === "application/pdf" ? <iframe title="Original Contract PDF" className="min-h-0 flex-1" src={previewUrl + "#page=" + page + "&zoom=" + zoom} /> : <p className="p-4 text-sm text-muted-foreground">Use the original download for document layout. Extracted evidence appears alongside reviewed values.</p>}
      </section>
      <div className="space-y-4 overflow-y-auto p-4">
        {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
        {record.created_contract_id ? <a className="underline" href={"/contracts/" + record.created_contract_id}>Open confirmed Contract</a> : null}
        <p className="text-xs">Owning workspace: {companies.find(c => c.id === record.company_id)?.name ?? "Authorized workspace"}. Legal parties are selected independently below.</p>
        {!extraction ? <p>Extraction is missing. The original is retained; retry extraction.</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {generalFields.map(([key,label,field]) => <ConfidenceField key={key} label={label} field={field} onFocusSource={value => value && setPage(value)}>
            <input className={inputClassName} disabled={saving} type={key.endsWith("date") ? "date" : "text"} value={form[key] ?? ""} onChange={e => patch({ [key]: e.target.value })} />
          </ConfidenceField>)}
          <ConfidenceField label="Agreed total amount" field={extraction?.commercial.total_amount}>
            <input className={inputClassName} type="number" min="0" step="any" value={form.amount ?? ""} onChange={e => patch({ amount: e.target.value === "" ? null : Number(e.target.value) })} />
          </ConfidenceField>
          <label className="text-xs">Deal<select className={inputClassName} value={form.deal_id ?? ""} onChange={e => patch({ deal_id: e.target.value || null, business_case_id: e.target.value || null })}><option value="">Unlinked</option>{businessCases.map(d => <option key={d.id} value={d.id}>{d.case_number} {d.title}</option>)}</select></label>
        </div>
        <ContractPartyFields value={form.parties ?? []} onChange={parties => patch({ parties })} companies={companies} counterparties={localParties} disabled={saving} />
        <details className="rounded-lg border border-border p-3"><summary className="text-sm">Create missing external Counterparty</summary>
          <select className={inputClassName} value={newParty.role} onChange={e => { const role = e.target.value; if (["seller","buyer","consignee","payer","beneficiary","manufacturer"].includes(role)) setNewParty(current => ({ ...current, role: role as ContractPartyRole })); }}>
            {(["seller","buyer","consignee","payer","beneficiary","manufacturer"] as const).map(role => <option key={role}>{role}</option>)}
          </select>
          <input className={inputClassName} placeholder="Exact legal name" value={newParty.name} onChange={e => setNewParty(current => ({ ...current, name: e.target.value }))} />
          <button className={buttonClassName} disabled={saving || !newParty.name.trim()} onClick={() => void createParty()}>Create and select Counterparty</button>
        </details>
        <ContractLineFields value={form.product_lines ?? []} onChange={product_lines => patch({ product_lines })} currency={form.currency} products={products} disabled={saving} />
        {extraction ? <section className="space-y-3 rounded-lg border border-border p-3">
          <h3 className="text-sm font-medium">Extracted evidence and legal corrections</h3>
          <p className="text-xs text-muted-foreground">Ambiguous matches remain unselected. Review Seller and Buyer above. Corrections below are retained in the legal snapshot and import audit.</p>
          {Object.entries(extraction).map(([section,fields]) => <details key={section}><summary className="text-xs capitalize">{section.replaceAll("_"," ")}</summary>
            <div className="grid gap-2 sm:grid-cols-2">{(Array.isArray(fields) ? fields.flatMap((line,index) => Object.entries(line).map(([name,field]) => [index + "." + name,field])) : Object.entries(fields)).map(([name,field]) => {
              if (typeof name !== "string" || !isField(field)) return null;
              const path = section + "." + name;
              return <ConfidenceField key={path} label={name.replaceAll("_"," ")} field={field} onFocusSource={value => value && setPage(value)}>
                <p className="text-xs text-muted-foreground">Extracted: {String(field.value ?? "Not found")}</p>
                <input className={inputClassName} value={String(fieldOverrides[path] ?? field.value ?? "")} onChange={e => setFieldOverrides(current => ({ ...current, [path]: e.target.value }))} />
              </ConfidenceField>;
            })}</div>
          </details>)}
        </section> : null}
        <section className="space-y-1 text-xs">{[...validation.errors,...validation.warnings].map((issue,i) => <p key={i} className={issue.level === "error" ? "text-red-300" : "text-muted-foreground"}>{issue.message}</p>)}{record.warnings.map((warning,i) => <p key={i}>{warning}</p>)}</section>
      </div>
    </div>
  </div>;
}
