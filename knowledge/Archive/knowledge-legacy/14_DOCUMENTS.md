# SKY ERP — Documents

## Purpose

Document management (DMS): upload, version, preview, and link files to ERP entities.

## Current state

| Item | Location |
| --- | --- |
| Route | `/documents` |
| UI | `src/components/documents/*`, platform `EntityDocumentsPanel` |
| Lib | `src/lib/documents/*` |
| Migrations | `20260804190000` + `20260804200000`–`220000` DMS chain |
| Storage | Supabase bucket `documents` |

### Confirmed capabilities

- Entity-linked uploads (`DOCUMENT_ENTITY_TYPES` includes contract, shipment, invoice, payment, company, counterparty, product, warehouse_lot, business_case, `crm_customer`, …).
- Versioning via `document_versions`.
- Signed URLs for preview/download.
- Runtime schema probes for incomplete live DMS schemas (`probeDmsSchema`).

## Confirmed rules

- Validate file type/size on DMS upload path (`validation.ts`, ~50 MB).
- Files in Storage; DB stores metadata/paths.
- Contract PDF import also uses the `documents` bucket under `imports/…` (separate from DMS rows until attach-on-confirm).

## Constraints

- Do not assume all DMS columns exist remotely until migrations/hotfixes applied.
- Prefer DMS `uploadDocument` over ad-hoc storage inserts when attaching to entities.
- Hub `uploadContractDocument` is a legacy/alternate path with weaker checks — prefer consolidating carefully.

## Known risks / gaps

- Triple migration/hotfix history indicates live drift.
- `getSignedUrlForPath` lacks ownership checks (IDOR-style risk under open storage policies).
- Documents page lint errors (JSX in try/catch).

## Development rules

- Use shared validation helpers for MIME/extension/size.
- Keep entity_type/entity_id consistent with typed FK columns when present.
- Additive migrations only for schema gaps.

## Planned

- Canonical schema verification; simplify probes.
- ACL-safe signed URL issuance.
- Template generation for packing lists (human-saved) — roadmap.
