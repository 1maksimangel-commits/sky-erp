"use server";
/** Legacy callers cannot submit fabricated canonical snapshots. */
export async function saveGeneratedDocument(_input: unknown) {
  void _input;
  return { success: false as const, error: "Use /documents/generate to review canonical Contract data and retain a DOCX." };
}
export async function createGeneratedRevision(_previous: unknown, _template: string, _changes: unknown) {
  void _previous; void _template; void _changes;
  return { success: false as const, error: "Use New Version in document history to review and regenerate." };
}
