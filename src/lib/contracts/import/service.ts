import { randomUUID } from "crypto";
import { buildImportMatches } from "@/lib/ai/contracts/match";
import { asString } from "@/lib/ai/contracts/schema";
import type {
  ContractExtractionResult,
  ContractImportMatchBundle,
} from "@/lib/ai/contracts/schema";
import { extractContractFromPdf } from "@/lib/ai/contracts/extract";
import { getActiveCompanies } from "@/lib/companies";
import type { ContractImportRecord } from "@/lib/contracts/import/types";
import { getActiveCounterparties } from "@/lib/counterparties";
import { sanitizeFileName } from "@/lib/documents/validation";
import { getProducts } from "@/lib/products";
import { createClient } from "@/lib/supabase/server";

export const MAX_CONTRACT_IMPORT_BYTES = 50 * 1024 * 1024;
export const CONTRACT_IMPORT_BUCKET = "documents";

export function logContractImport(
  stage: string,
  meta: Record<string, unknown> = {}
) {
  console.info("[contract-import]", {
    stage,
    ...meta,
    at: new Date().toISOString(),
  });
}

export function asWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function mapImportRow(row: Record<string, unknown>): ContractImportRecord {
  return {
    id: String(row.id),
    file_path: (row.file_path as string | null) ?? null,
    file_name: (row.file_name as string | null) ?? null,
    mime_type: (row.mime_type as string | null) ?? null,
    file_size: (row.file_size as number | null) ?? null,
    status: String(row.status ?? "uploaded"),
    detected_language: (row.detected_language as string | null) ?? null,
    extracted_text: (row.extracted_text as string | null) ?? null,
    extraction_json:
      (row.extraction_json as ContractExtractionResult | null) ?? null,
    match_json: (row.match_json as ContractImportMatchBundle | null) ?? null,
    warnings: asWarnings(row.warnings),
    error_message: (row.error_message as string | null) ?? null,
    created_contract_id: (row.created_contract_id as string | null) ?? null,
    created_by: (row.created_by as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    updated_at: (row.updated_at as string | null) ?? null,
  };
}

export function validateImportPdfFile(file: File): string | null {
  if (!file || file.size <= 0) return "PDF file is required.";
  if (file.size > MAX_CONTRACT_IMPORT_BYTES) {
    return "File exceeds the 50 MB upload limit.";
  }
  const mime = (file.type || "").toLowerCase();
  const safeName = sanitizeFileName(file.name);
  const looksPdf =
    mime === "application/pdf" || safeName.toLowerCase().endsWith(".pdf");
  if (!looksPdf) return "Only PDF files are allowed for import.";
  if (mime && mime !== "application/pdf" && mime !== "application/octet-stream") {
    return `Invalid MIME type "${mime}". Expected application/pdf.`;
  }
  return null;
}

/** Reads the file header and rejects non-PDF payloads (corrupt / renamed files). */
export async function validateImportPdfMagic(
  file: File | Blob
): Promise<string | null> {
  try {
    const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (header.byteLength < 4) {
      return "PDF file is empty or unreadable.";
    }
    const magic = String.fromCharCode(
      header[0],
      header[1],
      header[2],
      header[3]
    );
    if (magic !== "%PDF") {
      return "File does not appear to be a valid PDF (missing %PDF header).";
    }
    return null;
  } catch {
    return "Unable to read PDF file contents for validation.";
  }
}

export async function validateImportPdfFileStrict(
  file: File
): Promise<string | null> {
  return validateImportPdfFile(file) ?? (await validateImportPdfMagic(file));
}

export type ImportProgressEvent =
  | { stage: string; progress: number; message?: string }
  | {
      stage: "done";
      progress: 100;
      data: {
        importRecord: ContractImportRecord;
        previewUrl: string | null;
        extraction: ContractExtractionResult;
      };
    }
  | { stage: "error"; progress: number; error: string };

async function resolveUserId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

function formatDbError(error: { message: string; code?: string }): string {
  if (
    /relation|schema cache|PGRST205|does not exist|PGRST204/i.test(error.message)
  ) {
    return "Contract import tables are missing. Apply supabase/migrations/20260804230000_contract_pdf_import.sql in the Supabase SQL Editor (or `supabase db push` when the project is linked).";
  }
  if (/bucket not found|NoSuchBucket/i.test(error.message)) {
    return "Storage bucket `documents` is missing. Apply the documents DMS migrations.";
  }
  return error.message;
}

export async function persistExtractionAndMatches(input: {
  importId: string;
  extraction: ContractExtractionResult;
  warnings: string[];
}): Promise<{
  importRecord: ContractImportRecord;
  previewUrl: string | null;
}> {
  logContractImport("persist.start", { importId: input.importId });
  const supabase = await createClient();
  const [{ data: companies }, { data: counterparties }, { data: products }] =
    await Promise.all([
      getActiveCompanies(),
      getActiveCounterparties(),
      getProducts(),
    ]);

  const matches = buildImportMatches({
    extraction: input.extraction,
    companies: companies ?? [],
    counterparties: counterparties ?? [],
    products: products ?? [],
  });

  const { data: updated, error: updateError } = await supabase
    .from("contract_imports")
    .update({
      status: "review",
      detected_language: asString(input.extraction.general.language),
      extracted_text: null,
      extraction_json: input.extraction,
      match_json: matches,
      warnings: input.warnings,
      error_message: null,
    })
    .eq("id", input.importId)
    .select("*")
    .single();

  if (updateError || !updated) {
    throw new Error(
      updateError ? formatDbError(updateError) : "Failed to save extraction results."
    );
  }

  const filePath = (updated as { file_path?: string | null }).file_path;
  let previewUrl: string | null = null;
  if (filePath) {
    const { data: signed } = await supabase.storage
      .from(CONTRACT_IMPORT_BUCKET)
      .createSignedUrl(filePath, 60 * 60);
    previewUrl = signed?.signedUrl ?? null;
  }

  logContractImport("persist.done", {
    importId: input.importId,
    hasPreview: Boolean(previewUrl),
    warningCount: input.warnings.length,
  });

  return {
    importRecord: mapImportRow(updated as Record<string, unknown>),
    previewUrl,
  };
}

/** Create import row + upload PDF bytes/stream to Supabase Storage. */
export async function createImportAndStorePdf(file: File): Promise<{
  importId: string;
  filePath: string;
  fileName: string;
}> {
  const validationError = await validateImportPdfFileStrict(file);
  if (validationError) throw new Error(validationError);

  const importId = randomUUID();
  const fileName = sanitizeFileName(file.name);
  const filePath = `imports/${importId}/${fileName}`;
  const supabase = await createClient();
  const createdBy = await resolveUserId(supabase);

  logContractImport("storage.upload.start", {
    importId,
    fileName,
    bytes: file.size,
    mime: file.type || null,
  });

  const { error: uploadError } = await supabase.storage
    .from(CONTRACT_IMPORT_BUCKET)
    .upload(filePath, file, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    logContractImport("storage.upload.error", {
      importId,
      message: uploadError.message,
    });
    throw new Error(`Storage upload failed: ${formatDbError(uploadError)}`);
  }

  logContractImport("storage.upload.done", { importId, filePath });
  logContractImport("db.insert.start", { importId });

  const { error } = await supabase.from("contract_imports").insert({
    id: importId,
    file_path: filePath,
    file_name: fileName,
    mime_type: "application/pdf",
    file_size: file.size,
    status: "processing",
    created_by: createdBy,
    warnings: [],
  });

  if (error) {
    logContractImport("db.insert.error", {
      importId,
      code: error.code,
      message: error.message,
    });
    await supabase.storage.from(CONTRACT_IMPORT_BUCKET).remove([filePath]);
    throw new Error(formatDbError(error));
  }

  logContractImport("db.insert.done", { importId });
  return { importId, filePath, fileName };
}

export async function markImportFailed(importId: string, message: string) {
  logContractImport("mark_failed", { importId, message });
  const supabase = await createClient();
  await supabase
    .from("contract_imports")
    .update({ status: "failed", error_message: message })
    .eq("id", importId);
}

export async function runExtractionPipeline(input: {
  importId: string;
  file: File | Blob;
  fileName: string;
  onProgress?: (event: { stage: string; progress: number }) => void;
  signal?: AbortSignal;
}): Promise<{
  importRecord: ContractImportRecord;
  previewUrl: string | null;
  extraction: ContractExtractionResult;
}> {
  if (input.signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  input.onProgress?.({ stage: "sending_ai", progress: 45 });
  logContractImport("ai.extract.start", {
    importId: input.importId,
    fileName: input.fileName,
    bytes: input.file.size,
  });

  const extracted = await extractContractFromPdf({
    file: input.file,
    fileName: input.fileName,
    signal: input.signal,
  });

  if (!extracted.success) {
    logContractImport("ai.extract.error", {
      importId: input.importId,
      message: extracted.error,
    });
    await markImportFailed(input.importId, extracted.error);
    throw new Error(extracted.error);
  }

  logContractImport("ai.extract.done", {
    importId: input.importId,
    model: extracted.model,
    requestId: extracted.requestId,
    warningCount: extracted.warnings.length,
  });

  input.onProgress?.({ stage: "matching", progress: 80 });
  logContractImport("match.start", { importId: input.importId });

  const persisted = await persistExtractionAndMatches({
    importId: input.importId,
    extraction: extracted.extraction,
    warnings: extracted.warnings,
  });

  input.onProgress?.({ stage: "preparing_review", progress: 95 });
  logContractImport("pipeline.done", { importId: input.importId });

  return {
    ...persisted,
    extraction: extracted.extraction,
  };
}

export async function loadImportFileFromStorage(importId: string): Promise<{
  file: File;
  fileName: string;
  filePath: string;
}> {
  logContractImport("storage.download.start", { importId });
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("contract_imports")
    .select("id, file_path, file_name")
    .eq("id", importId)
    .maybeSingle();

  if (error || !row?.file_path) {
    throw new Error(
      error ? formatDbError(error) : "Import record or PDF path not found."
    );
  }

  await supabase
    .from("contract_imports")
    .update({ status: "processing", error_message: null })
    .eq("id", importId);

  const { data: blob, error: downloadError } = await supabase.storage
    .from(CONTRACT_IMPORT_BUCKET)
    .download(row.file_path);

  if (downloadError || !blob) {
    const message = downloadError
      ? `Storage download failed: ${formatDbError(downloadError)}`
      : "Failed to download uploaded PDF.";
    await markImportFailed(importId, message);
    throw new Error(message);
  }

  const fileName = row.file_name || "contract.pdf";
  const file = new File([blob], fileName, { type: "application/pdf" });
  logContractImport("storage.download.done", {
    importId,
    fileName,
    bytes: file.size,
  });
  return { file, fileName, filePath: row.file_path };
}
