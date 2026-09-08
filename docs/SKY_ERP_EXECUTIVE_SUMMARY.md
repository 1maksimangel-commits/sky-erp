# SKY ERP — Executive Summary

## Current state

SKY ERP is an existing Next.js/Supabase enterprise application with a substantial operating foundation. It already has master data, Business Cases, a strong Contract Hub, AI-assisted contract PDF extraction with human review, shipment CRUD, warehouse movements, finance screens, a document library with versions, CRM, an operational dashboard, and finance reports.

It is not yet ready for one real end-to-end international transaction. The principal gap is integration and control, not the number of screens. Business Case is not yet a complete Deal aggregate, commission is absent, document verification is contract-import-specific, multi-currency profit is not fully auditable, and authentication/company isolation remain production blockers.

## Strongest parts

1. **Contract Hub — High maturity.** CRUD, product lines, related operations, workspace tabs, history, and robust PDF extraction/review are present.
2. **Document foundation — Medium/High.** DMS upload, entity links, preview, signed URLs, versions, validation, and ownership helpers exist.
3. **Logistics — Medium/High.** Shipment CRUD, contract linkage, routing/date/status validation, and timeline exist.
4. **CRM — Medium.** Rich seafood customer profiles, contacts, activities, tasks, notes, attachments, and contract links exist.
5. **Finance/Warehouse — Medium.** Core invoice/payment/FX and stock-movement foundations exist, though lifecycle and security need completion.

## Biggest gaps

- Business Case does not yet connect the full purchase/sales transaction as one Deal.
- There is no first-class Commission Engine.
- Original/version invariants are not consistently enforced across all document paths.
- AI extracts contracts but does not persist general cross-document validation findings.
- Finance lacks a complete decimal-safe, multi-currency expected/actual profit model.
- Real authentication, company membership, RLS, storage security, and complete audit coverage are unfinished.
- Template Center and corporate Knowledge are effectively future capabilities.

## Required before the first real transaction

1. Confirm the actual Supabase schema and applied migrations.
2. Implement reviewed authentication, company membership, RLS, and storage policies.
3. Evolve Business Case into a minimum Deal workspace with seller, buyer, producer, products, purchase/sales sides, and explicit currencies.
4. Add immutable document original/version metadata and basic verification findings.
5. Add an auditable Commission Engine.
6. Stabilize payment allocation and implement expected profit with decimal/FX evidence.
7. Project all milestone events into a complete Deal timeline and audit log.

## Recommended implementation sequence

| Sequence | Work | Complexity |
| ---: | --- | --- |
| 1 | Schema inventory, auth, company scope, RLS, RPC/storage hardening | High |
| 2 | Deal aggregate over existing Business Cases, participants, Deal items/sides | High |
| 3 | Contract side/annex/completeness improvements | Medium |
| 4 | Immutable originals, document versions, basic validation findings | High |
| 5 | Commission calculation and finance links | Medium |
| 6 | Decimal-safe expected profit, payment lifecycle, audit events | High |
| 7 | Milestone integration tests and one-transaction acceptance | Medium |
| 8 | Templates, knowledge, and evidence-backed AI assistant | High, after Milestone 1 |

## Complexity by module

| Module | Complexity | Reason |
| --- | --- | --- |
| Deal Engine | High | Cross-module aggregate and backward-compatible data model |
| Contract Engine | Medium | Strong current base; annex/completeness and Deal sides needed |
| Document Center | High | Storage security, immutable lineage, validation integration |
| AI Document Verification | High | Evidence, confidence, review, cross-document logic |
| Template Center | High | Versioned mapping and safe Word/PDF generation |
| Original/Version History | Medium | Current version foundation can be extended |
| Commission Engine | Medium | New focused domain with deterministic formulas |
| Finance | High | Precision, FX, allocations, lifecycle, profit |
| Memory/History | Medium | Existing timelines need a unified event contract |
| Knowledge | High | Permission-aware, evidence-backed historical retrieval |
| AI Assistant | High | Authorized tools and reliable evidence, not generic chat |
| Audit/Security | High | Production-critical auth/RLS/company isolation |

## Top 5 technical risks

1. Admin-role stub and broad historical RLS/storage policies expose or permit mutation of business data.
2. Migration drift and missing original DDL make the repository an incomplete representation of live schema.
3. JavaScript-number and implicit currency aggregation can produce inaccurate financial results.
4. DMS hotfix chains and inconsistent upload paths can weaken original/version guarantees.
5. Limited integration tests allow regressions across contracts, documents, finance, warehouse, and company scope.

## Top 5 business-process risks

1. Purchase and sales sides are not unified under one auditable Deal.
2. Missing commissions create incorrect payable and profit results.
3. Contract/document discrepancies can pass without structured verification and resolution.
4. Incomplete payment/expense lifecycle can misstate receivables, payables, and actual profit.
5. Fragmented histories make it difficult to reconstruct who changed terms, documents, shipment data, or financial records.

## Recommendation

Do not broaden the product before completing Milestone 1. The smallest valuable outcome is one secure Deal containing participants, products, purchase/sales contracts, immutable documents, basic verification, commission, payment status, shipment reference, expected profit, and complete history. This uses the strongest existing modules while closing the specific gaps that currently prevent real operational use.
