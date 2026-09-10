"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  BankAccountFormInput,
  ExchangeRateFormInput,
  InvoiceFormInput,
  PaymentFormInput,
} from "@/lib/finance/types";
import {
  normalizeCurrencyCode,
  roundMoney,
} from "@/lib/finance/format";
import {
  validateBankAccountFormInput,
  validateExchangeRateFormInput,
  validateInvoiceFormInput,
  validatePaymentFormInput,
} from "@/lib/finance/validation";
import { recordEntityEvent } from "@/lib/platform/audit";
import { assertCan, can } from "@/lib/platform/permissions";

export type FinanceActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

function nullIfEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formatError(error: { message: string }): string {
  return (
    error.message.replace(/^ERROR:\s*/i, "").replace(/\n/g, " ") ||
    "Finance operation failed. Please try again."
  );
}

function revalidateFinance() {
  revalidatePath("/finance");
  revalidatePath("/finance/invoices");
  revalidatePath("/finance/payments");
  revalidatePath("/finance/bank-accounts");
  revalidatePath("/finance/exchange-rates");
  revalidatePath("/finance/reports");
  revalidatePath("/contracts");
}

export async function createInvoice(input: InvoiceFormInput): Promise<FinanceActionResult> {
  return saveInvoice(null, input);
}

export async function updateInvoice(id: string, input: InvoiceFormInput): Promise<FinanceActionResult> {
  return saveInvoice(id, input);
}

async function saveInvoice(id: string | null, input: InvoiceFormInput): Promise<FinanceActionResult> {
  const denied = await assertCan("finance.write");
  if (denied) return { success: false, error: denied };
  const supabase = await createClient();
  const { data: contract, error } = await supabase.from("contracts")
    .select("id, company_id, business_case_id").eq("id", input.contract_id).maybeSingle();
  if (error || !contract) return { success: false, error: error?.message ?? "Contract was not found." };
  const normalized = { ...input, company_id: input.company_id || contract.company_id,
    business_case_id: input.business_case_id || contract.business_case_id,
    currency: normalizeCurrencyCode(input.currency) };
  const invalid = validateInvoiceFormInput(normalized);
  if (invalid) return { success: false, error: invalid };
  const saved = await supabase.rpc("finance_save_invoice", {
    p_id: id, p_invoice: normalized, p_items: normalized.items,
  });
  if (saved.error) return { success: false, error: formatError(saved.error) };
  revalidateFinance();
  revalidatePath(`/contracts/${input.contract_id}`);
  return { success: true, id: saved.data };
}

export async function cancelInvoice(id: string): Promise<FinanceActionResult> {
  const denied = await assertCan("finance.write");
  if (denied) return { success: false, error: denied };
  const db = await createClient();
  const result = await db.from("invoices").update({ status: "Cancelled" }).eq("id", id).select("id").single();
  if (result.error) return { success: false, error: result.error.message };
  revalidateFinance();
  return { success: true, id: result.data.id };
}

export async function registerPayment(
  input: PaymentFormInput
): Promise<FinanceActionResult> {
  const denied = await assertCan("finance.write");
  if (denied) {
    return { success: false, error: denied };
  }

  const validationError = validatePaymentFormInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const amount = roundMoney(Number(input.amount));
  const currency = normalizeCurrencyCode(input.currency) || "USD";
  const bankAccountId = nullIfEmpty(input.bank_account_id);

  const supabase = await createClient();

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, company_id, contract_id, business_case_id, currency, outstanding, status"
    )
    .eq("id", input.invoice_id)
    .maybeSingle();

  if (invoiceError) {
    return { success: false, error: formatError(invoiceError) };
  }
  if (!invoice) {
    return { success: false, error: "Invoice was not found." };
  }
  if (/cancelled/i.test(invoice.status ?? "")) {
    return { success: false, error: "Cannot pay a cancelled invoice." };
  }

  const outstanding = roundMoney(Number(invoice.outstanding ?? 0));
  if (amount > outstanding + 0.0001) {
    return {
      success: false,
      error: `Payment exceeds outstanding balance (${outstanding}).`,
    };
  }

  const invoiceCurrency = normalizeCurrencyCode(invoice.currency) || "USD";
  if (currency !== invoiceCurrency) {
    return {
      success: false,
      error: `Payment currency (${currency}) must match invoice currency (${invoiceCurrency}).`,
    };
  }

  if (bankAccountId) {
    const { data: bankAccount, error: bankError } = await supabase
      .from("bank_accounts")
      .select("id, company_id, currency, is_active")
      .eq("id", bankAccountId)
      .maybeSingle();

    if (bankError) {
      return { success: false, error: formatError(bankError) };
    }
    if (!bankAccount) {
      return { success: false, error: "Bank account was not found." };
    }
    if (bankAccount.is_active === false) {
      return { success: false, error: "Bank account is inactive." };
    }
    if (
      invoice.company_id &&
      bankAccount.company_id &&
      bankAccount.company_id !== invoice.company_id
    ) {
      return {
        success: false,
        error: "Bank account company must match the invoice company.",
      };
    }
  }

  const { data, error } = await supabase.rpc("finance_register_payment", {
    p_invoice_id: input.invoice_id,
    p_amount: amount,
    p_currency: currency,
    p_payment_date: nullIfEmpty(input.payment_date),
    p_bank_account_id: bankAccountId,
    p_reference: nullIfEmpty(input.reference),
    p_notes: nullIfEmpty(input.notes),
    p_status: input.status.trim() || "Paid",
  });

  if (error) {
    return { success: false, error: formatError(error) };
  }

  const paymentId = data as string;

  if (await can("platform.write", invoice.company_id)) await recordEntityEvent({
    entityType: "payment",
    entityId: paymentId,
    action: "created",
    eventType: "payment_registered",
    title: "Payment registered",
    summary: `Payment of ${amount} ${currency} registered`,
    newValue: {
      amount,
      currency,
      invoice_id: input.invoice_id,
    },
    relatedEntityType: "invoice",
    relatedEntityId: input.invoice_id,
    notify: {
      title: "Payment registered",
      body: invoice.invoice_number ?? paymentId,
      category: "finance",
      href: `/finance/payments/${paymentId}`,
    },
    fanout: [
      { entityType: "invoice", entityId: input.invoice_id },
    ],
  });

  revalidateFinance();
  return { success: true, id: paymentId };
}

export async function createBankAccount(
  input: BankAccountFormInput
): Promise<FinanceActionResult> {
  const denied = await assertCan("finance.write");
  if (denied) {
    return { success: false, error: denied };
  }

  const normalized: BankAccountFormInput = {
    ...input,
    currency: normalizeCurrencyCode(input.currency),
    opening_balance: roundMoney(Number(input.opening_balance)),
  };

  const validationError = validateBankAccountFormInput(normalized);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const supabase = await createClient();
  const opening = normalized.opening_balance;

  const { data, error } = await supabase
    .from("bank_accounts")
    .insert({
      company_id: normalized.company_id,
      counterparty_id: nullIfEmpty(normalized.counterparty_id),
      account_holder: nullIfEmpty(normalized.account_holder),
      correspondent_details: nullIfEmpty(normalized.correspondent_details),
      name: normalized.name.trim(),
      bank_name: nullIfEmpty(normalized.bank_name),
      bank_address: nullIfEmpty(normalized.bank_address),
      account_number: nullIfEmpty(normalized.account_number),
      iban: nullIfEmpty(normalized.iban),
      swift: nullIfEmpty(normalized.swift),
      currency: normalized.currency || "USD",
      opening_balance: opening,
      current_balance: opening,
      is_active: normalized.is_active,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: formatError(error) };
  }

  revalidateFinance();
  return { success: true, id: data.id };
}

export async function upsertExchangeRate(
  input: ExchangeRateFormInput
): Promise<FinanceActionResult> {
  const denied = await assertCan("finance.write");
  if (denied) {
    return { success: false, error: denied };
  }

  const normalized: ExchangeRateFormInput = {
    ...input,
    base_currency: normalizeCurrencyCode(input.base_currency),
    quote_currency: normalizeCurrencyCode(input.quote_currency),
    rate: Number(input.rate),
  };

  const validationError = validateExchangeRateFormInput(normalized);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exchange_rates")
    .upsert(
      {
        base_currency: normalized.base_currency,
        quote_currency: normalized.quote_currency,
        rate: normalized.rate,
        rate_date: normalized.rate_date,
        source: nullIfEmpty(normalized.source),
      },
      { onConflict: "base_currency,quote_currency,rate_date" }
    )
    .select("id")
    .single();

  if (error) {
    return { success: false, error: formatError(error) };
  }

  revalidateFinance();
  return { success: true, id: data.id };
}
