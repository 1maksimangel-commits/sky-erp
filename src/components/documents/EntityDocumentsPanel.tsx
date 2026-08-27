"use client";

import {
  Download,
  Eye,
  FileText,
  History,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DocumentDeleteDialog } from "@/components/documents/DocumentDeleteDialog";
import { DocumentPreviewModal } from "@/components/documents/DocumentPreviewModal";
import { DocumentUploadModal } from "@/components/documents/DocumentUploadModal";
import { Toast } from "@/components/ui/Toast";
import {
  fetchDocumentVersions,
  getSignedUrlForPath,
  recordDocumentDownload,
} from "@/lib/documents/actions";
import {
  documentTypeLabel,
  fileTypeFromMimeOrName,
  formatDocumentDate,
  formatFileSize,
} from "@/lib/documents/format";
import type { DocumentVersion, ErpDocument } from "@/lib/documents/types";

type EntityDocumentsPanelProps = {
  entityType: string;
  entityId: string;
  documents: ErpDocument[];
  urls: Record<string, string>;
  businessCaseId?: string | null;
  contractId?: string | null;
  shipmentId?: string | null;
  invoiceId?: string | null;
  paymentId?: string | null;
  companyId?: string | null;
  counterpartyId?: string | null;
  productId?: string | null;
};

export function EntityDocumentsPanel({
  entityType,
  entityId,
  documents,
  urls,
  businessCaseId,
  contractId,
  shipmentId,
  invoiceId,
  paymentId,
  companyId,
  counterpartyId,
  productId,
}: EntityDocumentsPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{
    message: string;
    variant?: "success" | "error";
  } | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [replaceDoc, setReplaceDoc] = useState<ErpDocument | null>(null);
  const [previewDoc, setPreviewDoc] = useState<ErpDocument | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<ErpDocument | null>(null);
  const [historyDocId, setHistoryDocId] = useState<string | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function handleDownload(doc: ErpDocument, url?: string | null) {
    const href = url ?? urls[doc.id];
    if (!href) {
      setToast({ message: "Download URL unavailable.", variant: "error" });
      return;
    }
    window.open(href, "_blank", "noopener,noreferrer");
    await recordDocumentDownload({
      documentId: doc.id,
      entityType: doc.entity_type ?? entityType,
      entityId: doc.entity_id ?? entityId,
      fileName: doc.file_name,
    });
  }

  async function openHistory(doc: ErpDocument) {
    setHistoryDocId(doc.id);
    setLoadingHistory(true);
    const result = await fetchDocumentVersions(doc.id);
    setLoadingHistory(false);
    if (result.error) {
      setToast({ message: result.error, variant: "error" });
      return;
    }
    setVersions(result.data);
  }

  async function downloadVersion(version: DocumentVersion) {
    const result = await getSignedUrlForPath(version.file_path);
    if (!result.url) {
      setToast({
        message: result.error ?? "Could not create download URL.",
        variant: "error",
      });
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
    await recordDocumentDownload({
      documentId: version.document_id,
      entityType,
      entityId,
      fileName: version.file_name,
    });
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">Documents</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Files uploaded here also appear in the global Documents library.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-3.5 py-2 text-xs font-medium text-background"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload Document
        </button>
      </div>

      <button
        type="button"
        onClick={() => setUploadOpen(true)}
        className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 px-4 py-8 text-center transition-colors hover:bg-accent/30"
      >
        <Upload className="h-5 w-5 text-muted-foreground" />
        <p className="mt-2 text-sm text-foreground">Drag and drop area</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Click to open the upload dialog
        </p>
      </button>

      {!documents.length ? (
        <div className="rounded-lg border border-card-border bg-card p-8 text-center text-sm text-muted-foreground">
          No documents linked to this record yet.
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const url = urls[doc.id];
            return (
              <div
                key={doc.id}
                className="rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {doc.title || doc.file_name || "Document"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {documentTypeLabel(doc.document_type)}
                        {" · "}
                        {doc.file_name || "—"}
                        {" · "}
                        {formatFileSize(doc.file_size)}
                        {" · v"}
                        {doc.version ?? 1}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDocumentDate(doc.created_at ?? doc.uploaded_at)}
                        {" · "}
                        {doc.uploaded_by || "system"}
                        {" · "}
                        {fileTypeFromMimeOrName(doc.mime_type, doc.file_name)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(doc)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDownload(doc, url)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => setReplaceDoc(doc)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => void openHistory(doc)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <History className="h-3.5 w-3.5" />
                      History
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteDoc(doc)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>

                {historyDocId === doc.id ? (
                  <div className="mt-3 rounded-md border border-border bg-background/50 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-foreground">
                        Version history
                      </p>
                      <button
                        type="button"
                        onClick={() => setHistoryDocId(null)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Close
                      </button>
                    </div>
                    {loadingHistory ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading versions…
                      </div>
                    ) : !versions.length ? (
                      <p className="text-xs text-muted-foreground">
                        No prior versions recorded.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {versions.map((version) => (
                          <li
                            key={version.id}
                            className="flex flex-wrap items-center justify-between gap-2 text-xs"
                          >
                            <span className="text-muted-foreground">
                              v{version.version}
                              {version.is_current ? " (current)" : ""}
                              {" · "}
                              {version.file_name}
                              {" · "}
                              {formatDocumentDate(version.created_at)}
                            </span>
                            <button
                              type="button"
                              onClick={() => void downloadVersion(version)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-accent"
                            >
                              <Download className="h-3 w-3" />
                              Download
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <DocumentUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={(message) => {
          setToast({ message });
          refresh();
        }}
        mode="upload"
        entityType={entityType}
        entityId={entityId}
        businessCaseId={businessCaseId}
        contractId={contractId}
        shipmentId={shipmentId}
        invoiceId={invoiceId}
        paymentId={paymentId}
        companyId={companyId}
        counterpartyId={counterpartyId}
        productId={productId}
      />

      <DocumentUploadModal
        open={Boolean(replaceDoc)}
        onClose={() => setReplaceDoc(null)}
        onSuccess={(message) => {
          setToast({ message });
          refresh();
        }}
        mode="replace"
        existingDocument={replaceDoc}
      />

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
          refresh();
        }}
      />
    </div>
  );
}
