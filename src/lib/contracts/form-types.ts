import type { Contract } from "@/lib/contracts/db";
import type { ContractPartyInput, ContractLineInput } from "@/lib/contracts/parties";

export type ContractFormInput = {
  parties?: ContractPartyInput[];
  product_lines?: ContractLineInput[];
  legal_snapshot?: Record<string, unknown>;
  payment_terms?: string | null;
  delivery_place?: string | null;
  destination_port?: string | null;
  loading_port?: string | null;
  expected_shipment_date?: string | null;
  contract_number: string;
  title: string | null;
  company_id: string | null;
  buyer_id: string | null;
  supplier_id: string | null;
  consignee_id: string | null;
  business_case_id: string | null;
  deal_id: string | null;
  business_role: string | null;
  currency: string;
  amount: number | null;
  incoterms: string | null;
  contract_date: string | null;
  expiry_date: string | null;
  status: string;
};

export const emptyContractForm = (): ContractFormInput => ({
  parties: [],
  product_lines: [],
  contract_number: "",
  title: null,
  company_id: null,
  buyer_id: null,
  supplier_id: null,
  consignee_id: null,
  business_case_id: null,
  deal_id: null,
  business_role: null,
  currency: "USD",
  amount: null,
  incoterms: null,
  contract_date: null,
  expiry_date: null,
  status: "Draft",
});

export const CONTRACT_STATUSES = [
  "Draft",
  "Active",
  "Closed",
  "Cancelled",
] as const;

export function contractToFormInput(contract: Contract): ContractFormInput {
  return {
    parties: contract.parties,
    product_lines: contract.product_lines,
    legal_snapshot: contract.legal_snapshot,
    payment_terms: contract.payment_terms,
    delivery_place: contract.delivery_place,
    destination_port: contract.destination_port,
    loading_port: contract.loading_port,
    expected_shipment_date: contract.expected_shipment_date,
    contract_number: contract.contract_number,
    title: contract.title,
    company_id: contract.company_id,
    buyer_id: contract.buyer?.id ?? null,
    supplier_id: contract.supplier?.id ?? null,
    consignee_id: contract.consignee?.id ?? null,
    business_case_id: contract.business_case_id ?? null,
    deal_id: contract.deal_id ?? contract.business_case_id ?? null,
    business_role: contract.business_role ?? null,
    currency: contract.currency ?? "USD",
    amount: contract.amount,
    incoterms: contract.incoterms,
    contract_date: contract.contract_date,
    expiry_date: contract.expiry_date,
    status: contract.status ?? "Draft",
  };
}
