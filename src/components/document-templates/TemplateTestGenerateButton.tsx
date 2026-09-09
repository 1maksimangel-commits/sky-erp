"use client";

import { useState } from "react";
import type { DocumentTemplate } from "@/lib/document-templates/types";

export function TemplateTestGenerateButton({ template }: { template: DocumentTemplate }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function run() {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/documents/generate", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id, documentType: template.document_type, test: true,
          details: { number: "FICTIONAL-TEST-001", date: "2026-01-15", notes: "Fictional test data only.", supplementReference: "FICTIONAL-SUPPLEMENT-001" },
        }),
      });
      if (!response.ok) { const result = await response.json(); throw new Error(typeof result.error === "string" ? result.error : "Test generation failed."); }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "FICTIONAL-TEST-" + template.document_type + ".docx";
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
      setMessage("Fictional test DOCX downloaded. Business records were not changed.");
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : "Test generation failed."); }
    finally { setBusy(false); }
  }
  return <span className="inline-flex flex-wrap items-center gap-2"><button type="button" onClick={() => void run()} disabled={busy} className="rounded-md border border-border px-3 py-2 text-xs disabled:opacity-50">{busy ? "Generating…" : "Test Generate"}</button>{message ? <span role="status" className="text-xs text-muted-foreground">{message}</span> : null}</span>;
}
