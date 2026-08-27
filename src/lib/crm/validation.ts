import {
  ACCEPTED_DOCUMENT_EXTENSIONS,
  MAX_DOCUMENT_BYTES,
} from "@/lib/documents/types";
import {
  getFileExtension,
  sanitizeFileName,
  validateDocumentFile,
  validateDocumentMimeType,
} from "@/lib/documents/validation";

/** CRM attachments use the same allowlist as DMS documents (no .gif). */
export const CRM_ATTACHMENT_ACCEPT = ACCEPTED_DOCUMENT_EXTENSIONS;

export const CRM_MAX_ATTACHMENT_BYTES = MAX_DOCUMENT_BYTES;

export {
  getFileExtension,
  sanitizeFileName,
  validateDocumentMimeType,
};

/**
 * Validate CRM attachment uploads (size, extension, MIME).
 * Aligns with DMS `validateDocumentFile`.
 */
export function validateCrmAttachmentFile(file: File): string | null {
  return validateDocumentFile(file);
}
