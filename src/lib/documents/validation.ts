import {
  ACCEPTED_EXTENSION_SET,
  DOCUMENT_ENTITY_TYPES,
  DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  type DocumentEntityType,
  type DocumentType,
} from "@/lib/documents/types";

/** MIME types allowed for each extension. Empty browser MIME is tolerated. */
const EXTENSION_MIME_MAP: Record<string, readonly string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  xls: ["application/vnd.ms-excel"],
  xlsx: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
  mp4: ["video/mp4"],
  mov: ["video/quicktime"],
};

const CONTRACT_ATTACH_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "jpg",
  "jpeg",
  "png",
  "webp",
]);

export const CONTRACT_ATTACH_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp";

export function validateDocumentEntityType(
  value: string
): value is DocumentEntityType {
  return (DOCUMENT_ENTITY_TYPES as readonly string[]).includes(value);
}

export function validateDocumentType(value: string): value is DocumentType {
  return (DOCUMENT_TYPES as readonly string[]).includes(value);
}

export function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
  return cleaned.slice(0, 180) || "file";
}

export function getFileExtension(fileName: string): string {
  return (fileName.split(".").pop() ?? "").toLowerCase();
}

export function validateDocumentMimeType(
  fileName: string,
  mimeType: string | null | undefined
): string | null {
  const extension = getFileExtension(fileName);
  if (!ACCEPTED_EXTENSION_SET.has(extension)) {
    return "Unsupported file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG, WEBP, MP4, MOV.";
  }

  const mime = (mimeType ?? "").trim().toLowerCase();
  if (!mime || mime === "application/octet-stream") {
    return null;
  }

  const allowed = EXTENSION_MIME_MAP[extension];
  if (allowed && !allowed.includes(mime)) {
    return `MIME type "${mime}" does not match .${extension} files.`;
  }

  return null;
}

export function validateDocumentFile(file: File): string | null {
  if (!file || file.size <= 0) {
    return "File is required.";
  }

  if (file.size > MAX_DOCUMENT_BYTES) {
    return "File exceeds the 50 MB upload limit.";
  }

  const extension = getFileExtension(file.name);
  if (!ACCEPTED_EXTENSION_SET.has(extension)) {
    return "Unsupported file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG, WEBP, MP4, MOV.";
  }

  return validateDocumentMimeType(file.name, file.type);
}

/** Stricter client-side check for contract create/edit attach (no video). */
export function validateContractAttachFile(file: File): string | null {
  if (!file || file.size <= 0) {
    return "File is required.";
  }

  if (file.size > MAX_DOCUMENT_BYTES) {
    return "File exceeds the 50 MB upload limit.";
  }

  const extension = getFileExtension(file.name);
  if (!CONTRACT_ATTACH_EXTENSIONS.has(extension)) {
    return "Unsupported file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG, WEBP.";
  }

  return validateDocumentMimeType(file.name, file.type);
}

export function parseTags(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return [
    ...new Set(
      value
        .split(/[,;]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 20)
    ),
  ];
}

export function buildStoragePath(
  entityType: string,
  entityId: string,
  documentId: string,
  fileName: string
): string {
  const safeEntity = entityType.replace(/[^a-z0-9_]/gi, "_");
  const safeEntityId = entityId.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeDocId = documentId.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeName = sanitizeFileName(fileName);
  if (!safeEntityId || !safeDocId) {
    throw new Error("Invalid storage path identifiers.");
  }
  return `${safeEntity}/${safeEntityId}/${safeDocId}/${safeName}`;
}
