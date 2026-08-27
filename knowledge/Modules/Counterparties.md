# Module — Counterparties

## Purpose

Buyers, suppliers, consignees, agents, banks, and other trading partners.

## Current state

Routes `/counterparties`, `/counterparties/[id]` · `src/lib/counterparties*` · `src/components/counterparties*`.

Capabilities: list, detail, **create**. Used as `buyer_id` / `supplier_id` on contracts and in PDF import matching.

## Confirmed rules

- Legal name is primary identity.  
- Prefer active counterparties on new deals.  
- Customer master data stays here — do not duplicate as free text on each contract.  
- CRM may link to counterparties but is a separate relationship layer.

## Constraints

- Update/delete actions largely absent.  
- Type taxonomy must stay consistent with matching logic.

## Known risks / gaps

- Incomplete CRUD.  
- Role flags (buyer/supplier/consignee) depend on live schema fields.

## Development rules

- Link contracts by counterparty ID.  
- Extend validation/types with migrations when adding fields.

## Planned

- Full edit/archive · richer role modeling if approved.
