# SKY ERP — Finance

## Purpose

Invoices, payments, bank accounts, exchange rates, and finance reporting for seafood contracts.

## Current state

| Item | Location |
| --- | --- |
| Routes | `/finance`, `/finance/invoices`, `/payments`, `/bank-accounts`, `/exchange-rates`, `/finance/reports` |
| UI | `src/components/finance/*` |
| Lib | `src/lib/finance/*` |
| Migration | `20260804180000_finance_module.sql` (+ hub invoices in `…140000`) |

### Confirmed capabilities

- Create invoice, register payment, create bank account, upsert exchange rate.
- Finance nav between submodules.
- Finance reports under `/finance/reports` (top-level `/reports` is placeholder).

### Confirmed business rules

- Invoice belongs to a contract.
- Payment belongs to an invoice.
- Currencies and FX rates are first-class (`currencies`, `exchange_rates`).
- Reports must not mutate data.

## Constraints

- `payments` base table is assumed pre-existing; migration extends it.
- Payment registration uses RPC `finance_register_payment`.
- Do not invent ledger behavior that fights the RPC/allocation model.

## Known risks / gaps

- RPC inserts `payments.business_case_id` but ALTER list in the same migration does not add that column — **schema bug risk**.
- Update/void/delete for invoices/payments incomplete.
- Open RLS + stub permissions.
- Direct `payments.invoice_id` and `payment_allocations` can both exist — understand refresh logic before changing.

## Development rules

- Prefer RPC/actions already used by UI for posting payments.
- Keep amounts/currencies/precision explicit; avoid silent currency coercion.
- New schema fixes = **new** migration files only.
- Finance reports stay read-only.

## Planned

- Credit notes / claims.
- Banking import / reconciliation assists.
- Fix `business_case_id` on payments via approved migration.
- Hardened RLS for financial tables.
