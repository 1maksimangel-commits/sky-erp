"use client";

import { Loader2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  replaceDocumentVersion,
  uploadDocument,
} from "@/lib/documents/actions";
import {
  ACCEPTED_DOCUMENT_EXTENSIONS,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  type DocumentEntityType,
  type ErpDocument,
} from "@/lib/documents/types";
import { validateDocumentFile } from "@/lib/documents/validation";

type DocumentUploadModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  mode?: "upload" | "replace";
  entityType?: DocumentEntityType | string;
  entityId?: string;
  existingDocument?: ErpDocument | null;
  businessCaseId?: string | null;
  contractId?: string | null;
  shipmentId?: string | null;
  invoiceId?: string | null;
  paymentId?: string | null;
  companyId?: string | null;
  counterpartyId?: string | null;
  productId?: string | null;
};

export function DocumentUploadModal(props: DocumentUploadModalProps) {
  if (!props.open) return null;

  return (
    <DocumentUploadModalInner
      key={`${props.mode}-${props.existingDocument?.id ?? "new"}`}
      {...props}
    />
  );
}

function DocumentUploadModalInner({
  onClose,
  onSuccess,
  mode = "upload",
  entityType,
  entityId,
  existingDocument,
  businessCaseId,
  contractId,
  shipmentId,
  invoiceId,
  paymentId,
  companyId,
  counterpartyId,
  productId,
}: DocumentUploadModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(
    mode === "replace" && existingDocument
      ? existingDocument.title || existingDocument.file_name || ""
      : ""
  );
  const [documentType, setDocumentType] = useState(
    mode === "replace" && existingDocument
      ? existingDocument.document_type || "other"
      : "other"
  );
  const [version, setVersion] = useState(
    mode === "replace" && existingDocument
      ? String((existingDocument.version ?? 1) + 1)
      : "1"
  );
  const [tags, setTags] = useState(
    mode === "replace" && existingDocument
      ? (existingDocument.tags ?? []).join(", ")
      : ""
  );
  const [notes, setNotes] = useState(
    mode === "replace" && existingDocument
      ? existingDocument.notes || ""
      : ""
  );
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }

    window.document.addEventListener("keydown", onKeyDown);
    window.document.body.style.overflow = "hidden";
    return () => {
      window.document.removeEventListener("keydown", onKeyDown);
      window.document.body.style.overflow = "";
    };
  }, [onClose, saving]);

  function assignFile(next: File | null) {
    if (!next) {
      setFile(null);
      return;
    }
    const validation = validateDocumentFile(next);
    if (validation) {
      setError(validation);
      setFile(null);
      return;
    }
    setError(null);
    setFile(next);
    if (!title.trim()) {
      setTitle(next.name.replace(/\.[^.]+$/, ""));
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("File is required.");
      return;
    }
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setProgress(15);

    const formData = new FormData();
    formData.set("file", file);
    formData.set("title", title.trim());
    formData.set("document_type", documentType);
    formData.set("version", version);
    formData.set("tags", tags);
    formData.set("notes", notes);

    const progressTimer = window.setInterval(() => {
      setProgress((value) => (value >= 85 ? value : value + 8));
    }, 200);

    try {
      const result =
        mode === "replace" && existingDocument
          ? await replaceDocumentVersion({
              documentId: existingDocument.id,
              formData,
              title: title.trim(),
              notes,
            })
          : await uploadDocument({
              entityType: entityType!,
              entityId: entityId!,
              documentType,
              title: title.trim(),
              tags: tags
                .split(/[,;]/)
                .map((tag) => tag.trim())
                .filter(Boolean),
              notes,
              version: Number(version) || 1,
              formData,
              businessCaseId,
              contractId,
              shipmentId,
              invoiceId,
              paymentId,
              companyId,
              counterpartyId,
              productId,
            });

      window.clearInterval(progressTimer);
      setProgress(100);

      if (!result.success) {
        setError(result.error);
        setSaving(false);
        setProgress(0);
        return;
      }

      onSuccess(
        mode === "replace"
          ? "Document version replaced."
          : "Document uploaded successfully."
      );
      onClose();
    } catch (err) {
      window.clearInterval(progressTimer);
      setError(err instanceof Error ? err.message : "Upload failed.");
      setSaving(false);
      setProgress(0);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={saving ? undefined : onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-upload-title"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2
              id="document-upload-title"
              className="text-base font-semibold text-foreground"
            >
              {mode === "replace" ? "Replace version" : "Upload document"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              PDF, Office, images, and video up to{" "}
              {Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))} MB.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4 sm:px-6">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              assignFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className={`rounded-lg border border-dashed px-4 py-8 text-center transition-colors ${
              dragOver
                ? "border-foreground/40 bg-accent/40"
                : "border-border bg-background/40"
            }`}
          >
            <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-foreground">
              Drag and drop a file here, or{" "}
              <button
                type="button"
                className="underline underline-offset-2"
                onClick={() => inputRef.current?.click()}
              >
                browse
              </button>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {file ? file.name : "No file selected"}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_DOCUMENT_EXTENSIONS}
              className="hidden"
              onChange={(e) => assignFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs text-muted-foreground">
                Title *
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            {mode === "upload" ? (
              <div>
                <label className="mb-1.5 block text-xs text-muted-foreground">
                  Document type *
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {DOCUMENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">
                Version
              </label>
              <input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                disabled={mode === "replace"}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs text-muted-foreground">
                Tags
              </label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="BL, customs, original"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs text-muted-foreground">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          {saving ? (
            <div className="space-y-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-accent">
                <div
                  className="h-full rounded-full bg-foreground transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Uploading… {progress}%
              </p>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {mode === "replace" ? "Replace version" : "Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
