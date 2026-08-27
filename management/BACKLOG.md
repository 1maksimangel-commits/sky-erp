# Backlog

Structured backlog from confirmed audits, known issues, and roadmap. Items marked **Planned** are not implemented. Items marked **In repo** exist as code/migrations but may need remote apply or verification.

## Security

| Item | Status |
| --- | --- |
| Replace open `using (true)` RLS with authenticated policies | Planned — blocked on auth |
| Revoke unnecessary `anon` EXECUTE on DEFINER RPCs | Planned — blocked on auth |
| Tighten `documents` storage policies | Planned |
| Signed URL ownership checks | Done in app (K-09) — company gate + registered owner; storage RLS still Planned |
| CRM attachment MIME allowlist | Done (K-08) — server/client DMS allowlist; delete path from DB |

## Authentication

| Item | Status |
| --- | --- |
| Wire session-based role (stop admin stub) | Planned (K-01) |
| Add Next.js middleware route gates | Planned |
| Align Settings role UI with real permissions | Planned |

## Database

| Item | Status |
| --- | --- |
| Apply `payments.business_case_id` migration | In repo — not applied |
| Apply CRM / contract import / documents migrations remotely | Ops — approval required (K-04, K-06, K-07) |
| Baseline clarity for assumed master tables | Confirmed risk in DB docs |
| Never edit applied migrations | Policy (ongoing) |

## Contracts

| Item | Status |
| --- | --- |
| Stabilize PDF import (schema + stuck `processing`) | Partial (K-04, K-13) |
| Preserve human confirm before AI writes | Policy / present pattern |
| Contract hub integrity over new satellites | Priority principle |

## CRM

| Item | Status |
| --- | --- |
| Plain-text notes (XSS) | In repo fix (P0 batch) |
| Seafood profile columns on remote | May be missing (K-07) |
| Stronger attachment validation | Planned |

## Finance

| Item | Status |
| --- | --- |
| `payments.business_case_id` column | Migration created — not applied (K-03) |
| Incomplete update/void flows | Confirmed incomplete CRUD (K-10) |
| Credit notes / claims | Planned (roadmap later) |

## Logistics

| Item | Status |
| --- | --- |
| Shipment CRUD present | Current |
| First-class containers / multi-container | Planned |

## Warehouse

| Item | Status |
| --- | --- |
| Stock RPCs present | Current |
| DEFINER grant hardening | Planned with auth (K-14) |

## Documents

| Item | Status |
| --- | --- |
| DMS hotfix chain / schema drift | Confirmed (K-06) |
| Malware scanning | Planned (later) |

## AI

| Item | Status |
| --- | --- |
| Contract PDF OpenAI import | Code present; ops gaps |
| In-app `/ai` assistant | Stub / rule-based (K-15) |
| Tool-calling assistant | Planned — needs approval |

## Reports

| Item | Status |
| --- | --- |
| Top-level `/reports` | Placeholder (K-15) |
| Finance reports under `/finance/reports` | Present (finance module) |
| Cross-module reporting platform | Planned |

## DevOps

| Item | Status |
| --- | --- |
| Dual lockfiles (npm + pnpm) | Confirmed (K-11) |
| Lint failures with green build | Confirmed (K-12) |
| CI for lint + build | Planned |
| pnpm-only standardization | Planned — approval to remove npm lockfile |

## Documentation

| Item | Status |
| --- | --- |
| Canonical `knowledge/` tree | Present |
| AI Engineering Department (`management/`) | This structure |
| Legacy `public/management/` placeholders | Superseded for workflow; do not delete without approval |
| Avoid inventing schema in docs | Policy |

## Sources

- `knowledge/Memory/KNOWN_ISSUES.md`  
- `knowledge/Roadmap/Current.md` / `Future.md`  
- `docs/audits/P0_SECURITY_BATCH_01_2026-08-05.md`  
- Archived project audit under `knowledge/Archive/docs/audits/`  
