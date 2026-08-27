import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export function createClient() {
  const resolved = getSupabasePublicEnv();
  if (!resolved.ok) {
    throw new Error(resolved.error);
  }

  return createBrowserClient(resolved.env.url, resolved.env.publishableKey);
}
