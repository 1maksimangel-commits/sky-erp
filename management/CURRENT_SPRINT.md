# Current Sprint

**Updated:** 2026-08-05  
**Source of truth for status:** repository audits + P0 batch report. Statuses are conservative.

## Theme

P0 security stabilization and prerequisites for authentication / company-scoped RLS.

## Active items

| Item | Status | Notes |
| --- | --- | --- |
| P0 security stabilization | **In progress** | Batch 01 delivered in-repo; remote apply still pending approval |
| CRM XSS mitigation (plain-text notes) | **In repo — not closed remotely** | Code fixed per `docs/audits/P0_SECURITY_BATCH_01_2026-08-05.md`; historical `body_html` may remain in DB |
| `payments.business_case_id` migration | **Created — not applied** | `supabase/migrations/20260805050000_payments_business_case_id.sql` |
| RLS / anon hardening | **Blocked** | Proposal-only migration; requires real auth before safe revoke |
| Authentication and role integration | **Design complete — not implemented** | See `AUTH_SYSTEM.md` / `ROLE_MODEL.md`; runtime still stubs `"admin"`; no middleware |
| Company-scoped RLS | **Design complete — blocked** | See `COMPANY_MODEL.md`; executable RLS still blocked on auth |
| Contract PDF import stabilization | **Partial** | Code paths exist; remote `contract_imports` / apply still an ops gap |
| CRM security (uploads / residual HTML) | **Partial** | XSS render fixed; MIME/ACL gaps remain (see Known Bugs) |
| Finance schema consistency | **Partial** | Column migration authored; not applied; other CRUD gaps remain |

## Explicitly not complete

- Real auth / middleware  
- Effective company-scoped RLS  
- Lint clean (K-12)  
- Dual lockfile cleanup  
- End-to-end PDF import against applied remote schema  

## Sprint rules

- Do not mark unfinished work completed.  
- Do not apply migrations without approval.  
- Follow `WORKFLOW.md` for medium+ changes.  
