export type BusinessCaseFormInput = {
  notes?: string | null;
  expected_shipment_date?: string | null;
  eta?: string | null;
  case_number: string;
  case_type: string | null;
  title: string | null;
  company_id: string | null;
  buyer_id: string | null;
  supplier_id: string | null;
  consignee_id: string | null;
  status: string;
  contract_number: string | null;
  contract_date: string | null;
  currency: string;
  contract_amount: number | null;
  incoterms: string | null;
};

export const emptyBusinessCaseForm = (): BusinessCaseFormInput => ({
  case_number: "",
  case_type: null,
  title: null,
  company_id: null,
  buyer_id: null,
  supplier_id: null,
  consignee_id: null,
  status: "Draft",
  contract_number: null,
  contract_date: null,
  currency: "USD",
  contract_amount: null,
  incoterms: null,
});
