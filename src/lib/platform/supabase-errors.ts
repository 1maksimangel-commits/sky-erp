/** Serialize Supabase / fetch failures for server logs and UI diagnostics. */
export function serializeUnknownError(error: unknown): {
  message: string;
  cause: unknown;
  code: unknown;
  details: unknown;
  hint: unknown;
  status: unknown;
} {
  if (!error || typeof error !== "object") {
    return {
      message: String(error ?? "Unknown error"),
      cause: null,
      code: null,
      details: null,
      hint: null,
      status: null,
    };
  }

  const err = error as Record<string, unknown> & {
    message?: string;
    cause?: unknown;
    code?: unknown;
    details?: unknown;
    hint?: unknown;
    status?: unknown;
  };

  const cause =
    err.cause && typeof err.cause === "object"
      ? {
          message: (err.cause as { message?: string }).message ?? String(err.cause),
          code: (err.cause as { code?: unknown }).code ?? null,
          errno: (err.cause as { errno?: unknown }).errno ?? null,
          hostname: (err.cause as { hostname?: unknown }).hostname ?? null,
          syscall: (err.cause as { syscall?: unknown }).syscall ?? null,
        }
      : (err.cause ?? null);

  return {
    message: err.message ?? String(error),
    cause,
    code: err.code ?? null,
    details: err.details ?? null,
    hint: err.hint ?? null,
    status: err.status ?? null,
  };
}

export function logSupabaseError(label: string, error: unknown): void {
  const serialized = serializeUnknownError(error);
  // Next.js throws this during static generation probes — not a Supabase failure.
  if (/Dynamic server usage/i.test(serialized.message)) {
    return;
  }

  const payload = {
    message: serialized.message,
    code: serialized.code,
    details: serialized.details,
    hint: serialized.hint,
    status: serialized.status,
    cause: serialized.cause,
  };

  // Always log a JSON string so empty PostgREST objects never appear as `{}` alone.
  console.error(`[sky-erp] ${label}`, JSON.stringify(payload, null, 2));
  if (error && typeof error === "object") {
    console.error(`[sky-erp] ${label}.raw`, {
      ...payload,
      keys: Object.keys(error as object),
    });
  }
}

export function isNextDynamicServerError(error: unknown): boolean {
  return /Dynamic server usage/i.test(serializeUnknownError(error).message);
}
