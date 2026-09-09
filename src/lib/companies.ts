import { createClient } from "@/lib/supabase/server";

export type Company = {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;
  business_role: "Seller" | "Buyer" | "Agent" | "Other" | null;
  name: string;
  code: string;
  short_name: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  tax_id: string | null;
  registration_number: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  authorized_signer_name: string | null;
  authorized_signer_title: string | null;
  seal_document_id: string | null;
  signature_document_id: string | null;
  bank_accounts: Array<{
    id: string;
    name: string;
    bank_name: string | null;
    bank_address: string | null;
    account_number: string | null;
    iban: string | null;
    swift: string | null;
    currency: string;
  }>;
  is_active: boolean;
};

export type CompaniesResult =
  | { data: Company[]; error: null }
  | { data: null; error: string };

export type CompaniesCountResult =
  | { count: number; error: null }
  | { count: null; error: string };

const companyColumns =
  "id, created_at, updated_at, name, code, short_name, country, city, address, tax_id, registration_number, email, phone, website, authorized_signer_name, authorized_signer_title, seal_document_id, signature_document_id, business_role, is_active, bank_accounts ( id, name, bank_name, bank_address, account_number, iban, swift, currency )" as const;

function normalizeCompany(row: Record<string, unknown>): Company {
  return {
    ...(row as unknown as Omit<Company, "authorized_signer_name" | "authorized_signer_title" | "bank_accounts">),
    authorized_signer_name:
      typeof row.authorized_signer_name === "string" ? row.authorized_signer_name : null,
    authorized_signer_title:
      typeof row.authorized_signer_title === "string" ? row.authorized_signer_title : null,
    seal_document_id: typeof row.seal_document_id === "string" ? row.seal_document_id : null,
    signature_document_id:
      typeof row.signature_document_id === "string" ? row.signature_document_id : null,
    business_role: ["Seller", "Buyer", "Agent", "Other"].includes(String(row.business_role))
      ? (row.business_role as Company["business_role"])
      : null,
    bank_accounts: Array.isArray(row.bank_accounts) ? row.bank_accounts : [],
    address: typeof row.address === "string" ? row.address : null,
  };
}


export async function getCompanies(): Promise<CompaniesResult> {
  const supabase = await createClient();

  const result = await supabase
    .from("companies")
    .select(companyColumns)
    .order("created_at", { referencedTable: "bank_accounts" })
    .order("id", { referencedTable: "bank_accounts" })
    .order("name");

  const { data, error } = result;

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data ?? []).map((row) => normalizeCompany(row as Record<string, unknown>)), error: null };
}

export async function getActiveCompanies(): Promise<CompaniesResult> {
  const supabase = await createClient();

  const result = await supabase
    .from("companies")
    .select(companyColumns)
    .order("created_at", { referencedTable: "bank_accounts" })
    .order("id", { referencedTable: "bank_accounts" })
    .eq("is_active", true)
    .order("name");

  const { data, error } = result;

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data ?? []).map((row) => normalizeCompany(row as Record<string, unknown>)), error: null };
}

export type CompanyResult =
  | { data: Company; error: null }
  | { data: null; error: string };

export async function getCompanyById(id: string): Promise<CompanyResult> {
  const supabase = await createClient();

  const result = await supabase
    .from("companies")
    .select(companyColumns)
    .order("created_at", { referencedTable: "bank_accounts" })
    .order("id", { referencedTable: "bank_accounts" })
    .eq("id", id)
    .maybeSingle();

  const { data, error } = result;

  if (error) {
    return { data: null, error: error.message };
  }

  if (!data) {
    return { data: null, error: "Company not found." };
  }

  return { data: normalizeCompany(data as Record<string, unknown>), error: null };
}

export async function getCompaniesCount(): Promise<CompaniesCountResult> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("companies")
    .select("*", { count: "exact", head: true });

  if (error) {
    return { count: null, error: error.message };
  }

  return { count: count ?? 0, error: null };
}
