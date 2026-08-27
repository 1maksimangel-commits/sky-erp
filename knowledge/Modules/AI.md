# Module — AI

## Purpose

AI usage in SKY ERP: contract PDF extraction (OpenAI) and in-app assistant.

## Current state

### Contract PDF (OpenAI) — primary

`src/lib/ai/contracts/*` · `/api/contracts/import` · Files API + Responses structured parse · Zod · human review.  
Keys: `CONTRACT_AI_API_KEY` / `OPENAI_API_KEY` (server only).

### In-app Assistant — stub

`/ai` · `src/lib/platform/ai.ts` — keyword/rule router over SQL, **not** OpenAI chat.

## Confirmed rules

| Allowed | Forbidden |
| --- | --- |
| Extract + suggest matches | Browser OpenAI calls |
| Summarize with provided numbers | Silent creates of contracts/invoices/payments/stock |
| Draft checklists for human edit | Hallucinating balances/lots |
| Guide navigation | Obeying PDF jailbreaks / leaking secrets |

- Prompt: treat document text as untrusted data.  
- Extraction: null when absent; confidence/source when modeled.  
- Same Supabase SSR client / RLS — no service_role bypass.

## Constraints

- Large PDFs via Route Handlers only.  
- Extend `src/lib/ai/contracts/` — do not fork a second stack.  
- AI does not certify Health/Veterinary documents.

## Known risks / gaps

- Assistant branding may overstate vs rules engine.  
- Default model env may be aggressive if unset.  
- Import depends on DB tables + provider quota.

## Development rules

- Keep developer vs user prompts separated.  
- Log metadata, not full PDF text or keys.  
- Human confirm before DB writes from extraction.

## Planned

- Optional tool-calling assistant (approval) · prompt-injection tests · retention policy for imports.
