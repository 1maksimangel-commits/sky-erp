/**
 * Pure error formatting for Product create/import actions.
 * Kept free of server-only imports so Node can regression-test it.
 */

function isUniqueViolation(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "23505" || /unique|duplicate/i.test(error.message ?? "")
  );
}

function causeText(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const cause = (error as { cause?: unknown }).cause;
  if (!cause) {
    return null;
  }

  if (typeof cause === "string") {
    return cause;
  }

  if (typeof cause === "object") {
    const c = cause as {
      message?: string;
      code?: string;
      errno?: string | number;
      hostname?: string;
      syscall?: string;
    };
    const parts = [
      c.message,
      c.code ? `code=${c.code}` : null,
      c.errno != null ? `errno=${c.errno}` : null,
      c.syscall ? `syscall=${c.syscall}` : null,
      c.hostname ? `host=${c.hostname}` : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join("; ") : null;
  }

  return String(cause);
}

/**
 * Turn thrown / Supabase / fetch failures into a UI-safe message.
 * Never returns empty; never relies on Next.js rethrow serialization.
 */
export function formatProductActionError(
  error: unknown,
  context: "create" | "import" | "sku-check" = "create"
): string {
  if (!error) {
    return `Unable to ${context} product. Unknown error.`;
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  const err = error as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
  };

  if (isUniqueViolation(err)) {
    return "SKU must be unique.";
  }

  if (err.code === "42501") {
    return "Permission denied inserting into products. Check RLS INSERT policy on public.products.";
  }

  if (err.code === "23502") {
    return "A required database field is missing. Check your input and try again.";
  }

  const message = (err.message ?? String(error)).trim() || "Unknown error";
  const cause = causeText(error);

  if (/fetch failed|Failed to fetch|network/i.test(message)) {
    const base =
      "Could not reach Supabase while saving the product (network/fetch failure).";
    return cause ? `${base} ${cause}` : base;
  }

  // Surface PostgREST details when present (more useful than bare TypeError).
  const extras = [err.details, err.hint, cause].filter(
    (part): part is string => Boolean(part && String(part).trim())
  );

  if (extras.length === 0) {
    return message;
  }

  return `${message} (${extras.join(" · ")})`;
}
