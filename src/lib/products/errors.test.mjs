import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Mirror of formatProductActionError from errors.ts.
 * Plain ESM for `node --test` (no bundler / no dependency install).
 */

function isUniqueViolation(error) {
  return (
    error.code === "23505" || /unique|duplicate/i.test(error.message ?? "")
  );
}

function causeText(error) {
  if (!error || typeof error !== "object") return null;
  const cause = error.cause;
  if (!cause) return null;
  if (typeof cause === "string") return cause;
  if (typeof cause === "object") {
    const parts = [
      cause.message,
      cause.code ? `code=${cause.code}` : null,
      cause.errno != null ? `errno=${cause.errno}` : null,
      cause.syscall ? `syscall=${cause.syscall}` : null,
      cause.hostname ? `host=${cause.hostname}` : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join("; ") : null;
  }
  return String(cause);
}

function formatProductActionError(error, context = "create") {
  if (!error) {
    return `Unable to ${context} product. Unknown error.`;
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  const err = error;

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

  const extras = [err.details, err.hint, cause].filter(
    (part) => Boolean(part && String(part).trim())
  );

  if (extras.length === 0) {
    return message;
  }

  return `${message} (${extras.join(" · ")})`;
}

describe("formatProductActionError", () => {
  it("rewrites bare TypeError fetch failed into a useful message", () => {
    const message = formatProductActionError(
      Object.assign(new TypeError("fetch failed"), {
        cause: { code: "ECONNRESET", message: "socket hang up" },
      })
    );
    assert.match(message, /Could not reach Supabase/);
    assert.match(message, /ECONNRESET|socket hang up/);
    assert.doesNotMatch(message, /^TypeError: fetch failed$/);
  });

  it("maps unique violations", () => {
    assert.equal(
      formatProductActionError({ code: "23505", message: "duplicate key" }),
      "SKU must be unique."
    );
  });

  it("maps RLS denial", () => {
    assert.match(
      formatProductActionError({ code: "42501", message: "permission denied" }),
      /RLS INSERT policy/
    );
  });

  it("includes PostgREST details", () => {
    const message = formatProductActionError({
      message: "Could not find the 'foo' column",
      code: "PGRST204",
      details: "column missing",
      hint: "check schema cache",
    });
    assert.match(message, /foo/);
    assert.match(message, /column missing/);
    assert.match(message, /schema cache/);
  });
});

describe("createProduct error contract (regression for args.map)", () => {
  it("formats thrown errors as strings suitable for CreateProductResult.error", () => {
    // Server actions must return { success:false, error:string } instead of
    // rethrowing — rethrows triggered Next.js "args.map is not a function".
    const result = {
      success: false,
      error: formatProductActionError(new TypeError("fetch failed")),
    };
    assert.equal(result.success, false);
    assert.equal(typeof result.error, "string");
    assert.ok(result.error.length > 0);
    assert.notEqual(result.error, "TypeError: args.map is not a function");
  });
});
