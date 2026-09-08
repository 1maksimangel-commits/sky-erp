"use client";

import { useState } from "react";
import type { DocumentTemplate } from "@/lib/document-templates/types";
import type { BusinessCase } from "@/lib/business-cases";

export function DocumentGenerationView({ templates, deals }: { templates: DocumentTemplate[]; deals: BusinessCase[] }) {
  const [dealId, setDealId] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({ contract: true, supplement: false, invoice: true });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const deal = deals.find((item) => item.id === dealId);
  async function generate(type: "contract" | "supplement" | "invoice") {
    const template = templates.find((item) => item.document_type === type && item.is_active && item.is_default) ?? templates.find((item) => item.document_type === type && item.is_active);
    if (!template) throw new Error(`No active ${type} template configured.`);
    const data = { deal: deal ? { number: deal.case_number, title: deal.title } : {}, contract: deal ? { number: deal.contract_number, date: deal.contract_date, currency: deal.currency, amount: deal.contract_amount, incoterms: deal.incoterms } : {}, seller: deal?.company ?? null, buyer: deal?.buyer ?? null, supplier: deal?.supplier ?? null, consignee: deal?.consignee ?? null, products: deal?.products ?? [] };
    const response = await fetch("/api/documents/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId: template.id, documentType: type, data }) });
    if (!response.ok) { const payload = await response.json().catch(() => null) as { error?: string } | null; throw new Error(payload?.error ?? "Generation failed."); }
    const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${type}.docx`; anchor.click(); URL.revokeObjectURL(url);
  }
  async function run() { setBusy(true); setMessage(null); try { for (const type of ["contract", "supplement", "invoice"] as const) if (selected[type]) await generate(type); setMessage("Selected documents generated."); } catch (error) { setMessage(error instanceof Error ? error.message : "Generation failed."); } finally { setBusy(false); } }
  return <main className="space-y-6"><div><h1 className="text-xl font-semibold">Generate Documents</h1><p className="mt-1 text-sm text-muted-foreground">Choose a Deal and generate Contract, Supplement, and Commercial Invoice from active templates.</p></div><section className="rounded-xl border border-border bg-card p-4"><label className="block text-sm"><span className="mb-1 block text-muted-foreground">Deal (optional)</span><select value={dealId} onChange={(event) => setDealId(event.target.value)} className="w-full max-w-xl rounded-md border border-border bg-background px-3 py-2"><option value="">Manual / no Deal</option>{deals.map((item, index) => <option key={`${item.id}-${index}`} value={item.id}>{item.case_number} · {item.title ?? "Untitled"}</option>)}</select></label><div className="mt-4 flex flex-wrap gap-4 text-sm">{(["contract", "supplement", "invoice"] as const).map((type) => <label key={`document-type-${type}`} className="flex items-center gap-2"><input type="checkbox" checked={selected[type]} onChange={(event) => setSelected((current) => ({ ...current, [type]: event.target.checked }))} />{type === "invoice" ? "Commercial Invoice" : type[0].toUpperCase() + type.slice(1)}</label>)}</div><button type="button" disabled={busy} onClick={run} className="mt-5 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">{busy ? "Generating…" : "Generate Documents"}</button>{message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}</section>{deal ? <section className="rounded-xl border border-border bg-card p-4 text-sm"><h2 className="font-medium">Canonical data preview</h2><p className="mt-2">Seller: {deal.company?.name ?? ""} · Buyer: {deal.buyer?.legal_name ?? ""}</p><p>Products: {deal.products?.length ?? 0}</p></section> : null}</main>;
}
