import { assertCan } from "@/lib/platform/permissions";
import { isContractAiConfigured } from "@/lib/ai/contracts/client";
import {
  loadImportFileFromStorage,
  logContractImport,
  markImportFailed,
  runExtractionPipeline,
  type ImportProgressEvent,
} from "@/lib/contracts/import/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function encodeNdjson(event: ImportProgressEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

export async function POST(request: Request, context: RouteContext) {
  const denied = await assertCan("contracts.write");
  if (denied) {
    return Response.json({ error: denied }, { status: 403 });
  }

  if (!isContractAiConfigured()) {
    return Response.json(
      {
        error:
          "AI contract import is not configured. Set CONTRACT_AI_API_KEY or OPENAI_API_KEY.",
      },
      { status: 503 }
    );
  }

  const { id } = await context.params;
  if (!id) {
    return Response.json({ error: "Import id is required." }, { status: 400 });
  }

  logContractImport("reextract.accept", { importId: id });
  const abortSignal = request.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ImportProgressEvent) => {
        try {
          controller.enqueue(encodeNdjson(event));
        } catch {
          // disconnected
        }
      };

      let completed = false;
      let settledFailure = false;

      try {
        send({
          stage: "loading_storage",
          progress: 20,
          message: "Loading stored PDF",
        });

        const loaded = await loadImportFileFromStorage(id);

        if (abortSignal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        send({
          stage: "sending_ai",
          progress: 40,
          message: "Sending PDF to AI",
        });

        const result = await runExtractionPipeline({
          importId: id,
          file: loaded.file,
          fileName: loaded.fileName,
          signal: abortSignal,
          onProgress: (event) => {
            if (event.stage === "sending_ai") {
              send({
                stage: "extracting",
                progress: 55,
                message: "Extracting contract fields",
              });
            } else if (event.stage === "matching") {
              send({
                stage: "matching",
                progress: 80,
                message: "Matching companies and counterparties",
              });
              send({
                stage: "matching_products",
                progress: 88,
                message: "Matching products",
              });
            } else if (event.stage === "preparing_review") {
              send({
                stage: "preparing_review",
                progress: 95,
                message: "Preparing review",
              });
            }
          },
        });

        send({
          stage: "done",
          progress: 100,
          data: {
            importRecord: result.importRecord,
            previewUrl: result.previewUrl,
            extraction: result.extraction,
          },
        });
        completed = true;
        logContractImport("reextract.done", { importId: id });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          await markImportFailed(id, "Import cancelled.").catch(() => undefined);
          settledFailure = true;
          send({ stage: "error", progress: 0, error: "Import cancelled." });
          return;
        }
        const message =
          error instanceof Error ? error.message : "Re-extraction failed.";
        logContractImport("reextract.error", { importId: id, message });
        await markImportFailed(id, message).catch(() => undefined);
        settledFailure = true;
        send({ stage: "error", progress: 0, error: message });
      } finally {
        if (!completed && !settledFailure) {
          await markImportFailed(
            id,
            "Re-extraction interrupted before completion."
          ).catch(() => undefined);
        }
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
