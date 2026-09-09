import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getActiveCompanyId, assertCompanyAccess } from "@/lib/platform/company-scope";
import { uuid } from "./validation";

export async function requireCoreCompany(requested?: string | null): Promise<string> {
  const id = requested ?? await getActiveCompanyId();
  if (!id || !uuid.safeParse(id).success) throw new Error("Select an active Company in Settings before creating business records.");
  const denied = await assertCompanyAccess(id);
  if (denied) throw new Error(denied);
  const client = await createClient();
  const { data, error } = await client.from("companies").select("id,is_active").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.is_active) throw new Error("Company is missing, archived, or inaccessible.");
  return id;
}

export async function validateCoreParties(companyId: string, ids: Array<string | null | undefined>): Promise<string | null> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return null;
  if (unique.some(id => !uuid.safeParse(id).success)) return "Invalid counterparty ID.";
  const client = await createClient();
  const { data, error } = await client.from("counterparties").select("id,company_id,is_active").in("id", unique);
  if (error) return error.message;
  return data?.length === unique.length && data.every(row => row.company_id === companyId && row.is_active)
    ? null : "All counterparties must be active and belong to the Deal Company.";
}
