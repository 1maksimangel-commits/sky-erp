# SKY ERP — Products

## Purpose

Seafood SKU master data for contracts, warehouse, and import matching.

## Current state

| Item | Location |
| --- | --- |
| Routes | `/products`, `/products/[id]` |
| UI | `src/components/products/*` |
| Lib | `src/lib/products*` |
| Import | Excel/CSV style import helpers (`xlsx` dependency) |

### Confirmed capabilities

- Create product via modal.
- Bulk import modal with SKU checks (`checkExistingSkus`, `importProducts`).
- Detail workspace (read-oriented).
- Used by contract PDF matching (`buildImportMatches`) and warehouse ops.

## Confirmed business rules

- Products have commercial and scientific names (business context).
- SKUs used on contract lines / warehouse lots must match catalog entries.
- Net vs gross / glaze considerations matter commercially (domain docs) even when not every field is UI-complete.

## Constraints

- No assumption of full update/delete CRUD until actions exist.
- Import must validate rows; reject invalid files.
- Do not invent product columns without migrations.

## Known risks / gaps

- Update/delete incomplete vs list/create.
- Lint warnings around `<img>` usage in products UI.
- Species/grade taxonomy may be free-text in places — keep consistent with existing fields.

## Development rules

- Prefer extending import mapping over one-off parsers.
- Keep SKU uniqueness checks server-side.
- Reuse product pickers in contracts/warehouse rather than duplicating lists.

## Planned

- Full edit/archive.
- Stronger species/grade standardized dictionaries if approved.
