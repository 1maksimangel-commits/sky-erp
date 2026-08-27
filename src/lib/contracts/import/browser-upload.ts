"use client";

import type { ContractExtractionResult } from "@/lib/ai/contracts/schema";
import type { ContractImportRecord } from "@/lib/contracts/import/types";

export type ContractImportDonePayload = {
  importRecord: ContractImportRecord;
  previewUrl: string | null;
  extraction: ContractExtractionResult;
};

export type ContractImportStreamEvent =
  | {
      stage: string;
      progress: number;
      message?: string;
    }
  | {
      stage: "done";
      progress: 100;
      data: ContractImportDonePayload;
    }
  | {
      stage: "error";
      progress: number;
      error: string;
    };

export type UploadContractImportOptions = {
  file: File;
  /** Browser→API bytes transferred (0–100). Best-effort; may stay 0 with fetch. */
  onUploadProgress?: (percent: number) => void;
  /** NDJSON progress events from the API (delivered incrementally). */
  onEvent?: (event: ContractImportStreamEvent) => void;
  signal?: AbortSignal;
};

async function readNdjsonStream(
  response: Response,
  onEvent?: (event: ContractImportStreamEvent) => void
): Promise<ContractImportDonePayload> {
  if (!response.body) {
    const text = await response.text();
    return consumeNdjsonText(text, onEvent);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done: ContractImportDonePayload | null = null;
  let streamError: string | null = null;

  while (true) {
    const { value, ended } = await readChunk(reader);
    if (ended) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line) continue;
      let event: ContractImportStreamEvent;
      try {
        event = JSON.parse(line) as ContractImportStreamEvent;
      } catch {
        continue;
      }
      onEvent?.(event);
      if (event.stage === "done" && "data" in event) done = event.data;
      if (event.stage === "error" && "error" in event) {
        streamError = event.error;
        // Fail fast — do not wait for stream close on fatal errors.
        throw new Error(event.error);
      }
    }
  }

  if (buffer.trim()) {
    try {
      const event = JSON.parse(buffer.trim()) as ContractImportStreamEvent;
      onEvent?.(event);
      if (event.stage === "done" && "data" in event) done = event.data;
      if (event.stage === "error" && "error" in event) {
        throw new Error(event.error);
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        // trailing incomplete line — ignore
      } else {
        throw error;
      }
    }
  }

  if (done) return done;
  throw new Error(streamError || "Import finished without a result payload.");
}

async function readChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<{ value: Uint8Array; ended: boolean }> {
  const result = await reader.read();
  if (result.done) return { value: new Uint8Array(), ended: true };
  return { value: result.value, ended: false };
}

/**
 * Multipart upload to /api/contracts/import using fetch + ReadableStream
 * so NDJSON stage events arrive incrementally (XHR often buffers until done).
 */
export async function uploadContractImportViaApi(
  options: UploadContractImportOptions
): Promise<ContractImportDonePayload> {
  const formData = new FormData();
  formData.set("file", options.file, options.file.name);

  // Best-effort: mark upload as in-flight immediately.
  options.onUploadProgress?.(5);

  const response = await fetch("/api/contracts/import", {
    method: "POST",
    body: formData,
    signal: options.signal,
  });

  options.onUploadProgress?.(100);

  if (
    response.status === 403 ||
    response.status === 503 ||
    response.status === 400 ||
    response.status === 413
  ) {
    let message = `Request failed (${response.status}).`;
    try {
      const json = (await response.json()) as { error?: string };
      if (json.error) message = json.error;
    } catch {
      if (response.status === 413) {
        message = "Upload rejected: file is too large for the server.";
      }
    }
    throw new Error(message);
  }

  if (!response.ok) {
    let message = `Import request failed (${response.status}).`;
    try {
      const json = (await response.json()) as { error?: string };
      if (json.error) message = json.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return readNdjsonStream(response, options.onEvent);
}

/**
 * Re-run extraction for an existing import (PDF already in Storage).
 */
export async function reextractContractImportViaApi(
  importId: string,
  options?: {
    onEvent?: (event: ContractImportStreamEvent) => void;
    signal?: AbortSignal;
  }
): Promise<ContractImportDonePayload> {
  const response = await fetch(`/api/contracts/import/${importId}/reextract`, {
    method: "POST",
    signal: options?.signal,
  });

  if (!response.ok) {
    let message = `Re-extraction failed (${response.status}).`;
    try {
      const json = (await response.json()) as { error?: string };
      if (json.error) message = json.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return readNdjsonStream(response, options?.onEvent);
}

function consumeNdjsonText(
  text: string,
  onEvent?: (event: ContractImportStreamEvent) => void
): ContractImportDonePayload {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let done: ContractImportDonePayload | null = null;
  let lastError: string | null = null;

  for (const line of lines) {
    let event: ContractImportStreamEvent;
    try {
      event = JSON.parse(line) as ContractImportStreamEvent;
    } catch {
      continue;
    }
    onEvent?.(event);
    if (event.stage === "done" && "data" in event) done = event.data;
    if (event.stage === "error" && "error" in event) lastError = event.error;
  }

  if (done) return done;
  throw new Error(lastError || "Import finished without a result payload.");
}

/** Map API stage ids to wizard checklist indices. */
export function stageToWizardIndex(stage: string): number {
  switch (stage) {
    case "uploading_storage":
    case "loading_storage":
      return 0;
    case "sending_ai":
      return 1;
    case "extracting":
      return 2;
    case "matching":
      return 3;
    case "matching_products":
      return 4;
    case "preparing_review":
    case "done":
      return 5;
    default:
      return 0;
  }
}
