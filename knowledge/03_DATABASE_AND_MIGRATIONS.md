# SKY ERP — Database and Migrations

## Purpose

Authoritative database, migration, and RLS rules.

## Current state

Merged from prior knowledge DB doc, root `DATABASE.md`, and `docs/DATABASE_GUIDELINES.md` (archived).

Phase 1 reconstruction strategy and gate:
[DatabaseReconstruction.md](./Development/DatabaseReconstruction.md). The complete
ordered `supabase/migrations` chain is canonical; ignored local bootstrap copies
are excluded. The 44 historical files are checksum protected.

## Confirmed facts

- Engine: **Supabase / PostgreSQL**  
- Schema changes: **only** via `supabase/migrations/*.sql`  
- App client: publishable key + cookies (`src/lib/supabase/server.ts`)  
- Storage: `documents` bucket (DMS, `imports/…`, CRM attachments)

### Migration series (repo)

Business cases → contract hub → logistics columns → warehouse → finance → platform → documents DMS×3 → contract PDF import → companies policy → CRM → CRM seafood → contract import ensure.

### Design conventions

| Topic | Rule |
| --- | --- |
| PK | UUID `gen_random_uuid()` |
| Timestamps | `timestamptz` `created_at` / `updated_at` |
| Actors | `created_by` / `updated_by` / `uploaded_by` as **uuid** → `auth.users` or null — never `'system'` string in uuid cols |
| Soft delete | Prefer for durable financial/contract entities when modeled |
| FK naming | `<entity>_id` |
| Indexes | FKs, filters, unique business keys |
| jsonb | Flexible payloads (extractions, metadata) only |
| Idempotency | Prefer `if not exists` / safe backfills |

### Naming conflict (resolved)

| Outdated name (root DATABASE.md) | Prefer (migrations/app) |
| --- | --- |
| `contract_items` | `contract_products` (hub) |
| `warehouse_batches` | `inventory_lots` |
| `users` | `user_profiles` (+ `auth.users`) |
| `containers` as standalone table | Shipment fields today; first-class containers **Planned** |

**Code + migrations win** over outdated lists.

## Constraints

| Rule |
| --- |
| Never edit applied migrations — add a new file |
| Never delete migration history |
| Never disable RLS |
| Never drop tables/columns without explicit approval |
| Remote apply / destructive SQL requires approval |
| Rollback: reverse-safe new migration or documented manual steps |

## Known risks / gaps

- Five previously assumed masters now have explicit prehistory prerequisites for clean reconstruction. Existing databases still need a separately reviewed adoption plan.
- Broad `to public using (true)` policies in many migrations.  
- Documents hotfix chain; `contract_imports` / CRM seafood columns may be missing remotely.  
- Finance RPC uses `payments.business_case_id`, supplied later in the full chain by `20260805050000_payments_business_case_id.sql`; testing only the finance migration is insufficient.
- SECURITY DEFINER RPCs granted broadly.

## Development rules

1. New schema → new timestamped migration.  
2. Summarize tables/columns/policies before asking to apply.  
3. Align `src/lib/**/types.ts` with real columns.  
4. Do not invent columns in docs.

## Planned

- Authenticated, company-scoped RLS.  
- Auth/RLS functional regression tests against the reconstructed schema.
