# Documentation Index

Canonical map of SKY ERP documentation after the 2026-08-05 consolidation.

## Authority order

1. `AGENTS.md` (repository root) — highest priority  
2. Code + `supabase/migrations/` — override outdated prose  
3. Canonical files in this tree  
4. `knowledge/Archive/` — historical only  

## Reading order

1. `AGENTS.md`  
2. `knowledge/README.md`  
3. `knowledge/DOCUMENTATION_INDEX.md` (this file)  
4. `01_ENGINEERING_POLICY.md`  
5. `05_SECURITY_AND_AGENT_BOUNDARIES.md`  
6. `02_SYSTEM_ARCHITECTURE.md`  
7. `03_DATABASE_AND_MIGRATIONS.md` and/or `04_BUSINESS_CONTEXT.md`  
8. Relevant `Modules/<Topic>.md`  
9. `Development/*` as needed  
10. `Memory/KNOWN_ISSUES.md` before risky changes  
11. `Roadmap/Current.md` / `Roadmap/Future.md` for scope  

## Document tree

```text
knowledge/
  README.md
  DOCUMENTATION_INDEX.md
  DOCUMENTATION_AUDIT.md
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
    Contracts.md
    Warehouse.md
    Logistics.md
    Finance.md
    Documents.md
    Reports.md
    AI.md
  Development/
    API.md
    CodingStandards.md
    Testing.md
    Performance.md
  Roadmap/
    Current.md
    Future.md
  Memory/
    PROJECT_MEMORY.md
    ARCHITECTURE_DECISIONS.md
    KNOWN_ISSUES.md
  Archive/
    README.md
    knowledge-legacy/
    docs/
    root/
```

Redirect stubs (not canonical content) also exist at former paths under `knowledge/0X_*.md`, `docs/*.md`, and repository-root `*.md` listed below.

## Purpose of every canonical document

| Document | Purpose |
| --- | --- |
| `README.md` | Knowledge-base entry, authority, reading order |
| `DOCUMENTATION_INDEX.md` | Complete tree, purposes, merges, redirects |
| `DOCUMENTATION_AUDIT.md` | Consolidation audit trail |
| `00_PROJECT_VISION.md` | Product vision and goals |
| `01_ENGINEERING_POLICY.md` | Engineering / agent operating policy summary aligned with AGENTS |
| `02_SYSTEM_ARCHITECTURE.md` | System architecture (stack, layers, modules) |
| `03_DATABASE_AND_MIGRATIONS.md` | Schema conventions, migrations, RLS rules |
| `04_BUSINESS_CONTEXT.md` | Seafood business context, export flow, glossary, hard rules |
| `05_SECURITY_AND_AGENT_BOUNDARIES.md` | Security boundaries and agent limits |
| `Modules/CRM.md` | CRM module |
| `Modules/Companies.md` | Companies (legal entities) |
| `Modules/Counterparties.md` | Counterparties |
| `Modules/Products.md` | Products / SKUs |
| `Modules/Contracts.md` | Contracts hub + PDF import |
| `Modules/Warehouse.md` | Warehouse / lots |
| `Modules/Logistics.md` | Shipments / logistics |
| `Modules/Finance.md` | Invoices, payments, bank, FX |
| `Modules/Documents.md` | DMS / documents |
| `Modules/Reports.md` | Reports (incl. stubs) |
| `Modules/AI.md` | AI integrations and rules |
| `Development/API.md` | API / Server Actions surface notes |
| `Development/CodingStandards.md` | Coding + UI standards |
| `Development/Testing.md` | Testing and quality gates |
| `Development/DatabaseReconstruction.md` | Canonical schema reconstruction, migration replay, and database regression gate |
| `Development/AuthRLS.md` | Canonical sessions, membership roles, full RLS inventory, storage isolation and authentication regression gate |
| `Development/CoreDomain.md` | Canonical core entities, CRUD/archive behavior, Deal product lines and isolated core regression gate |
| `Development/DocumentGeneration.md` | Canonical templates, reviewed DOCX generation, immutable output versions and Phase 5 regression gate |
| `Development/OperationalTransactions.md` | Company-owned shipment/inventory/financial records, canonical traceability and Phase 6 replay gate |
| `Development/EconomicsPrerequisites.md` | Verified audit findings, immutable FX inputs, owned-lot cost basis and explicit allocations before Phase 7 profitability |
| `Development/Performance.md` | Performance guidance |
| `Roadmap/Current.md` | What exists now |
| `Roadmap/Future.md` | Planned work |
| `Memory/PROJECT_MEMORY.md` | Working memory / session facts |
| `Memory/ARCHITECTURE_DECISIONS.md` | ADRs / decisions |
| `Memory/KNOWN_ISSUES.md` | Tracked gaps and risks |
| `Archive/*` | Superseded full-text snapshots |

## Canonical documents (one per topic)

| Topic | Canonical path |
| --- | --- |
| Vision | `knowledge/00_PROJECT_VISION.md` |
| Engineering policy | `knowledge/01_ENGINEERING_POLICY.md` |
| Architecture | `knowledge/02_SYSTEM_ARCHITECTURE.md` |
| Database & migrations | `knowledge/03_DATABASE_AND_MIGRATIONS.md` |
| Business context / glossary / export | `knowledge/04_BUSINESS_CONTEXT.md` |
| Security & agent boundaries | `knowledge/05_SECURITY_AND_AGENT_BOUNDARIES.md` |
| Each module | `knowledge/Modules/<Name>.md` |
| API | `knowledge/Development/API.md` |
| Coding / UI standards | `knowledge/Development/CodingStandards.md` |
| Testing | `knowledge/Development/Testing.md` |
| Performance | `knowledge/Development/Performance.md` |
| Current roadmap | `knowledge/Roadmap/Current.md` |
| Future roadmap | `knowledge/Roadmap/Future.md` |
| Project memory | `knowledge/Memory/PROJECT_MEMORY.md` |
| Architecture decisions | `knowledge/Memory/ARCHITECTURE_DECISIONS.md` |
| Known issues | `knowledge/Memory/KNOWN_ISSUES.md` |
| Agent operating manual | `AGENTS.md` (outside knowledge/; not duplicated) |

## Redirect stubs (point to canonical + Archive)

### Former `knowledge/` numbered docs

| Stub path | Canonical |
| --- | --- |
| `01_BUSINESS_RULES.md` | `04_BUSINESS_CONTEXT.md` |
| `02_DATA_MODEL.md` | `03_DATABASE_AND_MIGRATIONS.md` (+ architecture) |
| `03_AI_RULES.md` | `Modules/AI.md` |
| `04_EXPORT_PROCESS.md` | `04_BUSINESS_CONTEXT.md` |
| `05_DOMAIN_TERMS.md` | `04_BUSINESS_CONTEXT.md` |
| `06_UI_PATTERNS.md` / `06_UI_AND_DESIGN_SYSTEM.md` | `Development/CodingStandards.md` |
| `07_SECURITY.md` | `05_SECURITY_AND_AGENT_BOUNDARIES.md` |
| `07_CRM.md` | `Modules/CRM.md` |
| `08_COMPANIES_AND_COUNTERPARTIES.md` | `Modules/Companies.md` + `Modules/Counterparties.md` |
| `08_ROADMAP.md` / `18_ROADMAP.md` | `Roadmap/Current.md` + `Roadmap/Future.md` |
| `09_PRODUCTS.md` | `Modules/Products.md` |
| `09_RELEASE_NOTES.md` | Archive + `Roadmap/Current.md` |
| `10_TESTING.md` / `17_TESTING_AND_QUALITY.md` | `Development/Testing.md` |
| `10_CONTRACTS_AND_PDF_IMPORT.md` | `Modules/Contracts.md` |
| `11_LOGISTICS.md` | `Modules/Logistics.md` |
| `12_WAREHOUSE.md` | `Modules/Warehouse.md` |
| `13_FINANCE.md` | `Modules/Finance.md` |
| `14_DOCUMENTS.md` | `Modules/Documents.md` |
| `15_REPORTS_AND_ANALYTICS.md` | `Modules/Reports.md` |
| `16_AI_INTEGRATIONS.md` | `Modules/AI.md` |

### Former `docs/`

| Stub path | Canonical |
| --- | --- |
| `docs/ARCHITECTURE.md` | `02_SYSTEM_ARCHITECTURE.md` |
| `docs/DATABASE_GUIDELINES.md` | `03_DATABASE_AND_MIGRATIONS.md` |
| `docs/DEVELOPMENT_WORKFLOW.md` | `01_ENGINEERING_POLICY.md` + `Development/CodingStandards.md` |
| `docs/PROJECT_STANDARDS.md` | same |
| `docs/UI_GUIDELINES.md` | `Development/CodingStandards.md` |
| `docs/MODULE_TEMPLATE.md` | Archive template; modules under `Modules/` |
| `docs/audits/PROJECT_AUDIT_2026-08-05.md` | `Memory/KNOWN_ISSUES.md` (+ full audit in Archive) |

### Former repository root

| Stub path | Canonical |
| --- | --- |
| `00_PROJECT_VISION.md` | `knowledge/00_PROJECT_VISION.md` |
| `BUSINESS_CONTEXT.md` | `knowledge/04_BUSINESS_CONTEXT.md` |
| `DATABASE.md` | `knowledge/03_DATABASE_AND_MIGRATIONS.md` |
| `DEVELOPMENT_RULES.md` | `knowledge/01_ENGINEERING_POLICY.md` + CodingStandards |

## Archived documents

Full historical text under:

| Archive path | Origin |
| --- | --- |
| `Archive/knowledge-legacy/*` | Former `knowledge/0X_*.md` bodies |
| `Archive/docs/*` | Former `docs/*.md` and audit |
| `Archive/root/*` | Former root markdown bodies |

See `Archive/README.md`.

## Duplicate documents that were merged

| Merged sources | Into |
| --- | --- |
| Root vision + early vision notes | `00_PROJECT_VISION.md` |
| `docs/PROJECT_STANDARDS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, root `DEVELOPMENT_RULES.md`, AGENTS-aligned policy | `01_ENGINEERING_POLICY.md` + `Development/CodingStandards.md` |
| `docs/ARCHITECTURE.md` + prior architecture knowledge | `02_SYSTEM_ARCHITECTURE.md` |
| Root `DATABASE.md`, `docs/DATABASE_GUIDELINES.md`, `02_DATA_MODEL.md` | `03_DATABASE_AND_MIGRATIONS.md` |
| Root `BUSINESS_CONTEXT.md`, `01_BUSINESS_RULES.md`, `04_EXPORT_PROCESS.md`, `05_DOMAIN_TERMS.md` | `04_BUSINESS_CONTEXT.md` |
| `07_SECURITY.md` + agent boundary notes | `05_SECURITY_AND_AGENT_BOUNDARIES.md` |
| `03_AI_RULES.md` + `16_AI_INTEGRATIONS.md` | `Modules/AI.md` |
| `06_UI_PATTERNS.md` + `06_UI_AND_DESIGN_SYSTEM.md` + `docs/UI_GUIDELINES.md` | `Development/CodingStandards.md` |
| `08_ROADMAP.md` + `18_ROADMAP.md` | `Roadmap/Current.md` + `Roadmap/Future.md` |
| `10_TESTING.md` + `17_TESTING_AND_QUALITY.md` | `Development/Testing.md` |
| `08_COMPANIES_AND_COUNTERPARTIES.md` | `Modules/Companies.md` + `Modules/Counterparties.md` |
| Project audit findings | `Memory/KNOWN_ISSUES.md` (+ archived audit) |

## Maintenance

- Update only the canonical file for a topic.  
- When superseding a doc, copy full text to `Archive/` then leave a redirect stub at the old path.  
- Do not invent schema or APIs; mark unfinished work **Planned**.
