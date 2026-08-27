# SKY ERP — Project Standards

This document defines the non-negotiable standards for building and evolving SKY ERP. All contributors and agents must follow these rules unless a documented exception is approved.

---

## 1. Project vision

SKY ERP is an operations platform for trading and supply-chain companies. It connects commercial, logistics, warehouse, finance, and document workflows around a single source of truth in Supabase.

**Goals**

- One coherent product for companies, counterparties, products, contracts, shipments, stock, invoices, payments, and documents.
- Contract-centric operations: a contract is a hub that links business cases, logistics, warehouse movements, finance, and files.
- Production reliability over demo theater: real schema, real RLS, real Server Actions, no mock data in shipped paths.
- Dark, dense, professional UI optimized for daily operator use.
- AI assists extraction and suggestions; humans confirm before mutating core business records.

**Non-goals**

- Generic multi-tenant SaaS abstraction before domain depth.
- Client-side secrets or browser calls to OpenAI.
- Silent schema inventiveness (columns that do not exist in Supabase).
- Disabling RLS to “make it work.”

---

## 2. Architecture principles

1. **Server-first.** Pages fetch data on the server. Mutations go through Server Actions (or Route Handlers when payload size/streaming requires it).
2. **Supabase is the system of record.** Application code never invents parallel persistence.
3. **Thin pages, fat modules.** Route files compose; domain logic lives in `src/lib/<module>/`.
4. **Client components only for interactivity.** Lists, dialogs, filters, and toasts are client; data loading stays server when possible.
5. **Contracts as hub.** Cross-module links prefer `contract_id` (and related FKs) over ad-hoc joins in the UI.
6. **Platform capabilities are shared.** Timeline, activity, documents, search, permissions, and notifications live under `src/lib/platform/` and `src/components/platform/`.
7. **Fail loudly, recover safely.** Surface Supabase and validation errors; never delete a parent entity because a child upload failed.
8. **Security by default.** RLS enabled; least privilege; no `service_role` in the Next.js app.
9. **Migrations are append-only.** Schema change = new SQL file under `supabase/migrations/`.
10. **Docs and code stay aligned.** When architecture changes, update `/docs`.

---

## 3. Naming conventions

| Layer | Convention | Examples |
| --- | --- | --- |
| Database tables | `snake_case`, plural | `companies`, `contract_imports` |
| Database columns | `snake_case` | `tax_id`, `is_active`, `created_at` |
| Boolean columns | `is_*` / `has_*` | `is_active` |
| Foreign keys | `<entity>_id` | `company_id`, `buyer_id` |
| TypeScript types | `PascalCase` | `Company`, `ContractFormInput` |
| Functions / vars | `camelCase` | `getCompanies`, `createCompany` |
| Server Actions | verb + noun | `createContract`, `uploadDocument` |
| React components | `PascalCase` file + export | `CompaniesView.tsx` |
| Route segments | `kebab-case` | `/business-cases`, `/bank-accounts` |
| Route groups | `(name)` no URL impact | `(erp)` |
| CSS variables | kebab tokens | `--muted-foreground` |
| Env vars | `SCREAMING_SNAKE` | `OPENAI_API_KEY` |
| Migration files | `YYYYMMDDHHMMSS_description.sql` | `20260805010000_companies_insert_policy.sql` |

**Do not** invent UI field names that diverge from DB columns without an explicit mapping layer.

---

## 4. TypeScript rules

- Strict TypeScript. Prefer explicit result unions over thrown exceptions for domain operations:

  ```ts
  type Result<T> =
    | { success: true; data: T }
    | { success: false; error: string };
  ```

- Prefer `type` for object shapes used across modules; keep Zod schemas next to AI/validation boundaries.
- No `any` unless bridging a third-party gap; isolate and comment.
- Prefer `unknown` + narrowing for catch / JSON payloads.
- Shared entity types live near the module (`src/lib/<module>/types.ts` or module root file).
- Prefer `null` for absent DB scalars in form inputs; convert empty strings at the Server Action boundary.
- Do not generate types that invent columns. Align with live Supabase schema / migrations.

---

## 5. React rules

- Default to Server Components in `src/app`.
- Add `"use client"` only when using state, effects, browser APIs, or event handlers.
- Keep client components focused: views, modals, wizards. Call Server Actions from clients; do not put SQL in components.
- Controlled forms with local state; validate required fields before calling the action.
- Escape closes dialogs; backdrop click closes unless submitting; body scroll locked while open.
- Prefer existing patterns (`Toast`, modal layout, table shells) over new abstractions.
- Do not add `useMemo` / `useCallback` by default; follow React Compiler / existing repo style.
- Loading: disable submit, show spinner label (`Saving…` / `Processing…`).
- After successful mutation: close modal (if any), toast, `router.refresh()` and/or `revalidatePath`.

---

## 6. Next.js App Router rules

- App code lives under `src/app`. ERP shell routes use the `(erp)` group and shared layout.
- Pages are async Server Components that load data and pass props into `*View` client components.
- Dynamic segments: `[id]`. Nested contract workspace tabs under `/contracts/[id]/…`.
- Use Route Handlers (`src/app/api/...`) for:
  - multipart uploads larger than Server Action body limits
  - streaming progress (e.g. NDJSON)
  - anything that must not go through Server Actions
- Read Next.js docs in `node_modules/next/dist/docs/` when APIs may differ from training data (this project targets Next.js 16).
- Configure body limits intentionally (`proxyClientMaxBodySize`, `serverActions.bodySizeLimit`). Never push multi‑MB binaries through Server Actions.

---

## 7. Server Actions rules

- File starts with `"use server"`.
- Actions perform **database mutations** and related server-only work (revalidation, audit events).
- Validate inputs; return `{ success, error }` / `{ success, data }` — do not leak stack traces.
- Map Postgres errors (`23505`, `23502`, `42501`) to operator-readable messages.
- Call `revalidatePath` for affected list/detail routes after success.
- Permission checks via `assertCan` / platform permissions where applicable.
- **Never** send large files through Server Actions. Upload via API route or signed storage flows.
- **Never** expose OpenAI keys or call OpenAI from the browser.
- Keep actions in `src/lib/<module>/actions.ts` (or split files when a module grows).

---

## 8. Supabase rules

- Use `@supabase/ssr` clients from `src/lib/supabase/server.ts` (server) and `client.ts` (browser when needed).
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or project-equivalent publishable key).
- Do **not** use `service_role` in the Next.js application.
- Select only needed columns; order explicitly for list UIs.
- Storage bucket operations go through validated helpers (documents DMS patterns).
- Treat PostgREST / schema-cache errors as migration-not-applied signals; message operators clearly.
- Log structured errors with shared helpers (`logSupabaseError`) when diagnosing server failures.

---

## 9. RLS rules

- RLS stays **enabled** on application tables.
- Policies are explicit SQL in migrations; never “fix” access by disabling RLS.
- Development-era public policies follow the established pattern where present:

  ```sql
  create policy "Public insert <table>"
    on public.<table>
    for insert
    to public
    with check (true);
  ```

- Prefer evolving toward authenticated / role-based policies as Permissions mature; document exceptions in the migration.
- If INSERT/UPDATE/DELETE is blocked, surface `42501` as permission denied and ship the required policy SQL — do not bypass.

---

## 10. SQL migration rules

- Location: `supabase/migrations/`.
- Naming: `YYYYMMDDHHMMSS_snake_description.sql` (UTC timestamp order).
- Append-only: never rewrite applied migrations; add a hotfix migration instead.
- Prefer `if not exists` / guarded DDL for idempotent column adds when safe.
- Include indexes for FK and common filter columns.
- Include RLS enable + policies in the same change set that introduces a table, when possible.
- Do not `DROP TABLE` with production data unless explicitly approved.
- Seed data only when deterministic and safe for shared environments.

---

## 11. Commit message convention

Use concise, imperative subjects focused on **why**:

```
Add company create modal wired to Supabase

Fix documents uploaded_by uuid coalesce in DMS migration

Refactor contract PDF import to API route for 50MB uploads
```

**Rules**

- Imperative mood: “Add”, “Fix”, “Refactor”.
- Optional short body for migrations, RLS, or breaking operational steps.
- No secrets in commits (`.env.local` stays gitignored).
- Do not commit unless requested by the operator.

---

## 12. Folder structure

```text
src/
  app/
    (erp)/                 # Authenticated ERP shell routes
      companies/
      counterparties/
      products/
      business-cases/
      contracts/
      warehouse/
      logistics/
      finance/
      documents/
      dashboard/
      ai/
      settings/
    api/                   # Route Handlers (uploads, streams)
    layout.tsx
    globals.css
  components/
    layout/                # Shell: Sidebar, Header, AppLayout
    platform/              # Cross-entity workspace panels
    ui/                    # Primitives (Toast, etc.)
    <module>/              # Feature UI (CompaniesView, modals, …)
  lib/
    supabase/              # Clients + env
    platform/              # Permissions, audit, search, timeline, …
    ai/                    # Server-only AI integrations
    <module>/              # types, actions, db, validation, format
supabase/
  migrations/              # Ordered SQL
docs/                      # Governance & architecture (this folder)
```

---

## 13. Reusable components policy

**Prefer reuse**

- `EntityWorkspace` and platform panels for detail pages.
- Existing modal shell (backdrop, header, Escape, footer actions).
- `Toast` for success/error feedback.
- Shared formatters under `src/lib/<module>/format.ts`.

**When to create new**

- A pattern appears in 3+ modules with stable props, or
- Accessibility / consistency requires a single control.

**Avoid**

- Premature design-system packages.
- One-off wrappers that only rename classes.
- Cards-for-decoration in operational screens (borders only when they aid scanning or interaction).

---

## 14. Dark theme rules

SKY ERP is **dark-first**. Tokens live in `src/app/globals.css`:

| Token | Role |
| --- | --- |
| `--background` | App canvas (`#09090b`) |
| `--foreground` | Primary text (`#fafafa`) |
| `--sidebar` / `--card` | Elevated surfaces (`#0c0c0e`) |
| `--accent` | Hover / subtle fill (`#18181b`) |
| `--border` / `--card-border` | Dividers (`#27272a`) |
| `--muted-foreground` | Secondary text (`#a1a1aa`) |
| `--ring` | Focus ring (`#3f3f46`) |

**Rules**

- Use semantic Tailwind mappings (`bg-background`, `text-muted-foreground`, `border-border`, `bg-card`) — not raw hex in components.
- Status colors: emerald for active/success, red for errors, amber for warnings, zinc for inactive — always translucent fills + ring, matching existing badges.
- Primary actions: `bg-foreground text-background` (high-contrast inverted button).
- No purple glow aesthetics, no light-cream marketing themes inside the ERP shell.
- Keep contrast readable for dense tables; do not lighten the whole shell for a single widget.

---

## 15. Related documents

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DATABASE_GUIDELINES.md](./DATABASE_GUIDELINES.md)
- [UI_GUIDELINES.md](./UI_GUIDELINES.md)
- [DEVELOPMENT_WORKFLOW.md](./DEVELOPMENT_WORKFLOW.md)
- [MODULE_TEMPLATE.md](./MODULE_TEMPLATE.md)
