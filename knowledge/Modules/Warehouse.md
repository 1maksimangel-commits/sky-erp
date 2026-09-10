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

- Phase 2 removed anonymous grants; Phase 6 public stock RPCs remain security invoker.
- Shared physical locations require explicit global Admin assignment in `warehouse_company_access`. This does not expose another company's stock or Product master.
- Existing balances are retained as opening quantities; migration does not invent missing historical movements.

## Phase 6 transaction layer

`stock_movements` is the atomic write path. A permission-checked database trigger locks the owner/location/product inventory, checks available and lot quantities, and updates its balance projection. Receive, release, transfer and adjustment actions use this path. Movement history cannot be edited/deleted; corrections are new adjustments. Direct balance writes are rejected. Reservations update available/reserved projections atomically.

Inventory uniqueness is `(company_id, warehouse_id, product_id)`. The same physical location and same Product ID can hold separate owner balances. Initial receipt of another company's Product requires an explicit global Admin action; a stock label and unit snapshot support subsequent owned-stock operations without granting access to that private Product master. Product unit changes do not reinterpret existing stock.

Operations accept explicit owner, Deal, Contract and Shipment. Database checks enforce consistent provenance and Contract internal-party participation. Transfers retain lot production/expiry dates. The operation modal uses canonical ID selectors; the board identifies owner and stock unit.

`scripts/database/warehouse-http.mjs`, called by the operational replay gate, verifies real authenticated server actions, 100 MT receipt/35 MT release, same-product Company B 20 MT, physical 85 MT, isolation, concurrency, reservations, adjustments, transfer, traceability and immutable history/cache behavior.

## Development rules

- New inventory fields → new migration.  
- Keep lot numbers and product FKs consistent.

## Planned

- Quarantine/hold workflow · hardened RPC grants · mobile gate views.
