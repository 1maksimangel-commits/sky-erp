import { createClient } from "@/lib/supabase/server";
import type { ContractDocument } from "@/lib/contracts/document-types";
import { filterOwnedDocumentsForSigning } from "@/lib/documents/signed-url-auth";
import { assertCan } from "@/lib/platform/permissions";

export type { ContractDocument } from "@/lib/contracts/document-types";
export { DOCUMENT_CATEGORIES } from "@/lib/contracts/document-types";
export type { DocumentCategory } from "@/lib/contracts/document-types";

export type ContractDocumentsResult =
  | { data: ContractDocument[]; error: null }
  | { data: null; error: string };

export async function getContractDocuments(
  _contractNumber: string,
  contractId?: string | null
): Promise<ContractDocumentsResult> {
  const supabase = await createClient();

  if (contractId) {
    const byContract = await supabase
      .from("documents")
      .select(
        "id, business_case_id, title, document_type, storage_path, mime_type, uploaded_at, company_id"
      )
      .eq("contract_id", contractId)
      .order("uploaded_at", { ascending: false, nullsFirst: false });

    if (byContract.error) return { data: null, error: byContract.error.message };
    return { data: (byContract.data ?? []) as ContractDocument[], error: null };
  }
  // Deal-only documents stay on the Deal until explicitly linked to a Contract.
  return { data: [], error: null };
}

export async function getDocumentDownloadUrls(
  documents: ContractDocument[]
): Promise<Record<string, string>> {
  if (!documents.length) {
    return {};
  }

  if (await assertCan("documents.read")) {
    return {};
  }

  const owned = await filterOwnedDocumentsForSigning(documents);
  if (!owned.length) {
    return {};
  }

  const supabase = await createClient();
  const entries = await Promise.all(
    owned.map(async (document) => {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(document.storage_path, 60 * 60);

      if (error || !data?.signedUrl) {
        return [document.id, ""] as const;
      }

      return [document.id, data.signedUrl] as const;
    })
  );

  return Object.fromEntries(
    entries.filter(([, url]) => url).map(([id, url]) => [id, url])
  );
}
