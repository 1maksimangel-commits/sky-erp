# Module — Companies

## Purpose

Legal entities that own contracts, bank accounts, and inventory.

## Current state

Routes `/companies`, `/companies/[id]` · `src/lib/companies*` · `src/components/companies*` · policy migration `20260805010000_companies_insert_policy.sql`.

Capabilities: list, detail workspace, **create** via modal/Server Action. Table `companies` is a prerequisite master (may pre-exist outside this migration folder).

## Confirmed rules

- Company = SKY legal entity for a deal.  
- Every contract belongs to one company.  
- Never hardcode company UUIDs.  
- Representative fields (when present): code, name, short_name, country, city, tax_id, registration_number, contacts, `is_active`.

## Constraints

- Detail is largely read-only today — do not assume update/delete actions exist.  
- Multi-company switcher not fully productized.

## Known risks / gaps

- Incomplete CRUD.  
- Ownership filters incomplete across child modules.

## Development rules

- Reuse Company form modal patterns.  
- New columns → migration + types.

## Planned

- Update/archive flows · operator company context switcher.
