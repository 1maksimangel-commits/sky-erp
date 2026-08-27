"use client";

import {
  AlertCircle,
  Download,
  Eye,
  FileText,
  LayoutGrid,
  List,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { DocumentDeleteDialog } from "@/components/documents/DocumentDeleteDialog";
import { DocumentPreviewModal } from "@/components/documents/DocumentPreviewModal";
import { Toast } from "@/components/ui/Toast";
import { recordDocumentDownload } from "@/lib/documents/actions";
import {
  documentTypeLabel,
  entityHref,
  entityLabel,
  fileTypeFromMimeOrName,
  formatDocumentDate,
  formatFileSize,
} from "@/lib/documents/format";
import {
  DOCUMENT_ENTITY_TYPES,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES,
  type DocumentLibraryStats,
  type ErpDocument,
} from "@/lib/documents/types";

const FILE_TYPE_OPTIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "mp4",
  "mov",
];

type DocumentsLibraryViewProps = {
  documents: ErpDocument[];
  urls: Record<string, string>;
  stats?: DocumentLibraryStats;
  error: string | null;
  schemaWarning?: string | null;
  diagnostic?: unknown;
  requestHint?: string;
};

export function DocumentsLibraryView({
  documents,
  urls,
  stats,
  error,
  schemaWarning = null,
  diagnostic,
  requestHint,
}: DocumentsLibraryViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [fileTypeFilter, setFileTypeFilter] = useState("all");
  const [uploadedByFilter, setUploadedByFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [toast, setToast] = useState<{
    message: string;
    variant?: "success" | "error";
  } | null>(null);
  const [previewDoc, setPreviewDoc] = useState<ErpDocument | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<ErpDocument | null>(null);

  const uploaders = useMemo(() => {
    return [
      ...new Set(
        documents
          .map((item) => item.uploaded_by)
          .filter((value): value is string => Boolean(value))
      ),
    ].sort();
  }, [documents]);

  const computedStats = useMemo<DocumentLibraryStats>(() => {
    if (stats) return stats;
    const current = documents.filter((item) => item.is_current !== false);
    return {
      total: current.length,
      contracts: current.filter((item) => item.entity_type === "contract")
        .length,
      logistics: current.filter((item) => item.entity_type === "shipment")
        .length,
      finance: current.filter((item) =>
        ["invoice", "payment"].includes(item.entity_type ?? "")
      ).length,
      certificates: current.filter((item) =>
        /certificate|origin|veterinary|health/i.test(item.document_type ?? "")
      ).length,
    };
  }, [documents, stats]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return documents.filter((item) => {
      if (entityFilter !== "all" && item.entity_type !== entityFilter) {
        return false;
      }
      if (typeFilter !== "all" && item.document_type !== typeFilter) {
        return false;
      }
      if (fileTypeFilter !== "all") {
        const ext = (item.file_name ?? "").split(".").pop()?.toLowerCase();
        if (ext !== fileTypeFilter) return false;
      }
      if (
        uploadedByFilter !== "all" &&
        item.uploaded_by !== uploadedByFilter
      ) {
        return false;
      }
      if (dateFrom) {
        const ts = new Date(item.created_at ?? item.uploaded_at ?? 0).getTime();
        if (ts < new Date(dateFrom).getTime()) return false;
      }
      if (dateTo) {
        const ts = new Date(item.created_at ?? item.uploaded_at ?? 0).getTime();
        if (ts > new Date(`${dateTo}T23:59:59`).getTime()) return false;
      }
      if (!query) return true;
      return [
        item.title,
        item.file_name,
        item.document_type,
        documentTypeLabel(item.document_type),
        item.entity_type,
        item.entity_label,
        entityLabel(item.entity_type),
        item.notes,
        item.uploaded_by,
        ...(item.tags ?? []),
      ].some((field) => field?.toLowerCase().includes(query));
    });
  }, [
    documents,
    search,
    entityFilter,
    typeFilter,
    fileTypeFilter,
    uploadedByFilter,
    dateFrom,
    dateTo,
  ]);

  async function handleDownload(doc: ErpDocument) {
    const url = urls[doc.id];
    if (!url) {
      setToast({ message: "Download URL unavailable.", variant: "error" });
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    await recordDocumentDownload({
      documentId: doc.id,
      entityType: doc.entity_type,
      entityId: doc.entity_id,
      fileName: doc.file_name,
    });
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div className="space-y-2 text-sm text-red-200">
            <h3 className="font-medium text-red-100">Failed to load documents</h3>
            <p>{error}</p>
            {schemaWarning ? <p>{schemaWarning}</p> : null}
            {requestHint ? (
              <p className="font-mono text-xs text-red-300/90">{requestHint}</p>
            ) : null}
            {diagnostic ? (
              <pre className="overflow-x-auto rounded-md bg-black/30 p-3 text-xs">
                {JSON.stringify(diagnostic, null, 2)}
              </pre>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${isPending ? "opacity-70" : ""}`}>
      {toast ? (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      ) : null}

      {schemaWarning ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div className="space-y-1 text-sm text-amber-100">
              <p className="font-medium">Documents schema update required</p>
              <p className="text-amber-100/90">{schemaWarning}</p>
            </div>
          </div>
        </div>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Global document library. Uploads from entity pages appear here
        automatically.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Total Documents", value: computedStats.total },
          { label: "Contracts", value: computedStats.contracts },
          { label: "Logistics", value: computedStats.logistics },
          { label: "Finance", value: computedStats.finance },
          { label: "Certificates", value: computedStats.certificates },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-card-border bg-card px-4 py-3"
          >
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, file, type, contract #, case #, company, counterparty, shipment, invoice..."
            className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="all">All entities</option>
            {DOCUMENT_ENTITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {entityLabel(type)}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="all">All document types</option>
            {DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {DOCUMENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <select
            value={fileTypeFilter}
            onChange={(e) => setFileTypeFilter(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="all">All file types</option>
            {FILE_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {type.toUpperCase()}
              </option>
            ))}
          </select>
          <select
            value={uploadedByFilter}
            onChange={(e) => setUploadedByFilter(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="all">All uploaders</option>
            {uploaders.map((uploader) => (
              <option key={uploader} value={uploader}>
                {uploader}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm"
            aria-label="Upload date from"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm"
            aria-label="Upload date to"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {filtered.length} document{filtered.length === 1 ? "" : "s"}
          </p>
          <div className="inline-flex rounded-md border border-border p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-xs ${
                viewMode === "table"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-xs ${
                viewMode === "grid"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Grid
            </button>
          </div>
        </div>
      </div>

      {!filtered.length ? (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
          {documents.length
            ? "No documents match your filters."
            : "No documents uploaded yet. Open any entity Documents tab to upload."}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((document) => {
            const href = entityHref(document.entity_type, document.entity_id);
            return (
              <div
                key={document.id}
                className="rounded-lg border border-card-border bg-card p-4"
              >
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {document.title || document.file_name || "Document"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {documentTypeLabel(document.document_type)}
                      {" · "}
                      {fileTypeFromMimeOrName(
                        document.mime_type,
                        document.file_name
                      )}
                      {" · v"}
                      {document.version ?? 1}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {href ? (
                        <Link
                          href={href}
                          className="underline-offset-4 hover:underline"
                        >
                          {document.entity_label ||
                            entityLabel(document.entity_type)}
                        </Link>
                      ) : (
                        entityLabel(document.entity_type)
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatFileSize(document.file_size)}
                      {" · "}
                      {formatDocumentDate(
                        document.created_at ?? document.uploaded_at
                      )}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  <ActionButtons
                    onPreview={() => setPreviewDoc(document)}
                    onDownload={() => void handleDownload(document)}
                    onDelete={() => setDeleteDoc(document)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-card-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-accent/30">
                  {[
                    "Title",
                    "Document Type",
                    "Linked Entity",
                    "File Type",
                    "Size",
                    "Version",
                    "Uploaded By",
                    "Upload Date",
                    "Actions",
                  ].map((label) => (
                    <th
                      key={label}
                      className="px-4 py-3 text-xs font-medium text-muted-foreground"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((document) => {
                  const href = entityHref(
                    document.entity_type,
                    document.entity_id
                  );
                  return (
                    <tr key={document.id} className="hover:bg-accent/20">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-foreground">
                              {document.title ||
                                document.file_name ||
                                "Document"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {document.file_name || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {documentTypeLabel(document.document_type)}
                      </td>
                      <td className="px-4 py-3">
                        {href ? (
                          <Link
                            href={href}
                            className="underline-offset-4 hover:underline"
                          >
                            {document.entity_label ||
                              entityLabel(document.entity_type)}
                          </Link>
                        ) : (
                          entityLabel(document.entity_type)
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {fileTypeFromMimeOrName(
                          document.mime_type,
                          document.file_name
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {formatFileSize(document.file_size)}
                      </td>
                      <td className="px-4 py-3">v{document.version ?? 1}</td>
                      <td className="px-4 py-3">
                        {document.uploaded_by || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDocumentDate(
                          document.created_at ?? document.uploaded_at
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ActionButtons
                          onPreview={() => setPreviewDoc(document)}
                          onDownload={() => void handleDownload(document)}
                          onDelete={() => setDeleteDoc(document)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DocumentPreviewModal
        open={Boolean(previewDoc)}
        document={previewDoc}
        url={previewDoc ? urls[previewDoc.id] ?? null : null}
        onClose={() => setPreviewDoc(null)}
        onDownload={() => {
          if (previewDoc) void handleDownload(previewDoc);
        }}
      />

      <DocumentDeleteDialog
        open={Boolean(deleteDoc)}
        document={deleteDoc}
        onClose={() => setDeleteDoc(null)}
        onDeleted={() => {
          setToast({ message: "Document deleted." });
          startTransition(() => router.refresh());
        }}
      />
    </div>
  );
}

function ActionButtons({
  onPreview,
  onDownload,
  onDelete,
}: {
  onPreview: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onPreview}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Eye className="h-3.5 w-3.5" />
        Preview
      </button>
      <button
        type="button"
        onClick={onDownload}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Download className="h-3.5 w-3.5" />
        Download
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-red-300"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </button>
    </div>
  );
}
