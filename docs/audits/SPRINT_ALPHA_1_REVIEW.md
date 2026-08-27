# Sprint ALPHA-1 — Review

**Date:** 2026-08-06  
**Objective:** First fully usable commercial workflow  
**Path:** Company → Counterparty → Business Case → Contract → Shipment → Invoice → Payment → Profit  
**Gates:** No migration apply, no commit/push, no new AI infra

## What is now usable (app code)

| Step | Usable? | How |
| --- | --- | --- |
| Company | Yes | `/companies` create |
| Counterparty | Yes | `/counterparties` create buyer + supplier |
| Business Case | Yes | `/business-cases` (company required) + **Create Contract** CTA |
| Contract | Yes | Prefill BC via `?business_case_id=`; hub BC stamps FK |
| Shipment | Yes* | Logistics tab banner + disable until company+BC linked |
| Invoice | Yes* | Contract finance (requires BC) or `/finance/invoices` |
| Payment | Yes* | Invoice **Register Payment** → `/finance/payments?invoice_id=` |
| Profit | Yes | BC detail + `/finance/reports` |

\*Requires approved remote schema (finance RPC, payments.business_case_id, shipment company_id).

## Manual test checklist

1. Create company at `/companies?new=1`  
2. Create buyer + supplier at `/counterparties?new=1`  
3. Create business case with company + parties  
4. On BC detail → **Create Contract** (BC preselected)  
5. Contract → Business Case tab → confirm linked (or create BC from contract)  
6. Contract → Logistics → banner gone → **New Shipment**  
7. Contract → Finance → create invoice → open invoice → **Register Payment**  
8. BC detail + `/finance/reports` → profit result  

## Remaining blockers

| Blocker | Impact |
| --- | --- |
| Unapplied migrations (finance / payments BC / logistics ownership) | Live create may fail until human apply |
| BC schema drift (`number` vs `case_number`) if only 130000 applied | BC create fails |
| No expense UI | Profit ≈ revenue |
| Incomplete update/void (K-10) | Ops cleanup limited |
| Auth / RLS stubs | Not multi-tenant safe |

## Business readiness

**~75%** for a guided demo on a schema that matches the app.  
**~40%** if remote still missing finance/logistics ownership migrations.

## Recommended next sprint (ALPHA-2)

1. Human-approved apply of vertical migrations (see prior migration plan).  
2. Live smoke of one full deal.  
3. Expense create (minimal) so profit is meaningful.  
4. Fix remaining `pnpm lint` react-hooks noise on form modals (quality, not spine).

## Files touched this sprint (discovery / links)

- `ContractFormModal.tsx`, `ContractsView.tsx`  
- `business-cases/[id]/page.tsx`  
- `ContractLogisticsTab.tsx`, `contracts/[id]/logistics/page.tsx`  
- `ShipmentFormModal.tsx`  
- `ContractFinanceTab.tsx`, `contracts/[id]/finance/page.tsx`  
- `PaymentFormModal.tsx`, `PaymentsView.tsx`, `finance/payments/page.tsx`  
- `finance/invoices/[id]/page.tsx`  
- Prior spine: hub-actions, relations, finance profit helper (already in tree)
