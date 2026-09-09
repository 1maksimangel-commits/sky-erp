import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export async function proxy(request: NextRequest) {
  const resolved = getSupabasePublicEnv();
  if (!resolved.ok) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  let response = NextResponse.next({ request });
  const client = createServerClient(resolved.env.url, resolved.env.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Validate with Supabase Auth, not an unverified cookie/session payload.
  const { data: { user }, error } = await client.auth.getUser();
  if ((!user || error) && request.nextUrl.pathname !== "/login") {
    const denied = request.nextUrl.pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Authentication required." }, { status: 401 })
      : NextResponse.redirect(new URL("/login", request.url));
    response.cookies.getAll().forEach(cookie => denied.cookies.set(cookie));
    return denied;
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
