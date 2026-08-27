# Known Bugs

Confirmed issues from repository audits only. IDs align with `knowledge/Memory/KNOWN_ISSUES.md` where applicable.

---

### K-01 — Authorization stub always admin

| Field | Value |
| --- | --- |
| Severity | Critical |
| Module | Platform / Security |
| Symptom | Every permission check succeeds |
| Root cause | `getCurrentRole()` always returns `"admin"` |
| Current status | Open |
| Recommended next action | Design real session role resolution + middleware (approval required) |

### K-02 — Broad public RLS

| Field | Value |
| --- | --- |
| Severity | Critical |
| Module | Database / Security |
| Symptom | RLS enabled but policies allow full access via `using (true)` |
| Root cause | Development-open policies in multiple migrations |
| Current status | Open (proposal migration documents blocker) |
| Recommended next action | Auth first, then company-scoped policies (approval required) |

### K-03 — Missing `payments.business_case_id`

| Field | Value |
| --- | --- |
| Severity | Critical |
| Module | Finance |
| Symptom | `finance_register_payment` inserts column that ALTER never added |
| Root cause | Schema gap in `20260804180000_finance_module.sql` |
| Current status | Mitigation **in repo** (`20260805050000_…`) — **not applied** remotely |
| Recommended next action | Approve and apply additive migration |

### K-04 — Contract import table may be missing remotely

| Field | Value |
| --- | --- |
| Severity | Critical |
| Module | Contracts / AI |
| Symptom | Import fails with schema cache / missing `contract_imports` (PGRST205 class) |
| Root cause | Migration present in repo; remote apply may be pending |
| Current status | Open (ops) |
| Recommended next action | Approved remote apply of import migrations |

### K-05 — CRM notes XSS

| Field | Value |
| --- | --- |
| Severity | Critical |
| Module | CRM |
| Symptom | Unsanitized HTML rendered via `dangerouslySetInnerHTML` |
| Root cause | Rich-text note HTML persisted and rendered unsafely |
| Current status | **Mitigated in app code** (plain text) per P0 batch; historical DB HTML may remain unused by UI |
| Recommended next action | Keep plain-text path; optional DB cleanup later with approval |

### K-06 — Documents schema drift / hotfix chain

| Field | Value |
| --- | --- |
| Severity | High |
| Module | Documents |
| Symptom | App has fallbacks for incomplete DMS columns |
| Root cause | Multiple documents migrations / hotfixes |
| Current status | Open |
| Recommended next action | Verify remote schema against migration chain |

### K-07 — CRM seafood columns may be missing remotely

| Field | Value |
| --- | --- |
| Severity | High |
| Module | CRM |
| Symptom | Seafood profile features fail if columns absent |
| Root cause | `20260805030000_crm_seafood_profile.sql` may be unapplied |
| Current status | Open (ops) |
| Recommended next action | Approved remote apply |

### K-08 — Weak upload validation

| Field | Value |
| --- | --- |
| Severity | High |
| Module | CRM / Documents / Contracts |
| Symptom | CRM attachments size-only; some paths weaker than DMS allowlist |
| Root cause | Inconsistent validation |
| Current status | Mitigated (CRM) — DMS allowlist on upload; delete path from DB (2026-08-06) |
| Recommended next action | Spot-check remaining non-DMS upload paths if any |

### K-09 — Signed URL without ownership check

| Field | Value |
| --- | --- |
| Severity | High |
| Module | Documents |
| Symptom | Path-based signed URL can ignore document ownership |
| Root cause | `getSignedUrlForPath` guards traversal but not ACL |
| Current status | Mitigated in app (2026-08-06) — registration + company_id gate; storage RLS still open |
| Recommended next action | Human review; then session company + storage RLS (approval) |

### K-10 — Incomplete CRUD on masters / finance

| Field | Value |
| --- | --- |
| Severity | High |
| Module | Companies / Counterparties / Products / Business Cases / Finance |
| Symptom | Create/list present; update/archive/void incomplete in places |
| Root cause | Partial module delivery |
| Current status | Open |
| Recommended next action | Prioritize critical update/archive flows |

### K-11 — Dual lockfiles

| Field | Value |
| --- | --- |
| Severity | High |
| Module | DevOps |
| Symptom | `package-lock.json` and `pnpm-lock.yaml` both present |
| Root cause | Mixed package managers historically |
| Current status | Open |
| Recommended next action | Standardize on pnpm after approval to remove npm lockfile |

### K-12 — Lint failing while build may pass

| Field | Value |
| --- | --- |
| Severity | High |
| Module | Quality |
| Symptom | ESLint reports many React hooks errors |
| Root cause | Widespread setState-in-effect / related rules |
| Current status | **Mitigated 2026-08-06** — `pnpm lint` is 0 errors (2 pre-existing warnings). Uses `src/lib/ui/open-state.ts` helpers. |
| Recommended next action | Keep lint green; treat remaining warnings as non-blocking |

### K-13 — Import rows stuck in `processing`

| Field | Value |
| --- | --- |
| Severity | High |
| Module | Contracts / AI |
| Symptom | Import records may remain `processing` |
| Root cause | Failure/timeout paths incomplete historically |
| Current status | Open / partially mitigated in import code paths |
| Recommended next action | Verify stuck-state handling with applied schema |

### K-14 — SECURITY DEFINER RPCs broadly granted

| Field | Value |
| --- | --- |
| Severity | High |
| Module | Warehouse / Finance / Platform |
| Symptom | `anon` can EXECUTE DEFINER RPCs |
| Root cause | Grants in module migrations |
| Current status | Open — revoke blocked until auth |
| Recommended next action | After auth, revoke anon; keep authenticated grants as designed |

### K-15 — Reports and AI assistant stubs

| Field | Value |
| --- | --- |
| Severity | Medium |
| Module | Reports / AI |
| Symptom | `/reports` placeholder; `/ai` rule-based not OpenAI chat |
| Root cause | Incomplete product surfaces |
| Current status | Open |
| Recommended next action | Do not advertise as finished platforms |

### K-16 — Multi-company enforcement incomplete

| Field | Value |
| --- | --- |
| Severity | Medium |
| Module | Platform |
| Symptom | Ownership rule not fully enforced in app/RLS |
| Root cause | Auth/RLS incomplete |
| Current status | Open |
| Recommended next action | Couple with company-scoped RLS design |

### K-17 — Products INSERT blocked by RLS (remote)

| Field | Value |
| --- | --- |
| Severity | Critical (local create workflow) |
| Module | Products |
| Symptom | Create Product fails with Postgres `42501` / RLS denial |
| Root cause | No INSERT policy on `public.products` for the publishable/anon client; auth/`company_memberships` not live so company-scoped policy cannot be invented safely |
| Current status | App hardened (no rethrow / useful error). Migration prepared: `supabase/migrations/20260805110000_products_insert_policy.sql` — **not applied** |
| Recommended next action | Approve remote apply of INSERT-only policy for **development/staging only**; replace with authenticated company-scoped RLS before production |
