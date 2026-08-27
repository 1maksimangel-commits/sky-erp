# Memory — Known Issues

## Purpose

Tracked gaps and conflicts confirmed from repository inspection / project audit. Not a substitute for issue tracker.

Source includes `docs/audits/PROJECT_AUDIT_2026-08-05.md` (archived under `Archive/docs/audits/`).

## Critical

| ID | Issue |
| --- | --- |
| K-01 | App auth stub: `getCurrentRole()` always `"admin"` |
| K-02 | Broad public RLS (`using (true)`) on many tables + storage |
| K-03 | Finance RPC uses `payments.business_case_id` without migration ALTER adding it |
| K-04 | Contract import needs `contract_imports` applied remotely |
| K-05 | CRM notes HTML rendered unsanitized (XSS risk) |

## High

| ID | Issue |
| --- | --- |
| K-06 | Documents schema drift / hotfix chain |
| K-07 | CRM seafood columns may be missing remotely |
| K-08 | Weak upload validation (hub docs, CRM attachments) |
| K-09 | Signed URL by path without ownership check |
| K-10 | Incomplete CRUD on companies/counterparties/products/BCs/finance |
| K-11 | Dual package lockfiles (npm + pnpm) |
| K-12 | Lint failing (React hook rules) — mitigated 2026-08-06 (0 errors) |
| K-17b | Products INSERT RLS denial until approved migration apply |
| K-13 | Import rows can stick in `processing` |
| K-14 | SECURITY DEFINER RPCs broadly granted |

## Medium / process

| ID | Issue |
| --- | --- |
| K-15 | `/reports` and `/ai` stubs |
| K-16 | Multi-company enforcement incomplete |
| K-17 | Root/old docs named tables differently than migrations (resolved in `03_DATABASE…`) |
| K-18 | Much of repo historically untracked in git |

## Unresolved without remote/UI

- Exact live schema presence per environment  
- End-to-end PDF import against production OpenAI + applied DB  
- Real RLS behavior for anon vs authenticated  

Update this file when issues are fixed or newly confirmed.
