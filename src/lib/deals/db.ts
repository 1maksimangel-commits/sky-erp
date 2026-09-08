import { getBusinessCaseById } from "@/lib/business-cases";
import { createClient } from "@/lib/supabase/server";
import {
  buildExpectedFinanceSummary,
} from "@/lib/deals/validation";
import type {
  CurrencyAmount,
  Deal,
  DealContract,
  DealParticipant,
  DealProduct,
  DealShipment,
  DealWorkspaceData,
} from "@/lib/deals/types";

type Relation = { id?: string; name?: string; legal_name?: string } | Array<{
  id?: string;
  name?: string;
  legal_name?: string;
}> | null;

function firstRelation(value: Relation) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isMissingCanonicalSchema(message: string): boolean {
  return /deal_|loading_port|purchase_currency|sales_currency|expected_|deal_contract_role|parent_contract_id|schema cache|PGRST204|PGRST205|42703|does not exist/i.test(
    message
  );
}

async function getCanonicalDeal(id: string): Promise<{ data: Deal | null; warning: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_cases")
    .select(`
      id, case_number, title, status, case_type, company_id, buyer_id, supplier_id,
      consignee_id, incoterms, loading_port, destination_port, payment_terms,
      expected_shipment_date, eta, purchase_currency, sales_currency,
      purchase_value, sales_value, expected_expenses, expected_expenses_currency,
      expected_commission, expected_commission_currency, notes, created_at, updated_at,
      company:company_id ( id, name ), buyer:buyer_id ( id, legal_name ),
      supplier:supplier_id ( id, legal_name ), consignee:consignee_id ( id, legal_name )
    `)
    .eq("id", id)
    .maybeSingle();

  if (!error && data) {
    const row = data as unknown as Record<string, unknown>;
    const company = firstRelation(row.company as Relation);
    const buyer = firstRelation(row.buyer as Relation);
    const supplier = firstRelation(row.supplier as Relation);
    const consignee = firstRelation(row.consignee as Relation);
    return {
      data: {
        id: String(row.id),
        case_number: String(row.case_number),
        title: (row.title as string | null) ?? null,
        status: (row.status as string | null) ?? null,
        case_type: (row.case_type as string | null) ?? null,
        company_id: (row.company_id as string | null) ?? null,
        buyer_id: (row.buyer_id as string | null) ?? null,
        supplier_id: (row.supplier_id as string | null) ?? null,
        consignee_id: (row.consignee_id as string | null) ?? null,
        company_name: company?.name ?? null,
        buyer_name: buyer?.legal_name ?? null,
        supplier_name: supplier?.legal_name ?? null,
        consignee_name: consignee?.legal_name ?? null,
        incoterms: (row.incoterms as string | null) ?? null,
        loading_port: (row.loading_port as string | null) ?? null,
        destination_port: (row.destination_port as string | null) ?? null,
        payment_terms: (row.payment_terms as string | null) ?? null,
        expected_shipment_date: (row.expected_shipment_date as string | null) ?? null,
        eta: (row.eta as string | null) ?? null,
        purchase_currency: (row.purchase_currency as string | null) ?? null,
        sales_currency: (row.sales_currency as string | null) ?? null,
        purchase_value: numberOrNull(row.purchase_value),
        sales_value: numberOrNull(row.sales_value),
        expected_expenses: numberOrNull(row.expected_expenses) ?? 0,
        expected_expenses_currency:
          (row.expected_expenses_currency as string | null) ?? null,
        expected_commission: numberOrNull(row.expected_commission) ?? 0,
        expected_commission_currency:
          (row.expected_commission_currency as string | null) ?? null,
        notes: (row.notes as string | null) ?? null,
        created_at: (row.created_at as string | null) ?? null,
        updated_at: (row.updated_at as string | null) ?? null,
        canonical_schema_available: true,
      },
      warning: null,
    };
  }

  if (error && !isMissingCanonicalSchema(error.message)) {
    return { data: null, warning: error.message };
  }

  const legacy = await getBusinessCaseById(id);
  if (!legacy.data) return { data: null, warning: legacy.error };
  return {
    data: {
      id: legacy.data.id,
      case_number: legacy.data.case_number,
      title: legacy.data.title,
      status: legacy.data.status,
      case_type: legacy.data.case_type,
      company_id: null,
      buyer_id: null,
      supplier_id: null,
      consignee_id: null,
      company_name: legacy.data.company?.name ?? null,
      buyer_name: legacy.data.buyer?.legal_name ?? null,
      supplier_name: legacy.data.supplier?.legal_name ?? null,
      consignee_name: legacy.data.consignee?.legal_name ?? null,
      incoterms: legacy.data.incoterms,
      loading_port: null,
      destination_port: null,
      payment_terms: null,
      expected_shipment_date: null,
      eta: null,
      purchase_currency: legacy.data.currency,
      sales_currency: legacy.data.currency,
      purchase_value: null,
      sales_value: legacy.data.contract_amount,
      expected_expenses: 0,
      expected_expenses_currency: legacy.data.currency,
      expected_commission: 0,
      expected_commission_currency: legacy.data.currency,
      notes: null,
      created_at: null,
      updated_at: null,
      canonical_schema_available: false,
    },
    warning: "Canonical Deal migration is not applied; showing legacy Business Case data.",
  };
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
  if (!isMissingCanonicalSchema(error.message)) return { data: [], warning: error.message };

  const fallback: DealParticipant[] = [];
  const add = (id: string | null, role: string, name: string | null) => {
    if (id && name) fallback.push({ id: `legacy-${role}`, counterparty_id: id, role_code: role, notes: null, legal_name: name });
  };
  add(deal.supplier_id, "seller", deal.supplier_name);
  add(deal.buyer_id, "buyer", deal.buyer_name);
  add(deal.consignee_id, "consignee", deal.consignee_name);
  return { data: fallback, warning: "Normalized Deal participants require the Sprint 1 migration." };
}

async function loadProducts(dealId: string): Promise<{ data: DealProduct[]; warning: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_products")
    .select(`
      id, product_id, product_description, size_grade, quantity, unit, net_weight,
      gross_weight, purchase_price, sales_price, purchase_currency, sales_currency,
      product:product_id ( sku, name, scientific_name )
    `)
    .eq("business_case_id", dealId)
    .order("created_at");
  if (error) {
    return {
      data: [],
      warning: isMissingCanonicalSchema(error.message)
        ? "Deal product lines require the Sprint 1 migration."
        : error.message,
    };
  }
  return {
    data: (data ?? []).map((item) => {
      const product = firstRelation(item.product as Relation);
      return {
        id: item.id,
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
    .select("id, contract_number, title, status, amount, currency, business_role, deal_id, deal_contract_role, parent_contract_id")
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

async function loadCommissions(dealId: string): Promise<{
  amounts: CurrencyAmount[];
  count: number;
  warning: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_commission_links")
    .select("expected_amount, currency")
    .eq("business_case_id", dealId);
  if (error) {
    return {
      amounts: [],
      count: 0,
      warning: isMissingCanonicalSchema(error.message)
        ? "Commission links are reserved by the Sprint 1 migration."
        : error.message,
    };
  }
  return {
    amounts: (data ?? []).map((item) => ({
      amount: numberOrNull(item.expected_amount) ?? 0,
      currency: item.currency ?? "",
    })),
    count: data?.length ?? 0,
    warning: null,
  };
}

export async function getDealWorkspaceData(
  id: string
): Promise<{ data: DealWorkspaceData | null; error: string | null }> {
  const dealResult = await getCanonicalDeal(id);
  if (!dealResult.data) return { data: null, error: dealResult.warning ?? "Deal not found." };
  const deal = dealResult.data;
  const [participants, products, contracts, shipments, commissions] = await Promise.all([
    loadParticipants(deal),
    loadProducts(id),
    loadContracts(id),
    loadShipments(id),
    loadCommissions(id),
  ]);
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
      finance: buildExpectedFinanceSummary({
        products: products.data,
        linkedContracts: contracts.data,
        purchaseValue: deal.purchase_value,
        purchaseCurrency: deal.purchase_currency,
        salesValue: deal.sales_value,
        salesCurrency: deal.sales_currency,
        expectedExpenses: deal.expected_expenses,
        expectedExpensesCurrency: deal.expected_expenses_currency,
        expectedCommission: deal.expected_commission,
        expectedCommissionCurrency: deal.expected_commission_currency,
        linkedCommissions: commissions.amounts,
      }),
    },
    error: null,
  };
}
