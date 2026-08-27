# SKY ERP — Development Workflow

How every module (and every substantial feature) is built. Skip steps only with an explicit, documented reason.

---

## Overview

```text
1 Analysis → 2 Database → 3 Migration → 4 Server Action
        → 5 UI → 6 Testing → 7 Review → 8 Build → 9 Git
```

Cross-cutting references: [PROJECT_STANDARDS.md](./PROJECT_STANDARDS.md), [DATABASE_GUIDELINES.md](./DATABASE_GUIDELINES.md), [UI_GUIDELINES.md](./UI_GUIDELINES.md), [MODULE_TEMPLATE.md](./MODULE_TEMPLATE.md).

---

## 1. Analysis

**Goal:** Know the real schema and operator flow before writing UI.

Checklist:

- [ ] Define purpose and primary operator jobs (create, list, filter, detail, link).
- [ ] Identify entities, FKs, and owning module vs contract-hub attachment.
- [ ] Inspect **live** Supabase columns (or existing migrations) — do not invent fields.
- [ ] Confirm RLS expectations for SELECT / INSERT / UPDATE / DELETE.
- [ ] Decide Server Action vs Route Handler (body size, streaming, AI).
- [ ] List permissions keys (`assertCan` capabilities) if writes are gated.
- [ ] Fill [MODULE_TEMPLATE.md](./MODULE_TEMPLATE.md) for new modules.
- [ ] Note open questions (soft delete vs `is_active`, unique codes, cascading deletes).

**Exit criteria:** Written field list matching DB; clear UX path; no unresolved “does this column exist?”.

---

## 2. Database

**Goal:** Design the schema change set on paper (and in SQL draft).

Checklist:

- [ ] UUID PK, `created_at`, `updated_at`.
- [ ] `created_by` / `updated_by` when attribution matters (uuid → `auth.users`).
- [ ] Soft delete strategy if entity is durable.
- [ ] FK constraints + delete behavior.
- [ ] Indexes for FKs, filters, unique business keys.
- [ ] `jsonb` only for flexible payloads (extractions, metadata).
- [ ] Align naming with [DATABASE_GUIDELINES.md](./DATABASE_GUIDELINES.md).

**Exit criteria:** Draft SQL reviewed against guidelines; no conflicting column names.

---

## 3. Migration

**Goal:** Append an ordered migration under `supabase/migrations/`.

Checklist:

- [ ] Filename `YYYYMMDDHHMMSS_snake_description.sql`.
- [ ] Idempotent guards where appropriate (`if not exists`).
- [ ] Enable RLS + policies in the same change when creating tables.
- [ ] Backfills are safe to re-run.
- [ ] Hotfix = new file; never rewrite applied migrations.
- [ ] Apply to the target Supabase project.
- [ ] Verify PostgREST can SELECT/INSERT with the app role.

**Exit criteria:** Migration applied; probe confirms policies; schema cache sees new objects.

---

## 4. Server Action

**Goal:** Mutate data on the server with validation and revalidation.

Checklist:

- [ ] `"use server"` module under `src/lib/<module>/actions.ts`.
- [ ] Input type in `types.ts`; empty-string → `null` mapping.
- [ ] Required-field validation with clear errors.
- [ ] Unique checks where needed (e.g. `code`).
- [ ] Supabase error mapping (`23505`, `23502`, `42501`, …).
- [ ] Permission assert when applicable.
- [ ] `revalidatePath` for list/detail/related routes.
- [ ] Audit / timeline events for significant creates/updates.
- [ ] No large binary upload through Server Actions — use Route Handlers.
- [ ] No OpenAI calls from the client; AI only in server modules / API routes.

**Exit criteria:** Action returns typed success/failure; happy path inserts visible on refresh.

---

## 5. UI

**Goal:** Ship operator-complete surfaces matching [UI_GUIDELINES.md](./UI_GUIDELINES.md).

Checklist:

- [ ] Server page loads data; client `*View` owns interactivity.
- [ ] Primary CTA opens modal / navigates with a real handler (never a dead button).
- [ ] Form fields = real columns; required marked.
- [ ] Loading, disabled submit, Escape, backdrop, Cancel, close.
- [ ] Toast + `router.refresh()` on success.
- [ ] Error and empty states.
- [ ] Detail page uses `EntityWorkspace` when entity-centric.
- [ ] Preserve dark SKY tokens; Lucide icons only.

**Exit criteria:** Click paths work with zero dead controls; success appears in the table/detail.

---

## 6. Testing

**Goal:** Prove the vertical slice before review.

Minimum manual script for CRUD modules:

1. Load list page — data or empty state renders.
2. Open create modal — Escape / backdrop / Cancel work.
3. Submit empty required fields — validation errors.
4. Submit valid row — toast, modal closes, row visible.
5. Open detail — fields correct; linked panels load or empty cleanly.
6. Force RLS denial (if policy missing) — error message, no silent failure.
7. For uploads/AI — progress UI; review confirmation before create.

Automated tests: add when the module owns non-trivial pure logic (parsers, matchers, money allocation). Prefer unit tests next to `src/lib/<module>/`.

**Exit criteria:** Manual script passed on local/dev Supabase; known RLS gaps documented.

---

## 7. Review

**Goal:** Human or agent review against standards.

Checklist:

- [ ] No mock data in shipped paths.
- [ ] No invented columns / disabled RLS.
- [ ] Server vs client boundaries correct.
- [ ] Permissions and audit considered.
- [ ] Docs updated if architecture/module status changed.
- [ ] Diff scoped — no unrelated refactors.

**Exit criteria:** Review notes addressed; ready to build.

---

## 8. Build

**Goal:** Typecheck and production compile.

```bash
pnpm build
# or
npm run build
```

Fix all TypeScript and build errors before merge. If Next.js APIs look unfamiliar, consult `node_modules/next/dist/docs/`.

**Exit criteria:** Clean build.

---

## 9. Git

**Goal:** Record the change cleanly when the operator requests a commit.

Checklist:

- [ ] Do not commit unless asked.
- [ ] Do not commit `.env.local` or secrets.
- [ ] Stage only relevant files (code + migrations + docs for the feature).
- [ ] Imperative commit message focused on why (see Project Standards).
- [ ] Do not amend shared history; do not force-push `main`.
- [ ] Open PR with summary + test plan when requested.

**Exit criteria:** History reflects one coherent change set; CI/build green if configured.

---

## Feature-type variants

| Feature type | Extra steps |
| --- | --- |
| Contract hub tab | Wire into `/contracts/[id]/…` layout; reuse contract loaders |
| DMS attachment | Use documents helpers; uuid-safe `uploaded_by`; partial failure safe |
| AI extraction | Route Handler + Storage + server OpenAI; review UI before mutate |
| Permissions | Extend roles/capabilities; gate actions; document policy SQL |
| Reporting | Prefer SQL views / server aggregations; no client-only fake charts |

---

## Definition of done

A module slice is done when:

1. Migration applied with RLS.
2. Server Action (or justified API route) persists to Supabase.
3. UI completes the operator job with loading/error/success.
4. Build passes.
5. MODULE_TEMPLATE / ARCHITECTURE updated if the module is new or status changed.
