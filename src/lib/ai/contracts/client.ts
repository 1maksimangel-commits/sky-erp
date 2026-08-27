import OpenAI from "openai";

export function getContractAiApiKey(): string | null {
  const key =
    process.env.CONTRACT_AI_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    "";
  return key || null;
}

export function isContractAiConfigured(): boolean {
  return Boolean(getContractAiApiKey());
}

export function getContractAiModel(): string {
  return process.env.CONTRACT_AI_MODEL?.trim() || "gpt-5";
}

/** Soft timeout for OpenAI upload + Responses parse (ms). */
export function getContractAiTimeoutMs(): number {
  const raw = process.env.CONTRACT_AI_TIMEOUT_MS?.trim();
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed >= 15_000 && parsed <= 600_000) {
    return parsed;
  }
  return 180_000;
}

/** Server-only OpenAI client for contract PDF extraction. */
export function createContractOpenAiClient(): OpenAI {
  const apiKey = getContractAiApiKey();
  if (!apiKey) {
    throw new Error(
      "AI contract import is not configured. Set CONTRACT_AI_API_KEY or OPENAI_API_KEY."
    );
  }
  return new OpenAI({
    apiKey,
    timeout: getContractAiTimeoutMs(),
    maxRetries: 1,
  });
}
