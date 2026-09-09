"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertCan } from "@/lib/platform/permissions";
import { z } from "zod";

export type GeneratedHistory = { id: string; document_type: string; document_number: string; source_template_id: string; version: number; status: "Draft" | "Final" | "Issued"; created_at: string };
export async function listGeneratedDocuments(contractId: string) {
  const client = await createClient();
  const valid = z.string().uuid().safeParse(contractId);
  if (!valid.success) return { data: [] as GeneratedHistory[], error: "Select a Contract." };
  const { data, error } = await client.from("generated_documents").select("id,document_type,document_number,source_template_id,version,status,created_at").eq("contract_id", contractId).order("created_at", { ascending: false });
  return { data: (data ?? []) as GeneratedHistory[], error: error?.message ?? null };
}
export async function setGeneratedDocumentStatus(id: string, status: "Final" | "Issued") {
  const denied = await assertCan("documents.write");
  if (denied) return { success: false as const, error: denied };
  const valid = z.object({ id: z.string().uuid(), status: z.enum(["Final", "Issued"]) }).safeParse({ id, status });
  if (!valid.success) return { success: false as const, error: "Invalid document status." };
  const client = await createClient();
  const { data, error } = await client.from("generated_documents").update({ status }).eq("id", id).eq("status", status === "Final" ? "Draft" : "Final").select("id").maybeSingle();
  revalidatePath("/documents/generate");
  return error || !data ? { success: false as const, error: error?.message ?? "Document is unavailable or its status changed." } : { success: true as const };
}
export async function finalizeGeneratedDocument(id: string) { return setGeneratedDocumentStatus(id, "Final"); }
// Retained exports reject the former client-supplied snapshot write path.
export async function createGenerationBatch(_dealId?: string | null) { void _dealId; return { success: false as const, error: "Use the reviewed document generation screen." }; }
export async function saveGenerationDraft(_batchId: string, _input: unknown) { void _batchId; void _input; return { success: false as const, error: "Review and generate a retained DOCX from its Contract." }; }
export async function createGeneratedDocumentVersion(_id: string) { void _id; return { success: false as const, error: "Choose New Version in document history to review and regenerate its DOCX." }; }
