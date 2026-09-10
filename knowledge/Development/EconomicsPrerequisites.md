# Phase 7 pre-work — economic inputs

This work prepares reliable inputs. It does **not** implement Deal profit, gross
or net profit, margins, company/consolidated P&L, or profitability dashboards.
PDF remains PARTIAL and outside scope. No remote database changes, commit or push
are authorized by this task.

## Independent audit verification

Claude's supplied original verdict was **READY WITH REQUIRED FIXES**. Its
findings were hypotheses; the following classifications come from repository
evidence and the focused corrections, not the verdict alone.

| Finding | Classification | Evidence and resolution |
| --- | --- | --- |
| 1. Intercompany transaction model | FALSE POSITIVE for an absent canonical model | Phase 4 `contract_parties` independently identifies Seller/Buyer, and Phase 6 Invoice issuer/recipient and Payment payer/payee support a single shared record. Owner context controls writes; explicit internal parties receive intended reads. Preserve this model and test a three-leg chain rather than introduce duplicate economic events. |
| 2. FX snapshots | CONFIRMED | Original amounts/currencies survived, but `exchange_rates` alone was a mutable lookup. `financial_reporting_snapshots` now copies an explicitly selected rate, date, source, original values, source record and reporting amount. |
| 3. Inventory cost / COGS foundation | CONFIRMED | Quantity movements and owned lots existed without acquisition cost. Add immutable specific-lot acquisition basis and movement cost snapshots, preserving unknown historical costs as unknown. |
| 4. Cost allocations | CONFIRMED | Existing cost records carried direct origin FKs but lacked explicit split records. `cost_allocations` retains source, owner, amount/currency and destination FKs with explicit basis metadata. |
| 5. Legacy profitability | CONFIRMED | AI still calculated an estimated profit from legacy invoice types and unconverted totals; Contract business-case detail called `getBusinessCaseProfitResult`. These active entrypoints are isolated. Historical functions remain deprecated; legacy Finance reports are explicitly unverified. |
| 6. Business number uniqueness | CONFIRMED | Contract numbers, Counterparty codes, Product codes and both Deal-number aliases had global uniqueness. Forward constraints now scope those identifiers to the owner company. Company codes/UUIDs remain global; existing company-scoped SKU and Invoice rules remain. Application duplicate checks use the same company context. |
| 7. Warehouse ownership | FALSE POSITIVE for missing isolation | Phase 6 partitions inventory by Company/location/Product, uses owned lots and movements, and grants shared physical warehouse access explicitly. Reuse these guards and extend their tests to cost basis. |
| 8. Domain aliases | PARTIAL | Deal `number`/`case_number` and reviewed Contract `deal_id`/`business_case_id` already synchronize and reject conflicting writes. Keep compatibility, document the canonical names, and test conflicts. Company `business_role` is descriptive legacy metadata, not a legal/economic direction. |
| 9. Decimal safety | CONFIRMED | Some financial input arithmetic still used JavaScript Number. Canonical prerequisite calculations use PostgreSQL numeric and decimal text at the reporting API boundary; focused decimal tests cover exact settlement and commission examples. Display formatting and explicitly legacy calculations are not canonical accounting inputs. |
| 10. Legacy/dead code | PARTIAL | Old Contract PDF/DOCX modules have no identified active imports; AI director/runtime have internal references. This does not establish a harmful live path or safe removal. Preserve them; isolate the confirmed profitability entrypoints only. |
| 11. Test quality | PARTIAL | Existing gates run fresh migration replay, actual authenticated PostgREST/server actions, SQL constraints/RLS and SSR routes. They are more than static PASS labels, but did not cover immutable FX, cost basis, explicit cost splits or scoped identifier collisions. Add focused prerequisite tests to the same replay. |
| 12. Security | FALSE POSITIVE for an established baseline flaw | No confirmed baseline leak justified weakening Phase 2. New tables use authenticated company permission policies and immutable-history guards; existing Storage, explicit party sharing and browser public-key restrictions remain. Security gate results and independent review must still be verified for this change. |

## Canonical economic inputs

### Intercompany events

The same Contract, Invoice or Payment can be visible from both internal legal
parties. `company_id` remains the owner/workspace context; it is not an assumed
Seller, Buyer, payer or payee. Preserve the source record ID and explicit internal
party IDs when selecting future company-level inputs.

The fictional prerequisite chain uses external purchase USD 100,000, A → B
USD 120,000 and external sale USD 150,000, plus freight 10,000, warehouse 5,000,
commission 5,000 and other expense 3,000. Tests must distinguish internal versus
external legs and explicit allocations. They must not calculate consolidated
profit. A future consolidation process can identify the internal 120,000 leg
without deleting it from company-level history.

### FX capture

`financial_reporting_snapshots` references exactly one Invoice, Payment, Expense,
Commission or Bank Transaction. It copies original amount/currency, source JSON,
reporting currency/date, FX rate/date/source and reporting amount. Conversion
requires an explicit matching original-to-reporting rate record; no automatic
latest-rate selection, inversion or currency guessing occurs. Same-currency
capture uses rate 1. Monetary conversion is PostgreSQL numeric rounded to two
decimal places under this minimal reporting convention.

The original rate record reference is retained, but historical inputs read the
copied rate, not its current contents. `economics_reporting_input` exposes decimal
values as text. Each company/source/reporting-currency combination has one
immutable capture. Only posted/issued sources are eligible. Source economic
values are protected once captured; operational status transitions remain
distinct from the captured historical status.

### Specific identification of inventory cost

The chosen method is **specific identification by owned lot**, not FIFO, moving
average or purchase-invoice-as-COGS. A lot belongs to an inventory row identified
by Company, warehouse and Product. Different acquisition prices or currencies
require separate lots. `acquisition_unit_cost` applies to the inventory's retained
unit; callers must not confuse kilograms with metric tonnes.

A costed receipt initializes the lot basis. Each movement snapshots unit cost and
currency; `cost_amount` is exact signed quantity × unit cost. Releases carry the
lot's basis. Transfers pair the receiving movement with an explicit, unique
source release, preserving company, Product, lot, unit, quantity and basis.
Costed receipts cannot dilute a costed lot with unknown or different cost.

`warehouse_cost_input` returns historical movement quantities/costs and separately
labelled current lot remainder values as decimal text. It preserves values beyond
JavaScript Number precision. Transfers into a same-numbered unknown-cost or
differently costed destination lot are rejected. The existing transfer API does
not rename destination lots; use a compatible destination or resolve the lot
identity explicitly in a later authorized workflow. Never drop known cost to
force a physical merge.

Existing lots without acquisition evidence remain unknown. They cannot be
retrospectively assigned a guessed cost. A new costed lot is required for a new
known acquisition. This work does not capitalize freight into inventory, identify
a sale recognition event or calculate COGS/profit totals.

### Explicit cost allocation

`cost_allocations` references exactly one posted Expense or Commission, keeps its
economic owner and original currency, and records explicit amounts with
Deal/Contract/Shipment/Product/Contract-line/Deal-line FKs where applicable.
Existing direct origin FKs cannot be silently redirected. General company costs
may retain company-only context.

Supported basis labels are direct, quantity, net weight, gross weight, value,
percentage and manual. Non-manual quantitative bases require an explicit basis
value. Percentage amount is checked against the source amount. Other bases are
reviewed explicit inputs, not an automatic distribution engine. Serialized source
locking prevents concurrent over-allocation; total allocations cannot exceed the
original cost. Partial allocations remain explicit and must be recognized as
incomplete by future reporting. No algorithm guesses the remainder.

Snapshots and allocations are immutable. Their source monetary values are locked
after use. Reversal/correction workflows and reporting eligibility for later
cancelled sources must be designed explicitly in the subsequent phase; the
pre-work does not silently rewrite historical inputs or introduce P&L behavior.

Operational monetary inputs use two decimal places; commission rates, FX rates
and basis quantities use twelve decimal places. Standalone operational actions,
FX entry and new prerequisite actions accept exact decimal strings. Legacy
invoice-payment and bank-opening forms still accept bounded numbers only and
reject unsafe values. Reporting and cost readers return decimal text. FX entry
preserves text from the UI through validation and PostgreSQL persistence.

## Readiness limitations

- Unknown historical lot costs and uncaptured FX remain incomplete, never zero.
- Unallocated or partially allocated costs remain incomplete, never guessed.
- Internal transfers remain legitimate company events; elimination is future work.
- Invoice obligations, payment settlement and generated documents are distinct
  records. Future reporting must choose recognition rules and deduplicate source
  IDs rather than sum all three concepts.
- Legacy planning fields/calculators and the marked legacy Finance reports are
  not inputs to the future canonical profitability engine.
- SSR checks exercise authenticated page rendering and actual server actions;
  they are not browser automation or manual Word/Pages verification.

## Verification and independent review

Required gate: `pnpm economics:precheck`, alongside all Phase 1–6 commands:
`pnpm db:check`, `pnpm db:replay`, `pnpm core:check`, `pnpm contracts:check`,
`pnpm documents:check`, `pnpm operations:check`, `pnpm exec tsc --noEmit`,
`pnpm lint`, `pnpm build`, and `git diff --check`.

All named regression commands passed after the first review corrections. Each
database gate reconstructed its own isolated database and stopped its owned
Supabase stack and Next test server. Final prerequisite evidence is retained at
`.db-replay/sky-erp-replay-34b2d3b5f0d14f2e9487/result.json` (PASS for schema,
Auth/RLS, core, contracts, documents, operations and economics prerequisites).
Static catalog comparison passed for 59 migrations, 45 application tables,
270 selects, 1,134 columns, 33 writes and 21 RPCs. Historical migration checksums
remain intact. Lint, production build, browser bundle security and diff checks
passed. A subsequent read-only Claude review returned READY (zero Critical, High
or Medium; seven Low). Independently confirmed FX-entry and Counterparty-code
edges were then corrected. All named gates passed again; closing prerequisite
evidence is `.db-replay/sky-erp-replay-4460033c55af4139a7a4/result.json` and the
last operations replay is `.db-replay/sky-erp-replay-a7c3a34cc4664960b1d9/result.json`.
The closing independent read-only review verified both corrections and returned
READY, with zero Critical, High or Medium issues. All 33 changed-file hashes were
identical before/after review. Nonblocking Low observations and verbatim reports
are preserved in EconomicsClaudeReview.md. TypeScript passed after final replay.

Final gate evidence (each directory contains result.json with PASS):

| Command | Isolated replay directory under .db-replay/ |
| --- | --- |
| db:replay | sky-erp-replay-1fc2ad0d43084bb6a53d |
| core:check | sky-erp-replay-4f9ed044b0e146ec956f |
| contracts:check | sky-erp-replay-171fb5295c7b4fdf967a |
| documents:check | sky-erp-replay-cdfb547b1f624797ac30 |
| operations:check | sky-erp-replay-a7c3a34cc4664960b1d9 |
| economics:precheck | sky-erp-replay-4460033c55af4139a7a4 |

db:check, TypeScript, lint, build, auth:bundle (4/4, no skip), and git diff --check
also passed. No remote Supabase changes or remote migrations; no commits or pushes.
Phase 7 profitability has not started. PDF remains PARTIAL and out of scope.

The first actual Claude review and independent dispositions are captured in
[EconomicsClaudeReview.md](./EconomicsClaudeReview.md). Its first verdict was
CONCERNS with zero Critical and zero High findings; confirmed prerequisite gaps
and relevant test gaps were corrected before the final replay sequence.

## Change inventory

- `knowledge/DOCUMENTATION_INDEX.md`
- `package.json`
- `scripts/database/replay.mjs`
- `src/app/(erp)/contracts/[id]/business-case/page.tsx`
- `src/components/contracts/ContractBusinessCaseTab.tsx`
- `src/lib/contracts/actions.ts`
- `src/lib/contracts/import/actions.ts`
- `src/lib/counterparties/actions.ts`
- `src/lib/finance/actions.ts`
- `src/lib/finance/db.ts`
- `src/lib/finance/operational-actions.ts`
- `src/lib/finance/types.ts`
- `src/lib/finance/validation.ts`
- `src/components/finance/ExchangeRatesView.tsx`
- `src/lib/platform/ai.ts`
- `supabase/history-lock.json`
- `supabase/replay/auth-rls.sql`
- `knowledge/Development/EconomicsClaudeReview.md`
- `knowledge/Development/EconomicsPrerequisites.md`
- `scripts/database/allocation-integrity-http.mjs`
- `scripts/database/economics-http.mjs`
- `scripts/database/economics-identity-http.mjs`
- `scripts/database/economics-isolation.test.mjs`
- `scripts/database/finance-decimal.test.mjs`
- `scripts/database/inventory-cost-http.mjs`
- `scripts/database/operational-decimal-http.mjs`
- `src/lib/finance/decimal.ts`
- `src/lib/finance/economic-input-actions.ts`
- `src/lib/warehouse/cost-actions.ts`
- `supabase/migrations/20260910120000_economic_reporting_inputs.sql`
- `supabase/migrations/20260910130000_inventory_cost_basis.sql`
- `supabase/migrations/20260910140000_economic_identifiers.sql`
- `supabase/migrations/20260910150000_allocation_target_integrity.sql`
