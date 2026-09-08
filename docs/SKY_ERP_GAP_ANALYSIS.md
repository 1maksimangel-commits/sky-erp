# SKY ERP — Gap Analysis

Readiness measures production usability from the repository snapshot, not remote deployment state.

| # | Core area | Readiness | Priority |
| ---: | --- | ---: | --- |
| 1 | Deal Engine | 38% | P0 |
| 2 | Contract Engine | 70% | P0 |
| 3 | Document Center | 64% | P0 |
| 4 | AI Document Verification | 22% | P1 |
| 5 | Template Center | 5% | P2 |
| 6 | Original / Version History | 48% | P0 |
| 7 | Commission Engine | 5% | P0 |
| 8 | Finance | 55% | P0 |
| 9 | Memory / History | 43% | P1 |
| 10 | Knowledge | 12% | P2 |
| 11 | AI Assistant | 25% | P2 |
| 12 | Audit / Security | 28% | P0 |

## 1. Deal Engine — 38% — P0

**Implemented now:** Business Case create/list/detail; company, buyer, supplier, consignee, amount, currency, Incoterms; links from contracts, shipments, documents, invoices, payments, expenses, dashboard, and AI queries.

**Partially implemented:** Contract-centric workspace represents portions of a Deal; profit query exists but is not a complete auditable Deal P&L.

**Missing:** multiple role-based participants, explicit purchase/sales sides, multiple typed contracts, deal product economics, producer/notify party, commissions, expected/actual profit breakdown, update/archive lifecycle, unified Deal history.

**Dependencies:** identity/company scope, master data, contracts, finance, commissions, documents, audit.

**Critical risks:** creating a parallel Deal table could fragment existing Business Cases; current single buyer/supplier fields are too narrow; currency aggregation can be wrong.

**Minimum production work:** evolve Business Case additively into Deal; participant roles; deal items; purchase/sales contract links; currency-safe expected profit; status gates; history/audit; one complete transaction test.

## 2. Contract Engine — 70% — P0

**Implemented now:** CRUD, workspace tabs, product lines, linked operations, documents/history, PDF upload/extraction/matching/review/confirm, prompt-injection instruction and strict file checks.

**Partially implemented:** terms, workflow, finance/logistics/warehouse links, and import recovery; remote import schema is not confirmed.

**Missing:** purchase/sales classification at Deal level, multiple contracts per side, annex/amendment lineage, completeness rules, cross-document checks, explicit approval lifecycle.

**Dependencies:** Deal model, DMS immutable versions, verification findings, auth/RLS.

**Critical risks:** stuck imports, schema drift, weak legacy upload path, amendment overwrite, incorrect matching accepted by user.

**Minimum production work:** confirm schema, retry/fail import states, unify uploads, classify contract side, add annex lineage/completeness, validate ownership, add integration tests.

## 3. Document Center — 64% — P0

**Implemented now:** library, upload, metadata, links, preview, signed URLs, versions, replacement, download logging, entity panels, MIME/size validation.

**Partially implemented:** ownership check and version model; schema formed by hotfix chain; originals exist but are not governed by a universal immutable policy.

**Missing:** semantic lifecycle, approval state, checksums, supersedes/change reason consistency, document completeness, verification findings, controlled signing/seals, extensible templates.

**Dependencies:** canonical schema, storage RLS, Deal/contract model, audit.

**Critical risks:** public storage policies, schema drift, loss/overwrite of evidence, arbitrary-path signing if controls regress.

**Minimum production work:** reconcile schema; enforce immutable original and derivative versions; secure storage; add required document types/checklist; test version/ownership behavior.

## 4. AI Document Verification — 22% — P1

**Implemented now:** structured contract extraction, confidence/source fields, entity matching, human review.

**Partially implemented:** review UI validates extracted contract fields, not a general document-to-contract verification system.

**Missing:** normalized parsed-document records, verification runs/findings, expected-vs-observed comparison, cross-document checks, signatures/seals findings, resolution workflow, historical comparison.

**Dependencies:** Document Center, Contract/Deal terms, version history, AI retention/security policy.

**Critical risks:** hallucinated findings, prompt injection, provider data exposure, treating OCR/visual cues as authentication.

**Minimum production work:** start with deterministic + AI-assisted checks for one contract/invoice or packing-list type; persist evidence/confidence; require human resolution; add adversarial fixtures.

## 5. Template Center — 5% — P2

**Implemented now:** DMS can store documents; product/contract data can theoretically supply fields.

**Partially implemented:** none confirmed as a template product.

**Missing:** template tables, scope, versioning, field mapping, approval, generation, Word/PDF rendering, generated-document lineage.

**Dependencies:** stable DMS version model, company/counterparty scope, Deal schema, approved rendering approach.

**Critical risks:** overwriting originals, uncontrolled legal wording, stale templates, signing unauthorized content.

**Minimum production work:** versioned template metadata; one approved document type; explicit mapping preview; human generate/save; immutable generated output.

## 6. Original / Version History — 48% — P0

**Implemented now:** `documents`, `document_versions`, root/current fields, replace-version action, contract import original storage, activity/timeline records.

**Partially implemented:** version relationships and current flags; not every upload path proves immutable-original behavior.

**Missing:** checksum, universal source/creator/supersedes/change reason/validation/approval contract, retention and archival rules.

**Dependencies:** canonical DMS schema, storage ACL, audit identity.

**Critical risks:** hotfix drift, ambiguous current version, business deletion, unsigned/derived files confused with originals.

**Minimum production work:** define and enforce immutable root version; add missing metadata additively; disallow replacement of original bytes; test upload/revise/sign/archive lineage.

## 7. Commission Engine — 5% — P0

**Implemented now:** generic invoices/expenses/payments can hold amounts; no commission domain was found.

**Partially implemented:** none; manual generic expense is not an auditable commission calculation.

**Missing:** all methods, beneficiary/payer, base/rate/unit, expected/actual amounts, status, invoice/payment links, history.

**Dependencies:** Deal participants/items, decimal money, finance, documents, audit.

**Critical risks:** omitted commission distorts profit and payables; unit conversion and currency errors; hidden manual calculations.

**Minimum production work:** commission entity and decimal calculator for six methods; visible basis; expected/actual separation; invoice/payment link; tests for kg/MT/unit/percent/fixed/manual.

## 8. Finance — 55% — P0

**Implemented now:** invoices/items, payment registration/allocation, bank accounts, FX, expense schema/queries, dashboard, reports, Business Case profit query.

**Partially implemented:** balances, expenses UI, bank transactions, profit, payment-to-Business-Case schema consistency.

**Missing:** robust post/void lifecycle, reconciliation, commissions, complete AP/AR, expected/actual P&L, explicit conversion basis, approval workflow.

**Dependencies:** decimal strategy, Deal/commission model, auth/RLS, audit.

**Critical risks:** JavaScript-number precision, dual payment paths, mixed currencies, broad RPC grants, destructive correction behavior.

**Minimum production work:** define monetary primitives and FX basis; stabilize allocations; add expense/payment lifecycle; calculate expected profit; track payment status; audit every financial mutation.

## 9. Memory / History — 43% — P1

**Implemented now:** activity log, generic timeline, contract history, shipment timeline, CRM timeline/notes/communications/tasks, document versions, notifications.

**Partially implemented:** `recordEntityEvent` covers selected mutations; separate timeline systems coexist.

**Missing:** unified Deal timeline, guaranteed events for every material operation, commission history, reason/correlation/source consistency.

**Dependencies:** actor identity, audit schema, stable entity links.

**Critical risks:** incomplete or contradictory histories; actor unavailable under admin stub; audit events fail without blocking business action.

**Minimum production work:** one event contract and Deal timeline projection; cover Milestone 1 mutations; preserve before/after/reason; test ordering and access.

## 10. Knowledge — 12% — P2

**Implemented now:** curated repository knowledge and management decisions; historical ERP data is queryable by modules.

**Partially implemented:** rule-based AI retrieves a few live records; no corporate-knowledge product exists.

**Missing:** structured precedent index, validation resolution knowledge, reusable terms, permission-aware similarity, citations/evidence UI.

**Dependencies:** complete Deal history, document parsing/findings, authorization, data-retention policy.

**Critical risks:** leaking another company's data, stale precedent, unsupported AI answers, duplicating sensitive documents.

**Minimum production work:** first deliver deterministic historical queries with evidence links; index approved metadata only; add similarity/semantic retrieval later.

## 11. AI Assistant — 25% — P2

**Implemented now:** `/ai` chat-like UI and hard-coded read queries for invoices, contracts, ETA, profit, products, and dashboard; contract OpenAI extraction exists separately.

**Partially implemented:** operational answers are useful but keyword-bound and may overstate AI capability.

**Missing:** natural-language tool selection, evidence citations, conversation context, precedent/commission/document tools, authorization-aware write proposals.

**Dependencies:** auth/RLS, stable domain services, Knowledge, audit, approved OpenAI usage.

**Critical risks:** misleading answers, wrong financial calculation, data overexposure, accidental write authority.

**Minimum production work:** keep read-only; expose a small authorized tool set; return evidence and calculation basis; test permissions; require explicit review for proposed changes.

## 12. Audit / Security — 28% — P0

**Implemented now:** SSR clients, permission matrix, `assertCan` in selected paths, RLS enabled, activity/timeline helpers, signed-path ownership checks.

**Partially implemented:** company scope and audit logging; coverage is uneven.

**Proposed only:** company memberships, hardened RLS, and `audit_events` migration designs.

**Missing:** real role resolution, production company isolation, comprehensive audit event schema/coverage, secure storage policies, verified RPC grants.

**Dependencies:** explicit security/RLS approval, actual schema inventory, user/company model.

**Critical risks:** current admin stub and broad public policies are production blockers; financial/stock RPC privilege; audit actor ambiguity.

**Minimum production work:** reviewed auth/company membership; deny-by-default RLS; server-action ownership checks; restricted RPC grants; append-only audit; cross-role/cross-company tests.
