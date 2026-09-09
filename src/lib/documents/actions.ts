"use server";

import { randomUUID } from "crypto";
import { companyStoragePath } from "@/lib/documents/storage-scope";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getDocumentVersions, getEntityDocuments } from "@/lib/documents/db";
import type {
  DocumentUploadInput,
  DocumentVersion,
  ErpDocument,
} from "@/lib/documents/types";
import {
  buildDocumentInsertPayload,
  defaultDocumentTitleFromFileName,
  documentRelationFields,
  removeStorageObjects,
} from "@/lib/documents/upload-helpers";
import {
  buildStoragePath,
  parseTags,
  sanitizeFileName,
  validateDocumentEntityType,
  validateDocumentFile,
  validateDocumentType,
} from "@/lib/documents/validation";
import { logActivity } from "@/lib/platform/activity";
import { createNotification } from "@/lib/platform/notifications";
import { assertCanSignStoragePath } from "@/lib/documents/signed-url-auth";
import { assertCan } from "@/lib/platform/permissions";
import {
  logSupabaseError,
  serializeUnknownError,
} from "@/lib/platform/supabase-errors";
import { addTimelineEvent } from "@/lib/platform/timeline";

export type DocumentActionResult =
  | { success: true; id: string }
  | { success: false; error: string };

async function resolveUploadedBy(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

function revalidateDocumentPaths(entityType: string, entityId: string) {
  revalidatePath("/documents");
  const hrefByType: Record<string, string> = {
    business_case: `/business-cases/${entityId}`,
    contract: `/contracts/${entityId}`,
    shipment: `/logistics/${entityId}`,
    invoice: `/finance/invoices/${entityId}`,
    payment: `/finance/payments/${entityId}`,
    company: `/companies/${entityId}`,
    counterparty: `/counterparties/${entityId}`,
    product: `/products/${entityId}`,
    warehouse_lot: `/warehouse/lots/${entityId}`,
    crm_customer: `/crm/${entityId}`,
  };
  const path = hrefByType[entityType];
  if (path) revalidatePath(path);
  if (entityType === "contract") {
    revalidatePath(`/contracts/${entityId}/documents`);
  }
}

async function recordDocumentEvent(input: {
  entityType: string;
  entityId: string;
  documentId: string;
  action: string;
  eventType: string;
  title: string;
  summary: string;
  fileName?: string;
}) {
  await Promise.allSettled([
    logActivity({
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      summary: input.summary,
      newValue: {
        document_id: input.documentId,
        file_name: input.fileName ?? null,
      },
    }),
    addTimelineEvent({
      entityType: input.entityType,
      entityId: input.entityId,
      eventType: input.eventType,
      title: input.title,
      description: input.fileName ?? input.summary,
      relatedEntityType: "document",
      relatedEntityId: input.documentId,
    }),
    createNotification({
      title: input.title,
      body: input.fileName ?? input.summary,
      category: "document",
      entityType: input.entityType,
      entityId: input.entityId,
      href: "/documents",
    }),
  ]);
}

export async function uploadDocument(
  input: DocumentUploadInput
): Promise<DocumentActionResult> {
  const denied = await assertCan("documents.write");
  if (denied) return { success: false, error: denied };

  if (!validateDocumentEntityType(input.entityType)) {
    return { success: false, error: "Unsupported entity type for documents." };
  }
  if (!input.entityId?.trim()) {
    return { success: false, error: "Entity id is required." };
  }
  const titleFromForm = input.formData.get("title");
  const title =
    input.title?.trim() ||
    (typeof titleFromForm === "string" ? titleFromForm.trim() : "") ||
    "";

  const typeFromForm = input.formData.get("document_type");
  const requestedDocumentType =
    input.documentType ||
    (typeof typeFromForm === "string" ? typeFromForm : "");
  const documentTypeAliases: Record<string, string> = {
    commercial_invoice: "invoice",
    proforma_invoice: "invoice",
    specification: "supplement",
    annex: "supplement",
    bill_of_lading: "bl",
    certificate_of_origin: "certificate",
    health_certificate: "certificate",
    veterinary_certificate: "certificate",
  };
  const documentType =
    documentTypeAliases[requestedDocumentType] ?? requestedDocumentType;
  if (!validateDocumentType(documentType)) {
    return { success: false, error: "Document type is required." };
  }

  const file = input.formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "File is required." };
  }
  const fileError = validateDocumentFile(file);
  if (fileError) return { success: false, error: fileError };

  const tagsFromForm = input.formData.get("tags");
  const notesFromForm = input.formData.get("notes");
  const versionFromForm = input.formData.get("version");
  const tags =
    input.tags ??
    parseTags(typeof tagsFromForm === "string" ? tagsFromForm : "");
  const notes =
    input.notes?.trim() ||
    (typeof notesFromForm === "string" ? notesFromForm.trim() : "") ||
    null;
  const version =
    input.version ??
    (typeof versionFromForm === "string" && versionFromForm
      ? Number(versionFromForm) || 1
      : 1);

  const documentId = randomUUID();
  const safeName = sanitizeFileName(file.name);
  const resolvedTitle = title || defaultDocumentTitleFromFileName(file.name);
  const entityType = input.entityType;
  let filePath = "";

  try {
    filePath = buildStoragePath(
      entityType,
      input.entityId,
      documentId,
      safeName
    );
    filePath = await companyStoragePath(filePath, { type: entityType, id: input.entityId });
  } catch {
    return { success: false, error: "Invalid entity identifiers for storage path." };
  }

  const now = new Date().toISOString();
  let relations = documentRelationFields(input);
  const supabase = await createClient();
  const uploadedBy = await resolveUploadedBy(supabase);

  // Contracts: stamp company (and BC) from the parent row when the UI omitted them.
  if (entityType === "contract" && !relations.company_id) {
    const { data: contract } = await supabase
      .from("contracts")
      .select("id, company_id, business_case_id")
      .eq("id", input.entityId)
      .maybeSingle();
    if (contract) {
      relations = {
        ...relations,
        contract_id: contract.id,
        company_id: contract.company_id ?? null,
        business_case_id:
          relations.business_case_id ?? contract.business_case_id ?? null,
      };
    }
  }

  // Invoices: inherit company from invoice row when missing.
  if (entityType === "invoice" && !relations.company_id) {
    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, company_id, contract_id, business_case_id")
      .eq("id", input.entityId)
      .maybeSingle();
    if (invoice) {
      relations = {
        ...relations,
        invoice_id: invoice.id,
        company_id: invoice.company_id ?? null,
        contract_id: relations.contract_id ?? invoice.contract_id ?? null,
        business_case_id:
          relations.business_case_id ?? invoice.business_case_id ?? null,
      };
    }
  }

  // Shipments must stamp company/contract/BC ownership onto documents.
  if (entityType === "shipment") {
    const { data: shipment, error: shipmentError } = await supabase
      .from("shipments")
      .select("id, contract_id, business_case_id, company_id")
      .eq("id", input.entityId)
      .maybeSingle();

    if (shipmentError && !/company_id|42703|PGRST204/i.test(shipmentError.message)) {
      return { success: false, error: shipmentError.message };
    }

    let shipmentRow = shipment;
    if (!shipmentRow && shipmentError) {
      const fallback = await supabase
        .from("shipments")
        .select("id, contract_id, business_case_id")
        .eq("id", input.entityId)
        .maybeSingle();
      shipmentRow = fallback.data
        ? { ...fallback.data, company_id: null as string | null }
        : null;
    }

    if (!shipmentRow) {
      return { success: false, error: "Shipment was not found for document upload." };
    }

    let companyId = shipmentRow.company_id ?? input.companyId ?? null;
    if (!companyId && shipmentRow.contract_id) {
      const { data: contract } = await supabase
        .from("contracts")
        .select("id, company_id, business_case_id")
        .eq("id", shipmentRow.contract_id)
        .maybeSingle();
      companyId = contract?.company_id ?? null;
      relations = {
        ...relations,
        shipment_id: shipmentRow.id,
        contract_id: shipmentRow.contract_id,
        business_case_id:
          shipmentRow.business_case_id ?? contract?.business_case_id ?? null,
        company_id: companyId,
      };
    } else {
      relations = {
        ...relations,
        shipment_id: shipmentRow.id,
        contract_id: shipmentRow.contract_id,
        business_case_id: shipmentRow.business_case_id,
        company_id: companyId,
      };
    }

    if (!relations.company_id) {
      return {
        success: false,
        error:
          "Cannot attach documents: shipment has no company ownership. Set company on the contract/shipment first.",
      };
    }
  }

  try {
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      logSupabaseError("documents.uploadDocument.storage", uploadError);
      const diagnostic = serializeUnknownError(uploadError);
      const missingBucket = /bucket not found|NoSuchBucket/i.test(
        `${diagnostic.message} ${JSON.stringify(diagnostic.cause ?? "")}`
      );
      return {
        success: false,
        error: missingBucket
          ? "Storage bucket `documents` is missing. Apply supabase/migrations/20260804220000_documents_missing_columns_hotfix.sql (or 20260804210000_documents_dms_complete.sql)."
          : diagnostic.message,
      };
    }

    const payload = buildDocumentInsertPayload({
      documentId,
      entityType,
      entityId: input.entityId,
      documentType,
      title: resolvedTitle,
      safeName,
      filePath,
      mimeType: file.type || null,
      fileSize: file.size,
      version,
      tags,
      notes,
      uploadedBy,
      now,
      relations,
    });

    const { error } = await supabase.from("documents").insert(payload);

    if (error) {
      logSupabaseError("documents.uploadDocument.insert", error);
      await removeStorageObjects(supabase, [filePath]);
      return {
        success: false,
        error: /column|schema cache|42703|PGRST204/i.test(error.message)
          ? "Documents schema is incomplete. Apply supabase/migrations/20260804220000_documents_missing_columns_hotfix.sql in the Supabase SQL Editor."
          : error.message,
      };
    }

    await supabase.from("document_versions").insert({
      document_id: documentId,
      version,
      title: resolvedTitle,
      file_name: safeName,
      file_path: filePath,
      mime_type: file.type || null,
      file_size: file.size,
      notes,
      uploaded_by: uploadedBy,
      is_current: true,
      created_at: now,
    });

    await recordDocumentEvent({
      entityType,
      entityId: input.entityId,
      documentId,
      action: "document.uploaded",
      eventType: "document_uploaded",
      title: "Document uploaded",
      summary: `Document uploaded: ${resolvedTitle}`,
      fileName: safeName,
    });

    revalidateDocumentPaths(entityType, input.entityId);
    return { success: true, id: documentId };
  } catch (error) {
    await removeStorageObjects(supabase, [filePath]);
    logSupabaseError("documents.uploadDocument.throw", error);
    return { success: false, error: serializeUnknownError(error).message };
  }
}

/** List current documents linked to an entity (for edit-contract modal). */
export async function listLinkedDocuments(
  entityType: string,
  entityId: string
): Promise<{ data: ErpDocument[]; error: string | null }> {
  const result = await getEntityDocuments(entityType, entityId);
  return { data: result.data, error: result.error };
}

export async function replaceDocumentVersion(input: {
  documentId: string;
  formData: FormData;
  title?: string | null;
  notes?: string | null;
}): Promise<DocumentActionResult> {
  const denied = await assertCan("documents.write");
  if (denied) return { success: false, error: denied };

  const file = input.formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "File is required." };
  }
  const fileError = validateDocumentFile(file);
  if (fileError) return { success: false, error: fileError };

  const supabase = await createClient();
  const { data: existing, error: loadError } = await supabase
    .from("documents")
    .select(
      "id, entity_type, entity_id, title, notes, version, version_no, root_document_id, file_path, storage_path, file_name, mime_type, file_size, uploaded_by"
    )
    .eq("id", input.documentId)
    .maybeSingle();

  if (loadError || !existing) {
    return { success: false, error: loadError?.message ?? "Document not found." };
  }
  if (!existing.entity_type || !existing.entity_id) {
    return { success: false, error: "Document is missing entity linkage." };
  }

  const nextVersion =
    (Number(existing.version ?? existing.version_no ?? 1) || 1) + 1;
  const safeName = sanitizeFileName(file.name);
  const versionId = randomUUID();
  let filePath = "";

  try {
    filePath = buildStoragePath(
      existing.entity_type,
      existing.entity_id,
      existing.id,
      `${nextVersion}-${safeName}`
    );
    filePath = await companyStoragePath(filePath, { type: existing.entity_type, id: existing.entity_id });
  } catch {
    return { success: false, error: "Invalid storage path." };
  }

  const now = new Date().toISOString();
  const uploadedBy = await resolveUploadedBy(supabase);
  const title =
    input.title?.trim() ||
    (typeof input.formData.get("title") === "string"
      ? String(input.formData.get("title")).trim()
      : "") ||
    existing.title ||
    safeName;
  const notes =
    input.notes?.trim() ||
    (typeof input.formData.get("notes") === "string"
      ? String(input.formData.get("notes")).trim()
      : "") ||
    existing.notes ||
    null;

  try {
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    await supabase
      .from("document_versions")
      .update({ is_current: false })
      .eq("document_id", existing.id)
      .eq("is_current", true);

    const { error: versionError } = await supabase
      .from("document_versions")
      .insert({
        id: versionId,
        document_id: existing.id,
        version: nextVersion,
        title,
        file_name: safeName,
        file_path: filePath,
        mime_type: file.type || null,
        file_size: file.size,
        notes,
        uploaded_by: uploadedBy,
        is_current: true,
        created_at: now,
      });

    if (versionError) {
      await removeStorageObjects(supabase, [filePath]);
      // Continue updating document even if versions table missing
      if (!/document_versions|schema cache|PGRST205/i.test(versionError.message)) {
        return { success: false, error: versionError.message };
      }
    }

    const { error: updateError } = await supabase
      .from("documents")
      .update({
        title,
        notes,
        file_name: safeName,
        file_path: filePath,
        storage_path: filePath,
        mime_type: file.type || null,
        file_size: file.size,
        version: nextVersion,
        version_no: nextVersion,
        uploaded_by: uploadedBy,
        uploaded_at: now,
        updated_at: now,
        is_current: true,
      })
      .eq("id", existing.id);

    if (updateError) {
      await supabase.storage.from("documents").remove([filePath]);
      return { success: false, error: updateError.message };
    }

    await recordDocumentEvent({
      entityType: existing.entity_type,
      entityId: existing.entity_id,
      documentId: existing.id,
      action: "document.replaced",
      eventType: "document_replaced",
      title: "Document replaced",
      summary: `Document replaced with version ${nextVersion}`,
      fileName: safeName,
    });

    revalidateDocumentPaths(existing.entity_type, existing.entity_id);
    return { success: true, id: existing.id };
  } catch (error) {
    if (filePath) {
      await supabase.storage.from("documents").remove([filePath]);
    }
    return { success: false, error: serializeUnknownError(error).message };
  }
}

export async function deleteDocument(
  id: string
): Promise<DocumentActionResult> {
  const denied = await assertCan("documents.write");
  if (denied) return { success: false, error: denied };

  try {
    const supabase = await createClient();
    const { data: existing, error: loadError } = await supabase
      .from("documents")
      .select("id, file_path, storage_path, entity_type, entity_id, file_name, title")
      .eq("id", id)
      .maybeSingle();

    if (loadError) return { success: false, error: loadError.message };
    if (!existing) return { success: false, error: "Document not found." };

    const { data: versions } = await supabase
      .from("document_versions")
      .select("file_path")
      .eq("document_id", id);

    const paths = new Set<string>();
    for (const version of versions ?? []) {
      if (version.file_path) paths.add(version.file_path);
    }
    const currentPath = existing.file_path || existing.storage_path;
    if (currentPath) paths.add(currentPath);

    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) return { success: false, error: error.message };

    if (paths.size) {
      await supabase.storage.from("documents").remove([...paths]);
    }

    if (existing.entity_type && existing.entity_id) {
      await recordDocumentEvent({
        entityType: existing.entity_type,
        entityId: existing.entity_id,
        documentId: id,
        action: "document.deleted",
        eventType: "document_deleted",
        title: "Document deleted",
        summary: `Document deleted: ${existing.title || existing.file_name}`,
        fileName: existing.file_name ?? undefined,
      });
      revalidateDocumentPaths(existing.entity_type, existing.entity_id);
    } else {
      revalidatePath("/documents");
    }

    return { success: true, id };
  } catch (error) {
    return { success: false, error: serializeUnknownError(error).message };
  }
}

export async function recordDocumentDownload(input: {
  documentId: string;
  entityType?: string | null;
  entityId?: string | null;
  fileName?: string | null;
}): Promise<{ error: string | null }> {
  if (!input.entityType || !input.entityId) {
    return { error: null };
  }

  await recordDocumentEvent({
    entityType: input.entityType,
    entityId: input.entityId,
    documentId: input.documentId,
    action: "document.downloaded",
    eventType: "document_downloaded",
    title: "Document downloaded",
    summary: `Document downloaded: ${input.fileName ?? input.documentId}`,
    fileName: input.fileName ?? undefined,
  });

  return { error: null };
}

export async function fetchDocumentVersions(
  documentId: string
): Promise<{ data: DocumentVersion[]; error: string | null }> {
  return getDocumentVersions(documentId);
}

export async function getSignedUrlForPath(
  filePath: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    const authorized = await assertCanSignStoragePath(filePath);
    if (!authorized.ok) {
      return { url: null, error: authorized.error };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(filePath, 60 * 60);
    if (error) return { url: null, error: error.message };
    return { url: data?.signedUrl ?? null, error: null };
  } catch (error) {
    return { url: null, error: serializeUnknownError(error).message };
  }
}

/** Compatibility wrapper */
export async function uploadEntityDocument(
  input: DocumentUploadInput
): Promise<DocumentActionResult> {
  return uploadDocument(input);
}
