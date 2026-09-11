import { createClient } from "@/lib/supabase/server";
import { getActiveCompanyId } from "@/lib/platform/company-scope";
import type { Deal, DealContract, DealParticipant, DealProduct, DealShipment, DealWorkspaceData } from "@/lib/deals/types";

type Relation = { id?: string; name?: string; legal_name?: string; sku?: string; scientific_name?: string } | Array<{ id?: string; name?: string; legal_name?: string; sku?: string; scientific_name?: string }> | null;
function firstRelation(value: Relation) { return Array.isArray(value) ? value[0] ?? null : value; }
function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null;
}
// Reserved for read-only compatibility with later-phase modules.
function isMissingCanonicalSchema(message: string): boolean {
  return /schema cache|PGRST204|PGRST205|42703|does not exist/i.test(message);
}
const dealColumns = `
  id, case_number, case_type, title, status, archived_at, company_id, buyer_id, supplier_id,
  consignee_id, contract_number, contract_date, currency, contract_amount,
  incoterms, loading_port, destination_port, payment_terms, expected_shipment_date,
  eta, purchase_currency, sales_currency, purchase_value, sales_value,
  expected_expenses, expected_expenses_currency, expected_commission, expected_commission_currency,
  notes, created_at, updated_at,
  company:company_id(id,name), buyer:buyer_id(id,legal_name),
  supplier:supplier_id(id,legal_name), consignee:consignee_id(id,legal_name)
` as const;

export async function getCanonicalDeals(id?: string): Promise<{ data: Deal[]; error: string | null }> {
  const client = await createClient();
  let query = client.from("business_cases").select(dealColumns).order("created_at", { ascending: false });
  if (id) query = query.eq("id", id);
  else {
    const companyId = await getActiveCompanyId();
    if (companyId) query = query.eq("company_id", companyId);
  }
  const { data, error } = await query;
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map(row => ({
    ...row, company_name: firstRelation(row.company)?.name ?? null,
    buyer_name: firstRelation(row.buyer)?.legal_name ?? null,
    supplier_name: firstRelation(row.supplier)?.legal_name ?? null,
    consignee_name: firstRelation(row.consignee)?.legal_name ?? null,
    purchase_value: numberOrNull(row.purchase_value), sales_value: numberOrNull(row.sales_value),
    expected_expenses: numberOrNull(row.expected_expenses) ?? 0,
    expected_commission: numberOrNull(row.expected_commission) ?? 0,
    canonical_schema_available: true,
  })), error: null };
}
export async function getCanonicalDeal(id: string): Promise<{ data: Deal | null; warning: string | null }> {
  const result = await getCanonicalDeals(id);
  return { data: result.data[0] ?? null, warning: result.error };
}

async function loadParticipants(deal: Deal): Promise<{ data: DealParticipant[]; warning: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_participants")
    .select("id, counterparty_id, role_code, notes, counterparty:counterparty_id ( legal_name )")
    .eq("business_case_id", deal.id)
    .order("role_code");
  if (!error) {
    return {
      data: (data ?? []).map((item) => {
        const counterparty = firstRelation(item.counterparty as Relation);
        return {
          id: item.id,
          counterparty_id: item.counterparty_id,
          role_code: item.role_code,
          notes: item.notes,
          legal_name: counterparty?.legal_name ?? "Unknown counterparty",
        };
      }),
      warning: null,
    };
  }
  return { data: [], warning: error.message };
}

export async function loadDealProducts(dealIds: string[]): Promise<{ data: DealProduct[]; warning: string | null }> {
  if (!dealIds.length) return { data: [], warning: null };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_products")
    .select(`
      id, business_case_id, notes, product_id, product_description, size_grade, quantity, unit, net_weight,
      gross_weight, purchase_price, sales_price, purchase_currency, sales_currency,
      product:product_id ( sku, name, scientific_name )
    `)
    .in("business_case_id", dealIds)
    .order("created_at");
  if (error) {
    return {
      data: [],
      warning: error.message,
    };
  }
  return {
    data: (data ?? []).map((item) => {
      const product = firstRelation(item.product as Relation);
      return {
        id: item.id,
        business_case_id: item.business_case_id,
        notes: item.notes,
        product_id: item.product_id,
        sku: (product as { sku?: string } | null)?.sku ?? null,
        product_name: (product as { name?: string } | null)?.name ?? null,
        scientific_name:
          (product as { scientific_name?: string } | null)?.scientific_name ?? null,
        product_description: item.product_description,
        size_grade: item.size_grade,
        quantity: numberOrNull(item.quantity) ?? 0,
        unit: item.unit,
        net_weight: numberOrNull(item.net_weight),
        gross_weight: numberOrNull(item.gross_weight),
        purchase_price: numberOrNull(item.purchase_price),
        sales_price: numberOrNull(item.sales_price),
        purchase_currency: item.purchase_currency,
        sales_currency: item.sales_currency,
      };
    }),
    warning: null,
  };
}

async function loadContracts(dealId: string): Promise<{ data: DealContract[]; warning: string | null }> {
  const supabase = await createClient();
  const canonical = await supabase
    .from("contracts")
    .select("id, contract_number, title, status, amount, currency, business_role, deal_id, deal_contract_role, parent_contract_id, parties_reviewed, parties:contract_parties(role_code,internal_company_id,counterparty_id,snapshot)")
    .is("deleted_at", null)
    .or(`deal_id.eq.${dealId},business_case_id.eq.${dealId}`)
    .order("created_at");
  const result = canonical.error && isMissingCanonicalSchema(canonical.error.message)
    ? await supabase
      .from("contracts")
        .select("id, contract_number, title, status, amount, currency")
        .eq("business_case_id", dealId)
        .order("created_at")
    : canonical;
  if (result.error) return { data: [], warning: result.error.message };
  return {
    data: (result.data ?? []).map((row) => ({
      id: row.id,
      parties_reviewed: "parties_reviewed" in row && row.parties_reviewed === true,
      parties: "parties" in row && Array.isArray(row.parties) ? row.parties : [],
      contract_number: row.contract_number,
      title: row.title,
      status: row.status,
      amount: numberOrNull(row.amount),
      currency: row.currency,
      deal_contract_role:
        "business_role" in row
          ? ((row.business_role as string | null) ?? null)
          : "deal_contract_role" in row
            ? ((row.deal_contract_role as string | null) ?? null)
            : null,
      parent_contract_id:
        "parent_contract_id" in row
          ? ((row.parent_contract_id as string | null) ?? null)
          : null,
    })),
    warning: canonical.error ? "Contract role classification requires the Sprint 1 migration." : null,
  };
}

async function loadShipments(dealId: string): Promise<{ data: DealShipment[]; warning: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shipments")
    .select("id, container, bl_number, vessel, eta, status")
    .eq("business_case_id", dealId)
    .order("eta", { ascending: true, nullsFirst: false });
  if (error) return { data: [], warning: error.message };
  return { data: (data ?? []) as DealShipment[], warning: null };
}

// Commission money belongs to the canonical profitability engine. The Deal
// workspace only needs to know whether commission records exist.
async function loadCommissions(dealId: string): Promise<{
  count: number;
  warning: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_commission_links")
    .select("id")
    .eq("business_case_id", dealId);
  if (error) {
    return {
      count: 0,
      warning: isMissingCanonicalSchema(error.message)
        ? "Commission links are reserved by the Sprint 1 migration."
        : error.message,
    };
  }
  return { count: data?.length ?? 0, warning: null };
}

export async function getDealWorkspaceData(
  id: string
): Promise<{ data: DealWorkspaceData | null; error: string | null }> {
  const dealResult = await getCanonicalDeal(id);
  if (!dealResult.data) return { data: null, error: dealResult.warning ?? "Deal not found." };
  const deal = dealResult.data;
  const [participants, products, contracts, shipments, commissions] = await Promise.all([
    loadParticipants(deal),
    loadDealProducts([id]),
    loadContracts(id),
    loadShipments(id),
    loadCommissions(id),
  ]);
  if (participants.warning || products.warning) return { data: null, error: participants.warning ?? products.warning };
  const warnings = [
    dealResult.warning,
    participants.warning,
    products.warning,
    contracts.warning,
    shipments.warning,
    commissions.warning,
  ].filter((value): value is string => Boolean(value));
  return {
    data: {
      deal,
      participants: participants.data,
      products: products.data,
      contracts: contracts.data,
      shipments: shipments.data,
      commissionsCount: commissions.count,
      schemaWarnings: [...new Set(warnings)],
    },
    error: null,
  };
}
