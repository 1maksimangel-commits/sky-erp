# Module — Contracts

## Phase 4 canonical behavior

See [Contracts stabilization](../Development/ContractsStabilization.md) for the
current explicit legal-party model, workspace/party access, legal snapshots,
atomic PDF/DOCX review confirmation, immutable originals and regression gate.
The sections below describe the earlier implementation and are historical
context where they conflict with that Phase 4 document. In particular, company
ownership no longer implies Seller, confirmation no longer performs a sequence
of partial writes, and source paths are company-scoped.

## Purpose

Commercial hub for SKY ERP, including AI PDF import with human review.

## Current state

Routes `/contracts`, `/contracts/[id]` + tabs (documents, logistics, warehouse, finance, history, business-case).  
Libs: `src/lib/contracts/*`, `src/lib/ai/contracts/*`, import UI under `src/components/contracts/import/*`.  
API: `POST /api/contracts/import`, `POST /api/contracts/import/[id]/reextract`.  
Migrations: `20260804230000`, `20260805040000` (+ hub `…140000`).

## Confirmed PDF import flow

```text
PDF upload → client validation (PDF, ≤50MB)
  → multipart/form-data POST /api/contracts/import (field: file)
  → server validation → Storage documents/imports/{id}/…
  → contract_imports row (processing)
  → OpenAI Files + Responses structured parse
  → match companies / counterparties / products
  → review status + Review UI
  → explicit confirm creates contract (never silent)
```

| Requirement | Fact |
| --- | --- |
| Encoding | multipart/form-data |
| Size | 50 MB |
| Progress | NDJSON via fetch stream |
| Cancel / timeout | AbortSignal; client ~5 min; API maxDuration 300 |
| Prompt injection | PDF treated as untrusted data in prompts |
| Env | `CONTRACT_AI_API_KEY` / `OPENAI_API_KEY` (server) |

## Confirmed rules

- Contract binds company, parties, products, prices, currency, Incoterms, payment/delivery terms.  
- PDF import must remain backward compatible; improve parser, don’t rip out working path without approval.  
- Create/update/delete contract actions exist.  
- Amendments should be auditable (history/timeline).

## Constraints

- No OpenAI from browser.  
- No silent contract create from AI.  
- Prefer DMS upload helpers over weak hub upload when attaching files.

## Known risks / gaps

- Missing remote `contract_imports` blocks import.  
- `processing` rows can stick if process dies.  
- Hub `uploadContractDocument` weaker validation.  
- Orphaned older workflow UI components.

## Development rules

- Extend Zod schema + prompts carefully.  
- Log stages without PDF contents/keys.  
- Keep review-before-create invariant.

## Planned

- Processing TTL sweeper · stronger storage ACL · production model env guidance.
