# P0 Security Batch 01 — 2026-08-05

**Scope:** CRM XSS · `payments.business_case_id` · RLS/anon access proposal  
**Policy:** AGENTS.md followed · repo-only · no remote Supabase · no migration apply · no commit/push · no dependency changes · no auth implementation changes  
**Overall:** Batch complete in-repo. XSS code fix ready to keep. Schema migration ready for review (not applied). RLS hardening remains a proposal blocked by missing authentication.

---

## Findings verified

| ID | Finding | Verified? | Evidence |
| --- | --- | --- | --- |
| A | CRM XSS via `dangerouslySetInnerHTML` | **Yes** | `src/components/crm/CustomerProfileView.tsx` rendered `note.body_html`; `createCrmNote` persisted client `bodyHtml` unsanitized |
| B | Missing `payments.business_case_id` | **Yes** | `20260804180000_finance_module.sql` ALTER on `payments` omits column; `finance_register_payment` INSERT includes it; app `registerPayment` / `getFinancePayments` expect it |
| C | Broad public/anon access | **Yes** | Multiple migrations: `to public using (true)`, `grant execute … to anon` on DEFINER RPCs, open `documents` storage policies |

Repo-wide search: only CRM used `dangerouslySetInnerHTML` under `src/` (docs/knowledge mentions only).

---

## Files changed

| File | Change | Ready to keep? |
| --- | --- | --- |
| `src/components/crm/CustomerProfileView.tsx` | Plain-text notes UI; removed `dangerouslySetInnerHTML` | **Yes — keep** |
| `src/lib/crm/actions.ts` | Ignore `bodyHtml`; store plain `body` only | **Yes — keep** |
| `supabase/migrations/20260805050000_payments_business_case_id.sql` | Additive nullable FK + index | **Keep in repo; needs approval before apply** |
| `supabase/migrations/20260805060000_p0_rls_anon_hardening_proposal.sql` | Documented no-op proposal | **Keep as proposal; do not treat as hardening** |
| `docs/audits/P0_SECURITY_BATCH_01_2026-08-05.md` | This report | **Yes — keep** |

No authentication files modified. No prior migrations edited. ≤8 files.

---

## Task A — XSS root cause and correction

**Root cause:** Notes form used `contentEditable` + `document.execCommand`, saved `innerHTML` into `crm_notes.body_html`, and rendered it with `dangerouslySetInnerHTML` without sanitization. Stored/user-controlled HTML could execute in the browser.

**Correction:**

1. Composer is a plain `<textarea>`; only text is submitted.
2. Display always uses React text `{note.body}` with `whitespace-pre-wrap` (line breaks preserved; no HTML parse).
3. `createCrmNote` ignores `bodyHtml`, sets `body_html = null`, `is_rich_text = false`.
4. No sanitizer dependency added.

**Residual note:** Historical rows may still have `body_html` in the database; the UI no longer renders that column. Optional future data cleanup is out of scope.

---

## Task B — Migration for `payments.business_case_id`

**File:** `supabase/migrations/20260805050000_payments_business_case_id.sql`

| Property | Value |
| --- | --- |
| Column | `business_case_id uuid` nullable |
| FK | `references public.business_cases (id) on delete set null` |
| Constraint name | `payments_business_case_id_fkey` (guarded) |
| Index | `payments_business_case_id_idx` |
| Idempotency | `add column if not exists`, constraint existence check, `create index if not exists` |
| Data | No UPDATE/DELETE of payment rows |

**Not applied** (local or remote).

---

## Task C — RLS findings

### Confirmed patterns (existing migrations — not rewritten)

- `using (true)` / `with check (true)` on `public` for hub, warehouse, finance, platform, documents, CRM, contract imports, companies insert/update, etc.
- `grant execute … to anon, authenticated, service_role` on warehouse stock RPCs, `finance_register_payment`, `refresh_invoice_balances`, `log_activity`, `add_timeline_event`, `create_notification`.
- Storage policies on bucket `documents` without ownership predicates (see platform/documents migrations).

### Policies / grants that remain blocked by missing authentication

| Intended change | Why blocked |
| --- | --- |
| Revoke `anon` EXECUTE on DEFINER RPCs | App Server Actions call these RPCs via publishable key; without session auth the DB role is `anon` — revoke would break finance/warehouse/platform writes |
| Replace `using (true)` with company-scoped RLS | No wired `auth.uid()` / company membership model in app; inventing it is out of scope and forbidden for this batch |
| Tighten storage object policies | Same auth dependency; current upload paths rely on open/dev policies |

### What this batch did for RLS

Created `20260805060000_p0_rls_anon_hardening_proposal.sql`:

- Clearly marked **PROPOSAL / DO NOT APPLY as hardening**
- Performs **no** grant/policy changes (notice-only)
- Lists intended future `revoke` / policy replacements as comments
- Documents the auth blocker

---

## Commands executed

| Command | Result |
| --- | --- |
| `pnpm lint` | **FAIL** — 28 errors / 2 warnings (pre-existing React hooks / documents page; none in CRM files changed this batch) |
| `pnpm build` | **PASS** |
| `pnpm exec tsc --noEmit` | **PASS** (exit 0) |
| `git diff --stat` | Tracked tree mostly untracked; see changed-files list above |
| `git diff --check` | **PASS** (no whitespace errors on touched paths) |

No `any`, `@ts-ignore`, `eslint-disable`, or new unsafe casts introduced.

---

## Risks and rollback

| Change | Risk | Rollback |
| --- | --- | --- |
| CRM plain text | Operators lose rich-text formatting in notes UI | Revert the two CRM files (not recommended for XSS) |
| `20260805050000_…` if applied | Low; additive nullable column | New reverse migration to drop column/FK/index only with approval |
| `20260805060000_…` if applied | None functionally (no-op notice) | Remove from history only via approved process; or leave as audit trail |

---

## Remote actions still requiring explicit approval

1. Apply `20260805050000_payments_business_case_id.sql` to remote Supabase (SQL Editor or approved CLI).
2. Any real RLS / `revoke … from anon` / storage policy hardening (after auth design).
3. Auth wiring / middleware / `getCurrentRole` replacement (explicitly out of this batch).
4. Commit / push of this work.
5. Dependency installs for HTML sanitizers (not needed after plain-text fix).

---

## Stop state

- Migrations **not** applied  
- **Not** committed / pushed  
- XSS fix and payments migration are ready to keep in the repository  
- RLS file is proposal-only and still needs a future auth-backed hardening batch  
