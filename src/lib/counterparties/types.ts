export type CounterpartyFormInput = {
  source_company_id?: string | null;
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
  authorized_signer_name: string | null;
  authorized_signer_title: string | null;
  bank_account_name: string | null;
  bank_name: string | null;
  bank_address: string | null;
  account_number: string | null;
  iban: string | null;
  swift: string | null;
  bank_currency: string | null;
  is_active: boolean;
};

export const emptyCounterpartyForm = (): CounterpartyFormInput => ({
  source_company_id: null,
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
  authorized_signer_name: null,
  authorized_signer_title: null,
  bank_account_name: null,
  bank_name: null,
  bank_address: null,
  account_number: null,
  iban: null,
  swift: null,
  bank_currency: "USD",
  is_active: true,
});

export const COUNTERPARTY_TYPES = [
  "Buyer",
  "Supplier",
  "Agent",
] as const;
