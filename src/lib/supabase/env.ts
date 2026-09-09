import { isPublicSupabaseKey } from "./public-key";

export type SupabasePublicEnv = {
  url: string;
  publishableKey: string;
};

export function getSupabasePublicEnv():
  | { ok: true; env: SupabasePublicEnv }
  | { ok: false; error: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

  if (!url) {
    return {
      ok: false,
      error: "NEXT_PUBLIC_SUPABASE_URL is missing or empty.",
    };
  }

  const normalizedUrl = url.replace(/\/$/, "");
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1):54321$/i.test(normalizedUrl);
  const isDevelopment = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(normalizedUrl)) {
    if (!/^https?:\/\//i.test(url) || url.includes(" ") || (isLocalhost && !isDevelopment) || (!isLocalhost && /localhost|127\.0\.0\.1/i.test(url)) || (!isDevelopment && !/^https:\/\//i.test(url))) {
      return {
        ok: false,
        error: "NEXT_PUBLIC_SUPABASE_URL is malformed or points at a disallowed local endpoint.",
      };
    }
  }

  if (!publishableKey) {
    return {
      ok: false,
      error: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing or empty.",
    };
  }

  if (!isPublicSupabaseKey(publishableKey)) {
    return {
      ok: false,
      error:
        "Refusing to use a service_role/secret key in the Next.js Supabase client.",
    };
  }

  return {
    ok: true,
    env: {
      url: url.replace(/\/$/, ""),
      publishableKey,
    },
  };
}
