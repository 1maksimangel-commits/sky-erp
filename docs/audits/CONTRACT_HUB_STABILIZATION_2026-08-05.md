# Contract Hub & PDF Import Stabilization — 2026-08-05

**Scope:** Contract Hub PDF import and direct dependencies  
**Policy:** AGENTS.md + management workflow · repo-only · no remote Supabase · no migration apply · no commit · no live OpenAI · no auth/RLS changes  

---

## Current architecture

```text
UI ContractPdfImportWizard
  → local PDF checks (type/size)
  → FormData POST /api/contracts/import (field: file)
  → validateImportPdfFileStrict (%PDF magic)
  → Storage documents/imports/{id}/{safeName}
  → contract_imports status=processing
  → OpenAI Files + Responses.parse (Zod schema) [server-only]
  → match companies / counterparties / products
  → status=review + NDJSON stages to client
  → ContractImportReviewWorkspace
  → explicit confirmContractImport → createContract (+ optional lines/PDF attach)
```

| Layer | Path |
| --- | --- |
| Wizard | `src/components/contracts/import/ContractPdfImportWizard.tsx` |
| Client upload | `src/lib/contracts/import/browser-upload.ts` |
| API | `src/app/api/contracts/import/route.ts`, `.../[id]/reextract/route.ts` |
| Pipeline | `src/lib/contracts/import/service.ts` |
| AI | `src/lib/ai/contracts/{client,extract,prompt,schema,match}.ts` |
| Confirm | `src/lib/contracts/import/actions.ts` |
| Migrations | `20260804230000_contract_pdf_import.sql`, `20260805040000_contract_import_schema_ensure.sql` |

---

## Verified root causes (pre-fix)

| Issue | Cause |
| --- | --- |
| Stuck “processing” | Abort/disconnect paths did not always settle import rows |
| Weak corrupt-PDF rejection | MIME/extension only; no `%PDF` magic check |
| Soft OpenAI timeout | Client timeout on OpenAI SDK; request `signal` not always combined with hard timeout |
| Wizard timeout UX | Abort surfaced only as “cancelled” |
| Confirm while processing | No status/extraction guard before create |
| Entity helpers ungated | `createCounterpartyFromImport` / `createProductFromImport` lacked `assertCan` |
| Partial confirm marking `failed` | Contract already created but import status failed (confusing retries) |
| Schema gaps | Bank details / annexes / delivery_period / container_numbers not modeled |

---

## Files changed

| File | Change |
| --- | --- |
| `src/lib/contracts/import/service.ts` | `%PDF` magic validation helpers; strict validate on store |
| `src/app/api/contracts/import/route.ts` | Strict validate; settle failures; interrupt cleanup |
| `src/app/api/contracts/import/[id]/reextract/route.ts` | Same settle/interrupt pattern |
| `src/lib/ai/contracts/extract.ts` | `AbortSignal.any` + timeout; clearer timeout errors |
| `src/lib/ai/contracts/schema.ts` | banking, delivery_period, container_numbers, referenced_annexes |
| `src/lib/ai/contracts/prompt.ts` | Injection hardening; field coverage instructions |
| `src/components/contracts/import/ContractPdfImportWizard.tsx` | Timeout message; reset busy before review |
| `src/lib/contracts/import/browser-upload.ts` | 413 + richer HTTP errors |
| `src/lib/contracts/import/actions.ts` | `assertCan`; confirm guards; partial-confirm status |
| `supabase/migrations/20260805080000_contract_import_processing_ttl_proposal.sql` | Proposal only (TTL sweeper) |
| `docs/audits/CONTRACT_HUB_STABILIZATION_2026-08-05.md` | This report |

---

## Migrations proposed

| Migration | Status |
| --- | --- |
| `20260804230000` / `20260805040000` | Already in repo — **remote apply still may be required** |
| `20260805080000_contract_import_processing_ttl_proposal.sql` | **Proposal only** — stale `processing` sweeper; do not treat as applied hardening |

No previous migrations edited. None applied in this task.

---

## Security findings

| Finding | Severity | Status |
| --- | --- | --- |
| OpenAI server-side only; keys not `NEXT_PUBLIC_*` | — | Confirmed OK |
| PDF treated as untrusted in prompts | Medium residual | Strengthened wording |
| `assertCan("contracts.write")` on import API + confirm | High residual | Still stubbed admin role (out of scope) |
| Open RLS / storage public policies on `documents` + `contract_imports` | Critical | Unchanged (auth/RLS out of scope) |
| Signed preview URLs by storage path | High | Unchanged |
| XSS from extracted text | Low–Med | Review UI uses React text bindings (no `dangerouslySetInnerHTML` in import UI) |
| Logging | — | Stages/meta only; no API keys; avoid full PDF text (`extracted_text` forced null on persist) |
| Entity create from review | Med | Now requires `assertCan`; still user-initiated (not silent contract create) |

---

## Reliability findings

| Finding | Status after fix |
| --- | --- |
| Client 5 min timeout + cancel | Improved messaging |
| NDJSON fail-fast on error | Already present; kept |
| Storage failure before DB insert | Upload then insert; remove object if insert fails (existing) |
| AI failure | Marks `failed` |
| Abort / interrupt | Marks `failed` (routes) |
| Confirm idempotency | Blocks if `created_contract_id` set |
| Partial finalize after contract create | Import kept `confirmed` + error message (not `failed`) |
| Stale processing orphans | App improved; DB sweeper still proposal |

---

## Extraction coverage

| Field group | In schema |
| --- | --- |
| Contract number/date/type | Yes |
| Seller / buyer / consignee / notify | Yes |
| Products (description, scientific name, HS, pack, qty, net/gross, prices) | Yes |
| Currency, totals, Incoterms, payment terms | Yes |
| Delivery deadline / period | Yes (period added) |
| Ports, vessel, containers | Yes (container_numbers added) |
| Bank details | Yes (banking section added) |
| Signatures / seals | Yes |
| Referenced annexes | Yes (`legal.referenced_annexes`) |

Low confidence → null values (prompt + existing confidence fields). No inventing.

Matching: company/buyer/supplier/consignee/products with thresholds; exact auto-select only at high score; probable/multiple require confirmation. Contract create only via `confirmContractImport` after review (or draft save without create).

---

## Unresolved blockers

1. Remote `contract_imports` / Storage bucket may be missing until migrations applied (approval).  
2. Auth stub + open RLS (separate P0/auth work).  
3. No automated E2E against live OpenAI in this task.  
4. Review UI does not yet surface new banking/annex fields (data stored in `extraction_json`).  
5. Duplicate contract number detection is form/DB constraint dependent — not a dedicated pre-check beyond confirm validation.

---

## Manual test checklist

1. Contracts page loads; Import from PDF opens.  
2. Reject non-PDF and >50MB locally.  
3. Reject renamed non-PDF (magic header) with clear error.  
4. With AI key unset: 503 / config message; no spin forever.  
5. With AI key set: stages advance past Uploading → review workspace.  
6. Cancel mid-run → “cancelled”; import row not left `processing`.  
7. Wait for 5+ minute stall → timeout message; retry works.  
8. Review requires company/buyer/supplier; confirm creates one contract.  
9. Second confirm on same import blocked.  
10. Draft save does not create contract.  
11. Re-extract endpoint settles failures similarly.

---

## Rollback procedure

1. Revert the listed source files.  
2. Leave proposal migration file or delete only with approval (it is a no-op notice).  
3. Schema additions are additive at OpenAI validation time; stored JSON remains readable.

---

## Remote actions requiring approval

- Apply `contract_imports` / ensure migrations + `documents` bucket.  
- Any executable TTL sweeper migration.  
- Auth/RLS hardening.  
- Live OpenAI production model/env tuning.  
- Git commit / push.

---

## Validation (this task)

| Command | Result |
| --- | --- |
| `pnpm lint` | **FAIL** — 28 errors / 2 warnings (pre-existing; none in import files touched) |
| `pnpm build` | **PASS** |
| `pnpm exec tsc --noEmit` | **PASS** |
| `git diff --check` | **PASS** |
