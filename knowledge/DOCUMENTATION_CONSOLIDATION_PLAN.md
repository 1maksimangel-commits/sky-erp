# Documentation Consolidation Plan

**Type:** Read-only analysis and recommendations  
**Date:** 2026-08-05  
**Scope:** Repository root `*.md`, `docs/`, `knowledge/`  
**Constraints honored for this review:** No deletes, moves, renames, overwrites of existing docs, no code/migration/package/env/DB changes, no commit/push. Only this plan file is created.

**Prior work note:** A consolidation pass already created the canonical `knowledge/` tree, redirect stubs, `Archive/` snapshots, `DOCUMENTATION_INDEX.md`, and `DOCUMENTATION_AUDIT.md`. This plan describes the **current** tree, remaining debt, and recommended next steps (approval-gated). It does not execute those steps.

---

# Current documentation tree

```text
/
  AGENTS.md                          FULL (1806 lines) — agent operating manual (highest priority)
  CLAUDE.md                          FULL — thin pointer to AGENTS.md
  README.md                          FULL — app bootstrap + docs pointer + contract AI env notes
  00_PROJECT_VISION.md               STUB → knowledge/00_PROJECT_VISION.md (+ empty Archive/root)
  BUSINESS_CONTEXT.md                STUB → knowledge/04_BUSINESS_CONTEXT.md (+ empty Archive/root)
  DATABASE.md                        STUB → knowledge/03_DATABASE_AND_MIGRATIONS.md (+ empty Archive/root)
  DEVELOPMENT_RULES.md               STUB → knowledge/01_ENGINEERING_POLICY.md + CodingStandards (+ empty Archive/root)

docs/
  ARCHITECTURE.md                    STUB → knowledge/02_SYSTEM_ARCHITECTURE.md
  DATABASE_GUIDELINES.md             STUB → knowledge/03_DATABASE_AND_MIGRATIONS.md
  DEVELOPMENT_WORKFLOW.md            STUB → knowledge/01_ENGINEERING_POLICY.md + CodingStandards
  PROJECT_STANDARDS.md               STUB → same
  UI_GUIDELINES.md                   STUB → knowledge/Development/CodingStandards.md
  MODULE_TEMPLATE.md                 STUB → Archive template + Modules/
  audits/PROJECT_AUDIT_2026-08-05.md STUB → Memory/KNOWN_ISSUES.md + Archive audit

knowledge/
  README.md                          FULL — knowledge entry
  DOCUMENTATION_INDEX.md             FULL — map of canonical vs stubs
  DOCUMENTATION_AUDIT.md             FULL — prior consolidation audit
  DOCUMENTATION_CONSOLIDATION_PLAN.md THIS FILE
  00_PROJECT_VISION.md               FULL — canonical vision
  01_ENGINEERING_POLICY.md           FULL — canonical engineering policy
  01_BUSINESS_RULES.md               STUB (number collision with 01_ENGINEERING_POLICY)
  02_SYSTEM_ARCHITECTURE.md          FULL — canonical architecture
  02_DATA_MODEL.md                   STUB (number collision with 02_SYSTEM_ARCHITECTURE)
  03_DATABASE_AND_MIGRATIONS.md      FULL — canonical DB rules
  03_AI_RULES.md                     STUB (number collision with 03_DATABASE…)
  04_BUSINESS_CONTEXT.md             FULL — canonical business / export / glossary
  04_EXPORT_PROCESS.md               STUB (number collision with 04_BUSINESS_CONTEXT)
  05_SECURITY_AND_AGENT_BOUNDARIES.md FULL — canonical security summary
  05_DOMAIN_TERMS.md                 STUB (number collision with 05_SECURITY…)
  06_UI_PATTERNS.md                  STUB
  06_UI_AND_DESIGN_SYSTEM.md         STUB
  07_CRM.md                          STUB
  07_SECURITY.md                     STUB
  08_COMPANIES_AND_COUNTERPARTIES.md STUB
  08_ROADMAP.md                      STUB
  09_PRODUCTS.md                     STUB
  09_RELEASE_NOTES.md                STUB
  10_CONTRACTS_AND_PDF_IMPORT.md     STUB
  10_TESTING.md                      STUB
  11_LOGISTICS.md … 18_ROADMAP.md    STUBs
  Modules/                           FULL — one file per listed module
  Development/                       FULL — API, CodingStandards, Testing, Performance
  Roadmap/                           FULL — Current.md, Future.md
  Memory/                            FULL — PROJECT_MEMORY, ARCHITECTURE_DECISIONS, KNOWN_ISSUES
  Archive/
    README.md
    knowledge-legacy/                FULL historical bodies (23 files)
    docs/                            FULL historical docs + audit
    root/                            EMPTY files (0 bytes each) — see Conflicts
```

**Counts (approx.):** ~100 markdown files under root/`docs/`/`knowledge/` (excluding `node_modules`). Of non-Archive active paths, most former duplicates are already **stubs**; substantive content lives in foundation files, `Modules/`, `Development/`, `Roadmap/`, `Memory/`, plus `AGENTS.md`.

---

# Canonical documents

One authoritative document per topic (recommended / currently intended):

| Topic | Canonical document | Authority notes |
| --- | --- | --- |
| Agent operating rules | `AGENTS.md` | Highest priority; never weakened by knowledge docs |
| Claude/Cursor short pointer | `CLAUDE.md` | Defers to AGENTS.md |
| Knowledge entry | `knowledge/README.md` | Reading order + authority stack |
| Doc map | `knowledge/DOCUMENTATION_INDEX.md` | Index of stubs/merges |
| Prior consolidation record | `knowledge/DOCUMENTATION_AUDIT.md` | Historical audit of last pass |
| This consolidation plan | `knowledge/DOCUMENTATION_CONSOLIDATION_PLAN.md` | Recommendations only |
| Vision | `knowledge/00_PROJECT_VISION.md` | |
| Engineering policy | `knowledge/01_ENGINEERING_POLICY.md` | Summarizes AGENTS; AGENTS wins on conflict |
| System architecture | `knowledge/02_SYSTEM_ARCHITECTURE.md` | |
| Database & migrations | `knowledge/03_DATABASE_AND_MIGRATIONS.md` | Code + migrations override prose |
| Business context / export / glossary | `knowledge/04_BUSINESS_CONTEXT.md` | |
| Security & agent boundaries (summary) | `knowledge/05_SECURITY_AND_AGENT_BOUNDARIES.md` | Must not contradict AGENTS |
| CRM | `knowledge/Modules/CRM.md` | |
| Companies | `knowledge/Modules/Companies.md` | |
| Counterparties | `knowledge/Modules/Counterparties.md` | |
| Products | `knowledge/Modules/Products.md` | |
| Contracts (+ PDF import) | `knowledge/Modules/Contracts.md` | |
| Warehouse | `knowledge/Modules/Warehouse.md` | |
| Logistics | `knowledge/Modules/Logistics.md` | |
| Finance | `knowledge/Modules/Finance.md` | |
| Documents / DMS | `knowledge/Modules/Documents.md` | |
| Reports | `knowledge/Modules/Reports.md` | |
| AI | `knowledge/Modules/AI.md` | |
| API / actions surface | `knowledge/Development/API.md` | |
| Coding + UI standards | `knowledge/Development/CodingStandards.md` | |
| Testing | `knowledge/Development/Testing.md` | |
| Performance | `knowledge/Development/Performance.md` | |
| Roadmap (present) | `knowledge/Roadmap/Current.md` | |
| Roadmap (planned) | `knowledge/Roadmap/Future.md` | |
| Project memory | `knowledge/Memory/PROJECT_MEMORY.md` | |
| Architecture decisions | `knowledge/Memory/ARCHITECTURE_DECISIONS.md` | |
| Known issues | `knowledge/Memory/KNOWN_ISSUES.md` | Living issues; audit archived |
| Historical snapshots | `knowledge/Archive/**` | Not day-to-day truth |

---

# Duplicate documents

## A. Active path duplicates (stub + canonical + archive)

These are **triplicates by path purpose** (stub at old location, canonical body, archive body). Stubs are intentional redirects but still create naming noise and dual-number collisions.

| Topic | Paths involved |
| --- | --- |
| Vision | Root stub `00_PROJECT_VISION.md` · `knowledge/00_PROJECT_VISION.md` · empty `Archive/root/00_PROJECT_VISION.md` |
| Business context | Root stub · `knowledge/04_BUSINESS_CONTEXT.md` · empty `Archive/root/BUSINESS_CONTEXT.md` · stubs `01_BUSINESS_RULES` / `04_EXPORT` / `05_DOMAIN_TERMS` · rich Archive legacy |
| Database | Root stub `DATABASE.md` · `03_DATABASE…` · empty Archive root · `docs/DATABASE_GUIDELINES` stub · Archive docs + `02_DATA_MODEL` legacy |
| Engineering / standards | Root `DEVELOPMENT_RULES` stub · `01_ENGINEERING_POLICY` · `Development/CodingStandards` · `docs/PROJECT_STANDARDS` / `DEVELOPMENT_WORKFLOW` stubs · Archive docs |
| Architecture | `docs/ARCHITECTURE` stub · `02_SYSTEM_ARCHITECTURE` · Archive `docs/ARCHITECTURE.md` (much larger) |
| Security | Stub `07_SECURITY` · `05_SECURITY…` · large sections inside `AGENTS.md` · Archive `07_SECURITY` |
| AI | Stubs `03_AI_RULES`, `16_AI_INTEGRATIONS` · `Modules/AI.md` · Archive both |
| UI | Stubs `06_*` · `docs/UI_GUIDELINES` stub · `Development/CodingStandards` · Archive UI docs |
| Roadmap | Stubs `08_ROADMAP`, `18_ROADMAP` · `Roadmap/Current` + `Future` · Archive both roadmaps + `09_RELEASE_NOTES` |
| Testing | Stubs `10_TESTING`, `17_TESTING…` · `Development/Testing` · Archive testing docs |
| Modules | Each `Modules/*.md` + numbered stub + Archive legacy counterpart |
| Audit / issues | Stub `docs/audits/…` · `Memory/KNOWN_ISSUES` · Archive full audit |

## B. Conceptual duplicates (overlapping rules, not identical files)

| Overlap | Where |
| --- | --- |
| Agent safety / RLS / secrets / OpenAI / git | `AGENTS.md` (full) vs `05_SECURITY…` vs `01_ENGINEERING_POLICY` vs module “Development rules” sections |
| Architecture layers / stack | `AGENTS.md` “Project Architecture” vs `02_SYSTEM_ARCHITECTURE.md` vs Archive architecture |
| Migration / DB safety | `AGENTS.md` Database Rules vs `03_DATABASE…` vs Archive DATABASE_GUIDELINES |
| Roadmap / maturity | `Roadmap/*` vs Archive roadmaps vs release notes vs Known Issues “stubs” list |
| Meta-docs about consolidation | `DOCUMENTATION_INDEX` + `DOCUMENTATION_AUDIT` + this plan |

## C. Numbering collisions (inconsistent naming)

Same numeric prefix used for unrelated topics (one stub, one canonical):

| Prefix | Competing files |
| --- | --- |
| `01_` | `01_ENGINEERING_POLICY.md` vs `01_BUSINESS_RULES.md` |
| `02_` | `02_SYSTEM_ARCHITECTURE.md` vs `02_DATA_MODEL.md` |
| `03_` | `03_DATABASE_AND_MIGRATIONS.md` vs `03_AI_RULES.md` |
| `04_` | `04_BUSINESS_CONTEXT.md` vs `04_EXPORT_PROCESS.md` |
| `05_` | `05_SECURITY_AND_AGENT_BOUNDARIES.md` vs `05_DOMAIN_TERMS.md` |
| `07_` | `07_CRM.md` vs `07_SECURITY.md` |
| `08_` | `08_COMPANIES…` vs `08_ROADMAP.md` |
| `09_` | `09_PRODUCTS.md` vs `09_RELEASE_NOTES.md` |
| `10_` | `10_CONTRACTS…` vs `10_TESTING.md` |

---

# Merge recommendations

Recommendations only — **do not execute without approval**. Prefer merging **content into the existing canonical file** (edit-in-place of canonical), keep Archive as historical, leave stubs until a cleanup phase.

| # | Source file(s) | Destination file | Reason | Risk | Approval required |
| --- | --- | --- | --- | --- | --- |
| M1 | `knowledge/Archive/docs/ARCHITECTURE.md` (detail not in canonical) | `knowledge/02_SYSTEM_ARCHITECTURE.md` | Canonical is ~2.3KB vs archive ~12.8KB; likely summary loss | Medium — may reintroduce outdated “Present/Planned” claims | Yes |
| M2 | `knowledge/Archive/docs/DATABASE_GUIDELINES.md` + `Archive/knowledge-legacy/02_DATA_MODEL.md` | `knowledge/03_DATABASE_AND_MIGRATIONS.md` (and/or a new `Development/` data-dictionary section if split approved) | Rich entity/field narrative still only in Archive; canonical is rules-focused | High — inventing/stating columns not in migrations | Yes |
| M3 | `Archive/knowledge-legacy/03_AI_RULES.md` + `16_AI_INTEGRATIONS.md` | `knowledge/Modules/AI.md` | Canonical AI doc thinner than combined archives | Medium — prompt policy drift | Yes |
| M4 | `Archive/docs/UI_GUIDELINES.md` + `06_UI_*` archives | `knowledge/Development/CodingStandards.md` | UI detail largely archived, not in canonical | Low–Medium — style churn | Yes |
| M5 | `Archive/knowledge-legacy/10_TESTING.md` + `17_TESTING…` | `knowledge/Development/Testing.md` | Testing checklists thinner in canonical | Low | Yes |
| M6 | `Archive/knowledge-legacy/07_SECURITY.md` | `knowledge/05_SECURITY_AND_AGENT_BOUNDARIES.md` | Security checklist detail may be incomplete in summary | High if it weakens/contradicts AGENTS | Yes |
| M7 | `Archive/knowledge-legacy/0X` module files where larger than `Modules/*` | Matching `knowledge/Modules/<Name>.md` | Byte-size gaps show possible incomplete merge | Medium — module drift vs code | Yes |
| M8 | `Archive/knowledge-legacy/04_EXPORT_PROCESS.md` long narrative | `knowledge/04_BUSINESS_CONTEXT.md` | Canonical has condensed export table; narrative still Archive-only | Low if marked historical/illustrative | Yes |
| M9 | `Archive/knowledge-legacy/09_RELEASE_NOTES.md` | `knowledge/Roadmap/Current.md` or new Memory changelog (if created) | Release notes have no canonical home | Low | Yes |
| M10 | `docs/audits/PROJECT_AUDIT…` (stub) findings vs Archive audit | `knowledge/Memory/KNOWN_ISSUES.md` | Ensure all Critical/High IDs still listed | Low | Yes |
| M11 | Contract AI env table in root `README.md` | `knowledge/Modules/AI.md` and/or `Development/API.md` | Env docs split across README and module | Low — keep README short pointer | Yes |
| M12 | Overlapping security bullets in `01_ENGINEERING_POLICY` / modules | Keep detail in `AGENTS.md` + short pointers in knowledge | Reduce duplicated security rules without losing AGENTS authority | Low if only deleting duplicates from knowledge (not AGENTS) | Yes |

**Do not merge into AGENTS.md** unless explicitly requested: AGENTS is the operating manual, not a general wiki.

---

# Archive candidates

**Recommendation only — do NOT move, rename, or delete anything in this review.**

| Candidate (current path) | Why archive / leave as historical | Suggested archive home (future, if approved) | Approval required |
| --- | --- | --- | --- |
| All `knowledge/0N_*.md` stubs that collide with foundation numbers | Obsolete as content; redirects only | Keep stubs short-term for link stability; later optional `Archive/redirects/` or remove after link sweep | Yes |
| `docs/*.md` stubs | Superseded by knowledge canonicals | Already snapshotted under `knowledge/Archive/docs/` | Yes before any removal |
| Root stubs `00_PROJECT_VISION.md`, `BUSINESS_CONTEXT.md`, `DATABASE.md`, `DEVELOPMENT_RULES.md` | Superseded; empty Archive/root snapshots need recovery first | `knowledge/Archive/root/` (populate, then keep) | Yes |
| `knowledge/Archive/**` (already archived) | Correct role: historical | Stay in Archive | N/A (already archived) |
| Duplicate meta narrative between INDEX + AUDIT after plan lands | Risk of three “source of truth” meta docs | Keep INDEX as map; AUDIT + this PLAN as dated records under Archive/meta later | Yes |

**Critical archive defect (list only):**

| File | Issue |
| --- | --- |
| `knowledge/Archive/root/00_PROJECT_VISION.md` | **Empty (0 bytes)** |
| `knowledge/Archive/root/BUSINESS_CONTEXT.md` | **Empty (0 bytes)** |
| `knowledge/Archive/root/DATABASE.md` | **Empty (0 bytes)** |
| `knowledge/Archive/root/DEVELOPMENT_RULES.md` | **Empty (0 bytes)** |

Root stubs still link to these empty “snapshots.” Original root bodies are **not** present in Archive/root. Recovery should be attempted from git history, agent transcripts, or `DOCUMENTATION_AUDIT` references **before** any cleanup of stubs — without deleting current stubs.

---

# Missing documentation

| Missing topic | Why needed | Suggested canonical path (proposed) | Approval required to create |
| --- | --- | --- | --- |
| Business Cases module | Nav + routes exist; no `Modules/BusinessCases.md` | `knowledge/Modules/BusinessCases.md` | Yes |
| Dashboard / Settings modules | Present in nav; undocumented | `knowledge/Modules/Dashboard.md`, `Settings.md` (or fold into architecture) | Yes |
| Auth & sessions runbook | Auth stub / no middleware called out in Known Issues | `knowledge/Development/Auth.md` or section in Security | Yes |
| Environment variables inventory | Split across README + AGENTS + AI module | `knowledge/Development/Environment.md` (no secret values) | Yes |
| Deployment / Supabase apply runbook | Remote migration apply is a known ops gap | `knowledge/Development/Operations.md` | Yes |
| Living module template | `docs/MODULE_TEMPLATE` is stub; template only in Archive | `knowledge/Development/ModuleTemplate.md` | Yes |
| Data dictionary (migration-aligned) | Entity detail mostly Archive; high drift risk | Section of `03` or `Development/DataDictionary.md` marked vs migrations | Yes |
| Glossary as discoverable TOC entry | Glossary lives inside `04_BUSINESS_CONTEXT` (OK) but easy to miss | Keep in `04`; add explicit INDEX entry (already partial) | No for content; Yes if splitting file |
| Test plan / CI expectations | Testing doc thin; no CI yet | Expand `Development/Testing.md` | Yes |
| Permissions matrix | AGENTS has roles; no dedicated matrix doc | `Development/Permissions.md` or Security section | Yes |

---

# Broken links

## Relative markdown targets (active + Archive)

Automated check of relative `*.md` links under the repo (excluding `node_modules`): **0 missing targets** for resolved relative paths.

## Functional / semantic link problems

| Location | Link / target | Problem | Risk | Approval to fix |
| --- | --- | --- | --- | --- |
| Root `00_PROJECT_VISION.md` | `knowledge/Archive/root/00_PROJECT_VISION.md` | Target file exists but is **empty** | High — false sense of archival | Yes |
| Root `BUSINESS_CONTEXT.md` | `knowledge/Archive/root/BUSINESS_CONTEXT.md` | Empty archive snapshot | High | Yes |
| Root `DATABASE.md` | `knowledge/Archive/root/DATABASE.md` | Empty archive snapshot | High | Yes |
| Root `DEVELOPMENT_RULES.md` | `knowledge/Archive/root/DEVELOPMENT_RULES.md` | Empty archive snapshot | High | Yes |
| Stubs claiming “Full snapshot” under Archive/root | same | Snapshot not preserved | High for “never lose information” | Yes |
| `AGENTS.md` Mandatory Project Knowledge | `knowledge/README.md`, `DOCUMENTATION_INDEX.md`, `Modules/` | Links resolve (OK) | None | No |
| Archive-internal cross-links | Sibling filenames in `knowledge-legacy/` / `Archive/docs/` | Resolve within Archive (OK) but point at historical peers, not canonical | Low (expected for archives) | No |

No `http(s)` link audit was performed against remote availability.

---

# Conflicting information

| Conflict | Sources | Resolution recommendation | Risk if ignored | Approval required |
| --- | --- | --- | --- | --- |
| Table names: `contract_items` / `warehouse_batches` / `users` / standalone `containers` vs `contract_products` / `inventory_lots` / `user_profiles` / shipment fields | Documented in `03_DATABASE…` + audit; original root DATABASE body missing from Archive/root | Keep **code + migrations** as truth; treat old names as obsolete/Planned only | High (wrong schema in new work) | No (already noted); Yes to restore empty archive from history |
| Canonical architecture/docs thinner than Archive | `02`/`03`/Modules vs Archive sizes | Backfill carefully from Archive with migration verification | Medium (lost nuance) | Yes |
| Security rules duplicated / summarized | `AGENTS.md` vs `05_SECURITY…` vs engineering policy | AGENTS wins; knowledge = summary + pointers | High if knowledge “softens” AGENTS | Yes for any rewrite |
| Roadmap split vs old single roadmap / release notes | `Roadmap/*` vs Archive `08`/`18`/`09_RELEASE` | Current/Future are canonical; Archive historical | Low | No |
| Package manager: README still shows npm/yarn/bun examples; AGENTS mandates pnpm | `README.md` vs `AGENTS.md` / engineering policy | Prefer AGENTS; update README later | Medium for new contributors | Yes |
| Consolidation “complete” narrative vs remaining stub/collision debt | `DOCUMENTATION_INDEX` / `AUDIT` vs this plan | Treat prior pass as Phase 1; this plan as Phase 2 cleanup | Low | No |
| Empty Archive/root vs stubs promising snapshots | Root stubs + Archive/root | Recover content before any stub removal | High (information loss already) | Yes |
| “Present” module maturity | Roadmap Current vs Known Issues (stubs, open RLS) | Always cross-read Known Issues | Medium | No |

---

# Proposed final documentation structure

Target steady-state (aligned with enterprise layout; largely already present):

```text
knowledge/
  README.md
  DOCUMENTATION_INDEX.md
  DOCUMENTATION_AUDIT.md                    # dated record of Phase 1
  DOCUMENTATION_CONSOLIDATION_PLAN.md       # this Phase 2 plan
  00_PROJECT_VISION.md
  01_ENGINEERING_POLICY.md
  02_SYSTEM_ARCHITECTURE.md
  03_DATABASE_AND_MIGRATIONS.md
  04_BUSINESS_CONTEXT.md
  05_SECURITY_AND_AGENT_BOUNDARIES.md
  Modules/
    CRM.md
    Companies.md
    Counterparties.md
    Products.md
    BusinessCases.md                        # proposed add
    Contracts.md
    Warehouse.md
    Logistics.md
    Finance.md
    Documents.md
    Reports.md
    AI.md
    Dashboard.md                            # optional
    Settings.md                             # optional
  Development/
    API.md
    CodingStandards.md
    Testing.md
    Performance.md
    Auth.md                                 # proposed add
    Environment.md                          # proposed add
    Operations.md                           # proposed add
    ModuleTemplate.md                       # proposed add
  Roadmap/
    Current.md
    Future.md
  Memory/
    PROJECT_MEMORY.md
    ARCHITECTURE_DECISIONS.md
    KNOWN_ISSUES.md
  Archive/
    README.md
    knowledge-legacy/                       # keep
    docs/                                   # keep
    root/                                   # restore empty files first
    meta/                                   # optional later for retired meta-docs

Repository root (recommended long-term):
  AGENTS.md                                 # keep full
  CLAUDE.md                                 # keep short
  README.md                                 # keep; docs + getting started only
  (optional short stubs OR remove only after approval + link sweep)

docs/ (recommended long-term):
  Either keep thin stubs for external bookmarks, or replace with single README pointing to knowledge/
  (no parallel full bodies)
```

**Principles for the final state**

1. Exactly one authoritative body per topic.  
2. Stubs are temporary compatibility, not content.  
3. Archive never overrides canonical or AGENTS.  
4. Incomplete work marked **Planned**.  
5. Schema claims verified against `supabase/migrations/` + app types.

---

# Migration plan

Phased, approval-gated. **No phase executes as part of this review.**

## Phase 0 — Safety (do first)

| Change | Source file | Destination file | Reason | Risk | Approval required |
| --- | --- | --- | --- | --- | --- |
| Recover empty Archive/root bodies | git history / transcripts / prior copies | `knowledge/Archive/root/*.md` | Stubs claim snapshots that are empty | Low if only writing into empty archive files | Yes |
| Verify no secret material in recovered text | Recovered root docs | same | Root docs historically may mention ops details | Medium | Yes |
| Freeze further stub proliferation | N/A | N/A | Prevent new parallel docs outside Modules/ | Low | Yes (process) |

## Phase 1 — Content completeness (edit canonical only)

| Change | Source file | Destination file | Reason | Risk | Approval required |
| --- | --- | --- | --- | --- | --- |
| Backfill architecture gaps | `Archive/docs/ARCHITECTURE.md` | `02_SYSTEM_ARCHITECTURE.md` | Restore lost detail | Medium | Yes |
| Backfill DB/data-model gaps (verified) | `Archive/docs/DATABASE_GUIDELINES.md`, `02_DATA_MODEL.md` | `03_DATABASE_AND_MIGRATIONS.md` | Restore entity narrative without inventing columns | High | Yes |
| Backfill AI rules | Archive AI docs | `Modules/AI.md` | Complete AI policy | Medium | Yes |
| Backfill UI/testing/security summaries | Matching Archive files | CodingStandards / Testing / Security | Close thin-merge gaps | Medium | Yes |
| Add missing module docs | Code/`src/lib` inspection | `Modules/BusinessCases.md` (+ optional Dashboard/Settings) | Cover nav modules | Low | Yes |
| Add env/ops/auth docs | README + AGENTS + code | Development/* new files | Ops clarity | Low–Medium | Yes |
| Align README package manager examples | `README.md` | `README.md` | Match AGENTS pnpm | Low | Yes |

## Phase 2 — Deduplicate security / policy prose

| Change | Source file | Destination file | Reason | Risk | Approval required |
| --- | --- | --- | --- | --- | --- |
| Shorten duplicated security sections in knowledge | `05_SECURITY…`, module footers | Keep AGENTS full; knowledge pointers | One security authority | Medium if over-deleted | Yes |
| Ensure engineering policy does not fork AGENTS | `01_ENGINEERING_POLICY.md` | same | Avoid conflicting rules | Medium | Yes |
| **Do not** trim AGENTS.md in this program unless separately requested | `AGENTS.md` | — | Highest priority manual | High | Yes (separate) |

## Phase 3 — Naming / stub cleanup (compatibility)

| Change | Source file | Destination file | Reason | Risk | Approval required |
| --- | --- | --- | --- | --- | --- |
| List all inbound links to numbered stubs | stubs `knowledge/0N_*.md`, `docs/*` | report only first | Know breakage before removal | Low | No for analysis; Yes to change |
| Keep stubs until external bookmarks unused | stubs | stay | Link stability | Low | — |
| Optionally relocate stub files into Archive (future) | stub paths | `knowledge/Archive/...` | End number collisions in knowledge root | Medium — breaks old relative links | Yes |
| Optionally replace `docs/` with single README stub | `docs/*.md` | `docs/README.md` → knowledge | Clearer entry | Medium | Yes |

**This review forbids Phase 3 execution.** Listing only.

## Phase 4 — Index & audit refresh

| Change | Source file | Destination file | Reason | Risk | Approval required |
| --- | --- | --- | --- | --- | --- |
| Update INDEX after Phases 0–3 | tree | `DOCUMENTATION_INDEX.md` | Reflect reality | Low | Yes |
| Append completion notes | results | new dated audit or Archive/meta | Traceability | Low | Yes |
| Retire obsolete merge claims if wrong | INDEX/AUDIT | corrected statements | Avoid false “complete” | Low | Yes |

## Phase 5 — Stop conditions

Stop consolidation when:

1. Each topic has exactly one non-stub authoritative body.  
2. Archive/root snapshots are non-empty or stubs no longer claim them.  
3. Number collisions removed or clearly quarantined.  
4. Broken/empty archive targets fixed.  
5. Missing Business Cases (+ agreed ops docs) exist.  
6. AGENTS.md still sole highest-priority policy.  
7. No parallel full bodies remain under `docs/` or root.

---

## Change log for this file only

| Action | Path |
| --- | --- |
| Created (analysis deliverable) | `knowledge/DOCUMENTATION_CONSOLIDATION_PLAN.md` |

No other files were modified by this review.
