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

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url.replace(/\/$/, ""))) {
    // Allow custom domains, but reject localhost / empty / clearly malformed values.
    if (
      !/^https?:\/\//i.test(url) ||
      /localhost|127\.0\.0\.1/i.test(url) ||
      url.includes(" ")
    ) {
      return {
        ok: false,
        error: `NEXT_PUBLIC_SUPABASE_URL is malformed or points at localhost: ${url}`,
      };
    }
  }

  if (!publishableKey) {
    return {
      ok: false,
      error: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing or empty.",
    };
  }

  if (/service_role|SECRET/i.test(publishableKey)) {
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
