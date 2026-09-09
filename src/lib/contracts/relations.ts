import { createClient } from "@/lib/supabase/server";

export type LinkedBusinessCase = {
  id: string;
  case_number: string;
  case_type: string | null;
  title: string | null;
  status: string | null;
  contract_number: string | null;
  contract_amount: number | null;
  currency: string | null;
  destination_port: string | null;
  etd: string | null;
  eta: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type BusinessCaseRow = {
  id: string;
  case_number: string;
  case_type: string | null;
  title: string | null;
  status: string | null;
  contract_number: string | null;
  contract_amount: number | null;
  currency: string | null;
  destination_port: string | null;
  etd: string | null;
  eta: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const linkedBusinessCaseColumns = `
  id,
  case_number,
  case_type,
  title,
  status,
  contract_number,
  contract_amount,
  currency,
  destination_port,
  etd,
  eta,
  created_at,
  updated_at
` as const;

export type LinkedBusinessCaseResult =
  | { data: LinkedBusinessCase; error: null }
  | { data: null; error: string | null };

async function loadBusinessCaseById(
  id: string
): Promise<LinkedBusinessCaseResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_cases")
    .select(linkedBusinessCaseColumns)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }
  if (!data) {
    return { data: null, error: null };
  }
  return { data: data as BusinessCaseRow, error: null };
}

/** Legacy string match on business_cases.contract_number. */
export async function getBusinessCaseByContractNumber(
  contractNumber: string
): Promise<LinkedBusinessCaseResult> {
  if (!contractNumber.trim()) {
    return { data: null, error: null };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("business_cases")
    .select(linkedBusinessCaseColumns)
    .eq("contract_number", contractNumber)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  if (!data) {
    return { data: null, error: null };
  }

  return { data: data as BusinessCaseRow, error: null };
}

/**
 * Prefer contracts.business_case_id FK, then fall back to contract_number match.
 */
export async function getBusinessCaseForContract(input: {
  contractId: string;
  contractNumber: string;
}): Promise<LinkedBusinessCaseResult> {
  const supabase = await createClient();

  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select("id, business_case_id, deal_id, parties_reviewed, contract_number")
    .eq("id", input.contractId)
    .maybeSingle();

  if (contractError) {
    return { data: null, error: contractError.message };
  }

  if (contract?.parties_reviewed) return contract.deal_id ? loadBusinessCaseById(contract.deal_id) : { data: null, error: null };
  if (contract?.business_case_id) {
    const byFk = await loadBusinessCaseById(contract.business_case_id);
    if (byFk.data || byFk.error) {
      return byFk;
    }
  }

  const number =
    input.contractNumber.trim() ||
    (contract?.contract_number as string | null | undefined)?.trim() ||
    "";
  return getBusinessCaseByContractNumber(number);
}

export async function getBusinessCaseIdForContract(
  contractNumber: string,
  contractId?: string | null
): Promise<string | null> {
  if (contractId) {
    const { data } = await getBusinessCaseForContract({
      contractId,
      contractNumber,
    });
    return data?.id ?? null;
  }

  const { data } = await getBusinessCaseByContractNumber(contractNumber);
  return data?.id ?? null;
}
