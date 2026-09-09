import type { Contract } from "@/lib/contracts/db";
import { contractLineAmount } from "@/lib/contracts/parties";

export type DocumentDetails = { number: string; date: string; notes: string; supplementReference: string };
export function contractDocumentValues(contract: Contract, details: DocumentDetails, deal?: { number: string; title: string }) {
  if (!contract.parties.some(p => p.role_code === "seller") || !contract.parties.some(p => p.role_code === "buyer")) throw new Error("Review Seller and Buyer on the Contract before generating documents.");
  const parties = Object.fromEntries(contract.parties.map(p => {
    const s = p.snapshot;
    return [p.role_code, { ...s, name: s.legal_name, tax_number: s.tax_number ?? s.tax_id ?? "",
      bank: { name: s.bank_name ?? "", account: s.bank_account ?? "", swift: s.bank_swift ?? "", address: s.bank_address ?? "" },
      signatory: { name: s.signatory_name ?? "", title: s.signatory_title ?? "" },
      internal_company_id: p.internal_company_id, counterparty_id: p.counterparty_id }];
  }));
  const products = contract.product_lines.map((line, index) => ({ ...line, number: index + 1, name: line.description, amount: contractLineAmount(line) }));
  const total = Math.round(products.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
  const sum = (field: "net_weight" | "gross_weight") => Math.round(products.reduce((result, line) => result + (line[field] ?? 0), 0) * 1000) / 1000;
  return {
    ...parties, deal: deal ?? {}, contract: { number: contract.contract_number, date: contract.contract_date ?? "", currency: contract.currency ?? "" },
    document: { number: details.number, date: details.date }, invoice: { number: details.number, date: details.date },
    supplement: { number: details.number, date: details.date, reference: details.supplementReference },
    products, commercial: { currency: contract.currency ?? "", incoterms: contract.incoterms ?? "", delivery_place: contract.delivery_place ?? "",
      payment_terms: contract.payment_terms ?? "", delivery_terms: typeof contract.legal_snapshot.delivery_terms === "string" ? contract.legal_snapshot.delivery_terms : "", price: total },
    incoterms: contract.incoterms ?? "", manual: { notes: details.notes },
    calculated: { subtotal: total, total, total_net_weight: sum("net_weight"), total_gross_weight: sum("gross_weight") },
  };
}
