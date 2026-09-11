/** All accounting values cross this boundary as decimal text. */
export type EconomicsGap = { code: string; message: string; source_id: string | null };
export type ProfitMeasures = {
  external_revenue: string; intercompany_revenue: string; revenue: string;
  external_cogs: string; intercompany_cogs: string; cogs: string;
  freight: string; warehouse: string; bank_fees: string; other_expenses: string;
  commissions: string; agent_commissions: string; operating_costs: string;
  gross_profit: string | null; net_contribution: string | null;
  gross_margin_percent: string | null; net_margin_percent: string | null;
  complete: boolean; gaps: EconomicsGap[];
};
export type EconomicsCash = {
  received: string; paid: string; receivables: string; payables: string;
  commission_accrued: string; commission_paid: string; commission_outstanding: string;
  unallocated_payment: string; complete: boolean; gaps: EconomicsGap[];
};
export type EconomicsProduct = { product_id: string | null; label: string; actual: ProfitMeasures };
export type EconomicsSource = {
  kind: string; id: string; company_id: string | null; label: string;
  original_amount: string; original_currency: string; reporting_amount: string | null;
  fx_rate: string | null; fx_snapshot_id: string | null; internal: boolean;
};
export type EconomicsCommission = {
  id: string; company_id: string; beneficiary: string; basis: string;
  rate: string; currency: string; accrued: string; paid: string; outstanding: string;
  status: string; basis_changed: boolean;
};
export type DealProfitabilityReport = {
  deal_id: string; reporting_currency: string; company_id: string | null;
  scope: "company" | "consolidated"; generated_at: string;
  companies: { id: string; name: string }[];
  expected: ProfitMeasures; actual: ProfitMeasures; cash: EconomicsCash;
  company_breakdown: { company_id: string; name: string; expected: ProfitMeasures; actual: ProfitMeasures; cash: EconomicsCash }[];
  products: EconomicsProduct[]; commissions: EconomicsCommission[];
  sources: EconomicsSource[]; eliminations: { source_id: string; kind: string; description: string }[];
  progress: { contracted_sale: string; contracted_purchase: string; invoiced_sale: string; invoiced_purchase: string; realized_sale: string; unrecognized_sale: string; shipped_by_unit: { unit: string; quantity: string }[] };
  definitions: string[];
};
