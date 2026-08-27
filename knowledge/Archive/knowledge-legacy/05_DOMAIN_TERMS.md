# SKY ERP — Seafood Trading Glossary

Canonical terms for operators, developers, and AI prompts. Prefer these spellings in UI copy and extraction schemas.

---

## Commercial & trade

### Incoterms

International Commercial Terms published by the ICC that allocate cost, risk, and responsibilities between seller and buyer (e.g. FOB, CFR, CIF, DAP, EXW). Always store the specific rule and year revision when known (e.g. CIF Qingdao Incoterms® 2020).

### HS Code

Harmonized System customs classification code for goods. Required for export/import declarations. Must match the actual process form (e.g. frozen H&G fish vs fillets).

### ETA

**Estimated Time of Arrival** of the vessel/cargo at the port of destination (POD).

### ETD

**Estimated Time of Departure** of the vessel/cargo from the port of loading (POL).

### BL / B/L

**Bill of Lading** — transport document issued by the carrier evidencing receipt of goods and contract of carriage; often acts as a document of title.

### COO

**Certificate of Origin** — document stating the country of origin of the goods for customs and trade preference purposes.

### Health Certificate

Official sanitary certificate confirming products meet health requirements of the destination market.

### Veterinary Certificate

Official veterinary control document for animal-origin products (common for seafood exports).

---

## Sustainability & certification

### MSC

**Marine Stewardship Council** — certification program for wild-catch sustainable fisheries. May appear on contracts, labels, and buyer requirements.

### ASC

**Aquaculture Stewardship Council** — certification for responsibly farmed seafood. Relevant when product is aquaculture-origin.

---

## Product form & processing

### Round

Whole fish, essentially ungutted / unprocessed beyond freezing (definitions vary by species contract — confirm in specs).

### H&G

**Headed and Gutted** — head removed and viscera removed; common frozen commodity form.

### PBO

**Pin Bone Out** (often for fillets) — pin bones removed. Confirm species-specific usage in the contract.

### IQF

**Individually Quick Frozen** — pieces frozen separately so they remain free-flowing, not a solid block.

### Block Frozen

Product frozen as a solid block (often glazed), typical for layered fillets or mince blocks.

### Glazing

Thin protective ice layer sprayed/applied on frozen seafood. Increases **gross** weight relative to **net** (unglazed) weight. Commercial pricing usually references net or a contracted glaze %.

### Net Weight

Weight of the product excluding glaze, packaging, and tare — typically the commercial weight.

### Gross Weight

Total weight including glaze and/or packaging as defined on the document (carton gross vs container gross — be explicit).

---

## Logistics weights & packing (related)

| Term | Meaning |
| --- | --- |
| Tare | Weight of empty container or packaging |
| VGM | Verified Gross Mass of packed container (SOLAS) |
| POL | Port of Loading |
| POD | Port of Destination |
| Reefer | Refrigerated container |
| Seal | Security seal number on container |

---

## Quality & inspection

| Term | Meaning |
| --- | --- |
| Organoleptic | Sensory QC (smell, appearance, texture) |
| Quarantine | Lot hold pending QC / authority release |
| Claim | Buyer commercial claim for quality, weight, or delay |

---

## Finance (related)

| Term | Meaning |
| --- | --- |
| Proforma Invoice | Preliminary invoice for payment / LC |
| Commercial Invoice | Final invoice for customs and settlement |
| T/T | Telegraphic transfer bank payment |
| LC | Letter of Credit |
| Outstanding | Unpaid invoice balance |

---

## Usage rules for SKY ERP

1. UI labels prefer full term + abbreviation on first view (`Bill of Lading (B/L)`).
2. AI extraction should normalize synonyms (e.g. “B/L”, “BL”, “Bill of Lading”) to one field.
3. Never confuse net and gross in amounts or logistics docs.
4. Incoterms without a named place are incomplete (e.g. “CIF” alone is insufficient).

---

## Related knowledge

- [01_BUSINESS_RULES.md](./01_BUSINESS_RULES.md)
- [04_EXPORT_PROCESS.md](./04_EXPORT_PROCESS.md)
