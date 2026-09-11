export type CommissionInput = {
  company_id: string; business_case_id: string; contract_id?: string | null;
  beneficiary_id?: string | null; beneficiary_name: string;
  beneficiary_type: "agent" | "broker" | "intermediary" | "external_counterparty" | "company" | "person" | "other"; label: string;
  basis: "fixed" | "per_mt" | "per_kg" | "percentage"; rate: string;
  base_quantity?: string | null; base_amount?: string | null; currency: string;
  calculation_base: "quantity" | "net_weight" | "gross_weight" | "sale_revenue" | "purchase_value" | "gross_profit" | "manual" | "contract_amount" | "contract_net_weight" | "deal_net_weight";
  override_amount?: string | null; override_reason?: string | null;
  status: "Draft" | "Posted"; confirmed: boolean; notes?: string | null;
  allocation: { scope: "deal" | "contract" | "contract_product" | "deal_product"; contract_product_id?: string | null; deal_product_id?: string | null };
};
export type CommissionRecord = {
  id: string; family_id: string; root_id: string; revision: number; company_id: string;
  business_case_id: string; contract_id: string | null; beneficiary_id: string | null;
  beneficiary_name: string; beneficiary_type: CommissionInput["beneficiary_type"]; label: string | null; notes: string | null;
  basis: CommissionInput["basis"]; rate: string; base_quantity: string | null; base_amount: string | null;
  calculation_base: CommissionInput["calculation_base"] | null; calculation_snapshot: Record<string, unknown> | null;
  calculated_amount: string; accrued_amount: string; expected_amount: string; paid_amount: string;
  outstanding_amount: string; currency: string; status: "Draft" | "Posted";
  basis_changed: boolean; is_current: boolean; is_agent: boolean;
};
