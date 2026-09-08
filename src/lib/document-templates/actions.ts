"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertCan } from "@/lib/platform/permissions";
import { DOCUMENT_TEMPLATE_TYPES, type DocumentTemplate, type DocumentTemplateType } from "./types";
import PizZip from "pizzip";

const MAX_TEMPLATE_BYTES = 25 * 1024 * 1024;

function isTemplateType(value: string): value is DocumentTemplateType {
  return (DOCUMENT_TEMPLATE_TYPES as readonly string[]).includes(value);
}

function table(client: Awaited<ReturnType<typeof createClient>>) {
  return client.from("document_templates" as never);
}

export async function listDocumentTemplates(companyId?: string | null) {
  const client = await createClient();
  let query = table(client).select("*").order("document_type").order("version", { ascending: false });
  if (companyId) query = query.or(`company_id.eq.${companyId},company_id.is.null`);
  const { data, error } = await query;
  const rawTemplates = (data ?? []) as unknown as DocumentTemplate[];
  const ids = rawTemplates.map((item) => item.id);
  const { data: mappings } = ids.length ? await client.from("template_mappings" as never).select("template_id").in("template_id", ids) : { data: [] as Array<{ template_id: string }> };
  const configured = new Set((mappings ?? []).map((item) => String((item as { template_id: string }).template_id)));
  const templates = rawTemplates.map((item) => ({ ...item, status: (configured.has(item.id) ? "Ready" : "Unconfigured") as "Ready" | "Unconfigured" }));
  return { data: templates, error: error?.message ?? null };
}

export async function uploadDocumentTemplate(formData: FormData) {
  const denied = assertCan("documents.write");
  if (denied) return { success: false as const, error: denied };
  const documentType = String(formData.get("documentType") ?? "");
  const name = String(formData.get("name") ?? "");
  const language = String(formData.get("language") ?? "en");
  const companyIdValue = formData.get("companyId");
  const companyId = typeof companyIdValue === "string" && companyIdValue.trim() ? companyIdValue : null;
  const fileValue = formData.get("file");
  if (!isTemplateType(documentType)) return { success: false as const, error: "Unsupported template type." };
  if (!(fileValue instanceof File) || fileValue.size === 0) return { success: false as const, error: "Choose a DOCX file first." };
  const file = fileValue;
  if (!/\.(docx|dotx)$/i.test(file.name)) return { success: false as const, error: "Only DOCX or DOTX Word templates are supported." };
  if (file.size > MAX_TEMPLATE_BYTES) return { success: false as const, error: "Template is too large (maximum 25 MB)." };
  const client = await createClient();
  const companyPart = companyId ?? "global";
  const path = `templates/${companyPart}/${documentType}/${randomUUID()}.docx`;
  const bytes = await file.arrayBuffer();
  const contentType = file.name.toLowerCase().endsWith(".dotx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.template" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const { error: storageError } = await client.storage.from("documents").upload(path, bytes, { contentType, upsert: false });
  if (storageError) return { success: false as const, error: storageError.message };
  const existing = await table(client).select("version").eq("document_type", documentType).eq("company_id", companyId).order("version", { ascending: false }).limit(1);
  const version = Number(((existing.data?.[0] as { version?: number } | undefined)?.version ?? 0)) + 1;
  const user = await client.auth.getUser();
  const latest = await table(client).select("id").eq("document_type", documentType).eq("company_id", companyId).order("version", { ascending: false }).limit(1);
  const supersedesId = (latest.data?.[0] as { id?: string } | undefined)?.id ?? null;
  const { data, error } = await table(client).insert({ company_id: companyId, document_type: documentType, name: name.trim() || file.name, storage_path: path, version, language: language.trim() || "en", is_active: true, supersedes_id: supersedesId, uploaded_by: user.data.user?.id ?? null, change_reason: String(formData.get("changeReason") ?? "") || null, is_default: formData.get("isDefault") === "true" }).select("id").single();
  if (error) {
    await client.storage.from("documents").remove([path]);
    return { success: false as const, error: error.message };
  }
  revalidatePath("/document-templates");
  return { success: true as const, id: String((data as unknown as { id: string }).id) };
}

export async function createTextDocumentTemplate(input: {
  documentType: DocumentTemplateType;
  name: string;
  language: string;
  content: string;
  isDefault: boolean;
}) {
  const denied = assertCan("documents.write");
  if (denied) return { success: false as const, error: denied };
  if (!input.name.trim() || !input.content.trim()) return { success: false as const, error: "Template name and content are required." };
  const client = await createClient();
  const existing = await table(client).select("version").eq("document_type", input.documentType).is("company_id", null).order("version", { ascending: false }).limit(1);
  const version = Number(((existing.data?.[0] as { version?: number } | undefined)?.version ?? 0)) + 1;
  const { data, error } = await table(client).insert({ document_type: input.documentType, name: input.name.trim(), language: input.language.trim() || "en", version, template_content: input.content, is_default: input.isDefault, is_active: true }).select("id").single();
  if (error) return { success: false as const, error: error.message };
  revalidatePath("/document-templates");
  return { success: true as const, id: String((data as unknown as { id: string }).id) };
}

export async function deleteDocumentTemplate(id: string) {
  const denied = assertCan("documents.write");
  if (denied) return { success: false as const, error: denied };
  const client = await createClient();
  const found = await table(client).select("storage_path").eq("id", id).maybeSingle();
  if (found.error || !found.data) return { success: false as const, error: found.error?.message ?? "Template not found." };
  const { error } = await table(client).delete().eq("id", id);
  if (error) return { success: false as const, error: error.message };
  await client.storage.from("documents").remove([String((found.data as { storage_path: string }).storage_path)]);
  revalidatePath("/document-templates");
  return { success: true as const };
}

export async function setDefaultDocumentTemplate(id: string) {
  const denied = assertCan("documents.write");
  if (denied) return { success: false as const, error: denied };
  const client = await createClient();
  const { error } = await table(client).update({ is_default: true }).eq("id", id);
  if (error) return { success: false as const, error: error.message };
  revalidatePath("/document-templates");
  return { success: true as const };
}

export async function setDocumentTemplateActive(id: string, isActive: boolean) {
  const denied = assertCan("documents.write");
  if (denied) return { success: false as const, error: denied };
  const client = await createClient();
  const { error } = await table(client).update({ is_active: isActive }).eq("id", id);
  if (error) return { success: false as const, error: error.message };
  revalidatePath("/document-templates");
  return { success: true as const };
}

export async function getDefaultDocumentTemplate(documentType: DocumentTemplateType, companyId?: string | null) {
  const client = await createClient();
  const lookupTypes = documentType === "supplement" ? ["supplement", "annex"] : [documentType];
  const base = () => table(client).select("*").in("document_type", lookupTypes).eq("is_default", true).eq("is_active", true).order("document_type").limit(1);
  if (companyId) {
    const companyResult = await base().eq("company_id", companyId).maybeSingle();
    if (companyResult.data) return companyResult.data as unknown as DocumentTemplate;
  }
  const globalResult = await base().is("company_id", null).maybeSingle();
  return (globalResult.data ?? null) as unknown as DocumentTemplate | null;
}

export async function discoverTemplatePlaceholders(id: string) {
  const client = await createClient();
  const { data, error } = await table(client).select("storage_path").eq("id", id).maybeSingle();
  if (error || !data) return { data: [] as string[], error: error?.message ?? "Template not found." };
  const path = String((data as { storage_path: string }).storage_path);
  const downloaded = await client.storage.from("documents").download(path);
  if (downloaded.error || !downloaded.data) return { data: [] as string[], error: downloaded.error?.message ?? "Template file unavailable." };
  const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
  const zip = new PizZip(bytes);
  const text = zip.file("word/document.xml")?.asText() ?? "";
  return { data: [...new Set([...text.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((match) => match[1].trim()))], error: null };
}

export async function configureDocumentTemplate(input: { templateId: string; mappings: Array<{ placeholder: string; skyVariable: string | null; isRepeatingProductRow?: boolean }> }) {
  const denied = assertCan("documents.write");
  if (denied) return { success: false as const, error: denied };
  const client = await createClient();
  const rows = input.mappings.map((mapping) => ({ template_id: input.templateId, placeholder: mapping.placeholder, sky_variable: mapping.skyVariable || null, is_repeating_product_row: Boolean(mapping.isRepeatingProductRow) }));
  const mappingResult = await client.from("template_mappings" as never).delete().eq("template_id", input.templateId);
  const mappingTableAvailable = !mappingResult.error || !/schema cache|relation .* does not exist|could not find/i.test(mappingResult.error.message);
  if (mappingTableAvailable && rows.length) {
    const { error } = await client.from("template_mappings" as never).insert(rows);
    if (error) return { success: false as const, error: error.message };
  }
  revalidatePath("/document-templates");
  return { success: true as const };
}

export async function getTemplateMappings(templateId: string) {
  const client = await createClient();
  const { data, error } = await client.from("template_mappings" as never).select("placeholder,sky_variable,is_repeating_product_row").eq("template_id", templateId).order("placeholder");
  return { data: (data ?? []) as Array<{ placeholder: string; sky_variable: string | null; is_repeating_product_row: boolean }>, error: error?.message ?? null };
}
