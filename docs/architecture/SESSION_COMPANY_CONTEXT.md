# Session Company Context — Architecture Design

**Status:** Architecture / documentation only  
**Date:** 2026-08-05  
**Authority:** Subordinate to `AGENTS.md`. Auth, RLS, migrations, and `.env` changes require explicit approval.  
**Related:** `management/AUTH_SYSTEM.md`, `management/COMPANY_MODEL.md`, `management/ROLE_MODEL.md`, `management/PERMISSION_MATRIX.md`, `management/AUDIT_LOG_MODEL.md`, `docs/audits/LOGISTICS_P0_2.md`  
**Proposal SQL (not applied):** `supabase/migrations/20260805070000_auth_foundation_proposal.sql`

This document designs the replacement of temporary `SKY_ACTIVE_COMPANY_ID` environment scoping with **real Supabase session-based company context**.

**This task does not modify production code, auth, RLS, migrations, or environment files.**

---

## Target flow (required)

```text
Authenticated user
  → session
  → verified company membership
  → selected active company
  → role and permissions
  → company-scoped query
  → RLS enforcement
  → audit log
```

## Explicit prohibitions

| Prohibition | Rationale |
| --- | --- |
| Trusting `company_id` from client input as authority | Client can forge FormData / JSON; ownership must come from session + membership |
| Unrestricted access when company context is missing | Missing context must **deny** (fail closed), not open the tenant |
| Using environment variables as production identity | `SKY_ACTIVE_COMPANY_ID` is a local/dev stub only; never production identity |
| Allowing `admin` / “Admin” to bypass company isolation without verified Platform Admin | Bypass requires explicit `platform_admin` permission (or equivalent membership flag), audited |

---

## 1. Current temporary behavior

### 1.1 Role stub

`src/lib/platform/permissions.ts`:

- `getCurrentRole()` **always returns `"admin"`**.
- `assertCan` / `can` therefore succeed for all permissions in practice.
- Role catalog exists in `public.roles` / `public.user_profiles.role_code` but is **not** wired to session.

### 1.2 Company scope stub

`src/lib/platform/company-scope.ts`:

| Function | Behavior today |
| --- | --- |
| `getActiveCompanyId()` | Reads `process.env.SKY_ACTIVE_COMPANY_ID`; otherwise `null` |
| `isUnrestrictedCompanyScope()` | If no env company and role is `admin` → unrestricted |
| `assertCompanyAccess` | No-op when active company is `null` |
| `resolveWritableCompanyId` | When active is `null`, returns client/requested company as writable |

### 1.3 Supabase server client

`src/lib/supabase/server.ts`:

- `@supabase/ssr` `createServerClient` with cookie get/set.
- Uses publishable URL/key from `getSupabasePublicEnv()`.
- Cookie bridge exists, but **no login UI**, **no session gate**, **no company cookie**.

### 1.4 Middleware

- **No** `middleware.ts` / `middleware.js` in the repository.
- `(erp)` routes are reachable without authentication.

### 1.5 Membership / profiles

| Object | Status |
| --- | --- |
| `public.user_profiles` | Exists (platform migration); email, `role_code`, optional `user_id`; open RLS patterns historically |
| `public.roles` | Seeded: admin, finance, sales, logistics, warehouse, management, readonly |
| `public.company_memberships` | **Planned only** (commented in `20260805070000`) — not created |
| Active company claim | **Missing** |

### 1.6 Logistics list and mutation queries (current)

| Path | Company behavior today |
| --- | --- |
| `getShipments` | `.eq("company_id", active)` **only if** env set; else all rows |
| `getShipmentsByContractId` | Same optional filter |
| `getShipmentById` | `assertLogisticsRead` — no-op without env company |
| `getContractOptions` / `getBusinessCaseOptions` | Optional env filter |
| `createShipment` / `updateShipment` | Resolves company from bind + contract/BC; env can force company |
| `deleteShipment` / `addShipmentTimelineEvent` | `assertLogisticsWrite` on row company — no-op without env |
| Duplicate BL/container checks | Prefer company-scoped when `company_id` present |

**Logistics is the pilot consumer of company-scope helpers; other modules still largely unscoped.**

---

## 2. Security risks

| ID | Severity | Risk |
| --- | --- | --- |
| R1 | Critical | Env unset + admin stub ⇒ **cross-tenant read/write** for any caller using the app/key |
| R2 | Critical | Open RLS (`using (true)`) means app filters are not a security boundary |
| R3 | Critical | Client-supplied `company_id` can be accepted when env scope is off |
| R4 | Critical | `getCurrentRole() === "admin"` grants `*` permissions |
| R5 | High | No middleware ⇒ unauthenticated access to ERP routes |
| R6 | High | DEFINER finance/logistics RPCs historically grantable to `anon` |
| R7 | High | Rows missing `company_id` cannot be safely isolated by RLS |
| R8 | Medium | Env-based identity is forgeable in any process that controls env |
| R9 | Medium | Confusing “Admin” (company) vs Platform Admin (cross-company) |

---

## 3. Required user / company membership model

### 3.1 Identity stack

| Layer | Store | Notes |
| --- | --- | --- |
| Authentication | `auth.users` (Supabase Auth) | Required for every human actor |
| Profile | `public.user_profiles` | `user_id → auth.users.id`, `is_active` |
| Role catalog | `public.roles` | Expanded codes per `ROLE_MODEL.md` |
| Membership | `public.company_memberships` | **Source of truth** for company access |
| Platform Admin | Membership flag **or** dedicated role `platform_admin` | Verified, audited; not env |

### 3.2 `company_memberships` (target)

```text
company_memberships (
  id uuid PK,
  user_id uuid NOT NULL → auth.users,
  company_id uuid NOT NULL → companies,
  role_code text NOT NULL → roles.code,
  counterparty_id uuid NULL → counterparties,  -- external portal roles
  is_active boolean NOT NULL DEFAULT true,
  created_at, updated_at,
  created_by, updated_by uuid NULL,
  UNIQUE (user_id, company_id)
)
```

**Rules:**

- Internal users: ≥1 active membership required before ERP access.
- External roles: membership + `counterparty_id` required.
- Role is **per company**, not a global `user_profiles.role_code` (legacy column may remain for display/migration only).
- Deactivating membership immediately revokes that company.

### 3.3 Platform Admin vs company Admin

| Concept | Rule |
| --- | --- |
| Company roles (`company_owner`, managers, …) | Strictly scoped to membership `company_id` |
| `platform_admin` | May list/switch companies **only after** permission verification; every cross-company access audited |
| Legacy app code `admin` | Must **not** imply Platform Admin after cutover |

---

## 4. Session resolution flow

```text
HTTP request
  → Next.js middleware (Planned)
       1. Create Supabase SSR client from cookies
       2. auth.getUser() — invalid/missing → redirect /login (Planned)
       3. Load user_profiles by user_id — inactive → deny
       4. Resolve activeCompanyId:
            a. Prefer signed cookie / session claim `sky_active_company_id`
            b. Else single membership → auto-select
            c. Else multi-membership without selection → redirect /select-company
            d. Platform Admin without selection → /select-company (no silent “all companies”)
       5. Verify membership:
            - company_memberships where user_id + company_id + is_active
            - OR verified platform_admin permission for switcher tooling
       6. Attach request context (userId, profileId, activeCompanyId, roleCode, permissions[])
  → Server Component / Server Action
       → requireSessionContext()
       → company-scoped queries + RLS
       → audit on mutate / company switch
```

### 4.1 Session context shape (target)

```text
ErpSessionContext {
  userId: uuid
  profileId: uuid
  email: string
  activeCompanyId: uuid          -- REQUIRED for business routes
  roleCode: string               -- membership role for active company
  permissions: string[]
  isPlatformAdmin: boolean       -- verified permission, not env
  counterpartyId?: uuid          -- external roles only
  membershipId: uuid
}
```

**Fail closed:** If `activeCompanyId` cannot be resolved and verified, business routes/actions return 401/403 — **never** unrestricted mode.

---

## 5. Active-company switching flow

```text
User authenticated
  → GET memberships (active only)
  → UI company switcher lists ONLY those companies
       (platform_admin may additionally list all companies via audited admin API)
  → POST switchActiveCompany(companyId)
       1. requireSession (authenticated)
       2. Verify membership OR platform_admin permission
       3. Set httpOnly cookie `sky_active_company_id` (Secure, SameSite=Lax)
       4. Write audit_events: company.switched { from, to }
       5. Revalidate ERP paths
  → Subsequent requests resolve new active company
```

**Rules:**

- Switch payload `companyId` is a **request**, not authority — server re-verifies membership.
- Cookie is not trusted alone: every request re-checks membership row (or short-lived signed token containing membership id + expiry, still revalidated periodically).
- Clearing cookie must not fall back to “all companies”; force re-select.

---

## 6. Server-side authorization helper API

Target module (Planned): `src/lib/platform/session.ts` (name illustrative).

| Helper | Behavior |
| --- | --- |
| `getSessionContext(): Promise<ErpSessionContext \| null>` | Resolve user + verified active company; no stubs |
| `requireSessionContext(): Promise<ErpSessionContext>` | Throws / returns ActionError if missing |
| `requirePermission(perm: string)` | Uses membership permissions; deny by default |
| `requireCompany(): uuid` | Returns `activeCompanyId`; never null on success |
| `assertRecordCompany(recordCompanyId)` | Deny if ≠ active (unless platform_admin **and** explicit cross-company tool path) |
| `stampCompanyOnInsert()` | Always sets `company_id = requireCompany()`; **ignores client company_id** |
| `withCompanyFilter(query)` | Applies `.eq("company_id", activeCompanyId)` for non–platform-admin paths |

### 6.1 Replacement of current helpers

| Current | Target |
| --- | --- |
| `getActiveCompanyId()` env | `requireCompany()` from session |
| `isUnrestrictedCompanyScope()` | **Deleted**; no unrestricted mode |
| `resolveWritableCompanyId(requested)` | `stampCompanyOnInsert()` — session company only |
| `getCurrentRole()` stub | Membership `roleCode` for active company |
| `assertCan` | `requirePermission` backed by real grants |
| `logisticsActiveCompanyId()` | Thin wrapper over `requireCompany()` / session |

### 6.2 Logistics mutation contract (target)

```text
createShipment(input):
  ctx = requireSessionContext()
  requirePermission("logistics.write")
  companyId = ctx.activeCompanyId          -- NOT input.company_id
  load contract; require contract.company_id === companyId
  load business_case; require BC.company_id === companyId
  insert shipment with company_id = companyId
  audit_events + recordEntityEvent

update/delete/timeline:
  load row; assertRecordCompany(row.company_id)
  requirePermission(...)
  never allow company_id change to another tenant
```

List queries:

```text
getShipments():
  ctx = requireSessionContext()
  requirePermission("logistics.read")
  select ... where company_id = ctx.activeCompanyId
  -- platform_admin cross-company explorer is a separate audited route, not default list
```

---

## 7. RLS integration design

Defense in depth: **Server Actions + RLS**. Neither alone is sufficient.

### 7.1 Prerequisites (blockers)

1. Real login + middleware live.  
2. `company_memberships` populated.  
3. Operational tables have backfilled `company_id`.  
4. Explicit approval to replace open `using (true)` policies.

### 7.2 Policy pattern (target)

```sql
-- Illustrative only — not applied in this task
create policy shipments_select_member on public.shipments
  for select to authenticated
  using (
    company_id in (
      select m.company_id from public.company_memberships m
      where m.user_id = auth.uid() and m.is_active
    )
    or public.is_platform_admin(auth.uid())  -- SECURITY DEFINER, search_path fixed
  );
```

Similar policies for insert/update/delete:

- `WITH CHECK (company_id = <membership company>)`
- Inserts must not accept arbitrary `company_id` outside membership
- Platform Admin policies are separate, narrow, and audited

### 7.3 Helper functions (target)

| Function | Purpose |
| --- | --- |
| `is_platform_admin(uid)` | SECURITY DEFINER; `search_path` fixed; checks verified platform permission |
| `user_company_ids(uid)` | Returns active membership company ids |

**Do not** grant DEFINER helpers to `anon`.  
**Do not** use `service_role` in the Next.js app.

### 7.4 Storage

- Document signed URLs remain gated by registered rows + company membership checks in Server Actions.
- Future: storage path prefix includes `company_id`; storage RLS aligned when Auth is live.

---

## 8. Backfill plan for rows missing `company_id`

### 8.1 Priority order

1. **Shipments** — from `contracts.company_id` (already proposed in `20260805100000`).  
2. Contract-linked children (`contract_products`, imports) — from contract.  
3. Finance rows already mostly company-scoped — repair nulls from invoice/contract.  
4. Warehouse tables — from warehouse/location/contract linkage (module-specific).  
5. Platform logs (`activity_log`, `timeline_events`, `notifications`) — best-effort from entity join.

### 8.2 Algorithm (shipments example)

```text
UPDATE shipments s
SET company_id = c.company_id
FROM contracts c
WHERE s.contract_id = c.id
  AND s.company_id IS NULL
  AND c.company_id IS NOT NULL;

-- Report orphans: shipments with null company_id after backfill
-- Manual assignment or quarantine before NOT NULL
```

### 8.3 Gates before NOT NULL

| Gate | Requirement |
| --- | --- |
| Orphan count | Zero unresolved null `company_id` on P0 tables |
| App writes | All inserts stamp session company |
| Dual-run | App filters + nullable column validated in staging |

---

## 9. Migration order

Proposed **future** order (new timestamped files only; never edit applied migrations):

| Step | Migration intent | Depends on |
| --- | --- | --- |
| M1 | Ensure `shipments.company_id` (+ BL/parties) — existing proposal `20260805100000` | Approval |
| M2 | Create `company_memberships` + indexes + seed roles expansion | Auth approval |
| M3 | Link `user_profiles.user_id` FK/unique; backfill from auth users | Auth users exist |
| M4 | Ownership columns on remaining P0 tables (nullable) | M2 optional |
| M5 | Backfill SQL for null `company_id` | M1/M4 |
| M6 | `audit_events` table | Auth approval |
| M7 | Replace open RLS with membership policies (**last**) | Login + middleware + backfill complete |
| M8 | Optional NOT NULL on `company_id` for P0 tables | Zero orphans |

**Hard rule:** Do not apply M7 until acceptance criteria in §12 are met.

---

## 10. Rollback plan

| Layer | Rollback |
| --- | --- |
| App session helpers | Feature flag `SESSION_COMPANY_CONTEXT=off` only in non-prod if needed; production should revert deploy |
| Cookie | Clear `sky_active_company_id`; users re-select |
| Memberships | Soft-disable (`is_active=false`); do not drop table casually |
| RLS | Forward-fix migration to loosen is **forbidden** without security review; prefer hotfix membership grants |
| Backfill | Do not “un-backfill”; restore from backup only if migration corrupted data |
| Env stub | After cutover, **remove** `SKY_ACTIVE_COMPANY_ID` support entirely — do not re-enable in production |

---

## 11. Exact implementation batches

Batches are sequential. Each ends with human approval before the next.

### Batch A — Schema prerequisites (DB only, approved apply)

1. Apply ownership columns for shipments (and other P0 null `company_id` tables).  
2. Backfill from parents.  
3. Report orphan counts.  
**No RLS tighten. No auth code.**

### Batch B — Membership foundation (DB + read-only admin tooling)

1. Create `company_memberships` + role seed expansion.  
2. Link profiles to `auth.users`.  
3. Seed memberships for known operators (manual).  
**Still no route lock.**

### Batch C — Auth session + middleware (app)

1. Login / logout routes.  
2. `middleware.ts`: session required for `(erp)`.  
3. `getSessionContext` / `requireSessionContext`.  
4. Replace `getCurrentRole()` stub with membership role.  
5. **Remove** env-based `getActiveCompanyId` production path.  
6. Fail closed when company missing.

### Batch D — Active company UX

1. `/select-company` + switcher.  
2. httpOnly cookie + switch Server Action + audit.  
3. Platform Admin switcher (separate permission check).

### Batch E — Module cutover (Logistics first)

1. Logistics db/actions use `requireCompany()` / `stampCompanyOnInsert()`.  
2. Reject client `company_id` mismatches.  
3. Lists always filtered by session company.  
4. Extend to finance, warehouse, CRM in follow-on PRs.

### Batch F — RLS harden

1. Drop/replace open policies on shipments (+ timeline).  
2. Membership-based policies.  
3. Revoke dangerous `anon` grants on DEFINER RPCs.  
4. Staging soak → production.

### Batch G — Audit completeness

1. `audit_events` writers for login, logout, company.switch, shipment mutations.  
2. Retain UX `recordEntityEvent` where useful.

---

## 12. Manual approval gates

| Gate | Required before |
| --- | --- |
| G0 | Any auth/middleware code change |
| G1 | Creating/applying membership migrations |
| G2 | Applying shipment/ownership backfill remotely |
| G3 | Enabling fail-closed company context in production |
| G4 | Removing `SKY_ACTIVE_COMPANY_ID` support |
| G5 | Replacing open RLS / revoking `anon` EXECUTE |
| G6 | Granting any user `platform_admin` |
| G7 | Commit / push / deploy of Batches C–F |

### Acceptance criteria (cutover complete)

| # | Criterion |
| --- | --- |
| A1 | Unauthenticated users cannot reach `(erp)` |
| A2 | `getCurrentRole()` / session role never hardcodes admin in production |
| A3 | Missing company context denies access (no unrestricted mode) |
| A4 | Client `company_id` cannot authorize cross-tenant writes |
| A5 | Non–platform-admin queries cannot return other companies’ logistics rows |
| A6 | Platform Admin cross-company access is permission-verified and audited |
| A7 | `SKY_ACTIVE_COMPANY_ID` unused and undocumented as identity |
| A8 | Login, logout, company.switch appear in audit log |
| A9 | No `service_role` in Next.js app |

---

## Logistics query inventory (for Batch E)

| Operation | File | Target constraint |
| --- | --- | --- |
| List shipments | `db.ts` `getShipments` | `company_id = session.activeCompanyId` |
| List by contract | `db.ts` `getShipmentsByContractId` | Same + contract belongs to company |
| Get by id | `db.ts` `getShipmentById` | Deny if row company ≠ session |
| Contract options | `db.ts` `getContractOptions` | Company filter |
| BC options | `db.ts` `getBusinessCaseOptions` | Company filter |
| Create | `actions.ts` `createShipment` | Stamp session company; verify contract/BC |
| Update | `actions.ts` `updateShipment` | Assert row company; forbid tenant move |
| Delete | `actions.ts` `deleteShipment` | Assert row company |
| Timeline add | `actions.ts` `addShipmentTimelineEvent` | Assert shipment company |
| Duplicates | `actions.ts` `assertNoDuplicateIdentifiers` | Scope by session company |

---

## Out of scope for this document

- Implementing middleware, login, or session helpers  
- Changing `permissions.ts` / `company-scope.ts` runtime behavior  
- Creating or applying migrations  
- Modifying RLS  
- Editing `.env` / `.env.local`  
- Commit or push  

---

## Document control

| Item | Value |
| --- | --- |
| Type | Architecture design |
| Code changes in this task | None |
| Next action | Human review → approve Batch A/B scope before any implementation |
