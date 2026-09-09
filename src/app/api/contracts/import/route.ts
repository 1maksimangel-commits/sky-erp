import { assertCan } from "@/lib/platform/permissions";
import { isContractAiConfigured } from "@/lib/ai/contracts/client";
import {
  createImportAndStorePdf,
  logContractImport,
  markImportFailed,
  runExtractionPipeline,
  validateImportPdfFileStrict,
  type ImportProgressEvent,
} from "@/lib/contracts/import/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function encodeNdjson(event: ImportProgressEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

export async function POST(request: Request) {
  const denied = await assertCan("contracts.write");
  if (denied) {
    return Response.json({ error: denied }, { status: 403 });
  }

  if (!isContractAiConfigured()) {
    logContractImport("config.missing");
    return Response.json(
      {
        error:
          "AI contract import is not configured. Set CONTRACT_AI_API_KEY or OPENAI_API_KEY.",
      },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    logContractImport("request.formData.start");
    formData = await request.formData();
    logContractImport("request.formData.done");
  } catch (error) {
    const message = error instanceof Error ? error.message : "parse failed";
    logContractImport("request.formData.error", { message });
    const hint = /Content-Type/i.test(message)
      ? "Expected multipart/form-data with a PDF file field named \"file\"."
      : "Unable to parse multipart form data. File may exceed the 50 MB limit.";
    return Response.json({ error: hint }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "PDF file is required." }, { status: 400 });
  }

  const validationError = await validateImportPdfFileStrict(file);
  if (validationError) {
    logContractImport("request.validate.error", { message: validationError });
    return Response.json({ error: validationError }, { status: 400 });
  }

  logContractImport("request.accept", {
    fileName: file.name,
    bytes: file.size,
    mime: file.type || null,
  });

  const abortSignal = request.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ImportProgressEvent) => {
        try {
          controller.enqueue(encodeNdjson(event));
        } catch {
          // Client disconnected.
        }
      };

      let importId: string | null = null;
      let completed = false;
      let settledFailure = false;

      try {
        if (abortSignal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        send({
          stage: "uploading_storage",
          progress: 20,
          message: "Uploading PDF",
        });

        const created = await createImportAndStorePdf(file);
        importId = created.importId;

        if (abortSignal.aborted) {
          await markImportFailed(importId, "Import cancelled.").catch(
            () => undefined
          );
          settledFailure = true;
          throw new DOMException("Aborted", "AbortError");
        }

        send({
          stage: "sending_ai",
          progress: 40,
          message: "Sending PDF to AI",
        });

        const result = await runExtractionPipeline({
          importId: created.importId,
          file,
          fileName: created.fileName,
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
        logContractImport("request.done", { importId });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          logContractImport("request.aborted", { importId });
          if (importId && !settledFailure) {
            await markImportFailed(importId, "Import cancelled.").catch(
              () => undefined
            );
            settledFailure = true;
          }
          send({
            stage: "error",
            progress: 0,
            error: "Import cancelled.",
          });
          return;
        }
        const message =
          error instanceof Error ? error.message : "Import failed.";
        logContractImport("request.error", { importId, message });
        if (importId) {
          await markImportFailed(importId, message).catch(() => undefined);
          settledFailure = true;
        }
        send({ stage: "error", progress: 0, error: message });
      } finally {
        if (importId && !completed && !settledFailure) {
          // Client disconnect / unexpected exit while still "processing".
          await markImportFailed(
            importId,
            "Import interrupted before completion."
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
