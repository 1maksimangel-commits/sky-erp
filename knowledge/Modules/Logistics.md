# Module — Logistics

## Purpose

Shipments and logistics execution against contracts.

## Current state

Routes `/logistics`, `/logistics/[id]` · `src/lib/logistics*` · `src/components/logistics*` · migrations hub + `20260804160000` ( `…150000` historically superseded).

Capabilities: shipment create/update/delete, list/detail, timeline events, contract logistics tab, and multiple actual product lines per shipment.

## Confirmed rules

- Every shipment belongs to one contract; many shipments may reference the same contract and canonical Deal. The Deal ID must agree with the contract's Deal.
- Shipment company is explicit. It must own the contract or be an explicit internal Seller/Buyer on that contract. It does not determine the legal party roles. Operational records remain private to their owner company; a shared contract alone does not expose another company's shipment.
- `shipment_lines` reference canonical products and optionally the exact legal contract product line. Actual quantities never overwrite legally agreed contract quantities. Cross-contract product grafting is rejected.
- Delivered shipment quantities and history are immutable. Planned records can be deleted only where existing downstream FKs permit it.
- Track vessel/voyage/ports/ETD/ETA/status as modeled.  
- Documents attach via DMS.  
- First-class multi-container entity is **Planned**; fields may exist on shipments today.

## Constraints

- Prefer `…160000` columns over superseded `…150000`.  
- Do not invent a third timeline system without need (platform timeline also exists).

## Known risks / gaps

- The canonical detail route uses EntityWorkspace with the product editor. The older standalone ShipmentDetailView remains a compatibility component.
- Phase 2 authenticated company permissions remain active. Phase 6 replaces only the shipment parent-company assumption with explicit legal-party validation; it does not grant anonymous access.

## Development rules

- Keep shipment↔contract FK integrity.  
- Validate dates/status in module validation helpers.
- `scripts/database/shipments-http.mjs` exercises actual server actions and PostgREST in the isolated operations replay. No production data is used.

## Planned

- Native multi-container UX · booking depth · carrier tracking integrations.
