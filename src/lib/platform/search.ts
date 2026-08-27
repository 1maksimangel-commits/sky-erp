"use server";

import { createClient } from "@/lib/supabase/server";

export type SearchResult = {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  href: string;
};

export async function globalSearch(
  query: string
): Promise<{ data: SearchResult[]; error: string | null }> {
  const q = query.trim();
  if (q.length < 2) {
    return { data: [], error: null };
  }

  const supabase = await createClient();
  const like = `%${q}%`;
  const results: SearchResult[] = [];

  const [
    contracts,
    invoices,
    businessCases,
    products,
    companies,
    counterparties,
    shipments,
    documents,
    lots,
  ] = await Promise.all([
    supabase
      .from("contracts")
      .select("id, contract_number, title")
      .or(`contract_number.ilike.${like},title.ilike.${like}`)
      .limit(8),
    supabase
      .from("invoices")
      .select("id, invoice_number, status")
      .ilike("invoice_number", like)
      .limit(8),
    supabase
      .from("business_cases")
      .select("id, case_number, title")
      .or(`case_number.ilike.${like},title.ilike.${like}`)
      .limit(8),
    supabase
      .from("products")
      .select("id, sku, name")
      .or(`sku.ilike.${like},name.ilike.${like}`)
      .limit(8),
    supabase
      .from("companies")
      .select("id, name, code")
      .or(`name.ilike.${like},code.ilike.${like}`)
      .limit(8),
    supabase
      .from("counterparties")
      .select("id, legal_name, code")
      .or(`legal_name.ilike.${like},code.ilike.${like}`)
      .limit(8),
    supabase
      .from("shipments")
      .select("id, container, vessel, voyage, status")
      .or(
        `container.ilike.${like},vessel.ilike.${like},voyage.ilike.${like},tracking_number.ilike.${like}`
      )
      .limit(8),
    supabase
      .from("documents")
      .select("id, title, document_type, entity_type, entity_id")
      .or(`title.ilike.${like},document_type.ilike.${like},file_name.ilike.${like}`)
      .limit(8),
    supabase
      .from("inventory_lots")
      .select("id, lot_number, status")
      .ilike("lot_number", like)
      .limit(8),
  ]);

  for (const item of contracts.data ?? []) {
    results.push({
      id: item.id,
      type: "Contract",
      title: item.contract_number,
      subtitle: item.title,
      href: `/contracts/${item.id}`,
    });
  }

  for (const item of invoices.data ?? []) {
    results.push({
      id: item.id,
      type: "Invoice",
      title: item.invoice_number,
      subtitle: item.status,
      href: `/finance/invoices/${item.id}`,
    });
  }

  for (const item of businessCases.data ?? []) {
    results.push({
      id: item.id,
      type: "Business Case",
      title: item.case_number,
      subtitle: item.title,
      href: `/business-cases/${item.id}`,
    });
  }

  for (const item of products.data ?? []) {
    results.push({
      id: item.id,
      type: "Product",
      title: item.name,
      subtitle: item.sku,
      href: `/products/${item.id}`,
    });
  }

  for (const item of companies.data ?? []) {
    results.push({
      id: item.id,
      type: "Company",
      title: item.name,
      subtitle: item.code,
      href: `/companies/${item.id}`,
    });
  }

  for (const item of counterparties.data ?? []) {
    results.push({
      id: item.id,
      type: "Counterparty",
      title: item.legal_name,
      subtitle: item.code,
      href: `/counterparties/${item.id}`,
    });
  }

  for (const item of shipments.data ?? []) {
    results.push({
      id: item.id,
      type: "Shipment",
      title: item.container || item.vessel || "Shipment",
      subtitle: [item.vessel, item.voyage, item.status].filter(Boolean).join(" · "),
      href: `/logistics/${item.id}`,
    });
  }

  for (const item of documents.data ?? []) {
    results.push({
      id: item.id,
      type: "Document",
      title: item.title || "Document",
      subtitle: item.document_type,
      href: "/documents",
    });
  }

  for (const item of lots.data ?? []) {
    results.push({
      id: item.id,
      type: "Warehouse Lot",
      title: item.lot_number,
      subtitle: item.status,
      href: `/warehouse/lots/${item.id}`,
    });
  }

  return { data: results.slice(0, 40), error: null };
}
