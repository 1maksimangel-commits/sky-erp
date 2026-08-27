"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { deleteDocument } from "@/lib/documents/actions";
import type { ErpDocument } from "@/lib/documents/types";

type DocumentDeleteDialogProps = {
  open: boolean;
  document: ErpDocument | null;
  onClose: () => void;
  onDeleted: () => void;
};

export function DocumentDeleteDialog({
  open,
  document,
  onClose,
  onDeleted,
}: DocumentDeleteDialogProps) {
  if (!open || !document) return null;

  return (
    <DocumentDeleteDialogInner
      key={document.id}
      document={document}
      onClose={onClose}
      onDeleted={onDeleted}
    />
  );
}

function DocumentDeleteDialogInner({
  document,
  onClose,
  onDeleted,
}: {
  document: ErpDocument;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !deleting) onClose();
    }

    window.document.addEventListener("keydown", onKeyDown);
    window.document.body.style.overflow = "hidden";
    return () => {
      window.document.removeEventListener("keydown", onKeyDown);
      window.document.body.style.overflow = "";
    };
  }, [onClose, deleting]);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const result = await deleteDocument(document.id);
    setDeleting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onDeleted();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={deleting ? undefined : onClose}
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-document-title"
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <h2
            id="delete-document-title"
            className="text-base font-semibold text-foreground"
          >
            Delete document
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Delete{" "}
            <span className="font-medium text-foreground">
              {document.title || document.file_name || "this document"}
            </span>{" "}
            and all stored versions? This cannot be undone.
          </p>
        </div>

        {error ? (
          <div className="mx-5 mt-4 flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 sm:mx-6">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
