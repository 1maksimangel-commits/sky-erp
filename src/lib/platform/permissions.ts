import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { ROLE_CODES, type RoleCode } from "./types";

export const getAccessContext = cache(async () => {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  const { data: profile, error: profileError } = await client.from("user_profiles")
    .select("user_id,role_code,is_active,active_company_id").eq("user_id", user.id).maybeSingle();
  if (profileError || !profile?.is_active) return null;
  const { data: memberships, error: membershipError } = await client.from("company_memberships")
    .select("company_id,role_code").eq("user_id", user.id);
  if (membershipError) return null;
  const isAdmin = profile.role_code === "admin";
  const { data: active, error: activeError } = await client.rpc("active_company_id");
  if (activeError) return null;
  const companyId = typeof active === "string" ? active : null;
  const assigned = memberships?.find(m => m.company_id === companyId)?.role_code;
  const role: RoleCode = isAdmin ? "admin" : ROLE_CODES.find(code => code === assigned) ?? "readonly";
  return { userId: user.id, email: user.email ?? "", isAdmin, companyId, role, hasAccess: isAdmin || Boolean(memberships?.length) };
});

export async function getCurrentRole(): Promise<RoleCode> {
  return (await getAccessContext())?.role ?? "readonly";
}

export const getPermissionRegistry = cache(async () => {
  const client = await createClient();
  const { data, error } = await client.from("roles").select("code,permissions");
  if (error) throw new Error("Unable to load permissions.");
  return (data ?? []).map(row => ({ code: String(row.code), permissions: Array.isArray(row.permissions) ? row.permissions.filter((value: unknown): value is string => typeof value === "string") : [] }));
});

export async function getRolePermissions(role: RoleCode): Promise<string[]> {
  return (await getPermissionRegistry()).find(row => row.code === role)?.permissions ?? [];
}

export async function can(permission: string, companyId: string | null = null): Promise<boolean> {
  const context = await getAccessContext();
  if (!context?.hasAccess) return false;
  const client = await createClient();
  const { data, error } = await client.rpc("authorize_permission", { permission, company_id: companyId });
  return !error && data === true;
}

export async function assertCan(permission: string): Promise<string | null> {
  return await can(permission) ? null : `Permission denied for ${permission}.`;
}
