import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type OperationalRow = {
  id: string;
  label: string;
  companyId: string | null;
  contractId: string | null;
  detail: string;
  href: string;
};
export type OperationalGroup = { label: string; rows: OperationalRow[] };

/** Read through the caller's session. Linking a record never grants access to it. */
export async function getOperationalRecords(source: { dealId: string } | { contractId: string }): Promise<{ groups: OperationalGroup[]; error: string | null }> {
  const id = "dealId" in source ? source.dealId : source.contractId;
  if (!z.string().uuid().safeParse(id).success) return { groups: [], error: "Invalid business record." };
  const column = "dealId" in source ? "business_case_id" : "contract_id";
  const db = await createClient();
  const [shipments, movements, invoices, payments, expenses, commissions, documents] = await Promise.all([
    db.from("shipments").select("id,company_id,contract_id,container,status").eq(column, id).order("created_at"),
    db.from("stock_movements").select("id,company_id,contract_id,movement_type,quantity,unit,lot_number,reference").eq(column, id).order("created_at"),
    db.from("invoices").select("id,company_id,contract_id,invoice_number,currency,amount,outstanding,status").eq(column, id).order("created_at"),
    db.from("payments").select("id,company_id,contract_id,reference,currency,amount,status").eq(column, id).order("created_at"),
    db.from("expenses").select("id,company_id,contract_id,description,currency,amount,status").eq(column, id).order("created_at"),
    db.from("deal_commission_links").select("id,company_id,contract_id,label,currency,expected_amount").eq(column, id).order("created_at"),
    db.from("generated_documents").select("id,company_id,contract_id,document_number,document_type,status,version").eq(column, id).order("created_at"),
  ]);
  const error = [shipments, movements, invoices, payments, expenses, commissions, documents].find(result => result.error)?.error;
  if (error) return { groups: [], error: error.message };
  const invoiceIds = (invoices.data ?? []).map(row => row.id);
  const allocations = invoiceIds.length ? await db.from("payment_allocations").select("payment_id").in("invoice_id", invoiceIds) : { data: [], error: null };
  if (allocations.error) return { groups: [], error: allocations.error.message };
  const paymentIds = [...new Set((allocations.data ?? []).map(row => row.payment_id))];
  const allocated = paymentIds.length ? await db.from("payments").select("id,company_id,contract_id,reference,currency,amount,status").in("id", paymentIds) : { data: [], error: null };
  if (allocated.error) return { groups: [], error: allocated.error.message };
  const paymentRows = [...new Map([...(payments.data ?? []), ...(allocated.data ?? [])].map(row => [row.id, row])).values()];
  return { error: null, groups: [
    { label: "Shipments", rows: (shipments.data ?? []).map(r => ({ id: r.id, companyId: r.company_id, contractId: r.contract_id, label: r.container || "Shipment", detail: r.status ?? "", href: `/logistics/${r.id}` })) },
    { label: "Warehouse movements", rows: (movements.data ?? []).map(r => ({ id: r.id, companyId: r.company_id, contractId: r.contract_id, label: r.movement_type, detail: `${r.quantity} ${r.unit ?? ""} · ${r.lot_number ?? r.reference ?? ""}`, href: `/warehouse?movement=${r.id}` })) },
    { label: "Invoices", rows: (invoices.data ?? []).map(r => ({ id: r.id, companyId: r.company_id, contractId: r.contract_id, label: r.invoice_number, detail: `${r.amount} ${r.currency} · Outstanding ${r.outstanding} · ${r.status}`, href: `/finance/invoices/${r.id}` })) },
    { label: "Payments", rows: paymentRows.map(r => ({ id: r.id, companyId: r.company_id, contractId: r.contract_id, label: r.reference || "Payment", detail: `${r.amount} ${r.currency} · ${r.status}`, href: `/finance/payments/${r.id}` })) },
    { label: "Expenses", rows: (expenses.data ?? []).map(r => ({ id: r.id, companyId: r.company_id, contractId: r.contract_id, label: r.description || "Expense", detail: `${r.amount} ${r.currency} · ${r.status}`, href: `/finance/expenses?record=${r.id}` })) },
    { label: "Commissions", rows: (commissions.data ?? []).map(r => ({ id: r.id, companyId: r.company_id, contractId: r.contract_id, label: r.label || "Commission", detail: `${r.expected_amount} ${r.currency ?? ""}`, href: `/finance/commissions?record=${r.id}` })) },
    { label: "Generated documents", rows: (documents.data ?? []).map(r => ({ id: r.id, companyId: r.company_id, contractId: r.contract_id, label: r.document_number || r.document_type, detail: `v${r.version} · ${r.status}`, href: `/api/documents/generated/${r.id}` })) },
  ] };
}
