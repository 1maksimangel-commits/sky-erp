/**
 * Compatibility bridge — prefer `@/lib/documents/db` for new code.
 */
import {
  getDocumentSignedUrls,
  getEntityDocuments as getEntityDocumentsCore,
  listDocuments as listDocumentsCore,
  normalizeDocument,
  type DocumentsQueryResult,
} from "@/lib/documents/db";
import type { ErpDocument } from "@/lib/documents/types";

/** @deprecated Use ErpDocument from @/lib/documents/types */
export type PlatformDocument = ErpDocument;

export type { DocumentsQueryResult };

export async function listDocuments(limit = 100): Promise<DocumentsQueryResult> {
  return listDocumentsCore({ limit });
}

export async function getEntityDocuments(
  entityType: string,
  entityId: string
): Promise<DocumentsQueryResult> {
  return getEntityDocumentsCore(entityType, entityId);
}

export async function getDocumentPreviewUrls(
  documents: ErpDocument[]
): Promise<{ urls: Record<string, string>; error: string | null }> {
  return getDocumentSignedUrls(documents);
}

export { normalizeDocument };
