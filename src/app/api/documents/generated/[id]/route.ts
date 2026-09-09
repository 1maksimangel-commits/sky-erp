import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { DOCX_MIME } from "@/lib/document-templates/generation";
import { z } from "zod";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "Invalid document." }, { status: 400 });
  const client = await createClient();
  const { data, error } = await client.from("generated_documents").select("document_number,version,docx_storage_path,output_hash").eq("id", id).single();
  if (error || !data) return Response.json({ error: "Document unavailable." }, { status: 404 });
  const file = await client.storage.from("documents").download(data.docx_storage_path);
  if (file.error || !file.data) return Response.json({ error: "Retained output unavailable." }, { status: 404 });
  const bytes = Buffer.from(await file.data.arrayBuffer());
  if (data.output_hash && createHash("sha256").update(bytes).digest("hex") !== data.output_hash) return Response.json({ error: "Document checksum mismatch." }, { status: 409 });
  const filename = `${data.document_number}-v${data.version}`.replace(/[^a-z0-9._-]/gi, "_");
  return new Response(bytes, { headers: { "Content-Type": DOCX_MIME, "Content-Disposition": `attachment; filename="${filename}.docx"`, "Cache-Control": "no-store" } });
}
