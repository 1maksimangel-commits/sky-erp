# SKY ERP — Logistics

## Purpose

Shipments, containers/voyage fields, ports, ETD/ETA, and logistics timeline for export contracts.

## Current state

| Item | Location |
| --- | --- |
| Routes | `/logistics`, `/logistics/[id]` |
| UI | `src/components/logistics/*` |
| Lib | `src/lib/logistics/*` |
| Migrations | `20260804140000_contract_hub.sql`, `20260804160000_shipments_logistics_columns.sql` (+ historical `…150000`) |

### Confirmed capabilities

- Shipment create/update/delete via Server Actions.
- List + detail (EntityWorkspace pattern).
- Shipment timeline events table/support.
- Contract logistics tab reuses shipment concepts.

## Confirmed business rules

- Every shipment belongs to one contract.
- Track vessel/voyage/ports/ETD/ETA/status as modeled in schema.
- Logistics documents attach via Documents module / contract documents.

## Constraints

- `…150000_logistics_extensions.sql` is historically superseded by `…160000` — prefer the later migration’s columns.
- First-class **Containers** entity is not fully productized as its own module (fields may exist on shipments).

## Known risks / gaps

- `ShipmentDetailView.tsx` appears orphaned vs EntityWorkspace detail.
- Root `DATABASE.md` mentions `containers` as a table name — may not match live modeling.
- Open RLS / stub permissions apply here too.

## Development rules

- Keep shipment ↔ contract FK integrity.
- Extend timeline rather than inventing a third timeline system without need (note: platform `timeline_events` also exists).
- Validate dates and status transitions in actions/validation modules.

## Planned

- Native multi-container shipments, seals, weights.
- Booking workflow depth (carrier, cut-off).
- External tracking integrations.
