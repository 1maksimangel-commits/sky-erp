# Review: Full project stabilization (2026-08-06)

**Director:** AI Director (autonomous loop)  
**Gates honored:** no commit, no push, no remote migration apply, no `.env` changes, no production access.

## Status

**PARTIAL** — local app builds and lints clean; commercial spine is navigable; Products create remains blocked until approved remote INSERT policy apply.

## Business readiness

**~72%** for practical local daily use of existing modules (create/list/view spine), excluding auth/RLS production hardening and incomplete master edit/CRUD.

## Validation (final)

| Check | Result |
| --- | --- |
| `pnpm exec tsc --noEmit` | Pass |
| `pnpm lint` | Pass (0 errors, 2 warnings) |
| `pnpm build` | Pass |
| Focused tests (`products/errors`, `documents/signed-url-auth`, `logistics/validators`) | 19/19 pass |
| `git diff --check` | Pass |

## P0/P1 fixed this mission (local)

1. Shell PageActions infinite re-render loop (`ShellContext` + memo `MainContent`)
2. Products create action never rethrows (`args.map` secondary crash)
3. ESLint setState-in-effect class cleared via `src/lib/ui/open-state.ts`
4. Finance invoice/payment detail by primary key (no list truncation `notFound`)
5. Warehouse lot detail by primary key
6. Warehouse issue/transfer/adjust assert `warehouse.write`
7. Companies/counterparties create actions hardened (no throw)
8. CRM create stamps `company_id` when `SKY_ACTIVE_COMPANY_ID` set
9. Contract/invoice document uploads inherit `company_id` from parent row

## Migrations prepared (not applied)

| File | Purpose | Apply? |
| --- | --- | --- |
| `20260805110000_products_insert_policy.sql` | Dev INSERT for products | **Approval required** — development/staging only |
| `20260805050000_payments_business_case_id.sql` | payments.business_case_id | Approval required |
| `20260805100000_logistics_p0_ownership_columns.sql` | shipment ownership cols | Approval required |
| `20260805060000_p0_rls_anon_hardening_proposal.sql` | proposal | Do not apply as-is without auth |
| `20260805070000_auth_foundation_proposal.sql` | proposal | Approval + design |

## Security / RLS blockers (unchanged architecture)

- `getCurrentRole()` always `"admin"` (K-01)
- Broad public RLS / DEFINER RPC grants (K-02, K-14)
- Products INSERT needs remote policy; public INSERT must not be production design (K-17)

## Manual smoke sequence

1. Start `pnpm dev` with local env (no secrets in chat).
2. `/dashboard` — loads; cards tolerate empty data.
3. `/companies` → New → save → open detail.
4. `/counterparties` → create buyer + supplier.
5. `/products` → New → save (expect clear RLS error until INSERT migration applied; after apply, expect success).
6. `/business-cases` → create with company + parties/product.
7. `/contracts` → create linked to company/parties; open workspace tabs.
8. Contract → Logistics → create shipment.
9. Contract → Finance → invoice → payment against invoice.
10. `/business-cases/{id}` and `/finance/reports` → profit/outstanding visible.
11. `/documents` + contract Documents tab → upload/preview.
12. `/crm`, `/warehouse`, `/ai`, `/reports` — pages load; `/reports` is a stub pointer to finance reports.

## Highest-value next product task

Approve and apply **development-only** products INSERT policy (or auth-ready company-scoped policy once membership exists), then seed one end-to-end deal through Company → Profit and verify payment RPC + shipment create against the live project schema.
