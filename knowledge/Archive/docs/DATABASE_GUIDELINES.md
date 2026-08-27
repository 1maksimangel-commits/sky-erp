# SKY ERP — Database Guidelines

Standards for PostgreSQL schema design, Supabase usage, RLS, and migrations. Align every new table with these conventions unless a migration documents an explicit exception.

---

## 1. Primary keys

- Use **UUID** primary keys for all application entities.

```sql
id uuid primary key default gen_random_uuid()
```

- Never expose sequential integers as public identifiers for core ERP entities.
- Foreign keys reference `uuid` columns of the same type.

---

## 2. Timestamps

Every durable business table should include:

```sql
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```

**Rules**

- Store all timestamps as `timestamptz`.
- Prefer DB defaults over client-supplied create times.
- Maintain `updated_at` via trigger or explicit update in Server Actions / SQL.
- UI formatting happens in `format.ts` helpers — not in SQL.

**Recommended trigger pattern**

```sql
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger <table>_set_updated_at
before update on public.<table>
for each row execute function public.set_updated_at();
```

Reuse a single shared function when present; do not duplicate per table without reason.

---

## 3. Actor columns

Where attribution matters (most mutable business tables):

```sql
created_by uuid null references auth.users (id) on delete set null,
updated_by uuid null references auth.users (id) on delete set null
```

**Rules**

- Columns that reference `auth.users` **must remain uuid**. Never write the string `'system'` into a uuid column.
- If the actor is unknown (anon/dev), store `null`.
- Document upload fields such as `uploaded_by` follow the same uuid rule.
- Platform audit / activity tables may additionally store display labels in text fields — not as FK substitutes.

---

## 4. Soft delete

Prefer soft delete for entities that participate in financial, contractual, or audit trails.

```sql
deleted_at timestamptz null
-- optional:
-- is_deleted boolean not null default false
```

**Rules**

- List queries default to `deleted_at is null`.
- Hard delete only for pure staging/temp rows (e.g. disposable import scratch) or when a product decision explicitly allows it.
- Cascades: prefer `on delete restrict` / `set null` for business FKs; use `cascade` only for true ownership children (e.g. line items of a draft).
- Restoring a soft-deleted row clears `deleted_at` and writes audit.

If a table uses `is_active` for operational enablement (companies, counterparties, products), that is **not** a substitute for soft delete — both may coexist (`is_active` = business status; `deleted_at` = removed from product surface).

---

## 5. Audit log

Cross-cutting audit lives in platform tables (activity / timeline / dedicated audit helpers).

**Minimum expectations**

| Concern | Approach |
| --- | --- |
| Who | `created_by` / `updated_by` / session user id |
| What | Entity type + entity id + action |
| When | `created_at` on event row |
| Context | JSON payload or message field |

Use `recordEntityEvent` (or successor) from Server Actions after successful mutations that operators must see in history (contract create from import, status changes, etc.).

Do not rely solely on application logs for compliance-grade history.

---

## 6. Foreign keys

- Name: `<referenced_singular>_id` (e.g. `company_id`, `contract_id`).
- Always declare formal FK constraints in migrations.
- Index FK columns (see Indexes).
- Choose delete behavior deliberately:

| Situation | Behavior |
| --- | --- |
| Optional link | `on delete set null` |
| Strong child | `on delete cascade` |
| Must keep history | `on delete restrict` |

- Polymorphic attachments (documents) may use `entity_type` + `entity_id` **plus** optional typed FKs (`company_id`, `contract_id`, …) when already established in DMS migrations — stay consistent with existing schema.

---

## 7. Indexes

Create indexes for:

1. Every foreign key used in joins/filters.
2. High-cardinality filter columns (`status`, `is_active`, `code` when searched).
3. Unique business keys (`code` unique where required).
4. Time-ordered lists (`created_at desc` via btree as needed).

```sql
create index if not exists contracts_company_id_idx
  on public.contracts (company_id);

create unique index if not exists companies_code_key
  on public.companies (code);
```

Avoid redundant indexes; document unusual partial indexes in the migration header comment.

---

## 8. Row Level Security (RLS)

1. `alter table … enable row level security` for application tables.
2. Ship policies in the same migration that creates the table when possible.
3. Never disable RLS to unblock a feature.
4. Development policies may use `to public` with `using (true)` / `with check (true)` — match existing module style, then tighten toward authenticated roles.
5. Surface `42501` to operators as permission denied; include the exact policy SQL in the PR/docs when missing.

**Policy naming**

```text
"Public select <table>"
"Public insert <table>"
"Public update <table>"
"Public delete <table>"
```

Or role-scoped names when Permissions mature (`"Managers insert contracts"`).

---

## 9. Column naming & types

| Pattern | Guidance |
| --- | --- |
| Money | `numeric` with explicit scale; always pair with `currency` text/code |
| Quantities | `numeric` — not float |
| Flags | `boolean not null default …` |
| Short codes | `text` with unique constraint |
| Enums | Prefer `text` + check constraint or Postgres enum; keep app constants in sync |
| JSON | `jsonb` for extraction payloads, match bundles, flexible metadata |
| Country/city | `text` columns named `country`, `city` — not `countries` / inventing plural tables unless normalized |

**Validate against live schema** before inventing columns in TypeScript.

---

## 10. Migration strategy

### 10.1 Location & order

- Directory: `supabase/migrations/`
- Filename: `YYYYMMDDHHMMSS_description.sql`
- Lexicographic order = apply order

### 10.2 Change types

| Change | Approach |
| --- | --- |
| New module tables | One cohesive migration (+ RLS + indexes) |
| Additive columns | `add column if not exists` |
| Backfills | Idempotent `update … where … is null` |
| Hotfixes | New migration; do not edit applied files |
| Destructive | Explicit approval; prefer expand/contract |

### 10.3 Expand / contract

1. **Expand:** add nullable column / new table.
2. **Migrate:** backfill, dual-write if needed.
3. **Contract:** drop obsolete columns only after code no longer reads them.

### 10.4 Verification

After applying migrations:

- Confirm PostgREST schema cache sees new columns/tables.
- Probe SELECT/INSERT under the same key role the app uses.
- Run `pnpm build` / `npm run build` for TypeScript alignment.

### 10.5 Staging tables

Import/AI staging (e.g. `contract_imports`) may omit soft delete but must still use UUID PKs, timestamps, and clear status enums (`uploaded`, `processing`, `review`, `failed`, …).

---

## 11. Storage

- Binary files live in Supabase Storage (e.g. `documents` bucket), not in Postgres bytea.
- DB rows store `file_path`, `file_name`, `mime_type`, `file_size`.
- Path convention: hierarchical by feature (`imports/<importId>/…`, entity folders as established).
- Signed URLs for preview; never embed long-lived public URLs for sensitive contracts unless product requires it.

---

## 12. Anti-patterns

- Inventing columns in UI/actions that do not exist (`status` instead of `is_active`, `countries` instead of `country`).
- Writing non-uuid sentinels into uuid columns.
- Dropping tables to “reset” shared environments.
- Using Server Actions to insert 20 MB PDFs into Storage.
- Client-side Supabase writes that bypass Server Action validation (prefer server mutations for business creates).

---

## Related documents

- [PROJECT_STANDARDS.md](./PROJECT_STANDARDS.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DEVELOPMENT_WORKFLOW.md](./DEVELOPMENT_WORKFLOW.md)
