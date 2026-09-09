/** Stable document vocabulary; legal parties never derive from workspace ownership. */
export const PARTY_FIELDS = ["legal_name", "name", "address", "registration_number", "tax_number", "bank_details", "bank.name", "bank.account", "bank.swift", "bank.address", "signatory.name", "signatory.title"];
export const PRODUCT_FIELDS = ["number", "name", "description", "quantity", "unit", "net_weight", "gross_weight", "unit_price", "currency", "amount", "origin", "packing", "size_grade", "notes"];
export const CANONICAL_KEYS = [
  "seller", "buyer", "consignee", "payer", "beneficiary", "manufacturer",
  ...["seller", "buyer", "consignee", "payer", "beneficiary", "manufacturer"].flatMap(role => PARTY_FIELDS.map(field => `${role}.${field}`)),
  ...PRODUCT_FIELDS.map(field => `product.${field}`),
  "contract.number", "contract.date", "contract.currency", "deal.number", "deal.title",
  "document.number", "document.date", "invoice.number", "invoice.date", "supplement.number", "supplement.date", "supplement.reference",
  "commercial.currency", "commercial.incoterms", "commercial.delivery_place", "commercial.payment_terms", "commercial.delivery_terms", "commercial.price", "incoterms",
  "calculated.subtotal", "calculated.total", "calculated.total_net_weight", "calculated.total_gross_weight", "manual.notes", "products",
];
export function variableLabel(key: string): string {
  return key.split(".").map(part => part.replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase())).join(" → ");
}
export function isCanonicalVariable(key: string): boolean { return CANONICAL_KEYS.includes(key); }
export function scalarAt(data: Record<string, unknown>, key: string): string | number | boolean {
  const value = key.split(".").reduce<unknown>((current, field) => current && typeof current === "object" && Object.hasOwn(current, field) ? (current as Record<string, unknown>)[field] : undefined, data);
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : "";
}
