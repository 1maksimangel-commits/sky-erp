# Module — Finance

## Purpose

Invoices, payments, banks, FX, and finance reports.

## Current state

Routes under `/finance/*` · `src/lib/finance*` · `src/components/finance*` · migration `20260804180000` (+ hub invoices).

Capabilities: create invoice, register payment, bank accounts, exchange rates, `/finance/reports`. Top-level `/reports` is a placeholder.

## Confirmed rules

- Invoice → contract; payment → invoice.  
- Reports are read-only.  
- Prefer existing payment RPC / allocation model.  
- Currency explicit; outstanding = amount − allocations (business intent).

## Constraints

- `payments` table assumed pre-existing; migration extends it.  
- Do not fight dual paths (`payments.invoice_id` vs `payment_allocations`) without understanding refresh logic.

## Known risks / gaps

- RPC inserts `payments.business_case_id` without matching ALTER in migration set.  
- Update/void incomplete.  
- Open RLS + stub permissions.

## Development rules

- Schema fixes = **new** migrations only.  
- Keep money formatting via finance formatters.

## Planned

- Fix `business_case_id` · credit notes/claims · bank import assists · hardened RLS.
