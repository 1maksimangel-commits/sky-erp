/** Legacy endpoint is isolated: generation now requires canonical source review. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return Response.json({ error: "Review the Contract and choose its template on the document generation screen.", reviewUrl: `/documents/generate?contractId=${encodeURIComponent(id)}` }, { status: 409 });
}
