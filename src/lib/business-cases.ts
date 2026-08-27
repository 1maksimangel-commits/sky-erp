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

function normalizeBusinessCase(row: BusinessCaseRow): BusinessCase {
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

  const cases = ((data ?? []) as BusinessCaseRow[]).map(normalizeBusinessCase);

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

  return {
    data: normalizeBusinessCase(data as BusinessCaseRow),
    error: null,
  };
}
