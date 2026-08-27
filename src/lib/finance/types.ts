export const INVOICE_TYPES = [
  "Sales Invoice",
  "Purchase Invoice",
  "Proforma Invoice",
  "Credit Note",
] as const;

export const INVOICE_STATUSES = [
  "Draft",
  "Issued",
  "Partially Paid",
  "Paid",
  "Cancelled",
  "Overdue",
] as const;

export const PAYMENT_STATUSES = ["Pending", "Paid", "Cancelled"] as const;

export const FINANCE_CURRENCIES = [
  "USD",
  "EUR",
  "RUB",
  "CNY",
  "JPY",
  "KRW",
  "AED",
] as const;

export type InvoiceItemInput = {
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
};

export type InvoiceFormInput = {
  invoice_number: string;
  invoice_type: string;
  contract_id: string;
  business_case_id: string | null;
  shipment_id: string | null;
  company_id: string | null;
  buyer_id: string | null;
  supplier_id: string | null;
  currency: string;
  issue_date: string | null;
  due_date: string | null;
  payment_terms: string | null;
  tax_rate: number;
  status: string;
  notes: string | null;
  items: InvoiceItemInput[];
};

export type PaymentFormInput = {
  invoice_id: string;
  amount: number;
  currency: string;
  payment_date: string | null;
  bank_account_id: string | null;
  reference: string | null;
  notes: string | null;
  status: string;
};

export type BankAccountFormInput = {
  company_id: string;
  name: string;
  bank_name: string | null;
  account_number: string | null;
  iban: string | null;
  swift: string | null;
  currency: string;
  opening_balance: number;
  is_active: boolean;
};

export type ExchangeRateFormInput = {
  base_currency: string;
  quote_currency: string;
  rate: number;
  rate_date: string;
  source: string | null;
};

export const emptyInvoiceItem = (): InvoiceItemInput => ({
  product_id: null,
  description: "",
  quantity: 1,
  unit_price: 0,
  tax_rate: 0,
});

export const emptyInvoiceForm = (): InvoiceFormInput => ({
  invoice_number: "",
  invoice_type: "Sales Invoice",
  contract_id: "",
  business_case_id: null,
  shipment_id: null,
  company_id: null,
  buyer_id: null,
  supplier_id: null,
  currency: "USD",
  issue_date: new Date().toISOString().slice(0, 10),
  due_date: null,
  payment_terms: null,
  tax_rate: 0,
  status: "Draft",
  notes: null,
  items: [emptyInvoiceItem()],
});

export const emptyPaymentForm = (): PaymentFormInput => ({
  invoice_id: "",
  amount: 0,
  currency: "USD",
  payment_date: new Date().toISOString().slice(0, 10),
  bank_account_id: null,
  reference: null,
  notes: null,
  status: "Paid",
});

export const emptyBankAccountForm = (): BankAccountFormInput => ({
  company_id: "",
  name: "",
  bank_name: null,
  account_number: null,
  iban: null,
  swift: null,
  currency: "USD",
  opening_balance: 0,
  is_active: true,
});

export const emptyExchangeRateForm = (): ExchangeRateFormInput => ({
  base_currency: "USD",
  quote_currency: "EUR",
  rate: 1,
  rate_date: new Date().toISOString().slice(0, 10),
  source: null,
});
