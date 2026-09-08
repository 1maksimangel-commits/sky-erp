import { createClient } from "@/lib/supabase/server";
import { assertCan } from "@/lib/platform/permissions";
import { renderUploadedDocx, renderTextTemplateDocx } from "@/lib/contracts/docx";

export const runtime = "nodejs";

type RequestInput = { templateId: string; documentType: "contract" | "supplement" | "invoice"; data: Record<string, unknown> };

function flatten(data: Record<string, unknown>) {
  const output: Record<string, string | number | null> = {};
  const walk = (value: unknown, prefix = "") => {
    if (Array.isArray(value)) { output[prefix] = value.map((item) => typeof item === "object" ? JSON.stringify(item) : String(item ?? "")).join(", "); return; }
    if (value && typeof value === "object") { for (const [key, child] of Object.entries(value)) walk(child, prefix ? `${prefix}.${key}` : key); return; }
    if (prefix) output[prefix] = value == null ? null : String(value);
  };
  walk(data);
  return output;
}

export async function POST(request: Request) {
  const denied = assertCan("documents.write");
  if (denied) return Response.json({ error: denied }, { status: 403 });
  try {
    const input = (await request.json()) as RequestInput;
    const client = await createClient();
    const { data: template, error } = await client.from("document_templates" as never).select("name,storage_path,template_content,version").eq("id", input.templateId).maybeSingle();
    if (error || !template) return Response.json({ error: error?.message ?? "Template not found." }, { status: 404 });
    const row = template as unknown as { name: string; storage_path: string; template_content?: string | null; version: number };
    const values = flatten(input.data);
    const products = Array.isArray(input.data.products) ? input.data.products : [];
    values.products = products.map((item) => typeof item === "object" && item ? `${(item as Record<string, unknown>).name ?? ""} ${(item as Record<string, unknown>).quantity ?? ""}` : String(item)).join("; ");
    const bytes = row.template_content ? renderTextTemplateDocx(row.template_content, values) : renderUploadedDocx(new Uint8Array(await (await client.storage.from("documents").download(row.storage_path)).data!.arrayBuffer()), { ...values, products: products as Array<Record<string, unknown>> });
    const fileName = `${input.documentType}-${Date.now()}.docx`;
    const path = `generated/${input.documentType}/${fileName}`;
    const upload = await client.storage.from("documents").upload(path, bytes, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: false });
    if (upload.error) return Response.json({ error: upload.error.message }, { status: 500 });
    return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${fileName}"`, "X-SKY-Storage-Path": path, "X-SKY-Template-Version": String(row.version) } });
  } catch (cause) { return Response.json({ error: cause instanceof Error ? cause.message : "Unable to generate document." }, { status: 500 }); }
}
