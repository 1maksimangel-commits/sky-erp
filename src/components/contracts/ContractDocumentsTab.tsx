"use client";

import { AlertCircle, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Toast } from "@/components/ui/Toast";
import { uploadContractDocument } from "@/lib/contracts/hub-actions";
import {
  DOCUMENT_CATEGORIES,
  type ContractDocument,
} from "@/lib/contracts/document-types";

type ContractDocumentsTabProps = {
  contractId: string;
  contractNumber: string;
  documents: ContractDocument[];
  downloadUrls: Record<string, string>;
  error: string | null;
  needsBusinessCase: boolean;
};

const inputClassName =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function ContractDocumentsTab({
  contractId,
  contractNumber,
  documents,
  downloadUrls,
  error,
  needsBusinessCase,
}: ContractDocumentsTabProps) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [category, setCategory] = useState<string>(DOCUMENT_CATEGORIES[0]);
  const [title, setTitle] = useState("");

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    setFormError(null);

    const formData = new FormData(event.currentTarget);
    formData.set("category", category);
    if (title.trim()) {
      formData.set("title", title.trim());
    }

    const result = await uploadContractDocument(
      contractId,
      contractNumber,
      formData
    );

    setUploading(false);

    if (!result.success) {
      setFormError(result.error);
      return;
    }

    setTitle("");
    setToast("Document uploaded.");
    router.refresh();
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-foreground">Documents</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Uploaded files linked to this contract through its business case
        </p>
      </div>

      {needsBusinessCase ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          Create a business case on the Business Case tab before uploading
          documents.
        </div>
      ) : (
        <form
          onSubmit={handleUpload}
          className="space-y-4 rounded-lg border border-border bg-card p-4"
        >
          {formError ? (
            <p className="text-sm text-red-300">{formError}</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClassName}
            >
              {DOCUMENT_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClassName}
            />
            <input
              type="file"
              name="file"
              required
              className={inputClassName}
            />
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-md bg-foreground px-3.5 py-2 text-xs font-medium text-background disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Upload Document
          </button>
        </form>
      )}

      {!documents.length ? (
        <div className="rounded-lg border border-card-border bg-card p-10 text-center text-sm text-muted-foreground">
          No documents uploaded yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-card-border bg-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-accent/30">
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                  Title
                </th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                  Category
                </th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                  Uploaded
                </th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                  File
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {documents.map((document) => (
                <tr key={document.id}>
                  <td className="px-4 py-3">{document.title ?? "—"}</td>
                  <td className="px-4 py-3">{document.document_type ?? "—"}</td>
                  <td className="px-4 py-3">
                    {formatDate(document.uploaded_at)}
                  </td>
                  <td className="px-4 py-3">
                    {downloadUrls[document.id] ? (
                      <a
                        href={downloadUrls[document.id]}
                        target="_blank"
                        rel="noreferrer"
                        className="text-foreground underline-offset-4 hover:underline"
                      >
                        Download
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast ? (
        <Toast message={toast} onClose={() => setToast(null)} />
      ) : null}
    </div>
  );
}
