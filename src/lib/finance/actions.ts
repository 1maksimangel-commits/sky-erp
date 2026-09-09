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
import { assertCan } from "@/lib/platform/permissions";

export type FinanceActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

function nullIfEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formatError(error: { message: string }): string {
  if (/business_case_id/i.test(error.message)) {
    return "Finance schema is incomplete. Apply supabase/migrations/20260804180000_finance_module.sql and supabase/migrations/20260805050000_payments_business_case_id.sql in the Supabase SQL Editor.";
  }

  if (
    /currencies|exchange_rates|bank_accounts|invoice_items|payment_allocations|invoice_type|finance_register_payment|schema cache|does not exist|PGRST202|PGRST205|42703/i.test(
      error.message
    )
  ) {
    return "Finance schema is incomplete. Apply supabase/migrations/20260804180000_finance_module.sql in the Supabase SQL Editor.";
  }

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

function lineTotal(quantity: number, unitPrice: number, taxRate: number) {
  const base = roundMoney(quantity * unitPrice);
  return roundMoney(base + (base * taxRate) / 100);
}

export async function createInvoice(
  input: InvoiceFormInput
): Promise<FinanceActionResult> {
  const denied = await assertCan("finance.write");
  if (denied) {
    return { success: false, error: denied };
  }

  const supabase = await createClient();

  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select("id, company_id, business_case_id")
    .eq("id", input.contract_id)
    .maybeSingle();

  if (contractError) {
    return { success: false, error: formatError(contractError) };
  }
  if (!contract) {
    return { success: false, error: "Selected contract was not found." };
  }

  const resolvedCompanyId =
    nullIfEmpty(input.company_id) ?? nullIfEmpty(contract.company_id);
  if (!resolvedCompanyId) {
    return {
      success: false,
      error: "Company is required. Set company on the invoice or contract.",
    };
  }

  if (
    contract.company_id &&
    resolvedCompanyId !== contract.company_id
  ) {
    return {
      success: false,
      error: "Invoice company must match the selected contract company.",
    };
  }

  const resolvedBusinessCaseId =
    nullIfEmpty(input.business_case_id) ??
    nullIfEmpty(contract.business_case_id);

  if (resolvedBusinessCaseId) {
    const { data: businessCase, error: bcError } = await supabase
      .from("business_cases")
      .select("id, company_id")
      .eq("id", resolvedBusinessCaseId)
      .maybeSingle();

    if (bcError) {
      return { success: false, error: formatError(bcError) };
    }
    if (!businessCase) {
      return { success: false, error: "Selected business case was not found." };
    }
    if (
      businessCase.company_id &&
      businessCase.company_id !== resolvedCompanyId
    ) {
      return {
        success: false,
        error: "Business case company must match the invoice company.",
      };
    }
  }

  const normalizedInput: InvoiceFormInput = {
    ...input,
    company_id: resolvedCompanyId,
    business_case_id: resolvedBusinessCaseId,
    currency: normalizeCurrencyCode(input.currency),
  };

  const validationError = validateInvoiceFormInput(normalizedInput);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const items = normalizedInput.items.map((item, index) => {
    const quantity = Number(item.quantity);
    const unitPrice = roundMoney(Number(item.unit_price));
    const taxRate = Number(item.tax_rate) || 0;
    return {
      product_id: nullIfEmpty(item.product_id),
      description: item.description.trim(),
      quantity,
      unit_price: unitPrice,
      tax_rate: taxRate,
      line_total: lineTotal(quantity, unitPrice, taxRate),
      sort_order: index,
    };
  });

  const subtotal = roundMoney(
    items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
  );
  const taxAmount = roundMoney(
    items.reduce(
      (sum, item) =>
        sum + (item.quantity * item.unit_price * item.tax_rate) / 100,
      0
    )
  );
  const amount = roundMoney(subtotal + taxAmount);

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      invoice_number: normalizedInput.invoice_number.trim(),
      invoice_type: normalizedInput.invoice_type,
      contract_id: normalizedInput.contract_id,
      business_case_id: resolvedBusinessCaseId,
      shipment_id: nullIfEmpty(normalizedInput.shipment_id),
      company_id: resolvedCompanyId,
      buyer_id: nullIfEmpty(normalizedInput.buyer_id),
      supplier_id: nullIfEmpty(normalizedInput.supplier_id),
      currency: normalizeCurrencyCode(normalizedInput.currency) || "USD",
      issue_date: nullIfEmpty(normalizedInput.issue_date),
      due_date: nullIfEmpty(normalizedInput.due_date),
      payment_terms: nullIfEmpty(normalizedInput.payment_terms),
      tax_rate: normalizedInput.tax_rate || 0,
      tax_amount: taxAmount,
      subtotal,
      amount,
      paid_amount: 0,
      outstanding: amount,
      status: normalizedInput.status,
      notes: nullIfEmpty(normalizedInput.notes),
      updated_at: new Date().toISOString(),
    })
    .select("id, contract_id, business_case_id, shipment_id, invoice_number, status")
    .single();

  if (error) {
    return { success: false, error: formatError(error) };
  }

  const { error: itemsError } = await supabase.from("invoice_items").insert(
    items.map((item) => ({
      ...item,
      invoice_id: invoice.id,
    }))
  );

  if (itemsError) {
    await supabase.from("invoices").delete().eq("id", invoice.id);
    return { success: false, error: formatError(itemsError) };
  }

  const issued = !/draft/i.test(invoice.status ?? "");
  await recordEntityEvent({
    entityType: "invoice",
    entityId: invoice.id,
    action: "created",
    eventType: issued ? "invoice_issued" : "invoice_created",
    title: issued ? "Invoice issued" : "Invoice created",
    summary: `Invoice ${invoice.invoice_number} created`,
    newValue: {
      invoice_number: invoice.invoice_number,
      amount,
      status: invoice.status,
    },
    notify: {
      title: issued ? "Invoice issued" : "Invoice created",
      body: invoice.invoice_number,
      category: "finance",
      href: `/finance/invoices/${invoice.id}`,
    },
    fanout: [
      ...(invoice.contract_id
        ? [{ entityType: "contract", entityId: invoice.contract_id as string }]
        : []),
      ...(invoice.business_case_id
        ? [
            {
              entityType: "business_case",
              entityId: invoice.business_case_id as string,
            },
          ]
        : []),
      ...(invoice.shipment_id
        ? [{ entityType: "shipment", entityId: invoice.shipment_id as string }]
        : []),
    ],
  });

  revalidateFinance();
  if (invoice.contract_id) {
    revalidatePath(`/contracts/${invoice.contract_id}/finance`);
  }

  return { success: true, id: invoice.id };
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

  if (invoice.contract_id && invoice.company_id) {
    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select("id, company_id")
      .eq("id", invoice.contract_id)
      .maybeSingle();

    if (contractError) {
      return { success: false, error: formatError(contractError) };
    }
    if (
      contract?.company_id &&
      contract.company_id !== invoice.company_id
    ) {
      return {
        success: false,
        error: "Invoice is linked to a contract owned by another company.",
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

  await recordEntityEvent({
    entityType: "payment",
    entityId: paymentId,
    action: "created",
    eventType: "payment_received",
    title: "Payment received",
    summary: `Payment of ${amount} ${currency} registered`,
    newValue: {
      amount,
      currency,
      invoice_id: input.invoice_id,
    },
    relatedEntityType: "invoice",
    relatedEntityId: input.invoice_id,
    notify: {
      title: "Payment received",
      body: invoice.invoice_number ?? paymentId,
      category: "finance",
      href: `/finance/payments/${paymentId}`,
    },
    fanout: [
      { entityType: "invoice", entityId: input.invoice_id },
      ...(invoice.contract_id
        ? [{ entityType: "contract", entityId: invoice.contract_id }]
        : []),
      ...(invoice.business_case_id
        ? [
            {
              entityType: "business_case",
              entityId: invoice.business_case_id,
            },
          ]
        : []),
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
    opening_balance: roundMoney(Number(input.opening_balance) || 0),
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
