# Review: Commercial spine workflow (Company → Profit)

**Date:** 2026-08-06  
**Specialists:** PO → Solution Architect → Backend → Frontend → Security (app-side) → QA → Docs  
**Gates:** No migration apply, no remote Supabase, no commit/push, no `.env` changes.

## Objective

Make one complete business workflow usable in the app:

Company → Counterparty → Business Case → Contract → Shipment → Invoice → Payment → Profit result

## What was fixed (reuse-first)

1. **Contract ↔ Business Case FK** — hub BC create stamps `contracts.business_case_id`; loaders prefer FK then contract_number fallback.
2. **Hub finance → finance module** — hub invoice/payment call `createInvoice` / `registerPayment` (allocations + outstanding).
3. **Payment UI** — contract finance tab requires selecting an invoice.
4. **Profit visibility** — BC detail + contract BC tab show revenue/expenses/profit via `getBusinessCaseProfitResult`.
5. **Company required** on business case create (server + form).

## Migrations awaiting approval (not applied)

| Migration | Why |
| --- | --- |
| `20260805050000_payments_business_case_id.sql` | Payment BC stamp / reports (K-03) |
| `20260804180000_finance_module.sql` | If finance tables/RPC missing remotely |
| `20260805100000_logistics_p0_ownership_columns.sql` | Shipment company/BL columns if missing |

No new migration authored in this pass.

## Manual test sequence

1. `/companies` → create company  
2. `/counterparties` → create buyer + supplier  
3. `/contracts` → create with company, buyer, supplier  
4. Contract → Business Case tab → Create Business Case (verify link + deep link)  
5. Contract → Logistics → create shipment (should inherit BC/company)  
6. Contract → Finance → create invoice (amount > 0)  
7. Contract → Finance → register payment against that invoice  
8. `/business-cases/{id}` and `/finance/reports` → confirm profit result  

## Residual blockers

- Expense create UI missing → profit often equals revenue  
- Update/void masters & finance (K-10)  
- Auth / company session / RLS still stubbed  
- Remote schema may lag migrations above  

## Next highest business value

Apply finance + logistics ownership migrations (human-approved), then seed one end-to-end deal and verify shipment create + payment RPC on the live project.
