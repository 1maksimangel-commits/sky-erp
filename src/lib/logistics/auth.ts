import {
  assertCompanyAccess,
  getActiveCompanyId,
  resolveWritableCompanyId,
} from "@/lib/platform/company-scope";
import { assertCan } from "@/lib/platform/permissions";

export function assertLogisticsRead(
  recordCompanyId?: string | null
): string | null {
  const denied = assertCan("logistics.read");
  if (denied) return denied;
  return assertCompanyAccess(recordCompanyId);
}

export function assertLogisticsWrite(
  recordCompanyId?: string | null
): string | null {
  const denied = assertCan("logistics.write");
  if (denied) return denied;
  return assertCompanyAccess(recordCompanyId);
}

/**
 * Bind write operations to the active company when company scope is enabled.
 */
export function bindLogisticsWriteCompany(
  requestedCompanyId: string | null | undefined
): { ok: true; companyId: string | null } | { ok: false; error: string } {
  const denied = assertCan("logistics.write");
  if (denied) {
    return { ok: false, error: denied };
  }
  return resolveWritableCompanyId(requestedCompanyId);
}

export function logisticsActiveCompanyId(): string | null {
  return getActiveCompanyId();
}
