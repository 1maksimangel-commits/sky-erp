# SKY ERP — Business Context

## Purpose

Authoritative seafood-trading business context, workflow, and glossary pointers.

## Current state

Merged from root `BUSINESS_CONTEXT.md`, `knowledge/01_BUSINESS_RULES.md`, `04_EXPORT_PROCESS.md`, and `05_DOMAIN_TERMS.md` (archived).

## Confirmed context

### Industries

Seafood export · Import · Processing · Warehousing · International logistics · Finance

### Example companies (names)

ALTAY FISH LLC · ORDA FZCO · MAREX CARGO · DALIAN TIANYUAN · Global Star Logistics

### Markets

Russia · China · Japan · Korea · Singapore · UAE

### Example products

Pacific Cod · Pollock · Halibut · King Crab · Snow Crab · Shrimp · Scallop · Whelk · Squid · Salmon

### Canonical flow

```text
Supplier → Purchase → Warehouse → Processing → Packing
  → Export Contract → Booking → Container(s) → Shipment
  → Invoice → Payment → Customer settled
```

### Hard rules

| Rule |
| --- |
| Every contract belongs to one company |
| Every shipment belongs to one contract |
| Every invoice belongs to one contract |
| Every payment belongs to one invoice |
| Customers have multiple contacts |
| Products have scientific and commercial names |
| Multi-language commercial support: RU / EN / ZH / JA |
| Human confirmation for AI-extracted contract data |
| No silent negative stock |
| Net weight sells; gross weight ships (commercial vs logistics) |
| Certificates before customs on regulated lanes |

### Roles

Supplier · Company (legal entity) · Customer/Buyer · Consignee · Agent/Forwarder · Bank

### Status gates (business intent)

| From → To | Requires |
| --- | --- |
| Purchase → Warehouse | Supplier, SKU, qty |
| Warehouse → Booking | Lot releasable / QC intent |
| Booking → Shipment | Carrier, POL/POD, ETD |
| Shipment → Invoice | Contract lines / term trigger |
| Invoice → Closed | Full payment allocation |

Exact UI enums may differ; gates are intent.

### Export process (Russia → China)

Normative operational process. Adapt ports and certificate lists to the active lane; do not skip compliance steps.

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

| Step | Objective | Exit criteria |
| --- | --- | --- |
| Purchase | Secure species, size, form, volume, price | Confirmed purchase terms; SKUs in catalog |
| Packing | Freeze, glaze, pack, mark for export | Lots on hand; releasable qty ≥ booked (after QC) |
| Certificates | Assemble RU export / CN import pack | Mandatory certs uploaded; inspection passed |
| Customs (RU) | Clear export under correct HS / values | Export cleared; cargo authorized to load |
| Bill of Lading | Carriage contract / title document | Final B/L matches cargo; originals per finance |
| Shipping | Reefer move POL → POD | Vessel sailed; ETA to buyer |
| Import (CN) | Clear import controls; deliver | Released to consignee; delivery evidence filed |
| Payment | Collect per contract terms | Invoices paid/credited; contract closable |

**Typical certificate pack (illustrative — confirm with regulation / broker):** Health, Veterinary, COO, catch/processing when required, quality/lab, packing list, commercial invoice, contract copy.

**Common payment patterns:** T/T against copy docs or B/L; deposit + balance before originals; LC at sight/usance.

**RACI (simplified):** Purchase — Commercial A; Packing — Ops/Warehouse A; Certificates/Docs — Docs A; Customs RU / B/L / Shipping / Import CN — Logistics A (Docs A on customs/B/L/import); Payment — Finance A.

**Failure modes:** QC fail → quarantine, do not stuff; certificate delay → hold/roll booking; weight mismatch → recount and amend docs; ETA slip → notify buyer; short payment → hold originals.

Historical narrative snapshot: `Archive/knowledge-legacy/04_EXPORT_PROCESS.md`.

### Glossary (seafood trading)

Prefer these spellings in UI copy and AI extraction schemas.

#### Commercial & trade

| Term | Meaning |
| --- | --- |
| Incoterms | ICC terms allocating cost/risk (FOB, CFR, CIF, DAP, EXW). Store rule + year revision and named place (e.g. CIF Qingdao Incoterms® 2020). |
| HS Code | Harmonized System customs classification; must match process form |
| ETA | Estimated Time of Arrival at POD |
| ETD | Estimated Time of Departure from POL |
| BL / B/L | Bill of Lading — carriage contract; often document of title |
| COO | Certificate of Origin |
| Health Certificate | Sanitary fitness for destination market |
| Veterinary Certificate | Official veterinary control for animal-origin products |

#### Sustainability & certification

| Term | Meaning |
| --- | --- |
| MSC | Marine Stewardship Council (wild-catch) |
| ASC | Aquaculture Stewardship Council (farmed) |

#### Product form & processing

| Term | Meaning |
| --- | --- |
| Round | Whole fish, essentially ungutted / unprocessed beyond freezing (confirm in specs) |
| H&G | Headed and Gutted |
| PBO | Pin Bone Out (often fillets) |
| IQF | Individually Quick Frozen (free-flowing) |
| Block Frozen | Frozen as a solid block |
| Glazing | Protective ice layer; increases gross vs net |
| Net Weight | Product excluding glaze/packaging/tare — commercial weight |
| Gross Weight | Total including glaze/packaging as defined on the document |

#### Logistics weights & packing

| Term | Meaning |
| --- | --- |
| Tare | Empty container or packaging weight |
| VGM | Verified Gross Mass (SOLAS) |
| POL / POD | Port of Loading / Port of Destination |
| Reefer | Refrigerated container |
| Seal | Security seal number |

#### Quality & inspection

| Term | Meaning |
| --- | --- |
| Organoleptic | Sensory QC (smell, appearance, texture) |
| Quarantine | Lot hold pending QC / authority release |
| Claim | Buyer claim for quality, weight, or delay |

#### Finance

| Term | Meaning |
| --- | --- |
| Proforma Invoice | Preliminary invoice for payment / LC |
| Commercial Invoice | Final invoice for customs and settlement |
| T/T | Telegraphic transfer |
| LC | Letter of Credit |
| Outstanding | Unpaid invoice balance |

#### Glossary usage rules

1. UI labels prefer full term + abbreviation on first view (`Bill of Lading (B/L)`).
2. AI extraction should normalize synonyms to one field.
3. Never confuse net and gross in amounts or logistics docs.
4. Incoterms without a named place are incomplete.

Historical glossary snapshot: `Archive/knowledge-legacy/05_DOMAIN_TERMS.md`.

## Constraints

- Contract is the commercial hub.  
- Do not duplicate customer masters as free text on every deal.  
- Claims/credit notes attach to contract/shipment when implemented.

## Known risks / gaps

- App multi-company filtering incomplete vs ownership rule.  
- First-class containers, QC records, certificate packs → **Planned**.

## Development rules

- Use seafood terminology consistently in UI and extraction schemas.  
- Link ops records to `company_id` / `contract_id` / `business_case_id` as schema allows.  
- Never hardcode company UUIDs.

## Planned

- Lane certificate packs, multi-container, QC module — `Roadmap/Future.md`.
