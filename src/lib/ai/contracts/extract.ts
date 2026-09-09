import { toFile } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  createContractOpenAiClient,
  getContractAiModel,
  getContractAiTimeoutMs,
  isContractAiConfigured,
} from "@/lib/ai/contracts/client";
import {
  ContractAiError,
  logContractAiError,
  mapOpenAiError,
} from "@/lib/ai/contracts/errors";
import {
  CONTRACT_EXTRACTION_DEVELOPER_PROMPT,
  CONTRACT_EXTRACTION_USER_PROMPT,
} from "@/lib/ai/contracts/prompt";
import {
  ContractExtractionZodSchema,
  type ContractExtractionResult,
} from "@/lib/ai/contracts/schema";

export type ExtractContractFromPdfResult =
  | {
      success: true;
      extraction: ContractExtractionResult;
      warnings: string[];
      model: string;
      requestId: string | null;
    }
  | { success: false; error: string; warnings: string[] };

function collectWarnings(extraction: ContractExtractionResult): string[] {
  const warnings: string[] = [];
  if (!extraction.commercial.payment_terms.value) {
    warnings.push("Missing payment terms.");
  }
  if (!extraction.commercial.delivery_deadline.value) {
    warnings.push("Missing delivery terms.");
  }
  if (extraction.signatures.seller_signature_present.value === false) {
    warnings.push("Seller signature appears missing.");
  }
  if (extraction.signatures.buyer_signature_present.value === false) {
    warnings.push("Buyer signature appears missing.");
  }
  if (!extraction.commercial.total_amount.value) {
    warnings.push("Missing total amount.");
  }
  return warnings;
}

/** Canonical extraction path: OpenAI Files API + Responses API (input_file). */
export async function extractContractFromPdf(input: {
  file?: File | Blob;
  bytes?: ArrayBuffer | Uint8Array;
  fileName: string;
  sourceText?: string;
  signal?: AbortSignal;
}): Promise<ExtractContractFromPdfResult> {
  if (!isContractAiConfigured()) {
    return {
      success: false,
      error:
        "AI contract import is not configured. Set CONTRACT_AI_API_KEY or OPENAI_API_KEY.",
      warnings: [],
    };
  }

  if (input.signal?.aborted) {
    return {
      success: false,
      error: "Import cancelled.",
      warnings: [],
    };
  }

  const model = getContractAiModel();
  const openai = createContractOpenAiClient();
  const timeoutMs = getContractAiTimeoutMs();
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal =
    input.signal != null
      ? AbortSignal.any([input.signal, timeoutSignal])
      : timeoutSignal;

  let openaiFileId: string | null = null;
  let requestId: string | null = null;

  try {
    console.info("[contract-ai]", {
      stage: "extract.start",
      model,
      timeoutMs,
      fileName: input.fileName,
      bytes: input.file?.size ?? (input.bytes ? input.bytes.byteLength : null),
    });

    if (!input.sourceText) {
    const uploadable = input.file
      ? await toFile(input.file, input.fileName, { type: "application/pdf" })
      : await toFile(
          Buffer.from(
            input.bytes instanceof Uint8Array
              ? input.bytes
              : new Uint8Array(input.bytes!)
          ),
          input.fileName,
          { type: "application/pdf" }
        );

    console.info("[contract-ai]", { stage: "files.create.start", model });
    const uploaded = await openai.files.create(
      {
        file: uploadable,
        purpose: "user_data",
      },
      { signal }
    );
    openaiFileId = uploaded.id;
    console.info("[contract-ai]", {
      stage: "files.create.done",
      fileId: uploaded.id,
    });

    }
    console.info("[contract-ai]", { stage: "responses.parse.start", model });
    const response = await openai.responses.parse(
      {
        model,
        store: false,
        instructions: CONTRACT_EXTRACTION_DEVELOPER_PROMPT,
        input: [
          {
            role: "user",
            content: [
              ...(input.sourceText ? [{ type: "input_text" as const, text: "Untrusted DOCX text (layout/images unavailable; do not infer signatures or page numbers):\n" + input.sourceText }] : [{ type: "input_file" as const, file_id: openaiFileId! }]),
              {
                type: "input_text",
                text: CONTRACT_EXTRACTION_USER_PROMPT,
              },
            ],
          },
        ],
        text: {
          format: zodTextFormat(
            ContractExtractionZodSchema,
            "contract_extraction"
          ),
        },
      },
      { signal }
    );

    requestId = response.id ?? null;
    console.info("[contract-ai]", {
      stage: "responses.parse.done",
      requestId,
      model,
    });
    const parsed = response.output_parsed;
    if (!parsed) {
      throw new ContractAiError({
        code: "invalid_output",
        stage: "responses.parse",
        message: "OpenAI returned no structured contract extraction output.",
        requestId,
      });
    }

    const validated = ContractExtractionZodSchema.safeParse(parsed);
    if (!validated.success) {
      throw new ContractAiError({
        code: "invalid_output",
        stage: "schema.validate",
        message: "OpenAI structured output failed schema validation.",
        requestId,
      });
    }

    const hasSignal =
      Boolean(validated.data.general.contract_number.value) ||
      Boolean(validated.data.buyer.buyer_legal_name.value) ||
      Boolean(validated.data.supplier.supplier_legal_name.value) ||
      Boolean(validated.data.company.company_legal_name.value) ||
      Boolean(validated.data.commercial.total_amount.value) ||
      validated.data.products.length > 0;

    if (!hasSignal) {
      throw new ContractAiError({
        code: "unreadable_pdf",
        stage: "extract.signal",
        message:
          "No recognizable contract fields were extracted. The scanned PDF may be unreadable.",
        requestId,
      });
    }

    return {
      success: true,
      extraction: validated.data,
      warnings: collectWarnings(validated.data),
      model,
      requestId,
    };
  } catch (error) {
    if (
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error &&
        (/aborted|cancelled|timeout|timed out/i.test(error.message) ||
          error.name === "TimeoutError"))
    ) {
      const timedOut =
        timeoutSignal.aborted && !(input.signal?.aborted ?? false);
      return {
        success: false,
        error: timedOut
          ? `AI extraction timed out after ${Math.round(timeoutMs / 1000)} seconds.`
          : "Import cancelled.",
        warnings: [],
      };
    }
    logContractAiError(error, "extractContractFromPdf");
    if (error instanceof ContractAiError) {
      return { success: false, error: error.message, warnings: [] };
    }
    const mapped = mapOpenAiError(error, "extractContractFromPdf");
    logContractAiError(mapped, mapped.stage);
    return { success: false, error: mapped.message, warnings: [] };
  } finally {
    if (openaiFileId) {
      try {
        await openai.files.delete(openaiFileId);
      } catch (cleanupError) {
        console.warn("[contract-ai] failed to delete temporary OpenAI file", {
          stage: "files.delete",
          message:
            cleanupError instanceof Error
              ? cleanupError.message
              : "cleanup failed",
        });
      }
    }
  }
}
