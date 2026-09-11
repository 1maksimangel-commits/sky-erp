"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { getDealProfitability } from "@/lib/finance/profitability-actions";
import type { DealProfitabilityReport, EconomicsGap, ProfitMeasures } from "@/lib/finance/profitability-types";
import { SourcePreparation, type RateChoice } from "./SourcePreparation";
import { CommissionEditor } from "./CommissionEditor";

const inputClass = "rounded-md border border-border bg-background px-3 py-2 text-sm";
const sectionClass = "rounded-lg border border-card-border bg-card p-4";

/** Formatting only: keep the server's decimal text without Number conversion. */
function money(value: string | null, currency: string) {
  if (value === null) return "Incomplete";
  const [whole, fraction] = value.split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction ? `.${fraction}` : ""} ${currency}`;
}

function Gaps({ gaps }: { gaps: EconomicsGap[] }) {
  if (!gaps.length) return null;
  return <div role="status" className="rounded-lg border border-border bg-accent/20 p-4"><p className="text-sm font-medium">Complete these inputs before relying on the result</p>
    <ul className="mt-2 space-y-2 text-sm text-muted-foreground">{gaps.map((gap, index) => <li key={`${gap.code}-${gap.source_id}-${index}`}>{gap.message}{gap.source_id ? <span className="ml-2 font-mono text-xs">Record {gap.source_id}</span> : null}</li>)}</ul></div>;
}

function Measures({ value, currency }: { value: ProfitMeasures; currency: string }) {
  const rows: [string, string | null][] = [["Revenue", value.revenue], ["Cost of goods", value.cogs], ["Freight", value.freight], ["Warehouse", value.warehouse], ["Bank fees", value.bank_fees], ["Other expenses", value.other_expenses], ["Commissions", value.commissions], ["Agent commissions", value.agent_commissions], ["Gross profit", value.gross_profit], ["Net contribution", value.net_contribution]];
  return <div className="space-y-4"><p className="text-sm text-muted-foreground">{value.complete ? "All required inputs are available." : "Partial inputs only. Profit and margin remain incomplete."}</p><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{rows.map(([label, amount]) => <div className={sectionClass} key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{money(amount, currency)}</p></div>)}</div><p className="text-sm text-muted-foreground">Gross margin: {value.gross_margin_percent === null ? "Incomplete" : `${value.gross_margin_percent}%`} · Net margin: {value.net_margin_percent === null ? "Incomplete" : `${value.net_margin_percent}%`}</p><Gaps gaps={value.gaps} /></div>;
}

function sourceHref(kind: string, id: string) {
  if (kind === "invoice") return `/finance/invoices/${id}`;
  if (kind === "payment") return `/finance/payments/${id}`;
  if (kind === "contract") return `/contracts/${id}`;
  if (kind === "expense") return "/finance/expenses";
  if (kind === "commission") return "/finance/commissions";
  return "/warehouse";
}

export function DealEconomicsView({ dealId, initialCompanyId, initialReport, initialError, companies, rates, contracts, contractLines, dealLines }: {
  dealId: string; initialCompanyId: string | null; initialReport: DealProfitabilityReport | null;
  initialError: string | null; companies: { id: string; name: string }[]; rates: RateChoice[];
  contracts: { id: string; label: string }[]; contractLines: { id: string; label: string }[]; dealLines: { id: string; label: string }[];
}) {
  const [company, setCompany] = useState(initialCompanyId ?? "");
  const [currency, setCurrency] = useState("USD");
  const [report, setReport] = useState(initialReport);
  const [error, setError] = useState(initialError);
  const [view, setView] = useState<"actual" | "expected" | "cash">("actual");
  const [pending, startTransition] = useTransition();
  function refresh(nextCompany = company, nextCurrency = currency) {
    startTransition(async () => {
      const result = await getDealProfitability({ deal_id: dealId, company_id: nextCompany || null, reporting_currency: nextCurrency });
      setReport(result.data); setError(result.error);
    });
  }
  return <div className="space-y-5" aria-busy={pending}>
    <div className="flex flex-wrap items-end gap-3"><label className="text-xs">Company perspective<select disabled={pending} className={`mt-1 block ${inputClass}`} value={company} onChange={event => { setCompany(event.target.value); refresh(event.target.value); }}><option value="">Consolidated Deal</option>{companies.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-xs">Reporting currency<select disabled={pending} className={`mt-1 block ${inputClass}`} value={currency} onChange={event => { setCurrency(event.target.value); refresh(company, event.target.value); }}>{["USD", "RUB", "CNY", "AED"].map(code => <option key={code}>{code}</option>)}</select></label><button type="button" disabled={pending} className={inputClass} onClick={() => refresh()}>{pending ? "Loading…" : "Refresh"}</button></div>
    <p className="text-sm text-muted-foreground">Current source records and retained FX inputs. Consolidation requires access to every participating company. Viewing this report does not create or modify transactions.</p>
    {error ? <p role="alert" className={sectionClass}>{error}</p> : null}
    {report ? <>
      <div className="flex flex-wrap gap-2">{(["expected", "actual", "cash"] as const).map(tab => <button type="button" key={tab} onClick={() => setView(tab)} className={`${inputClass} ${view === tab ? "bg-accent font-medium" : ""}`}>{tab === "expected" ? "Expected" : tab === "actual" ? "Actual" : "Cash and settlement"}</button>)}</div>
      {view !== "cash" ? <Measures value={report[view]} currency={report.reporting_currency} /> : <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{([["Received", report.cash.received], ["Paid", report.cash.paid], ["Receivables", report.cash.receivables], ["Payables", report.cash.payables], ["Commission accrued", report.cash.commission_accrued], ["Commission paid", report.cash.commission_paid], ["Commission outstanding", report.cash.commission_outstanding], ["Unallocated payments", report.cash.unallocated_payment]] as const).map(([label, value]) => <div key={label} className={sectionClass}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{money(value, report.reporting_currency)}</p></div>)}</div><Gaps gaps={report.cash.gaps} /></div>}
      <section className={sectionClass}><h3 className="text-sm font-medium">Operational progress</h3><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><p>Contracted sales: {money(report.progress.contracted_sale, report.reporting_currency)}</p><p>Contracted purchases: {money(report.progress.contracted_purchase, report.reporting_currency)}</p><p>Invoiced sales: {money(report.progress.invoiced_sale, report.reporting_currency)}</p><p>Invoiced purchases: {money(report.progress.invoiced_purchase, report.reporting_currency)}</p><p>Sales with release evidence: {money(report.progress.realized_sale, report.reporting_currency)}</p><p>Sales awaiting release evidence: {money(report.progress.unrecognized_sale, report.reporting_currency)}</p>{report.progress.shipped_by_unit.map(row => <p key={row.unit}>Shipped: {row.quantity} {row.unit}</p>)}</div></section>
      <section className={sectionClass}><h3 className="text-sm font-medium">Products — actual</h3><div className="overflow-x-auto"><table className="mt-3 w-full text-left text-sm"><thead><tr className="text-xs text-muted-foreground"><th className="p-2">Product</th><th className="p-2">Revenue</th><th className="p-2">Cost of goods</th><th className="p-2">Net contribution</th><th className="p-2">Readiness</th></tr></thead><tbody>{report.products.map((product, index) => <tr className="border-t border-border" key={product.product_id ?? `unassigned-${index}`}><td className="p-2">{product.label}</td><td className="p-2">{money(product.actual.revenue, report.reporting_currency)}</td><td className="p-2">{money(product.actual.cogs, report.reporting_currency)}</td><td className="p-2">{money(product.actual.net_contribution, report.reporting_currency)}</td><td className="p-2">{product.actual.complete ? "Complete" : "Incomplete"}</td></tr>)}</tbody></table></div></section>
      {report.company_breakdown.length ? <details className={sectionClass}><summary className="cursor-pointer text-sm font-medium">Company results before elimination</summary><div className="mt-3 space-y-4">{report.company_breakdown.map(item => <div key={item.company_id}><h4 className="mb-2 text-sm font-medium">{item.name}</h4><Measures value={item.actual} currency={report.reporting_currency} /></div>)}</div></details> : null}
      <details className={sectionClass}><summary className="cursor-pointer text-sm font-medium">Commissions and settlement</summary><div className="mt-3 space-y-3">{report.commissions.map(item => <div key={item.id} className="border-t border-border pt-2 text-sm"><p>{item.beneficiary} · {item.basis} · {item.status}</p><p>Accrued {money(item.accrued, item.currency)} · Paid {money(item.paid, item.currency)} · Outstanding {money(item.outstanding, item.currency)}</p>{item.basis_changed ? <p>Source basis changed. Review a new commission version.</p> : null}</div>)}{!report.commissions.length ? <p className="text-sm text-muted-foreground">No commissions recorded.</p> : null}<Link href="/finance/commissions" className="inline-block text-sm underline">Open commission records</Link></div></details>
      <details className={sectionClass}><summary className="cursor-pointer text-sm font-medium">Source records and FX</summary><div className="overflow-x-auto"><table className="mt-3 w-full text-left text-sm"><thead><tr className="text-xs text-muted-foreground"><th className="p-2">Source</th><th className="p-2">Original amount</th><th className="p-2">Reporting amount</th><th className="p-2">FX evidence</th><th className="p-2">Flow</th></tr></thead><tbody>{report.sources.map((source, index) => <tr key={`${source.kind}-${source.id}-${index}`} className="border-t border-border"><td className="p-2"><Link href={sourceHref(source.kind, source.id)} className="underline">{source.label}</Link><p className="font-mono text-xs text-muted-foreground">{source.id}</p></td><td className="p-2">{money(source.original_amount, source.original_currency)}</td><td className="p-2">{money(source.reporting_amount, report.reporting_currency)}</td><td className="p-2">{source.fx_rate ?? "Missing"}{source.fx_snapshot_id ? <p className="font-mono text-xs">{source.fx_snapshot_id}</p> : null}</td><td className="p-2">{source.internal ? "Internal" : "External"}</td></tr>)}</tbody></table></div></details>
      {report.eliminations.length ? <details className={sectionClass}><summary className="cursor-pointer text-sm font-medium">Internal eliminations</summary><ul className="mt-3 space-y-2 text-sm">{report.eliminations.map((item, index) => <li key={`${item.source_id}-${index}`}>{item.description}<span className="ml-2 font-mono text-xs text-muted-foreground">{item.source_id}</span></li>)}</ul></details> : null}
      <details className={sectionClass}><summary className="cursor-pointer text-sm font-medium">Calculation definitions</summary><ul className="mt-3 space-y-2 text-sm text-muted-foreground">{report.definitions.map(definition => <li key={definition}>{definition}</li>)}</ul></details>
      <SourcePreparation key={`${company}-${currency}`} dealId={dealId} companyId={company} currency={currency} sources={report.sources} rates={rates} onSaved={() => refresh()} />
      <CommissionEditor key={company} dealId={dealId} companyId={company} contracts={contracts} contractLines={contractLines} dealLines={dealLines} onSaved={() => refresh()} />
    </> : null}
  </div>;
}
