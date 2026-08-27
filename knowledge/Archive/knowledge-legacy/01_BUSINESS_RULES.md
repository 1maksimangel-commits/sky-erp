# SKY ERP — Seafood Export Business Rules

This document defines the end-to-end commercial and operational workflow for SKY’s seafood export business. Application features must respect these rules unless an explicit product exception is approved.

---

## 1. Purpose

SKY ERP orchestrates seafood trading from supplier sourcing through processing, warehousing, contracting, logistics, invoicing, and payment collection — primarily for export lanes such as Russia → China and related corridors.

The **contract** is the commercial hub. Physical and financial events attach to it (or to a linked business case that converts into a contract).

---

## 2. Roles in the value chain

| Role | Description |
| --- | --- |
| **Supplier** | Catch / processing / trading partner that sells product to SKY (or SKY’s company entity). |
| **Company** | SKY legal entity that owns the contract, inventory, and bank accounts. |
| **Customer (Buyer)** | Importer / distributor purchasing under the sales contract. |
| **Consignee** | Party named to receive the cargo (may differ from buyer). |
| **Agent / Forwarder** | Logistics intermediary for booking, customs, and documentation. |
| **Bank** | Settlement party for payments and letters of credit when used. |

Counterparties in the system may hold one or more of these commercial roles.

---

## 3. Canonical workflow

```text
Supplier
  → Purchase
  → Processing (optional / external)
  → Warehouse intake
  → Quality Inspection
  → Contract (sales / purchase linkage)
  → Booking
  → Container
  → Shipment
  → Invoice
  → Payment
  → Customer (settlement complete)
```

Stages may overlap in calendar time, but **status gates** below define what is allowed.

---

## 4. Stage rules

### 4.1 Supplier

- Every purchase must identify a supplier counterparty.
- Supplier master data should include legal name, country, tax/registration identifiers when available.
- Prefer active counterparties only on new deals.

### 4.2 Purchase

- A purchase establishes SKY’s right to product (volume, grade, price, currency, Incoterms, delivery window).
- Purchase terms may live on a **purchase contract**, a **business case**, or both; sales contracts reference the commercial package.
- Quantity is tracked in commercial units (kg, cartons, containers) consistent with product master data.
- Currency and Incoterms must be explicit before shipment booking.

### 4.3 Processing

- Processing covers cutting, grading, freezing (IQF / block), glazing, packing, and labeling.
- Processing may occur at supplier plant, third-party cold store, or SKY-controlled facility.
- Output SKUs (e.g. H&G, PBO, fillet) must match `products` catalog entries used on contract lines.
- Yield and glaze % affect net weight commercially — record net vs gross distinctly.

### 4.4 Warehouse

- Inbound lots are created only after quantity and product identity are known.
- Lot attributes: product, quantity, pack date / production date, best-before when applicable, temperature regime, location.
- Stock cannot be shipped beyond available lot quantity (hard rule for warehouse operations).
- Soft holds: quarantine lots failing quality must not be allocated to export shipments.

### 4.5 Quality Inspection

- Inspection is required before export release for regulated markets (e.g. China).
- Capture: organoleptic, temperature, packaging integrity, labeling, certificate readiness.
- Fail → quarantine / rework / reject; Pass → releasable for booking.
- Certificate packs (Health, Veterinary, COO, etc.) are gated by inspection outcome where regulations require.

### 4.6 Contract

- A **contract** binds company, buyer, supplier (as applicable), products, prices, currency, Incoterms, payment terms, and delivery terms.
- Contract statuses progress in a controlled way (e.g. Draft → Confirmed → In Progress → Completed / Cancelled).
- Product lines are required before logistics and invoicing for that contract are considered complete.
- PDF import may propose fields; **human confirmation is mandatory** before create/update.
- Amendments must be auditable (history / timeline).

### 4.7 Booking

- Booking reserves vessel / voyage / carrier space for a contract (or split across contracts).
- Booking requires: ports (POL/POD), ETD/ETA windows, approximate volume/containers, Incoterms alignment.
- Booking is a logistics intent; it does not move stock until warehouse outbound is posted.

### 4.8 Container

- Containers are physical load units linked to a shipment.
- Each container should track: container number, seal, size/type, tare, cargo description, net/gross weight.
- Stuffing list must reconcile to warehouse lots and contract product lines within tolerance.
- One shipment may have multiple containers; one container should not split across conflicting destinations.

### 4.9 Shipment

- A shipment is the executable logistics record: vessel, voyage, container(s), POL/POD, ETD/ETA, status, tracking.
- Status examples: Planned → Booked → Loaded → In Transit → Arrived → Delivered / Delayed / Cancelled.
- Delays must be visible in notifications and contract logistics views.
- Documents (BL, certificates) attach to shipment and/or contract via DMS.

### 4.10 Invoice

- Invoices reference contract (and optionally shipment / business case).
- Amounts must reconcile to contracted quantities and prices, adjusted by agreed claims/credits.
- Partial shipments may generate partial invoices when payment terms allow.
- Outstanding balance = amount − allocated payments.
- Currency must match contract currency unless FX rules are explicitly applied.

### 4.11 Payment

- Payments allocate to one or more invoices.
- Over-allocation is not allowed without a credit / adjustment workflow.
- Payment received should notify finance operators and update invoice status (Partially Paid / Paid).
- Bank account belongs to the company entity.

### 4.12 Customer

- Customer satisfaction and repeat business depend on on-time docs, correct weights, and certificate completeness.
- Claims (quality, short-weight, delay) attach to contract/shipment and may spawn credit notes.
- Customer master data stays in counterparties; do not duplicate as free text on each deal.

---

## 5. Cross-cutting business rules

1. **Single source of truth:** Supabase entities — no parallel spreadsheets as system of record.
2. **Company ownership:** Contracts, bank accounts, and inventory ownership resolve to a `companies` row.
3. **Net weight sells; gross weight ships:** Commercial pricing uses net (or agreed commercial weight); logistics docs carry gross.
4. **Certificates before customs clearance** on regulated lanes.
5. **No silent stock negative.**
6. **Human confirmation** for AI-extracted contract data.
7. **Auditability:** Material status changes write timeline / activity events.
8. **Permissions:** Writes gated by role capabilities as Permissions mature.

---

## 6. Status gate summary

| From | To proceed | Requires |
| --- | --- | --- |
| Purchase → Warehouse | Product identity + qty | Supplier, SKU |
| Warehouse → Booking | QC pass / release | Lot releasable |
| Booking → Shipment | Carrier + schedule | POL/POD, ETD |
| Shipment → Invoice | Deliverable event or term trigger | Contract lines |
| Invoice → Closed | Full allocation | Payments |

Exact UI statuses may use module-specific enums; gates above are business intent.

---

## 7. Related knowledge

- [02_DATA_MODEL.md](./02_DATA_MODEL.md)
- [04_EXPORT_PROCESS.md](./04_EXPORT_PROCESS.md)
- [05_DOMAIN_TERMS.md](./05_DOMAIN_TERMS.md)
