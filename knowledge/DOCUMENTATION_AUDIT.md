# Documentation Audit

Consolidation performed as a documentation-only refactor. No application source, migrations, package files, environment variables, Supabase configuration, or OpenAI integration code were modified. No commit or push.

## Scope reviewed

| Location | What was reviewed |
| --- | --- |
| `knowledge/` | Prior numbered knowledge set (`01`–`18`), overlapping security/roadmap/UI/AI docs |
| `docs/` | Architecture, database guidelines, development workflow, project standards, UI guidelines, module template, audits |
| Repository root `*.md` | `00_PROJECT_VISION.md`, `BUSINESS_CONTEXT.md`, `DATABASE.md`, `DEVELOPMENT_RULES.md`, `README.md`, `AGENTS.md`, `CLAUDE.md` |

`AGENTS.md` remains the highest-priority agent policy. It was updated only to point Mandatory Project Knowledge at `DOCUMENTATION_INDEX.md` and `knowledge/Modules/`.

## Final structure

Matches the enterprise tree in `DOCUMENTATION_INDEX.md`: numbered foundation docs, `Modules/`, `Development/`, `Roadmap/`, `Memory/`, `Archive/`, plus `DOCUMENTATION_INDEX.md` and this audit.

## Documents merged

| Sources | Canonical result |
| --- | --- |
| Root vision stub + vision content | `00_PROJECT_VISION.md` |
| `docs/PROJECT_STANDARDS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, root `DEVELOPMENT_RULES.md` | `01_ENGINEERING_POLICY.md` + `Development/CodingStandards.md` |
| `docs/ARCHITECTURE.md` + architecture notes from knowledge | `02_SYSTEM_ARCHITECTURE.md` |
| Root `DATABASE.md`, `docs/DATABASE_GUIDELINES.md`, `knowledge/02_DATA_MODEL.md` | `03_DATABASE_AND_MIGRATIONS.md` |
| Root `BUSINESS_CONTEXT.md`, `01_BUSINESS_RULES.md`, `04_EXPORT_PROCESS.md`, `05_DOMAIN_TERMS.md` | `04_BUSINESS_CONTEXT.md` |
| `07_SECURITY.md` + agent-boundary material | `05_SECURITY_AND_AGENT_BOUNDARIES.md` |
| Per-module knowledge files (`07_CRM` … `16_AI_INTEGRATIONS`) | matching `Modules/*.md` |
| `03_AI_RULES.md` + `16_AI_INTEGRATIONS.md` | `Modules/AI.md` |
| `06_UI_*` + `docs/UI_GUIDELINES.md` | `Development/CodingStandards.md` |
| `10_TESTING.md` + `17_TESTING_AND_QUALITY.md` | `Development/Testing.md` |
| `08_ROADMAP.md` + `18_ROADMAP.md` | `Roadmap/Current.md` + `Roadmap/Future.md` |
| `08_COMPANIES_AND_COUNTERPARTIES.md` | `Modules/Companies.md` + `Modules/Counterparties.md` |
| Audit findings from `docs/audits/PROJECT_AUDIT_2026-08-05.md` | `Memory/KNOWN_ISSUES.md` (summary) |

## Documents archived

Full-text snapshots preserved (not deleted):

### `Archive/knowledge-legacy/`

`01_BUSINESS_RULES`, `02_DATA_MODEL`, `03_AI_RULES`, `04_EXPORT_PROCESS`, `05_DOMAIN_TERMS`, `06_UI_PATTERNS`, `06_UI_AND_DESIGN_SYSTEM`, `07_SECURITY`, `07_CRM`, `08_COMPANIES_AND_COUNTERPARTIES`, `08_ROADMAP`, `09_PRODUCTS`, `09_RELEASE_NOTES`, `10_TESTING`, `10_CONTRACTS_AND_PDF_IMPORT`, `11_LOGISTICS`, `12_WAREHOUSE`, `13_FINANCE`, `14_DOCUMENTS`, `15_REPORTS_AND_ANALYTICS`, `16_AI_INTEGRATIONS`, `17_TESTING_AND_QUALITY`, `18_ROADMAP`.

### `Archive/docs/`

`ARCHITECTURE`, `DATABASE_GUIDELINES`, `DEVELOPMENT_WORKFLOW`, `MODULE_TEMPLATE`, `PROJECT_STANDARDS`, `UI_GUIDELINES`, `audits/PROJECT_AUDIT_2026-08-05`.

### `Archive/root/`

`00_PROJECT_VISION`, `BUSINESS_CONTEXT`, `DATABASE`, `DEVELOPMENT_RULES`.

Former paths were replaced with **redirect stubs** that link to the canonical file and the archive snapshot.

## Conflicts resolved

| Conflict | Resolution |
| --- | --- |
| Root `DATABASE.md` table names (`contract_items`, `containers`, `warehouse_batches`, `users`) vs migrations/app (`contract_products`, shipment fields, `inventory_lots`, `user_profiles`) | Documented in `03_DATABASE_AND_MIGRATIONS.md`: **code + migrations win**; outdated names marked planned/legacy |
| Multiple architecture docs (`docs/ARCHITECTURE.md` vs knowledge architecture notes) | Single `02_SYSTEM_ARCHITECTURE.md` |
| Multiple security docs | Single `05_SECURITY_AND_AGENT_BOUNDARIES.md` |
| Multiple roadmap docs (`08_ROADMAP`, `18_ROADMAP`) | Split into `Roadmap/Current.md` (present) and `Roadmap/Future.md` (planned) |
| Multiple testing docs | Single `Development/Testing.md` |
| Multiple AI docs (rules vs integrations) | Single `Modules/AI.md` |
| Business rules vs business context vs glossary vs export process | Single `04_BUSINESS_CONTEXT.md` with export summary + full glossary tables; long narrative retained in Archive |
| UI patterns vs design system vs UI guidelines | Single `Development/CodingStandards.md` |
| Audit as standalone “current truth” vs living issues list | Living list in `Memory/KNOWN_ISSUES.md`; full audit text archived |

## Duplicate content removed

- Overlapping “how to develop modules” sections collapsed into engineering policy + coding standards.  
- Repeated RLS / migration safety rules kept once in `03` and security doc (cross-referenced, not copy-pasted at length).  
- Dual roadmaps collapsed into Current/Future.  
- Dual AI rule files collapsed into `Modules/AI.md`.  
- Root + `docs/` + early `knowledge/` copies of the same topics reduced to stubs + one canonical body each.

Information was **not deleted**: superseded full text lives under `Archive/`.

## Unresolved conflicts / open questions

| Item | Status |
| --- | --- |
| Whether first-class `containers` table will replace shipment-level container fields | **Planned** — see Roadmap/Future; do not invent schema |
| Baseline migrations for assumed masters (`companies`, `counterparties`, etc.) not all present in migration folder | Documented as risk in `03` and Known Issues; schema truth remains migrations + live DB |
| Remote migration apply status (`contract_imports`, CRM seafood columns) | Operational/environment — not a doc conflict; tracked in Known Issues |
| `AGENTS.md` length vs `01_ENGINEERING_POLICY.md` overlap | Intentional: AGENTS remains authoritative operating manual; knowledge policy summarizes and must not weaken AGENTS |
| Root `README.md` still contains create-next-app boilerplate + npm examples alongside pnpm policy in AGENTS | Left mostly intact; Documentation section added. Prefer AGENTS for tooling (`pnpm`) |
| Package manager dual lockfiles | Product/ops issue (K-11), not resolved by docs |

## Link updates

- Knowledge stubs → canonical + Archive paths  
- `docs/*` stubs → `knowledge/` canonical + Archive  
- Root stubs → `knowledge/` canonical + Archive  
- `AGENTS.md` Mandatory Project Knowledge → README, DOCUMENTATION_INDEX, `Modules/`  
- Root `README.md` → Documentation section pointing at knowledge  

Archive-internal links between historical files were left pointing at sibling archive filenames (historical fidelity).

## Recommendations

1. Treat `knowledge/DOCUMENTATION_INDEX.md` as the map; do not recreate parallel `docs/` bodies.  
2. When product behavior changes, update the single canonical module/foundation file in the same PR as code.  
3. Keep adding Known Issues IDs (`K-xx`) instead of new audit markdown trees.  
4. After remote migrations are applied, refresh `Roadmap/Current.md` and close related Known Issues.  
5. Optionally trim root `README.md` boilerplate in a later docs pass (still docs-only).  
6. Do not resurrect content from `Archive/` into new parallel docs — merge into the canonical topic file.  
7. Continue marking incomplete capabilities **Planned**; never invent columns or APIs in prose.

## Completion checklist

- [x] Canonical tree created  
- [x] Overlaps merged into one authoritative doc per topic  
- [x] Outdated full text moved to `knowledge/Archive/`  
- [x] Former paths reduced to redirect stubs  
- [x] Internal links updated for active docs  
- [x] Business knowledge preserved (incl. glossary + export process in `04`)  
- [x] Assumptions marked Planned where unfinished  
- [x] `DOCUMENTATION_INDEX.md` written  
- [x] `DOCUMENTATION_AUDIT.md` written  
- [x] No application/migration/package changes  
- [x] No commit / push  
