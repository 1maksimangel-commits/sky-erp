"use client";

import { AlertCircle, FileUp, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  stageToWizardIndex,
  uploadContractImportViaApi,
} from "@/lib/contracts/import/browser-upload";
import type { ContractImportRecord } from "@/lib/contracts/import/types";

const PROCESS_STAGES = [
  "Uploading PDF",
  "Sending PDF to AI",
  "Extracting contract fields",
  "Matching companies and counterparties",
  "Matching products",
  "Preparing review",
] as const;

/** Hard client ceiling so the UI never spins forever if the stream stalls. */
const CLIENT_IMPORT_TIMEOUT_MS = 5 * 60 * 1000;

type ContractPdfImportWizardProps = {
  open: boolean;
  aiConfigured: boolean;
  aiMessage: string | null;
  onClose: () => void;
  onReady: (input: {
    importRecord: ContractImportRecord;
    previewUrl: string | null;
  }) => void;
};

export function ContractPdfImportWizard(props: ContractPdfImportWizardProps) {
  if (!props.open) return null;
  return <ContractPdfImportWizardInner key="import-wizard" {...props} />;
}

function ContractPdfImportWizardInner({
  aiConfigured,
  aiMessage,
  onClose,
  onReady,
}: ContractPdfImportWizardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (busy) {
          abortRef.current?.abort();
          return;
        }
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      abortRef.current?.abort();
    };
  }, [busy, onClose]);

  function resetBusyState() {
    setBusy(false);
    setProgress(0);
    setStageIndex(0);
    setStatusMessage(null);
    submittingRef.current = false;
  }

  function assignFile(next: File | null) {
    if (!next) {
      setFile(null);
      return;
    }
    if (next.size > 50 * 1024 * 1024) {
      setError("File exceeds the 50 MB upload limit.");
      setFile(null);
      return;
    }
    const mime = next.type.toLowerCase();
    const pdf =
      mime === "application/pdf" || next.name.toLowerCase().endsWith(".pdf");
    if (!pdf) {
      setError("Only PDF files are allowed.");
      setFile(null);
      return;
    }
    if (mime && mime !== "application/pdf" && mime !== "application/octet-stream") {
      setError(`Invalid MIME type "${mime}". Expected application/pdf.`);
      setFile(null);
      return;
    }
    setError(null);
    setFile(next);
  }

  function handleCancel() {
    if (busy) {
      abortRef.current?.abort();
      return;
    }
    onClose();
  }

  async function handleStart() {
    if (!file || busy || submittingRef.current) return;
    if (!aiConfigured) {
      setError(aiMessage || "AI provider is not configured.");
      return;
    }

    submittingRef.current = true;
    setBusy(true);
    setError(null);
    setStageIndex(0);
    setProgress(2);
    setStatusMessage("Uploading PDF");

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, CLIENT_IMPORT_TIMEOUT_MS);

    try {
      const result = await uploadContractImportViaApi({
        file,
        signal: controller.signal,
        onUploadProgress: (percent) => {
          setProgress(Math.max(2, Math.round(percent * 0.18)));
          setStageIndex(0);
          setStatusMessage(
            percent < 100 ? `Uploading PDF (${percent}%)` : "Uploading PDF"
          );
        },
        onEvent: (event) => {
          if (event.stage === "error" && "error" in event) {
            setError(event.error);
            return;
          }
          setStageIndex(stageToWizardIndex(event.stage));
          if (typeof event.progress === "number") {
            setProgress(Math.max(event.progress, percentFloor(event.stage)));
          }
          if ("message" in event && event.message) {
            setStatusMessage(event.message);
          } else if (event.stage !== "done") {
            const idx = stageToWizardIndex(event.stage);
            setStatusMessage(PROCESS_STAGES[idx] ?? event.stage);
          }
        },
      });

      setProgress(100);
      setStageIndex(PROCESS_STAGES.length - 1);
      setStatusMessage("Preparing review");
      resetBusyState();
      onReady({
        importRecord: result.importRecord,
        previewUrl: result.previewUrl,
      });
    } catch (err) {
      resetBusyState();
      if (err instanceof DOMException && err.name === "AbortError") {
        setError(
          timedOut
            ? "Import timed out after 5 minutes. You can retry with the same PDF."
            : "Import cancelled."
        );
        return;
      }
      setError(err instanceof Error ? err.message : "Extraction failed.");
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function percentFloor(stage: string): number {
    switch (stage) {
      case "uploading_storage":
      case "loading_storage":
        return 20;
      case "sending_ai":
        return 40;
      case "extracting":
        return 55;
      case "matching":
        return 80;
      case "matching_products":
        return 88;
      case "preparing_review":
        return 95;
      case "done":
        return 100;
      default:
        return 0;
    }
  }

  const canStart = Boolean(file) && aiConfigured && !busy;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={busy ? undefined : onClose}
      />
      <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Import from PDF
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Send the PDF to OpenAI, then review before creating the contract.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {!aiConfigured ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              {aiMessage ||
                "Set CONTRACT_AI_API_KEY or OPENAI_API_KEY on the server."}
            </div>
          ) : null}

          {error ? (
            <div className="space-y-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
              <button
                type="button"
                disabled={!file || !aiConfigured || busy}
                onClick={() => void handleStart()}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground"
              >
                Retry extraction
              </button>
            </div>
          ) : null}

          {!busy ? (
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                assignFile(e.dataTransfer.files?.[0] ?? null);
              }}
              className={`rounded-lg border border-dashed px-4 py-8 text-center ${
                dragOver
                  ? "border-foreground/40 bg-accent/40"
                  : "border-border bg-background/40"
              }`}
            >
              <FileUp className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-2 text-sm text-foreground">
                Drag and drop a contract PDF
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                PDF only · max 50 MB
              </p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-3 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium"
              >
                Select PDF
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => assignFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Selected: {file.name} ({(file.size / (1024 * 1024)).toFixed(2)}{" "}
                  MB)
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-border bg-accent/10 p-4">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {statusMessage || PROCESS_STAGES[stageIndex]}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-accent">
                <div
                  className="h-full bg-foreground/70 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {PROCESS_STAGES.map((stage, index) => (
                  <li
                    key={stage}
                    className={index <= stageIndex ? "text-foreground" : undefined}
                  >
                    {index < stageIndex ? "✓" : index === stageIndex ? "…" : "•"}{" "}
                    {stage}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-md border border-border px-4 py-2 text-sm"
          >
            {busy ? "Cancel import" : "Cancel"}
          </button>
          <button
            type="button"
            disabled={!canStart}
            onClick={() => void handleStart()}
            className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Start Extraction"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
