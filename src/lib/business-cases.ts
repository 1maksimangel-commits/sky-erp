// Business Case is the existing route/API name for the canonical Deal.
// This read adapter preserves consumers without maintaining a second data model.
import { getCanonicalDeals, loadDealProducts } from "@/lib/deals/db";
import type { Deal, DealProduct } from "@/lib/deals/types";

export type BusinessCase = Deal & {
  buyer: { legal_name: string } | null;
  supplier: { legal_name: string } | null;
  consignee: { legal_name: string } | null;
  company: { name: string } | null;
  products: Array<{ name: string; size: string | null; quantity: number; unit: string; netWeight: number | null; grossWeight: number | null; unitPrice: number | null }>;
};
export type BusinessCaseStats = { total: number; draft: number; active: number; totalContractAmount: number };
export type BusinessCasesResult = { data: BusinessCase[]; stats: BusinessCaseStats; error: null } | { data: null; stats: null; error: string };
export type BusinessCaseResult = { data: BusinessCase; error: null } | { data: null; error: string };

function projectDeal(deal: Deal, lines: DealProduct[]): BusinessCase {
  return { ...deal,
    buyer: deal.buyer_name ? { legal_name: deal.buyer_name } : null,
    supplier: deal.supplier_name ? { legal_name: deal.supplier_name } : null,
    consignee: deal.consignee_name ? { legal_name: deal.consignee_name } : null,
    company: deal.company_name ? { name: deal.company_name } : null,
    products: lines.filter(line => line.business_case_id === deal.id).map(line => ({
      name: line.product_name ?? line.product_description ?? "Product", size: line.size_grade,
      quantity: line.quantity, unit: line.unit, netWeight: line.net_weight,
      grossWeight: line.gross_weight, unitPrice: line.sales_price,
    })),
  };
}
export async function getBusinessCases(): Promise<BusinessCasesResult> {
  const result = await getCanonicalDeals();
  if (result.error) return { data: null, stats: null, error: result.error };
  const products = await loadDealProducts(result.data.map(row => row.id));
  if (products.warning) return { data: null, stats: null, error: products.warning };
  const data = result.data.map(row => projectDeal(row, products.data));
  return { data, stats: {
    total: data.length, draft: data.filter(row => !row.archived_at && row.status === "Draft").length,
    active: data.filter(row => !row.archived_at && !["Draft","Closed","Completed","Cancelled"].includes(row.status ?? "")).length,
    totalContractAmount: data.filter(row => !row.archived_at).reduce((sum,row) => sum + (row.contract_amount ?? 0),0),
  }, error: null };
}
export async function getBusinessCaseById(id: string): Promise<BusinessCaseResult> {
  const result = await getCanonicalDeals(id);
  if (result.error || !result.data[0]) return { data: null, error: result.error ?? "Deal not found." };
  const products = await loadDealProducts([id]);
  if (products.warning) return { data: null, error: products.warning };
  return { data: projectDeal(result.data[0],products.data), error: null };
}
