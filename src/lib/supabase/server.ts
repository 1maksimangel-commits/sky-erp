import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export async function createClient() {
  const resolved = getSupabasePublicEnv();
  if (!resolved.ok) {
    throw new Error(resolved.error);
  }

  const cookieStore = await cookies();

  return createServerClient(
    resolved.env.url,
    resolved.env.publishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component — cookie writes can be ignored.
          }
        },
      },
    }
  );
}
