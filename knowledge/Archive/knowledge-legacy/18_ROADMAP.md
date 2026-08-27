# SKY ERP — Roadmap

## Purpose

Separate what exists now from what is next. **Do not mark unfinished work as complete.**

Sources: repository modules, migrations, `knowledge/08_ROADMAP.md` (older numbering), and `docs/audits/PROJECT_AUDIT_2026-08-05.md`.

---

## Current

Present in the app/repo (maturity varies; some need remote migrations):

| Area | Notes |
| --- | --- |
| ERP shell | Sidebar, navigation, quick create, dark UI |
| Dashboard | Operations snapshot route |
| Companies / Counterparties / Products | Create + list + detail (edit CRUD incomplete) |
| Business Cases | Create + list + detail |
| Contracts hub | Tabs for documents/logistics/warehouse/finance/history |
| Contract PDF import code | API + OpenAI extract + review UI (needs DB tables applied) |
| Logistics | Shipment CRUD |
| Warehouse | Ops board + lot detail + stock actions/RPCs |
| Finance | Invoices/payments/bank/FX + `/finance/reports` |
| Documents DMS | Library + entity panels (schema drift historically) |
| CRM module code | Seafood profile UI + migrations in repo |
| Platform bits | Activity/timeline/notifications/permissions **foundation** |
| Governance docs | `/docs`, `/knowledge`, `AGENTS.md` |

---

## Next

High-priority follow-through (not done until verified):

| Item | Why |
| --- | --- |
| Apply pending migrations (CRM, contract import ensure, documents) | Unblocks CRM/import |
| Fix `payments.business_case_id` via **new** migration | Finance RPC correctness |
| Wire real auth + stop admin stub | Security |
| Replace open public RLS with authenticated/company policies | Security |
| Sanitize CRM rich-text notes | XSS |
| Clear ESLint failures | Quality gate |
| Standardize on pnpm lockfile | Tooling integrity |
| Complete critical master-data update/archive flows | Operability |

---

## Later

| Item |
| --- |
| First-class Containers entity & multi-container UX |
| Certificate pack checklists per market |
| QC / inspection records on lots |
| Claims & credit notes |
| Cross-module reporting workspace |
| Notification generators (expiry, delays, payments) |
| Stronger CRM ↔ contract activity graph |
| Document template generation (human-saved) |
| Tracking / banking integrations |
| Multi-company consolidation dashboards |
| Approval workflow engine |

---

## Not yet approved

Do **not** start without explicit user approval:

- Large refactors / module rewrites
- Auth system redesign details beyond “wire real roles”
- Disabling or broadly rewriting RLS without a reviewed plan
- Dependency major upgrades / new frameworks
- Remote production data changes or destructive SQL
- Browser automation suites
- Deleting legacy docs or orphaned components in bulk
- Replacing the PDF import pipeline wholesale

---

## Development rules

- When finishing a “Next” item, move it to **Current** only after build/lint (and migration apply if required) succeed.
- Keep this file honest: stubs (`/reports`, rule-based `/ai`) stay under Current-as-stub or Next, never “complete AI platform”.
