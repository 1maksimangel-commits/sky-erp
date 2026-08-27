# SKY ERP — Business Engine Architecture

**Status:** Architecture design (documentation only)  
**Date:** 2026-08-06  
**Authority:** Subordinate to `AGENTS.md`.  
**Parents:** `docs/architecture/PLATFORM_CORE.md`, `docs/architecture/SESSION_COMPANY_CONTEXT.md`  
**Related:** `knowledge/04_BUSINESS_CONTEXT.md`, `management/ROLE_MODEL.md`, `management/PERMISSION_MATRIX.md`, `management/AUDIT_LOG_MODEL.md`

This document defines the **Business Engine**: the commercial operating model of SKY ERP with the **Business Case as the central object**. All operational modules hang off the Business Case through Contracts and downward execution chains.

**Confirmed** = present in code/schema today.  
**Planned** = Business Engine target (not fully implemented).

**This task does not modify code, migrations, or git history.**

---

## 1. Thesis

```text
Business Case
     ↓
 Contracts
     ↓
 Shipments
     ↓
 Warehouse
     ↓
 Finance
     ↓
 CRM
     ↓
 Documents
     ↓
 AI
```

| Statement | Meaning |
| --- | --- |
| Business Case is the spine | One trading deal / commercial case owns the P&L narrative |
| Contract is the legal instrument | One or more contracts execute a case (purchase, sale, service) |
| Downstream is execution | Shipments, warehouse, finance, CRM activity, documents, AI assist the case |
| Company is the tenant | Every Business Case belongs to exactly one company |
| Platform Core is infrastructure | Auth, membership, permissions, audit, DMS — not the commercial center |

**Shift from Platform Core wording:** Platform Core correctly treats Contract as a **technical hub** (many FKs point at `contract_id`). Business Engine asserts that **product meaning** centers on Business Case; Contract is the first-class child that carries legal force.

---

## 2. Current state vs target

| Area | Confirmed today | Business Engine target |
| --- | --- | --- |
| BC entity | `business_cases` with company, buyer, supplier, status, amounts | Richer lifecycle + required ownership |
| Contract link | `contracts.business_case_id` (optional in practice) | **Required** for operational contracts |
| Shipment link | `shipments.business_case_id` (app-required in logistics P0) | Always inherited from contract/case |
| Invoice / payment | Optional `business_case_id` | Always stamped from contract/case |
| Warehouse | Optional BC on movements | Movements attributable to case when from contract/shipment |
| CRM | Linked via counterparty, not BC FK | Case events fan out to buyer/supplier CRM timelines |
| Documents | Attach to BC entity type | Case dossier + generated packs |
| AI | PDF → contract import; rule `/ai` | Case-aware assistant + import into case |
| Profit | Columns on BC; finance reports aggregate | Case P&L as system of record for deal margin |
| Permissions | Stub admin | Case-scoped actions via company membership roles |

---

## 3. Engine graph

```text
                         ┌──────── Company ────────┐
                         │                         │
                         ▼                         │
                  Business Case ◄── Membership/Role │
                   /    |    \                     │
                  /     |     \                    │
                 ▼      ▼      ▼                   │
            Purchase  Sale   Other                 │
            Contract  Contract Contract            │
                 \      |      /                   │
                  \     |     /                    │
                   ▼    ▼    ▼                     │
                    Shipments ─────────────────────┤
                        │                          │
            ┌───────────┼───────────┐              │
            ▼           ▼           ▼              │
        Warehouse    Finance      Documents        │
         (lots)    (inv/pay)     (dossier)         │
            │           │           │              │
            └───────────┼───────────┘              │
                        ▼                          │
                 Case P&L / Timeline               │
                        │                          │
            ┌───────────┼───────────┐              │
            ▼           ▼           ▼              │
           CRM      Notifications      AI          │
     (buyer/supplier   (case events)  (import &    │
       timelines)                      assist)     │
                         └─────────────────────────┘
```

---

## 4. Canonical Business Case model

### 4.1 Identity

| Field | Role |
| --- | --- |
| `id` | Stable UUID |
| `case_number` / `number` | Human-unique within company (**Planned** uniqueness per company; today global-ish) |
| `title` | Commercial label |
| `case_type` | e.g. Trading / Export / Import (**Confirmed** in app types) |
| `company_id` | **Required** tenant owner |
| `buyer_id` / `supplier_id` / `consignee_id` | Counterparty roles |
| `currency` | Case reporting currency |
| Commercial snapshot | amounts, incoterms, ports, ETD/ETA (**Confirmed** columns vary by migration vs app) |
| Profit fields | `purchase_amount`, `sale_amount`, `gross_profit`, `net_profit` (**Confirmed** in base migration) |

### 4.2 Ownership

| Rule | Detail |
| --- | --- |
| Tenant | `company_id` from session (never client-trusted) |
| Parties | Buyer/supplier/consignee must be counterparties visible to that company (**Planned** enforcement) |
| Children | Contract, shipment, invoice, payment, expense, document, warehouse movement must share the same `company_id` and resolve `business_case_id` |
| No orphan execution | Creating shipment/invoice/payment without a Business Case is **forbidden** in the Engine target (Logistics/Finance P0 already push this) |
| Multi-contract | A case may have multiple contracts (purchase + sale); all share `business_case_id` |

### 4.3 Permissions (target)

| Action | Suggested permission | Typical roles |
| --- | --- | --- |
| View case | `business_cases.read` | All internal company roles with commercial access |
| Create / edit draft | `business_cases.write` | sales_manager, commercial_director, operator |
| Activate case | `business_cases.activate` | commercial_director, company_owner |
| Close / cancel | `business_cases.close` | commercial_director, general_director |
| Generate contract from case | `contracts.write` + case write | sales / purchasing managers |
| Generate shipment | `logistics.write` | logistics_manager |
| Generate invoice/payment | `finance.write` | finance_manager, accountant |
| AI assist on case | `ai.assist` or documents/contracts read | per matrix |
| Cross-company | `platform_admin` only | audited |

All checks run under Platform Core session context (`SESSION_COMPANY_CONTEXT.md`).

---

## 5. Status model

### 5.1 Business Case statuses (target)

| Status | Meaning | Allowed next |
| --- | --- | --- |
| `Draft` | Case being prepared; no operational execution | `Active`, `Cancelled` |
| `Active` | Live deal; contracts/shipments/finance allowed | `On Hold`, `Completed`, `Cancelled` |
| `On Hold` | Temporarily blocked | `Active`, `Cancelled` |
| `Completed` | Commercial + logistics + finance settled | — (terminal; reopen only via controlled admin) |
| `Cancelled` | Abandoned; no new execution | — (terminal) |

**Confirmed today:** free-text/default `Draft`; stats treat “active” loosely. Engine requires an explicit allow-map (same pattern as shipment transitions).

### 5.2 Derived health (not stored status)

| Signal | Source |
| --- | --- |
| Awaiting contract | Active case, zero contracts |
| In transit | Any shipment `In Transit` / `Delayed` |
| Delivered pending finance | Shipments delivered; invoices outstanding |
| Overdue AR/AP | Finance outstanding past due |
| Margin risk | Expected vs actual profit variance (**Planned** calc) |

### 5.3 Child status alignment

| Child | Constraint vs case |
| --- | --- |
| Contract | Cannot create on `Cancelled` / `Completed` case |
| Shipment | Requires `Active` (or `On Hold` only for updates, not new) |
| Invoice | Prefer `Active` or `Completed` (final billing) |
| Payment | Allowed while invoices open; blocked on `Cancelled` unless reversing |
| Warehouse issue/receipt | Tied to active shipment/contract under case |

---

## 6. Lifecycle

```text
[Create Draft]
  company + case_number + parties + currency
  → audit: business_case.created
  → CRM timeline: “Case opened” on buyer/supplier (Planned)

[Enrich]
  products intent, ports, incoterms, expected purchase/sale
  → documents: offer, spec, correspondence
  → AI: optional draft from email/PDF (Planned) / contract import into case

[Activate]
  require company, buyer or supplier, currency
  → status Active
  → audit: business_case.activated

[Contract generation]
  create purchase and/or sale contract with business_case_id + company_id
  → optional PDF import confirm attaches under case + contract
  → audit + case timeline fan-out

[Shipment generation]
  from contract (inherits case + company)
  → logistics validation (vessel, ports, ETD/ETA, …)
  → case timeline: shipment_planned / delayed / arrived

[Warehouse execution]
  receive / reserve / ship against contract/shipment
  → stock movements carry business_case_id when known
  → case timeline: inventory events (Planned summary)

[Finance generation]
  sales/purchase invoices with business_case_id
  → payments via RPC; allocations refresh balances
  → case P&L refresh (Planned job/RPC; no silent rewrite of posted history)

[CRM continuum]
  every major case event mirrors to counterparty CRM timeline
  → tasks/comms remain on CRM customer; linked back to case

[Complete]
  gates: no open shipments (non-terminal), invoices settled or waived, docs archived
  → status Completed
  → audit: business_case.completed

[Cancel]
  gates: no irreversible posted finance without reversal path
  → status Cancelled; block new children
```

### Lifecycle invariants

1. `company_id` immutable after create.  
2. `business_case_id` on children immutable (no moving deals across cases without controlled split).  
3. Historical finance amounts are not silently recalculated.  
4. AI never activates a case or posts payments without human confirmation.

---

## 7. Audit

### 7.1 Channels

| Channel | Use for Business Engine |
| --- | --- |
| Platform timeline (`timeline_events`) | Case story in EntityWorkspace (**Confirmed** via `recordEntityEvent`) |
| Activity log | Change feed |
| Notifications | Case activated, shipment delayed, payment received |
| Child timelines | `shipment_timeline_events`, CRM timeline |
| `audit_events` **Planned** | Security: activate/close, permission denials, company switch while editing case |

### 7.2 Required case-level events (target catalog)

| Event | When |
| --- | --- |
| `business_case.created` | Insert |
| `business_case.updated` | Material field change |
| `business_case.activated` / `on_hold` / `completed` / `cancelled` | Status transitions |
| `business_case.contract_linked` | Contract created/linked |
| `business_case.shipment_planned` | Shipment create |
| `business_case.shipment_delayed` | Logistics delay |
| `business_case.invoice_issued` | Invoice non-draft |
| `business_case.payment_received` | Payment registered |
| `business_case.document_added` | DMS upload to case |
| `business_case.ai_import_confirmed` | Human confirm of AI contract extract |

Fan-out: when a child event fires, write on the child **and** fan out to the Business Case timeline (pattern already used in finance/logistics `recordEntityEvent` fanout).

---

## 8. Document generation

### 8.1 Case dossier (target)

| Pack | Typical contents | Trigger |
| --- | --- | --- |
| Commercial | Offer, sale contract PDF, purchase contract PDF | Contract confirm / upload |
| Logistics | Booking, BL, packing list, COO, veterinary | Shipment milestones |
| Finance | Commercial invoice, proforma, payment advice | Invoice/payment |
| Compliance | Licenses, certificates | Manual / AI-classify upload |

### 8.2 Generation vs attachment

| Mode | Rule |
| --- | --- |
| Upload (Confirmed) | DMS `entity_type=business_case` or child entity with `business_case_id` stamped |
| Generate (**Planned**) | Server-side templates produce PDF → store as document version → link to case + child |
| AI extract (Confirmed for contracts) | Produces structured draft; human confirm creates contract + attaches source PDF under case |

**Ownership:** every document row gets `company_id` + `business_case_id` when known (shipment upload path already stamps company; extend to all generators).

---

## 9. Shipment generation

```text
Active Business Case
  → Contract (same company + business_case_id)
  → createShipment
       stamp company_id, business_case_id from contract
       validate logistics rules
       timeline on shipment + fanout case
  → optional packing list / BL documents on shipment (visible in case dossier)
```

**Engine rules:**

- No shipment without contract.  
- No contract without business case (target).  
- Status leaving `Planned` requires vessel, voyage, ports, ETD/ETA (Confirmed logistics validation).  
- Case status must be `Active` to create new shipments.

---

## 10. Payment generation

```text
Active/Completed Business Case
  → Invoice (sales or purchase) with business_case_id
  → registerPayment
       company match, currency match, outstanding check
       RPC: payment + allocation + balances
       payment.business_case_id from invoice
  → fanout timeline to invoice, contract, business case
  → Planned: refresh case actual profit (read model; do not rewrite invoice history)
```

**Engine rules:**

- Payments inherit case from invoice/contract.  
- Case `Cancelled` blocks new payments except documented reversals.  
- Reports that show “profit by business case” are Engine read models; methodology documented in Finance stabilization audit.

---

## 11. CRM timeline integration

### 11.1 Linkage model

| Link | Mechanism |
| --- | --- |
| Case → buyer/supplier | `business_cases.buyer_id` / `supplier_id` |
| CRM customer → counterparty | `crm_customers.counterparty_id` (**Confirmed**) |
| Contracts → CRM | Match buyer/supplier to CRM customer (**Confirmed** in linked/search patterns) |

### 11.2 Target event mirroring

When a case-level event occurs, if a CRM customer exists for the buyer or supplier counterparty:

```text
recordEntityEvent(business_case, ...)
  → also CRM timeline entry:
       “Business Case BC-2026-041 activated”
       href → /business-cases/{id}
```

Comms and tasks stay CRM-native but should allow `related_business_case_id` (**Planned** column or metadata) for filtering “all activity for this deal.”

### 11.3 What not to do

- Do not duplicate the full case dossier into CRM attachments by default.  
- Do not make CRM the system of record for contracts or invoices.

---

## 12. AI assistant integration

### 12.1 Confirmed capabilities

| Capability | Path | Engine use |
| --- | --- | --- |
| Contract PDF extract | `/api/contracts/import` + `src/lib/ai/contracts` | On confirm, contract **must** attach `business_case_id` (create or select case) |
| Rule-based `/ai` | `platform/ai.ts` | Extend intents: “cases for buyer X”, “open shipments for case” |

### 12.2 Target case-aware assistant

```text
User (in case workspace or /ai with case context)
  → assistant receives { companyId, businessCaseId, role }
  → may READ company-scoped summaries: contracts, shipments, invoices, docs metadata
  → may SUGGEST drafts: shipment fields, email replies, checklist
  → may NOT write finance/logistics without explicit Server Action + permission
  → contract PDF extract remains human-confirm pipeline
```

**Safety (AGENTS):** no browser OpenAI keys; no `store: true` persistence of sensitive files; fictional/demo data rules for tests; never auto-post payments.

### 12.3 AI → Engine write boundary

| Allowed after human confirm | Forbidden autonomous |
| --- | --- |
| Create/link contract under case | Activate/complete case |
| Attach source PDF | Register payment |
| Create missing counterparty/product (existing import pattern) | Bypass company membership |

---

## 13. Case workspace (product surface)

Target Business Case detail is the **primary cockpit** (extends Confirmed `EntityWorkspace` on `/business-cases/[id]`):

| Tab / panel | Content |
| --- | --- |
| Overview | Parties, status, currency, expected vs actual margin |
| Contracts | All contracts for case; generate purchase/sale |
| Shipments | Timeline of containers/BL; generate shipment |
| Warehouse | Lots/movements attributable to case |
| Finance | Invoices, payments, outstanding, case P&L |
| CRM | Buyer/supplier activity strip |
| Documents | Full dossier |
| AI | Case-scoped assist + import entry |
| Timeline / Activity | Unified Engine events |

Contract hub tabs remain for legal/execution depth; they always show parent case and deep-link back.

---

## 14. Data stamping rules (implementation contract)

When creating a child of the Engine:

```text
company_id        := session.activeCompanyId
business_case_id  := explicit case OR parent.contract.business_case_id
contract_id       := required for shipment/invoice (as today)
```

Reject if:

- parent company ≠ session company  
- parent business case ≠ intended case  
- case status forbids the action  

Never accept client `company_id` / foreign `business_case_id` as authority.

---

## 15. Profitability (Engine read model)

| Metric | Definition (target) |
| --- | --- |
| Expected revenue | Sale contract / case sale snapshot |
| Expected cost | Purchase + planned freight/commission |
| Actual revenue | Posted sales invoices (case-scoped) |
| Actual cost | Purchase invoices + expenses + allocated logistics costs |
| Gross / net profit | Case fields + recomputed read model |
| Margin % | profit / revenue |

**Rules:** document formula in Finance module; decimal-safe math; multi-currency convert only with dated FX; do not overwrite posted invoice lines when refreshing case totals.

---

## 16. Request flows (Engine-centric)

### 16.1 Create deal

```text
Session → company
  → create Business Case (Draft)
  → activate
  → generate Contract(s)
  → (optional) AI PDF import confirm → same case
  → generate Shipment(s)
  → warehouse ops
  → invoices → payments
  → complete case
```

### 16.2 Security flow (Engine)

```text
Auth → membership → active company → permission
  → load Business Case (company match)
  → authorize child action
  → stamp case + company
  → RLS (Planned)
  → audit + timeline fan-out
```

---

## 17. Migration / gap backlog (design only — do not apply here)

| Gap | Why it matters to Engine |
| --- | --- |
| Enforce `contracts.business_case_id` NOT NULL (after backfill) | Prevent orphan contracts |
| Warehouse `company_id` | Case-safe inventory |
| Payment `business_case_id` column applied | Finance RPC alignment |
| Case status allow-map in validation | Lifecycle integrity |
| CRM `related_business_case_id` or metadata | Timeline filtering |
| Case P&L refresh RPC | Single read model |
| Session company context | Fail-closed tenancy |

---

## 18. Implementation batches (future)

| Batch | Scope |
| --- | --- |
| BE-1 | Case status transitions + validation; require company |
| BE-2 | Contract create requires `business_case_id`; hub UI generate-from-case |
| BE-3 | Unify stamping on shipment/invoice/payment/expense |
| BE-4 | Case cockpit tabs (contracts/shipments/finance/docs) |
| BE-5 | CRM timeline fan-out |
| BE-6 | Document pack checklist on case |
| BE-7 | Case-aware AI intents + import always selects case |
| BE-8 | Case P&L read model |

Each batch requires human approval; auth/RLS batches remain gated by `SESSION_COMPANY_CONTEXT.md`.

---

## 19. Explicit non-goals

- Replacing Contract as legal document entity  
- Making CRM the commercial spine  
- Autonomous AI posting of finance or logistics  
- Real-time bank payment execution  
- Editing applied migrations in place  

---

## 20. Document control

| Item | Value |
| --- | --- |
| Type | Business Engine architecture |
| Central object | **Business Case** |
| Code / migration / commit | **None** |
| Supersedes | Informal “contract-only hub” product narrative (technical FK hub remains) |
| Read with | `PLATFORM_CORE.md`, `SESSION_COMPANY_CONTEXT.md` |
