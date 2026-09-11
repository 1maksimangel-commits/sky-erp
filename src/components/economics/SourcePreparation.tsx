"use client";

import { useState, useTransition } from "react";
import { captureReportingInput } from "@/lib/finance/economic-input-actions";
import { createSaleRealization, getRealizationChoices, linkIntercompanyReceipt } from "@/lib/finance/realization-actions";
import type { EconomicsSource } from "@/lib/finance/profitability-types";

const field = "mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
type Choices = Awaited<ReturnType<typeof getRealizationChoices>>;
export type RateChoice = { id: string; label: string; base: string; quote: string };

export function SourcePreparation({ dealId, companyId, currency, sources, rates, onSaved }: {
  dealId: string; companyId: string; currency: string; sources: EconomicsSource[];
  rates: RateChoice[]; onSaved: () => void;
}) {
  const [choices, setChoices] = useState<Choices | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sourceKey, setSourceKey] = useState("");
  const availableSources = sources.filter(source => ["invoice", "payment", "expense", "commission", "bank_transaction", "contract", "stock_movement"].includes(source.kind));
  const source = availableSources.find(item => `${item.kind}:${item.id}` === sourceKey);
  const [invoiceItem, setInvoiceItem] = useState("");
  const selectedInvoice = choices?.invoices.find(invoice => invoice.items.some(item => item.id === invoiceItem));
  function open() {
    if (choices || pending) return;
    startTransition(async () => { const result = await getRealizationChoices(dealId); setChoices(result); setError(result.error); });
  }
  function save(task: () => Promise<{ success: boolean; error?: string }>, message: string) {
    setError(null); setNotice(null);
    startTransition(async () => {
      const result = await task();
      if (!result.success) { setError(result.error ?? "Unable to save this input."); return; }
      setNotice(message); const refreshed = await getRealizationChoices(dealId); setChoices(refreshed); setError(refreshed.error); onSaved();
    });
  }
  return <details className="rounded-lg border border-card-border bg-card p-4" onToggle={event => { if (event.currentTarget.open) open(); }}>
    <summary className="cursor-pointer text-sm font-medium">Prepare missing source inputs</summary>
    <p className="mt-3 text-sm text-muted-foreground">These actions save reviewed evidence. They do not post invoices or payments. Select a company perspective before saving.</p>
    {!companyId ? <p className="mt-3 text-sm">Select an internal company above to prepare its inputs.</p> : <div className="mt-4 space-y-6">
      <form className="space-y-3" onSubmit={event => {
        event.preventDefault(); if (!source) return; const form = new FormData(event.currentTarget);
        const origin = source.kind === "invoice" ? { invoice_id: source.id } : source.kind === "payment" ? { payment_id: source.id } : source.kind === "expense" ? { expense_id: source.id } : source.kind === "commission" ? { commission_id: source.id } : source.kind === "bank_transaction" ? { bank_transaction_id: source.id } : source.kind === "contract" ? { contract_id: source.id } : { stock_movement_id: source.id };
        save(() => captureReportingInput({ ...origin, company_id: companyId, reporting_currency: currency, reporting_date: String(form.get("date")), exchange_rate_id: String(form.get("rate") || "") || null }), "Reporting input captured. Its rate and original values are retained.");
      }}><h4 className="text-sm font-medium">Capture reporting currency input</h4><div className="grid gap-3 md:grid-cols-3"><label className="text-xs">Source record<select required className={field} value={sourceKey} onChange={event => setSourceKey(event.target.value)}><option value="">Select a source</option>{availableSources.map((item, index) => <option key={`${item.kind}-${item.id}-${index}`} value={`${item.kind}:${item.id}`}>{item.label} · {item.original_amount} {item.original_currency}</option>)}</select></label><label className="text-xs">Reporting date<input required name="date" type="date" className={field} /></label><label className="text-xs">Rate evidence<select name="rate" className={field} required={Boolean(source && source.original_currency !== currency)} key={`${sourceKey}-${currency}`}><option value="">{source?.original_currency === currency ? "Same currency (rate 1)" : "Select an explicit rate"}</option>{rates.filter(rate => rate.base === source?.original_currency && rate.quote === currency).map(rate => <option key={rate.id} value={rate.id}>{rate.label}</option>)}</select></label></div><button disabled={pending || !source} className={field + " w-auto"}>Confirm and retain input</button></form>
      <form className="space-y-3 border-t border-border pt-4" onSubmit={event => {
        event.preventDefault(); const form = new FormData(event.currentTarget);
        save(() => createSaleRealization({ company_id: companyId, invoice_item_id: invoiceItem, stock_movement_id: String(form.get("movement")), contract_product_id: String(form.get("line")), quantity: String(form.get("quantity")), recognition_date: String(form.get("date")) }), "Sale release evidence saved.");
      }}><h4 className="text-sm font-medium">Link an invoiced sale to a stock release</h4><p className="text-xs text-muted-foreground">Choose the exact invoice line, legal product line and owned outbound movement. Quantity uses the agreed line unit.</p><div className="grid gap-3 md:grid-cols-2"><label className="text-xs">Invoice product line<select required className={field} value={invoiceItem} onChange={event => setInvoiceItem(event.target.value)}><option value="">Select an invoiced line</option>{choices?.invoices.filter(invoice => invoice.issuer_company_id === companyId).flatMap(invoice => invoice.items.map(item => <option key={item.id} value={item.id}>{invoice.invoice_number} · {item.description}</option>))}</select></label><label className="text-xs">Legal Contract product line<select required name="line" className={field}><option value="">Select the matching legal line</option>{choices?.contractProducts.filter(line => !selectedInvoice || selectedInvoice.items.some(item => item.id === invoiceItem && item.product_id === line.product_id)).map(line => <option key={line.id} value={line.id}>{line.description} · {line.unit} · {line.id.slice(0, 8)}</option>)}</select></label><label className="text-xs">Owned release<select required name="movement" className={field}><option value="">Select a release</option>{choices?.movements.filter(item => item.company_id === companyId && item.movement_type === "outbound").map(item => <option key={item.id} value={item.id}>{item.lot_number} · {item.id.slice(0, 8)}</option>)}</select></label><label className="text-xs">Quantity<input required name="quantity" inputMode="decimal" className={field} /></label><label className="text-xs">Recognition date<input required name="date" type="date" className={field} /></label></div><button disabled={pending} className={field + " w-auto"}>Confirm sale release evidence</button></form>
      <form className="space-y-3 border-t border-border pt-4" onSubmit={event => {
        event.preventDefault(); const form = new FormData(event.currentTarget);
        save(() => linkIntercompanyReceipt({ company_id: companyId, receipt_movement_id: String(form.get("receipt")), seller_realization_id: String(form.get("sale")) }), "Intercompany cost origin linked.");
      }}><h4 className="text-sm font-medium">Link an internal purchase to the seller’s release</h4><p className="text-xs text-muted-foreground">This preserves cost origin for consolidation. Access to both companies is required.</p><div className="grid gap-3 md:grid-cols-2"><label className="text-xs">Owned receipt<select required name="receipt" className={field}><option value="">Select a receipt</option>{choices?.movements.filter(item => item.company_id === companyId && item.movement_type === "inbound").map(item => <option key={item.id} value={item.id}>{item.lot_number} · {item.id.slice(0, 8)}</option>)}</select></label><label className="text-xs">Seller’s realization<select required name="sale" className={field}><option value="">Select sale evidence</option>{choices?.realizations.filter(item => item.company_id !== companyId).map(item => <option key={item.id} value={item.id}>{choices.invoices.find(invoice => invoice.items.some(line => line.id === item.invoice_item_id))?.invoice_number ?? "Sale"} · {item.id.slice(0, 8)}</option>)}</select></label></div><button disabled={pending} className={field + " w-auto"}>Confirm internal cost origin</button></form>
    </div>}
    {error ? <p role="alert" className="mt-3 text-sm">{error}</p> : null}{notice ? <p role="status" className="mt-3 text-sm">{notice}</p> : null}
  </details>;
}
