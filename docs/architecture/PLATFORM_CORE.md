# SKY ERP — Platform Core Architecture

**Status:** Architecture design (documentation only)  
**Date:** 2026-08-06  
**Authority:** Subordinate to `AGENTS.md`. Code, auth, RLS, and migrations are out of scope for this document.  
**Related:**  
`knowledge/02_SYSTEM_ARCHITECTURE.md` · `docs/architecture/SESSION_COMPANY_CONTEXT.md` · `management/AUTH_SYSTEM.md` · `management/COMPANY_MODEL.md` · `management/ROLE_MODEL.md` · `management/PERMISSION_MATRIX.md` · `management/AUDIT_LOG_MODEL.md` · module audits under `docs/audits/`

This document defines the **Platform Core**: the dependency structure, ownership model, module boundaries, shared libraries, entity lifecycle, and primary business flows that all SKY ERP modules must build on.

**Confirmed** = present in code/migrations today.  
**Planned** = designed target; not fully implemented.

---

## 1. Purpose of Platform Core

Platform Core is the shared foundation that every operational module depends on:

1. **Identity & tenancy** — Authentication, Company, Membership, Roles, Permissions  
2. **Commercial spine** — Business Case → Contract → Shipment / Finance / Warehouse  
3. **Cross-cutting services** — Documents, Audit/Timeline/Activity, Search, AI adapters  
4. **Shared libraries** — validation, permissions helpers, audit fan-out, Supabase clients  

Operational modules (CRM, Warehouse, Finance, Logistics, Documents, AI) **must not** invent parallel auth, ownership, or audit systems.

---

## 2. Stack & runtime layers (Confirmed)

```text
Browser (ERP UI)
  → Next.js App Router
       Server Components (load)
       Server Actions (mutate)
       Route Handlers (large upload / streams)
  → src/lib/<module> domain logic
  → src/lib/platform shared services
  → Supabase (Postgres + Auth SSR + Storage)
  → OpenAI (server only — contract PDF extraction)
```

| Layer | Location |
| --- | --- |
| Routes | `src/app/(erp)/`, `src/app/api/` |
| Feature UI | `src/components/<module>/` |
| Platform UI | `src/components/platform/`, `src/components/layout/` |
| Domain | `src/lib/<module>/` |
| Platform | `src/lib/platform/`, `src/lib/supabase/`, `src/lib/ai/` |
| Schema | `supabase/migrations/` |

**Principles (Confirmed):** server-first · Supabase system of record · thin pages / fat modules · contracts as hub · no `service_role` in Next.js app · OpenAI never from browser.

---

## 3. Module catalog

| # | Module | Canonical code home | Status |
| --- | --- | --- | --- |
| 1 | Authentication | Planned: middleware + session; Confirmed: Supabase SSR cookie client | **Planned** (stub today) |
| 2 | Company | `src/lib/companies*` | Confirmed UI/CRUD; tenancy incomplete |
| 3 | Membership | Planned `company_memberships` | **Planned** |
| 4 | Roles | `public.roles` + `permissions.ts` RoleCode | Confirmed catalog; stub resolution |
| 5 | Permissions | `src/lib/platform/permissions.ts` | Confirmed API; always-admin stub |
| 6 | Business Case | `src/lib/business-cases*` | Confirmed |
| 7 | Contract | `src/lib/contracts*` (+ import/AI) | Confirmed hub |
| 8 | Shipment | `src/lib/logistics*` | Confirmed; company-scope pilot |
| 9 | Finance | `src/lib/finance*` | Confirmed |
| 10 | CRM | `src/lib/crm*` | Confirmed |
| 11 | Warehouse | `src/lib/warehouse*` | Confirmed; company_id gaps |
| 12 | Documents | `src/lib/documents*` | Confirmed DMS |
| 13 | AI | `src/lib/ai/contracts*`, `platform/ai.ts` | Confirmed extract + rule assistant |

Masters used across modules (Confirmed as app dependencies; baseline create migrations may live outside this repo history): **Companies, Counterparties, Products, Contracts, Payments**.

---

## 4. Dependency graph

Lower layers must not import upper business modules. Arrows mean **depends on**.

```text
                    ┌─────────────────────┐
                    │   Authentication    │  (Supabase Auth + session)
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │      Company        │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │    Membership       │  (user × company × role)
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
           Roles         Permissions      Audit / Timeline
              │                │           Activity / Notify
              └────────┬───────┘                │
                       ▼                        │
              ┌─────────────────┐               │
              │ Platform Shared │◄──────────────┘
              │  (session,      │
              │   company-scope,│
              │   entity-bundle,│
              │   search, docs) │
              └────────┬────────┘
                       │
         ┌─────────────┼──────────────────┐
         ▼             ▼                  ▼
   Counterparties   Products         Companies
         │             │                  │
         └──────┬──────┴─────────┬────────┘
                ▼                ▼
         Business Case ◄──── CRM (via counterparty)
                │
                ▼
            Contract  ◄──── Documents (polymorphic + FKs)
           /    |    \
          /     |     \
         ▼      ▼      ▼
   Shipment  Finance  Warehouse
     │         │         │
     └────┬────┴────┬────┘
          ▼         ▼
       Documents   AI (contract import extract)
```

### Layer rules

| Layer | May depend on | Must not depend on |
| --- | --- | --- |
| Auth / Membership / Roles / Permissions | Supabase, Company | Finance, Logistics, CRM UI |
| Platform shared | Auth context, types | Feature UI components |
| Masters (Company, Counterparty, Product) | Platform shared | Contract/Finance internals |
| Business Case | Masters, Platform | Shipment/Finance write paths (read OK via linked) |
| Contract (hub) | BC, Masters, Platform, Documents | Direct OpenAI from UI |
| Shipment / Finance / Warehouse / CRM | Contract and/or Masters, Platform, Documents | Each other’s private RPCs (prefer hub adapters) |
| AI extract | Contracts import pipeline, Documents storage | Browser |

---

## 5. Module graph (runtime surfaces)

```text
src/app/(erp)
  dashboard ──► platform/dashboard
  companies / counterparties / products ──► masters
  business-cases ──► business-cases
  contracts[/id/*] ──► contracts hub adapters
       ├── business-case tab
       ├── documents tab
       ├── finance tab
       ├── logistics tab
       ├── warehouse tab
       └── history tab
  logistics ──► logistics
  finance/* ──► finance
  warehouse ──► warehouse
  crm ──► crm
  documents ──► documents
  ai ──► platform/ai (rules) + contracts/import (OpenAI)
  settings ──► (stub / future membership admin)

src/app/api/contracts/import* ──► contracts/import + ai/contracts
```

**API boundaries**

| Boundary | Mechanism | Use |
| --- | --- | --- |
| Page load | Server Component → `lib/*/db.ts` | Lists, detail, workspace |
| Mutation | Server Action `"use server"` | CRUD, workflow transitions |
| Large binary / stream | Route Handler | Contract PDF import NDJSON |
| Storage | Supabase Storage `documents` bucket | Files; signed URLs server-issued |
| External AI | Server-only OpenAI SDK | PDF extraction; `store: false` |

Modules expose **public domain functions** (`getX`, `createX`, `validateX`) and keep Supabase query details inside the module. Cross-module reads should go through thin adapters (e.g. `contracts/finance.ts`, `contracts/shipments.ts`) rather than importing another module’s private helpers.

---

## 6. Canonical entities

### 6.1 Core tenancy & identity

| Entity | Table (target/confirmed) | Owner key |
| --- | --- | --- |
| User | `auth.users` | self |
| Profile | `user_profiles` | `user_id` |
| Role | `roles` | n/a (catalog) |
| Company | `companies` | self |
| Membership | `company_memberships` **Planned** | `(user_id, company_id)` |

### 6.2 Commercial spine

| Entity | Table | Required FKs / ownership |
| --- | --- | --- |
| Business Case | `business_cases` | `company_id` **required**; buyer/supplier counterparties |
| Contract | `contracts` | `company_id` **required**; optional `business_case_id`; buyer/supplier |
| Contract Product | `contract_products` | `contract_id`; Planned denormalized `company_id` |
| Shipment | `shipments` | `contract_id` **required**; `business_case_id` + `company_id` **required by app** |
| Invoice | `invoices` | `contract_id`; `company_id`; optional BC/shipment/buyer/supplier |
| Invoice Item | `invoice_items` | `invoice_id` |
| Payment | `payments` | `company_id`; optional invoice/contract/BC/bank |
| Payment Allocation | `payment_allocations` | `payment_id`, `invoice_id` |
| Bank Account | `bank_accounts` | `company_id` **required** |
| Expense | `expenses` | `company_id`; optional BC/contract |

### 6.3 Masters & CRM

| Entity | Table | Ownership |
| --- | --- | --- |
| Counterparty | `counterparties` | Planned company scope |
| Product | `products` | Planned company vs shared catalog decision |
| CRM Customer | `crm_customers` | optional `company_id`, `counterparty_id` |
| CRM children | contacts, notes, communications, tasks, timeline, attachments | via customer |

### 6.4 Warehouse

| Entity | Table | Links |
| --- | --- | --- |
| Warehouse Location | `warehouse_locations` | **Missing company_id** (gap) |
| Inventory / Lots | `inventory`, `inventory_lots` | product, location; **company gap** |
| Stock Movement / Transfer / Reservation | movements, transfers, reservations | optional contract/shipment/BC |

### 6.5 Documents & platform logs

| Entity | Table | Links |
| --- | --- | --- |
| Document | `documents` | polymorphic `entity_type/entity_id` + typed FKs; `company_id` |
| Document Version | `document_versions` | `document_id` |
| Timeline / Activity / Notification | platform tables | entity-centric; Planned `company_id` |
| Audit Event | `audit_events` **Planned** | security/compliance log |
| Contract Import | `contract_imports` | PDF pipeline; Planned `company_id` |

### 6.6 Reference

Currencies, exchange rates, expense categories, roles — global/reference (not tenant business rows), with write restricted by permission.

---

## 7. Ownership graph

```text
                    Company
                       │
       ┌───────────────┼───────────────────────────────┐
       ▼               ▼                               ▼
 Membership      Business Case                    Bank Account
 (user×role)           │                               │
                       ▼                               │
                   Contract ◄──────────────────────────┤
                  /    |    \                          │
                 /     |     \                         │
                ▼      ▼      ▼                        ▼
           Shipment  Invoice  Warehouse ops      Payment ──► Allocation ──► Invoice
              │         │
              │         ▼
              │      (optional) Expense
              ▼
         Documents (stamp company from parent)
              │
              ▼
         Storage object (path under entity; future: company prefix)
```

**Ownership rules (target — see SESSION_COMPANY_CONTEXT):**

1. Every business row belongs to exactly one `company_id`.  
2. Children inherit company from parent **and** store denormalized `company_id` for RLS.  
3. Inserts stamp company from **session**, never from client trust.  
4. Updates must not move a row across companies.  
5. Platform Admin cross-company access is a separate verified permission + audit — not legacy `admin` stub.

---

## 8. Foreign-key map (spine)

```text
companies 1──* business_cases
companies 1──* contracts                 (Confirmed in app; baseline DDL may be external)
companies 1──* shipments                 (via column; backfill from contract)
companies 1──* invoices / payments / bank_accounts / expenses
companies 1──* crm_customers             (nullable today)
companies 1──* documents                 (nullable/optional stamp)

business_cases 1──* contracts            (contracts.business_case_id)
business_cases 1──* shipments            (optional)
business_cases 1──* invoices / payments / expenses

contracts 1──* shipments                 (required)
contracts 1──* invoices                  (required on hub create)
contracts 1──* contract_products
contracts 1──* stock_movements / reservations (optional)

shipments 1──* invoice (optional link)
shipments 1──* stock_movements (optional)
shipments 1──* shipment_timeline_events

invoices 1──* invoice_items
invoices 1──* payment_allocations
payments 1──* payment_allocations
payments *──1 bank_accounts (optional)

documents *──? business_cases | contracts | shipments | invoices | payments | companies | counterparties | products
document_versions *──1 documents

crm_customers *──? counterparties
crm_* *──1 crm_customers

inventory *──1 warehouse_locations
inventory *──1 products
inventory_lots *──1 inventory
```

---

## 9. Module boundaries

| Module | Owns | May call | Must not |
| --- | --- | --- | --- |
| Authentication | Session, login/logout | Supabase Auth | Business writes |
| Company | Company master CRUD | Platform audit | Define memberships alone without Membership module |
| Membership | user↔company↔role | Roles, Company | Bypass in feature modules |
| Roles / Permissions | Catalog + grant checks | Profile/membership | Hardcode company IDs |
| Business Case | BC lifecycle | Masters, Documents, Platform | Create shipments/invoices directly (prefer Contract hub) |
| Contract | Commercial hub + import confirm | BC, Masters, Documents, AI extract (server) | Call OpenAI from client |
| Shipment | Logistics execution | Contract, BC, Documents, Platform | Own payments |
| Finance | Invoices, payments, banks, FX, expenses, reports | Contract, BC, Documents | Execute real bank transfers |
| CRM | Customer 360 | Counterparty, Company, Documents | Duplicate contract master |
| Warehouse | Inventory truth | Product, Contract/Shipment links | Finance postings |
| Documents | DMS upload/version/sign | All entity types for attach | Trust path-only unsigned access |
| AI | Extract + match; rule assistant | Import pipeline / read models | Persist AI output as truth without human confirm |

---

## 10. Shared libraries (Platform)

| Library | Path | Responsibility |
| --- | --- | --- |
| Supabase clients | `src/lib/supabase/*` | Browser + server SSR; env validation |
| Permissions | `src/lib/platform/permissions.ts` | `can` / `assertCan` (target: session role) |
| Company scope | `src/lib/platform/company-scope.ts` | Active company (target: session; today env stub) |
| Logistics auth adapter | `src/lib/logistics/auth.ts` | Module-facing read/write company checks |
| Audit fan-out | `src/lib/platform/audit.ts` | `recordEntityEvent` → timeline + activity + notify |
| Activity / Timeline / Notifications | `platform/activity*`, `timeline*`, `notifications*` | UX logs + alerts |
| Entity workspace | `platform/entity-bundle.ts`, `linked.ts` | Detail shell data |
| Search | `platform/search.ts` | Global search (target: company-scoped) |
| Documents (platform) | `platform/documents*` | Shared document reads where used |
| Types | `platform/types.ts` | `EntityType`, tabs, RoleCode |
| Errors | `platform/supabase-errors.ts` | Safe error serialization |
| AI contracts | `src/lib/ai/contracts/*` | OpenAI extract schema/prompt/client |
| Validators (pattern) | `*/validation.ts`, `logistics/validators.ts`, `finance/validation.ts` | Pure input rules |

### Reusable validation (design)

| Concern | Shared pattern |
| --- | --- |
| Required ownership triad | company + parent FK + status enum |
| Date order | `validateDateOrder(earlier, later, labels)` |
| Money | decimal-safe round helpers (finance) |
| ISO currency | allowlist + normalize |
| Status transitions | explicit allow-maps (shipments today; extend to invoice/payment) |
| Document file | mime/size/name sanitize |

Prefer **pure functions** in `validators.ts` + thin `validation.ts` composers; keep DB uniqueness checks in actions.

### Reusable permissions (design)

```text
requireSessionContext()
requirePermission("logistics.write")
requireCompany() → uuid
assertRecordCompany(row.company_id)
stampCompanyOnInsert()  // ignores client company_id
```

Domain modules call these instead of reading env or trusting form fields.

### Reusable audit logging (design)

| Channel | Purpose |
| --- | --- |
| `recordEntityEvent` | UX timeline + activity + optional notification (Confirmed) |
| `audit_events` **Planned** | Immutable security log: login, logout, company.switch, sensitive mutates |
| Module timelines | e.g. `shipment_timeline_events` for operational tracking |

Mutating Server Actions should: permission check → validate → write → `recordEntityEvent` → (Planned) `audit_events`.

---

## 11. Entity lifecycle

Generic lifecycle for company-scoped business entities:

```text
1. Authorize
   requireSession + requirePermission + requireCompany
2. Validate
   pure validators (shape, dates, transitions)
3. Resolve ownership
   stamp company from session
   verify parent FKs belong to same company
4. Persist
   insert/update in one logical unit (RPC when multi-table atomicity needed)
5. Side effects
   allocations, balance refresh, stock RPC, storage upload
6. Record
   timeline / activity / notification / Planned audit_events
7. Revalidate
   Next.js paths for list + detail + hub tabs
```

### State examples

| Entity | Typical states |
| --- | --- |
| Business Case | draft → active → closed/cancelled (module-defined) |
| Contract | workflow steps in `contracts/workflow` |
| Shipment | Planned → In Transit → Delivered; Delayed side-state; Delivered terminal |
| Invoice | Draft → Issued → Partially Paid → Paid; Cancelled; Overdue derived |
| Payment | Pending → Paid → Cancelled |
| Document | current version flag; replace version creates new row |
| Contract Import | uploaded → extracting → review → confirmed / failed |

**Hard rules:** no silent overwrite of historical financial amounts; no cascade-delete of parents because a child upload failed; AI output is suggestion until human confirm.

---

## 12. Request flow

```text
Browser
  → (Planned) middleware: Auth → Membership → Active Company → Role
  → Server Component / Server Action / Route Handler
  → Domain loader or action
  → Platform permission + company helpers
  → Supabase query (filter company_id)
  → (Planned) RLS membership check
  → Map to DTO / UI model
  → (mutations) audit fan-out + revalidatePath
  → Response
```

---

## 13. Security flow

```text
Authenticated user
  → session (Supabase Auth cookies)
  → verified company_memberships row
  → selected active company (httpOnly cookie; re-verified every request)
  → role_code + expanded permissions
  → Server Action: requirePermission + stampCompanyOnInsert
  → Query: company_id = activeCompanyId
  → RLS: row visible only if membership (or verified platform_admin)
  → audit_events for authz-sensitive actions
```

**Fail closed** when session or company context is missing.  
**Prohibit:** client-trusted `company_id`, env identity in production, unrestricted admin stub, Platform Admin bypass without verified permission.

Detail: `docs/architecture/SESSION_COMPANY_CONTEXT.md`.

---

## 14. Document flow

```text
User selects entity (contract | shipment | invoice | …)
  → uploadDocument Server Action
       assertCan(documents.write)
       validate type/file
       resolve relations (shipment stamps company/contract/BC from parent)
       storage.upload → documents bucket
       insert documents (+ document_versions best-effort)
       recordEntityEvent
  → EntityWorkspace / Documents library lists entity docs
  → getDocumentSignedUrls / getSignedUrlForPath
       only for registered document rows
       (Planned) membership company check before sign
  → preview / download → optional download audit
```

Document types of note: packing list, commercial invoice, bill of lading, certificates, contract PDF, CRM attachments.

---

## 15. Payment flow

```text
Invoice (company + contract [+ BC])
  → createInvoice (validate, ownership, round money, items)
  → registerPayment
       assert finance.write + company match
       currency match, amount ≤ outstanding
       bank account same company
       RPC finance_register_payment (atomic):
         payment + allocation + optional bank txn + refresh_invoice_balances
  → recordEntityEvent (payment + fanout invoice/contract/BC)
  → Reports read outstanding / cash movement (read-only; multi-currency caveats)
```

**Gaps to respect:** `payments.business_case_id` migration may be unapplied; DEFINER RPC grants to `anon` are a known risk; no real bank execution.

---

## 16. Shipment flow

```text
Contract (company + business_case)
  → createShipment / updateShipment
       logistics permission + company bind
       require company + contract + business_case
       validate schedule, routing, status transitions
       company-scoped duplicate BL / active container
       insert/update shipments
       shipment_timeline_events + recordEntityEvent
  → list/detail company-filtered (when scope active)
  → documents attach (packing list, BL scan, certificates)
  → optional warehouse movements / finance invoice link by shipment_id
```

---

## 17. AI integration flow

```text
Operator uploads contract PDF
  → Route Handler /api/contracts/import (stream progress)
  → store PDF in Storage + contract_imports row
  → src/lib/ai/contracts/extract.ts
       OpenAI Files + Responses structured parse (Zod schema)
       store: false; delete temp remote file
  → match masters (company, counterparties, products)
  → human review UI
  → confirm Server Action
       create/link counterparties/products/contract as approved
       attach original PDF as document
       never auto-post finance/shipments from AI alone
```

Separate path: `/ai` rule-based assistant (`platform/ai.ts`) queries ERP data with keywords — **not** OpenAI chat.

---

## 18. Entity lifecycle × module matrix

| Stage | Auth | Company | BC | Contract | Shipment | Finance | CRM | WH | Docs | AI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Create | session | master | owned | hub | from contract | invoice/pay | customer | move/lot | upload | extract draft |
| Read | membership | scoped | scoped | hub tabs | scoped | scoped | scoped | scoped | signed | review |
| Update | perm | restricted | status | workflow | transitions | limited | profile | ops | version | reextract |
| Close/Cancel | perm | n/a | close | cancel | Delivered terminal | cancel/void Planned | archive Planned | n/a | retain | discard draft |
| Audit | login | switch | events | events | events | events | events | events | upload/dl | confirm |

---

## 19. Implementation posture (no code in this task)

| Area | Current | Platform Core target |
| --- | --- | --- |
| Auth | None / SSR client only | Middleware + session |
| Membership | Missing table | `company_memberships` |
| Permissions | Always admin | Membership role grants |
| Company scope | Env stub (logistics pilot) | Session fail-closed everywhere |
| RLS | Open / public true | Membership policies after auth |
| Audit | UX fan-out | + immutable `audit_events` |
| Warehouse company_id | Missing | Additive migrations |
| Masters DDL | Partially external | Inventory + ensure migrations |

**Batch order** aligns with `SESSION_COMPANY_CONTEXT.md` Batches A–G: ownership columns → memberships → auth middleware → company switcher → module cutover (Logistics → Finance → others) → RLS → audit.

---

## 20. Document control

| Item | Value |
| --- | --- |
| Type | Platform Core architecture |
| Code / migration changes | **None** |
| Commit / push | **Not performed** |
| Canonical companions | `knowledge/02_SYSTEM_ARCHITECTURE.md`, `SESSION_COMPANY_CONTEXT.md`, `management/*` |

---

## Appendix A — ERP route map (Confirmed)

`/dashboard` · `/crm` · `/companies` · `/counterparties` · `/products` · `/business-cases` · `/contracts` (+ nested hub) · `/warehouse` · `/logistics` · `/finance/*` · `/documents` · `/reports` · `/ai` · `/settings`

## Appendix B — Migration anchors (Confirmed filenames)

Business cases `…130000` · Contract hub `…140000` · Logistics `…150000`/`…160000` · Warehouse `…170000` · Finance `…180000` · Platform `…190000` · DMS `…200000`–`…220000` · PDF import `…230000` · CRM `…050200`/`…050300` · Proposals auth/RLS/TTL `…050600`–`…050800` · Finance indexes `…050900` · Logistics ownership `…051000`
