import type { DocumentUploadInput } from "@/lib/documents/types";
import {
  buildStoragePath,
  sanitizeFileName,
} from "@/lib/documents/validation";

export type StorageClient = {
  storage: {
    from: (bucket: string) => {
      remove: (
        paths: string[]
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
  };
};

/** Resolve typed FK columns from a document upload input. */
export function documentRelationFields(input: DocumentUploadInput) {
  const entityType = input.entityType;
  const entityId = input.entityId;
  return {
    business_case_id:
      input.businessCaseId ??
      (entityType === "business_case" ? entityId : null),
    contract_id:
      input.contractId ?? (entityType === "contract" ? entityId : null),
    shipment_id:
      input.shipmentId ?? (entityType === "shipment" ? entityId : null),
    invoice_id:
      input.invoiceId ?? (entityType === "invoice" ? entityId : null),
    payment_id:
      input.paymentId ?? (entityType === "payment" ? entityId : null),
    company_id:
      input.companyId ?? (entityType === "company" ? entityId : null),
    counterparty_id:
      input.counterpartyId ??
      (entityType === "counterparty" ? entityId : null),
    product_id:
      input.productId ?? (entityType === "product" ? entityId : null),
  };
}

export function resolveDocumentStoragePath(input: {
  entityType: string;
  entityId: string;
  documentId: string;
  fileName: string;
}): string {
  return buildStoragePath(
    input.entityType,
    input.entityId,
    input.documentId,
    sanitizeFileName(input.fileName)
  );
}

/** Build documents row payload. uploaded_by stays uuid-compatible (null when anonymous). */
export function buildDocumentInsertPayload(input: {
  documentId: string;
  entityType: string;
  entityId: string;
  documentType: string;
  title: string;
  safeName: string;
  filePath: string;
  mimeType: string | null;
  fileSize: number;
  version: number;
  tags: string[];
  notes: string | null;
  uploadedBy: string | null;
  now: string;
  relations: ReturnType<typeof documentRelationFields>;
}) {
  return {
    id: input.documentId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    document_type: input.documentType,
    title: input.title,
    file_name: input.safeName,
    file_path: input.filePath,
    storage_path: input.filePath,
    mime_type: input.mimeType,
    file_size: input.fileSize,
    version: input.version,
    version_no: input.version,
    tags: input.tags,
    notes: input.notes,
    uploaded_by: input.uploadedBy,
    created_by: input.uploadedBy,
    uploaded_at: input.now,
    created_at: input.now,
    updated_at: input.now,
    is_current: true,
    root_document_id: input.documentId,
    ...input.relations,
  };
}

export async function removeStorageObjects(
  supabase: StorageClient,
  paths: string[]
): Promise<void> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return;
  await supabase.storage.from("documents").remove(unique);
}

export function defaultDocumentTitleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").trim();
  return base || sanitizeFileName(fileName);
}
