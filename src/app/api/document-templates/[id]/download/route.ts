import { createClient } from "@/lib/supabase/server";
import { assertCan } from "@/lib/platform/permissions";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = assertCan("documents.read");
  if (denied) return Response.json({ error: denied }, { status: 403 });
  const { id } = await context.params;
  const client = await createClient();
  const { data, error } = await client.from("document_templates" as never).select("name,storage_path").eq("id", id).maybeSingle();
  if (error || !data) return Response.json({ error: error?.message ?? "Template not found." }, { status: 404 });
  const row = data as unknown as { name: string; storage_path: string };
  const { data: file, error: downloadError } = await client.storage.from("documents").download(row.storage_path);
  if (downloadError || !file) return Response.json({ error: downloadError?.message ?? "Template file unavailable." }, { status: 404 });
  return new Response(file, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${row.name.replace(/[^a-z0-9._-]+/gi, "_")}.docx"` } });
}
