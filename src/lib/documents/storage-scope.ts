import "server-only";
import { getAccessContext, can } from "@/lib/platform/permissions";
import { createClient } from "@/lib/supabase/server";

export async function companyStoragePath(path: string, owner?: { type: string; id: string }, requestedCompanyId?: string | null): Promise<string> {
  const context = await getAccessContext();
  if (!context?.hasAccess) throw new Error("Authentication required.");
  let companyId = requestedCompanyId ?? context.companyId;
  if (owner) {
    const client = await createClient();
    const { data, error } = await client.rpc("storage_company_for_entity", { entity_type: owner.type, entity_id: owner.id });
    if (error) throw new Error("Document company access denied.");
    companyId = typeof data === "string" ? data : null;
  }
  if (!companyId && context.isAdmin) return `global/${path}`;
  if (!companyId || !await can("documents.write", companyId)) throw new Error("Select an accessible company before uploading.");
  return `companies/${companyId}/${path}`;
}
