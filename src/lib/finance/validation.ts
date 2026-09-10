import {
  FINANCE_CURRENCIES,
  INVOICE_STATUSES,
  INVOICE_TYPES,
  PAYMENT_STATUSES,
  type BankAccountFormInput,
  type ExchangeRateFormInput,
  type InvoiceFormInput,
  type PaymentFormInput,
} from "@/lib/finance/types";
import {
  isSupportedFinanceCurrency,
  normalizeCurrencyCode,
  roundMoney,
} from "@/lib/finance/format";
import { z } from "zod";

const CURRENCY_SET = new Set<string>(FINANCE_CURRENCIES);

function validateCurrency(code: string, label = "Currency"): string | null {
  const normalized = normalizeCurrencyCode(code);
  if (!normalized) return `${label} is required.`;
  if (!isSupportedFinanceCurrency(normalized)) {
    return `${label} must be a 3-letter ISO code.`;
  }
  if (!CURRENCY_SET.has(normalized)) {
    return `${label} must be one of ${FINANCE_CURRENCIES.join(", ")}.`;
  }
  return null;
}

export function validateInvoiceFormInput(input: InvoiceFormInput): string | null {
  for (const value of [input.contract_id, input.company_id, input.business_case_id, input.shipment_id, input.buyer_id, input.supplier_id, ...input.items.map(i => i.product_id)]) {
    if (value && !z.string().uuid().safeParse(value).success) return "Select valid Company, Contract, Deal and Product records.";
  }
  if (!input.invoice_number.trim()) {
    return "Invoice number is required.";
  }

  if (!input.contract_id.trim()) {
    return "Contract is required.";
  }

  if (!input.company_id?.trim()) {
    return "Company is required for every invoice.";
  }

  if (
    !INVOICE_TYPES.includes(input.invoice_type as (typeof INVOICE_TYPES)[number])
  ) {
    return "Invalid invoice type.";
  }

  if (
    !INVOICE_STATUSES.includes(input.status as (typeof INVOICE_STATUSES)[number])
  ) {
    return "Invalid invoice status.";
  }

  const currencyError = validateCurrency(input.currency);
  if (currencyError) return currencyError;

  if (input.issue_date && input.due_date && input.issue_date > input.due_date) {
    return "Issue date cannot be after due date.";
  }

  if (!input.items.length) {
    return "Add at least one invoice line.";
  }

  for (const item of input.items) {
    if (!item.description.trim()) {
      return "Each item needs a description.";
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      return "Item quantity must be greater than zero.";
    }
    if (!Number.isFinite(item.unit_price) || item.unit_price < 0) {
      return "Item unit price cannot be negative.";
    }
    if (!Number.isFinite(item.tax_rate) || item.tax_rate < 0 || item.tax_rate > 100) {
      return "Item tax rate must be between 0 and 100.";
    }
    const line = roundMoney(
      item.quantity * item.unit_price * (1 + (item.tax_rate || 0) / 100)
    );
    if (line < 0) {
      return "Item line total cannot be negative.";
    }
  }

  return null;
}

export function validatePaymentFormInput(input: PaymentFormInput): string | null {
  if (!z.string().uuid().safeParse(input.invoice_id).success || (input.bank_account_id && !z.string().uuid().safeParse(input.bank_account_id).success)) return "Select a valid Invoice and Bank Account.";
  if (!input.invoice_id.trim()) {
    return "Invoice is required.";
  }

  if (!Number.isFinite(input.amount) || roundMoney(input.amount) <= 0) {
    return "Payment amount must be greater than zero.";
  }

  const currencyError = validateCurrency(input.currency);
  if (currencyError) return currencyError;

  if (
    input.status.trim() &&
    !PAYMENT_STATUSES.includes(input.status as (typeof PAYMENT_STATUSES)[number])
  ) {
    return "Invalid payment status.";
  }

  return null;
}

export function validateBankAccountFormInput(
  input: BankAccountFormInput
): string | null {
  if (!z.string().uuid().safeParse(input.company_id).success || (input.counterparty_id && !z.string().uuid().safeParse(input.counterparty_id).success)) return "Select valid Company and Counterparty records.";
  if (!input.company_id.trim()) {
    return "Company is required.";
  }
  if (!input.name.trim()) {
    return "Account name is required.";
  }
  const currencyError = validateCurrency(input.currency);
  if (currencyError) return currencyError;
  if (!Number.isFinite(input.opening_balance)) {
    return "Opening balance must be a number.";
  }
  return null;
}

export function validateExchangeRateFormInput(
  input: ExchangeRateFormInput
): string | null {
  const baseError = validateCurrency(input.base_currency, "Base currency");
  if (baseError) return baseError;
  const quoteError = validateCurrency(input.quote_currency, "Quote currency");
  if (quoteError) return quoteError;

  const base = normalizeCurrencyCode(input.base_currency);
  const quote = normalizeCurrencyCode(input.quote_currency);

  if (base === quote && input.rate !== 1) {
    return "Same-currency rate must be 1.";
  }
  if (!Number.isFinite(input.rate) || input.rate <= 0) {
    return "Rate must be greater than zero.";
  }
  // Rate means: 1 base = rate quote (e.g. USD/CNY = 7.25).
  if (!input.rate_date) {
    return "Rate date is required.";
  }
  return null;
}
