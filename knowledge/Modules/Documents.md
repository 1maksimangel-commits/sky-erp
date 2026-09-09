# Module — Documents

Phase 5 document templates/generation: see
[DocumentGeneration](../Development/DocumentGeneration.md) for the canonical
review workflow, immutable originals/outputs, versioning and regression gate.
That implementation supersedes the legacy generation risks described below.

## Purpose

DMS: store, version, preview, and link files to ERP entities.

## Current state

Route `/documents` · `src/lib/documents*` · `src/components/documents*` · platform `EntityDocumentsPanel` · migrations `…190000` + DMS `…200000`–`220000` · bucket `documents`.

Entity types include contract, shipment, invoice, payment, company, counterparty, product, warehouse_lot, business_case, `crm_customer`, etc.

## Confirmed rules

- Validate type/size on DMS path (~50 MB).  
- Storage holds bytes; DB holds metadata/paths.  
- Contract import uses same bucket under `imports/…` until attach-on-confirm.  
- Prefer `uploadDocument` over ad-hoc inserts.

## Constraints

- Live schema may lag (hotfix history).  
- Actor uuid columns must stay uuid.

## Known risks / gaps

- Schema drift / probes.  
- Signed URL by arbitrary path (ownership gap).  
- Hub upload path weaker than DMS.

## Development rules

- Shared validation helpers.  
- Keep `entity_type` / `entity_id` aligned with typed FKs when present.

## Planned

- Canonical schema verification · ACL-safe signed URLs · template generation (human-saved).
