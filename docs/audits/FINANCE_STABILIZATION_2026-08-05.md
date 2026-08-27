# Finance Stabilization Audit — 2026-08-05

Scope: Finance module and direct relationships (contracts, business cases, payments, currencies, company ownership).  
Constraints: repository-only; no remote Supabase; migrations not applied; no auth/RLS code changes; ≤12 implementation files; no commit/push.

## Current finance architecture

| Layer | Location |
| --- | --- |
| Routes | `src/app/(erp)/finance/*` (dashboard, invoices, payments, bank accounts, exchange rates, reports) |
| UI | `src/components/finance/*` |
| Domain | `src/lib/finance/{actions,db,validation,format,types}.ts` |
| Contract link | `src/lib/contracts/finance.ts`, contract finance tab |
| Schema | `supabase/migrations/20260804180000_finance_module.sql` |
| Known P0 fix | `supabase/migrations/20260805050000_payments_business_case_id.sql` (unapplied) |

**Write paths**

1. `createInvoice` → insert `invoices` + `invoice_items` (app-side totals).
2. `registerPayment` → RPC `finance_register_payment` → payment + allocation + optional bank txn → `refresh_invoice_balances`.
3. `createBankAccount` → `bank_accounts`.
4. `upsertExchangeRate` → `exchange_rates` upsert on `(base, quote, rate_date)`.

**Read paths**

- Lists/dashboard/reports in `db.ts` aggregate invoices, payments, expenses with JS `toNumber` / status derivation.
- Reports are display-only (no mutate actions).

## Verified schema

From `20260804180000_finance_module.sql` (plus prior hub tables):

| Entity | Present | Notes |
| --- | --- | --- |
| currencies | yes | ISO codes; seeded |
| exchange_rates | yes | unique `(base_currency, quote_currency, rate_date)`; rate = 1 base → rate quote |
| banks / bank_accounts | yes | `company_id` NOT NULL on accounts |
| bank_transactions | yes | linked to payments/expenses |
| invoices | yes | types/statuses; `company_id` nullable; `business_case_id`; amounts |
| invoice_items | yes | qty/price/tax/line_total |
| payments | yes (pre-existing + alters) | `invoice_id`, `contract_id`, `company_id`, bank, reference |
| payments.business_case_id | **missing in 04180000** | RPC inserts it; fixed by **05050000** (unapplied) |
| payment_allocations | yes | amount > 0 |
| expenses / expense_categories | yes | company-scoped; no dedicated UI create flow |
| finance_register_payment | yes | SECURITY DEFINER, `search_path=public` |
| refresh_invoice_balances | yes | SECURITY DEFINER |

**Not first-class tables/UI**

- Commissions, dedicated receivables/payables ledgers, value_date, base_currency_amount, payment approval workflow, invoice void/update, live FX provider, full P&L/COGS.

Receivables/payables/cash-flow/profit are **report projections**, not separate tables.

## Verified defects

| ID | Severity | Defect | Disposition |
| --- | --- | --- | --- |
| F1 | P0 | RPC inserts `payments.business_case_id` without column in 04180000 | Existing additive migration `20260805050000` — **not applied** |
| F2 | P0 | `finance_register_payment` / `refresh_invoice_balances` granted to `anon` | Documented blocker — no grant weakening/tightening in this task |
| F3 | P1 | Bank/FX actions lacked `assertCan("finance.write")` | **Fixed** in `actions.ts` |
| F4 | P1 | Invoice create allowed missing company; no contract/BC company match | **Fixed** (resolve + validate ownership) |
| F5 | P1 | Payment could use mismatched currency / cross-company bank account | **Fixed** (pre-RPC checks) |
| F6 | P2 | Weak currency/date/amount validation | **Fixed** in `validation.ts` |
| F7 | P2 | Money math used raw JS floats for totals | **Mitigated** with `roundMoney` (cent rounding; not full decimal library) |
| F8 | P2 | Reports sum multi-currency nominal amounts | **Documented** + UI disclaimer; formulas unchanged |
| F9 | P2 | No unique `(company_id, invoice_number)` | **Proposed** in `20260805090000` |
| F10 | P2 | No `payments.company_id` / `invoices.company_id` indexes | **Proposed** in `20260805090000` |
| F11 | P2 | List/report queries do not filter by active company | Auth/company context not ready — blocker |
| F12 | P3 | Profit ≈ sales invoice revenue − expenses (incomplete trading P&L) | Documented; formulas not replaced |
| F13 | P3 | No payment cancel/update/idempotency key; no invoice edit/void | Documented gaps |
| F14 | P3 | `invoices.company_id` / `payments.company_id` nullable in schema | Documented; NOT NULL deferred until auth + backfill |

## Files changed

1. `src/lib/finance/format.ts` — `roundMoney`, currency helpers  
2. `src/lib/finance/validation.ts` — company/currency/date/amount rules  
3. `src/lib/finance/actions.ts` — ownership checks, assertCan bank/FX, rounded money, schema hints  
4. `src/lib/finance/db.ts` — load error hint for `05050000`  
5. `src/components/finance/ReportsView.tsx` — multi-currency disclaimer  
6. `supabase/migrations/20260805090000_finance_stabilization_indexes_proposal.sql` — additive indexes/unique proposal  
7. `docs/audits/FINANCE_STABILIZATION_2026-08-05.md` — this report  

(Existing, not edited: `20260805050000_payments_business_case_id.sql`)

## Migrations proposed

| Migration | Purpose | Apply? |
| --- | --- | --- |
| `20260805050000_payments_business_case_id.sql` | Add `payments.business_case_id` + FK + index | **Required** before payment RPC is reliable |
| `20260805090000_finance_stabilization_indexes_proposal.sql` | `payments/invoices.company_id` indexes; unique `(company_id, invoice_number)` when clean | Optional; skip unique if duplicates exist |

Do not edit prior migrations. Do not apply without approval.

## Financial calculation findings

- Invoice totals: `line = qty * unit * (1 + tax%)`; header `subtotal` / `tax_amount` / `amount` computed in app on create only.
- Outstanding: refreshed by RPC from allocations (+ unallocated invoice-linked payments). Dual path intentional; refresh avoids double-count when allocation exists.
- Partial payments supported; overpayment blocked in app and RPC.
- Credit notes / freight / commissions / bank charges / FX gains are **not** integrated into profit reports.
- Profit by BC/contract = sum(sales invoice amounts) − sum(expenses) — incomplete trading profitability model; **left unchanged**.
- JS `Number` remains; new creates round to 2 decimals. Historical rows are not rewritten.

## Currency findings

- Supported set: USD, EUR, RUB, CNY, JPY, KRW, AED (`FINANCE_CURRENCIES`).
- Exchange rate semantics (documented in validation): **1 base = rate quote** (e.g. USD/CNY = 7.25).
- Upsert is dated; historical rates preserved by unique key.
- No automatic conversion on invoice/payment create; payment currency must match invoice currency (enforced).
- Reports/cash-flow do **not** convert to a base currency.
- No live FX provider (by design for this task).

## Payment and invoice findings

**Payments**

- Create via RPC only; no update/delete/cancel UI.
- Status default `Paid`; no approval workflow.
- No value_date / base_currency_amount columns.
- No idempotency key — double-submit can create two payments (race still possible under concurrent clients; RPC locks invoice row).
- Documents: not wired as payment attachments in finance actions.

**Invoices**

- Sales/Purchase/Proforma/Credit Note types exist; create flow present; edit/void incomplete.
- Number uniqueness not enforced until `05090000` applied.
- Due/overdue derived in UI/RPC when outstanding > 0.
- Taxes via line `tax_rate`; no separate VAT/freight/commission lines.

## Security findings

| Finding | Status |
| --- | --- |
| Open RLS / anon can execute DEFINER payment RPC | Blocker (do not weaken; tighten only with approved auth) |
| Stub `assertCan` / role model | Bank/FX now call assertCan; real enforcement still stubbed |
| Company isolation in DB | Columns exist; queries not company-scoped; RLS not company-aware |
| App-side ownership checks on create invoice / register payment | Added (defense in depth, not a substitute for RLS) |
| Client-trusted amounts | Server re-validates and rounds; still trust client line inputs within validation |
| Bank details in UI | Shown for finance users; no extra masking in this pass |
| Secrets in logs | No finance logging of connection strings observed |

## Unresolved auth/RLS blockers

1. Real authentication and session company context not implemented.  
2. RLS policies remain open / permissive; inventing company-scoped RLS now would be unsafe without auth.  
3. DEFINER RPCs granted to `anon` — revoke/replace requires approved security migration.  
4. List/report APIs cannot honestly enforce company boundaries until (1)+(2).  
5. Making `company_id` NOT NULL on invoices/payments needs backfill + auth.

## Manual testing checklist

1. Apply (locally, if approved) `04180000` then `05050000`; reload schema.  
2. Create invoice with contract that has `company_id` — company auto-inherits; mismatch rejected.  
3. Create invoice with due date before issue date — rejected.  
4. Register partial payment — outstanding/status update.  
5. Attempt overpayment — rejected.  
6. Attempt payment in wrong currency — rejected.  
7. Attempt payment with bank account of another company — rejected.  
8. Create bank account / upsert FX — permission stub still allows admin path; validation rejects bad ISO codes.  
9. Open `/finance/reports` — read-only; disclaimer visible; no edit controls.  
10. Confirm payment RPC failure without `05050000` shows schema hint mentioning that file.

## Rollback procedure

1. Revert the seven files listed above (git checkout / discard working tree).  
2. Do **not** reverse-apply migrations in place; if `05090000` was applied, drop the new indexes only via a new forward migration after approval.  
3. Do not delete historical invoice/payment rows as rollback.

## Remote actions requiring approval

- Apply `20260805050000_payments_business_case_id.sql`  
- Apply `20260805090000_finance_stabilization_indexes_proposal.sql` (after duplicate check)  
- Future: revoke anon EXECUTE on finance DEFINER functions  
- Future: company-scoped RLS + NOT NULL company_id backfill  
- Future: payment cancel/void and invoice amendment workflows  

## Local readiness

Finance is **locally ready for manual testing** of create-invoice / register-payment / bank / FX flows **after** finance schema migrations are present in the target DB. Payment registration remains broken until `05050000` is applied. Company isolation is **not** production-ready (auth/RLS blockers).
