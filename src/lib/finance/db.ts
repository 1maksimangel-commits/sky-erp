import { createClient } from "@/lib/supabase/server";
import { toNumber } from "@/lib/finance/format";

export type FinanceParty = { id: string; legal_name: string } | null;
export type FinanceCompany = { id: string; name: string } | null;

export type FinanceInvoice = {
  id: string;
  invoice_number: string;
  invoice_type: string | null;
  contract_id: string;
  business_case_id: string | null;
  company_id: string | null;
  buyer_id: string | null;
  supplier_id: string | null;
  currency: string | null;
  amount: number;
  paid_amount: number;
  outstanding: number;
  tax_amount: number;
  subtotal: number;
  tax_rate: number;
  status: string | null;
  issue_date: string | null;
  due_date: string | null;
  payment_terms: string | null;
  notes: string | null;
  created_at: string | null;
  contract: { id: string; contract_number: string } | null;
  business_case: { id: string; case_number: string } | null;
  company: FinanceCompany;
  buyer: FinanceParty;
  supplier: FinanceParty;
};

export type FinancePayment = {
  id: string;
  payment_date: string | null;
  invoice_id: string | null;
  business_case_id: string | null;
  contract_id: string | null;
  bank_account_id: string | null;
  amount: number;
  currency: string | null;
  reference: string | null;
  status: string | null;
  notes: string | null;
  invoice: { id: string; invoice_number: string } | null;
  business_case: { id: string; case_number: string } | null;
  contract: { id: string; contract_number: string } | null;
  bank_account: { id: string; name: string } | null;
};

export type BankAccount = {
  id: string;
  company_id: string;
  name: string;
  bank_name: string | null;
  account_number: string | null;
  iban: string | null;
  swift: string | null;
  currency: string;
  opening_balance: number;
  current_balance: number;
  is_active: boolean;
  company: FinanceCompany;
};

export type ExchangeRate = {
  id: string;
  base_currency: string;
  quote_currency: string;
  rate: number;
  rate_date: string;
  source: string | null;
};

export type FinanceDashboardStats = {
  totalRevenue: number;
  accountsReceivable: number;
  accountsPayable: number;
  cash: number;
  bankBalance: number;
  expenses: number;
  profit: number;
  overduePayments: number;
};

export type FinanceReportBundle = {
  accountsReceivable: FinanceInvoice[];
  accountsPayable: FinanceInvoice[];
  cashFlow: { label: string; inflow: number; outflow: number; net: number }[];
  profitByBusinessCase: {
    id: string;
    label: string;
    revenue: number;
    expenses: number;
    profit: number;
  }[];
  profitByContract: {
    id: string;
    label: string;
    revenue: number;
    expenses: number;
    profit: number;
  }[];
  revenueByCustomer: { id: string; label: string; revenue: number }[];
  expensesBySupplier: { id: string; label: string; expenses: number }[];
};

const MISSING_SCHEMA_HINT =
  "Finance schema is incomplete. Apply supabase/migrations/20260804180000_finance_module.sql (and 20260805050000_payments_business_case_id.sql if payments.business_case_id is missing) in the Supabase SQL Editor, then reload the API schema.";

function formatLoadError(message: string): string {
  if (
    /currencies|exchange_rates|bank_accounts|invoice_items|payment_allocations|expenses|invoice_type|business_case_id|schema cache|does not exist|PGRST205|42703/i.test(
      message
    )
  ) {
    return MISSING_SCHEMA_HINT;
  }
  return message || "Unable to load finance data from Supabase.";
}

function firstRel<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function resolveInvoiceStatus(
  status: string | null,
  dueDate: string | null,
  outstanding: number
): string {
  if (status === "Cancelled" || status === "Paid" || status === "Draft") {
    return status;
  }
  if (
    outstanding > 0 &&
    dueDate &&
    new Date(`${dueDate}T00:00:00`) < new Date(new Date().toDateString())
  ) {
    return "Overdue";
  }
  return status ?? "Draft";
}

type InvoiceRow = {
  id: string;
  invoice_number: string;
  invoice_type: string | null;
  contract_id: string;
  business_case_id: string | null;
  company_id: string | null;
  buyer_id: string | null;
  supplier_id: string | null;
  currency: string | null;
  amount: number | string | null;
  paid_amount: number | string | null;
  outstanding: number | string | null;
  tax_amount: number | string | null;
  subtotal: number | string | null;
  tax_rate: number | string | null;
  status: string | null;
  issue_date: string | null;
  due_date: string | null;
  payment_terms: string | null;
  notes: string | null;
  created_at: string | null;
  contract: { id: string; contract_number: string } | { id: string; contract_number: string }[] | null;
  business_case: { id: string; case_number: string } | { id: string; case_number: string }[] | null;
  company: { id: string; name: string } | { id: string; name: string }[] | null;
  buyer: { id: string; legal_name: string } | { id: string; legal_name: string }[] | null;
  supplier: { id: string; legal_name: string } | { id: string; legal_name: string }[] | null;
};

function normalizeInvoice(row: InvoiceRow): FinanceInvoice {
  const outstanding = toNumber(row.outstanding);
  const status = resolveInvoiceStatus(row.status, row.due_date, outstanding);

  return {
    id: row.id,
    invoice_number: row.invoice_number,
    invoice_type: row.invoice_type,
    contract_id: row.contract_id,
    business_case_id: row.business_case_id,
    company_id: row.company_id,
    buyer_id: row.buyer_id,
    supplier_id: row.supplier_id,
    currency: row.currency,
    amount: toNumber(row.amount),
    paid_amount: toNumber(row.paid_amount),
    outstanding,
    tax_amount: toNumber(row.tax_amount),
    subtotal: toNumber(row.subtotal),
    tax_rate: toNumber(row.tax_rate),
    status,
    issue_date: row.issue_date,
    due_date: row.due_date,
    payment_terms: row.payment_terms,
    notes: row.notes,
    created_at: row.created_at,
    contract: firstRel(row.contract),
    business_case: firstRel(row.business_case),
    company: firstRel(row.company),
    buyer: firstRel(row.buyer),
    supplier: firstRel(row.supplier),
  };
}

const invoiceSelect = `
  id, invoice_number, invoice_type, contract_id, business_case_id, company_id,
  buyer_id, supplier_id, currency, amount, paid_amount, outstanding, tax_amount,
  subtotal, tax_rate, status, issue_date, due_date, payment_terms, notes, created_at,
  contract:contract_id ( id, contract_number ),
  business_case:business_case_id ( id, case_number ),
  company:company_id ( id, name ),
  buyer:buyer_id ( id, legal_name ),
  supplier:supplier_id ( id, legal_name )
`;

const paymentSelect = `
  id, payment_date, invoice_id, business_case_id, contract_id, bank_account_id,
  amount, currency, reference, status, notes,
  invoice:invoice_id ( id, invoice_number ),
  business_case:business_case_id ( id, case_number ),
  contract:contract_id ( id, contract_number ),
  bank_account:bank_account_id ( id, name )
`;

type PaymentRow = {
  id: string;
  payment_date: string | null;
  invoice_id: string | null;
  business_case_id: string | null;
  contract_id: string | null;
  bank_account_id: string | null;
  amount: number | string | null;
  currency: string | null;
  reference: string | null;
  status: string | null;
  notes: string | null;
  invoice: { id: string; invoice_number: string } | { id: string; invoice_number: string }[] | null;
  business_case: { id: string; case_number: string } | { id: string; case_number: string }[] | null;
  contract: { id: string; contract_number: string } | { id: string; contract_number: string }[] | null;
  bank_account: { id: string; name: string } | { id: string; name: string }[] | null;
};

function normalizePayment(row: PaymentRow): FinancePayment {
  return {
    id: row.id,
    payment_date: row.payment_date,
    invoice_id: row.invoice_id,
    business_case_id: row.business_case_id,
    contract_id: row.contract_id,
    bank_account_id: row.bank_account_id,
    amount: toNumber(row.amount),
    currency: row.currency,
    reference: row.reference,
    status: row.status,
    notes: row.notes,
    invoice: firstRel(row.invoice),
    business_case: firstRel(row.business_case),
    contract: firstRel(row.contract),
    bank_account: firstRel(row.bank_account),
  };
}

export async function getFinanceInvoices(): Promise<
  { data: FinanceInvoice[]; error: null } | { data: null; error: string }
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(invoiceSelect)
    .order("created_at", { ascending: false });

  if (error) {
    return { data: null, error: formatLoadError(error.message) };
  }

  return {
    data: ((data ?? []) as unknown as InvoiceRow[]).map(normalizeInvoice),
    error: null,
  };
}

export async function getFinanceInvoiceById(
  id: string
): Promise<{ data: FinanceInvoice; error: null } | { data: null; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(invoiceSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { data: null, error: formatLoadError(error.message) };
  }

  if (!data) {
    return { data: null, error: "Invoice not found." };
  }

  return {
    data: normalizeInvoice(data as unknown as InvoiceRow),
    error: null,
  };
}

export async function getFinancePayments(): Promise<
  { data: FinancePayment[]; error: null } | { data: null; error: string }
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select(paymentSelect)
    .order("payment_date", { ascending: false, nullsFirst: false });

  if (error) {
    return { data: null, error: formatLoadError(error.message) };
  }

  return {
    data: ((data ?? []) as unknown as PaymentRow[]).map(normalizePayment),
    error: null,
  };
}

export async function getFinancePaymentById(
  id: string
): Promise<{ data: FinancePayment; error: null } | { data: null; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select(paymentSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { data: null, error: formatLoadError(error.message) };
  }

  if (!data) {
    return { data: null, error: "Payment not found." };
  }

  return {
    data: normalizePayment(data as unknown as PaymentRow),
    error: null,
  };
}

export async function getBankAccounts(): Promise<
  { data: BankAccount[]; error: null } | { data: null; error: string }
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_accounts")
    .select(
      `
      id, company_id, name, bank_name, account_number, iban, swift,
      currency, opening_balance, current_balance, is_active,
      company:company_id ( id, name )
    `
    )
    .order("name");

  if (error) {
    return { data: null, error: formatLoadError(error.message) };
  }

  type Row = {
    id: string;
    company_id: string;
    name: string;
    bank_name: string | null;
    account_number: string | null;
    iban: string | null;
    swift: string | null;
    currency: string;
    opening_balance: number | string | null;
    current_balance: number | string | null;
    is_active: boolean;
    company: { id: string; name: string } | { id: string; name: string }[] | null;
  };

  return {
    data: ((data ?? []) as unknown as Row[]).map((row) => ({
      id: row.id,
      company_id: row.company_id,
      name: row.name,
      bank_name: row.bank_name,
      account_number: row.account_number,
      iban: row.iban,
      swift: row.swift,
      currency: row.currency,
      opening_balance: toNumber(row.opening_balance),
      current_balance: toNumber(row.current_balance),
      is_active: row.is_active,
      company: firstRel(row.company),
    })),
    error: null,
  };
}

export async function getExchangeRates(): Promise<
  { data: ExchangeRate[]; error: null } | { data: null; error: string }
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exchange_rates")
    .select("id, base_currency, quote_currency, rate, rate_date, source")
    .order("rate_date", { ascending: false })
    .order("quote_currency");

  if (error) {
    return { data: null, error: formatLoadError(error.message) };
  }

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      base_currency: row.base_currency,
      quote_currency: row.quote_currency,
      rate: toNumber(row.rate),
      rate_date: row.rate_date,
      source: row.source,
    })),
    error: null,
  };
}

export async function getFinanceDashboardStats(): Promise<
  | { data: FinanceDashboardStats; error: null }
  | { data: null; error: string }
> {
  const supabase = await createClient();

  const [invoicesResult, banksResult, expensesResult] = await Promise.all([
    supabase
      .from("invoices")
      .select("invoice_type, amount, outstanding, status, due_date, currency"),
    supabase.from("bank_accounts").select("current_balance, is_active"),
    supabase.from("expenses").select("amount, status"),
  ]);

  if (invoicesResult.error) {
    return { data: null, error: formatLoadError(invoicesResult.error.message) };
  }
  if (banksResult.error) {
    return { data: null, error: formatLoadError(banksResult.error.message) };
  }
  if (expensesResult.error) {
    return { data: null, error: formatLoadError(expensesResult.error.message) };
  }

  let totalRevenue = 0;
  let accountsReceivable = 0;
  let accountsPayable = 0;
  let overduePayments = 0;

  for (const invoice of invoicesResult.data ?? []) {
    const type = invoice.invoice_type ?? "Sales Invoice";
    const amount = toNumber(invoice.amount);
    const outstanding = toNumber(invoice.outstanding);
    const status = resolveInvoiceStatus(
      invoice.status,
      invoice.due_date,
      outstanding
    );

    if (status === "Cancelled") continue;

    if (type === "Sales Invoice" || type === "Proforma Invoice") {
      totalRevenue += amount;
      accountsReceivable += outstanding;
    }

    if (type === "Purchase Invoice") {
      accountsPayable += outstanding;
    }

    if (type === "Credit Note") {
      totalRevenue -= amount;
    }

    if (status === "Overdue") {
      overduePayments += 1;
    }
  }

  const bankBalance = (banksResult.data ?? [])
    .filter((item) => item.is_active)
    .reduce((sum, item) => sum + toNumber(item.current_balance), 0);

  const expenses = (expensesResult.data ?? [])
    .filter((item) => (item.status ?? "Posted") !== "Cancelled")
    .reduce((sum, item) => sum + toNumber(item.amount), 0);

  const cash = bankBalance;
  const profit = totalRevenue - expenses;

  return {
    data: {
      totalRevenue,
      accountsReceivable,
      accountsPayable,
      cash,
      bankBalance,
      expenses,
      profit,
      overduePayments,
    },
    error: null,
  };
}

export async function getFinanceReports(): Promise<
  | { data: FinanceReportBundle; error: null }
  | { data: null; error: string }
> {
  const [invoicesResult, paymentsResult, expensesResult] = await Promise.all([
    getFinanceInvoices(),
    getFinancePayments(),
    (async () => {
      const supabase = await createClient();
      return supabase
        .from("expenses")
        .select(
          `
          id, amount, currency, status, business_case_id, contract_id, supplier_id,
          business_case:business_case_id ( id, case_number ),
          contract:contract_id ( id, contract_number ),
          supplier:supplier_id ( id, legal_name )
        `
        );
    })(),
  ]);

  if (invoicesResult.error || !invoicesResult.data) {
    return { data: null, error: invoicesResult.error ?? "Unable to load invoices." };
  }
  if (paymentsResult.error || !paymentsResult.data) {
    return { data: null, error: paymentsResult.error ?? "Unable to load payments." };
  }
  if (expensesResult.error) {
    return { data: null, error: formatLoadError(expensesResult.error.message) };
  }

  const invoices = invoicesResult.data;
  const payments = paymentsResult.data;

  const accountsReceivable = invoices.filter(
    (item) =>
      (item.invoice_type === "Sales Invoice" ||
        item.invoice_type === "Proforma Invoice") &&
      item.outstanding > 0 &&
      item.status !== "Cancelled"
  );

  const accountsPayable = invoices.filter(
    (item) =>
      item.invoice_type === "Purchase Invoice" &&
      item.outstanding > 0 &&
      item.status !== "Cancelled"
  );

  const monthMap = new Map<string, { inflow: number; outflow: number }>();
  for (const payment of payments) {
    if (!payment.payment_date || payment.status === "Cancelled") continue;
    const key = payment.payment_date.slice(0, 7);
    const current = monthMap.get(key) ?? { inflow: 0, outflow: 0 };
    const invoice = invoices.find((item) => item.id === payment.invoice_id);
    if (invoice?.invoice_type === "Purchase Invoice") {
      current.outflow += payment.amount;
    } else {
      current.inflow += payment.amount;
    }
    monthMap.set(key, current);
  }

  const cashFlow = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([label, value]) => ({
      label,
      inflow: value.inflow,
      outflow: value.outflow,
      net: value.inflow - value.outflow,
    }));

  type ExpenseRow = {
    amount: number | string | null;
    status: string | null;
    business_case_id: string | null;
    contract_id: string | null;
    supplier_id: string | null;
    business_case: { id: string; case_number: string } | { id: string; case_number: string }[] | null;
    contract: { id: string; contract_number: string } | { id: string; contract_number: string }[] | null;
    supplier: { id: string; legal_name: string } | { id: string; legal_name: string }[] | null;
  };

  const expenses = (expensesResult.data ?? []) as unknown as ExpenseRow[];

  const bcMap = new Map<string, { label: string; revenue: number; expenses: number }>();
  const contractMap = new Map<string, { label: string; revenue: number; expenses: number }>();
  const customerMap = new Map<string, { label: string; revenue: number }>();
  const supplierMap = new Map<string, { label: string; expenses: number }>();

  for (const invoice of invoices) {
    if (invoice.status === "Cancelled") continue;
    const isSales =
      invoice.invoice_type === "Sales Invoice" ||
      invoice.invoice_type === "Proforma Invoice";
    const isCredit = invoice.invoice_type === "Credit Note";
    const signed = isCredit ? -invoice.amount : invoice.amount;

    if (invoice.business_case_id && (isSales || isCredit)) {
      const key = invoice.business_case_id;
      const current = bcMap.get(key) ?? {
        label: invoice.business_case?.case_number ?? key,
        revenue: 0,
        expenses: 0,
      };
      current.revenue += signed;
      bcMap.set(key, current);
    }

    if (invoice.contract_id && (isSales || isCredit)) {
      const key = invoice.contract_id;
      const current = contractMap.get(key) ?? {
        label: invoice.contract?.contract_number ?? key,
        revenue: 0,
        expenses: 0,
      };
      current.revenue += signed;
      contractMap.set(key, current);
    }

    if (invoice.buyer_id && (isSales || isCredit)) {
      const key = invoice.buyer_id;
      const current = customerMap.get(key) ?? {
        label: invoice.buyer?.legal_name ?? key,
        revenue: 0,
      };
      current.revenue += signed;
      customerMap.set(key, current);
    }
  }

  for (const expense of expenses) {
    if ((expense.status ?? "Posted") === "Cancelled") continue;
    const amount = toNumber(expense.amount);

    if (expense.business_case_id) {
      const bc = firstRel(expense.business_case);
      const current = bcMap.get(expense.business_case_id) ?? {
        label: bc?.case_number ?? expense.business_case_id,
        revenue: 0,
        expenses: 0,
      };
      current.expenses += amount;
      bcMap.set(expense.business_case_id, current);
    }

    if (expense.contract_id) {
      const contract = firstRel(expense.contract);
      const current = contractMap.get(expense.contract_id) ?? {
        label: contract?.contract_number ?? expense.contract_id,
        revenue: 0,
        expenses: 0,
      };
      current.expenses += amount;
      contractMap.set(expense.contract_id, current);
    }

    if (expense.supplier_id) {
      const supplier = firstRel(expense.supplier);
      const current = supplierMap.get(expense.supplier_id) ?? {
        label: supplier?.legal_name ?? expense.supplier_id,
        expenses: 0,
      };
      current.expenses += amount;
      supplierMap.set(expense.supplier_id, current);
    }
  }

  return {
    data: {
      accountsReceivable,
      accountsPayable,
      cashFlow,
      profitByBusinessCase: [...bcMap.entries()].map(([id, value]) => ({
        id,
        label: value.label,
        revenue: value.revenue,
        expenses: value.expenses,
        profit: value.revenue - value.expenses,
      })),
      profitByContract: [...contractMap.entries()].map(([id, value]) => ({
        id,
        label: value.label,
        revenue: value.revenue,
        expenses: value.expenses,
        profit: value.revenue - value.expenses,
      })),
      revenueByCustomer: [...customerMap.entries()].map(([id, value]) => ({
        id,
        label: value.label,
        revenue: value.revenue,
      })),
      expensesBySupplier: [...supplierMap.entries()].map(([id, value]) => ({
        id,
        label: value.label,
        expenses: value.expenses,
      })),
    },
    error: null,
  };
}

export type BusinessCaseProfitResult = {
  businessCaseId: string;
  revenue: number;
  expenses: number;
  profit: number;
  currency: string;
  invoiceCount: number;
  paymentCount: number;
};

/**
 * Deal-level profit for one business case (sales/credit invoices − expenses).
 * Expenses may be zero until an expense UI exists.
 */
export async function getBusinessCaseProfitResult(
  businessCaseId: string
): Promise<
  { data: BusinessCaseProfitResult; error: null } | { data: null; error: string }
> {
  if (!businessCaseId.trim()) {
    return { data: null, error: "Business case id is required." };
  }

  const supabase = await createClient();

  const [invoicesResult, expensesResult, paymentsResult] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, amount, currency, invoice_type, status")
      .eq("business_case_id", businessCaseId),
    supabase
      .from("expenses")
      .select("id, amount, status")
      .eq("business_case_id", businessCaseId),
    supabase
      .from("payments")
      .select("id, status")
      .eq("business_case_id", businessCaseId),
  ]);

  if (invoicesResult.error) {
    return { data: null, error: formatLoadError(invoicesResult.error.message) };
  }

  let expenses = 0;
  if (expensesResult.error) {
    if (
      !/expenses|schema cache|does not exist|PGRST205|42703/i.test(
        expensesResult.error.message
      )
    ) {
      return { data: null, error: formatLoadError(expensesResult.error.message) };
    }
  } else {
    for (const row of expensesResult.data ?? []) {
      if ((row.status ?? "Posted") === "Cancelled") continue;
      expenses += toNumber(row.amount);
    }
  }

  let revenue = 0;
  let currency = "USD";
  for (const invoice of invoicesResult.data ?? []) {
    if ((invoice.status ?? "") === "Cancelled") continue;
    const amount = toNumber(invoice.amount);
    const type = invoice.invoice_type ?? "";
    if (type === "Sales Invoice" || type === "Proforma Invoice") {
      revenue += amount;
      if (invoice.currency) currency = String(invoice.currency);
    } else if (type === "Credit Note") {
      revenue -= amount;
    }
  }

  let paymentCount = 0;
  if (!paymentsResult.error) {
    paymentCount = (paymentsResult.data ?? []).filter(
      (row) => (row.status ?? "") !== "Cancelled"
    ).length;
  } else if (
    !/business_case_id|42703|PGRST204|schema cache|does not exist/i.test(
      paymentsResult.error.message
    )
  ) {
    return { data: null, error: formatLoadError(paymentsResult.error.message) };
  }

  return {
    data: {
      businessCaseId,
      revenue,
      expenses,
      profit: revenue - expenses,
      currency,
      invoiceCount: (invoicesResult.data ?? []).length,
      paymentCount,
    },
    error: null,
  };
}

export type FinanceOptionBundles = {
  contracts: { id: string; contract_number: string; company_id: string | null; buyer_id: string | null; supplier_id: string | null; currency: string | null }[];
  businessCases: { id: string; case_number: string; contract_number: string | null }[];
  shipments: { id: string; container: string | null; contract_id: string | null; status: string | null }[];
  companies: { id: string; name: string }[];
  counterparties: { id: string; legal_name: string }[];
  products: { id: string; sku: string; name: string }[];
  bankAccounts: BankAccount[];
  currencies: string[];
};

export async function getFinanceOptions(): Promise<FinanceOptionBundles> {
  const supabase = await createClient();

  const [
    contracts,
    businessCases,
    shipments,
    companies,
    counterparties,
    products,
    banks,
    currencies,
  ] = await Promise.all([
    supabase
      .from("contracts")
      .select("id, contract_number, company_id, buyer_id, supplier_id, currency")
      .order("contract_number"),
    supabase
      .from("business_cases")
      .select("id, case_number, contract_number")
      .order("case_number"),
    supabase
      .from("shipments")
      .select("id, container, contract_id, status")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("companies").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("counterparties")
      .select("id, legal_name")
      .eq("is_active", true)
      .order("legal_name"),
    supabase
      .from("products")
      .select("id, sku, name")
      .eq("is_active", true)
      .order("name"),
    getBankAccounts(),
    supabase.from("currencies").select("code").eq("is_active", true).order("code"),
  ]);

  return {
    contracts: contracts.data ?? [],
    businessCases: businessCases.data ?? [],
    shipments: shipments.data ?? [],
    companies: companies.data ?? [],
    counterparties: counterparties.data ?? [],
    products: products.data ?? [],
    bankAccounts: banks.data ?? [],
    currencies: (currencies.data ?? []).map((item) => item.code),
  };
}
