export const DEAL_STATUSES = [
  "Draft",
  "Active",
  "Documentation",
  "In Transit",
  "Payment",
  "Completed",
  "Cancelled",
] as const;

export type DealStatus = (typeof DEAL_STATUSES)[number];

export const DEAL_PARTICIPANT_ROLES = [
  "seller",
  "buyer",
  "producer",
  "consignee",
  "notify_party",
  "agent",
  "broker",
] as const;

export type DealParticipantRole = (typeof DEAL_PARTICIPANT_ROLES)[number];

export const DEAL_CONTRACT_ROLES = [
  "purchase",
  "sales",
  "annex",
  "amendment",
  "other",
] as const;

export type Deal = {
  id: string;
  case_number: string;
  title: string | null;
  status: string | null;
  case_type: string | null;
  company_id: string | null;
  buyer_id: string | null;
  supplier_id: string | null;
  consignee_id: string | null;
  company_name: string | null;
  buyer_name: string | null;
  supplier_name: string | null;
  consignee_name: string | null;
  incoterms: string | null;
  loading_port: string | null;
  destination_port: string | null;
  payment_terms: string | null;
  expected_shipment_date: string | null;
  eta: string | null;
  purchase_currency: string | null;
  sales_currency: string | null;
  purchase_value: number | null;
  sales_value: number | null;
  expected_expenses: number;
  expected_expenses_currency: string | null;
  expected_commission: number;
  expected_commission_currency: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  canonical_schema_available: boolean;
};

export type DealParticipant = {
  id: string;
  counterparty_id: string;
  role_code: string;
  notes: string | null;
  legal_name: string;
};

export type DealProduct = {
  id: string;
  product_id: string | null;
  sku: string | null;
  product_name: string | null;
  scientific_name: string | null;
  product_description: string | null;
  size_grade: string | null;
  quantity: number;
  unit: string;
  net_weight: number | null;
  gross_weight: number | null;
  purchase_price: number | null;
  sales_price: number | null;
  purchase_currency: string | null;
  sales_currency: string | null;
};

export type DealContract = {
  id: string;
  contract_number: string;
  title: string | null;
  status: string | null;
  amount: number | null;
  currency: string | null;
  deal_contract_role: string | null;
  parent_contract_id: string | null;
};

export type DealShipment = {
  id: string;
  container: string | null;
  bl_number: string | null;
  vessel: string | null;
  eta: string | null;
  status: string | null;
};

export type CurrencyAmount = { currency: string; amount: number };

export type DealFinanceSummary = {
  purchase: CurrencyAmount[];
  sales: CurrencyAmount[];
  expenses: CurrencyAmount[];
  commissions: CurrencyAmount[];
  expectedProfit: CurrencyAmount | null;
  profitIncomplete: boolean;
  incompleteReason: string | null;
};

export type DealWorkspaceData = {
  deal: Deal;
  participants: DealParticipant[];
  products: DealProduct[];
  contracts: DealContract[];
  shipments: DealShipment[];
  finance: DealFinanceSummary;
  commissionsCount: number;
  schemaWarnings: string[];
};

export type DealFormInput = {
  title: string | null;
  status: string;
  incoterms: string | null;
  loading_port: string | null;
  destination_port: string | null;
  payment_terms: string | null;
  expected_shipment_date: string | null;
  eta: string | null;
  purchase_currency: string | null;
  sales_currency: string | null;
  purchase_value: number | null;
  sales_value: number | null;
  expected_expenses: number;
  expected_expenses_currency: string | null;
  expected_commission: number;
  expected_commission_currency: string | null;
  notes: string | null;
};

export type DealParticipantInput = {
  business_case_id: string;
  counterparty_id: string;
  role_code: string;
  notes: string | null;
};

export type DealProductInput = {
  business_case_id: string;
  product_id: string | null;
  product_description: string | null;
  size_grade: string | null;
  quantity: number;
  unit: string;
  net_weight: number | null;
  gross_weight: number | null;
  purchase_price: number | null;
  sales_price: number | null;
  purchase_currency: string | null;
  sales_currency: string | null;
};
