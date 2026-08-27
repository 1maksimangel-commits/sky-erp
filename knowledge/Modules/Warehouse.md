# Module — Warehouse

## Purpose

Locations, inventory, lots, and stock movements for seafood.

## Current state

Routes `/warehouse`, `/warehouse/lots/[id]` · `src/lib/warehouse*` · `src/components/warehouse*` · migration `20260804170000`.

Entities: `warehouse_locations`, `inventory`, `inventory_lots`, `stock_movements`, `warehouse_transfers`, `inventory_reservations` + stock RPCs.

Ops actions: receive, issue, transfer, adjust.

## Confirmed rules

- Lots need product identity and quantity.  
- No silent negative stock.  
- Prefer RPCs/actions for quantity changes.  
- `inventory_lots` is the lot table (not outdated `warehouse_batches` name).

## Constraints

- Location admin UI may be limited vs ops board.  
- Do not bypass RPCs with unsafe raw qty updates.

## Known risks / gaps

- SECURITY DEFINER RPCs broadly granted.  
- Uneven `assertCan` coverage.  
- Multi-company inventory scoping incomplete.

## Development rules

- New inventory fields → new migration.  
- Keep lot numbers and product FKs consistent.

## Planned

- Quarantine/hold workflow · hardened RPC grants · mobile gate views.
