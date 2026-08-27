# Technical Debt

Confirmed debt only (audits, migrations, knowledge memory). Do not invent items.

| ID | Debt | Evidence / notes |
| --- | --- | --- |
| TD-01 | Public `using (true)` RLS across modules | Multiple `supabase/migrations/*`; K-02 |
| TD-02 | Anonymous EXECUTE on SECURITY DEFINER RPCs | Warehouse/finance/platform grants; K-14 |
| TD-03 | Dual package lockfiles (npm + pnpm) | Root `package-lock.json` + `pnpm-lock.yaml`; K-11 |
| TD-04 | Incomplete authentication (admin stub, no middleware) | `permissions.ts`; K-01 |
| TD-05 | Missing / drifted schema links | `payments.business_case_id` gap; documents hotfix chain; K-03, K-06 |
| TD-06 | Open storage policies on `documents` bucket | Platform/documents migrations; audit |
| TD-07 | Duplicated / legacy documentation paths | Redirect stubs + `knowledge/Archive/`; legacy `public/management/` placeholders |
| TD-08 | Incomplete module coverage / CRUD | Masters and finance update flows; K-10 |
| TD-09 | Heavy client UI duplication | Form modals / delete dialogs copy-paste (architecture review) |
| TD-10 | Zod underused vs hand-rolled validators | Coding standards vs practice |
| TD-11 | Lint debt with green builds | K-12 |
| TD-12 | Assumed master tables not all created in migration folder | Database knowledge doc risk |
| TD-13 | Empty Archive/root snapshots for some root stubs | Documentation consolidation audit |

## Pay-down guidance (Planned)

1. Auth + RLS before expanding portals  
2. Apply additive schema fixes with approval  
3. pnpm standardization after approval  
4. Lint remediation as its own batch  
5. Keep documentation single-sourced under `knowledge/` + `management/`  
