import { createClient } from "@/lib/supabase/server";

export type Contract = {
  id: string;
  contract_number: string;
  title: string | null;
  contract_date: string | null;
  expiry_date: string | null;
  currency: string | null;
  amount: number | null;
  incoterms: string | null;
  status: string | null;
  business_case_id: string | null;
  deal_id: string | null;
  business_role: string | null;
  company: { id: string; name: string } | null;
  buyer: { id: string; legal_name: string } | null;
  supplier: { id: string; legal_name: string } | null;
  consignee: { id: string; legal_name: string } | null;
};

export type ContractStats = {
  total: number;
  draft: number;
  active: number;
  expired: number;
};

export type ContractsResult =
  | { data: Contract[]; stats: ContractStats; error: null }
  | { data: null; stats: null; error: string };

type Relation = { id: string; legal_name: string } | { id: string; legal_name: string }[] | null;
type CompanyRelation = { id: string; name: string } | { id: string; name: string }[] | null;

type ContractRow = {
  id: string;
  contract_number: string;
  title: string | null;
  contract_date: string | null;
  expiry_date: string | null;
  currency: string | null;
  amount: number | null;
  incoterms: string | null;
  status: string | null;
  business_case_id?: string | null;
  deal_id?: string | null;
  business_role?: string | null;
  company: CompanyRelation;
  buyer: Relation;
  supplier: Relation;
  consignee: Relation;
};

function normalizeRelation(
  value: Relation
): { id: string; legal_name: string } | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeCompany(
  value: CompanyRelation
): { id: string; name: string } | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeContract(row: ContractRow): Contract {
  return {
    id: row.id,
    contract_number: row.contract_number,
    title: row.title,
    contract_date: row.contract_date,
    expiry_date: row.expiry_date,
    currency: row.currency,
    amount: row.amount,
    incoterms: row.incoterms,
    status: row.status,
    business_case_id: row.business_case_id ?? null,
    deal_id: row.deal_id ?? row.business_case_id ?? null,
    business_role: row.business_role ?? null,
    company: normalizeCompany(row.company),
    buyer: normalizeRelation(row.buyer),
    supplier: normalizeRelation(row.supplier),
    consignee: normalizeRelation(row.consignee),
  };
}

function isExpired(contract: Contract): boolean {
  if (!contract.expiry_date) {
    return false;
  }

  if (contract.status === "Closed" || contract.status === "Cancelled") {
    return false;
  }

  const expiry = new Date(`${contract.expiry_date}T23:59:59`);
  return !Number.isNaN(expiry.getTime()) && expiry < new Date();
}

function computeStats(contracts: Contract[]): ContractStats {
  return {
    total: contracts.length,
    draft: contracts.filter((item) => item.status === "Draft").length,
    active: contracts.filter((item) => item.status === "Active").length,
    expired: contracts.filter(isExpired).length,
  };
}

const contractColumns = `
  id,
  contract_number,
  title,
  contract_date,
  expiry_date,
  currency,
  amount,
  incoterms,
  status,
  business_case_id,
  deal_id,
  business_role,
  company:company_id ( id, name ),
  buyer:buyer_id ( id, legal_name ),
  supplier:supplier_id ( id, legal_name ),
  consignee:consignee_id ( id, legal_name )
` as const;

function isMissingDeletedAtColumn(error: { code?: string; message: string }): boolean {
  return /deleted_at|PGRST204|42703/i.test(`${error.code ?? ""} ${error.message}`);
}

export async function getContracts(): Promise<ContractsResult> {
  const supabase = await createClient();

  let result = await supabase
    .from("contracts")
    .select(contractColumns)
    .is("deleted_at", null)
    .order("contract_date", { ascending: false, nullsFirst: false })
    .order("contract_number", { ascending: false });

  if (result.error && isMissingDeletedAtColumn(result.error)) {
    result = await supabase
      .from("contracts")
      .select(contractColumns)
      .order("contract_date", { ascending: false, nullsFirst: false })
      .order("contract_number", { ascending: false });
  }

  const { data, error } = result;

  if (error) {
    return {
      data: null,
      stats: null,
      error: error.message || "Unable to load contracts from Supabase.",
    };
  }

  const contracts = ((data ?? []) as ContractRow[]).map(normalizeContract);

  return {
    data: contracts,
    stats: computeStats(contracts),
    error: null,
  };
}

export type ContractResult =
  | { data: Contract; error: null }
  | { data: null; error: string };

export async function getContractById(id: string): Promise<ContractResult> {
  const supabase = await createClient();

  let result = await supabase
    .from("contracts")
    .select(contractColumns)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (result.error && isMissingDeletedAtColumn(result.error)) {
    result = await supabase
      .from("contracts")
      .select(contractColumns)
      .eq("id", id)
      .maybeSingle();
  }

  const { data, error } = result;

  if (error) {
    return {
      data: null,
      error: error.message || "Unable to load contract from Supabase.",
    };
  }

  if (!data) {
    return { data: null, error: "Contract not found." };
  }

  return {
    data: normalizeContract(data as ContractRow),
    error: null,
  };
}

export async function getRelatedContracts(dealId: string | null, excludeId?: string) {
  if (!dealId) return [] as Contract[];
  const supabase = await createClient();
  const { data } = await supabase.from("contracts").select(contractColumns).eq("deal_id", dealId).neq("id", excludeId ?? "").order("contract_number");
  return ((data ?? []) as ContractRow[]).map(normalizeContract);
}
