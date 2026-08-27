export type ContractAiErrorCode =
  | "not_configured"
  | "invalid_pdf"
  | "file_too_large"
  | "auth"
  | "billing"
  | "timeout"
  | "invalid_output"
  | "unsupported_pdf"
  | "unreadable_pdf"
  | "storage"
  | "database"
  | "duplicate_contract"
  | "unknown";

export class ContractAiError extends Error {
  readonly code: ContractAiErrorCode;
  readonly stage: string;
  readonly httpStatus: number | null;
  readonly requestId: string | null;
  readonly providerCode: string | null;
  readonly providerType: string | null;

  constructor(input: {
    message: string;
    code: ContractAiErrorCode;
    stage: string;
    httpStatus?: number | null;
    requestId?: string | null;
    providerCode?: string | null;
    providerType?: string | null;
  }) {
    super(input.message);
    this.name = "ContractAiError";
    this.code = input.code;
    this.stage = input.stage;
    this.httpStatus = input.httpStatus ?? null;
    this.requestId = input.requestId ?? null;
    this.providerCode = input.providerCode ?? null;
    this.providerType = input.providerType ?? null;
  }
}

export function logContractAiError(error: unknown, stage: string) {
  if (error instanceof ContractAiError) {
    console.error("[contract-ai]", {
      stage: error.stage || stage,
      code: error.code,
      httpStatus: error.httpStatus,
      requestId: error.requestId,
      providerCode: error.providerCode,
      providerType: error.providerType,
      message: error.message,
    });
    return;
  }

  const anyErr = error as {
    status?: number;
    code?: string;
    type?: string;
    message?: string;
    request_id?: string;
    headers?: { get?: (name: string) => string | null };
  };

  console.error("[contract-ai]", {
    stage,
    code: anyErr?.code ?? "unknown",
    httpStatus: anyErr?.status ?? null,
    requestId:
      anyErr?.request_id ??
      anyErr?.headers?.get?.("x-request-id") ??
      null,
    providerType: anyErr?.type ?? null,
    message: anyErr?.message ?? "Unknown error",
  });
}

export function mapOpenAiError(error: unknown, stage: string): ContractAiError {
  const anyErr = error as {
    status?: number;
    code?: string;
    type?: string;
    message?: string;
    request_id?: string;
    headers?: { get?: (name: string) => string | null };
  };

  const status = anyErr?.status ?? null;
  const providerCode = anyErr?.code ?? null;
  const providerType = anyErr?.type ?? null;
  const requestId =
    anyErr?.request_id ??
    anyErr?.headers?.get?.("x-request-id") ??
    null;
  const rawMessage = anyErr?.message || "OpenAI request failed.";

  let code: ContractAiErrorCode = "unknown";
  let message = rawMessage;

  if (status === 401 || providerCode === "invalid_api_key") {
    code = "auth";
    message = "OpenAI authentication failed. Check CONTRACT_AI_API_KEY / OPENAI_API_KEY.";
  } else if (
    status === 429 ||
    providerCode === "insufficient_quota" ||
    /quota|billing|rate.?limit/i.test(rawMessage)
  ) {
    code = "billing";
    message =
      "OpenAI billing or quota error. Check plan limits and billing status.";
  } else if (
    status === 408 ||
    providerCode === "timeout" ||
    /timeout/i.test(rawMessage)
  ) {
    code = "timeout";
    message = "OpenAI request timed out. Please retry.";
  } else if (/invalid.?json|schema|parse/i.test(rawMessage)) {
    code = "invalid_output";
    message = "OpenAI returned invalid structured output. Please retry.";
  } else if (/unsupported|could not interpret|unable to process/i.test(rawMessage)) {
    code = "unsupported_pdf";
    message = "This PDF could not be interpreted by the AI model.";
  }

  return new ContractAiError({
    message,
    code,
    stage,
    httpStatus: status,
    requestId,
    providerCode,
    providerType,
  });
}
