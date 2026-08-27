# SKY ERP — Authentication & Authorization Foundation

**Status:** Design / proposal  
**Date:** 2026-08-05  
**Authority:** Subordinate to `AGENTS.md`. Auth implementation changes require explicit user approval.  
**Related:** `ROLE_MODEL.md`, `PERMISSION_MATRIX.md`, `COMPANY_MODEL.md`, `AUDIT_LOG_MODEL.md`  
**Migration proposal:** `supabase/migrations/20260805070000_auth_foundation_proposal.sql` (**do not apply** without approval)

---

## 1. Architecture report — current state

### 1.1 Current auth flow (confirmed)

```text
Browser
  → Next.js App Router (src/app/(erp)/*, force-dynamic layout)
  → createClient() in src/lib/supabase/server.ts
       uses NEXT_PUBLIC_SUPABASE_URL + PUBLISHABLE_KEY
       + @supabase/ssr cookie bridge
  → Supabase Postgres / Storage / Auth APIs (when session exists)
```

| Component | Current behavior |
| --- | --- |
| Supabase SSR client | Present; cookie get/set wired |
| Login / logout UI | **Not present** in app routes reviewed |
| Session enforcement | **None** — no `middleware.ts` |
| Role resolution | `getCurrentRole()` in `src/lib/platform/permissions.ts` **always returns `"admin"`** |
| Permission checks | `assertCan` / `can` exist; cosmetic while role is stubbed |
| Seeded roles | `public.roles` + `public.user_profiles` (platform migration) — not wired to session |
| `auth.getUser()` | Used sparsely (e.g. contract import `created_by`) — not a gate |

### 1.2 Missing middleware

There is **no** `middleware.ts` / `middleware.js`. Routes under `(erp)` are reachable without an authenticated session check.

**Planned middleware chain** (see §8):

```text
Request → Authentication → Company Resolution → Role Resolution
  → Permission Check → Business Logic → Audit Log → Response
```

### 1.3 Missing role checks

| Gap | Detail |
| --- | --- |
| Stub admin | All `assertCan(...)` succeed |
| Incomplete coverage | Some actions omit `assertCan` (e.g. CRM; some warehouse/finance helpers) |
| Narrow role set | App `RoleCode`: admin, finance, sales, logistics, warehouse, management, readonly — does not match required ERP roles below |
| No company membership | Role is global string on `user_profiles.role_code`, not per-company |

### 1.4 Missing company isolation

| Gap | Detail |
| --- | --- |
| RLS | Broad `to public using (true)` policies (K-02) |
| App filters | Some UI filters by company; not enforced as security boundary |
| Schema | Many operational tables lack `company_id` in migrations (see `COMPANY_MODEL.md`) |
| Masters | `companies` / `contracts` / `counterparties` / `products` assumed; ownership columns not fully defined in this migration folder |

### 1.5 Current risks

| Risk | Severity |
| --- | --- |
| Anyone with publishable key + open RLS can read/write most data | Critical |
| DEFINER RPCs granted to `anon` (K-14) | Critical |
| Permission matrix unused in practice | Critical |
| Cross-company data leakage when multi-company data exists | Critical |
| Audit trail incomplete for login/logout/approvals | High |
| Applying hard RLS before auth would break the app | High (blocker documented in P0 batch) |

---

## 2. Design goals (Planned)

1. Every human actor authenticates via Supabase Auth (`auth.users`).  
2. Every internal user has a `user_profiles` row linked by `user_id`.  
3. Access to business data is **company-scoped** via membership.  
4. Platform Admin is the only cross-company operator role.  
5. External Customer / External Supplier are restricted portal roles.  
6. Server Actions and RLS both enforce permissions (defense in depth).  
7. Sensitive actions write immutable audit events.

---

## 3. Final permission model (summary)

See `ROLE_MODEL.md` and `PERMISSION_MATRIX.md` for full matrices.

**Identity stack (Planned):**

| Layer | Store |
| --- | --- |
| Authentication | Supabase Auth (`auth.users`) |
| Profile | `public.user_profiles` (`user_id` → `auth.users.id`) |
| Role catalog | `public.roles` (expanded codes) |
| Company access | `public.company_memberships` (user × company × role) |
| Active company | Session claim / cookie / header resolved in middleware (Planned) |
| Permissions | Role → permission grants (matrix); optional jsonb on `roles.permissions` |

---

## 4. Middleware flow (Planned)

```text
Request
  ↓
Authentication
  — resolve Supabase session; unauthenticated → redirect /login (Planned route)
  ↓
Company Resolution
  — active company_id from secure cookie/claim
  — must be a membership of the user (unless Platform Admin)
  ↓
Role Resolution
  — membership.role_code (+ Platform Admin override)
  ↓
Permission Check
  — map route / Server Action to permission key
  — deny by default
  ↓
Business Logic
  — Server Component load / Server Action / Route Handler
  — queries always constrained by company_id (except Platform Admin tooling)
  ↓
Audit Log
  — write audit_events / activity for mutating and auth events
  ↓
Response
```

**Implementation notes (Planned — not coded in this task):**

- Next.js `middleware.ts` for session + company cookie validation.  
- Shared server helper `requireSession()` / `requirePermission(perm)` / `requireCompany()`.  
- Replace stub `getCurrentRole()` with membership-aware resolver.  
- Do **not** use `service_role` in the Next.js app.

---

## 5. Migration proposals

Only proposals are authored. **Do not apply** without approval.

| File | Intent |
| --- | --- |
| `20260805070000_auth_foundation_proposal.sql` | Memberships, role seed expansion, ownership columns, audit_events, helper stubs — **guarded / proposal** |

Effective RLS replacement remains **blocked** until authentication is wired (see P0 RLS proposal).

---

## 6. Acceptance criteria (for future implementation batches)

| # | Criterion |
| --- | --- |
| A1 | Unauthenticated users cannot reach `(erp)` routes |
| A2 | `getCurrentRole()` never hardcodes admin in production path |
| A3 | Non–Platform Admin queries cannot return other companies’ rows |
| A4 | Server Actions deny missing permissions |
| A5 | Login/logout and key business mutations appear in audit log |
| A6 | No `service_role` in app; secrets remain server-only |

---

## 7. Out of scope for this document batch

- Implementing login UI  
- Changing `permissions.ts` runtime stub (requires auth approval)  
- Applying migrations  
- Remote Supabase configuration  
- Browser automation tests  

---

## 8. Workflow trace (this task)

| Stage | Result |
| --- | --- |
| Request | Auth foundation design |
| Product clarification | Multi-company ERP; roles listed by user |
| Architecture plan | This document set |
| Risk assessment | Critical open RLS / stub admin; apply blocked |
| Implementation | Documentation + proposal SQL only |
| Security / QA | Design review; local build/tsc validation |
| Human / commit / deploy | Not requested |
