"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/platform/permissions";

export async function signIn(form: FormData): Promise<void> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password || email.length > 320 || password.length > 1024) redirect("/login?error=credentials");
  const client = await createClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=credentials");
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const client = await createClient();
  const { error } = await client.auth.signOut();
  if (error) throw new Error("Unable to sign out. Please retry.");
  redirect("/login");
}

export async function chooseCompany(form: FormData): Promise<void> {
  const context = await getAccessContext();
  if (!context?.hasAccess) redirect("/login");
  const companyId = String(form.get("companyId") ?? "");
  const client = await createClient();
  const { error } = await client.rpc("set_active_company", { company_id: companyId });
  if (error) throw new Error("Company access denied.");
  redirect("/settings");
}
