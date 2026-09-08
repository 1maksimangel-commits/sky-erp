# SKY ERP — Master Product Plan

## 1. Product definition

SKY ERP is a deal-centric operating system for international seafood trading. It must connect commercial, document, logistics, warehouse, finance, commission, history, and knowledge data without silently changing business records.

The plan extends the existing product. It does not authorize a rewrite, remote migration, authentication change, or new dependency.

## 2. Architectural direction

```text
Deal / Transaction
  -> Participants and roles
  -> Products and quantities
  -> Purchase side -> purchase contracts and payables
  -> Sales side -> sales contracts and receivables
  -> Documents and versions
  -> Shipments / logistics / warehouse references
  -> Expenses and commissions
  -> Payments
  -> Expected profit / actual profit
  -> Validation findings
  -> Timeline / audit / reusable knowledge
```

Reuse Business Case as the migration path to the canonical Deal aggregate. Do not create a parallel Deal architecture until a reviewed schema plan establishes how existing Business Cases and links are preserved.

## 3. Core product capabilities

### 3.1 Deal / Transaction Engine

The Deal is the canonical aggregate and must connect:

- legal entities and participants with explicit roles;
- products, units, quantities, weights, prices, and currencies;
- purchase and sales sides;
- contracts and annexes;
- documents and validations;
- shipments, containers, ports, and warehouse references;
- receivables, payables, payments, and expenses;
- commissions;
- expected and actual profit;
- complete history and audit.

Rules:

- No participant role is inferred from a global company type when the role is deal-specific.
- No currency values are combined without an explicit reporting currency, rate, rate date, and source.
- Posted financial/stock/history events are corrected through auditable reversals or superseding records, not silent overwrite.

### 3.2 Contract Engine

Extend the current Contract Hub to support:

- purchase and sales contract classification;
- multiple contracts per Deal;
- commercial terms and product lines;
- amendments/annexes that supersede defined terms without overwriting originals;
- completeness rules by transaction type;
- links to parties, documents, shipments, payments, expenses, commissions, and Deal;
- comparison of invoices, packing lists, B/Ls, certificates, and commission invoices with applicable contract terms.

Preserve the current AI PDF import and human-review invariant.

### 3.3 Document Center

Document semantic states:

`Original -> Parsed -> Verified -> Generated -> Revised -> Signed -> Archived`

These are not necessarily a single linear status: a document needs immutable origin/version records plus validation and approval state. An original upload is immutable. Generated, corrected, stamped, or signed output creates a new linked version/derivative.

Initial types: Contract, Annex, Invoice, Packing List, Bill of Lading, Certificate, Commission Invoice, Letter. The type model must be extensible without adding one table per type.

### 3.4 AI Document Verification

AI produces reviewable findings, not silent business mutations. Verification compares a document with:

- Deal data;
- applicable contract and annexes;
- related documents and earlier versions;
- comparable historical transactions where explicitly retrieved.

Structured checks include seller, buyer, producer, consignee, notify party, product/species/size, quantity, net/gross weight, price, currency, Incoterms, ports, payment terms, dates, bank details, commission, references, signatures/seals, and cross-document inconsistency.

Every finding needs field, expected value, observed value, severity, source references, confidence, model/rule version, status, reviewer, and resolution. The AI does not certify legal validity or authenticity.

### 3.5 Template Center

Reusable templates are scoped by company, counterparty, document type, and transaction type. Templates must be versioned and human-approved. Generation maps reviewed Deal data to a template and creates a new Generated document; it never overwrites a source or template version.

Word/PDF generation should be implemented only after the template data model and document version invariants are stable.

### 3.6 Original and Version History

Each document/version stores:

- immutable storage object/path and checksum;
- version and source (`upload`, `parse`, `generate`, `revise`, `sign`, `import`);
- creator and creation time;
- `supersedes` and root/original relation;
- change reason;
- validation result reference;
- approval state and actor.

Deleting a business document means archival/retention handling, not loss of the original audit chain.

### 3.7 Commission Engine

Supported methods:

- amount per MT;
- amount per kg;
- fixed amount;
- percentage;
- per unit;
- manual calculation.

Store Deal, beneficiary, payer, method, currency, calculation base/quantity/unit/rate, expected commission, actual commission, payment status, linked payable/payment, and commission invoice. Manual calculations require a reason. Expected and actual values remain distinct.

### 3.8 Finance

Deal finance must expose purchase value, sales value, logistics, insurance, bank charges, commissions, other expenses, payments, receivables, payables, expected profit, and actual profit.

Financial calculation requirements:

- decimal-safe arithmetic;
- original currency retained for every amount;
- explicit conversion into a selected Deal/reporting currency;
- stored/traceable FX rate, date, and source;
- formula breakdown visible to the user;
- no deletion or silent rewrite of posted events.

### 3.9 Memory and History

Deal, company, contract, document, payment, shipment, and commission each need a unified chronological view. Material events must reference their source entity and audit event. Domain-specific timelines may feed the unified history but must not create contradictory history systems.

### 3.10 Knowledge

Corporate knowledge is structured, permission-aware reuse of:

- past Deals and outcomes;
- contracts and commercial terms;
- document validations and resolutions;
- approved decisions and reasons;
- templates and versions;
- recurring counterparties, products, routes, commissions, and terms.

Knowledge retrieval must return evidence links and respect company/data access. Raw documents must not be indiscriminately copied into a second store.

### 3.11 AI Assistant

The assistant should answer operational questions using authorized read tools and evidence:

- transactions with a counterparty;
- previously used commission method/rate;
- similar contracts and terms;
- missing documents and discrepancies;
- precedent selection for a new document.

Writes remain proposals requiring human review. Finance, stock, contracts, documents, and commissions are never silently posted.

### 3.12 Audit

Every material operation records actor, time, action, entity, before, after, reason, source/channel, Deal/company scope, correlation ID, and related record. Audit data is append-only from the application perspective. Sensitive content and secrets must not be copied into logs.

## 4. Target bounded contexts

| Context | Owns | Reuses current code |
| --- | --- | --- |
| Deal | transaction aggregate, participants, sides, profitability summary | Business Cases and entity workspace |
| Contracts | contracts, lines, annexes, terms, completeness | current Contract Hub/import |
| Documents | document identity, immutable versions, approvals | current DMS/version actions |
| Verification | extraction and validation findings | current contract AI schema/review patterns |
| Templates | template identity/version/mapping/generation | new, integrated with DMS |
| Logistics | shipments/containers/milestones | current logistics module |
| Warehouse | lots/movements/reservations/holds | current warehouse module |
| Finance | invoices/expenses/payments/FX/profit | current finance module |
| Commissions | commission rules/accruals/invoices/payments | new, linked to finance |
| History/Knowledge | events, evidence, precedent retrieval | platform activity/timeline + repository knowledge concepts |
| Identity/Audit | memberships, permissions, RLS, audit events | current permission/platform proposals |

## 5. Delivery sequence

### Phase 0 — production safety

1. Inventory actual schema and migration state.
2. Implement reviewed authentication, company memberships, permissions, and RLS.
3. Establish append-only audit contract.
4. Establish decimal-money and currency-conversion rules.
5. Add critical integration tests.

### Phase 1 — one complete Deal

Deliver the scope in `SKY_ERP_MILESTONE_1.md`: participant roles, product economics, purchase/sales contracts, immutable documents, basic parsing/validation, commission, payment tracking, shipment reference, expected profit, history, and audit.

### Phase 2 — document operations

Annexes, document completeness, structured findings, version approvals, generated documents, and controlled templates.

### Phase 3 — execution depth

Multi-container logistics, warehouse reservations/holds, expenses/reconciliation, actual profit, commission settlement, claims/credit notes.

### Phase 4 — knowledge and assistant

Evidence-backed historical retrieval, precedents, reusable terms, validation knowledge, and authorized AI tools.

### Phase 5 — scale and analytics

Cross-module reporting, multi-company consolidation, optimized aggregates, integrations, and operational automation.

## 6. Non-negotiable invariants

1. Original documents are immutable.
2. AI suggestions are reviewable and never silently post business data.
3. Company and role authorization is enforced server-side and by RLS.
4. Money is decimal-safe and currencies are never silently mixed.
5. Stock and posted finance changes have auditable reversals.
6. Contract PDF import is extended, not replaced wholesale.
7. Existing business data and migration history are preserved.
8. Reports and knowledge retrieval are read-only.
9. Every material state transition produces audit/history evidence.
10. New schema is additive and applied remotely only after explicit approval.

## 7. Definition of product readiness

An area is production-ready only when its primary workflow works end-to-end, required migrations are confirmed, authorization/RLS is enforced, audit coverage exists, errors are visible, task-specific tests pass, and manual acceptance criteria are documented. A route or table alone does not constitute a finished capability.
