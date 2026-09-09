"use server";

import { createHash, randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertCan, can, getAccessContext } from "@/lib/platform/permissions";
import { DOCUMENT_TEMPLATE_TYPES, type DocumentTemplate, type DocumentTemplateType } from "./types";
import { inspectDocx, bindDocxText } from "./docx-engine";
import { isCanonicalVariable } from "./variables";
import { z } from "zod";

const uuid = z.string().uuid();
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
function table(client: Awaited<ReturnType<typeof createClient>>) { return client.from("document_templates"); }

export async function listDocumentTemplates(companyId?: string | null) {
  if (companyId && !uuid.safeParse(companyId).success) return { data: [] as DocumentTemplate[], error: "Invalid company." };
  const client = await createClient();
  let query = table(client).select("*").order("document_type").order("version", { ascending: false });
  if (companyId) query = query.or(`company_id.eq.${companyId},company_id.is.null`);
  const { data, error } = await query;
  return { data: (data ?? []) as unknown as DocumentTemplate[], error: error?.message ?? null };
}

export async function uploadDocumentTemplate(formData: FormData) {
  try {
    const documentType = String(formData.get("documentType") ?? "");
    if (!(DOCUMENT_TEMPLATE_TYPES as readonly string[]).includes(documentType)) throw new Error("Unsupported document type.");
    const name = String(formData.get("name") ?? "").trim();
    const language = String(formData.get("language") ?? "en").toLowerCase();
    const companyId = String(formData.get("companyId") ?? "") || null;
    if (!name) throw new Error("Template name is required.");
    if (!["en", "ru", "zh"].includes(language)) throw new Error("Choose English, Russian or Chinese.");
    if (companyId) uuid.parse(companyId);
    const context = await getAccessContext();
    if (!context?.hasAccess || (companyId ? !await can("documents.write", companyId) : !context.isAdmin)) throw new Error("Template access denied. Global templates require Admin.");
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size || file.size > 25 * 1024 * 1024 || !/\.docx$/i.test(file.name)) throw new Error("Choose a DOCX file, maximum 25 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const inspection = inspectDocx(bytes);
    const placeholders = inspection.placeholders.filter(key => !/^[#^/]/.test(key));
    const unknown = placeholders.filter(key => !isCanonicalVariable(key));
    const client = await createClient();
    const replacesId = String(formData.get("replacesId") ?? "") || null;
    if (replacesId) {
      uuid.parse(replacesId);
      const previous = await table(client).select("id,company_id,document_type,language").eq("id", replacesId).single();
      if (previous.error || !previous.data || previous.data.company_id !== companyId || previous.data.document_type !== documentType || previous.data.language !== language) throw new Error("Replacement must keep the original company, document type and language.");
    }
    const id = randomUUID();
    const path = `${companyId ? `companies/${companyId}` : "global"}/templates/${id}/original.docx`;
    const uploaded = await client.storage.from("documents").upload(path, bytes, { contentType: mime, upsert: false });
    if (uploaded.error) throw new Error(uploaded.error.message);
    const { error } = await table(client).insert({ id, company_id: companyId, document_type: documentType, name, language, storage_path: path,
      original_hash: hash(bytes), original_filename: file.name, original_mime_type: mime, supersedes_id: replacesId,
      uploaded_by: context.userId, is_active: true, is_default: formData.get("isDefault") === "true",
      status: unknown.length || !placeholders.length ? "Unconfigured" : "Ready", variable_schema: placeholders });
    if (error) throw new Error(error.message);
    revalidatePath("/document-templates");
    return { success: true as const, id, unknown };
  } catch (error) { return { success: false as const, error: error instanceof Error ? error.message : "Template upload failed." }; }
}

export async function createTextDocumentTemplate(_input: { documentType: DocumentTemplateType; name: string; language: string; content: string; isDefault: boolean }) {
  void _input;
  return { success: false as const, error: "Upload a DOCX to preserve Word formatting. Existing text templates remain retained." };
}
export async function deleteDocumentTemplate(id: string) { return setDocumentTemplateActive(id, false); }
export async function setDefaultDocumentTemplate(id: string) {
  const denied = await assertCan("documents.write"); if (denied) return { success: false as const, error: denied };
  const client = await createClient();
  const { data, error } = await table(client).update({ is_default: true }).eq("id", uuid.parse(id)).select("id").maybeSingle();
  revalidatePath("/document-templates");
  return error || !data ? { success: false as const, error: error?.message ?? "Template is unavailable or access was denied." } : { success: true as const };
}
export async function setDocumentTemplateActive(id: string, isActive: boolean) {
  const denied = await assertCan("documents.write"); if (denied) return { success: false as const, error: denied };
  const client = await createClient();
  const { data, error } = await table(client).update({ is_active: isActive, ...(isActive ? {} : { is_default: false }) }).eq("id", uuid.parse(id)).select("id").maybeSingle();
  revalidatePath("/document-templates");
  return error || !data ? { success: false as const, error: error?.message ?? "Template is unavailable or access was denied." } : { success: true as const };
}
export async function getDefaultDocumentTemplate(documentType: DocumentTemplateType, companyId?: string | null, language = "en") {
  const result = await listDocumentTemplates(companyId);
  return result.data.filter(t => t.document_type === documentType && t.language === language && t.is_active && t.status === "Ready")
    .sort((a,b) => Number(b.company_id === companyId) - Number(a.company_id === companyId) || Number(b.is_default) - Number(a.is_default))[0] ?? null;
}
export async function discoverTemplatePlaceholders(id: string) {
  try {
    const client = await createClient();
    const { data, error } = await table(client).select("storage_path,configured_storage_path").eq("id", uuid.parse(id)).single();
    if (error || !data) throw new Error(error?.message ?? "Template not found.");
    const downloaded = await client.storage.from("documents").download(data.configured_storage_path || data.storage_path);
    if (downloaded.error || !downloaded.data) throw new Error("Template file unavailable.");
    const inspected = inspectDocx(new Uint8Array(await downloaded.data.arrayBuffer()));
    return { data: inspected.placeholders.filter(key => !/^[#^/]/.test(key)), text: inspected.text, error: null };
  } catch (error) { return { data: [] as string[], text: "", error: error instanceof Error ? error.message : "Invalid template." }; }
}
export async function configureDocumentTemplate(input: { templateId: string; mappings: Array<{ placeholder: string; skyVariable: string | null; isRepeatingProductRow?: boolean; required?: boolean }> }) {
  try {
    const denied = await assertCan("documents.write"); if (denied) throw new Error(denied);
    const inspected = await discoverTemplatePlaceholders(input.templateId);
    if (inspected.error) throw new Error(inspected.error);
    const byKey = new Map(input.mappings.map(m => [m.placeholder, m]));
    if (byKey.size !== input.mappings.length) throw new Error("Each custom field must have one mapping.");
    for (const key of inspected.data) if (!isCanonicalVariable(key) && !isCanonicalVariable(byKey.get(key)?.skyVariable ?? "")) throw new Error(`Choose a business field for ${key}.`);
    for (const m of input.mappings) if (!inspected.data.includes(m.placeholder) || !isCanonicalVariable(m.skyVariable || m.placeholder)) throw new Error("Choose a supported business field.");
    const client = await createClient();
    if (input.mappings.length) {
      const { error } = await client.from("template_mappings").upsert(input.mappings.map(m => ({ template_id: uuid.parse(input.templateId), placeholder: m.placeholder, sky_variable: m.skyVariable || m.placeholder, required: Boolean(m.required), is_repeating_product_row: (m.skyVariable || m.placeholder).startsWith("product.") })), { onConflict: "template_id,placeholder" });
      if (error) throw new Error(error.message);
    }
    const { data, error } = await table(client).update({ status: "Ready" }).eq("id", input.templateId).select("id").maybeSingle();
    if (error || !data) throw new Error(error?.message ?? "Template access denied.");
    revalidatePath("/document-templates"); return { success: true as const };
  } catch (error) { return { success: false as const, error: error instanceof Error ? error.message : "Configuration failed." }; }
}
export async function getTemplateMappings(templateId: string) {
  const client = await createClient();
  const { data, error } = await client.from("template_mappings").select("placeholder,sky_variable,is_repeating_product_row,required").eq("template_id", uuid.parse(templateId)).order("placeholder");
  return { data: (data ?? []) as Array<{ placeholder: string; sky_variable: string | null; is_repeating_product_row: boolean; required: boolean }>, error: error?.message ?? null };
}
export async function bindTemplateExampleValues(templateId: string, bindings: Array<{ text: string; variable: string }>) {
  try {
    const denied = await assertCan("documents.write"); if (denied) throw new Error(denied);
    if (!bindings.length || bindings.some(b => !isCanonicalVariable(b.variable))) throw new Error("Select text and a supported business field.");
    const client = await createClient();
    const { data, error } = await table(client).select("storage_path,configured_storage_path").eq("id", uuid.parse(templateId)).single();
    if (error || !data) throw new Error("Template not found.");
    const file = await client.storage.from("documents").download(data.configured_storage_path || data.storage_path);
    if (file.error || !file.data) throw new Error("Original template unavailable.");
    const bytes = bindDocxText(new Uint8Array(await file.data.arrayBuffer()), bindings);
    const path = data.storage_path.replace(/original\.docx$/, `configured-${randomUUID()}.docx`);
    if (path === data.storage_path) throw new Error("Replace this legacy template first to preserve its original.");
    const uploaded = await client.storage.from("documents").upload(path, bytes, { contentType: mime, upsert: false });
    if (uploaded.error) throw new Error(uploaded.error.message);
    const placeholders = inspectDocx(bytes).placeholders;
    const saved = await table(client).update({ configured_storage_path: path, configured_hash: hash(bytes), variable_schema: placeholders, status: placeholders.every(isCanonicalVariable) ? "Ready" : "Unconfigured" }).eq("id", templateId).select("id").maybeSingle();
    if (saved.error || !saved.data) throw new Error(saved.error?.message ?? "Template access denied.");
    revalidatePath("/document-templates"); return { success: true as const };
  } catch(error) { return { success: false as const, error: error instanceof Error ? error.message : "Unable to bind example text." }; }
}
