import { readContractDocxText, DOCX_MIME } from "@/lib/contracts/import/docx-text";
import { randomUUID, createHash } from "crypto";
import { companyStoragePath } from "@/lib/documents/storage-scope";
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
    company_id: (row.company_id as string | null) ?? null,
    file_hash: (row.file_hash as string | null) ?? null,
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
  const looksDocx = safeName.toLowerCase().endsWith(".docx");
  if (looksDocx && (!mime || mime === DOCX_MIME || mime === "application/octet-stream")) return null;
  if (!looksPdf) return "Only PDF and DOCX files are allowed for import.";
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
  const error = validateImportPdfFile(file);
  if (error) return error;
  if (file.name.toLowerCase().endsWith(".docx")) {
    try { readContractDocxText(new Uint8Array(await file.arrayBuffer())); return null; }
    catch (e) { return e instanceof Error ? e.message : "Invalid DOCX."; }
  }
  return validateImportPdfMagic(file);
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
    return "Contract import schema is incomplete. Verify the canonical database replay gate before using imports.";
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
  const results = await Promise.all([
      getActiveCompanies(),
      getActiveCounterparties(),
      getProducts(),
    ]);
  const lookupError = results.find(result => result.error)?.error;
  if (lookupError) throw new Error(`Entity matching failed: ${lookupError}`);
  const [{ data: companies }, { data: counterparties }, { data: products }] = results;

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

  const supabase = await createClient();
  const createdBy = await resolveUserId(supabase);
  if (!createdBy) throw new Error("Authenticated upload required.");
  const { data: companyId, error: companyError } = await supabase.rpc("active_company_id");
  if (companyError || !companyId) throw new Error("Select an authorized workspace before importing.");
  const mimeType = file.name.toLowerCase().endsWith(".docx") ? DOCX_MIME : "application/pdf";
  const fileHash = createHash("sha256").update(Buffer.from(await file.arrayBuffer())).digest("hex");
  const { data: existing, error: lookupError } = await supabase.from("contract_imports").select("id, file_path, file_name, created_contract_id, status, mime_type").eq("company_id", companyId).eq("file_hash", fileHash).maybeSingle();
  if (lookupError) throw new Error(formatDbError(lookupError));
  if (existing) {
    if (["uploaded", "failed"].includes(existing.status) && !existing.created_contract_id && existing.file_path) {
      const { data: retained } = await supabase.storage.from(CONTRACT_IMPORT_BUCKET).download(existing.file_path);
      if (!retained) {
        const { error: retryError } = await supabase.storage.from(CONTRACT_IMPORT_BUCKET).upload(existing.file_path, file, { contentType: existing.mime_type || mimeType, upsert: false });
        if (retryError) throw new Error("Unable to resume original upload. The registered import is retained.");
        const { error: statusError } = await supabase.from("contract_imports").update({ status: "processing", error_message: null }).eq("id", existing.id);
        if (statusError) throw new Error(formatDbError(statusError));
        return { importId: existing.id, filePath: existing.file_path, fileName: existing.file_name };
      }
    }
    throw new Error(existing.created_contract_id ? `Original already imported. Open /contracts/${existing.created_contract_id}.` : `Upload already retained. Open /contracts/import/${existing.id} to resume review or extraction.`);
  }
  const importId = randomUUID();
  const fileName = file.name;
  const filePath = await companyStoragePath(`imports/${importId}/${sanitizeFileName(file.name)}`);
  // Register immutable identity before upload. A failed upload retains its audit row.
  const { error } = await supabase.from("contract_imports").insert({
    id: importId, company_id: companyId, file_path: filePath, file_name: fileName,
    mime_type: mimeType, file_size: file.size, file_hash: fileHash,
    status: "uploaded", created_by: createdBy, warnings: [],
  });
  if (error) throw new Error(error.code === "23505" ? "This source is already registered. Open the existing import." : formatDbError(error));
  const { error: uploadError } = await supabase.storage.from(CONTRACT_IMPORT_BUCKET).upload(filePath, file, { contentType: mimeType, upsert: false });
  if (uploadError) {
    await markImportFailed(importId, "Original upload failed. Retry the original file.");
    throw new Error(`Original upload failed for import ${importId}: ${formatDbError(uploadError)}`);
  }
  const { error: processingError } = await supabase.from("contract_imports").update({ status: "processing" }).eq("id", importId);
  if (processingError) throw new Error(formatDbError(processingError));
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

  const sourceText = input.fileName.toLowerCase().endsWith(".docx") ? readContractDocxText(new Uint8Array(await input.file.arrayBuffer())) : undefined;
  const extracted = await extractContractFromPdf({
    sourceText,
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
    warnings: sourceText ? [...extracted.warnings, "DOCX text extraction does not verify image signatures, seals, or original pagination. Review the original."] : extracted.warnings,
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
    .select("id, file_path, file_name, file_hash, mime_type, created_contract_id")
    .eq("id", importId)
    .maybeSingle();

  if (error || !row?.file_path) {
    throw new Error(
      error ? formatDbError(error) : "Import record or PDF path not found."
    );
  }

  if (row.created_contract_id) throw new Error("Confirmed imports cannot be extracted again.");
  const { error: processingError } = await supabase
    .from("contract_imports")
    .update({ status: "processing", error_message: null })
    .eq("id", importId);

  if (processingError) throw new Error(formatDbError(processingError));
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

  const hash = createHash("sha256").update(Buffer.from(await blob.arrayBuffer())).digest("hex");
  if (row.file_hash && row.file_hash !== hash) throw new Error("Original document hash mismatch.");
  if (!row.file_hash) {
    const { error: hashError } = await supabase.from("contract_imports").update({ file_hash: hash }).eq("id", importId);
    if (hashError) throw new Error(formatDbError(hashError));
  }
  const fileName = row.file_name || "contract.pdf";
  const file = new File([blob], fileName, { type: row.mime_type || "application/pdf" });
  logContractImport("storage.download.done", {
    importId,
    fileName,
    bytes: file.size,
  });
  return { file, fileName, filePath: row.file_path };
}
