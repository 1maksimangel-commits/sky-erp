# SKY ERP Project Audit — 2026-08-05

**Auditor:** Cursor agent (read-only discovery + report only)  
**Repository:** `/Users/mas/Developer/sky-erp`  
**AGENTS.md:** Followed (repo-only, no remote DB, no migrations applied, no commits, no dependency changes, no secret values printed)  
**Overall status:** **Critical**

---

## Executive summary

SKY ERP compiles and type-checks cleanly, but it is **not production-safe**. Authorization is stubbed (`getCurrentRole()` always returns `"admin"`), Supabase RLS policies almost universally grant full CRUD to `public`, and several migrations/app queries disagree with each other or with live schema reality (documents hotfixes, missing `contract_imports`, CRM seafood columns, finance RPC inserting `payments.business_case_id` without adding the column).

PDF contract import code paths were hardened in-repo (fetch streaming, timeouts, cancellation, structured logs), but import still fails end-to-end until `contract_imports` exists remotely. Lint fails with **28 errors / 2 warnings**, mostly React Compiler hook rules.

No hardcoded API keys were found in source. OpenAI keys are server-side only. No service-role Supabase client exists in application code.

---

## Exact commands executed

| Command | Purpose | Result |
|---------|---------|--------|
| `git status --short` | Repo hygiene | Nearly entire tree untracked; `README.md` modified |
| `git diff --stat` | Diff summary | `README.md` +55/−3 |
| `git diff` | Full diff | README replaced create-next-app boilerplate + PDF import notes |
| `git log -5 --oneline` | History | Single commit `16f124e Create README.md` |
| `pnpm lint` | ESLint | **Fail** — 30 problems (28 errors, 2 warnings) |
| `pnpm build` | Production build | **Pass** |
| `./node_modules/.bin/tsc --noEmit` | Type-check | **Pass** (exit 0) |
| `tsc --noEmit` (PATH) | Type-check | Failed: `command not found` (use local binary) |

**Skipped / limited (policy):**

- No remote Supabase connection or `supabase db push`
- No live OpenAI API call
- No browser / Playwright / localhost mutating HTTP in this audit pass
- No inspection of paths outside the repository (including Cursor terminals folder and `.env.local` values)
- Env var **names** inferred from code/`README.md` only; values not read or printed

---

## Build, lint, and type-check results

| Check | Result | Detail |
|-------|--------|--------|
| **Build** | **PASS** | Next.js 16.2.12 Turbopack; all listed routes generated |
| **Lint** | **FAIL** | 28 errors, 2 warnings (`react-hooks/error-boundaries`, `react-hooks/set-state-in-effect`, `react-hooks/exhaustive-deps`, `@next/next/no-img-element`) |
| **Type-check** | **PASS** | `./node_modules/.bin/tsc --noEmit` clean |

### Lint hotspots (representative)

- `src/app/(erp)/documents/page.tsx` — JSX constructed inside `try/catch` (error-boundaries rule)
- Widespread modal/view `useEffect` → `setState` on open / `?new=1` (set-state-in-effect)
- `src/components/products/ProductsView.tsx` — `<img>` warning
- `src/components/products/ProductImportModal.tsx` — exhaustive-deps warning

---

## Findings by severity

### Critical

#### C-01 — Application authorization is a no-op
- **Severity:** Critical  
- **Module:** Platform / Security  
- **Path:** `src/lib/platform/permissions.ts`  
- **Symbol:** `getCurrentRole` (lines 38–41), `assertCan` (72–76)  
- **Observed:** `getCurrentRole()` always returns `"admin"`; every `assertCan(...)` succeeds.  
- **Root cause:** Auth/session not wired; role hard-coded for development.  
- **Business impact:** Any caller of Server Actions/API routes can perform admin-level operations once they can hit the app.  
- **Security impact:** Privilege escalation by design; role matrix in Settings is cosmetic.  
- **Recommended fix:** Resolve role from authenticated session / `user_profiles`; deny by default; add Next.js middleware gate.  
- **Approval required:** Yes (authentication / authorization change)

#### C-02 — Broad public RLS on nearly all ERP tables and storage
- **Severity:** Critical  
- **Module:** Database / Security  
- **Path:** Multiple under `supabase/migrations/` (e.g. `20260804140000_contract_hub.sql`, `20260804170000_warehouse_module.sql`, `20260804180000_finance_module.sql`, `20260804190000_platform_integration.sql`, `20260804200000_documents_dms.sql`, `20260804230000_contract_pdf_import.sql`, `20260805020000_crm_module.sql`, `20260805040000_contract_import_schema_ensure.sql`)  
- **Observed:** Pattern `to public using (true)` / `with check (true)` for SELECT/INSERT/UPDATE/DELETE; storage bucket `documents` similarly open.  
- **Root cause:** Dev-friendly open policies never replaced with tenant/role policies.  
- **Business impact:** With the publishable/anon key, any client can read/write business data if URL+key are known.  
- **Security impact:** Full data exposure and tampering; RLS does not compensate for C-01.  
- **Recommended fix:** Replace with authenticated, company-scoped policies; never leave `using (true)` in production.  
- **Approval required:** Yes (RLS change)

#### C-03 — Finance RPC inserts `payments.business_case_id` but migration never adds the column
- **Severity:** Critical  
- **Module:** Finance  
- **Path:** `supabase/migrations/20260804180000_finance_module.sql`  
- **Lines:** ALTER payments ~119–132 (no `business_case_id`); `finance_register_payment` INSERT ~304–320  
- **Observed:** RPC inserts `business_case_id` into `payments`; additive ALTERs only add `invoice_id`, `contract_id`, `bank_account_id`, `reference`, `company_id`.  
- **Root cause:** Schema/RPC mismatch in the same migration file.  
- **Business impact:** Payment registration can fail at runtime (`42703` / column does not exist) depending on live `payments` shape.  
- **Security impact:** Indirect — failed financial posting / inconsistent ledger state.  
- **Recommended fix:** Add `alter table public.payments add column if not exists business_case_id ...` (new migration; do not edit applied migration).  
- **Approval required:** Yes (new migration)

#### C-04 — Contract PDF import depends on tables that may be absent remotely
- **Severity:** Critical  
- **Module:** Contracts / PDF Import  
- **Path:** `src/lib/contracts/import/service.ts` (`createImportAndStorePdf`); migrations `20260804230000_contract_pdf_import.sql`, `20260805040000_contract_import_schema_ensure.sql`  
- **Observed (prior local reproduction, not re-run this audit):** Storage upload succeeds; insert into `contract_imports` fails with PostgREST `PGRST205` / schema cache miss.  
- **Root cause:** Migration not applied (or schema cache stale) on the linked project.  
- **Business impact:** Import stuck at first stage / fails; no AI extraction.  
- **Security impact:** Low directly; operational outage.  
- **Recommended fix:** Apply ensure migration via approved Supabase process; reload PostgREST schema.  
- **Approval required:** Yes (remote migration apply)

#### C-05 — Stored XSS via CRM rich-text notes
- **Severity:** Critical  
- **Module:** CRM  
- **Path:** `src/components/crm/CustomerProfileView.tsx` (~874); `src/lib/crm/actions.ts` (`createCrmNote`, HTML stored)  
- **Observed:** `dangerouslySetInnerHTML={{ __html: note.body_html }}` with client `contentEditable` HTML persisted unsanitized.  
- **Root cause:** No HTML sanitizer; combined with open write paths (C-01/C-02).  
- **Business impact:** Malicious note can execute script in operator browsers.  
- **Security impact:** Session/token theft, UI defacement, further actions as the user.  
- **Recommended fix:** Sanitize on write and/or render (e.g. allowlist tags); or store Markdown and render safely.  
- **Approval required:** No for sanitizer-only code fix; Yes if changing auth/RLS

---

### High

#### H-01 — Duplicate package managers / lockfiles
- **Severity:** High  
- **Module:** Project integrity  
- **Path:** `package-lock.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `package.json`  
- **Observed:** Both npm and pnpm lockfiles present; README advertises npm/yarn/pnpm/bun. AGENTS.md standardizes on `pnpm`.  
- **Root cause:** Bootstrap leftovers + mixed tooling.  
- **Business impact:** Divergent dependency trees across machines/CI.  
- **Security impact:** Supply-chain inconsistency.  
- **Recommended fix:** Standardize on pnpm; remove `package-lock.json` after approval; document in README.  
- **Approval required:** Yes (delete lockfile)

#### H-02 — Documents schema drift / repeated hotfixes
- **Severity:** High  
- **Module:** Documents  
- **Path:** `20260804200000_documents_dms.sql`, `20260804210000_documents_dms_complete.sql`, `20260804220000_documents_missing_columns_hotfix.sql`; `src/lib/documents/db.ts` (`probeDmsSchema`)  
- **Observed:** Triple overlapping column alignment; hotfix cites live `documents.file_path` missing.  
- **Root cause:** Live DB lagged migrations; app carries runtime compat probes.  
- **Business impact:** Uploads/list/preview fail intermittently until hotfixes applied.  
- **Security impact:** Medium (failed deletes/orphaned storage objects).  
- **Recommended fix:** Confirm live schema vs canonical column set; single ensure migration; simplify probe once stable.  
- **Approval required:** Yes (migration)

#### H-03 — CRM seafood profile columns queried but may be absent
- **Severity:** High  
- **Module:** CRM  
- **Path:** `src/lib/crm/db.ts` (`customerColumns` includes `legal_name`, business fields); migration `20260805030000_crm_seafood_profile.sql`  
- **Observed:** App selects expanded columns; earlier runtime logs (outside this audit’s re-check) showed `column crm_customers.legal_name does not exist`.  
- **Root cause:** Migration not applied remotely.  
- **Business impact:** CRM list/dashboard/profile broken or empty-error.  
- **Security impact:** Low.  
- **Recommended fix:** Apply `20260805020000` + `20260805030000` with approval.  
- **Approval required:** Yes (remote migration)

#### H-04 — Hub contract document upload lacks size/MIME checks and assertCan
- **Severity:** High  
- **Module:** Contracts / Documents  
- **Path:** `src/lib/contracts/hub-actions.ts` — `uploadContractDocument` (~153–188)  
- **Observed:** Only checks non-empty File; no max size, no MIME/extension allowlist, no `assertCan`.  
- **Root cause:** Legacy hub path predates DMS validation helpers.  
- **Business impact:** Oversized/malicious files into storage.  
- **Security impact:** Storage abuse; content-type confusion.  
- **Recommended fix:** Reuse `validateDocumentFile` / size limits; add permission check; prefer DMS `uploadDocument`.  
- **Approval required:** No (code-only), unless changing storage policies

#### H-05 — CRM attachment upload/delete weaknesses
- **Severity:** High  
- **Module:** CRM  
- **Path:** `src/lib/crm/actions.ts` — `uploadCrmAttachment` (~370+), `deleteCrmAttachment` (~445–459)  
- **Observed:** 50MB size check only; no MIME/extension allowlist; delete accepts client-supplied `filePath` for `storage.remove`.  
- **Root cause:** Simplified CRM-native attachment path.  
- **Business impact:** Arbitrary file types; potential deletion of unrelated storage objects if policies allow.  
- **Security impact:** High under open RLS/storage.  
- **Recommended fix:** Validate MIME/ext; resolve `file_path` from DB by attachment id only; ignore client path.  
- **Approval required:** No for code fix

#### H-06 — Signed URL by arbitrary path (IDOR-style)
- **Severity:** High  
- **Module:** Documents  
- **Path:** `src/lib/documents/actions.ts` — `getSignedUrlForPath` (~521–538)  
- **Observed:** Path traversal partially blocked (`..`, leading `/`); no ownership / entity ACL check.  
- **Root cause:** Convenience helper for previews.  
- **Business impact:** Guessable paths → document disclosure.  
- **Security impact:** Confidential contract/PDF leakage.  
- **Recommended fix:** Issue signed URLs only after loading a document row the caller may access.  
- **Approval required:** No for code fix

#### H-07 — Incomplete CRUD on master data modules
- **Severity:** High  
- **Module:** Companies, Counterparties, Products, Business Cases, Finance  
- **Path:** `src/lib/companies/actions.ts`, `counterparties/actions.ts`, `products/actions.ts`, `business-cases/actions.ts`, `finance/actions.ts`  
- **Observed:** Create (and some ops) exist; update/delete/void largely missing; detail pages often read-only.  
- **Root cause:** MVP scaffolding.  
- **Business impact:** Operators cannot correct master data without SQL.  
- **Security impact:** Low (unless they use open DB).  
- **Recommended fix:** Incremental update/archive actions with validation and audit.  
- **Approval required:** No for additive CRUD

#### H-08 — Prerequisite tables not created in this migration folder
- **Severity:** High  
- **Module:** Database  
- **Path:** `supabase/migrations/*` (assumes `companies`, `counterparties`, `contracts`, `products`, `payments` exist)  
- **Observed:** Migrations ALTER/REFERENCE masters never created here.  
- **Root cause:** Schema originated outside repo migrations.  
- **Business impact:** Greenfield `db push` of this folder alone fails.  
- **Security impact:** Low.  
- **Recommended fix:** Baseline migration documenting assumed schema or dump of masters into repo.  
- **Approval required:** Yes

#### H-09 — `business_cases` RLS appears SELECT-only
- **Severity:** High  
- **Module:** Business Cases  
- **Path:** `supabase/migrations/20260804130000_create_business_cases.sql`  
- **Observed:** Public SELECT policy; write policies not clearly granted in that migration (contrast other modules’ open CRUD).  
- **Root cause:** Incomplete policy set on first module migration.  
- **Business impact:** Creates may fail under RLS depending on role/`anon`.  
- **Security impact:** Inconsistent with C-02 elsewhere.  
- **Recommended fix:** Align policies with authenticated company-scoped model (not more open public writes).  
- **Approval required:** Yes (RLS)

#### H-10 — PDF import rows can remain `processing` forever
- **Severity:** High  
- **Module:** Contracts / PDF Import  
- **Path:** `src/lib/contracts/import/service.ts`; API `maxDuration = 300`; wizard `CLIENT_IMPORT_TIMEOUT_MS`  
- **Observed:** Status set to `processing` before AI; crash/OOM/deploy can skip `markImportFailed`; no sweeper job.  
- **Root cause:** Missing reconciliation / TTL.  
- **Business impact:** Stuck imports; confusing UI/history.  
- **Security impact:** Low.  
- **Recommended fix:** Heartbeat + TTL job marking stale `processing` as `failed`.  
- **Approval required:** No for code; Yes if DB cron

#### H-11 — SECURITY DEFINER RPCs granted broadly
- **Severity:** High  
- **Module:** Warehouse / Finance  
- **Path:** `20260804170000_warehouse_module.sql`, `20260804180000_finance_module.sql`  
- **Observed:** Stock/payment RPCs `SECURITY DEFINER` with grants to `anon`/`authenticated`/`service_role`.  
- **Root cause:** Convenience for unauthenticated prototype.  
- **Business impact:** Inventory/payment mutations callable without app auth.  
- **Security impact:** Critical when combined with C-02.  
- **Recommended fix:** Restrict EXECUTE to authenticated roles; enforce company checks inside RPC.  
- **Approval required:** Yes

#### H-12 — No Next.js auth middleware
- **Severity:** High  
- **Module:** Platform  
- **Path:** (absent) `middleware.ts`  
- **Observed:** No middleware gate for `(erp)` routes.  
- **Root cause:** Auth deferred.  
- **Business impact:** Entire ERP UI reachable without login (deployment-dependent).  
- **Security impact:** High.  
- **Recommended fix:** Add middleware requiring Supabase session.  
- **Approval required:** Yes (auth)

---

### Medium

#### M-01 — Top-level Reports is a placeholder
- **Severity:** Medium  
- **Module:** Reports  
- **Path:** `src/app/(erp)/reports/page.tsx`  
- **Observed:** `EmptyState` only; points to `/finance/reports`.  
- **Root cause:** Shared reporting layer not built.  
- **Business impact:** Nav item under-delivers.  
- **Security impact:** None.  
- **Recommended fix:** Implement or hide nav until ready.  
- **Approval required:** No

#### M-02 — AI Assistant is rule-based stub (not OpenAI)
- **Severity:** Medium  
- **Module:** AI  
- **Path:** `src/lib/platform/ai.ts`, `src/components/ai/AiAssistantView.tsx`  
- **Observed:** Keyword router over SQL; hardcoded “HAIQING” hint; no LLM.  
- **Root cause:** Intentional stub vs contract PDF AI.  
- **Business impact:** Misleading “AI” branding.  
- **Security impact:** Low (still queries DB with open perms).  
- **Recommended fix:** Label as “Assistant (rules)” or wire real model with guardrails.  
- **Approval required:** Yes if OpenAI for assistant

#### M-03 — Settings shows fake role enforcement
- **Severity:** Medium  
- **Module:** Settings  
- **Path:** `src/app/(erp)/settings/page.tsx`; `permissions.ts`  
- **Observed:** Displays current role from stub admin.  
- **Root cause:** Same as C-01.  
- **Business impact:** False confidence in controls.  
- **Security impact:** Medium (social engineering of operators).  
- **Recommended fix:** Show “Auth not configured” until real roles exist.  
- **Approval required:** No

#### M-04 — Verbose production logging on import/AI paths
- **Severity:** Medium  
- **Module:** Contracts / AI  
- **Path:** `src/lib/contracts/import/service.ts` (`logContractImport`); `src/lib/ai/contracts/extract.ts`  
- **Observed:** Many `console.info` success-path logs (file names, sizes, stages).  
- **Root cause:** Recent diagnostics.  
- **Business impact:** Log noise; possible PII in filenames.  
- **Security impact:** Low–medium (metadata leakage in logs).  
- **Recommended fix:** Gate behind debug flag; never log contents/keys.  
- **Approval required:** No

#### M-05 — Orphaned / unused contract & logistics UI
- **Severity:** Medium  
- **Module:** Contracts / Logistics  
- **Path:** `ContractWorkflow.tsx`, `ContractStepPanel.tsx`, `ShipmentDetailView.tsx`  
- **Observed:** No importers found.  
- **Root cause:** Superseded by workspace shells.  
- **Business impact:** Dead code maintenance cost.  
- **Security impact:** None.  
- **Recommended fix:** Remove after approval or wire up.  
- **Approval required:** Yes (delete)

#### M-06 — Documentation drift vs schema/app
- **Severity:** Medium  
- **Module:** Docs  
- **Path:** `DATABASE.md` (lists `contract_items`, `containers`, `warehouse_batches`, `users`); app uses `contract_products`, `shipments`, `inventory_lots`, `user_profiles`  
- **Observed:** Root docs partially stubs; richer docs under `docs/` and `knowledge/`.  
- **Root cause:** Parallel documentation waves.  
- **Business impact:** Agents/humans follow wrong model.  
- **Security impact:** Low.  
- **Recommended fix:** Single source of truth; reconcile names.  
- **Approval required:** No

#### M-07 — Multi-company ownership weakly enforced
- **Severity:** Medium  
- **Module:** Platform / All  
- **Path:** Various libs; CRM `company_id` selected but not enforced in actions  
- **Observed:** No hardcoded company UUIDs found; also no consistent company-scope filters on queries/mutations.  
- **Root cause:** Multi-company support incomplete.  
- **Business impact:** Cross-company data leakage risk once multi-tenant.  
- **Security impact:** High in multi-tenant production.  
- **Recommended fix:** Require `company_id` on writes; filter reads by active company.  
- **Approval required:** Yes (data model)

#### M-08 — Default OpenAI model `gpt-5` with long timeout
- **Severity:** Medium  
- **Module:** Contracts AI  
- **Path:** `src/lib/ai/contracts/client.ts` — `getContractAiModel`, `getContractAiTimeoutMs`  
- **Observed:** Default model `gpt-5`; default timeout 180s; API `maxDuration` 300.  
- **Root cause:** Aggressive default.  
- **Business impact:** Cost/latency; perceived hangs if UI regresses.  
- **Security impact:** Low.  
- **Recommended fix:** Document required `CONTRACT_AI_MODEL`; prefer known production model.  
- **Approval required:** No for env docs; Yes for default change if product decision

#### M-09 — Inconsistent assertCan coverage
- **Severity:** Medium  
- **Module:** Platform  
- **Path:** Examples — `deleteContract` without assertCan (`contracts/actions.ts`); warehouse `issueInventory`/`transferInventory`/`adjustInventory` without assertCan; CRM/companies/products mutations without assertCan  
- **Observed:** Partial permission checks; all moot under C-01.  
- **Root cause:** Incremental adoption.  
- **Business impact:** Uneven protection once roles work.  
- **Security impact:** Medium after auth wired.  
- **Recommended fix:** Systematic permission matrix.  
- **Approval required:** No

#### M-10 — Dual timeline / dual attachment systems
- **Severity:** Medium  
- **Module:** Logistics / CRM / Platform  
- **Path:** `shipment_timeline_events` vs `timeline_events`; `crm_attachments` vs `documents`  
- **Observed:** Parallel models without integrity links.  
- **Root cause:** Module-first evolution.  
- **Business impact:** Incomplete activity history; duplicate uploads.  
- **Security impact:** Low.  
- **Recommended fix:** Unify or document ownership boundaries.  
- **Approval required:** Yes for large refactor

#### M-11 — `next-env.d.ts` gitignored
- **Severity:** Medium  
- **Module:** Project integrity  
- **Path:** `.gitignore` line ignoring `next-env.d.ts`  
- **Observed:** Unusual; Next typically commits this generated types stub.  
- **Root cause:** Template default.  
- **Business impact:** Fresh clones may confuse TS until `next dev/build`.  
- **Security impact:** None.  
- **Recommended fix:** Stop ignoring; commit generated file.  
- **Approval required:** No

---

### Low

#### L-01 — React setState-in-effect lint debt
- **Severity:** Low  
- **Module:** UI  
- **Path:** Many modals/views (Companies, Products, Contracts, Logistics, CRM, Warehouse, Finance, etc.)  
- **Observed:** 28 lint errors dominated by this rule.  
- **Root cause:** Pattern of resetting form state when `open` flips.  
- **Business impact:** CI lint red; possible cascading renders.  
- **Security impact:** None.  
- **Recommended fix:** Reset via `key={open}` / derive state; satisfy React 19 lint rules.  
- **Approval required:** No

#### L-02 — Documents page try/catch JSX lint
- **Severity:** Low  
- **Module:** Documents  
- **Path:** `src/app/(erp)/documents/page.tsx`  
- **Observed:** error-boundaries rule failures.  
- **Root cause:** Error handling via try/catch around JSX returns.  
- **Business impact:** Lint fail.  
- **Security impact:** None.  
- **Recommended fix:** Move data fetch outside; use error UI without try/catch JSX.  
- **Approval required:** No

#### L-03 — Demo/sample contract helpers unused
- **Severity:** Low  
- **Module:** Contracts  
- **Path:** `src/lib/contracts/types.ts` — `createSampleContract` / demo strings  
- **Observed:** Unused by pages.  
- **Root cause:** Early scaffolding.  
- **Business impact:** Noise.  
- **Security impact:** None.  
- **Recommended fix:** Remove after approval.  
- **Approval required:** Yes if delete

#### L-04 — Single eslint-disable for img preview
- **Severity:** Low  
- **Module:** Documents  
- **Path:** `src/components/documents/DocumentPreviewModal.tsx` (~114)  
- **Observed:** `eslint-disable-next-line @next/next/no-img-element`  
- **Root cause:** Blob/signed URL preview.  
- **Business impact:** Acceptable exception; one other `<img>` warning in Products.  
- **Security impact:** None if URLs are signed/trusted.  
- **Recommended fix:** Prefer Next/Image where possible.  
- **Approval required:** No

#### L-05 — Entire application untracked in git
- **Severity:** Low (hygiene) / process High  
- **Module:** Git  
- **Path:** repo root  
- **Observed:** Only historical commit is README; almost all source is `??`.  
- **Root cause:** Project not yet committed.  
- **Business impact:** No recoverable history; high loss risk.  
- **Security impact:** Accidental commit of secrets if `.gitignore` regresses.  
- **Recommended fix:** Structured initial commit batches after secret scan.  
- **Approval required:** Yes (commit)

#### L-06 — README still create-next-app boilerplate mixed with ERP notes
- **Severity:** Low  
- **Module:** Docs  
- **Path:** `README.md`  
- **Observed:** Diff shows Next template text + PDF import env table.  
- **Root cause:** Partial rewrite.  
- **Business impact:** Confusing onboarding.  
- **Security impact:** None (env names only).  
- **Recommended fix:** Replace with SKY ERP-specific README.  
- **Approval required:** No

---

## Database and migration consistency matrix

| Domain | Migrations present | App queries | Consistency |
|--------|-------------------|-------------|-------------|
| Masters (`companies`, `counterparties`, `contracts`, `products`, `payments`) | Assumed / altered only | Heavy use | **Gap** — not created in-repo |
| Business cases | `…130000` | Yes | **Partial** — SELECT-only RLS risk |
| Contract hub / shipments / invoices | `…140000`+ | Yes | **OK** if masters exist |
| Logistics columns | `…150000` no-op + `…160000` | Yes | **OK** (historical supersession) |
| Warehouse | `…170000` | Yes | **OK** |
| Finance ledgers | `…180000` | Yes | **Broken RPC column** (`payments.business_case_id`) |
| Platform (activity, notifications, roles) | `…190000` | Yes | **OK** if applied |
| Documents DMS | `…200000`–`…220000` | Yes + probes | **Drift / hotfix chain** |
| Contract imports | `…230000` + `…05040000` | Yes | **Often missing remotely** |
| Companies INSERT policy | `…05010000` | createCompany | Depends on apply |
| CRM core | `…05020000` | Yes | Depends on apply |
| CRM seafood | `…05030000` | Selects new cols | **Often missing remotely** |

---

## Module readiness matrix

| Module | Route(s) | Ready? | Notes |
|--------|----------|--------|-------|
| Dashboard | `/dashboard` | Partial | Live aggregations; depends on DB |
| CRM | `/crm`, `/crm/[id]` | Partial | Fullest CRUD; needs migrations; XSS risk |
| Companies | `/companies` | Partial | Create + read; no update/delete |
| Counterparties | `/counterparties` | Partial | Create + read |
| Products | `/products` | Partial | Create + import; no update/delete |
| Business Cases | `/business-cases` | Partial | Create + read |
| Contracts | `/contracts/**` | Partial | Strong hub; PDF import blocked by DB |
| Warehouse | `/warehouse/**` | Partial | Ops RPCs; no warehouse admin CRUD |
| Logistics | `/logistics/**` | Partial | Shipment CRUD works if schema present |
| Finance | `/finance/**` | Partial | Create-heavy; RPC schema risk |
| Documents | `/documents` | Partial | Compat probes; lint issues |
| Reports | `/reports` | Placeholder | Defers to finance reports |
| AI | `/ai` | Stub | Rule engine, not LLM |
| Settings | `/settings` | Stub | Role display only |

---

## Security checklist

| Check | Status |
|-------|--------|
| Hardcoded secrets in `src/` / `public/` | **Pass** (none found) |
| Service-role client in app | **Pass** (none; env helper rejects secret-looking keys) |
| OpenAI keys server-only | **Pass** (`src/lib/ai/contracts/client.ts`) |
| `.env*` gitignored | **Pass** |
| `.next` / `node_modules` gitignored | **Pass** |
| Auth middleware | **Fail** |
| Real role enforcement | **Fail** (always admin) |
| Least-privilege RLS | **Fail** (public open) |
| Upload validation (all paths) | **Fail** (hub + CRM weak) |
| XSS sanitization | **Fail** (CRM notes HTML) |
| Path traversal on storage helpers | **Partial** |
| SSRF | **Pass** (no user-controlled fetch URLs found) |
| `eval` / `child_process` | **Pass** (none in app) |
| Prompt-injection handling (PDF) | **Partial** (developer prompt guards; residual content bias) |

---

## PDF import diagnosis

| Stage | Status in code | Failure modes |
|-------|----------------|---------------|
| File picker / MIME / 50MB | Present (wizard + `validateImportPdfFile`) | Invalid types rejected |
| Client upload | `fetch` + FormData (`browser-upload.ts`) | Network abort; 5 min client timeout |
| API multipart | `request.formData()` + validation before stream | Body limit via `proxyClientMaxBodySize: 50mb` |
| Progress NDJSON | Streamed; client fail-fast on `error` | Earlier XHR buffering fixed in code; still depends on runtime flush |
| Storage | `documents` bucket `imports/{uuid}/...` | Bucket missing → explicit error |
| DB insert `contract_imports` | Required | **Primary outage:** table/schema cache missing |
| OpenAI Files + Responses parse | Server-only; timeout/retries configured | Model/quota/timeout; cancelled → failed |
| Cleanup | Storage removed on insert failure; OpenAI file delete in `finally` | Crash mid-flight → `processing` orphan (H-10) |
| Prompt injection | PDF treated as data in developer prompt | Cannot fully prevent biased extraction content |

**Stuck on “Uploading PDF” historically:** (1) missing `contract_imports`, (2) XHR buffering of NDJSON. Code addresses (2); (1) needs approved migration apply.

---

## Temporary files and cleanup recommendations

| Item | Recommendation |
|------|----------------|
| `package-lock.json` | Remove after standardizing on pnpm (approval) |
| Orphaned components (`ContractWorkflow`, `ContractStepPanel`, `ShipmentDetailView`) | Delete or rewire (approval) |
| Demo helpers in `src/lib/contracts/types.ts` | Remove if unused (approval) |
| Root stub docs vs `docs/` + `knowledge/` | Consolidate (no delete without approval) |
| No `scripts/probe*` found in repo at audit time | N/A |
| `.env.local` | Keep gitignored; never commit |

**This audit did not delete any files.**

---

## Prioritized remediation plan

### Batch 1 — Security foundation (approval required)
1. Wire real auth + stop hardcoding admin (C-01, H-12).  
2. Replace public-open RLS with authenticated, company-scoped policies (C-02, H-09, H-11).  
3. Sanitize CRM HTML notes (C-05).

### Batch 2 — Schema correctness (approval required for apply)
4. New migration: `payments.business_case_id` (C-03).  
5. Apply contract import ensure + CRM seafood migrations (C-04, H-03).  
6. Verify documents columns once; retire redundant probes (H-02).

### Batch 3 — Upload & import hardening (mostly code)
7. Fix hub + CRM upload validation; delete-by-id only (H-04, H-05).  
8. Lock down `getSignedUrlForPath` (H-06).  
9. Add import `processing` TTL sweeper (H-10).

### Batch 4 — Engineering hygiene
10. Choose pnpm; drop npm lockfile (H-01).  
11. Clear lint errors (L-01, L-02).  
12. Complete critical CRUD / multi-company filters (H-07, M-07).  
13. Initial git commits in safe batches (L-05).

---

## Issues that cannot be confirmed without remote DB or manual UI

| Item | Why unconfirmed |
|------|-----------------|
| Exact live presence of each table/column | No remote DB connection this audit |
| Whether PostgREST schema cache is stale vs table truly missing | Needs Supabase SQL / API |
| End-to-end PDF → review with real contracts | Needs applied migrations + OpenAI call + UI |
| Real RLS behavior for `anon` vs `authenticated` | Needs live policy test |
| Multi-company data leakage in practice | Needs seeded multi-tenant data |
| Finance payment RPC success path | Needs `payments` live shape |
| Hydration mismatches in browser | No browser automation allowed |
| Performance / N+1 under load | Not profiled |
| Whether `.env.local` keys are valid | Values not inspected (policy) |

---

## Limitations (scope / policy)

- Operated only inside the repository.  
- Did not read `.env.local` values or print secrets.  
- Did not access Cursor terminals, browsers, or personal paths.  
- Did not start background automation or apply migrations.  
- Did not make OpenAI or Supabase Management API calls.  
- Prior PDF import reproduction knowledge used only as historical evidence for C-04; not re-validated with HTTP in this pass.

---

*End of audit report. Phase 3: stop. No application code was modified; only this report file was created.*
