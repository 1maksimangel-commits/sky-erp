# Phase 7 — Deal economics and profitability

This document defines the canonical report. The regression gate below has now been
run and recorded; an independent read-only review is still outstanding.

## One report, explicit perspective

The Deal Economics tab uses `getDealProfitability` and its canonical server-side
exact-decimal engine. Its request identifies the Deal, a selected internal Company (or
consolidated scope), and reporting currency. All monetary result values cross the
application boundary as decimal text. React formats strings; it does not calculate
profit, commissions, conversion or settlement.

Company ownership is not a legal role. Seller/Buyer on Contracts, issuer/recipient
on Invoices and payer/payee on Payments define direction independently. A shared
internal transaction remains one source record. Company reports retain it;
consolidation records explicit eliminations with source IDs.

Company results describe each company's contribution **within the selected Deal**.
This is not a company-wide aggregation across unrelated Deals. The direct link
`/business-cases/<id>?tab=economics` opens the Economics tab; the ordinary detail
route retains its Overview default.

Consolidation requires permission to read the financial inputs for every involved
internal company. A filtered subset is not a complete consolidated report. There
is no service-role browser client, implicit permission expansion or report write
side effect.

## Recognition and completeness

- **Expected:** full agreed Contract product-line values by explicit party
  perspective, with separately identified planned costs. Draft estimates are not
  actual transactions.
- **Actual revenue:** eligible issued Invoice net product value. Payment receipt
  is settlement, and a generated DOCX is an artifact; neither creates additional
  revenue. Cancelled obligations are excluded under the current-state report.
- **Actual COGS:** explicitly realized owned inventory releases with immutable
  lot cost basis. A purchase Invoice does not substitute for release evidence.
  Warehouse transfers and inventory adjustments are not automatically sales.
- **Operating costs and commissions:** explicit eligible source allocations, counted
  once. Posting a source and allocating it does not create two expenses.
- **Cash:** posted incoming/outgoing Payments, invoice allocations and commission
  settlement links. Cash is presented separately from accrual profitability.
- **Product results:** canonical Product references and explicit line allocations.
  Unassigned amounts remain in an unallocated bucket; names are not join keys.

Missing release coverage, unknown inventory cost, missing FX, ambiguous internal
lineage or incomplete cost allocation produces a visible gap. Profit/margin must
remain incomplete rather than reporting a plausible zero-based result. Partial
known subtotals are useful but are labelled as incomplete inputs.

Gross profit is revenue less realized COGS. Net contribution deducts the recorded
Deal operating costs and commissions. This is a Deal contribution report, not a
complete statutory company P&L or tax computation. Percentage margins require a
valid nonzero revenue denominator and complete corresponding inputs.

## Internal inventory lineage

Specific identification by owned lot remains the costing method from pre-work.
Explicit realization connects an Invoice line to its owned release and Contract
line. An intercompany receipt must carry explicit lineage to the seller's
realization to support consolidation without guessing the cost origin.

For Supplier → A → B → Customer, A's external acquisition basis and B's internal
acquisition basis are different company-level inputs. Consolidation must eliminate
the internal revenue and corresponding internal acquisition COGS while retaining
external basis. Simply excluding internal invoices while summing both companies'
COGS is incorrect. Unresolved lineage cannot silently produce final profit.

## FX and history

Actual reporting reads immutable captured FX inputs, preserving original amount,
currency, rate, rate date and evidence. A change to the current exchange-rate
table does not reinterpret captured history. Viewing a report does not silently
capture rates, infer inversion or convert using the latest rate.

The initial report is a current-source report, not an historical as-of ledger or
published report-version service. Source lifecycle changes may legitimately change
current eligibility while retained snapshots preserve what was captured. The UI
does not offer an unsupported historical date selector.

## Commissions

Fixed, per-MT, per-KG and percentage commissions use exact decimal inputs and a
server-calculated preview. The user reviews the basis, beneficiary and allocation
before posting. Any manual override needs an explicit reason. Posted accruals
retain their basis and revision lineage; subsequent source changes are flagged
for review rather than silently rewriting the agreed amount. Settlement links
are separate from accrual and must not count the expense twice.

Beneficiaries may be agents, brokers, intermediaries, external counterparties,
companies, persons or other explicitly named recipients. Names support reviewed
accrual; settlement requires the canonical beneficiary link. Notes remain part of
the commission record. Quantity, net/gross weight, sale revenue, purchase value
and gross-profit basis labels support an explicitly captured value. An agreed
gross-profit basis is frozen input, not a circular calculation from the commission
being created. Canonical Contract amount/weight and Deal weight options remain
available where the server supports direct source calculation.

## Existing implementation preserved

The obsolete `buildExpectedFinanceSummary` is no longer invoked by the Deal
workspace loader. Deprecated historical Finance functions remain isolated; no
new consumer may call them for canonical economics. Existing business forms,
operational records and document generation remain their own source models.

PDF remains PARTIAL and outside scope. Phase 8, remote migrations, commits and
pushes are not part of this implementation.

## Verification checkpoint

Required and recorded PASS: `pnpm db:check`, `pnpm db:replay`, `pnpm core:check`,
`pnpm contracts:check`, `pnpm documents:check`, `pnpm operations:check`,
`pnpm economics:precheck`, `pnpm profitability:check`, `pnpm exec tsc --noEmit`,
`pnpm lint`, `pnpm build` and `git diff --check`. There is no `economics:check`
script; the economics gates are `economics:precheck` and `profitability:check`.

The isolated replay proves the fictional golden chain: external revenue 150,000,
external COGS 100,000, external costs 25,000 and consolidated profit 25,000, with
the internal 120,000 leg eliminated from consolidation and retained in the Company A
and Company B perspectives, plus agent commission 5,000 accrued / 3,000 paid /
2,000 outstanding and immutable multi-currency 23,930.

An independent read-only review remains **pending**. UI checks distinguish
authenticated SSR/action verification from browser interaction; browser automation
is not assumed. `/business-cases/<id>?tab=economics` is covered as an authenticated
SSR route in the replay, not as a browser interaction test.
