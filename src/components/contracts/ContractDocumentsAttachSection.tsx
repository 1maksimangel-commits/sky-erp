"use client";

import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import {
  documentTypeLabel,
  formatFileSize,
} from "@/lib/documents/format";
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES,
  type ErpDocument,
} from "@/lib/documents/types";
import { defaultDocumentTitleFromFileName } from "@/lib/documents/upload-helpers";
import {
  CONTRACT_ATTACH_ACCEPT,
  validateContractAttachFile,
} from "@/lib/documents/validation";

export type PendingContractDocument = {
  localId: string;
  file: File;
  documentType: string;
  title: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
};

type ContractDocumentsAttachSectionProps = {
  pending: PendingContractDocument[];
  onChange: (next: PendingContractDocument[]) => void;
  existingDocuments?: ErpDocument[];
  loadingExisting?: boolean;
  disabled?: boolean;
  isEditing?: boolean;
};

const inputClassName =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

function createLocalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ContractDocumentsAttachSection({
  pending,
  onChange,
  existingDocuments = [],
  loadingExisting = false,
  disabled = false,
  isEditing = false,
}: ContractDocumentsAttachSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const next = [...pending];
    const errors: string[] = [];

    for (const file of files) {
      const validation = validateContractAttachFile(file);
      if (validation) {
        errors.push(`${file.name}: ${validation}`);
        continue;
      }

      const duplicate = next.some(
        (item) =>
          item.file.name === file.name &&
          item.file.size === file.size &&
          item.file.lastModified === file.lastModified
      );
      if (duplicate) continue;

      next.push({
        localId: createLocalId(),
        file,
        documentType: "contract",
        title: defaultDocumentTitleFromFileName(file.name),
        progress: 0,
        status: "pending",
      });
    }

    onChange(next);
    setLocalError(errors.length > 0 ? errors.join(" ") : null);
  }

  function updatePending(
    localId: string,
    patch: Partial<PendingContractDocument>
  ) {
    onChange(
      pending.map((item) =>
        item.localId === localId ? { ...item, ...patch } : item
      )
    );
  }

  function removePending(localId: string) {
    onChange(pending.filter((item) => item.localId !== localId));
    setLocalError(null);
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-accent/10 p-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">Documents</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {isEditing
            ? "Attach new files to this contract. Existing documents are managed in the Documents tab."
            : "Optionally attach contract files now. They upload after the contract is created."}
        </p>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Existing documents
          </p>
          {loadingExisting ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading linked documents...
            </div>
          ) : existingDocuments.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No documents linked yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {existingDocuments.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-start gap-3 rounded-md border border-border bg-background/60 px-3 py-2"
                >
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">
                      {doc.title || doc.file_name || "Untitled"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {documentTypeLabel(doc.document_type)}
                      {doc.file_size != null
                        ? ` · ${formatFileSize(doc.file_size)}`
                        : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          if (disabled) return;
          addFiles(event.dataTransfer.files);
        }}
        className={`rounded-lg border border-dashed px-4 py-6 text-center transition-colors ${
          dragOver
            ? "border-foreground/40 bg-accent/40"
            : "border-border bg-background/40"
        } ${disabled ? "opacity-50" : ""}`}
      >
        <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
        <p className="mt-2 text-sm text-foreground">
          Drag and drop files here
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, WEBP · max 50 MB each
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="mt-3 inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          Select files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={CONTRACT_ATTACH_ACCEPT}
          className="hidden"
          disabled={disabled}
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {localError ? (
        <p className="text-xs text-red-300">{localError}</p>
      ) : null}

      {pending.length > 0 ? (
        <ul className="space-y-3">
          {pending.map((item) => (
            <li
              key={item.localId}
              className="space-y-3 rounded-md border border-border bg-background/60 p-3"
            >
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">
                    {item.file.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatFileSize(item.file.size)}
                    {item.status === "uploading"
                      ? " · Uploading..."
                      : item.status === "done"
                        ? " · Uploaded"
                        : item.status === "error"
                          ? " · Failed"
                          : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={disabled || item.status === "uploading"}
                  onClick={() => removePending(item.localId)}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                  aria-label={`Remove ${item.file.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Document type
                  </label>
                  <select
                    value={item.documentType}
                    disabled={disabled || item.status === "uploading"}
                    onChange={(event) =>
                      updatePending(item.localId, {
                        documentType: event.target.value,
                      })
                    }
                    className={inputClassName}
                  >
                    {DOCUMENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {DOCUMENT_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Title
                  </label>
                  <input
                    type="text"
                    value={item.title}
                    disabled={disabled || item.status === "uploading"}
                    onChange={(event) =>
                      updatePending(item.localId, {
                        title: event.target.value,
                      })
                    }
                    placeholder="Optional title"
                    className={inputClassName}
                  />
                </div>
              </div>

              {item.status === "uploading" || item.progress > 0 ? (
                <div className="h-1.5 overflow-hidden rounded-full bg-accent">
                  <div
                    className="h-full rounded-full bg-foreground/70 transition-all"
                    style={{ width: `${Math.min(100, item.progress)}%` }}
                  />
                </div>
              ) : null}

              {item.error ? (
                <p className="text-xs text-red-300">{item.error}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
