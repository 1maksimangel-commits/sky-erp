export type CounterpartyFormInput = {
  code: string;
  legal_name: string;
  short_name: string | null;
  counterparty_type: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  tax_id: string | null;
  registration_number: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  is_active: boolean;
};

export const emptyCounterpartyForm = (): CounterpartyFormInput => ({
  code: "",
  legal_name: "",
  short_name: null,
  counterparty_type: null,
  country: null,
  city: null,
  address: null,
  tax_id: null,
  registration_number: null,
  email: null,
  phone: null,
  website: null,
  is_active: true,
});

export const COUNTERPARTY_TYPES = [
  "Buyer",
  "Supplier",
  "Consignee",
  "Agent",
  "Bank",
  "Other",
] as const;
