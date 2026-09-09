# Phase 4 — Contracts and reviewed import

Verification on 2026-09-09: 51 canonical migrations replayed with no detected
missing tables, columns, relationships, RPCs or buckets. Phase 1/2/3 checks and
Contract fixtures passed. Latest full Contract replay evidence:
`.db-replay/sky-erp-replay-41bd61db0f6949a8b393/result.json`.
`db:check`, `db:replay`, `core:check`, `contracts:check`, TypeScript, lint,
production build, browser credential scan and `git diff --check` passed locally.
No pre-existing unrelated validation failure was observed.

## Canonical model

`contracts` remains the single legal Contract header. `business_cases` remains
the Deal; both existing FK aliases are synchronized for canonical Contracts.
One Deal can own many Contracts. No profitability calculation was added.

`contracts.company_id` is the owning workspace, **not a Seller or Buyer**.
`contract_parties` has one row per explicit role (seller, buyer, consignee, payer,
beneficiary, manufacturer), a Company FK **or** Counterparty FK, and a legal
snapshot. Seller and Buyer are independently required and must differ. The
existing Company and Counterparty masters remain separate; no Legal Entity
master or duplicate Contract/Product table was introduced.

Direction is computed for a selected internal Company: Buyer = purchase-side;
Seller = sale-side; neither = not a party. A single internal A → internal B
Contract has both perspectives. Canonical records reject persisted legacy
`business_role`/`deal_contract_role` classifications. The Deal Contract tab
shows explicit parties and isolates its historical classification control.

`contract_products` retains existing IDs and warehouse references. Product FK
is optional, while the agreed legal description is independent. Quantity, unit,
price, currency, weights, size, packing, origin, notes and optional agreed amount
are retained. Displayed calculated amount is quantity × price; the source's
agreed amount is retained separately, never silently substituted.

Draft legal details can be corrected. Active (signed), Closed (completed), and
Cancelled lock legal headers, parties and commercial line values at the database.
Closed/Cancelled cannot reopen. Archive uses the existing soft-delete RPC.
Canonical legal history cannot be hard-deleted. Operational warehouse counters
remain compatible; this phase does not change warehouse workflows.

## Migration and access

Forward migration: `20260909120000_contract_legal_parties.sql`.
Historical migrations, Phase 1 prerequisites and Phase 2/3 migrations are unchanged.
There is no bulk party backfill: legacy roles are ambiguous and must be reviewed.
Historical rows remain readable with “needs party review”; legacy data is retained.

Owner members need the existing `contracts.read/write` permissions. Explicit
Seller/Buyer internal-company members also read that Contract, its legal lines,
party snapshots and registered source. They do not gain write access or access
to unrelated Company, Counterparty, Product or Deal masters. Selecting a new
internal Company requires permission to read that Company; a global Admin can
assemble the full commercial chain. External parties must belong to the owning
workspace. A chain may use one owning Deal workspace with different internal
legal companies across its legs.

New private authorization helpers return booleans, with fixed search paths and
no anonymous EXECUTE. `save_contract` is SECURITY INVOKER. No service role,
session change, unrestricted anon grant, global RLS disable, or remote apply.

## Import

PDF retains the existing OpenAI Files + Responses parser. DOCX adds bounded
Word text extraction followed by the same structured Responses parser; it never
calls the Template Engine. DOCX ZIP64, encrypted/macro packages, malformed
archives, excessive expansion and XML entities are rejected. Image-only DOCX
and visual signature/seal/pagination assessment require the original/PDF.

Flow: validate → immutable source registration → Storage upload → extraction
and candidate matches → editable review → atomic Draft Contract creation.
Source metadata includes original filename, MIME, SHA-256, size, uploader/time,
path, import ID and confirmed Contract ID. Original bytes are not downloaded and
re-uploaded during confirmation. Registered sources cannot be overwritten or
deleted by application users. Failed uploads retain the registration and may
retry the exact same source without overwriting existing bytes.

Review uses one Contract payload for explicit parties, lines, terms and Deal.
Missing/ambiguous entities remain unselected. Matching uses normalized exact
legal names across typed internal/external candidates; no fuzzy auto-merge.
The user may explicitly create a missing Counterparty, link a Product, or retain
an unlinked legal description. Source confidence and corrections remain visible.
Review drafts do not create Contracts. Retrying extraction never creates a
Contract. Confirmation locks the import row and commits header, parties, lines,
review evidence, reviewer/time and source linkage in one database transaction.
Failures roll back Contract creation; a confirmed import cannot create another.

Duplicate protection uses a company-scoped source hash and the existing global
Contract-number uniqueness rule. Conflicts link/warn rather than silently rename.
The global number constraint is intentionally preserved: distinct legal documents
with the same number currently require operator resolution, not automatic import.

Confirmed extraction/review metadata and field-review rows are immutable.
Legacy unconfirmed imports may acquire a verified hash from their retained bytes
during explicit confirmation; no business-document repository files are used.

## Regression gate and verification limits

`pnpm contracts:check` runs Contract unit/security tests and the unchanged
canonical replay orchestrator, now extended with real Contract action/loader
fixtures. It accepts no remote target. It includes all Phase 1/2/3 checks.
CI runs the Contract unit tests plus the same integrated database replay.

The fictional fixture creates one Deal and External Supplier → Internal A →
Internal B → External Customer, multiple product lines, both company perspectives,
private/shared access, invalid-FK rollback, final snapshot locking, archive,
PDF/DOCX source retention, reviewed confirmation, duplicates and failed retries.
Auth, PostgREST, Storage, RPCs and server actions are real local integrations.
The AI response is explicitly mocked with fictional extracted data: no live
provider call or extraction-accuracy claim is made by this gate.

HTTP SSR checks cover `/contracts`, `/contracts?new=1`, Contract detail and
`/contracts/import/[id]`, alongside all core routes. `/contracts/new` redirects
to the existing create form. No browser automation or browser click test ran.
The isolated Next process and Supabase stack are stopped after each replay.

Manual final review in an approved local environment: import a fictional PDF,
inspect confidence/source, correct legal parties and lines, select a Deal,
confirm Draft, reopen original, activate, verify legal editing is locked, and
switch internal-company perspective on a shared Contract.

## Scope retained for future phases

Template/DOCX generation, supplements, invoices, profitability, and other module
features were not implemented. Existing generators and historical workflow code
remain preserved; adapting generated legal documents to canonical parties is
Phase 5. No remote Supabase changes, remote migrations, commit or push.

## Phase 4 changed-file inventory

- `.github/workflows/database-replay.yml`
- `knowledge/Modules/Contracts.md`
- `package.json`
- `scripts/database/core-source.mjs`
- `scripts/database/core-ui.mjs`
- `scripts/database/replay.mjs`
- `src/app/(erp)/contracts/[id]/layout.tsx`
- `src/app/(erp)/contracts/[id]/page.tsx`
- `src/app/api/contracts/import/route.ts`
- `src/components/contracts/ContractFormModal.tsx`
- `src/components/contracts/ContractOverviewEditor.tsx`
- `src/components/contracts/ContractWorkspaceShell.tsx`
- `src/components/contracts/ContractsView.tsx`
- `src/components/contracts/import/ContractImportReviewWorkspace.tsx`
- `src/components/contracts/import/ContractPdfImportWizard.tsx`
- `src/components/deals/DealWorkspace.tsx`
- `src/lib/ai/contracts/extract.ts`
- `src/lib/ai/contracts/match.ts`
- `src/lib/ai/contracts/prompt.ts`
- `src/lib/ai/contracts/schema.ts`
- `src/lib/contracts/actions.ts`
- `src/lib/contracts/db.ts`
- `src/lib/contracts/form-types.ts`
- `src/lib/contracts/import/actions.ts`
- `src/lib/contracts/import/review-validation.ts`
- `src/lib/contracts/import/service.ts`
- `src/lib/contracts/import/types.ts`
- `src/lib/contracts/relations.ts`
- `src/lib/contracts/validation.ts`
- `src/lib/deals/actions.ts`
- `src/lib/deals/db.ts`
- `src/lib/deals/types.ts`
- `supabase/replay/auth-rls.sql`
- `knowledge/Development/ContractsStabilization.md`
- `scripts/database/contracts-http.mjs`
- `scripts/database/contracts.test.mjs`
- `src/app/(erp)/contracts/import/[id]/page.tsx`
- `src/app/(erp)/contracts/new/page.tsx`
- `src/components/contracts/ContractLegalFields.tsx`
- `src/components/contracts/import/ContractImportPageClient.tsx`
- `src/lib/contracts/import/docx-text.ts`
- `src/lib/contracts/import/review-defaults.ts`
- `src/lib/contracts/parties.ts`
- `supabase/migrations/20260909120000_contract_legal_parties.sql`
