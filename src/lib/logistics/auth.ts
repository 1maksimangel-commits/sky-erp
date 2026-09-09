import {
  assertCompanyAccess,
  getActiveCompanyId,
  resolveWritableCompanyId,
} from "@/lib/platform/company-scope";
import { assertCan } from "@/lib/platform/permissions";

export async function assertLogisticsRead(
  recordCompanyId?: string | null
): Promise<string | null> {
  const denied = await assertCan("logistics.read");
  if (denied) return denied;
  return await assertCompanyAccess(recordCompanyId);
}

export async function assertLogisticsWrite(
  recordCompanyId?: string | null
): Promise<string | null> {
  const denied = await assertCan("logistics.write");
  if (denied) return denied;
  return await assertCompanyAccess(recordCompanyId);
}

/**
 * Bind write operations to the active company when company scope is enabled.
 */
export async function bindLogisticsWriteCompany(
  requestedCompanyId: string | null | undefined
): Promise<{ ok: true; companyId: string | null } | { ok: false; error: string }> {
  const denied = await assertCan("logistics.write");
  if (denied) {
    return { ok: false, error: denied };
  }
  return await resolveWritableCompanyId(requestedCompanyId);
}

export async function logisticsActiveCompanyId(): Promise<string | null> {
  return getActiveCompanyId();
}
