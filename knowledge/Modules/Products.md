# Module — Products

## Purpose

Seafood SKU catalog for contracts, warehouse, and AI matching.

## Current state

Routes `/products`, `/products/[id]` · `src/lib/products*` · `src/components/products*` · Excel import via `xlsx`.

Capabilities: create, bulk import with SKU checks, read-oriented detail.

## Confirmed rules

- Commercial + scientific names (business context).  
- Contract lines and lots should reference catalog SKUs.  
- Import must validate rows and reject invalid files.

## Constraints

- Update/delete incomplete.  
- Do not invent columns without migrations.

## Known risks / gaps

- Free-text species/grade inconsistency risk.  
- Lint warnings around image usage in UI.

## Development rules

- Keep SKU uniqueness checks server-side.  
- Reuse product pickers across modules.

## Planned

- Full edit/archive · optional standardized dictionaries.
