# Claude Code independent review — Phase 7 prerequisites

## Closing verdict: READY

Closing read-only review verified L1, L2 and L5 CLOSED, with zero new Critical,
High or Medium issues. Before/after hashes of all 33 changed files were identical.
Codex independently verified the cited final branches and exact-rate fixture.
All required gates passed after these corrections. Remaining Low observations
are retained below transparently: display-only FX precision, profile-refresh
semantics/notice, padded direct transfer input, two extra coverage opportunities,
and a legacy assistant help suggestion. None changes immutable reporting inputs.

### Closing review (verbatim)

## Verdict: **READY** — 0 new Critical / 0 High / 0 Medium

Scope honored: only the two code corrections, the doc correction, and their directly relevant tests/dependencies. Read-only; no commands run, so gate *results* are taken as reported — what I verified is the source and the test content that those gates execute.

---

### L1 — FX text no longer coerced through `Number` — **CLOSED**

- `src/lib/finance/actions.ts:284` is now `rate: input.rate` (prior review cited `Number(input.rate)` at this exact line). The only conversion is `basisDecimal(normalized.rate)` at `actions.ts:299`.
- `src/lib/finance/validation.ts:148-159` replaced the `Number.isFinite` gate with `basisDecimal(input.rate)` in try/catch, then compares the **normalized text** (`!== "1.000000000000"`, `startsWith("-")`, `=== "0.000000000000"`). `types.ts:87` widened to `number | string`.
- `decimal.ts:11-29` is a genuine controlled 12-place boundary: BigInt digit scaling, no float arithmetic, half-away-from-zero (`(digits + divisor/2)/divisor`) matching `round(numeric)`, sign suppressed when the result is zero. `12345.123456789123` → fraction length 12 → `shift = 0` → returned byte-identical.
- `basisDecimal` at `actions.ts:299` runs outside try/catch, but validation already invoked it on the identical value and returned on throw — deterministic, cannot throw twice. Not an issue.
- **UI passes original text:** `ExchangeRatesView.tsx:58` sends `rate: form.rate`, the raw `e.target.value` string from line 121. No `Number`/`parseFloat` anywhere in the component.
- **End-to-end evidence:** `economics-http.mjs:65` now includes `['CNY',1,'12345.123456789123','12345.12']`; line 66 writes via the real action, line 69 captures the snapshot, line 71-72 asserts `typeof fx_rate === 'string'` and `fx_rate === '12345.123456789123'` through the text-returning RPC (`getReportingInput` → `economics_reporting_input`), and line 73 asserts `reporting_amount === '12345.12'`. Note the test never reads `rate` back through PostgREST-as-number — the assertion is on the immutable snapshot, which is the value Phase 7 would consume. Lines 74-75 rewrite the same `(base,quote,date)` key to `'1'` and deep-compare `before`/`after`: **a later rate edit provably does not alter the captured input.**
- **Negative path re-derived by hand, not from labels** (`operational-decimal-http.mjs:26-28`): `Infinity` and `MAX_SAFE_INTEGER+1` throw at `decimal.ts:16`; `'NaN'` fails the regex at line 18; `'-0.1'` → `"-0.100000000000"` → rejected by the sign check; `'0.0000000000001'` → rounds to `"0.000000000000"` → rejected by the zero check. All four reject correctly.

### L5 — existing linked profile code preserved on collision — **CLOSED**

- `counterparties/actions.ts:96` now falls back to `existing.data?.code ?? null` instead of unconditional `null`. Traced all branches: existing link + foreign code owner → keeps `existing.data.code`; existing link + no collision or self-match → `company.code`; no link + non-reusable collision → `null` insert; no link + reusable orphan (`!source_company_id && legal_name === company.name`) → adopts `company.code` on the reused row.
- Tested through **real authenticated actions**, not SQL: `economics-identity-http.mjs:40-41` seeds a foreign row owning `companyB.code` with a different legal name; `:47-50` asserts the new profile takes `code === null` without stealing it; `:51` sets `ECON-CUSTOM-COMPANY-PROFILE` as user B; `:52-54` re-runs `addCompanyAsCounterparty` under the live collision and asserts the custom code **survives** and the canonical ID is stable. `:55-56` then makes the colliding row a same-name orphan and confirms the existing link still wins over orphan reuse.
- **Uniqueness re-derived:** `20260910140000_economic_identifiers.sql:6` is `unique(company_id, code)` with default NULLS DISTINCT, so the `null` fallback cannot raise a unique violation against another null-code counterparty in the same workspace. The prior failure mode (unique violation on repeat call) is genuinely gone rather than relocated.

### L2 — documentation — **CLOSED**

`EconomicsPrerequisites.md:110-115` now says FX entry and the new actions accept exact decimal strings while "legacy invoice-payment and bank-opening forms still accept bounded numbers only." That matches the code: `validation.ts:102,131` still gate on `Number.isFinite`, and `types.ts` still types those fields as `number`. No longer an overstatement.

---

### Non-blocking observations (Low, none new-Medium)

- **Rate list display crosses a double.** `finance/db.ts:442` maps `rate: toNumber(row.rate)` and `ExchangeRatesView.tsx:173` renders it, so a 12-place rate can display with a shortest-round-trip tail (ulp ≈ 1.8e-12 at that magnitude). Display only — storage and the immutable snapshot path are exact text, verified above. Pre-existing read-boundary theme, not introduced by these corrections; it just becomes reachable now that 12-place entry works.
- **L5 asymmetry.** A custom profile code is preserved *only* when another row holds `company.code`; with no collision the sync still overwrites it with `company.code` (`actions.ts:96`). Consistent with the action's whole-profile refresh semantics, so not a defect — but the collision-only guard is untested for that leg.
- **Silent null code** on a first-time colliding profile (no user-facing notice). Safe per the NULLS DISTINCT check above.
- Prior L3, L4, L6, L7 remain open and untouched by these corrections; nothing I read changes their disposition.

No Critical, High, or Medium issue was introduced by either correction, and no SQL, RLS, or immutability behavior differs from the state that returned READY.

## Second review and final corrections

Second review returned READY: 0 Critical, 0 High, 0 Medium, 7 Low. File hashes
before/after the read-only review were identical. Codex independently confirmed
L1 (FX text coerced to Number), L2 (documentation overstated legacy string input)
and L5 (refresh could clear an existing Counterparty code). FX entry now preserves
text at a controlled twelve-place boundary; the existing profile retains its
code on collision; documentation states the legacy number-only limitation.
Focused regression assertions accompany both code corrections.

L3 is a confirmed fail-closed whitespace edge for direct transfer RPC callers;
the existing UI trims it. L4/L7 are additional test opportunities, not known
unguarded paths. L6 is a confirmed cosmetic legacy assistant help suggestion.
These low-priority items do not change reporting input integrity and are not
expanded into unrelated functionality here. Closing gate/review results are recorded above.

### Second review (verbatim)

## Verdict: **READY** — 7 remaining issues (0 Critical, 0 High, 0 Medium, 7 Low)

I re-derived every first-review item from source rather than from the disposition table. All confirmed gaps from the first review are genuinely closed, and the mechanics of the four prerequisite areas hold up. The seven remaining items are Low: one unspecified decimal boundary, one doc overstatement, two coverage gaps, and three fail-closed/cosmetic edges. None affects the integrity of the captured inputs, and none is a profitability implementation.

---

### Independent verification of the 11 dispositions

| # | Claim | Result |
|---|---|---|
| 1 | NULL-company identifier uniqueness | **Verified.** Partial indexes `20260910140000_economic_identifiers.sql:14-17`; real owner-level rollback test `economics-identity-http.mjs:56-73` proves duplicate `ECON-NULL-*` labels raise `unique_violation` while two absent codes still insert (71-72). `case_number` uniqueness survives transitively via `sync_core_deal_number` (`20260909090000:40-53`, insert branch rejects disagreeing aliases, update branch forces `number`), asserted at `economics-identity-http.mjs:16-17`. |
| 2 | Counterparty ownership | **Premise was wrong, fix is right.** `counterparties` parent is `source_company_id → companies` (`20260908120000:232`), and `enforce_ownership:152-158` raises `Parent company mismatch` if `company_id` differs from the represented company — so the first review's proposed "use the active company" correction would have *failed*. `requireCoreCompany(companyId)` returns `companyId` (`src/lib/core/ownership.ts:6-16`) and gates access; the insert now states that owner explicitly (`actions.ts:101`). Repeat-call code collision fixed at `actions.ts:96` (`codeMatch.data.id === existing.data?.id`) and covered by `economics-identity-http.mjs:44-50` (reuse while active company is B, retry stability, null-code collision). See L5 for the residual edge. |
| 3 | Operational decimal inputs | **Verified.** `operational-actions.ts:16-52` routes expense/commission/standalone-payment/allocation through `moneyDecimal`/`basisDecimal` with a nonnegative check on both normalized and raw text, `positiveAmount` rejecting `"0.00"`, and `z.input<>` types preserving number-or-string callers. `operational-decimal-http.mjs:8-63` stores `0.1+0.2` and asserts `0.3` (a persisted binary tail would fail the equality), rejects `Infinity`/`MAX_SAFE_INTEGER+1`/`'NaN'`, rejects `'0.001'`, and confirms `30 × 95.04 = 2851.2` and `0.00125 × 100000 = 125` with rates read back at full precision. |
| 4 | Inventory decimal read boundary | **Verified.** `warehouse_cost_input` returns `::text` for quantity, unit cost, `cost_amount` and separately labelled lot remainder (`20260910130000:87-103`); `inventory-cost-http.mjs:72-82` asserts `9007199254740993.123456789` and `-9007199.254740993123456789` — values a JSON double cannot represent, so the assertion can now actually fail on precision loss. |
| 5 | RLS aggregate over-allocation | **Confirmed false positive, independently.** `erp_private.economic_source` is `security definer` and *requires* `finance.read` on the source owner before returning (`20260910120000:71-73`); the guard then pins `new.company_id` to that same owner (line 125). Every sibling allocation row therefore carries the company the inserter must already be able to read, so the `sum()` at line 168 cannot be truncated. This does not rest on role inheritance. |
| 6 | Trigger-level immutability | **Verified as real.** `economics-http.mjs:93-101` issues raw `update`/`delete` through `core.sql`, which runs as `postgres` in the isolated container (`replay.mjs:45`) — RLS is bypassed, so the `tg_op<>'INSERT'` raises at `...120000.sql:83,122` are actually reached, and the handler re-raises if the message doesn't match or if the statement succeeds. |
| 7 | Historical vs current status | **Verified.** `economics-http.mjs:78-79` cancels the source after capture and asserts `source_status==='Posted'`. |
| 8 | New-table matrix | **Adequately replaced.** Cross-owner INSERT with an owned source is attempted for both tables (`economics-http.mjs:50-51,77`), plus bilateral read isolation (58,81,87), reparenting (88) and delete (89); `auth-rls.sql:25-28` still requires the 4-policy set. Both tables are `company_id not null`, so the skipped "NULL SELECT" leg is vacuous. |
| 9 | precheck security prefix | **Verified** `package.json:17`. |
| 10 | Legacy consumer detection | **Verified.** `economics-isolation.test.mjs:17-30` walks all of `src/**/*.ts(x)` with a 2-file allowlist and refuses symlinks; the banner assertion `/>\s*Legacy reports — unverified…/` matches user-visible JSX (`ReportsView.tsx:81-82`), not a comment. Removed entrypoints confirmed: the business-case page/tab no longer import or render profit, and `ai.ts:124-128` returns a refusal. |
| 11 | Incompatible destination lot | **Verified documented** at `EconomicsPrerequisites.md:79-82`; `...130000.sql:60-64` still refuses to guess. |

Also independently confirmed: the `auth-rls.sql:370-379` generated-column exclusion is coverage-neutral (it exists because `stock_movements.cost_amount` is `generated always`, and the matrix still attempts the same cross-company insert); the six new `public` functions are all `security invoker`, so `auth-rls.sql:33-34`'s "Unreviewed security-definer RPC" assertion still binds; `history.mjs:31-33` hashes the actual `ai.ts` bytes, so the `history-lock.json` update is a real re-review, not a rubber stamp; and the rewritten `warehouse_transfer_owned` destination insert still fires `z_post_stock` (`20260910100000:100`), which is where all quantity/owner/unit validation lives (`warehouse_post_movement:135-141` is a bare wrapper).

---

### Remaining Low issues

**L1 — FX rate is the one canonical input still crossing a JS Number.** `src/lib/finance/actions.ts:284` does `rate: Number(input.rate)`, and `validation.ts:150` requires `Number.isFinite`, so exact decimal text cannot be supplied for the multiplier that `...120000.sql:107` copies verbatim into immutable `fx_rate`. Realistic rates round-trip exactly and the doc never specifies an FX scale, so nothing is silently corrupted today; tests use only 0.14/0.01 (`economics-http.mjs:65`). Fix: accept strings and route through `basisDecimal`.

**L2 — `EconomicsPrerequisites.md:112-114` overstates string support.** "Exact decimal strings are supported" is false for `registerPayment` and `createBankAccount`: `validation.ts:101,130` reject non-numbers via `Number.isFinite` before `moneyDecimal` runs. Fail-closed (unsafe numbers return structured failures, `operational-decimal-http.mjs:26-38`), but strings are untested and unsupported there.

**L3 — `stock_movements.lot_number` is unnormalized while the new cost logic compares it raw.** `post_stock` btrims only when resolving the lot (`20260910100000:61,92-93`), yet `snapshot_stock_cost` rejects `source.lot_number is distinct from new.lot_number` (`...130000.sql:47`) and `warehouse_cost_input` joins `l.lot_number=btrim(m.lot_number)` (line 101). `warehouse_transfer_owned` btrims the destination leg (line 122) but passes `p_lot_number` unchanged to the source leg (line 120), so a padded lot number aborts the transfer with the misleading "Transfer cost source must be the matching owned release". Unreachable from the UI (`src/lib/warehouse/actions.ts:44` trims) and fail-closed. Fix: `new.lot_number := btrim(new.lot_number)` in `post_stock`.

**L4 — `bank_transaction` capture has no test.** It is an accepted source kind with an unconditional eligibility branch (`...120000.sql:95`). I verified legacy NULL-`company_id` rows fail closed at lines 88-92 even for a global Admin (because `has_permission(null,…)` is true for Admin, but the party check then rejects), so this is coverage only, not a hole.

**L5 — `addCompanyAsCounterparty` can blank an existing profile's code.** `actions.ts:96` sets `code: null` whenever another same-owner counterparty holds `company.code` and is not the existing profile row — including on a repeat call for an already-linked profile whose code differs. Previously that raised a unique violation. Loss is an optional label on a derived profile; `economics-identity-http.mjs:47-50` covers only the new-profile case.

**L6 — The assistant still advertises what it now declines.** `src/lib/platform/ai.ts:192` keeps "• Calculate profit for Business Case BC-001" in the fallback help list while :124-128 answers "not available yet". Cosmetic, but user-facing and in the file whose review checksum was refreshed.

**L7 — Direct authenticated INSERT of a costed lot is guarded but untested.** `lot_cost_guard` (`...130000.sql:26-30`) blocks it; `inventory-cost-http.mjs:47` exercises only the UPDATE path.

---

### Documented limitations I did **not** treat as defects

Post-capture cancellation with a retained historical status (`...120000.sql:186`, deferred at `EconomicsPrerequisites.md:104-108`); partial/absent allocations and unknown lot costs staying incomplete; the retained legacy `/finance/reports` route still rendering "Profit by Business Case/Contract" behind the amber unverified banner and `@deprecated` markers; the internal 120,000 leg remaining a legitimate company event; and the transfer API's requirement of a compatible destination lot. These are stated scope decisions, and future eligibility/reversal work belongs to Phase 7 proper.

If you fix one thing before Phase 7 starts, make it **L1** — it is the only remaining place where an immutable reporting input is formed from a binary float, and it costs one line in `upsertExchangeRate` plus a string-accepting validator.

First review ran after all requested local gates passed, with only the Read tool,
safe/restricted mode, session persistence disabled, no shell/edit/browser/MCP tools,
and explicit secret-path denials. Codex captured the returned report below; Claude
did not write this file. Findings are hypotheses until independently verified.

## First review (verbatim)

Codex verification and disposition (recorded after independently reading the cited code):

| Item | Classification | Disposition |
| --- | --- | --- |
| 1. NULL-company identifier uniqueness | CONFIRMED | Partial unique indexes preserve quarantined legacy label uniqueness without making optional NULL codes unique. Rollback SQL tests added. |
| 2. Company-as-Counterparty ownership | PARTIAL | The stated owner premise was false: the existing `source_company_id` parent trigger already derives the represented Company owner. A repeated-call code collision was confirmed and fixed; owner choice is now explicit and tested. |
| 3. Operational decimal input boundaries | CONFIRMED | Expense, standalone payment, allocation and commission inputs now use controlled decimal text; fractional and unsafe-number action tests added. |
| 4. Inventory decimal read boundary | CONFIRMED | Added RLS-respecting decimal-text cost reader and tests beyond Number precision. |
| 5. RLS aggregate over-allocation bypass | FALSE POSITIVE under current guards | `economic_source` explicitly requires finance read permission before allocation, independently of the role inheritance assumption. An actor whose allocation rows are hidden by finance-read denial cannot reach the sum. No permission model was changed. |
| 6. Trigger-level immutability coverage | CONFIRMED test gap | Added rollback SQL attempts as database owner, independently of RLS denial. |
| 7. Historical versus current status | PARTIAL | Immutable captured status is intentional and distinct from later operational cancellation. Added a cancellation/history assertion; future eligibility/reversal remains explicitly out of scope. |
| 8. New private-table matrix coverage | PARTIAL | Global/anon grant and policy checks already ran. Dedicated immutable-table fixtures now cover both company directions, cross-owner insertion, reparenting and deletion. They intentionally do not require successful generic UPDATE/DELETE CRUD. |
| 9. Standalone security unit prefix | CONFIRMED test gap | `economics:precheck` now includes auth-security tests; production bundle inspection still runs separately after build. |
| 10. Legacy consumer detection | CONFIRMED test gap | Added repository source scan: no new consumers allowed, with only the explicitly labelled legacy report route retained. The visible warning text is asserted. |
| 11. Incompatible destination lot | PARTIAL | Rejecting a merge that loses cost history is intentional. Documented the existing transfer API limitation; no unknown-cost fallback or silent relabelling added. |

These changes were followed by fresh regression runs and independent reviews recorded above.

## Verdict: **CONCERNS** — 11 findings (0 Critical, 0 High, 4 Medium, 7 Low)

No finding blocks the pre-work conceptually. The core mechanics hold up under reading: FX capture is genuinely immutable and copies the rate rather than joining it; the intercompany chain uses one record with explicit party IDs; specific-lot costing refuses to guess unknown history; allocation targets are locked and frozen; and the legacy profitability entrypoints named in the doc are in fact removed. I also checked and **discarded** several hypotheses (`bank_transactions` capture, `business_cases.case_number` losing uniqueness, the transfer leg bypassing `warehouse_post_movement` validation, removal of the JS outstanding check) — details at the end.

---

### 1. Medium — Company-scoped unique keys silently lose uniqueness for `company_id IS NULL` rows

**Evidence:** `supabase/migrations/20260910140000_economic_identifiers.sql:3-11` replaces four global unique constraints with plain composite uniques. All four `company_id` columns are nullable: `contracts.company_id` and `products.company_id` (`20260804120000_foundational_prerequisites.sql:46,78`), `business_cases.company_id` (`20260804130000_create_business_cases.sql:5`), `counterparties.company_id` (`20260908120000_authenticated_company_access.sql:96-110`, added with no NOT NULL).

**Reproduction reasoning:** a standard unique index treats NULLs as distinct, so two rows with `company_id IS NULL` may now share `contract_number` / `code` / `number`. The dropped `contracts_contract_number_key`, `counterparties_code_key`, `products_code_key`, `business_cases_number_key` all covered those rows. Exploitability is limited — authenticated writes get `company_id` forced by the ownership triggers (`coalesce(owner_id, active_company_id())`, e.g. `20260910100000_operations_warehouse.sql:38`) — so this is reachable from admin/service/legacy-import paths, not the browser. No test covers a NULL-company row.

**Minimal correction:** PostgreSQL 17 is pinned (`supabase/replay/config.toml:15`), so use `unique nulls not distinct (company_id, contract_number)` for all four, or add partial unique indexes on the bare label `where company_id is null`.

### 2. Medium — `addCompanyAsCounterparty` reuse lookup is scoped to the wrong company

**Evidence:** `src/lib/counterparties/actions.ts:87` now filters `.eq("company_id", companyId)`, where `companyId` is the function parameter (line 74) — the company *being represented*, not the owning workspace. The insert at line 97 does not set `company_id`, so the ownership trigger assigns `active_company_id()`. The new key is `counterparties_company_code_key unique(company_id, code)` on the **owner**. Note line 78 calls `requireCoreCompany(companyId)` and discards the return, unlike `createCounterparty:164` which uses it.

**Reproduction reasoning:** from workspace A, add group company B as a counterparty; a previously-unlinked counterparty row with B's code exists owned by A. The lookup searches for a counterparty owned by **B**, misses, so `profile.code = company.code` (line 92) and the insert violates `counterparties_company_code_key`. This is exactly the failure the comment at lines 84-85 says it prevents. `economics-identity-http.mjs` exercises `createCounterparty` only, never this path.

**Minimal correction:** resolve the owner explicitly — `const owner = await requireCoreCompany();` — and use `.eq("company_id", owner)`.

### 3. Medium — Exact-decimal persistence covers two write sites; the cost inputs the new tables freeze are not among them

**Evidence:** `src/lib/finance/operational-actions.ts:15,19,25,33,78` still uses `z.number()` for expense `amount`, commission `rate`/`base_quantity`/`base_amount`, standalone payments and payment allocations. Those values become `expenses.amount` and `deal_commission_links.expected_amount`, which the new guards copy verbatim into `cost_allocations.source_amount` and `financial_reporting_snapshots.original_amount` (`20260910120000_economic_reporting_inputs.sql:96,127,170`) and then freeze permanently (`economic_source_history_guard`, line 186).

**Reproduction reasoning:** a client-computed amount such as `0.1 + 0.2` is serialized by PostgREST as `0.30000000000000004` and stored as exactly that numeric — the artifact `moneyDecimal` exists to prevent. It then becomes an immutable economic input. `finance-decimal.test.mjs:24-29` asserts `moneyDecimal` usage only in `src/lib/finance/actions.ts`, and `economics-http.mjs:43,48` uses whole-number amounts, so nothing detects it.

**Minimal correction:** route these amounts through `moneyDecimal`, or accept decimal strings as `economic-input-actions.ts:9` already does; add one fractional-amount expense to the `economics-http.mjs` fixture.

### 4. Medium — Inventory cost has no decimal-safe read boundary, and its tests assert through a lossy conversion

**Evidence:** the FX prerequisite deliberately exposes decimals as text (`economics_reporting_input`, migration `...120000.sql:206-214`; `EconomicsPrerequisites.md:56-57`). The cost columns added in `20260910130000_inventory_cost_basis.sql:4-13` (`acquisition_unit_cost`, `cost_unit_amount`, generated `cost_amount`) have no equivalent reader and are consumed straight through PostgREST as JSON numbers. `inventory-cost-http.mjs:22-23,29,49,51` asserts `String(row.cost_amount) === '-49382.4'`, i.e. against the IEEE-754 round-trip rather than the stored numeric `-49382.40`; same style at `economics-http.mjs:79,81`.

**Reproduction reasoning:** persistence is exact (decimal text in, `numeric` arithmetic in-database), but every read crosses `JSON.parse` into a double, and the assertions are written in a form that cannot fail on precision loss. The inconsistency with the text boundary chosen for FX is the substantive point.

**Minimal correction:** add a `stable security invoker` reader returning `::text` for lot/movement costs, mirroring `economics_reporting_input`, and assert against it.

### 5. Low — Over-allocation is enforced by an RLS-visible aggregate

`...120000.sql:168` sums `cost_allocations` inside `erp_private.cost_allocation_guard()`, declared `security invoker` (line 118), so the `member_read` policy (line 198) filters the sum. This is safe **today**: every membership role carries `*.read` (`20260908120000_authenticated_company_access.sql:21-28`), so write ⊆ read. But the invariant stated at `EconomicsPrerequisites.md:93-94` then rests on a read policy rather than on the data — a future `finance.write`-without-`*.read` role would silently permit over-allocation. **Fix:** aggregate in a `security definer` helper, as `economic_source` (line 58) already is.

### 6. Low — The immutability *triggers* on the new tables are never reached by any test

`economics-http.mjs:57-58,77` asserts `.length === 0`, which is what `immutable_update using(false)` / `immutable_delete using(false)` (`...120000.sql:200-201`) produce via RLS. The `tg_op<>'INSERT'` raises at lines 83 and 122 — the only protection if a policy or definer path ever re-enables writes — are untested. **Fix:** exercise them once from SQL; `sql` is already passed into `verifyEconomicsHttp` (`replay.mjs:96`).

### 7. Low — Post-capture cancellation is representable, and the exposed status is stale

`economic_source_history_guard` excludes `status` from the immutable set (`...120000.sql:186`), so an Invoice captured while `Issued` can later become `Cancelled`, and an allocated Expense can become `Cancelled`, while `economics_reporting_input` keeps returning the captured `source_snapshot->>'status'` (line 212). `EconomicsPrerequisites.md:97-100` explicitly defers reversal and eligibility to the next phase, so this is a *documented* limitation rather than an oversight — but no test pins the behaviour. **Fix:** assert the transition is possible and that the captured status stays historical, so the next phase inherits an explicit contract.

### 8. Low — The new tables are classified alongside globally shared reference tables

`supabase/replay/auth-rls.sql:19` adds `financial_reporting_snapshots` and `cost_allocations` to the allowlist containing `companies`, `currencies`, `exchange_rates`, `expense_categories` — the set exempted from the `private_tables` matrix at lines 355-379 (own SELECT, "Cross-company or NULL SELECT", cross-company UPDATE/DELETE/INSERT, ownership-reassignment attempt). Line 25 restores only the 4-policy count assertion. These are company-private tables. `economics-http.mjs` covers read isolation (55, 76) and immutability, but no test attempts a cross-company INSERT with a foreign `company_id` and an owned source. **Fix:** seed both tables in `pg_temp.seed_company` and move them into `private_tables`.

### 9. Low — `economics:precheck` omits the security unit test its sibling gates run

`package.json:17` runs `finance-decimal` + `economics-isolation` + replay, whereas `documents:check` and `operations:check` both prefix `scripts/database/auth-security.test.mjs`. `EconomicsPrerequisites.md:117-120` compensates by requiring the full Phase 1-6 command set, but the gate name implies self-sufficiency.

### 10. Low — Legacy-profitability isolation rests on a source-regex allowlist over four files

`economics-isolation.test.mjs:5-16` matches strings in `ai.ts`, the business-case page, `ContractBusinessCaseTab.tsx` and `ReportsView.tsx`. `getBusinessCaseProfitResult` and `getFinanceReports` remain exported from `src/lib/finance/db.ts` with only `@deprecated` JSDoc, which no gate enforces — a new caller anywhere else passes. `assert.match(reports, /[Ll]egacy/)` also matches a comment rather than user-visible text. **Fix:** assert that no file outside `src/lib/finance/db.ts` references those two symbols.

### 11. Low — Costed stock cannot be transferred into a location holding same-numbered unknown-cost stock

`20260910130000_inventory_cost_basis.sql:60-64`: when the destination lot is uncosted but any prior movement exists for that company/warehouse/product/lot, a costed receipt raises `Historical unknown stock cannot be assigned a guessed acquisition cost`. Refusing to guess is correct, but it rejects the *physical movement* rather than recording it as unknown-cost. `EconomicsPrerequisites.md:70-79` states the no-guess rule without this consequence. **Fix:** document it as a required operational rule (distinct destination lot number), or record the receipt with `cost_unit_amount` null.

---

### Hypotheses I checked and discarded

- **`bank_transaction` capture is dead code** — no: `company_id` was added to `bank_transactions` by `20260908120000_authenticated_company_access.sql:100`, and `amount`/`currency` exist (`20260804180000_finance_module.sql:58-59`). The `when 'bank_transaction' then true` status branch is deliberate. Legacy NULL-`company_id` rows fail closed at `...120000.sql:88-92` for admins and at line 71-73 for members.
- **Dropping `business_cases_case_number_key` loses Deal-number uniqueness** — no: `number` is `NOT NULL` (`20260804130000:2`) and `sync_core_deal_number` (`20260909090000_core_domain_integrity.sql:40-53`) forces `case_number` to follow `number` on update and rejects disagreeing inserts, so two non-null equal `case_number`s in one company are unreachable.
- **The rewritten `warehouse_transfer_owned` destination leg bypasses validation** — no: `warehouse_post_movement` (`20260910100000:135-141`) is a bare insert wrapper; all checks live in the `z_post_stock` table trigger, which the direct insert still fires. Trigger order `enforce_company_ownership` → `z_post_stock` → `zz_snapshot_stock_cost` is correct alphabetically, so the lot exists when the cost trigger reads it.
- **Removing the JS outstanding check in `registerPayment` weakens validation** — no: `finance_register_payment` locks the invoice `FOR UPDATE` and rejects `p_amount > i.outstanding` (`20260910110000_operations_finance.sql:311-313`). The comment at `actions.ts:126-127` is accurate.
- **`moneyDecimal` rounding** — `src/lib/finance/decimal.ts:15` rounds half away from zero on BigInt-scaled digits, matching `round(numeric)`; the negative-zero guard at line 17 is correct.
- **`erp_private` function grants** — `lock_allocation_targets` / `allocated_target_identity_guard` are revoked from `public,anon` only (`...150000.sql:69`), but revoking the PUBLIC default is sufficient since `authenticated` holds no explicit grant.
- **`history-lock.json`** — new migrations correctly need no entry (`history.mjs:23` freezes only ≤ `20260903180000`), and the `ai.ts` checksum update is the required re-review.

One caveat on scope: I reviewed the changed files and their direct dependencies only, as instructed. I did not enumerate every caller of the deprecated profitability functions across `src/`, which is why finding 10 is framed as a gate weakness rather than a claim that a live caller remains.
