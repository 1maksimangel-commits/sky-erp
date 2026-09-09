"use client";

import Link from "next/link";
import { useState } from "react";
import type { DocumentTemplate } from "@/lib/document-templates/types";
import { listGeneratedDocuments, setGeneratedDocumentStatus } from "@/lib/documents/generation-actions";
import type { BusinessCase } from "@/lib/business-cases";
import type { Contract } from "@/lib/contracts/db";
import type { Company } from "@/lib/companies";
import { partyName } from "@/lib/contracts/parties";

const kinds = ["contract", "supplement", "invoice"] as const;
type Kind = typeof kinds[number];
const labels: Record<Kind, string> = { contract: "Contract", supplement: "Supplement / Addendum", invoice: "Commercial Invoice" };
type Preview = { values: Record<string, unknown>; reviewHash: string; missing: string[] };
type Details = { number: string; date: string; notes: string; supplementReference: string };
type History = NonNullable<Awaited<ReturnType<typeof listGeneratedDocuments>>["data"]>;
const fieldClass = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const buttonClass = "rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50";
function label(value: string) { return value.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase()); }
function visibleFields(value: object) { return Object.entries(value).filter(([key]) => key !== "id" && !key.endsWith("_id")); }
function ReviewValues({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    const rows = value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item));
    const columns = Array.from(new Set(rows.flatMap((item) => visibleFields(item).map(([key]) => key))));
    return rows.length ? <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{columns.map((key) => <th key={key} className="whitespace-nowrap border-b border-border p-2">{label(key)}</th>)}</tr></thead><tbody>{rows.map((item, index) => <tr key={index}>{columns.map((key) => <td key={key} className="border-b border-border p-2"><ReviewValues value={item[key]} /></td>)}</tr>)}</tbody></table></div> : <span className="text-muted-foreground">—</span>;
  }
  if (value && typeof value === "object") return <dl className="grid gap-3 sm:grid-cols-2">{visibleFields(value).map(([key, item]) => <div key={key} className={item && typeof item === "object" ? "sm:col-span-2" : ""}><dt className="mb-1 text-xs text-muted-foreground">{label(key)}</dt><dd className="whitespace-pre-wrap break-words"><ReviewValues value={item} /></dd></div>)}</dl>;
  return <>{typeof value === "string" || typeof value === "number" ? String(value) || "—" : typeof value === "boolean" ? (value ? "Yes" : "No") : "—"}</>;
}

export function DocumentGenerationView({ templates, deals, contracts, companies, error, initialContractId = "", initialHistory = [] }: {
  templates: DocumentTemplate[]; deals: BusinessCase[]; contracts: Contract[]; companies: Company[]; error: string | null;
  initialContractId?: string; initialHistory?: History;
}) {
  const initialContract = contracts.find((item) => item.id === initialContractId);
  const [dealId, setDealId] = useState(initialContract?.deal_id ?? "");
  const [contractId, setContractId] = useState(initialContract?.id ?? "");
  const [companyId, setCompanyId] = useState(initialContract?.company_id ?? "");
  const [language, setLanguage] = useState("en");
  const [selected, setSelected] = useState<Record<Kind, boolean>>({ contract: true, supplement: false, invoice: false });
  const [templateIds, setTemplateIds] = useState<Partial<Record<Kind, string>>>({});
  const [details, setDetails] = useState<Partial<Record<Kind, Details>>>({});
  const [amendmentEnabled, setAmendmentEnabled] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState("");
  const [deliveryTerms, setDeliveryTerms] = useState("");
  const [lineEdits, setLineEdits] = useState<Record<number, { quantity?: string; unit_price?: string }>>({});
  const [previews, setPreviews] = useState<Partial<Record<Kind, Preview>>>({});
  const [history, setHistory] = useState<History>(initialHistory);
  const [revision, setRevision] = useState<{ id: string; type: Kind } | null>(null);
  const [results, setResults] = useState<Array<{ id: string; downloadUrl: string; number: string; version: number; type: Kind }>>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const contract = contracts.find((item) => item.id === contractId);
  const availableContracts = contracts.filter((item) => !dealId || item.deal_id === dealId);
  const involvedCompanies = companies.filter((item) => item.id === contract?.company_id || contract?.parties.some((party) => party.internal_company_id === item.id));
  const chosen = kinds.filter((kind) => selected[kind]);
  function invalidate() { setPreviews({}); setMessage(null); }
  function availableTemplates(kind: Kind) {
    return templates.filter((item) => item.document_type === kind && item.is_active && item.language.toLowerCase() === language && (!item.company_id || item.company_id === companyId));
  }
  function selectedTemplate(kind: Kind) {
    const available = availableTemplates(kind);
    return available.find((item) => item.id === templateIds[kind]) ??
      available.find((item) => item.company_id === companyId && item.is_default) ??
      available.find((item) => item.is_default) ?? available[0];
  }
  function detail(kind: Kind): Details {
    return details[kind] ?? { number: "", date: new Date().toISOString().slice(0, 10), notes: "", supplementReference: "" };
  }
  function changeDetail(kind: Kind, key: keyof Details, value: string) {
    setDetails((current) => ({ ...current, [kind]: { ...detail(kind), [key]: value } })); invalidate();
  }
  async function loadHistory(id: string) {
    const result = await listGeneratedDocuments(id);
    if (result.error) throw new Error(result.error);
    setHistory(result.data ?? []);
  }
  async function changeContract(id: string) {
    invalidate(); setContractId(id); setHistory([]); setResults([]); setRevision(null); setTemplateIds({}); setDetails({});
    setAmendmentEnabled(false); setPaymentTerms(""); setDeliveryTerms(""); setLineEdits({});
    setCompanyId(contracts.find((item) => item.id === id)?.company_id ?? "");
    if (id) { setBusy(true); try { await loadHistory(id); } catch (failure) { setMessage(failure instanceof Error ? failure.message : "Could not load document history."); } finally { setBusy(false); } }
  }
  async function request(kind: Kind, preview: boolean) {
    const template = selectedTemplate(kind);
    if (!template) throw new Error("Choose an active " + labels[kind] + " template for this company and language.");
    const response = await fetch("/api/documents/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      templateId: template.id, contractId, documentType: kind, details: detail(kind), preview,
      reviewHash: previews[kind]?.reviewHash, supersedesId: revision?.type === kind ? revision.id : undefined,
      amendment: kind === "supplement" && amendmentEnabled ? {
        paymentTerms: paymentTerms || undefined, deliveryTerms: deliveryTerms || undefined,
        products: Object.keys(lineEdits).length ? contract?.product_lines.map((line, index) => ({
          ...line,
          quantity: lineEdits[index]?.quantity !== undefined ? Number(lineEdits[index].quantity) : line.quantity,
          unit_price: lineEdits[index]?.unit_price !== undefined ? Number(lineEdits[index].unit_price) : line.unit_price,
          agreed_amount: null,
        })) : undefined,
      } : undefined,
    }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Document request failed.");
    return payload;
  }
  async function review() {
    setBusy(true); setMessage(null); setPreviews({});
    try {
      const next: Partial<Record<Kind, Preview>> = {};
      for (const kind of chosen) next[kind] = await request(kind, true);
      const reviewedDetails: Partial<Record<Kind, Details>> = {};
      for (const kind of chosen) {
        const document = next[kind]?.values.document;
        if (!document || typeof document !== "object" || !("number" in document) || typeof document.number !== "string") throw new Error("The reviewed document number is unavailable.");
        reviewedDetails[kind] = { ...detail(kind), number: document.number };
      }
      setDetails((current) => ({ ...current, ...reviewedDetails }));
      setPreviews(next);
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : "Could not review documents."); }
    finally { setBusy(false); }
  }
  async function generate() {
    setBusy(true); setMessage(null);
    try {
      for (const kind of chosen) {
        if (results.some((item) => item.type === kind)) continue;
        const result = await request(kind, false);
        setResults((current) => [...current, { ...result, type: kind }]);
      }
      setPreviews({}); setRevision(null);
      await loadHistory(contractId);
      setMessage("Documents saved as Draft. Download each DOCX below.");
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : "Generation failed. Already generated files remain available below."); }
    finally { setBusy(false); }
  }
  async function changeStatus(id: string, status: "Final" | "Issued") {
    setBusy(true); setMessage(null);
    try { const result = await setGeneratedDocumentStatus(id, status); if (!result.success) throw new Error(result.error); await loadHistory(contractId); }
    catch (failure) { setMessage(failure instanceof Error ? failure.message : "Could not update document state."); }
    finally { setBusy(false); }
  }
  const reviewed = chosen.length > 0 && chosen.every((kind) => previews[kind] && !previews[kind]!.missing.length);
  return <main className="space-y-6">
    <header className="flex flex-wrap justify-between gap-3"><div><h1 className="text-xl font-semibold">Generate Documents</h1><p className="mt-1 text-sm text-muted-foreground">Choose a Contract, review its agreed values, and download your documents.</p></div><Link href="/document-templates" className={buttonClass}>Manage templates</Link></header>
    {error ? <p role="alert" className="rounded border border-red-500/30 p-3 text-sm text-red-300">{error}</p> : null}
    <fieldset disabled={busy} className="space-y-4 rounded-xl border border-border bg-card p-4">
      <legend className="px-1 font-medium">Source</legend>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">Deal<select className={fieldClass} value={dealId} onChange={(event) => { setDealId(event.target.value); void changeContract(""); }}><option value="">All accessible Contracts</option>{deals.map((item) => <option key={item.id} value={item.id}>{item.case_number} · {item.title}</option>)}</select></label>
        <label className="text-sm">Contract<select className={fieldClass} value={contractId} onChange={(event) => void changeContract(event.target.value)}><option value="">Choose Contract</option>{availableContracts.map((item) => <option key={item.id} value={item.id}>{item.contract_number} · {partyName(item.parties, "seller")} → {partyName(item.parties, "buyer")}</option>)}</select></label>
        <label className="text-sm">Internal company for template selection<select className={fieldClass} value={companyId} onChange={(event) => { setCompanyId(event.target.value); setTemplateIds({}); invalidate(); }}><option value="">Global templates</option>{involvedCompanies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-sm">Document language<select className={fieldClass} value={language} onChange={(event) => { setLanguage(event.target.value); setTemplateIds({}); invalidate(); }}><option value="en">English</option><option value="ru">Russian</option><option value="zh">Chinese</option></select></label>
      </div>
      {contract ? <p className="text-sm">Seller: {partyName(contract.parties, "seller")} · Buyer: {partyName(contract.parties, "buyer")} · <Link className="underline" href={"/contracts/" + contract.id}>Open source Contract</Link></p> : <p className="text-sm text-muted-foreground">Select the legal Contract for this document. Each Contract in a Deal has its own Seller and Buyer.</p>}
    </fieldset>
    <fieldset disabled={busy} className="space-y-4 rounded-xl border border-border bg-card p-4"><legend className="px-1 font-medium">Documents and templates</legend>
      {kinds.map((kind) => <section key={kind} className="space-y-3 border-b border-border pb-4 last:border-0">
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={selected[kind]} onChange={(event) => { setSelected((current) => ({ ...current, [kind]: event.target.checked })); setResults([]); setRevision(null); invalidate(); }} />{labels[kind]}</label>
        {selected[kind] ? <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm md:col-span-2">Template<select className={fieldClass} value={selectedTemplate(kind)?.id ?? ""} onChange={(event) => { setTemplateIds((current) => ({ ...current, [kind]: event.target.value })); setResults([]); invalidate(); }}><option value="">Choose template</option>{availableTemplates(kind).map((item) => <option key={item.id} value={item.id}>{item.name} · v{item.version}{item.is_default ? " · Default" : ""}</option>)}</select></label>
          {kind !== "contract" ? <><label className="text-sm">{labels[kind]} number<input className={fieldClass} value={detail(kind).number} placeholder="Assign automatically" onChange={(event) => changeDetail(kind, "number", event.target.value)} /></label><label className="text-sm">Document date<input type="date" className={fieldClass} value={detail(kind).date} onChange={(event) => changeDetail(kind, "date", event.target.value)} /></label></> : null}
          {kind === "invoice" ? <label className="text-sm md:col-span-2">Supplement reference (optional)<input className={fieldClass} value={detail(kind).supplementReference} onChange={(event) => changeDetail(kind, "supplementReference", event.target.value)} /></label> : null}
          <label className="text-sm md:col-span-2">{kind === "supplement" ? "Amendments / revised terms" : "Document notes"} (optional)<textarea className={fieldClass} value={detail(kind).notes} onChange={(event) => changeDetail(kind, "notes", event.target.value)} /><span className="text-xs text-muted-foreground">Applies only to this document and is retained in its snapshot. The source Contract is unchanged.</span></label>
        </div> : null}
      </section>)}
      {selected.supplement && contract ? <details className="space-y-3 rounded border border-border p-3"><summary className="cursor-pointer text-sm">Supplement: revised quantities, prices, or terms</summary><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={amendmentEnabled} onChange={(event) => { setAmendmentEnabled(event.target.checked); invalidate(); }} />Use explicit amendments for this Supplement only</label>{amendmentEnabled ? <div className="space-y-3"><p className="text-xs text-muted-foreground">These changes are shown in review and retained in the Supplement snapshot. They do not edit the original Contract.</p><label className="block text-sm">Revised payment terms<textarea className={fieldClass} value={paymentTerms} placeholder="Keep Contract terms" onChange={(event) => { setPaymentTerms(event.target.value); invalidate(); }} /></label><label className="block text-sm">Revised delivery terms<textarea className={fieldClass} value={deliveryTerms} placeholder="Keep Contract terms" onChange={(event) => { setDeliveryTerms(event.target.value); invalidate(); }} /></label>{contract.product_lines.map((line, index) => <div key={line.id ?? index} className="grid gap-3 rounded border border-border p-3 md:grid-cols-3"><p className="text-sm">{line.description} · {line.currency}</p><label className="text-sm">Quantity ({line.unit})<input type="number" min="0.000001" step="any" className={fieldClass} value={lineEdits[index]?.quantity ?? line.quantity} onChange={(event) => { setLineEdits((current) => ({ ...current, [index]: { ...current[index], quantity: event.target.value } })); invalidate(); }} /></label><label className="text-sm">Unit price<input type="number" min="0" step="any" className={fieldClass} value={lineEdits[index]?.unit_price ?? line.unit_price} onChange={(event) => { setLineEdits((current) => ({ ...current, [index]: { ...current[index], unit_price: event.target.value } })); invalidate(); }} /></label></div>)}</div> : null}</details> : null}
      {revision ? <p className="text-sm">Creating a new revision. The previous file and snapshot remain unchanged.</p> : null}
      <button type="button" className={buttonClass} disabled={!contractId || !chosen.length || busy} onClick={() => { setResults([]); void review(); }}>{busy ? "Working…" : "Review documents"}</button>
    </fieldset>
    {message ? <p role="status" className="rounded border border-border p-3 text-sm">{message}</p> : null}
    {chosen.map((kind) => previews[kind] ? <section key={kind} className="space-y-4 rounded-xl border border-border bg-card p-4 text-sm"><h2 className="font-semibold">{labels[kind]} — review values</h2>{previews[kind]!.missing.length ? <ul className="list-inside list-disc text-red-300">{previews[kind]!.missing.map((missing) => <li key={missing}>{missing}</li>)}</ul> : null}<ReviewValues value={previews[kind]!.values} /></section> : null)}
    {Object.keys(previews).length ? <div className="space-y-2"><p className="text-sm text-muted-foreground">Review these values before generating. Correct legal data in the source Contract, then review again.</p><button className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50" disabled={busy || !reviewed} onClick={() => void generate()}>Confirm and generate DOCX</button></div> : null}
    {results.length ? <section className="space-y-3 rounded-xl border border-border bg-card p-4"><h2 className="font-medium">Generated files</h2>{results.map((item) => <p key={item.id} className="text-sm"><a href={item.downloadUrl} className="underline">Download {labels[item.type]} {item.number} · v{item.version} DOCX</a></p>)}</section> : null}
    {history.length ? <section className="rounded-xl border border-border bg-card p-4"><h2 className="mb-3 font-medium">Document history</h2><div className="space-y-3">{history.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 text-sm"><span>{item.document_number} · v{item.version} · {item.status}</span><div className="flex flex-wrap gap-2"><a className={buttonClass} href={"/api/documents/generated/" + item.id}>Download DOCX</a>{item.status === "Draft" ? <button className={buttonClass} disabled={busy} onClick={() => void changeStatus(item.id, "Final")}>Mark Final</button> : item.status === "Final" ? <button className={buttonClass} disabled={busy} onClick={() => void changeStatus(item.id, "Issued")}>Mark Issued</button> : null}{kinds.some((kind) => kind === item.document_type) ? <button className={buttonClass} disabled={busy} onClick={() => { const kind = kinds.find((value) => value === item.document_type)!; setRevision({ id: item.id, type: kind }); setSelected({ contract: kind === "contract", supplement: kind === "supplement", invoice: kind === "invoice" }); setTemplateIds({ [kind]: item.source_template_id }); setDetails({ [kind]: { ...detail(kind), number: item.document_number } }); setResults([]); invalidate(); }}>New version</button> : null}</div></div>)}</div></section> : null}
    <p className="text-xs text-muted-foreground">DOCX is the preserved output. PDF conversion is not available here; export from Word or Pages if needed.</p>
  </main>;
}
