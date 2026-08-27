# SKY ERP — Contracts and PDF Import

## Purpose

Contracts are the commercial hub. PDF import extracts structured data for **human review** before contract creation.

## Current state

| Area | Location |
| --- | --- |
| Routes | `/contracts`, `/contracts/[id]` (+ tabs: documents, logistics, warehouse, finance, history, business-case) |
| UI | `src/components/contracts/*`, `src/components/contracts/import/*` |
| Actions | `src/lib/contracts/actions.ts`, `hub-actions.ts`, `import/*` |
| AI | `src/lib/ai/contracts/*` |
| API | `src/app/api/contracts/import/route.ts`, `.../[id]/reextract/route.ts` |
| Migrations | `20260804230000_contract_pdf_import.sql`, `20260805040000_contract_import_schema_ensure.sql` |

## Confirmed PDF import flow

```text
PDF upload (wizard)
  → client validation (PDF MIME/extension, max 50 MB)
  → multipart/form-data POST /api/contracts/import (field name: file)
  → server validation
  → progress: uploading_storage
  → Supabase Storage (documents bucket, imports/{id}/…)
  → insert contract_imports (status processing)
  → OpenAI Files API + Responses parse (structured Zod schema)
  → match companies / counterparties / products
  → persist extraction + matches (status review)
  → NDJSON stages to client
  → Review workspace (human edits)
  → explicit confirm creates contract (+ attachments) — not silent
```

### Multipart / limits / UX requirements

| Requirement | Current fact |
| --- | --- |
| Encoding | `multipart/form-data` |
| Field | `file` |
| Types | PDF only (`application/pdf` or `.pdf`; rejects other MIME when set) |
| Size | 50 MB (`MAX_CONTRACT_IMPORT_BYTES`, Next `proxyClientMaxBodySize: "50mb"`) |
| Progress | NDJSON stream; client uses `fetch` + ReadableStream |
| Cancellation | AbortSignal; client timeout 5 minutes; API `maxDuration` 300 |
| Errors | Must surface stage errors; must not spin forever on Processing |
| Prompt injection | Developer prompt treats PDF as untrusted data (`prompt.ts`) |
| Creation | **No silent contract create** — review then confirm |

### Env var names (server-only)

`CONTRACT_AI_API_KEY` (preferred) · `OPENAI_API_KEY` (fallback) · optional `CONTRACT_AI_MODEL` · `CONTRACT_AI_TIMEOUT_MS`

## Confirmed architecture / rules

- Contract create/update/delete exist in contracts actions.
- Hub tabs compose logistics/finance/warehouse/documents around one contract.
- AI matching suggests links; user confirms.
- Backward compatibility of import path is mandatory (`AGENTS.md`).

## Constraints

- Never destroy imported extraction history casually.
- Improve parser/extraction; do not replace a working import pipeline wholesale without approval.
- Do not call OpenAI from the browser.

## Known risks / gaps

- Remote missing `contract_imports` blocks import (`PGRST205`).
- Rows can remain `processing` if process dies before `markImportFailed`.
- Hub `uploadContractDocument` has weaker validation than DMS upload path.
- Orphaned older UI (`ContractWorkflow`) — prefer workspace shell.

## Development rules

- Keep review-before-create invariant.
- Log stages without logging PDF contents or API keys.
- Prefer extending Zod schema + prompts carefully; validate structured output.
- Reextract goes through `/api/contracts/import/[id]/reextract`.

## Planned

- Stale `processing` sweeper.
- Stronger ACL on signed URLs / storage paths.
- Optional model default documentation for production.
