# SKY ERP — AI Integrations

## Purpose

Document how AI is used in SKY ERP and what must remain server-side and reviewable.

## Current state

### A) Contract PDF extraction (OpenAI) — primary integration

| Piece | Location |
| --- | --- |
| Client factory | `src/lib/ai/contracts/client.ts` |
| Extract | `src/lib/ai/contracts/extract.ts` |
| Schema / Zod | `src/lib/ai/contracts/schema.ts` |
| Prompts | `src/lib/ai/contracts/prompt.ts` |
| Match | `src/lib/ai/contracts/match.ts` |
| HTTP | `/api/contracts/import`, reextract route |

**Mechanism:** OpenAI Files API (`purpose: user_data`) + Responses API structured parse → Zod validate → human review → optional contract create.

**Secrets:** `CONTRACT_AI_API_KEY` or `OPENAI_API_KEY` (server only). Optional `CONTRACT_AI_MODEL`, `CONTRACT_AI_TIMEOUT_MS`.

### B) In-app “AI” assistant page

| Piece | Location |
| --- | --- |
| Route | `/ai` |
| Logic | `src/lib/platform/ai.ts` |
| UI | `src/components/ai/AiAssistantView.tsx` |

**Mechanism:** Keyword/rule router over Supabase queries — **not** the OpenAI chat API.

## Confirmed rules

- AI must not silently modify business data.
- Suggestions/extractions are reviewable.
- PDF content is untrusted; prompts instruct to ignore jailbreaks.
- Never send secrets or unnecessary personal data to providers.
- Never expose API keys to the browser.

## Constraints

- Do not move extraction to Client Components.
- Do not bypass Zod/schema validation on model output.
- Do not invent a second OpenAI stack; extend `src/lib/ai/contracts/`.

## Known risks / gaps

- Assistant branding may overstate capabilities vs rule engine.
- Default model string may be `gpt-5` if env unset — confirm suitability before production.
- Prompt injection can still bias extracted field values; human review is mandatory.
- Import depends on DB tables + billing/quota of OpenAI account.

## Development rules

- Keep developer vs user prompts separated.
- Log request metadata (stage, model id, error codes) never raw keys or full PDF text.
- Prefer additive schema fields with confidence/nullability.

## Planned

- Optional richer assistant with tool-calling (approval required).
- Stronger red-team tests for prompt injection.
- Retention policy for import artifacts (`CONTRACT_IMPORT_RETENTION_DAYS` mentioned in README).
