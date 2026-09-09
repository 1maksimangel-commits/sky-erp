import { generateDocument, DOCX_MIME } from "@/lib/document-templates/generation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const result = await generateDocument(await request.json());
    if (result.test === true) return new Response(Buffer.from(result.bytes), { headers: { "Content-Type": DOCX_MIME, "Content-Disposition": 'attachment; filename="fictional-template-test.docx"', "Cache-Control": "no-store" } });
    return Response.json(result);
  } catch(error) { return Response.json({ error: error instanceof Error ? error.message : "Generation failed." }, { status: 400 }); }
}
