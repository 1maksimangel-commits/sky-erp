# Memory — Known Issues

## Purpose

Tracked gaps and conflicts confirmed from repository inspection / project audit. Not a substitute for issue tracker.

Source includes `docs/audits/PROJECT_AUDIT_2026-08-05.md` (archived under `Archive/docs/audits/`).

## Critical

| ID | Issue |
| --- | --- |
| K-01 | Resolved locally in Phase 2: verified Auth sessions and membership roles replace the Admin stub; existing-environment adoption pending approval |
| K-02 | Resolved in canonical replay by Phase 2 forward RLS migration; remote policies untouched |
| K-03 | Finance RPC uses `payments.business_case_id` without migration ALTER adding it |
| K-04 | Contract import needs `contract_imports` applied remotely |
| K-05 | CRM notes HTML rendered unsanitized (XSS risk) |

## High

| ID | Issue |
| --- | --- |
| K-06 | Documents schema drift / hotfix chain |
| K-07 | CRM seafood columns may be missing remotely |
| K-08 | Weak upload validation (hub docs, CRM attachments) |
| K-09 | Phase 2 verifies company-scoped metadata and private Storage signing, including cross-company/anon denial |
| K-10 | Incomplete CRUD on companies/counterparties/products/BCs/finance |
| K-11 | Dual package lockfiles (npm + pnpm) |
| K-12 | Lint failing (React hook rules) — mitigated 2026-08-06 (0 errors) |
| K-17b | Products INSERT RLS denial until approved migration apply |
| K-13 | Import rows can stick in `processing` |
| K-14 | Phase 2 switches business RPCs to SECURITY INVOKER and restricts identity helpers; verified locally |

## Medium / process

| ID | Issue |
| --- | --- |
| K-15 | `/reports` and `/ai` stubs |
| K-16 | Phase 2 verifies all private tables for A/B isolation; unresolved legacy ownership stays Admin-only until a reviewed assignment migration |
| K-17 | Root/old docs named tables differently than migrations (resolved in `03_DATABASE…`) |
| K-18 | Much of repo historically untracked in git |

## Unresolved without remote/UI

- Exact live schema presence per environment  
- End-to-end PDF import against production OpenAI + applied DB  
- Remote adoption of the locally verified Auth/RLS model

Update this file when issues are fixed or newly confirmed.
