# Phase 8 — Release qualification and production readiness

This records what was proven for release, how it was proven, and what is explicitly
accepted as incomplete. It is evidence of a completed gate, not a plan.

## What release qualification means here

SKY ERP is qualified as **one integrated ERP**, not as a set of modules that each
pass in isolation. A single fictional Deal carries an external purchase, an
intercompany transfer and an external sale through Contracts, an imported Contract,
generated documents, logistics, warehouse ownership, invoices, payments, expenses,
agent commissions and the canonical profitability engine. Every identity, company,
product and amount is invented and exists only inside the isolated replay.

## Reproducibility

A fresh environment is rebuilt from canonical migrations alone. The gate starts a
newly created, randomly named local Supabase, asserts the public schema is empty,
replays the migration chain in timestamp order and compares the result against the
application's extracted schema contract. No manual historical database state is
required, and no remote project is contacted.

Structural assertions on the rebuilt database: every table has a primary key, has
RLS enabled and carries at least one policy; all foreign keys are validated; the
economics hot paths are index-supported; the `documents` bucket is private with
authenticated-only object policies; and every canonical RPC exists with no
anonymous execute.

Table-level grants on `storage.objects` are a Supabase platform default. The
application's hardening is that every reconstructed object policy is
authenticated-only, and that is what the gate asserts.

## Golden integrated result

External Supplier → Company A → Company B → External Customer, one Deal, three
Contract legs, three Products.

| Measure | Value |
| --- | --- |
| External revenue | USD 150,000 |
| External COGS | USD 100,000 |
| External costs | USD 25,000 |
| **Consolidated profit** | **USD 25,000** |
| Company A contribution | USD 5,000 |
| Company B contribution | USD 20,000 |

The internal USD 120,000 leg is eliminated from consolidation and recorded as an
explicit elimination with its source ID, while remaining visible in both company
perspectives. Product contributions are USD 12,000 / 5,000 / 8,000.

Agent commission methods each calculate exactly: 95.04 MT × USD 30/MT =
USD 2,851.20; 100,000 kg × USD 0.05/kg = USD 5,000.00; 1.5% × USD 150,000 =
USD 2,250.00; fixed USD 3,000.00. The Deal's own accrual settles 5,000 accrued /
3,000 paid / 2,000 outstanding.

Warehouse ownership is proven separately from economics: Company A 100 − 40 = 60 MT,
Company B 20 MT of the same Product in the same warehouse, physical aggregate 80 MT,
with leakage denied in both directions.

## Read-path cost

The canonical read paths are asserted to be single round trips: consolidated
profitability, commission inputs and inventory lineage each cost one request. The
Deal workspace is asserted to issue the same number of queries for a Deal with three
Products, three Contracts and two Shipments as for an almost empty Deal, so the
loader cannot regress into N+1 as data grows.

## Reporting

Legacy Finance reports are verified read-only: a row census of invoices, payments and
expenses is unchanged across a full report load, and one company's reporting cannot
read another company's obligations. These reports remain superseded by canonical Deal
economics and are labelled as such in the UI.

## Environment

The Supabase client refuses to start against a missing URL or key, a malformed URL, a
local endpoint in a production build, or any secret/`service_role`-shaped key. Secrets
are never committed; `.env*` is untracked.

## Known limitations

Accepted for this release and deliberately not treated as blockers:

- **PDF generation remains PARTIAL.** DOCX is the qualified output format: generation,
  integrity, snapshots and version history are proven. Reliable PDF conversion is not
  available and release qualification does not depend on it.
- **Cross-module analytics is a placeholder.** `/reports` directs to Finance reports;
  the shared reporting layer is not built.
- **Legacy Finance reports sum nominal amounts across currencies** without FX
  conversion. They are read-only diagnostics, not the canonical financial position.
- **The economics report is a current-source report**, not an as-of historical ledger
  or a published report-version service.
- **Company results are Deal-scoped contributions**, not statutory company accounts or
  a tax computation.
- **Browser automation is not part of any gate.** UI verification is authenticated
  server-rendered route and server-action verification; no browser is launched.

## Gates

`db:check`, `db:replay`, `core:check`, `contracts:check`, `documents:check`,
`operations:check`, `economics:precheck`, `profitability:check` and `release:check`,
plus TypeScript, lint, production build and `git diff --check`.

`release:check` is the release gate: it runs the source-level suites and then the
full isolated replay, which includes reconstruction readiness and the integrated
Deal above.
