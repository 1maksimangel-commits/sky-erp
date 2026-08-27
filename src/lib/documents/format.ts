import {
  DOCUMENT_TYPE_LABELS,
  type DocumentEntityType,
  type DocumentType,
} from "@/lib/documents/types";

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDocumentDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function documentTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  if (value in DOCUMENT_TYPE_LABELS) {
    return DOCUMENT_TYPE_LABELS[value as DocumentType];
  }
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function entityHref(
  entityType: string | null | undefined,
  entityId: string | null | undefined
): string | null {
  if (!entityType || !entityId) return null;
  switch (entityType as DocumentEntityType | string) {
    case "business_case":
      return `/business-cases/${entityId}`;
    case "contract":
      return `/contracts/${entityId}`;
    case "shipment":
      return `/logistics/${entityId}`;
    case "invoice":
      return `/finance/invoices/${entityId}`;
    case "payment":
      return `/finance/payments/${entityId}`;
    case "company":
      return `/companies/${entityId}`;
    case "counterparty":
      return `/counterparties/${entityId}`;
    case "product":
      return `/products/${entityId}`;
    case "warehouse_lot":
      return `/warehouse/lots/${entityId}`;
    case "warehouse":
      return `/warehouse`;
    case "crm_customer":
      return `/crm/${entityId}`;
    default:
      return null;
  }
}

export function entityLabel(entityType: string | null | undefined): string {
  if (!entityType) return "Unlinked";
  return entityType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function fileTypeFromMimeOrName(
  mime: string | null | undefined,
  fileName: string | null | undefined
): string {
  const ext = fileName?.split(".").pop()?.toUpperCase();
  if (ext) return ext;
  if (!mime) return "FILE";
  if (mime === "application/pdf") return "PDF";
  if (mime.includes("word")) return "DOC";
  if (mime.includes("excel") || mime.includes("spreadsheet")) return "XLS";
  if (mime.startsWith("image/")) return "IMG";
  if (mime.startsWith("video/")) return "VID";
  return "FILE";
}

export function isPreviewableMime(mime: string | null | undefined): boolean {
  if (!mime) return false;
  return (
    mime === "application/pdf" ||
    mime.startsWith("image/") ||
    mime.startsWith("video/")
  );
}

export function previewKind(
  mime: string | null | undefined
): "pdf" | "image" | "video" | "download" {
  if (!mime) return "download";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "download";
}
