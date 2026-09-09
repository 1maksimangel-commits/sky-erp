import "server-only";
import { can, getAccessContext } from "./permissions";

/**
 * Active company for the current request/session.
 *
 * Verified profile selection, with database membership validation.
 * A null selection is permitted only for a global Admin without a membership.
 */
export async function getActiveCompanyId(): Promise<string | null> {
  const context = await getAccessContext();
  if (!context?.hasAccess) throw new Error("Authentication and company membership required.");
  return context.companyId;
}

export async function isUnrestrictedCompanyScope(): Promise<boolean> {
  if (await getActiveCompanyId()) {
    return false;
  }
  return (await getAccessContext())?.isAdmin === true;
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
 * Require membership in the record's company (or global Admin).
 * Returns an error message or null when access is allowed.
 */
export async function assertCompanyAccess(
  recordCompanyId: string | null | undefined
): Promise<string | null> {
  if ((await getAccessContext())?.isAdmin) return null;
  return recordCompanyId && await can("companies.read", recordCompanyId) ? null : "Access denied for this company.";
}

/**
 * Resolve the company id that may be written for a create/update.
 * Requested ownership must be accessible; otherwise use the active company.
 */
export async function resolveWritableCompanyId(
  requestedCompanyId: string | null | undefined
): Promise<{ ok: true; companyId: string | null } | { ok: false; error: string }> {
  const companyId = requestedCompanyId?.trim() || await getActiveCompanyId();
  const error = await assertCompanyAccess(companyId);
  return error ? { ok: false, error } : { ok: true, companyId };
}
