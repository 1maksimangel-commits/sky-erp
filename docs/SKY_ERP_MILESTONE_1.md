# SKY ERP — Production Milestone 1

## Goal

Run one real international seafood transaction end-to-end inside SKY ERP while preserving data integrity, document originals, financial clarity, history, and basic auditability.

This milestone deliberately excludes generalized workflow engines, external integrations, advanced BI, full template center, multi-container tracking, semantic corporate knowledge, and autonomous AI actions.

## 1. Transaction scope

One Deal supports:

- owning SKY company;
- seller, buyer, producer, and optional consignee/notify party;
- one or more seafood products;
- quantity, unit/net weight, unit price, currency, and Incoterms;
- one purchase contract and one sales contract;
- uploaded original documents;
- basic parsing and contract validation;
- one or more commissions;
- invoice/payment tracking;
- shipment/logistics reference;
- expected profit;
- transaction timeline and audit events.

Actual profit may equal expected profit updated by recorded actual amounts; advanced accrual, valuation, and reconciliation are outside Milestone 1.

## 2. Required user workflow

### Step 1 — Create Deal

Create from the existing Business Case path, with a stable Deal number, owning company, status, transaction currency/reporting currency, and responsible manager if identity is available.

Acceptance:

- number is unique;
- company is required;
- creation is audited;
- Deal opens as one workspace.

### Step 2 — Add participants

Select or create seller, buyer, and producer. Store their roles on this Deal; do not rely only on global counterparty type. Consignee and notify party are optional.

Acceptance:

- the same counterparty may hold different roles on different Deals;
- duplicate warning is shown before creating a similar counterparty;
- participant changes are recorded in history.

### Step 3 — Add product economics

Select or create a Product and enter quantity, unit, net weight where applicable, purchase price, sales price, and currencies.

Acceptance:

- quantity and prices are positive decimals;
- kg/MT conversion is explicit;
- original currencies are retained;
- expected purchase and sales totals are visible.

### Step 4 — Record purchase and sales contracts

Create manually or import PDF, classify each contract as Purchase or Sales, and link it to the Deal and applicable participants/items.

Acceptance:

- contract number, date, parties, products, quantity, price, currency, Incoterms, payment/delivery terms are reviewable;
- imported values require confirmation;
- duplicate contract number is rejected or explicitly resolved;
- contract creation/update is audited.

### Step 5 — Upload documents and preserve originals

Upload purchase contract, sales contract, invoice, packing list, B/L or other available files.

Acceptance:

- original bytes are immutable;
- replacement creates a linked version;
- document records type, source, creator, created time, version, supersedes, and reason;
- access follows Deal company permissions.

### Step 6 — Parse and validate documents

Reuse current contract parsing. Add a minimal verification run that compares a selected document with the applicable contract/Deal fields.

Milestone checks:

- seller and buyer;
- producer/consignee when present;
- product/species;
- quantity and net/gross weight where present;
- price/currency;
- Incoterms and ports where present;
- dates, payment terms, references, and commission where present.

Acceptance:

- each finding includes expected, observed, severity, evidence/confidence, and review state;
- missing data is reported as unknown/missing, never invented;
- user confirms or resolves findings;
- AI cannot change the Deal, contract, finance, or document silently.

### Step 7 — Calculate commission

Create commission with beneficiary, payer, method, currency, calculation basis, expected amount, actual amount, status, and optional commission invoice.

Milestone methods: per MT, per kg, fixed, percentage, per unit, and manual.

Acceptance:

- formula and basis are visible;
- decimal calculation is deterministic and tested;
- manual method requires a reason;
- expected and actual commission remain separate.

### Step 8 — Track invoice and payment

Link purchase/sales invoice and payment to the Deal/contract. Show payable/receivable amount, paid amount, outstanding amount, currency, due date, and status.

Acceptance:

- currencies are not mixed;
- partial payment is represented through allocation;
- corrections are void/reversal operations, not silent deletion;
- actions are audited.

### Step 9 — Add shipment reference

Create/link a shipment with contract, vessel/voyage, ports, ETD/ETA, B/L/container reference, and status.

Acceptance:

- shipment belongs to the Deal through a contract or direct validated link;
- company ownership matches;
- invalid dates/status transitions are rejected;
- history records changes.

### Step 10 — Review expected profit and history

Expected profit formula in one explicit reporting currency:

```text
expected sales
- expected purchase
- logistics
- insurance
- bank charges
- expected commissions
- other expected expenses
= expected profit
```

Acceptance:

- every component retains original currency and conversion metadata;
- formula breakdown is visible;
- no cross-currency sum occurs without FX;
- Deal timeline shows participant, contract, document, verification, commission, payment, and shipment events.

## 3. Minimum data-model additions

Final names require schema review, but capabilities require additive records for:

- Deal participant roles;
- Deal items with purchase/sales economics;
- contract side and Deal linkage where current relationship is insufficient;
- commissions;
- document source/version/supersedes/change reason/approval metadata;
- document verification runs/findings;
- complete audit events or an extended compatible activity contract.

Existing Business Cases, contracts, documents, invoices, payments, shipments, and timelines must be preserved and migrated additively. No remote application is part of this plan.

## 4. Production safety gate

Before real data is accepted:

1. Confirm actual schema/migration state.
2. Replace admin stub with reviewed authentication/role resolution.
3. Enforce company membership and RLS for every milestone entity and storage object.
4. Restrict stock/finance SECURITY DEFINER RPC grants.
5. Verify immutable document storage/version behavior.
6. Verify decimal and FX rules with fixtures.
7. Ensure material actions emit audit events.
8. Back up and define rollback for each approved remote migration.

## 5. Minimum test set

- Create Deal and all required participant roles.
- Reject cross-company participant/document/finance access.
- Add product with purchase/sales prices and calculate totals.
- Create/import purchase and sales contracts; review before save.
- Preserve original and create revised document version.
- Generate and resolve document validation findings.
- Calculate all six commission methods, including kg/MT conversion.
- Register partial/full payment and calculate outstanding amount.
- Reject mixed-currency profit without FX metadata.
- Create shipment and reject invalid schedule/status transition.
- Verify Deal timeline and before/after audit coverage.
- Confirm read-only users cannot mutate data.

## 6. Definition of Done

Milestone 1 is complete only when one representative seafood Deal can be executed through the workflow without using spreadsheets for required fields, all task tests/lint/TypeScript/build checks pass, security review confirms company isolation, finance formulas are fixture-verified, originals remain retrievable, audit/history is complete, and a human can reproduce the transaction from the Deal workspace.

## 7. Explicitly out of scope

- external banking/carrier/customs integrations;
- automated payment or approval execution;
- full warehouse valuation and processing;
- advanced claims/credit notes;
- generalized workflow designer;
- complete Template Center;
- semantic enterprise search/vector platform;
- autonomous AI writes;
- multi-company consolidation;
- buyer portal and mobile applications.
