import {
  DEAL_PARTICIPANT_ROLES,
  DEAL_STATUSES,
  type DealFormInput,
  type DealParticipantInput,
  type DealProductInput,
} from "@/lib/deals/types";
import { currency, uuid } from "@/lib/core/validation";

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
  if (!input || !uuid.safeParse(input.business_case_id).success || (input.product_id && !uuid.safeParse(input.product_id).success)) return "Select valid Deal and Product IDs.";
  for (const code of [input.purchase_currency, input.sales_currency]) {
    if (code != null && !currency.safeParse(code).success) return "Use valid three-letter currency codes.";
  }
  if (input.gross_weight != null && input.net_weight != null && input.gross_weight < input.net_weight) return "Gross weight cannot be below net weight.";
  if (!input.business_case_id.trim()) return "Deal is required.";
  if (!input.product_id?.trim() && !input.product_description?.trim()) {
    return "Select a product or enter a product description.";
  }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0 || input.quantity > 1_000_000_000) {
    return "Quantity must be greater than zero.";
  }
  if (typeof input.unit !== "string" || !input.unit.trim()) return "Unit is required.";
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
