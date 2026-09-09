# Phase 3 — Core domain stabilization

Scope: Companies, Counterparties, Products, Business Cases/Deals and Deal product lines. This document supersedes older core-schema compatibility advice, not the business workflows of later phases.

## Canonical model and audit findings

| Entity | Canonical source | Finding and stabilization |
| --- | --- | --- |
| Company | `companies`, `bank_accounts`, `company_memberships` | Existing legal/display names, registration/tax/address, signers and bank records are preserved. Previously separate Company and bank saves could partially succeed. `save_company_core` saves both atomically with invoker security. Bank selection is deterministic by creation time and ID. |
| Counterparty | `counterparties.company_id` | Workspace ownership is distinct from optional `source_company_id`, which identifies an internal Company represented as a counterparty. Buyer/Supplier/Agent taxonomy is preserved and includes Consignee/Other. Update and archive/restore replace the UI's destructive master deletion. |
| Product | `products.company_id` | `scientific_name` already existed in the canonical reconstruction. The old partial loader and create-only UI were the problem. Full catalog fields now round-trip through one loader and create/edit actions, including unit and size/grade. SKU uniqueness is enforced within each owning Company. |
| Deal | `business_cases` | There is no second `deals` table. The existing `/business-cases` routes and legacy read shape are adapters over `lib/deals/db.ts`. Core header edits preserve legacy contract fields and later-phase commercial terms. `case_number`/`number` compatibility aliases synchronize when changed. |
| Deal line | `deal_products.business_case_id` | Existing multiple-line table and Product FK are preserved. Lines support create/read/update/removal, description, grade, quantity/unit, weights, separate existing purchase/sales prices and currencies, and notes. Amounts are quantity × price rounded to cents with decimal arithmetic. Currencies are never combined here. |

The primary Supplier, Buyer and Consignee are explicit Counterparty foreign keys on the Deal. `deal_participants` remains the existing additional-role association; it is not another Deal model. Company, Product and party ownership continue to use the Phase 2 database relationship guards. Products are company-owned, not a globally shared catalog.

Core data loaders no longer retry with obsolete column projections. Schema errors must be reported, not silently converted into reduced data or a false not-found page. Detail pages distinguish a genuinely inaccessible/missing record from a schema/loading error. Lists and existing modals remain the UI; no visual redesign or parallel API was added.

## Lifecycle and compatibility

- Company, Counterparty and Product use the existing `is_active` field. Editing status archives/restores them while preserving referenced history.
- Deals use `archived_at`, preserving the commercial status and child rows. Restore before adding/editing lines or commercial terms.
- Unlinked draft lines can be removed. The action rejects lines linked to existing Contract product records; referenced Products retain their database RESTRICT behavior.
- Creating Deals requires an active internal Company and active same-company parties. Catalog lines require an active same-company Product. Existing archived records remain readable for history.
- No new Supplier/Customer master tables, Deal table, invoice model or profitability engine is introduced. Existing Contract Import, documents, template/DOCX engines and later modules are preserved. Their read-side compatibility is not declared functionally stabilized by this phase.
- Existing Product import paths retain their parser, use the same field projection/validation and company scoping, and insert a batch atomically rather than doing per-row database lookups.

## Migration

`supabase/migrations/20260909090000_core_domain_integrity.sql` is additive to the locked historical chain. It adds archive/notes fields, scoped case-insensitive SKU uniqueness, the matching invoker-security batch SKU lookup, currency FKs (and the already-offered GBP dictionary entry), write-time name/value checks, timestamp and number-alias triggers, and the Company/bank RPC.

The Company RPC is SECURITY INVOKER; no RLS policy, historical migration, production role, browser key model or membership model is replaced. New trigger helpers are not callable by anonymous clients. Existing grants and policies are tested unchanged by Phase 2.

CHECK constraints are NOT VALID to preserve legacy rows, while enforcing future writes. A database containing duplicate nonblank company SKUs or invalid currency references must be reviewed before this migration is applied there; the migration deliberately fails instead of deleting or silently rewriting business data. No remote deployment is authorized by these instructions.

## Regression commands and evidence

Run from the repository root with the pinned Supabase CLI and Docker available:

```sh
pnpm db:check
pnpm db:replay
pnpm core:check
pnpm auth:test
pnpm exec tsc --noEmit
pnpm lint
pnpm build
pnpm auth:bundle
git diff --check
```

`core:check` runs pure validation/calculation/security tests followed by the canonical fresh replay. Replay always verifies the historical hashes, complete reconstructed catalog, Phase 1 schema smoke test, Phase 2 SQL and Auth HTTP tests, and the core tests. Failure prevents a PASS artifact.

The core action/loader test executes current TypeScript against real authenticated local Supabase clients. Only Next request-client injection and cache invalidation are test adapters; authorization, membership lookups, RPCs, RLS, validation, audit writes, joins and CRUD run against the actual reconstructed database. Document upload is explicitly outside the fixture and throws if core CRUD unexpectedly invokes it.

Fictional fixtures include Company A/B, global Admin, A/B members, three Counterparties, Pacific Cod/Pollock/Halibut, one Deal and three product lines per Company. Tests cover updates, atomic rollback, scoped lists, scientific-name reads, archive/restore, deletion integrity, number aliases, price calculations, cross-company references/writes and anonymous denial.

HTTP UI checks start an owned loopback-only Next server on port 55323, pointed only at the isolated replay Supabase API on 55321. They exercise authenticated list/detail/create SSR routes and foreign detail/anonymous denial. No browser, personal browser profile, real credentials or AI request is used. The generated Next output is `.next-core-replay`; the normal development output is separate. Both the test server and fresh Supabase stack are stopped after the run. Replay evidence is retained under `.db-replay/<random-project>/`.

HTTP SSR and action/loader tests do not assert browser click, focus or hydration behavior. Optional manual UI verification after a successful gate: sign into the isolated fictional workspace; create and edit each core record, change the Deal's parties, add/edit/remove a draft line, and archive/restore a master and Deal. No remote database is needed.

Phase 4 remains unstarted. Do not commit, push or apply these migrations remotely without the user's separate approval.

## Phase 3 file manifest

43 files in the reviewable change set:

- `.gitignore`
- `eslint.config.mjs`
- `knowledge/DOCUMENTATION_INDEX.md`
- `next.config.ts`
- `package.json`
- `scripts/database/replay.mjs`
- `src/app/(erp)/business-cases/[id]/page.tsx`
- `src/app/(erp)/companies/[id]/page.tsx`
- `src/app/(erp)/counterparties/[id]/page.tsx`
- `src/app/(erp)/products/[id]/page.tsx`
- `src/components/business-cases/BusinessCaseFormModal.tsx`
- `src/components/business-cases/BusinessCasesView.tsx`
- `src/components/counterparties/CounterpartiesView.tsx`
- `src/components/counterparties/CounterpartyFormModal.tsx`
- `src/components/deals/DealWorkspace.tsx`
- `src/components/products/ProductFormModal.tsx`
- `src/components/products/ProductsView.tsx`
- `src/lib/business-cases.ts`
- `src/lib/business-cases/actions.ts`
- `src/lib/business-cases/types.ts`
- `src/lib/companies.ts`
- `src/lib/companies/actions.ts`
- `src/lib/counterparties.ts`
- `src/lib/counterparties/actions.ts`
- `src/lib/counterparties/types.ts`
- `src/lib/deals/actions.ts`
- `src/lib/deals/db.ts`
- `src/lib/deals/types.ts`
- `src/lib/deals/validation.ts`
- `src/lib/products.ts`
- `src/lib/products/actions.ts`
- `src/lib/products/import.ts`
- `src/lib/products/types.ts`
- `src/lib/supabase/env.ts`
- `tsconfig.json`
- `knowledge/Development/CoreDomain.md`
- `scripts/database/core-http.mjs`
- `scripts/database/core-source.mjs`
- `scripts/database/core-ui.mjs`
- `scripts/database/core.test.mjs`
- `src/lib/core/ownership.ts`
- `src/lib/core/validation.ts`
- `supabase/migrations/20260909090000_core_domain_integrity.sql`
