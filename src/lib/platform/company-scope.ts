import { getCurrentRole } from "./permissions";

/**
 * Active company for the current request/session.
 *
 * Until real auth/middleware lands:
 * - `SKY_ACTIVE_COMPANY_ID` may pin a company for local/manual scoping
 * - `null` means unrestricted (admin/dev pre-auth mode)
 */
export function getActiveCompanyId(): string | null {
  const fromEnv = process.env.SKY_ACTIVE_COMPANY_ID?.trim();
  return fromEnv || null;
}

export function isUnrestrictedCompanyScope(): boolean {
  if (getActiveCompanyId()) {
    return false;
  }
  return getCurrentRole() === "admin";
}

/** Pure helper — testable without env/role stubs. */
export function assertCompanyAccessWith(
  activeCompanyId: string | null | undefined,
  recordCompanyId: string | null | undefined
): string | null {
  const active = activeCompanyId?.trim() || null;
  if (!active) {
    return null;
  }
  if (!recordCompanyId?.trim()) {
    return "Record has no company ownership.";
  }
  if (recordCompanyId.trim() !== active) {
    return "Access denied for this company.";
  }
  return null;
}

/** Pure helper — testable without env/role stubs. */
export function resolveWritableCompanyIdWith(
  activeCompanyId: string | null | undefined,
  requestedCompanyId: string | null | undefined
): { ok: true; companyId: string | null } | { ok: false; error: string } {
  const active = activeCompanyId?.trim() || null;
  const requested = requestedCompanyId?.trim() || null;

  if (active) {
    if (requested && requested !== active) {
      return {
        ok: false,
        error: "Cannot write data for another company.",
      };
    }
    return { ok: true, companyId: active };
  }

  return { ok: true, companyId: requested };
}

/**
 * Deny cross-company access when an active company is set.
 * Returns an error message or null when access is allowed.
 */
export function assertCompanyAccess(
  recordCompanyId: string | null | undefined
): string | null {
  return assertCompanyAccessWith(getActiveCompanyId(), recordCompanyId);
}

/**
 * Resolve the company id that may be written for a create/update.
 * When active company is set, client-supplied company must match (or be empty).
 */
export function resolveWritableCompanyId(
  requestedCompanyId: string | null | undefined
): { ok: true; companyId: string | null } | { ok: false; error: string } {
  return resolveWritableCompanyIdWith(
    getActiveCompanyId(),
    requestedCompanyId
  );
}
