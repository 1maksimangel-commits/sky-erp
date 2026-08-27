import { createClient } from "@/lib/supabase/server";

export type Company = {
  id: string;
  name: string;
  code: string;
  short_name: string | null;
  country: string | null;
  city: string | null;
  is_active: boolean;
};

export type CompaniesResult =
  | { data: Company[]; error: null }
  | { data: null; error: string };

export type CompaniesCountResult =
  | { count: number; error: null }
  | { count: null; error: string };

const companyColumns =
  "id, name, code, short_name, country, city, is_active" as const;

export async function getCompanies(): Promise<CompaniesResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("companies")
    .select(companyColumns)
    .order("name");

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data ?? [], error: null };
}

export async function getActiveCompanies(): Promise<CompaniesResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("companies")
    .select(companyColumns)
    .eq("is_active", true)
    .order("name");

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data ?? [], error: null };
}

export type CompanyResult =
  | { data: Company; error: null }
  | { data: null; error: string };

export async function getCompanyById(id: string): Promise<CompanyResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("companies")
    .select(companyColumns)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  if (!data) {
    return { data: null, error: "Company not found." };
  }

  return { data: data as Company, error: null };
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
