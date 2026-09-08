"use server";
import { createClient } from "@/lib/supabase/server";
import { assertCan } from "@/lib/platform/permissions";
import { createImmutableSnapshot } from "@/lib/document-templates/engine";

type Input = { documentType: string; templateId: string; dealId?: string | null; documentNumber?: string | null; rendered: string; canonical: unknown; overrides?: unknown; calculated?: unknown; docxStoragePath?: string | null };

export async function createGenerationBatch(dealId?: string | null) {
  const denied = assertCan("documents.write"); if (denied) return { success: false as const, error: denied };
  const client = await createClient(); const batchNumber = `GEN-${new Date().toISOString().slice(0,10).replaceAll("-", "")}-${Math.floor(Math.random()*900+100)}`;
  const { data, error } = await client.from("document_generation_batches" as never).insert({ batch_number: batchNumber, deal_id: dealId ?? null }).select("id,batch_number").single();
  if (error || !data) return { success: false as const, error: error?.message ?? "Unable to create generation batch." };
  return { success: true as const, id: String((data as { id: string }).id), batchNumber };
}

export async function saveGenerationDraft(batchId: string, input: Input) {
  const denied = assertCan("documents.write"); if (denied) return { success: false as const, error: denied };
  const client = await createClient(); const snapshot = createImmutableSnapshot({ templateId: input.templateId, dealId: input.dealId ?? null, canonical: input.canonical, overrides: input.overrides ?? {}, calculated: input.calculated ?? {}, rendered: input.rendered }, "Draft", 1);
  const { data, error } = await client.from("generated_documents" as never).insert({ batch_id: batchId, document_type: input.documentType, source_template_id: input.templateId, deal_id: input.dealId ?? null, document_number: input.documentNumber ?? null, title: input.documentNumber ?? input.documentType, status: "Draft", version: 1, snapshot_data: snapshot.snapshot, snapshot_hash: snapshot.hash, docx_storage_path: input.docxStoragePath ?? null }).select("id").single();
  if (error || !data) return { success: false as const, error: error?.message ?? "Unable to save draft." };
  return { success: true as const, id: String((data as { id: string }).id) };
}

export async function finalizeGeneratedDocument(id: string) {
  const denied = assertCan("documents.write"); if (denied) return { success: false as const, error: denied };
  const client = await createClient(); const { data: current, error: loadError } = await client.from("generated_documents" as never).select("status").eq("id", id).maybeSingle();
  if (loadError || !current) return { success: false as const, error: loadError?.message ?? "Document not found." };
  if ((current as { status: string }).status !== "Draft") return { success: false as const, error: "Only Draft documents can be finalized." };
  const { error } = await client.from("generated_documents" as never).update({ status: "Final", finalized_at: new Date().toISOString() }).eq("id", id).eq("status", "Draft");
  return error ? { success: false as const, error: error.message } : { success: true as const };
}

export async function createGeneratedDocumentVersion(id: string) {
  const denied = assertCan("documents.write"); if (denied) return { success: false as const, error: denied };
  const client = await createClient(); const { data: previous, error } = await client.from("generated_documents" as never).select("*").eq("id", id).maybeSingle();
  if (error || !previous) return { success: false as const, error: error?.message ?? "Document not found." };
  const row = previous as Record<string, unknown>; if (row.status !== "Final") return { success: false as const, error: "Only Final documents can create a new version." };
  const { data: latest } = await client.from("generated_documents" as never).select("version").eq("batch_id", row.batch_id as string).eq("document_type", row.document_type as string).order("version", { ascending: false }).limit(1);
  const version = Number((latest?.[0] as { version?: number } | undefined)?.version ?? 1) + 1;
  const { data: created, error: insertError } = await client.from("generated_documents" as never).insert({ batch_id: row.batch_id, document_type: row.document_type, source_template_id: row.source_template_id, deal_id: row.deal_id, document_number: row.document_number, title: row.title, status: "Draft", version, snapshot_data: row.snapshot_data, snapshot_hash: row.snapshot_hash, docx_storage_path: row.docx_storage_path, pdf_storage_path: row.pdf_storage_path, supersedes_id: id }).select("id").single();
  return insertError || !created ? { success: false as const, error: insertError?.message ?? "Unable to create version." } : { success: true as const, id: String((created as { id: string }).id), version };
}
