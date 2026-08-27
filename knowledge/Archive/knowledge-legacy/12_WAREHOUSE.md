# SKY ERP — Warehouse

## Purpose

Inventory locations, lots, stock movements, and operational receive/issue/transfer/adjust flows for seafood stock.

## Current state

| Item | Location |
| --- | --- |
| Routes | `/warehouse`, `/warehouse/lots/[id]` |
| UI | `src/components/warehouse/*` |
| Lib | `src/lib/warehouse/*` |
| Migration | `20260804170000_warehouse_module.sql` |

### Confirmed entities (from migrations)

`warehouse_locations`, `inventory`, `inventory_lots`, `stock_movements`, `warehouse_transfers`, `inventory_reservations` + SECURITY DEFINER stock RPCs

### Confirmed operations in app actions

Receive · Issue · Transfer · Adjust (coverage of `assertCan` is uneven across ops)

## Confirmed business rules

- Inbound lots need product identity and quantity.
- Do not ship beyond available quantity (domain hard rule).
- Lots carry dates/temperature/location attributes as modeled.
- Contract warehouse tab links operational stock to contracts when wired.

## Constraints

- Root `DATABASE.md` name `warehouse_batches` is not the migration table name (`inventory_lots`).
- Warehouse master admin CRUD (create locations UI) may be limited vs ops board.
- Never bypass inventory RPCs with unsafe raw updates without understanding locks/qty math.

## Known risks / gaps

- SECURITY DEFINER RPCs granted broadly in migration.
- Not all warehouse actions call `assertCan`.
- Multi-company inventory scoping incomplete.

## Development rules

- Prefer existing RPCs/actions for qty changes.
- Keep lot numbers and product FKs consistent.
- Add migrations for new inventory fields; do not edit applied warehouse migration.

## Planned

- Stronger quarantine/hold workflow.
- Mobile-oriented gate views.
- Role-hardened RPC EXECUTE grants.
