# SKY ERP — Current Project Map

Status: repository snapshot as of 2026-08-28. This document describes code in the repository; it does not prove that every migration is applied to a remote Supabase project.

Legend:

- **Implemented** — executable application code and/or an active migration exists.
- **Partial** — useful code exists, but lifecycle, deployment state, security, or end-to-end coverage is incomplete.
- **Proposed only** — comments/design/proposal migration; not active schema.
- **Missing** — no confirmed implementation found.

## 1. Repository structure

| Path | Purpose |
| --- | --- |
| `src/app/` | Next.js 16 App Router pages, layouts, and route handlers |
| `src/components/` | Feature and shared React components |
| `src/lib/` | Server Actions, queries, validation, domain services, Supabase clients, AI code |
| `supabase/migrations/` | Ordered additive PostgreSQL/Supabase migrations and proposals |
| `knowledge/` | Canonical product, architecture, module, development, roadmap, and memory documents |
| `management/` | AI engineering workflow, roles, backlog, sprint, risks, approvals |
| `docs/` | Architecture reports and product-planning documents |
| `public/` | Static assets |
| `package.json`, lockfiles | Next.js/React/TypeScript dependencies and scripts |

Root documentation files are mostly entry points or historical redirects; `AGENTS.md` is the highest-priority operating policy and `knowledge/` is the canonical product knowledge base.

## 2. Current architecture

```text
Browser
  -> Next.js App Router pages / client components
  -> React Server Components for reads
  -> Server Actions for mutations and selected reads
  -> Route Handlers for long-running PDF import
  -> Supabase SSR client
  -> PostgreSQL + RLS + Storage
  -> OpenAI (server only, contract extraction path)
```

Stack: Next.js 16, React 19, strict TypeScript, Tailwind CSS 4, Supabase JS/SSR, PostgreSQL, OpenAI SDK, Zod, Lucide icons, and `xlsx` for product imports.

Architecture is feature-oriented: `src/components/<area>` contains UI; `src/lib/<area>` contains domain queries/actions/types/validation. Pages are generally thin and server-rendered. Cross-cutting integration lives in `src/lib/platform/`.

Current central hub is **Contract**, with Business Case acting as an early deal record. The target product model requires Business Case/Deal to become the transaction-level aggregate above purchase and sales contracts.

## 3. Application routes/pages

| Route | Page | State |
| --- | --- | --- |
| `/` | Redirects to `/dashboard` | Implemented |
| `/dashboard` | Operational snapshot | Implemented; not full analytics |
| `/crm` | CRM list/dashboard | Implemented |
| `/crm/[id]` | CRM customer profile | Implemented |
| `/companies` | Legal-entity list/create | Implemented |
| `/companies/[id]` | Company workspace | Partial; mainly read-only |
| `/counterparties` | Counterparty list/create | Implemented |
| `/counterparties/[id]` | Counterparty workspace | Partial; mainly read-only |
| `/products` | Product list/create/import | Implemented |
| `/products/[id]` | Product detail | Partial; read-oriented |
| `/business-cases` | Business Case list/create | Implemented |
| `/business-cases/[id]` | Business Case detail | Partial; limited deal lifecycle |
| `/contracts` | Contract list/create/PDF import | Implemented |
| `/contracts/[id]` | Contract overview editor | Implemented |
| `/contracts/[id]/business-case` | Linked Business Case | Implemented |
| `/contracts/[id]/documents` | Contract documents | Implemented |
| `/contracts/[id]/logistics` | Contract shipments | Implemented |
| `/contracts/[id]/warehouse` | Contract inventory/lots | Implemented |
| `/contracts/[id]/finance` | Contract invoices/payments | Implemented |
| `/contracts/[id]/history` | Contract history | Implemented |
| `/logistics` | Shipment list/create | Implemented |
| `/logistics/[id]` | Shipment workspace | Implemented; duplicate detail patterns remain |
| `/warehouse` | Inventory operations board | Implemented |
| `/warehouse/lots/[id]` | Lot detail | Implemented |
| `/finance` | Finance dashboard | Implemented |
| `/finance/invoices` | Invoice list/create | Implemented |
| `/finance/invoices/[id]` | Invoice detail | Implemented |
| `/finance/payments` | Payment list/register | Implemented |
| `/finance/payments/[id]` | Payment detail | Implemented |
| `/finance/bank-accounts` | Bank accounts | Implemented |
| `/finance/exchange-rates` | FX rates | Implemented |
| `/finance/reports` | Finance reports | Implemented |
| `/documents` | DMS library | Implemented |
| `/reports` | General reports | **Missing/placeholder** |
| `/ai` | Guided ERP question UI | Partial; rule-based, not an LLM assistant |
| `/settings` | Settings surface | Partial |

## 4. Server Actions

All confirmed action files use `"use server"`.

| Area | Exported actions |
| --- | --- |
| Companies | `createCompany` |
| Counterparties | `createCounterparty` |
| Products | `checkExistingSkus`, `importProducts`, `createProduct` |
| Business Cases | `createBusinessCase` |
| Contracts | `createContract`, `updateContract`, `deleteContract` |
| Contract hub | `createShipmentForContract`, `createInvoiceForContract`, `registerPaymentForContract`, `createBusinessCaseForContract`, `uploadContractDocument`, `addContractProductLine` |
| Contract import | `getContractImportAiStatus`, `getContractImport`, `createCounterpartyFromImport`, `createProductFromImport`, `confirmContractImport` |
| Logistics | `createShipment`, `updateShipment`, `deleteShipment`, `addShipmentTimelineEvent`, `createShipmentForContract` |
| Warehouse | `receiveInventory`, `issueInventory`, `transferInventory`, `adjustInventory` |
| Finance | `createInvoice`, `registerPayment`, `createBankAccount`, `upsertExchangeRate` |
| Documents | `uploadDocument`, `listLinkedDocuments`, `replaceDocumentVersion`, `deleteDocument`, `recordDocumentDownload`, `fetchDocumentVersions`, `getSignedUrlForPath`, `uploadEntityDocument` |
| CRM | `createCrmCustomer`, `updateCrmCustomer`, `archiveCrmCustomer`, `deleteCrmCustomer`, contact CRUD, `createCrmNote`, `createCrmTimelineEvent`, attachment upload/delete, `createCrmCommunication`, task create/status update, customer category/status update |
| Platform | `addTimelineEvent`, `logActivity`, `recordEntityEvent`, document wrappers, notification create/read, `globalSearch`, `askErpAssistant` |

Notably missing: update/archive actions for Companies, Counterparties, Products, and Business Cases; finance invoice/payment void/edit lifecycle; first-class commission actions.

## 5. API routes

| Method and route | Purpose | State |
| --- | --- | --- |
| `POST /api/contracts/import` | Validate/store PDF, create import row, run OpenAI extraction, stream NDJSON progress | Implemented; depends on storage, provider, and applied schema |
| `POST /api/contracts/import/[id]/reextract` | Reload stored PDF and repeat extraction | Implemented; same dependencies |

No general public REST API, webhooks, template-generation API, or document-verification API was found.

## 6. Supabase integration structure

| File/area | Responsibility |
| --- | --- |
| `src/lib/supabase/server.ts` | Cookie-aware SSR server client |
| `src/lib/supabase/client.ts` | Browser client |
| `src/lib/supabase/env.ts` | Public Supabase configuration validation; secrets are not exposed here |
| `src/lib/*/db.ts` | Module reads and normalization |
| `src/lib/*/actions.ts` | Mutations through the SSR client |
| `src/lib/platform/*-db.ts` | Activity, timeline, notification, and document persistence |
| Storage bucket `documents` | DMS bytes and contract-import originals |
| PostgreSQL RPCs | Warehouse stock operations, payment registration/balance refresh, platform audit/timeline/notification helpers |

RLS is enabled in many migrations, but historical migrations grant broad `public` access. The code does not use service-role bypass. Live migration state is not proven by the repository.

## 7. Migrations grouped by business area

### Deal and contracts

- `20260804130000_create_business_cases.sql` — active Business Case table; read policy only in this file.
- `20260804140000_contract_hub.sql` — shipments, contract products, invoices, and contract extensions.
- `20260804230000_contract_pdf_import.sql` — import and field-review tables.
- `20260805040000_contract_import_schema_ensure.sql` — additive import/storage schema ensure; indicates deployment drift risk.
- `20260805080000_contract_import_processing_ttl_proposal.sql` — **proposed only**, commented TTL recovery design.

### Logistics

- `20260804150000_logistics_extensions.sql` — earlier logistics extension.
- `20260804160000_shipments_logistics_columns.sql` — current shipment columns and shipment timeline.
- `20260805100000_logistics_p0_ownership_columns.sql` — company/ownership stabilization.

### Warehouse

- `20260804170000_warehouse_module.sql` — locations, inventory, lots, movements, transfers, reservations, stock RPCs.

### Finance

- `20260804180000_finance_module.sql` — currencies, FX, accounts, bank data, invoice/payment extensions, allocations, expenses, RPCs.
- `20260805050000_payments_business_case_id.sql` — closes missing payment-to-Business-Case column gap.
- `20260805090000_finance_stabilization_indexes_proposal.sql` — **proposed only** indexes/constraints guidance.

### Platform, identity, audit

- `20260804190000_platform_integration.sql` — documents, activity, timeline, notifications, roles, user profiles, RPC helpers.
- `20260805060000_p0_rls_anon_hardening_proposal.sql` — **proposal**, security hardening SQL is not active.
- `20260805070000_auth_foundation_proposal.sql` — **proposal**, company memberships/audit events and policy design are commented.

### Documents

- `20260804200000_documents_dms.sql` — DMS foundation.
- `20260804210000_documents_dms_complete.sql` — DMS completion and versions.
- `20260804220000_documents_missing_columns_hotfix.sql` — schema-drift hotfix.

### CRM

- `20260805020000_crm_module.sql` — customers, contacts, notes, communications, tasks.
- `20260805030000_crm_seafood_profile.sql` — seafood fields, timeline, attachments.

### Master data policies

- `20260805010000_companies_insert_policy.sql` — company insert policy.
- `20260805110000_products_insert_policy.sql` — product insert policy.

Previously existing master tables are extended or queried but are not all originally created in this migration set.

## 8. Main inferred database entities

### Pre-existing/inferred from code and ALTER/FK usage

`companies`, `counterparties`, `products`, `contracts`, `payments`. Their complete original DDL is not present in the current migration folder, so exact live shape must not be inferred beyond selected/altered fields.

### Deal/contract

`business_cases`, `contract_products`, `contract_imports`, `contract_import_field_reviews` and inferred `contracts`.

### Logistics/warehouse

`shipments`, `shipment_timeline_events`, `warehouse_locations`, `inventory`, `inventory_lots`, `stock_movements`, `warehouse_transfers`, `inventory_reservations`.

### Finance

`invoices`, `invoice_items`, `payments`, `payment_allocations`, `currencies`, `exchange_rates`, `accounts`, `bank_accounts`, `bank_transactions`, `expense_categories`, `expenses`.

### Documents/platform

`documents`, `document_versions`, `activity_log`, `timeline_events`, `notifications`, `roles`, `user_profiles`.

### CRM

`crm_customers`, `crm_contacts`, `crm_notes`, `crm_communications`, `crm_tasks`, `crm_timeline_events`, `crm_attachments`.

### Proposed only

`company_memberships`, `audit_events` appear in commented auth-foundation proposal SQL and are not implemented schema.

### Missing first-class entities required by the product plan

Deal participants/roles, purchase-versus-sales contract classification at deal level, annex/amendment lineage, document validations/findings, templates, commissions, document approvals, knowledge records/precedents, and first-class containers.

## 9. Major React components

| Area | Components |
| --- | --- |
| Layout | `AppLayout`, `Sidebar`, `Header`, `UserMenu`, `CommandPalette`, `QuickCreateMenu`, `NotificationDrawer`, shell context |
| Shared UI | `DataTable`, `TableShell`, `EmptyState`, `PageHeader`, `Breadcrumbs`, `Toast` |
| Platform workspace | `EntityWorkspace`, activity/timeline/documents/linked/financial panels, `DetailGrid` |
| Dashboard | `OperationsDashboard` |
| Master data | `CompaniesView`, `CompanyFormModal`, `CounterpartiesView`, `CounterpartyFormModal`, `ProductsView`, `ProductFormModal`, `ProductImportModal` |
| Deal | `BusinessCasesView`, `BusinessCaseFormModal` |
| Contracts | list/form/workspace shell, overview editor, workflow, business-case/logistics/warehouse/finance/documents/history tabs |
| Contract AI import | `ContractPdfImportWizard`, `ContractImportReviewWorkspace`, `ConfidenceField` |
| Logistics | `LogisticsView`, shipment form/detail/delete components |
| Warehouse | `WarehouseView`, `WarehouseOperationModal` |
| Finance | dashboard, invoices, payments, bank accounts, exchange rates, reports, forms and navigation |
| Documents | library, upload forms/modals, preview, entity panel, delete dialog |
| CRM | `CrmView`, `CustomerProfileView`, `CustomerFormModal` |
| AI | `AiAssistantView` |

## 10. Major TypeScript modules/services

- Master-data queries/actions/types under `companies`, `counterparties`, and `products`.
- Business Case queries, actions, and types.
- Contract persistence, workspace relations, workflow metadata, finance/warehouse/document joins, history, validation, and import service.
- Logistics DB normalization, authorization binding, validation, timeline, formatting, actions, and tests.
- Warehouse DB/actions/types/validation/formatting.
- Finance DB/actions/types/validation/formatting and report aggregation.
- Documents DB/actions/upload helpers/signed-url authorization/validation/formatting and tests.
- CRM DB/actions/types/validation/formatting.
- Platform activity, audit, timeline, notifications, permissions, company scope, search, dashboard, route metadata, entity bundles, and runtime integration.

## 11. AI-related modules

### Implemented

- `src/lib/ai/contracts/`: OpenAI client, extraction prompt/schema, matching, errors, and PDF extraction.
- Contract import API/service: storage, extraction, progress, review, explicit confirmation.

### Partial

- `src/lib/platform/ai.ts`: keyword/rule routing over live ERP queries. It does not call OpenAI and supports only hard-coded intents.
- `src/lib/ai/runtime/` and `src/lib/ai/director/`: in-repository task planning/runtime infrastructure. It is not the user-facing ERP assistant and does not complete business workflows.

### Missing

- Cross-document AI verification, validation findings, precedent retrieval, tool-authorized conversational assistant, and structured knowledge retrieval.

## 12. Contract-related modules

`src/lib/contracts/` contains core CRUD, reads, validation, workspace/tab metadata, products, finance, shipments, documents, Business Case relations, history, hub actions, and PDF import. `src/components/contracts/` contains the operational workspace and review UI. Contract creation and PDF review are implemented; purchase/sales pairing, annex lineage, completeness rules, and cross-document comparison are missing or partial.

## 13. Document-related modules

`src/lib/documents/` implements DMS reads/actions, validation, version replacement, ownership checks, storage paths, and formatting. Entity panels integrate documents across modules. Original contract-import PDFs use the same bucket under an import prefix. General immutable-original policy, semantic document lifecycle, approval state, templates, generated variants, and validation findings are missing.

## 14. Logistics-related modules

`src/lib/logistics/` and `src/components/logistics/` implement shipment CRUD, validation, timeline, filters, contract binding, and detail UI. Multi-container, booking depth, carrier tracking, customs/document gates, and complete company isolation remain incomplete.

## 15. Finance-related modules

Finance supports invoice creation, payment registration/allocation, bank accounts, exchange rates, expenses at schema/query level, dashboard and reports. Invoice/payment update/void, expense UI depth, bank reconciliation, decimal-safe end-to-end arithmetic, multi-currency profit normalization, approvals, claims, and commission accounting remain incomplete.

## 16. Commission-related logic

**Missing as a first-class domain.** No `commissions` table, commission actions, calculation service, beneficiary/payer model, status lifecycle, or linked commission invoice was found. Some generic expenses/invoices could store a manually entered amount, but that is not a commission engine and provides no auditable calculation basis.

## 17. Deal/business-case logic

Business Cases implement create/list/detail and store company, buyer, supplier, consignee, status, contract reference, amount, currency, and Incoterms. Contracts, finance, logistics, documents, AI queries, and dashboards reference Business Cases. Update/archive, multiple participants, separate purchase/sales sides, multiple contracts, deal products, commission model, expected/actual profit breakdown, and unified history are incomplete or missing.

## 18. Authentication, authorization, and RLS

- Supabase SSR clients are present.
- An application permission matrix exists in `src/lib/platform/permissions.ts`.
- `assertCan` is used by several, but not all, actions.
- Current app role resolution is documented as an admin stub; it is not production authorization.
- Company-scope helpers exist, with incomplete coverage.
- Many tables have RLS enabled, but historical policies grant public CRUD.
- Auth/company-membership hardening exists only as proposal migrations and management designs.
- No service-role use was found in application business paths.

State: **partial and production-blocking**.

## 19. Audit, history, and memory capabilities

### Implemented/partial

- `activity_log`, `timeline_events`, notifications, and helper RPCs.
- `recordEntityEvent` writes activity/timeline/notification records on selected actions.
- Contract history page.
- Shipment and CRM-specific timelines.
- Document versions.
- CRM notes/communications/tasks.
- Repository-level project memory and architecture decisions in `knowledge/Memory/` and `management/DECISIONS.md`.

### Missing

- Guaranteed audit coverage for every material mutation.
- Consistent `before`, `after`, reason, actor, and source fields for all domains.
- First-class histories for commission and complete deal state.
- Searchable corporate knowledge from prior transactions, findings, templates, and decisions.

## 20. Technical debt and architectural risks

| Risk | State | Impact |
| --- | --- | --- |
| Admin role stub | Confirmed | Application permissions are not real authorization |
| Broad public RLS/storage policies | Confirmed in migration history | Cross-tenant and unauthorized data exposure/mutation risk |
| Incomplete multi-company scoping | Confirmed | Data isolation and reporting correctness risk |
| Live migration drift | Confirmed risk | CRM, DMS, contract import, and finance may differ remotely |
| Pre-existing DDL absent | Confirmed | Repository cannot fully reconstruct the database |
| Incomplete master-data CRUD | Confirmed | Incorrect records cannot be safely corrected/archived |
| Missing commission domain | Confirmed | Profit and payable calculations are incomplete |
| Business Case below target Deal model | Confirmed | Purchase/sales/participants/history are fragmented |
| JavaScript-number finance calculations | Confirmed in application format/aggregation | Precision and auditability risk |
| Two payment association paths | Confirmed | Invoice balances can diverge without strict invariants |
| SECURITY DEFINER grants | Confirmed risk | Privilege escalation/mutation risk |
| DMS hotfix chain | Confirmed | Version/column semantics may vary by environment |
| Duplicate timeline/detail patterns | Confirmed | Inconsistent user and audit behavior |
| `/reports` and AI assistant overstatement | Confirmed | Product expectations exceed implementation |
| Limited automated tests | Confirmed | High regression risk across financial/document workflows |
| Dual lockfiles | Confirmed | Non-deterministic dependency workflow |
