# SKY ERP — Companies and Counterparties

## Purpose

Master data for legal entities (companies) and trading partners (counterparties).

## Current state

| Module | Routes | Lib / UI |
| --- | --- | --- |
| Companies | `/companies`, `/companies/[id]` | `src/lib/companies*`, `src/components/companies/*` |
| Counterparties | `/counterparties`, `/counterparties/[id]` | `src/lib/counterparties*`, `src/components/counterparties/*` |

### Confirmed behavior

- List + detail workspace patterns.
- Create via modal + Server Action (`createCompany`, `createCounterparty`).
- Companies INSERT/UPDATE policies addressed in `20260805010000_companies_insert_policy.sql`.
- Counterparties used as buyer/supplier on contracts and in PDF import matching.

## Confirmed business rules

- **Company** = SKY legal entity owning contracts/accounts.
- **Counterparty** = buyer, supplier, consignee, agent, bank, other partner.
- Prefer active counterparties on new deals.
- Legal name is primary identity for counterparties.

## Constraints

- Never hardcode company UUIDs.
- Detail pages are largely read-only overview today — do not assume full edit CRUD exists.
- Masters are prerequisites for contracts/finance; schema may pre-exist outside this migration folder.

## Known risks / gaps

- Update/delete Server Actions largely absent (create-focused).
- Multi-company switching UX not fully productized.
- Counterparty type taxonomy must stay consistent with contract matching.

## Development rules

- Reuse existing form modals and validation types.
- When linking contracts, use counterparty IDs — do not duplicate party names as sole identity.
- Extend types when adding fields; add migrations for new columns.

## Planned

- Full update/archive flows.
- Richer role flags (buyer/supplier/consignee) if not already sufficient in live schema.
- Company context switcher for operators.
