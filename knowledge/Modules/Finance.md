# Module — Finance

## Purpose

Invoices, payments, banks, FX, and finance reports.

## Current state

Routes under `/finance/*` · `src/lib/finance*` · `src/components/finance*` · migration `20260804180000` (+ hub invoices).

Phase 6 retains the existing `invoices`, `invoice_items`, `payments`, `payment_allocations`, `expenses`, `deal_commission_links` and `bank_accounts` tables. New behavior is in `20260910110000_operations_finance.sql`; historical migrations remain unchanged.

Invoices have explicit issuer/recipient Company-or-Counterparty references and legal party snapshots from the selected Contract. `company_id` is the owning company perspective; it never implies Seller. `invoice_type` remains legacy display metadata; current invoice reads derive sales/purchase perspective from explicit parties and the selected company. Generated Commercial Invoice DOCX artifacts remain separate, with an optional explicit `generated_document_id` link.

`finance_save_invoice` saves Draft header and lines atomically. PostgreSQL numeric calculates line totals, tax and obligation amounts. Issued values and legal history are locked; unpaid obligations may be cancelled. `finance_register_payment` uses explicit parties and original currency; `operational-actions.ts` also supports standalone payments with explicit allocations across invoices. Only Paid allocations settle balances; Pending/Cancelled money does not. Removing the last allocation never guesses settlement from the legacy `invoice_id` hint. Legacy direct settlement remains readable for pre-existing records.

`/finance/expenses` and `/finance/commissions` provide scoped operational records and edits/cancellation. Commission basis is fixed, per MT, per KG or percentage; SQL numeric calculates the canonical `expected_amount`. No Deal profit calculation is introduced.

## Confirmed rules

- Invoice → Contract → canonical Deal. Payment → explicit payer/payee; allocations → Invoice(s).
- Reports are read-only.  
- Prefer existing payment RPC / allocation model.  
- Original currency and amount are retained; no implicit FX conversion. Outstanding = amount − Paid allocations.
- Explicit internal financial parties can read their shared transaction, without access to the other company's private bank accounts or unrelated master records. Owner permissions control writes.

## Constraints

- Reconstruction is the Phase 1 canonical replay, never selective historical SQL through the SQL Editor.
- New authenticated financial records require explicit legal parties; pre-existing legacy records are retained.

## Known risks / gaps

- Legacy finance report aggregates and profitability are not the Phase 7 economic model.
- Bank import, credit notes and claims remain future work.

## Development rules

- Schema fixes = **new** migrations only.  
- Keep money formatting via finance formatters.

## Planned

- Phase 7: explicit company-perspective Deal economics using the retained original-currency transaction inputs.
- Regression evidence: `scripts/database/finance-http.mjs`, invoked by `pnpm operations:check` and the canonical replay. It verifies actual authenticated actions, not mock CRUD.
