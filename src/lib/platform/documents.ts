"use server";

import {
  deleteDocument as deleteDocumentCore,
  uploadDocument,
} from "@/lib/documents/actions";
import type { DocumentUploadInput } from "@/lib/documents/types";

export type DocumentActionResult =
  | { success: true; id: string }
  | { success: false; error: string };

/** Compatibility wrapper for existing entity panels. */
export async function uploadEntityDocument(
  input: DocumentUploadInput
): Promise<DocumentActionResult> {
  return uploadDocument(input);
}

export async function deleteDocument(
  id: string
): Promise<DocumentActionResult> {
  return deleteDocumentCore(id);
}
