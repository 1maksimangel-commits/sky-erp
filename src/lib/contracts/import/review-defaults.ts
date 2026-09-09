import { asNumber, asString, type ContractExtractionResult } from "@/lib/ai/contracts/schema";
import { exactLegalMatches, type ContractPartyInput, type ContractLineInput } from "@/lib/contracts/parties";
import type { Company } from "@/lib/companies";
import type { Counterparty } from "@/lib/counterparties";

export function extractedLegalParties(extraction: ContractExtractionResult, companies: Company[], counterparties: Counterparty[]): ContractPartyInput[] {
  const entities = [
    ...companies.map(c => ({ legal_name: c.name, internal_company_id: c.id, counterparty_id: null })),
    ...counterparties.map(c => ({ legal_name: c.legal_name, internal_company_id: null, counterparty_id: c.id })),
  ];
  const candidates = [
    { role_code: "seller" as const, legal_name: asString(extraction.seller?.legal_name), address: asString(extraction.seller?.address), registration_number: asString(extraction.seller?.registration_number), tax_id: asString(extraction.seller?.tax_id), bank_details: asString(extraction.seller?.bank_details) },
    { role_code: "buyer" as const, legal_name: asString(extraction.buyer.buyer_legal_name), address: asString(extraction.buyer.buyer_address), registration_number: asString(extraction.buyer.buyer_registration_number), tax_id: asString(extraction.buyer.buyer_tax_id), bank_details: asString(extraction.buyer.buyer_bank_details) },
    { role_code: "consignee" as const, legal_name: asString(extraction.consignee.consignee_legal_name), address: asString(extraction.consignee.consignee_address), registration_number: null, tax_id: null, bank_details: null },
    ...(["payer", "beneficiary"] as const).map(role_code => ({ role_code, legal_name: asString(extraction[role_code]?.legal_name), address: asString(extraction[role_code]?.address), registration_number: asString(extraction[role_code]?.registration_number), tax_id: asString(extraction[role_code]?.tax_id), bank_details: asString(extraction[role_code]?.bank_details) })),
  ];
  return candidates.flatMap(({ role_code, ...snapshot }) => {
    const matches = exactLegalMatches(snapshot.legal_name ?? "", entities);
    if (matches.length !== 1) return [];
    return [{ role_code, internal_company_id: matches[0].internal_company_id, counterparty_id: matches[0].counterparty_id, snapshot }];
  });
}
export function extractedLegalLines(extraction: ContractExtractionResult): ContractLineInput[] {
  return extraction.products.map(line => ({
    product_id: null, description: asString(line.description) || asString(line.product_name) || "",
    quantity: asNumber(line.quantity) ?? 0, unit: asString(line.quantity_unit) ?? "",
    unit_price: asNumber(line.unit_price) ?? 0,
    currency: (asString(line.currency) || asString(extraction.commercial.currency) || "").toUpperCase(),
    net_weight: asNumber(line.net_weight_kg), gross_weight: asNumber(line.gross_weight_kg),
    agreed_amount: asNumber(line.line_amount), size_grade: asString(line.size),
    packing: asString(line.packaging), origin: asString(line.country_of_origin),
  }));
}
