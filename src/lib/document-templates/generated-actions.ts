"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertCan } from "@/lib/platform/permissions";
import { createGeneratedDocument, createRevision, type CanonicalDocumentData, type GeneratedDocumentState } from "./generated";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "./engine";

type Result = { success: true; id: string } | { success: false; error: string };

export async function saveGeneratedDocument(input: { contractId?: string | null; businessCaseId?: string | null; documentType: string; title: string; template: string; templateVersion: number; canonical: CanonicalDocumentData; overrides?: Record<string, unknown>; pageSettings?: PageSettings; status?: "Draft" | "Final" | "Issued"; version?: number; supersedesId?: string | null }): Promise<Result> {
  const denied = assertCan("documents.write");
  if (denied) return { success: false, error: denied };
  const client = await createClient();
  const user = await client.auth.getUser();
  const generated = createGeneratedDocument({ template: input.template, templateVersion: input.templateVersion, canonical: input.canonical, overrides: input.overrides ?? {}, pageSettings: input.pageSettings ?? DEFAULT_PAGE_SETTINGS, status: input.status, version: input.version ?? (input.supersedesId ? 2 : 1), supersedesId: input.supersedesId ?? null, generatedBy: user.data.user?.id ?? null });
  const { data, error } = await client.from("generated_documents" as never).insert({ contract_id: input.contractId ?? null, business_case_id: input.businessCaseId ?? null, document_type: input.documentType, title: input.title, status: generated.status, version: generated.version, source_template_version: generated.templateVersion, snapshot_data: { canonical: generated.canonical, overrides: generated.overrides, calculated: generated.calculated, rendered: generated.rendered, pageSettings: generated.pageSettings }, snapshot_hash: String(generated.rendered.length), supersedes_id: generated.supersedesId, created_by: generated.generatedBy, issued_at: generated.status === "Issued" ? generated.createdAt : null }).select("id").single();
  if (error || !data) return { success: false, error: error?.message ?? "Unable to save generated document." };
  revalidatePath(input.contractId ? `/contracts/${input.contractId}` : "/documents");
  return { success: true, id: String((data as { id: string }).id) };
}

export async function createGeneratedRevision(previous: GeneratedDocumentState, template: string, changes: Partial<Pick<GeneratedDocumentState, "canonical" | "overrides" | "pageSettings" | "templateVersion">>): Promise<Result> {
  const revision = createRevision(previous, changes, template);
  return saveGeneratedDocument({ contractId: null, businessCaseId: null, documentType: "contract", title: `Revision v${revision.version}`, template, templateVersion: revision.templateVersion, canonical: revision.canonical, overrides: revision.overrides, pageSettings: revision.pageSettings, status: "Draft", version: revision.version, supersedesId: previous.id ?? null });
}
