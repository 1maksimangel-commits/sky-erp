# Phase 6 — Operational transaction layer

Scope: local operational stabilization only. Canonical Deal remains
`business_cases`; Contract legal parties remain Phase 4 `contract_parties`.
No profitability, remote database changes, or PDF conversion is part of this work.

## Models and traceability

- `shipments` has many `shipment_lines`, independently of the number of
  Contract lines or shipments. The owner must own the Contract or be its explicit
  internal Seller/Buyer. Its Deal must match the Contract. Shipment lines retain
  legal descriptions and optional canonical Product / Contract line references.
  Delivered records and quantities cannot be rewritten.
- `stock_movements` is the inventory write path. `inventory` and
  `inventory_lots` are locked projections, partitioned by Company, location and
  Product. Existing quantities become explicit opening quantities; old movements
  are retained rather than reposted. Unit and Product labels are snapshotted.
  Shared physical locations require explicit Admin assignment through
  `warehouse_company_access`; this does not grant access to another owner's stock
  or Product master. Corrections use movements, not destructive history edits.
- `invoices` records obligations; `generated_documents` records files. The optional
  generated-document FK is an explicit link. Generation never creates or settles
  an obligation. Invoice issuer/recipient and payment payer/payee independently
  reference Company or Counterparty. Internal transactions have one canonical
  record visible to their explicit internal parties, with owner-controlled writes.
- `payment_allocations` allocates original money to invoices with matching parties,
  owner and currency. Only Paid payments settle obligations. Pending and Cancelled
  payments do not. Allocations cannot exceed payment or obligation amounts.
- Existing `expenses` retain Company and nullable business origin; existing
  `deal_commission_links` retains commissions with explicit fixed, per-MT, per-KG
  or percentage basis. PostgreSQL numeric computes monetary values. No FX rate
  replaces the original amount or currency.

## Read paths

`src/lib/operations/db.ts` loads records by canonical Deal or Contract FK through
the authenticated session. The Deal Operations tab and Contract overview render
these records without calculating profit or summing different currencies.

Contract finance includes direct Contract payments and payments allocated to its
invoices. It does not include unrelated payments merely sharing a Deal. Contract
document lists likewise require their own Contract link; Deal-only documents stay
on the Deal. Operational resolution never guesses a Deal from Contract-number text.

CRM stays a relationship/history module. Its canonical Counterparty FK resolves
Deal participants and explicit Contract parties, preserving existing notes,
contacts, attachments and communications.

## Reconstruction and verification

New migrations follow all Phase 1–5 migrations. Historical migration checksums are
unchanged. Table-specific ownership guards replace only the obsolete assumptions
for the affected operational tables; authenticated grants/RLS remain enabled.

`pnpm operations:check` executes the existing browser-key security checks and the
canonical fresh-stack replay. Replay now invokes `operations-http.mjs` after
Core, Contracts and Documents. It verifies actual authenticated server actions,
PostgREST CRUD, database constraints, permissions and SSR routes; it does not
mock database permissions or connect to remote Supabase.

Fictional fixtures cover two Companies, the three-leg Contract chain, multiple
shipments/products, stock 100−35=65 with another owner holding20, original money,
100000=30000+70000, 150000−100000=50000, split allocations and exact commissions
(95.04×30=2851.20 and 0.5%×100000=500). Gate results must be taken from the latest
completed replay artifact, not inferred from static checks.

HTTP route checks are server rendering checks. No browser, personal profile,
Microsoft Word, or Apple Pages is controlled. Interactive manual review should
cover selecting a Contract/company on shipment and invoice forms, posting an
owned receipt/release, allocation status changes, and following the Deal and
Contract operational links. Use fictional local data only.

## Verification result — 2026-09-10

Phase 6: PASS on a fresh isolated local database. Phase 1–5 gates remain PASS.
`pnpm db:check`, `pnpm db:replay`, `pnpm core:check`,
`pnpm contracts:check`, `pnpm documents:check`, `pnpm operations:check`,
`pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`, `pnpm auth:bundle`,
and `git diff --check` passed. The browser bundle check ran separately after
the production build; its default unit-test skip is not treated as a pass.

The final operations gate replayed 55 migrations and found no missing tables,
columns, required embedded relationships, RPC signatures or storage buckets.
Local evidence: `.db-replay/sky-erp-replay-3c53aa0a403a477e981d/result.json`.
This ignored artifact includes the migration checksums and individual schema,
Auth/RLS, HTTP, Core, Contract, Document and Operations PASS results.
All owned replay servers and database stacks stopped successfully.

PDF remains PARTIAL as accepted in Phase 5. Legacy profitability reports remain
explicitly unverified for Phase 7; no final Deal profitability was implemented.
No production data was inspected or migrated. No commit or push was made.

## Phase 6 change inventory

The following 62 files comprise the local Phase 6 change. No historical production
migration is edited. `history-lock.json` updates the reviewed application-source
checksum for the logistics loader, not the frozen migration checksums.

- `.github/workflows/database-replay.yml`
- `knowledge/DOCUMENTATION_INDEX.md`
- `knowledge/Modules/Finance.md`
- `knowledge/Modules/Logistics.md`
- `knowledge/Modules/Warehouse.md`
- `package.json`
- `scripts/database/core-ui.mjs`
- `scripts/database/replay.mjs`
- `src/app/(erp)/business-cases/[id]/page.tsx`
- `src/app/(erp)/contracts/[id]/page.tsx`
- `src/app/(erp)/crm/[id]/page.tsx`
- `src/app/(erp)/finance/invoices/[id]/page.tsx`
- `src/app/(erp)/finance/payments/[id]/page.tsx`
- `src/app/(erp)/logistics/[id]/page.tsx`
- `src/components/deals/DealWorkspace.tsx`
- `src/components/finance/BankAccountsView.tsx`
- `src/components/finance/FinanceDashboard.tsx`
- `src/components/finance/FinanceNav.tsx`
- `src/components/finance/InvoiceFormModal.tsx`
- `src/components/finance/PaymentFormModal.tsx`
- `src/components/finance/PaymentsView.tsx`
- `src/components/finance/ReportsView.tsx`
- `src/components/logistics/ShipmentFormModal.tsx`
- `src/components/warehouse/WarehouseOperationModal.tsx`
- `src/components/warehouse/WarehouseView.tsx`
- `src/lib/contracts/documents.ts`
- `src/lib/contracts/finance.ts`
- `src/lib/contracts/relations.ts`
- `src/lib/crm/db.ts`
- `src/lib/finance/actions.ts`
- `src/lib/finance/db.ts`
- `src/lib/finance/types.ts`
- `src/lib/finance/validation.ts`
- `src/lib/logistics/actions.ts`
- `src/lib/logistics/db.ts`
- `src/lib/warehouse/actions.ts`
- `src/lib/warehouse/db.ts`
- `src/lib/warehouse/types.ts`
- `src/lib/warehouse/validation.ts`
- `supabase/history-lock.json`
- `supabase/replay/auth-rls.sql`
- `supabase/replay/schema-smoke.sql`
- `knowledge/Development/OperationalTransactions.md`
- `scripts/database/finance-http.mjs`
- `scripts/database/operations-http.mjs`
- `scripts/database/shipments-http.mjs`
- `scripts/database/warehouse-http.mjs`
- `src/app/(erp)/finance/commissions/page.tsx`
- `src/app/(erp)/finance/expenses/page.tsx`
- `src/components/finance/InvoiceRecordActions.tsx`
- `src/components/finance/OperationalRecordsView.tsx`
- `src/components/finance/PaymentRecordActions.tsx`
- `src/components/finance/StandalonePaymentForm.tsx`
- `src/components/logistics/ShipmentLines.tsx`
- `src/components/operations/OperationalRecords.tsx`
- `src/lib/finance/operational-actions.ts`
- `src/lib/logistics/line-actions.ts`
- `src/lib/logistics/lines.ts`
- `src/lib/operations/db.ts`
- `supabase/migrations/20260910090000_operations_shipments.sql`
- `supabase/migrations/20260910100000_operations_warehouse.sql`
- `supabase/migrations/20260910110000_operations_finance.sql`
