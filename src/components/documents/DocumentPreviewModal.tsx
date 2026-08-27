"use client";

import { Download, FileText, X } from "lucide-react";
import { useEffect } from "react";
import {
  documentTypeLabel,
  fileTypeFromMimeOrName,
  formatDocumentDate,
  formatFileSize,
  previewKind,
} from "@/lib/documents/format";
import type { ErpDocument } from "@/lib/documents/types";

type DocumentPreviewModalProps = {
  open: boolean;
  document: ErpDocument | null;
  url: string | null;
  onClose: () => void;
  onDownload: () => void;
};

export function DocumentPreviewModal({
  open,
  document,
  url,
  onClose,
  onDownload,
}: DocumentPreviewModalProps) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.document.addEventListener("keydown", onKeyDown);
    window.document.body.style.overflow = "hidden";
    return () => {
      window.document.removeEventListener("keydown", onKeyDown);
      window.document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !document) return null;

  const kind = previewKind(document.mime_type);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close preview"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-preview-title"
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2
              id="document-preview-title"
              className="truncate text-base font-semibold text-foreground"
            >
              {document.title || document.file_name || "Document"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {documentTypeLabel(document.document_type)}
              {" · "}
              {fileTypeFromMimeOrName(document.mime_type, document.file_name)}
              {" · "}
              {formatFileSize(document.file_size)}
              {" · v"}
              {document.version ?? 1}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {url ? (
              <button
                type="button"
                onClick={onDownload}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-black/20 p-4">
          {!url ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Preview URL unavailable. Use download if the file exists in Storage.
            </div>
          ) : kind === "pdf" ? (
            <iframe
              title={document.title || "PDF preview"}
              src={url}
              className="h-[70vh] w-full rounded-md border border-border bg-white"
            />
          ) : kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={document.title || document.file_name || "Image preview"}
              className="mx-auto max-h-[70vh] max-w-full rounded-md object-contain"
            />
          ) : kind === "video" ? (
            <video
              controls
              src={url}
              className="mx-auto max-h-[70vh] w-full rounded-md"
            />
          ) : (
            <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 text-center">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  In-browser preview is not available for this file type
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Word and Excel files are provided as downloads only.
                </p>
              </div>
              <dl className="w-full space-y-2 text-left text-xs text-muted-foreground">
                <div className="flex justify-between gap-4">
                  <dt>File</dt>
                  <dd className="text-foreground">{document.file_name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Type</dt>
                  <dd className="text-foreground">
                    {fileTypeFromMimeOrName(
                      document.mime_type,
                      document.file_name
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Size</dt>
                  <dd className="text-foreground">
                    {formatFileSize(document.file_size)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Uploaded</dt>
                  <dd className="text-foreground">
                    {formatDocumentDate(
                      document.created_at ?? document.uploaded_at
                    )}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={onDownload}
                className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background"
              >
                <Download className="h-3.5 w-3.5" />
                Download file
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
