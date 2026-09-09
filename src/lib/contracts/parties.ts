/** Workspace ownership and legal identity are deliberately independent. */
export const CONTRACT_PARTY_ROLES = ["seller", "buyer", "consignee", "payer", "beneficiary", "manufacturer"] as const;
export type ContractPartyRole = typeof CONTRACT_PARTY_ROLES[number];
export type ContractPartyInput = {
  role_code: ContractPartyRole;
  internal_company_id: string | null;
  counterparty_id: string | null;
  snapshot: Record<string, string | null>;
};
export type ContractLineInput = {
  id?: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  currency: string;
  net_weight?: number | null;
  gross_weight?: number | null;
  size_grade?: string | null;
  packing?: string | null;
  origin?: string | null;
  notes?: string | null;
  agreed_amount?: number | null;
};
export function contractDirection(parties: ContractPartyInput[], companyId: string | null): "purchase-side" | "sale-side" | "not a party" | "needs review" {
  if (!parties.some(p => p.role_code === "seller") || !parties.some(p => p.role_code === "buyer")) return "needs review";
  if (!companyId) return "not a party";
  if (parties.some(p => p.role_code === "buyer" && p.internal_company_id === companyId)) return "purchase-side";
  if (parties.some(p => p.role_code === "seller" && p.internal_company_id === companyId)) return "sale-side";
  return "not a party";
}
export function partyName(parties: ContractPartyInput[], role: ContractPartyRole): string {
  return parties.find(p => p.role_code === role)?.snapshot.legal_name || "Needs party review";
}
/** No suffix stripping: ABC Ltd and ABC Inc are distinct legal names. */
export function normalizedLegalName(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en").replace(/\s+/g, " ");
}
export function exactLegalMatches<T extends { legal_name: string }>(name: string, entities: T[]): T[] {
  const normalized = normalizedLegalName(name);
  return normalized ? entities.filter(e => normalizedLegalName(e.legal_name) === normalized) : [];
}
export function contractLineAmount(line: Pick<ContractLineInput, "quantity" | "unit_price">): number {
  return Math.round((line.quantity * line.unit_price + Number.EPSILON) * 100) / 100;
}
