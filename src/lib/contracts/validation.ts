import type { ContractFormInput } from "@/lib/contracts/form-types";
import { CONTRACT_PARTY_ROLES } from "@/lib/contracts/parties";

export function validateContractFormInput(
  input: ContractFormInput,
  options: { allowIncompleteDraft?: boolean } = {}
): string | null {
  const incompleteDraft =
    options.allowIncompleteDraft === true &&
    input.status.trim().toLowerCase() === "draft";

  if (!incompleteDraft && !input.contract_number.trim()) {
    return "Contract number is required.";
  }

  if (!incompleteDraft && !input.company_id?.trim()) {
    return "Company is required.";
  }

  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const id of [input.company_id, input.business_case_id, input.deal_id]) {
    if (id && !uuid.test(id)) return "Invalid company or Deal reference.";
  }
  if (!/^[A-Z]{3}$/.test(input.currency)) return "Currency must be a three-letter uppercase code.";
  const parties = input.parties ?? [];
  if (!incompleteDraft && (!parties.some(p => p.role_code === "seller") || !parties.some(p => p.role_code === "buyer"))) return "Select explicit Seller and Buyer legal entities.";
  if (new Set(parties.map(p => p.role_code)).size !== parties.length) return "Each legal party role must occur once.";
  for (const party of parties) {
    if (!CONTRACT_PARTY_ROLES.includes(party.role_code)) return "Invalid legal party role.";
    if (Boolean(party.internal_company_id) === Boolean(party.counterparty_id)) return "Choose one internal Company or external Counterparty per party.";
    if (!uuid.test(party.internal_company_id || party.counterparty_id || "")) return "Invalid legal entity reference.";
    if (!party.snapshot.legal_name?.trim()) return "Each party needs its agreed legal name.";
  }
  const seller = parties.find(p => p.role_code === "seller");
  const buyer = parties.find(p => p.role_code === "buyer");
  if (seller && buyer && seller.internal_company_id === buyer.internal_company_id && seller.counterparty_id === buyer.counterparty_id) return "Seller and Buyer must be different legal entities.";
  for (const line of input.product_lines ?? []) {
    if (line.product_id && !uuid.test(line.product_id)) return "Invalid product reference.";
    if (!line.description.trim() || !line.unit.trim()) return "Each product line needs legal description and unit.";
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) return "Product quantities must be positive.";
    if (!Number.isFinite(line.unit_price) || line.unit_price < 0) return "Unit price must be finite and nonnegative.";
    if (!/^[A-Z]{3}$/.test(line.currency)) return "Invalid product line currency.";
    for (const number of [line.net_weight, line.gross_weight, line.agreed_amount]) {
      if (number != null && (!Number.isFinite(number) || number < 0)) return "Weights and agreed amounts must be finite and nonnegative.";
    }
  }

  if (!["Draft", "Active", "Closed", "Cancelled"].includes(input.status)) {
    return "Invalid Contract status.";
  }

  if (input.amount != null && (!Number.isFinite(input.amount) || input.amount < 0)) {
    return "Amount must be zero or greater.";
  }

  if (
    input.buyer_id?.trim() &&
    input.supplier_id?.trim() &&
    input.buyer_id.trim() === input.supplier_id.trim()
  ) {
    return "Buyer and supplier cannot be the same counterparty.";
  }

  return null;
}
