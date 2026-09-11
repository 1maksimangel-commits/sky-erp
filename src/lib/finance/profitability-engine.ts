import { Exact } from "./exact";
import type { ProfitabilityInputs, EconomicCommissionInput } from "./profitability-inputs";
import type { DealProfitabilityReport, EconomicsGap, EconomicsSource, ProfitMeasures, EconomicsCash } from "./profitability-types";

const zero = () => Exact.zero();
const money = (value: string) => Exact.of(value);
const issued = (status: string) => ["Issued", "Paid", "Partially Paid", "Overdue"].includes(status);
const cancelled = (status: string) => status === "Cancelled";
const fields = ["external_revenue", "intercompany_revenue", "external_cogs", "intercompany_cogs", "freight", "warehouse", "bank_fees", "other_expenses", "commissions", "agent_commissions"] as const;
type Field = typeof fields[number];
class Measures {
  values = Object.fromEntries(fields.map(key => [key, zero()])) as Record<Field, Exact>;
  gaps: EconomicsGap[] = [];
  add(key: Field, value: Exact) { this.values[key] = this.values[key].add(value); }
  gap(code: string, message: string, source_id: string | null = null) {
    if (!this.gaps.some(g => g.code === code && g.source_id === source_id)) this.gaps.push({ code, message, source_id });
  }
  result(): ProfitMeasures {
    const v = this.values;
    const revenue = v.external_revenue.add(v.intercompany_revenue), cogs = v.external_cogs.add(v.intercompany_cogs);
    const operating = v.freight.add(v.warehouse).add(v.bank_fees).add(v.other_expenses).add(v.commissions).add(v.agent_commissions);
    const gross = revenue.sub(cogs), net = gross.sub(operating), complete = this.gaps.length === 0;
    const margin = (amount: Exact) => complete && !revenue.isZero() ? amount.div(revenue).mul(money("100")).format(4) : null;
    return { ...Object.fromEntries(fields.map(key => [key, v[key].format()])) as Record<Field, string>, revenue: revenue.format(), cogs: cogs.format(), operating_costs: operating.format(), gross_profit: complete ? gross.format() : null, net_contribution: complete ? net.format() : null, gross_margin_percent: margin(gross), net_margin_percent: margin(net), complete, gaps: this.gaps };
  }
}

/** One canonical, read-only calculation. Source preparation and persistence are separate. */
export function calculateDealProfitability(input: ProfitabilityInputs): DealProfitabilityReport {
  const sources = new Map<string, EconomicsSource>();
  const eliminations = new Map<string, { source_id: string; kind: string; description: string }>();
  const companyIds = new Set(input.companies.map(c => c.id));
  const invoices = new Map(input.invoices.map(i => [i.id, i]));
  const currentCommissions = input.commissions.filter(c => c.is_current);
  const commissionIds = new Set(currentCommissions.map(c => c.id));
  function fx(kind: string, id: string, company: string, currency: string, value: Exact, target: Measures, label: string, internal = false): Exact | null {
    const snapshot = input.snapshots.find(s => s.source_kind === kind && s.source_id === id && s.company_id === company && s.reporting_currency === input.reporting_currency && s.original_currency === currency);
    const rate = currency === input.reporting_currency ? "1" : snapshot?.fx_rate ?? null;
    const result = rate === null ? null : value.mul(money(rate));
    sources.set(`${kind}:${id}:${company}:${label}`, { kind, id, company_id: company, label, original_amount: value.format(), original_currency: currency, reporting_amount: result?.format() ?? null, fx_rate: rate, fx_snapshot_id: snapshot?.id ?? null, internal });
    if (rate === null) target.gap("missing_fx", `Capture an explicit ${currency} → ${input.reporting_currency} rate for ${label}.`, id);
    return result;
  }
  function scope(company: string | null) {
    const expected = new Measures(), actual = new Measures(), cashChecks = new Measures();
    const products = new Map<string, { product_id: string | null; label: string; measures: Measures }>();
    const product = (id: string | null) => {
      const key = id ?? "unallocated";
      if (!products.has(key)) products.set(key, { product_id: id, label: id ? input.products.find(p => p.id === id)?.name ?? "Referenced product" : "Unallocated / legal description only", measures: new Measures() });
      return products.get(key)!.measures;
    };
    const inScope = (id: string | null) => id !== null && (company ? id === company : companyIds.has(id));
    const includeSale = (seller: string | null, buyer: string | null) => inScope(seller) && (company !== null || buyer === null);
    const includePurchase = (seller: string | null, buyer: string | null) => inScope(buyer) && (company !== null || seller === null);
    let contractedSale = zero(), contractedPurchase = zero(), invoicedSale = zero(), invoicedPurchase = zero(), realizedSale = zero();
    const shipped = new Map<string, Exact>();
    for (const c of input.contracts) {
      if (cancelled(c.status)) continue;
      const sale = includeSale(c.seller_company_id, c.buyer_company_id), purchase = includePurchase(c.seller_company_id, c.buyer_company_id);
      if (!sale && !purchase) continue;
      if (c.party_alias_conflict) expected.gap("internal_party_alias", "A Company profile is used as an external Contract party; select explicit internal legal parties.", c.id);
      if (!c.parties_reviewed) { expected.gap("unreviewed_contract", "Review explicit Contract parties before including expected economics.", c.id); continue; }
      const lines = input.contract_lines.filter(l => l.contract_id === c.id);
      if (!lines.length) expected.gap("missing_contract_lines", "Contracted economics require priced legal product lines.", c.id);
      for (const l of lines) {
        if (l.agreed_amount === null && l.unit_price === null) { expected.gap("missing_price", "Contract line has no agreed price.", l.id); continue; }
        const value = l.agreed_amount !== null ? money(l.agreed_amount) : money(money(l.quantity).mul(money(l.unit_price!)).format());
        const owner = company ?? (sale ? c.seller_company_id! : c.buyer_company_id!);
        const converted = fx("contract", c.id, owner, l.currency ?? c.currency, value, expected, `${c.contract_number} · legal line ${l.id}`, c.seller_company_id !== null && c.buyer_company_id !== null);
        if (!converted) continue;
        if (sale) { expected.add(c.buyer_company_id ? "intercompany_revenue" : "external_revenue", converted); contractedSale = contractedSale.add(converted); }
        if (purchase) { expected.add(c.seller_company_id ? "intercompany_cogs" : "external_cogs", converted); contractedPurchase = contractedPurchase.add(converted); }
      }
    }
    for (const invoice of input.invoices) {
      if (!issued(invoice.status)) continue;
      if (input.contracts.some(c => c.id === invoice.contract_id && c.party_alias_conflict)) actual.gap("internal_party_alias", "Invoice Contract uses an internal Company profile as an external party; resolve legal identity before reporting.", invoice.id);
      const internal = invoice.issuer_company_id !== null && invoice.recipient_company_id !== null;
      if (company === null && internal) eliminations.set(`invoice:${invoice.id}`, { source_id: invoice.id, kind: "invoice", description: "Internal invoice excluded from consolidated revenue and external purchase obligations; company perspectives retain it." });
      const sale = includeSale(invoice.issuer_company_id, invoice.recipient_company_id), purchase = includePurchase(invoice.issuer_company_id, invoice.recipient_company_id);
      if (purchase) {
        const value = fx("invoice", invoice.id, company ?? invoice.recipient_company_id!, invoice.currency, money(invoice.subtotal), actual, invoice.invoice_number, internal);
        if (value) invoicedPurchase = invoicedPurchase.add(value);
      }
      if (!sale) continue;
      const owner = company ?? invoice.issuer_company_id!;
      const headerValue = fx("invoice", invoice.id, owner, invoice.currency, money(invoice.subtotal), actual, invoice.invoice_number, internal);
      if (headerValue) { actual.add(internal ? "intercompany_revenue" : "external_revenue", headerValue); invoicedSale = invoicedSale.add(headerValue); }
      const lines = input.invoice_lines.filter(l => l.invoice_id === invoice.id);
      if (!lines.length) actual.gap("missing_invoice_lines", "An issued sale requires identifiable invoice lines.", invoice.id);
      for (const line of lines) {
        const bucket = product(line.product_id);
        const lineNet = money(money(line.quantity).mul(money(line.unit_price)).format());
        const converted = fx("invoice", invoice.id, owner, invoice.currency, lineNet, bucket, `${invoice.invoice_number} · product line ${line.id}`, internal);
        if (converted) bucket.add(internal ? "intercompany_revenue" : "external_revenue", converted);
        const realizations = input.realizations.filter(r => r.invoice_item_id === line.id && issued(r.invoice_status));
        const qty = realizations.reduce((sum, r) => sum.add(money(r.quantity)), zero());
        if (qty.compare(money(line.quantity)) !== 0) {
          const message = "Issued quantity is not fully matched to costed releases; profit remains incomplete.";
          actual.gap("unrecognized_quantity", message, line.id); bucket.gap("unrecognized_quantity", message, line.id);
        }
        if (converted) realizedSale = realizedSale.add(converted.mul(qty).div(money(line.quantity)));
        for (const r of realizations) {
          const cost = company ? r.local_unit_cost : r.ultimate_unit_cost;
          const rate = company ? r.local_fx_rate : r.ultimate_fx_rate;
          const currency = company ? r.local_currency : r.ultimate_currency;
          const sourceId = company ? r.stock_movement_id : r.ultimate_source_movement_id;
          if (cost !== null && currency !== null) sources.set(`stock_movement:${r.realization_id}:${company ?? "group"}`, { kind: "stock_movement", id: sourceId ?? r.stock_movement_id, company_id: company ?? r.ultimate_company_id, label: "Specific-lot cost realization", original_amount: money(r.quantity).mul(money(cost)).format(), original_currency: currency, reporting_amount: rate === null ? null : money(r.quantity).mul(money(cost)).mul(money(rate)).format(), fx_rate: rate, fx_snapshot_id: company ? r.local_snapshot_id : r.ultimate_snapshot_id, internal: r.acquisition_internal === true });
          if (cost === null || rate === null || (!company && r.lineage_gap)) {
            const message = cost === null ? "Acquisition cost is unknown." : !company && r.lineage_gap ? "Explicit external acquisition lineage is required." : "Capture immutable inventory cost FX.";
            actual.gap("missing_cost_basis", message, sourceId ?? r.stock_movement_id); bucket.gap("missing_cost_basis", message, sourceId ?? r.stock_movement_id);
          } else {
            const original = money(r.quantity).mul(money(cost)), convertedCost = original.mul(money(rate));
            const internalAcquisition = company !== null && r.acquisition_internal === true;
            if (company && r.acquisition_internal === null) { actual.gap("unknown_acquisition_party", "Acquisition party evidence is incomplete.", r.stock_movement_id); bucket.gap("unknown_acquisition_party", "Acquisition party evidence is incomplete.", r.stock_movement_id); }
            const key = internalAcquisition ? "intercompany_cogs" : "external_cogs";
            actual.add(key, convertedCost); bucket.add(key, convertedCost);
            sources.set(`stock_movement:${r.realization_id}:${company ?? "group"}`, { kind: "stock_movement", id: sourceId ?? r.stock_movement_id, company_id: company ?? r.ultimate_company_id, label: "Specific-lot cost realization", original_amount: original.format(), original_currency: currency!, reporting_amount: convertedCost.format(), fx_rate: rate, fx_snapshot_id: company ? r.local_snapshot_id : r.ultimate_snapshot_id, internal: Boolean(internalAcquisition) });
          }
          shipped.set(r.unit, (shipped.get(r.unit) ?? zero()).add(money(r.quantity)));
        }
      }
    }
    const category = (code: string): Field => /freight|truck|transport|logistic/i.test(code) ? "freight" : /warehouse|storage/i.test(code) ? "warehouse" : /bank/i.test(code) ? "bank_fees" : "other_expenses";
    function costSource(kind: "expense" | "commission", id: string, owner: string, amount: string, currency: string, status: string, label: string, key: Field, directlyThisDeal: boolean, internalBeneficiary: boolean) {
      if (!inScope(owner) || cancelled(status)) return;
      if (company === null && internalBeneficiary) {
        const message = "Internal beneficiary cost needs an explicitly paired canonical transaction; no external cost or elimination was guessed.";
        actual.gap("unpaired_internal_cost", message, id); expected.gap("unpaired_internal_cost", message, id);
      }
      const all = input.allocations.filter(a => kind === "expense" ? a.expense_id === id : a.commission_id === id);
      const relevant = all.filter(a => a.business_case_id === input.deal_id);
      if (status === "Draft") {
        if (directlyThisDeal) { const converted = fx(kind, id, owner, currency, money(amount), expected, label); if (converted) expected.add(key, converted); }
        return;
      }
      if (status !== "Posted") return;
      const allocated = all.reduce((sum, a) => sum.add(money(a.amount)), zero());
      if (directlyThisDeal && allocated.compare(money(amount)) !== 0) {
        actual.gap("unallocated_cost", "Explicit allocations do not cover this Deal cost.", id);
        expected.gap("unallocated_cost", "Explicit allocations do not cover this Deal cost.", id);
      }
      for (const a of relevant) {
        const converted = fx(kind, id, owner, currency, money(a.amount), actual, `${label} · allocation ${a.id}`, internalBeneficiary);
        if (!converted) { expected.gap("missing_fx", "Cost FX snapshot is missing.", id); product(a.product_id).gap("missing_fx", "Cost FX snapshot is missing.", id); continue; }
        actual.add(key, converted); expected.add(key, converted); product(a.product_id).add(key, converted);
      }
    }
    for (const e of input.expenses) costSource("expense", e.id, e.company_id, e.amount, e.currency, e.status, e.description, category(e.category), e.business_case_id === input.deal_id, e.internal_beneficiary);
    for (const c of currentCommissions) costSource("commission", c.id, c.company_id, c.expected_amount, c.currency, c.status, c.beneficiary_name ?? "Commission", c.is_agent ? "agent_commissions" : "commissions", c.business_case_id === input.deal_id, input.internal_commission_ids.includes(c.id));
    // Product contribution cannot silently ignore Deal-only operating costs.
    const unallocated = products.get("unallocated");
    if (unallocated && fields.slice(4).some(key => !unallocated.measures.values[key].isZero())) {
      for (const p of products.values()) if (p.product_id) p.measures.gap("unallocated_product_cost", "Deal-level costs are shown in Unallocated; no product split was guessed.");
    }
    let received = zero(), paid = zero(), receivables = zero(), payables = zero(), unallocatedPayment = zero();
    for (const i of input.invoices) {
      if (!issued(i.status)) continue;
      if (company === null && i.issuer_company_id && i.recipient_company_id) continue;
      if (!inScope(i.issuer_company_id) && !inScope(i.recipient_company_id)) continue;
      const owner = company ?? (inScope(i.issuer_company_id) ? i.issuer_company_id! : i.recipient_company_id!);
      const converted = fx("invoice", i.id, owner, i.currency, money(i.outstanding), cashChecks, `${i.invoice_number} outstanding`);
      if (converted) { if (inScope(i.issuer_company_id)) receivables = receivables.add(converted); if (inScope(i.recipient_company_id)) payables = payables.add(converted); }
    }
    const families = new Set(currentCommissions.map(c => c.root_id));
    for (const p of input.payments) {
      if (p.status !== "Paid") continue;
      if (p.party_alias_conflict) cashChecks.gap("internal_party_alias", "Payment uses an internal Company profile as an external party; resolve legal identity before reporting.", p.id);
      const internal = p.payer_company_id !== null && p.payee_company_id !== null;
      if (company === null && internal) { eliminations.set(`payment:${p.id}`, { source_id: p.id, kind: "payment", description: "One shared internal payment excluded from consolidated cash flows." }); continue; }
      if (!inScope(p.payer_company_id) && !inScope(p.payee_company_id)) continue;
      const allocations = input.payment_allocations.filter(a => a.payment_id === p.id);
      const relevant = allocations.filter(a => a.invoice_id ? invoices.has(a.invoice_id) : a.commission_id !== null && (families.has(a.commission_id) || commissionIds.has(a.commission_id)));
      const allocated = relevant.reduce((sum, a) => sum.add(money(a.amount)), zero());
      const allAllocated = allocations.reduce((sum, a) => sum.add(money(a.amount)), zero());
      const remainder = money(p.amount).sub(allAllocated);
      const attributed = allocated.add(p.business_case_id === input.deal_id ? remainder : zero());
      if (attributed.isZero()) continue;
      const owner = company ?? (inScope(p.payer_company_id) ? p.payer_company_id! : p.payee_company_id!);
      const converted = fx("payment", p.id, owner, p.currency, attributed, cashChecks, "Paid cash transaction", internal);
      if (converted) {
        if (inScope(p.payee_company_id)) received = received.add(converted);
        if (inScope(p.payer_company_id)) paid = paid.add(converted);
        if (p.business_case_id === input.deal_id && attributed.compare(allocated) > 0) unallocatedPayment = unallocatedPayment.add(converted.mul(attributed.sub(allocated)).div(attributed));
      }
    }
    let commissionAccrued = zero(), commissionPaid = zero(), commissionOutstanding = zero();
    for (const c of currentCommissions.filter(c => inScope(c.company_id) && c.status === "Posted")) {
      const accrued = fx("commission", c.id, c.company_id, c.currency, money(c.expected_amount), cashChecks, "Commission accrual");
      const outstanding = fx("commission", c.id, c.company_id, c.currency, money(c.outstanding_amount), cashChecks, "Commission outstanding");
      if (accrued) commissionAccrued = commissionAccrued.add(accrued);
      if (outstanding) commissionOutstanding = commissionOutstanding.add(outstanding);
      for (const a of input.payment_allocations.filter(a => a.commission_id === c.root_id)) {
        const p = input.payments.find(p => p.id === a.payment_id && p.status === "Paid");
        if (!p) continue;
        const value = fx("payment", p.id, c.company_id, p.currency, money(a.amount), cashChecks, "Commission settlement");
        if (value) commissionPaid = commissionPaid.add(value);
      }
    }
    const cash: EconomicsCash = { received: received.format(), paid: paid.format(), receivables: receivables.format(), payables: payables.format(), commission_accrued: commissionAccrued.format(), commission_paid: commissionPaid.format(), commission_outstanding: commissionOutstanding.format(), unallocated_payment: unallocatedPayment.format(), complete: cashChecks.gaps.length === 0, gaps: cashChecks.gaps };
    return { expected: expected.result(), actual: actual.result(), cash, products: [...products.values()].map(p => ({ product_id: p.product_id, label: p.label, actual: p.measures.result() })), progress: { contracted_sale: contractedSale.format(), contracted_purchase: contractedPurchase.format(), invoiced_sale: invoicedSale.format(), invoiced_purchase: invoicedPurchase.format(), realized_sale: realizedSale.format(), unrecognized_sale: invoicedSale.sub(realizedSale).format(), shipped_by_unit: [...shipped].map(([unit, quantity]) => ({ unit, quantity: quantity.format(12) })) } };
  }
  const result = scope(input.company_id);
  const companyBreakdown = input.company_id ? [] : input.companies.map(c => { const s = scope(c.id); return { company_id: c.id, name: c.name, expected: s.expected, actual: s.actual, cash: s.cash }; });
  const commissionRow = (c: EconomicCommissionInput) => ({ id: c.id, company_id: c.company_id, beneficiary: c.beneficiary_name ?? "Commission", basis: c.basis, rate: c.rate, currency: c.currency, accrued: c.expected_amount, paid: c.paid_amount, outstanding: c.outstanding_amount, status: c.status, basis_changed: c.basis_changed });
  return { deal_id: input.deal_id, reporting_currency: input.reporting_currency, company_id: input.company_id, scope: input.company_id ? "company" : "consolidated", generated_at: new Date().toISOString(), companies: input.companies, ...result, company_breakdown: companyBreakdown, commissions: currentCommissions.map(commissionRow), sources: [...sources.values()], eliminations: [...eliminations.values()], definitions: [
    "Expected: reviewed Contract product-line values plus explicit planned/current costs; internal legs retained per company and excluded in consolidation.",
    "Actual revenue: issued invoice lines net of tax. Contracts, payments and generated documents are never added to revenue.",
    "COGS: explicitly recognized released quantity at owned-lot cost. Consolidation follows receipt lineage to external acquisition basis, retaining unrealized inventory markup outside profit.",
    "Gross profit = net invoice revenue − recognized COGS. Net contribution = gross profit − allocated operating costs and commissions. Margins divide by revenue; zero-revenue margins are undefined.",
    "Incomplete cost, allocation, quantity or FX evidence suppresses final profit metrics; visible component totals remain known subtotals.",
    "Cash uses Paid payments once; receivables/payables are invoice obligations including tax. Commission settlement is a subset of cash paid, never an additional expense.",
    "Foreign conversions use immutable selected snapshots. Outstanding balances use the obligation snapshot; settlement uses payment snapshots. This is current Deal contribution, not statutory company accounts or an as-of historical ledger.",
  ] };
}
