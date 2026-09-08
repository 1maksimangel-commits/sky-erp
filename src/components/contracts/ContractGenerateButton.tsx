"use client";

import { Download, FileText, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";

export function ContractGenerateButton({ contractId }: { contractId: string }) {
  const [open, setOpen] = useState(false);
  const [includeMarks, setIncludeMarks] = useState(false);
  const [documentKind, setDocumentKind] = useState<"contract" | "supplement" | "invoice">("contract");
  const [format, setFormat] = useState<"pdf" | "docx">("docx");
  const [createInvoice, setCreateInvoice] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadTemplateUrl, setUploadTemplateUrl] = useState<string | null>(null);
  const sealRef = useRef<HTMLInputElement>(null);
  const signatureRef = useRef<HTMLInputElement>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    setUploadTemplateUrl(null);
    try {
      const formData = new FormData();
      formData.set("includeApprovalMarks", String(includeMarks));
      formData.set("documentKind", documentKind);
      formData.set("createInvoice", String(createInvoice));
      formData.set("format", format);
      const seal = sealRef.current?.files?.[0];
      const signature = signatureRef.current?.files?.[0];
      if (seal) formData.set("seal", seal);
      if (signature) formData.set("signature", signature);
      const response = await fetch(`/api/contracts/${contractId}/generate`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string; uploadUrl?: string } | null;
        if (payload?.uploadUrl) setUploadTemplateUrl(payload.uploadUrl);
        throw new Error(payload?.error ?? "Unable to generate contract PDF.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const fileName = disposition.match(/filename="([^"]+)"/)?.[1] ?? "contract.pdf";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to generate contract PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        <FileText className="h-4 w-4" />
        Generate PDF
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-background p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold">Generate contract PDF</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  A new Generated document will be saved. Uploaded originals are never overwritten.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={busy} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mt-5 flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
              <span className="w-full">
                <span className="mb-1 block font-medium">Template</span>
                <select
                  value={documentKind}
                  onChange={(event) => setDocumentKind(event.target.value as typeof documentKind)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                >
                  <option value="contract">Sales Contract</option>
                  <option value="supplement">Contract Supplement</option>
                  <option value="invoice">Commercial Invoice</option>
                </select>
                <select value={format} onChange={(event) => setFormat(event.target.value as typeof format)} className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2">
                  <option value="docx">DOCX from uploaded template</option>
                  <option value="pdf">PDF system format</option>
                </select>
              </span>
            </label>

            {documentKind === "contract" ? (
              <label className="mt-3 flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={createInvoice}
                  onChange={(event) => setCreateInvoice(event.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-medium">Also create Commercial Invoice</span>
                  <span className="block text-xs text-muted-foreground">
                    The invoice will be saved automatically in this contract&apos;s Documents.
                  </span>
                </span>
              </label>
            ) : null}

            <label className="mt-3 flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
              <input
                type="checkbox"
                checked={includeMarks}
                onChange={(event) => setIncludeMarks(event.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="block font-medium">Apply authorized seal / signature</span>
                <span className="block text-xs text-muted-foreground">
                  Use only files you are authorized to apply to this contract.
                </span>
              </span>
            </label>

            {includeMarks ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Company seal</span>
                  <input ref={sealRef} type="file" accept="image/png,image/jpeg" className="block w-full text-xs" />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Authorized signature</span>
                  <input ref={signatureRef} type="file" accept="image/png,image/jpeg" className="block w-full text-xs" />
                </label>
              </div>
            ) : null}

            {error ? <div className="mt-4 rounded-md bg-amber-500/10 p-3 text-sm text-amber-200"><p>{error}</p>{uploadTemplateUrl ? <a href={uploadTemplateUrl} className="mt-2 inline-block underline">Upload template</a> : null}</div> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={generate}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Generate and download
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
