import {
  DEAL_PARTICIPANT_ROLES,
  DEAL_STATUSES,
  type CurrencyAmount,
  type DealFinanceSummary,
  type DealContract,
  type DealFormInput,
  type DealParticipantInput,
  type DealProduct,
  type DealProductInput,
} from "@/lib/deals/types";

export function isDealStatus(value: string): boolean {
  return DEAL_STATUSES.includes(value as (typeof DEAL_STATUSES)[number]);
}

export function validateDealForm(input: DealFormInput): string | null {
  if (!isDealStatus(input.status)) return "Select a valid Deal status.";
  const amounts = [
    input.purchase_value,
    input.sales_value,
    input.expected_expenses,
    input.expected_commission,
  ];
  if (amounts.some((value) => value != null && (!Number.isFinite(value) || value < 0))) {
    return "Deal financial values must be non-negative numbers.";
  }
  if (input.expected_expenses > 0 && !input.expected_expenses_currency?.trim()) {
    return "Expected expense currency is required when expenses are entered.";
  }
  if (input.expected_commission > 0 && !input.expected_commission_currency?.trim()) {
    return "Expected commission currency is required when commission is entered.";
  }
  return null;
}

export function validateDealParticipant(input: DealParticipantInput): string | null {
  if (!input.business_case_id.trim() || !input.counterparty_id.trim()) {
    return "Deal and counterparty are required.";
  }
  if (!/^[a-z][a-z0-9_]*$/.test(input.role_code)) {
    return "Participant role must use lowercase letters, numbers, or underscores.";
  }
  if (
    !DEAL_PARTICIPANT_ROLES.includes(
      input.role_code as (typeof DEAL_PARTICIPANT_ROLES)[number]
    )
  ) {
    return "Select a supported participant role.";
  }
  return null;
}

export function validateDealProduct(input: DealProductInput): string | null {
  if (!input.business_case_id.trim()) return "Deal is required.";
  if (!input.product_id?.trim() && !input.product_description?.trim()) {
    return "Select a product or enter a product description.";
  }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    return "Quantity must be greater than zero.";
  }
  if (!input.unit.trim()) return "Unit is required.";
  for (const value of [
    input.net_weight,
    input.gross_weight,
    input.purchase_price,
    input.sales_price,
  ]) {
    if (value != null && (!Number.isFinite(value) || value < 0)) {
      return "Weights and prices must be non-negative numbers.";
    }
  }
  if (input.purchase_price != null && !input.purchase_currency?.trim()) {
    return "Purchase currency is required with a purchase price.";
  }
  if (input.sales_price != null && !input.sales_currency?.trim()) {
    return "Sales currency is required with a sales price.";
  }
  return null;
}

function addAmount(map: Map<string, number>, currency: string | null, amount: number | null) {
  if (!currency?.trim() || amount == null || !Number.isFinite(amount)) return;
  const code = currency.trim().toUpperCase();
  map.set(code, (map.get(code) ?? 0) + amount);
}

function asAmounts(map: Map<string, number>): CurrencyAmount[] {
  return [...map.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export function buildExpectedFinanceSummary(input: {
  products: DealProduct[];
  linkedContracts?: DealContract[];
  purchaseValue: number | null;
  purchaseCurrency: string | null;
  salesValue: number | null;
  salesCurrency: string | null;
  expectedExpenses: number;
  expectedExpensesCurrency: string | null;
  expectedCommission: number;
  expectedCommissionCurrency: string | null;
  linkedCommissions: CurrencyAmount[];
}): DealFinanceSummary {
  const purchase = new Map<string, number>();
  const sales = new Map<string, number>();
  const expenses = new Map<string, number>();
  const commissions = new Map<string, number>();

  if (input.purchaseValue != null) {
    addAmount(purchase, input.purchaseCurrency, input.purchaseValue);
  } else if (input.linkedContracts?.length) {
    for (const contract of input.linkedContracts) {
      if (["purchase", "Purchase"].includes(contract.deal_contract_role ?? "")) addAmount(purchase, contract.currency, contract.amount);
    }
  } else {
    for (const line of input.products) {
      addAmount(
        purchase,
        line.purchase_currency,
        line.purchase_price == null ? null : line.purchase_price * line.quantity
      );
    }
  }

  if (input.salesValue != null) {
    addAmount(sales, input.salesCurrency, input.salesValue);
  } else if (input.linkedContracts?.length) {
    for (const contract of input.linkedContracts) {
      if (["sales", "Sale"].includes(contract.deal_contract_role ?? "")) addAmount(sales, contract.currency, contract.amount);
    }
  } else {
    for (const line of input.products) {
      addAmount(
        sales,
        line.sales_currency,
        line.sales_price == null ? null : line.sales_price * line.quantity
      );
    }
  }

  addAmount(expenses, input.expectedExpensesCurrency, input.expectedExpenses);
  if (input.linkedCommissions.length) {
    for (const item of input.linkedCommissions) {
      addAmount(commissions, item.currency, item.amount);
    }
  } else {
    addAmount(
      commissions,
      input.expectedCommissionCurrency,
      input.expectedCommission
    );
  }

  const purchaseAmounts = asAmounts(purchase);
  const salesAmounts = asAmounts(sales);
  const expenseAmounts = asAmounts(expenses);
  const commissionAmounts = asAmounts(commissions);
  const currencies = new Set(
    [...purchaseAmounts, ...salesAmounts, ...expenseAmounts, ...commissionAmounts].map(
      (item) => item.currency
    )
  );
  const hasUnpricedPurchase = input.products.some(
    (line) => input.purchaseValue == null && line.purchase_price == null
  );
  const hasUnpricedSale = input.products.some(
    (line) => input.salesValue == null && line.sales_price == null
  );
  const missingCurrency =
    (input.purchaseValue != null && !input.purchaseCurrency) ||
    (input.salesValue != null && !input.salesCurrency) ||
    (input.expectedExpenses > 0 && !input.expectedExpensesCurrency) ||
    (input.expectedCommission > 0 && !input.expectedCommissionCurrency);

  const incomplete =
    currencies.size !== 1 || hasUnpricedPurchase || hasUnpricedSale || missingCurrency;
  let reason: string | null = null;
  if (currencies.size > 1) reason = "Multiple currencies require an explicit FX rate.";
  else if (missingCurrency) reason = "A financial value is missing its currency.";
  else if (hasUnpricedPurchase || hasUnpricedSale) reason = "One or more product lines are missing prices.";
  else if (currencies.size === 0) reason = "Enter purchase and sales values to calculate profit.";

  const currency = currencies.size === 1 ? [...currencies][0] : null;
  const sum = (items: CurrencyAmount[]) => items.reduce((total, item) => total + item.amount, 0);

  return {
    purchase: purchaseAmounts,
    sales: salesAmounts,
    expenses: expenseAmounts,
    commissions: commissionAmounts,
    expectedProfit:
      !incomplete && currency
        ? {
            currency,
            amount:
              sum(salesAmounts) -
              sum(purchaseAmounts) -
              sum(expenseAmounts) -
              sum(commissionAmounts),
          }
        : null,
    profitIncomplete: incomplete,
    incompleteReason: reason,
  };
}
