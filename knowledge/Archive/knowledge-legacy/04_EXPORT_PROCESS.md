# SKY ERP — Export Process (Russia → China)

Normative operational process for seafood export from Russia to China. Adapt ports and certificate lists to the active lane; do not skip compliance steps.

---

## 1. Lane overview

```text
Purchase (RU)
  → Packing / Cold store
  → Certificates
  → RU Customs export
  → Bill of Lading
  → Ocean shipping
  → CN Import / customs
  → Delivery
  → Payment
```

Primary system hub: **Contract** (+ Shipment, Warehouse lots, Documents, Invoices).

---

## 2. Purchase

**Objective:** Secure product of agreed species, size, process form, volume, and price.

**Activities**

1. Confirm supplier counterparty and company entity.
2. Agree commercial terms: SKU, net weight, glaze, currency, Incoterms, delivery period.
3. Create / update Business Case and/or Purchase side of Contract.
4. Align packing specs (IQF / block, carton marks, labels for China market).

**ERP**

- Counterparties (supplier), Products, Business Cases, Contracts
- Optional purchase contract fields and product lines

**Exit criteria:** Signed or confirmed purchase terms; SKUs exist in catalog.

---

## 3. Packing

**Objective:** Freeze, glaze, pack, and mark cartons for export.

**Activities**

1. Process form (Round, H&G, PBO, fillet, etc.) per contract.
2. Apply glaze %; record **net** and **gross** weights.
3. Carton labeling: product name, scientific name, production date, lot, net weight, storage −18°C (or as required).
4. Palletize / stuff plan toward container capacity.
5. Intake to warehouse lots with lot numbers.

**ERP**

- Warehouse inbound lots linked to product (+ contract when known)
- Documents: packing list drafts

**Exit criteria:** Lots on hand, releasable quantity ≥ booked volume (after QC).

---

## 4. Certificates

**Objective:** Assemble the document pack required for RU export and CN import.

**Typical pack (illustrative — confirm with current regulation / broker)**

| Document | Purpose |
| --- | --- |
| Health Certificate | Sanitary fitness |
| Veterinary Certificate | Animal product control |
| Certificate of Origin (COO) | Origin claim |
| Catch / processing certificates | Traceability when required |
| Quality / lab reports | Spec compliance |
| Packing list | Carton / weight detail |
| Commercial invoice | Value declaration |
| Contract copy | Commercial basis |

**ERP**

- DMS attachments on Contract / Shipment
- QC gate before “export ready”

**Exit criteria:** Mandatory certificates issued and uploaded; inspection passed.

---

## 5. Customs (Russia export)

**Objective:** Clear goods for export under correct HS codes and declared values.

**Activities**

1. Classify goods (HS Code) consistent with product and process form.
2. Submit export declaration with broker.
3. Present certificates and commercial docs.
4. Obtain release; record customs refs in shipment notes/docs.

**ERP**

- Store declaration / release scans in Documents
- Shipment status → progressive logistics states

**Exit criteria:** Export cleared; cargo authorized to load.

---

## 6. Bill of Lading (B/L)

**Objective:** Establish carriage contract and title document for ocean freight.

**Activities**

1. Confirm shipper, consignee, notify party (counterparties).
2. Align description of goods, container numbers, seals, weights with packing list.
3. Issue / receive draft B/L → operator review → final B/L.
4. Decide original vs telex release per payment terms (e.g. hold originals until payment).

**ERP**

- Shipment fields: vessel, voyage, container, POL/POD, ETD/ETA
- DMS: B/L PDF
- Notifications on delay / doc ready

**Exit criteria:** Final B/L matches cargo; originals handled per finance instructions.

---

## 7. Shipping

**Objective:** Move reefer container(s) from POL (e.g. Vladivostok / Far East RU) to POD (China).

**Activities**

1. Booking confirmation (carrier, vessel, voyage).
2. Gate-in, VGM, load on vessel.
3. Monitor ETD/ETA; update status In Transit → Arrived.
4. Temperature integrity remains a commercial risk — log incidents.

**ERP**

- Logistics module + contract logistics tab
- Multi-container awareness (field today; first-class containers later)

**Exit criteria:** Vessel sailed; ETA communicated to buyer.

---

## 8. Import (China)

**Objective:** Clear Chinese import controls and deliver to buyer/consignee.

**Activities**

1. Pre-alert buyer / broker with docs (B/L, certificates, packing list, invoice).
2. Import declaration, inspection as required by CN authorities.
3. Pay duties/VAT as Incoterms allocate (buyer vs seller responsibility).
4. Release from terminal / cold store to consignee.

**ERP**

- Shipment status Delivered / Arrived
- Claims workflow if inspection fails (quality / labeling)

**Exit criteria:** Cargo released to consignee; delivery evidence filed.

---

## 9. Payment

**Objective:** Collect per contract payment terms.

**Common patterns**

- T/T against copy docs / against B/L
- Partial deposit + balance before release of originals
- LC at sight / usance (bank counterparty)

**Activities**

1. Issue commercial invoice (and proforma earlier if needed).
2. Record payments and allocate to invoices.
3. Release B/L originals or telex per clearance of funds.
4. Close contract financially when outstanding is zero (and goods delivered).

**ERP**

- Finance: Invoices, Payments, allocations, bank accounts
- Notifications: Payment Received
- Contract finance tab

**Exit criteria:** Invoices paid (or credited); contract status completable.

---

## 10. RACI (simplified)

| Step | Commercial | Ops / Warehouse | Logistics | Finance | Docs |
| --- | --- | --- | --- | --- | --- |
| Purchase | A | C | I | C | C |
| Packing | C | A | I | I | C |
| Certificates | C | C | C | I | A |
| Customs RU | C | C | A | I | A |
| B/L | C | I | A | C | A |
| Shipping | I | I | A | I | C |
| Import CN | C | I | A | C | A |
| Payment | C | I | I | A | C |

A = Accountable, C = Consulted, I = Informed

---

## 11. Failure modes

| Risk | Response |
| --- | --- |
| QC fail | Quarantine lot; do not stuff |
| Certificate delay | Hold booking or roll vessel; notify buyer |
| Weight mismatch | Recount; amend packing list / B/L draft |
| ETA slip | Notification “Shipment Delayed”; revise buyer plan |
| Short payment | Hold originals; finance follow-up |

---

## Related knowledge

- [01_BUSINESS_RULES.md](./01_BUSINESS_RULES.md)
- [05_DOMAIN_TERMS.md](./05_DOMAIN_TERMS.md)
- [03_AI_RULES.md](./03_AI_RULES.md)
