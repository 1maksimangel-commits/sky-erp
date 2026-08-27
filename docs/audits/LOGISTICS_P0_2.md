# Logistics P0.2 — Company-scoped authorization & validators

**Date:** 2026-08-05  
**Focus:** Production code only (plus this audit note).

## Objectives completed

1. Company-scoped logistics authorization (app-layer).  
2. Every shipment write requires `company` + `contract` + `business_case`.  
3. Validation for duplicate BL/container, status transitions, ETD/ETA, ports, vessel, voyage.  
4. Reusable validators extracted.  
5. Unit tests via Node built-in test runner (no new dependencies).

## Architecture

| Module | Role |
| --- | --- |
| `src/lib/platform/company-scope.ts` | Active company (`SKY_ACTIVE_COMPANY_ID`), access + writable company bind |
| `src/lib/logistics/auth.ts` | `assertLogisticsRead/Write`, bind write company |
| `src/lib/logistics/validators.ts` | Pure reusable validators |
| `src/lib/logistics/validation.ts` | Composes validators into `validateShipmentFormInput` |
| `src/lib/logistics/actions.ts` | Ownership resolve, company scope, company-scoped duplicates |
| `src/lib/logistics/db.ts` | Company-filtered lists/options; detail access check |
| `src/lib/logistics/validators.test.mjs` | Unit tests (Node built-in runner) |

## Authorization behavior

| Mode | Behavior |
| --- | --- |
| `SKY_ACTIVE_COMPANY_ID` unset | Pre-auth/admin stub: no company filter (role still checked via `assertCan`) |
| `SKY_ACTIVE_COMPANY_ID` set | Lists/options filtered; read/write/delete/timeline deny other companies; writes bind to active company |

Does **not** invent RLS. Open DB policies remain an auth/RLS blocker until membership/session is real.

## Validation coverage

| Rule | Where |
| --- | --- |
| company + contract + business_case required | `validateShipmentOwnership` + action resolve |
| ETD ≤ ETA (and ATD/ATA / actuals) | `validateShipmentSchedule` |
| vessel / voyage / POL / POD outside Planned | `validateShipmentRouting` |
| status transitions (Delivered terminal) | `validateShipmentStatusTransition` |
| duplicate container (active, company-scoped) | `assertNoDuplicateIdentifiers` |
| duplicate BL (company-scoped) | `assertNoDuplicateIdentifiers` |

## Files changed

- `src/lib/platform/company-scope.ts` (new)  
- `src/lib/logistics/auth.ts` (new)  
- `src/lib/logistics/validators.ts` (new)  
- `src/lib/logistics/validators.test.mjs` (new runtime suite)  
- `src/lib/logistics/validators.test.ts` (type-checked self-check helper)  
- `src/lib/logistics/validation.ts`  
- `src/lib/logistics/actions.ts`  
- `src/lib/logistics/db.ts`  
- `tsconfig.json` (exclude `*.test.ts` / `*.test.mjs`)  
- `docs/audits/LOGISTICS_P0_2.md`

## Tests

```bash
node --test src/lib/logistics/validators.test.mjs
```

Note: the `.mjs` suite mirrors pure helper contracts (no bundler/vitest install). Keep it aligned when changing `validators.ts` / `company-scope.ts`.

## Remaining risks

1. Active company is env-stubbed, not session/middleware.  
2. Open RLS still allows direct Supabase access outside app checks.  
3. Duplicate BL uniqueness at DB level still depends on unapplied `20260805100000`.  
4. Legacy rows without `company_id` may be hidden when scope is on until backfill.  
5. No payment/document generation changes in this batch.

## Migrations

None new in P0.2. Still required later (approval): `20260805100000_logistics_p0_ownership_columns.sql`.
