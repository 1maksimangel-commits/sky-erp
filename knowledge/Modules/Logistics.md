# Module — Logistics

## Purpose

Shipments and logistics execution against contracts.

## Current state

Routes `/logistics`, `/logistics/[id]` · `src/lib/logistics*` · `src/components/logistics*` · migrations hub + `20260804160000` ( `…150000` historically superseded).

Capabilities: shipment create/update/delete, list/detail, timeline events, contract logistics tab.

## Confirmed rules

- Every shipment belongs to one contract.  
- Track vessel/voyage/ports/ETD/ETA/status as modeled.  
- Documents attach via DMS.  
- First-class multi-container entity is **Planned**; fields may exist on shipments today.

## Constraints

- Prefer `…160000` columns over superseded `…150000`.  
- Do not invent a third timeline system without need (platform timeline also exists).

## Known risks / gaps

- Orphaned `ShipmentDetailView` vs EntityWorkspace.  
- Open RLS / stub permissions.

## Development rules

- Keep shipment↔contract FK integrity.  
- Validate dates/status in module validation helpers.

## Planned

- Native multi-container UX · booking depth · carrier tracking integrations.
