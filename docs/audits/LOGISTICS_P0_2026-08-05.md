# Logistics P0 Stabilization — 2026-08-05

Scope: Shipments and direct logistics relationships (containers-as-fields, BL, booking, vessel/voyage, ports, dates, documents, contract/BC/company ownership).  
Constraints: repository-only; no remote Supabase; migrations not applied; no commit/push; no file deletes.

## Current architecture

| Layer | Location |
| --- | --- |
| Routes | `/logistics`, `/logistics/[id]`, contract logistics tab |
| UI | `src/components/logistics/*` (+ `EntityWorkspace` on detail) |
| Domain | `src/lib/logistics/{actions,db,validation,types,timeline,format}.ts` |
| Base schema | `20260804140000_contract_hub.sql` (`shipments`) |
| Extensions | `20260804160000_shipments_logistics_columns.sql` (supersedes `…150000`) |
| P0 additive | `20260805100000_logistics_p0_ownership_columns.sql` (**unapplied**) |
| Documents | DMS entity type `shipment` + types packing list / CI / BL / COO / veterinary |

**Model today:** one shipment row ≈ one logistics execution unit. Container/BL/booking are **fields**, not child tables. Multi-container entity remains Planned (see `knowledge/Modules/Logistics.md`).

**Write paths:** `createShipment` / `updateShipment` / `deleteShipment` / `addShipmentTimelineEvent`.  
**Tracking:** `shipment_timeline_events` + platform timeline fanout.  
**Documents:** EntityWorkspace / DMS upload; no server-side PDF generation pipeline for packing list / CI / certificates.

## Verified schema

| Concept | Status |
| --- | --- |
| contract_id | Required FK (cascade) |
| business_case_id | Column since `…160000`; nullable until app enforce |
| company_id | **Missing before P0 migration**; proposed in `…05100000` |
| container / container_type / seal | Text fields |
| vessel / voyage / shipping_line | Text fields |
| booking_number / tracking_number | Text fields |
| ports POL/POD | Text fields |
| ETD / ETA / ATD / ATA / etd_actual / eta_actual | Date fields |
| bl_number / consignee / notify_party | **Added in P0 migration** |
| First-class containers / BL tables | **Absent** (by design for now) |
| Ports master table | **Absent** (free-text ports) |
| Open RLS on shipments + timeline | Present — auth blocker |

## Verified defects and disposition

| ID | Severity | Defect | Disposition |
| --- | --- | --- | --- |
| L1 | P0 | No `shipments.company_id` | Additive migration + app resolve/write |
| L2 | P0 | BC optional → orphan commercial link | App requires BC (inherit from contract) |
| L3 | P0 | Weak validation (dates/status/ports) | Hardened `validation.ts` |
| L4 | P0 | No status transition rules | Enforced in validation on update |
| L5 | P0 | Duplicate container / BL unchecked | App checks; BL unique index proposed |
| L6 | P0 | Shipment document upload omitted company | `uploadDocument` resolves ownership |
| L7 | P0 | `getSignedUrlForPath` signed any path | Requires registered document row |
| L8 | P1 | `deleteShipment` / timeline lacked `assertCan` | Fixed |
| L9 | P1 | Missing BL / consignee / notify fields | Columns + form + detail |
| L10 | P2 | Detail page unused option fetches | Removed |
| L11 | P2 | No document generation pipeline | Documented gap (upload-only) |
| L12 | P2 | PDF import does not create shipments | Documented — contracts import only |
| L13 | P2 | Open RLS / stub permissions | Auth blocker — not invented here |
| L14 | P3 | `ShipmentDetailView` orphaned vs EntityWorkspace | Documented; left in place |

## Files changed

1. `src/lib/logistics/validation.ts`  
2. `src/lib/logistics/types.ts`  
3. `src/lib/logistics/db.ts`  
4. `src/lib/logistics/actions.ts`  
5. `src/components/logistics/ShipmentFormModal.tsx`  
6. `src/app/(erp)/logistics/[id]/page.tsx`  
7. `src/lib/documents/actions.ts`  
8. `supabase/migrations/20260805100000_logistics_p0_ownership_columns.sql`  
9. `docs/audits/LOGISTICS_P0_2026-08-05.md`

## Ownership rules (application)

Every create/update resolves:

1. Contract must exist.  
2. `company_id` from input or `contracts.company_id` (required).  
3. `business_case_id` from input or `contracts.business_case_id` (required).  
4. BC company must match shipment company when BC has `company_id`.  
5. Document upload for `entityType=shipment` stamps `shipment_id`, `contract_id`, `business_case_id`, `company_id` and refuses upload without company.

List/report queries are still **not** company-filtered (auth/session company context missing).

## Status workflow

```text
Planned  → Planned | In Transit | Delayed
In Transit → In Transit | Delivered | Delayed
Delayed → Delayed | In Transit | Delivered | Planned
Delivered → Delivered (terminal)
```

Leaving `Planned` requires vessel, voyage, POL, POD, ETD, ETA, consignee, notify party.  
`Delivered` requires ATA or eta_actual.  
`In Transit` / `Delivered` require container or booking number.

## Document findings

| Type | App constant | Generation | Attachment |
| --- | --- | --- | --- |
| Packing List | `packing_list` | None | DMS upload |
| Commercial Invoice | `commercial_invoice` | None | DMS upload |
| Bill of Lading | `bill_of_lading` | None (BL **number** on shipment) | DMS upload |
| Certificate of Origin | `certificate_of_origin` | None | DMS upload |
| Veterinary Certificate | `veterinary_certificate` | None | DMS upload |

Storage bucket `documents` is private. Entity-scoped previews use registered document paths. Path-only signed URL now requires a matching `documents` row. Full company-scoped denial still needs auth/RLS.

## PDF import integration

Contract PDF import (`contracts/import`) does **not** create logistics shipments. No logistics extract mapping for vessel/voyage/containers in import review. Out of scope to invent here.

## Migrations required later (approval)

1. **Apply** `20260804160000_shipments_logistics_columns.sql` if not already on target DB.  
2. **Apply** `20260805100000_logistics_p0_ownership_columns.sql` (company/BL/parties + backfill + BL unique).  
3. Future (not in this batch): `company_id NOT NULL` after backfill; revoke open RLS; ports master; multi-container tables; document generation jobs.

## Manual testing checklist

1. Create shipment on contract with company + BC — succeeds; company stamped.  
2. Create without BC on contract/form — rejected.  
3. Set status In Transit without vessel/ports — rejected.  
4. ETD after ETA — rejected.  
5. Delivered without ATA — rejected.  
6. Duplicate active container — rejected.  
7. Duplicate BL — rejected (app; DB unique after migration).  
8. Delivered → In Transit — rejected.  
9. Upload packing list on shipment — document gets company_id.  
10. Signed URL for unknown path — denied.  
11. Detail shows company, BL, consignee, notify.

## Rollback

Discard the nine files above. If `…05100000` was applied, reverse only via a new forward migration after approval (do not edit applied SQL).

## Unresolved auth/RLS blockers

- Public/open policies on `shipments` and `shipment_timeline_events`.  
- Stub `assertCan` / no session company.  
- Signed URLs still issuable for any registered document while anon/open RLS exists.  
- Cannot enforce company-scoped list queries honestly until auth lands.

## Local readiness

Logistics create/update/delete/timeline flows are **locally ready for manual testing** once `…160000` (+ `…05100000` for new columns) are present. Multi-company isolation and document generation are **not** production-ready.
