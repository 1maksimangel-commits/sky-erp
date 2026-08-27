import type { Contract } from "@/lib/contracts/db";

export type ContractFormInput = {
  contract_number: string;
  title: string | null;
  company_id: string | null;
  buyer_id: string | null;
  supplier_id: string | null;
  business_case_id: string | null;
  currency: string;
  amount: number | null;
  incoterms: string | null;
  contract_date: string | null;
  expiry_date: string | null;
  status: string;
};

export const emptyContractForm = (): ContractFormInput => ({
  contract_number: "",
  title: null,
  company_id: null,
  buyer_id: null,
  supplier_id: null,
  business_case_id: null,
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
    contract_number: contract.contract_number,
    title: contract.title,
    company_id: contract.company?.id ?? null,
    buyer_id: contract.buyer?.id ?? null,
    supplier_id: contract.supplier?.id ?? null,
    business_case_id: contract.business_case_id ?? null,
    currency: contract.currency ?? "USD",
    amount: contract.amount,
    incoterms: contract.incoterms,
    contract_date: contract.contract_date,
    expiry_date: contract.expiry_date,
    status: contract.status ?? "Draft",
  };
}
