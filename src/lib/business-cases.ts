import { createClient } from "@/lib/supabase/server";

export type BusinessCase = {
  id: string;
  case_number: string;
  case_type: string | null;
  title: string | null;
  status: string | null;
  contract_number: string | null;
  contract_date: string | null;
  currency: string | null;
  contract_amount: number | null;
  incoterms: string | null;
  buyer: { legal_name: string } | null;
  supplier: { legal_name: string } | null;
  consignee: { legal_name: string } | null;
  company: { name: string } | null;
  products?: Array<{ name: string; size?: string | null; quantity: number; unit?: string | null; netWeight?: number | null; grossWeight?: number | null; unitPrice?: number | null }>;
};

export type BusinessCaseStats = {
  total: number;
  draft: number;
  active: number;
  totalContractAmount: number;
};

export type BusinessCasesResult =
  | { data: BusinessCase[]; stats: BusinessCaseStats; error: null }
  | { data: null; stats: null; error: string };

type Relation = { legal_name: string } | { legal_name: string }[] | null;
type CompanyRelation = { name: string } | { name: string }[] | null;

type BusinessCaseRow = {
  id: string;
  case_number: string;
  case_type: string | null;
  title: string | null;
  status: string | null;
  contract_number: string | null;
  contract_date: string | null;
  currency: string | null;
  contract_amount: number | null;
  incoterms: string | null;
  buyer: Relation;
  supplier: Relation;
  consignee: Relation;
  company: CompanyRelation;
};

function normalizeLegalNameRelation(
  value: Relation
): { legal_name: string } | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeCompanyRelation(
  value: CompanyRelation
): { name: string } | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeBusinessCase(row: BusinessCaseRow, products: BusinessCase["products"] = []): BusinessCase {
  return {
    id: row.id,
    case_number: row.case_number,
    case_type: row.case_type,
    title: row.title,
    status: row.status,
    contract_number: row.contract_number,
    contract_date: row.contract_date,
    currency: row.currency,
    contract_amount: row.contract_amount,
    incoterms: row.incoterms,
    buyer: normalizeLegalNameRelation(row.buyer),
    supplier: normalizeLegalNameRelation(row.supplier),
    consignee: normalizeLegalNameRelation(row.consignee),
    company: normalizeCompanyRelation(row.company),
    products,
  };
}

const businessCaseColumns = `
  id,
  case_number,
  case_type,
  title,
  status,
  contract_number,
  contract_date,
  currency,
  contract_amount,
  incoterms,
  buyer:buyer_id ( legal_name ),
  supplier:supplier_id ( legal_name ),
  consignee:consignee_id ( legal_name ),
  company:company_id ( name )
` as const;

async function loadDealProducts(supabase: Awaited<ReturnType<typeof createClient>>, dealIds: string[]) {
  if (!dealIds.length) return new Map<string, NonNullable<BusinessCase["products"]>>();
  const { data: lines } = await supabase.from("deal_products").select("business_case_id, product_id, product_description, size_grade, quantity, unit, net_weight, gross_weight, sales_price").in("business_case_id", dealIds).order("created_at", { ascending: true });
  const productIds = [...new Set((lines ?? []).map((line) => line.product_id).filter((id): id is string => Boolean(id)))];
  const { data: products } = productIds.length ? await supabase.from("products").select("id,name").in("id", productIds) : { data: [] as Array<{ id: string; name: string }> };
  const names = new Map((products ?? []).map((product) => [product.id, product.name]));
  const result = new Map<string, NonNullable<BusinessCase["products"]>>();
  for (const line of lines ?? []) { const list = result.get(line.business_case_id) ?? []; list.push({ name: names.get(line.product_id ?? "") ?? line.product_description ?? "Product", size: line.size_grade, quantity: Number(line.quantity), unit: line.unit, netWeight: line.net_weight, grossWeight: line.gross_weight, unitPrice: line.sales_price }); result.set(line.business_case_id, list); }
  return result;
}

function computeStats(cases: BusinessCase[]): BusinessCaseStats {
  return {
    total: cases.length,
    draft: cases.filter((item) => item.status === "Draft").length,
    active: cases.filter(
      (item) => item.status && item.status !== "Draft" && item.status !== "Closed"
    ).length,
    totalContractAmount: cases.reduce(
      (sum, item) => sum + (item.contract_amount ?? 0),
      0
    ),
  };
}

export async function getBusinessCases(): Promise<BusinessCasesResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("business_cases")
    .select(businessCaseColumns)
    .order("contract_date", { ascending: false, nullsFirst: false })
    .order("case_number", { ascending: false });

  if (error) {
    return { data: null, stats: null, error: error.message };
  }

  const rows = (data ?? []) as BusinessCaseRow[];
  const productMap = await loadDealProducts(supabase, rows.map((row) => row.id));
  const cases = rows.map((row) => normalizeBusinessCase(row, productMap.get(row.id) ?? []));

  return {
    data: cases,
    stats: computeStats(cases),
    error: null,
  };
}

export type BusinessCaseResult =
  | { data: BusinessCase; error: null }
  | { data: null; error: string };

export async function getBusinessCaseById(
  id: string
): Promise<BusinessCaseResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("business_cases")
    .select(businessCaseColumns)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  if (!data) {
    return { data: null, error: "Business case not found." };
  }

  const productMap = await loadDealProducts(supabase, [id]);
  return {
    data: normalizeBusinessCase(data as BusinessCaseRow, productMap.get(id) ?? []),
    error: null,
  };
}
