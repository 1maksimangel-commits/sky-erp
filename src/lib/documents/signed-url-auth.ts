import { createClient } from "@/lib/supabase/server";
import {
  assertCompanyAccess,
  assertCompanyAccessWith,
  getActiveCompanyId,
} from "@/lib/platform/company-scope";
import { assertCan } from "@/lib/platform/permissions";

export type RegisteredStorageOwner = {
  source: "documents" | "document_versions" | "crm_attachments";
  /** Primary document / attachment id when known. */
  recordId: string;
  companyId: string | null;
};

/**
 * Reject path traversal and absolute/escaped paths before any storage call.
 */
export function isValidStorageObjectPath(filePath: string): boolean {
  const path = filePath?.trim() ?? "";
  if (!path) return false;
  if (path.includes("..")) return false;
  if (path.startsWith("/") || path.startsWith("\\")) return false;
  if (path.includes("\0")) return false;
  return true;
}

/**
 * Pure ownership gate for signed URLs (testable).
 * When an active company is set, the record must carry a matching company_id.
 */
export function authorizeStoragePathOwnership(
  activeCompanyId: string | null | undefined,
  recordCompanyId: string | null | undefined
): string | null {
  return assertCompanyAccessWith(activeCompanyId, recordCompanyId);
}

/**
 * Filter document rows that may receive signed URLs under the active company.
 */
export function filterOwnedDocumentsForSigning<
  T extends { company_id?: string | null },
>(
  documents: T[],
  activeCompanyId: string | null | undefined = getActiveCompanyId()
): T[] {
  return documents.filter(
    (doc) =>
      authorizeStoragePathOwnership(activeCompanyId, doc.company_id) === null
  );
}

/**
 * Resolve a storage path to a registered owner (documents, versions, or CRM).
 * Unregistered paths are not signable.
 */
export async function resolveRegisteredStorageOwner(
  filePath: string
): Promise<
  | { ok: true; owner: RegisteredStorageOwner }
  | { ok: false; error: string }
> {
  if (!isValidStorageObjectPath(filePath)) {
    return { ok: false, error: "Invalid file path." };
  }

  const supabase = await createClient();

  const { data: byFilePath, error: filePathError } = await supabase
    .from("documents")
    .select("id, company_id")
    .eq("file_path", filePath)
    .limit(1)
    .maybeSingle();

  if (filePathError) {
    return { ok: false, error: filePathError.message };
  }
  if (byFilePath) {
    return {
      ok: true,
      owner: {
        source: "documents",
        recordId: String(byFilePath.id),
        companyId: (byFilePath.company_id as string | null) ?? null,
      },
    };
  }

  const { data: byStoragePath, error: storagePathError } = await supabase
    .from("documents")
    .select("id, company_id")
    .eq("storage_path", filePath)
    .limit(1)
    .maybeSingle();

  if (storagePathError) {
    return { ok: false, error: storagePathError.message };
  }
  if (byStoragePath) {
    return {
      ok: true,
      owner: {
        source: "documents",
        recordId: String(byStoragePath.id),
        companyId: (byStoragePath.company_id as string | null) ?? null,
      },
    };
  }

  const { data: versionRow, error: versionError } = await supabase
    .from("document_versions")
    .select("id, document_id, file_path")
    .eq("file_path", filePath)
    .limit(1)
    .maybeSingle();

  if (versionError) {
    // Versions table may be missing on older schemas — continue to CRM lookup.
    if (
      !/does not exist|PGRST205|schema cache|relation/i.test(versionError.message)
    ) {
      return { ok: false, error: versionError.message };
    }
  } else if (versionRow?.document_id) {
    const { data: parent, error: parentError } = await supabase
      .from("documents")
      .select("id, company_id")
      .eq("id", versionRow.document_id)
      .maybeSingle();

    if (parentError) {
      return { ok: false, error: parentError.message };
    }
    if (parent) {
      return {
        ok: true,
        owner: {
          source: "document_versions",
          recordId: String(parent.id),
          companyId: (parent.company_id as string | null) ?? null,
        },
      };
    }
  }

  const { data: crmAttachment, error: crmError } = await supabase
    .from("crm_attachments")
    .select("id, customer_id, file_path")
    .eq("file_path", filePath)
    .limit(1)
    .maybeSingle();

  if (crmError) {
    if (!/does not exist|PGRST205|schema cache|relation/i.test(crmError.message)) {
      return { ok: false, error: crmError.message };
    }
  } else if (crmAttachment?.customer_id) {
    const { data: customer, error: customerError } = await supabase
      .from("crm_customers")
      .select("id, company_id")
      .eq("id", crmAttachment.customer_id)
      .maybeSingle();

    if (customerError) {
      return { ok: false, error: customerError.message };
    }
    if (customer) {
      return {
        ok: true,
        owner: {
          source: "crm_attachments",
          recordId: String(crmAttachment.id),
          companyId: (customer.company_id as string | null) ?? null,
        },
      };
    }
  }

  return {
    ok: false,
    error: "Document path is not registered; signed URL denied.",
  };
}

/**
 * Full gate before createSignedUrl: permission + registration + company ownership.
 */
export async function assertCanSignStoragePath(
  filePath: string
): Promise<
  | { ok: true; owner: RegisteredStorageOwner }
  | { ok: false; error: string }
> {
  const denied = assertCan("documents.read");
  if (denied) {
    return { ok: false, error: denied };
  }

  const resolved = await resolveRegisteredStorageOwner(filePath);
  if (!resolved.ok) {
    return resolved;
  }

  const companyDenied = assertCompanyAccess(resolved.owner.companyId);
  if (companyDenied) {
    return { ok: false, error: companyDenied };
  }

  return resolved;
}
