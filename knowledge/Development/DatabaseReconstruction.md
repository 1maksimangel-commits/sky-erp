# Canonical database reconstruction — Phase 1

## Source of truth

`supabase/migrations/*.sql`, sorted by the unique 14-digit timestamp, is the
canonical **application schema**. Supabase CLI **2.115.0** with PostgreSQL **17**
provides the platform schemas (`auth`, `storage`, extensions, and database roles).
`supabase/replay/config.toml` pins the isolated local verification profile.
No production dump, pre-existing application database, env file, seed, or ignored
bootstrap directory is an input to reconstruction.

The gate uses the real Supabase platform, not substitute `auth`/`storage` tables.
Its schema owner connection is strictly for migration verification. Passing it
does not establish that anonymous or authenticated application access works.

## Recovered prerequisites and dependency order

| Migration | Reason and evidence |
| --- | --- |
| `20260804120000_foundational_prerequisites.sql` | Creates only `companies`, `counterparties`, `products`, `contracts`, `payments`: the five masters assumed, but never created, by the historical chain. Columns come from existing forms, queries, and consumers in the historical SQL. Catalog prices/weights/glaze are numeric; existing PDF Drafts retain nullable amount/currency. RLS is enabled, with no new grants or policies. |
| `20260804135000_business_case_contract_prerequisite.sql` | Adds `business_cases.contract_number` before the platform migration reads it. The later canonical Deal migration reasserts the same column. |
| `20260831045000_timeline_deal_prerequisite.sql` | Adds the legacy `timeline_events.business_case_id` FK after the full timeline table exists, before the next historical migration relaxes its nullability. |
| `20260908090000_reconstruction_schema_contract.sql` | Forward reconciliation for existing writes: fill missing Deal number aliases on insert, permit existing text templates with content instead of a file, accept existing supplement documents and DOTX uploads. No business-row rewrite or RLS change. |

```text
Supabase platform schemas and roles
  → recovered five masters
  → business_cases → contract_number prerequisite
  → contract hub: shipments, contract_products, invoices
  → logistics extensions → warehouse tables + atomic RPCs
  → finance tables + RPCs
  → platform: contract↔Deal FK, documents, activity, timeline, notifications
  → DMS extensions + versions → PDF import
  → CRM + seafood profile → import schema ensure → payment↔Deal FK
  → preserved proposals/indexes/policies → logistics ownership
  → canonical Deal columns + participants/products/commission links
  → nullable PDF Draft amounts → contract soft-delete + RPC
  → timeline relationship prerequisite → optional timeline Deal
  → commercial contract/product fields → company approval documents
  → document templates + template center
  → counterparty legal/bank fields + company link
  → document-type compatibility → template engine
  → generated documents → mappings → generation batches
  → contract↔Deal/product links → company business role
  → forward application/schema reconciliation
```

The 44 historical migrations are preserved byte-for-byte and SHA-256 checked by
`supabase/history-lock.json`. A late forward migration cannot repair a dependency
failure earlier in a fresh replay; the three recovered prerequisites are explicit
exceptions inserted at their dependency points. The checker rejects any other
unreviewed insertion into that frozen history. Future changes append new migrations;
never edit an applied file or refresh historical checksums to hide a change.

## Retired local bootstrap

`.codex-local-bootstrap`, `.codex-contract-import-apply`, and `.codex-local-*.sql`
are **not schema sources**. They remain untouched for preservation, but the replay
tool never reads them, copies them, or reads the linked root `supabase/.temp`.
In particular, do not reuse the old bootstrap's skeletal invoices, shipments,
expenses, or contract products, nor its broad local authorization patches.
Precreating those tables makes later `CREATE TABLE IF NOT EXISTS` statements skip
their full column/constraint definitions.

Existing local databases are not silently repaired or reset. Their data and env
configuration remain unchanged. A developer adopting the reconstructed schema must
use the canonical chain in a fresh environment, and separately approve any data
transfer or application environment switch. A retained replay workdir is evidence
for that run, not a second editable migration source.

## Verification commands

Run from the repository root with existing project dependencies, Docker available,
Supabase CLI 2.115.0, and ports 55320–55322 free:

```sh
pnpm db:test
pnpm db:check
pnpm db:replay
pnpm exec tsc --noEmit
pnpm lint
pnpm build
git diff --check
```

`db:replay` accepts **no arguments or connection strings**. It creates a new random
project under `.db-replay/`, strips inherited database/Supabase credentials from
child commands, disables CLI telemetry, and verifies an empty `public` schema before
copying the canonical migrations. It uses `migration up --local`, checks the complete
applied ledger, compares the real catalog to source expectations, then runs
rollback-only SQL tests with fictional data. It never resets a database.

The tool stops only its own test stack in `finally`, including after failures.
Diagnostic files and the CLI's local volume backup are retained; no files or existing
databases are deleted. If cleanup fails, it exits nonzero and prints the exact stop
command for that test stack. Each rerun is fresh; an old successful run cannot satisfy
a later run. No development server or watcher is started.

## What the gate checks

- Historical checksums and migration timestamp uniqueness/order.
- Actual PostgreSQL migration execution and an exact applied-migration ledger.
- Current literal tables/storage buckets; reads, filters, insert/update/upsert keys;
  nested PostgREST relationships including FK hints and ambiguity; named RPC inputs
  and required arguments; omitted mandatory insert columns.
- TypeScript compiler resolution of constants, helper query builders, and typed
  payloads. Dynamic Logistics/DMS select paths and the AI party filter are explicitly
  reviewed and whole-file checksum pinned. A changed pinned file requires a review
  of those paths before updating only its `reviewedSources` checksum.
- Rollback-only fixtures covering masters, both Deal creation number spellings,
  nullable imported Drafts, contract products, shipments, invoices, payment RPC,
  expenses, four warehouse RPCs, PDF import records, DMS versions, text templates,
  mappings, generated document versions, CRM, and platform/soft-delete RPCs.
- Negative checks: missing template source and orphan contract-product FK must fail.

`db:check` is an offline **source inventory**, not a database PASS. Unresolved
queries fail the gate. The checker does not prove every runtime value, business
calculation, upload, parser, rendering, auth policy, or user workflow. Wildcard reads
and loosely cast response objects still require workflow tests in later phases.
Schema regression unit tests deliberately remove catalog objects and alter RPC/FK
definitions to ensure failures are detected.

The CI workflow `Database reconstruction / reconstruction` runs on PRs and main.
It provisions no remote database and needs no Supabase/OpenAI secrets. It uses the
frozen pnpm lockfile. Require this check in branch protection during an approved
repository-settings change; adding the workflow locally does not configure that
remote protection. Evidence artifacts contain catalog metadata and results only.

## Existing production adoption is separate

Do **not** run `db push --include-all`, copy these prerequisites into the legacy
bootstrap, mark migrations applied blindly, or apply the whole history to a populated
database. First obtain an approved schema-only inventory and migration ledger,
compare it to a verified reconstruction, and prepare a reviewed forward adoption
plan with data/constraint checks. `CREATE TABLE IF NOT EXISTS` does not reconcile an
existing incomplete table. None of Phase 1 applies migrations remotely.

Auth/RLS functionality is Phase 2. Purchase/Sale profitability and new document
features are out of scope. Historical permission policies replay unchanged.

## Phase 1 verification record — 2026-09-08

Two separate fresh local stacks successfully replayed all **48** canonical
migrations. The final run checked **39 application tables**, **256 selects**,
**1,079 column uses**, **39 insert/upsert payloads**, and **9 RPC names** with zero
reported schema mismatches. Rollback-only schema smoke tests and confirmed stack
shutdown passed. Evidence is retained locally in
`.db-replay/sky-erp-replay-c13c9ac751504838a206/{catalog,result}.json`.

The five schema-checker unit tests, offline inventory, TypeScript, lint, production
build, and `git diff --check` passed. Historical migrations and application modules
were not modified. CI is configured in the repository but has not been run remotely;
no remote branch protection, Supabase schema, migration ledger, or business data
was changed. Auth/RLS functional verification remains Phase 2.
