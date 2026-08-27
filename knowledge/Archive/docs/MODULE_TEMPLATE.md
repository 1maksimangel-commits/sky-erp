# SKY ERP — Module Template

Copy this file to `docs/modules/<module-name>.md` (or fill in-place in a PR description) for every new module. Replace angle-bracket placeholders. Keep answers concrete and tied to real Supabase objects.

---

## Module name

`<Name>`

**Status:** `Planned | In progress | Present`  
**Owner:** `<team or person>`  
**Routes:** `<e.g. /crm, /crm/[id]>`  
**Nav entry:** `Yes / No` — label `<…>`, icon `<LucideName>`

---

## Purpose

**Problem**

`<What operator pain does this solve?>`

**Primary jobs**

1. `<Job 1 — e.g. create X>`
2. `<Job 2 — e.g. link X to contract>`
3. `<Job 3>`

**Non-goals**

- `<Explicitly out of scope for v1>`

**Success metrics**

- `<e.g. time to create, % records with required links>`

---

## Database

### Tables

| Table | Purpose |
| --- | --- |
| `public.<table>` | `<…>` |

### Columns (core table)

| Column | Type | Nullable | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | no | PK `gen_random_uuid()` |
| `created_at` | `timestamptz` | no | default `now()` |
| `updated_at` | `timestamptz` | no | maintained on update |
| `created_by` | `uuid` | yes | → `auth.users` |
| `updated_by` | `uuid` | yes | → `auth.users` |
| `deleted_at` | `timestamptz` | yes | soft delete if applicable |
| `<column>` | `<type>` | `<yes/no>` | `<…>` |

### Constraints & indexes

- Unique: `<e.g. code>`
- Indexes: `<fk and filter columns>`
- Checks: `<status enum / amounts ≥ 0>`

### Migration file

`supabase/migrations/<YYYYMMDDHHMMSS>_<description>.sql`

---

## Relationships

```text
<Parent> 1 ── * <This module>
<This module> * ── 1 <Contract?>
<This module> * ── * <Other>
```

| Direction | Entity | FK / join | Delete behavior |
| --- | --- | --- | --- |
| Parent | `<companies>` | `<company_id>` | `set null / restrict` |
| Child | `<…>` | `<…>` | `cascade / restrict` |
| Hub | `contracts` | `<contract_id>` | `<…>` |

**Contract hub:** `Attaches as tab / Linked panel / None`

**Documents:** `entity_type = '<…>'` — yes/no  
**Timeline / activity:** yes/no  
**Finance impact:** yes/no

---

## Permissions

| Capability key | Who | Used in |
| --- | --- | --- |
| `<module>.read` | `<roles>` | page load / asserts |
| `<module>.write` | `<roles>` | create/update actions |
| `<module>.delete` | `<roles>` | delete action |

### RLS policies required

```sql
-- Paste exact policies to apply (do not disable RLS)
alter table public.<table> enable row level security;

create policy "Public select <table>"
  on public.<table> for select to public using (true);

create policy "Public insert <table>"
  on public.<table> for insert to public with check (true);

create policy "Public update <table>"
  on public.<table> for update to public using (true) with check (true);

create policy "Public delete <table>"
  on public.<table> for delete to public using (true);
```

Tighten to authenticated / role claims when Permissions module mandates it.

---

## Server Actions

| Action | File | Input | Result | Revalidate |
| --- | --- | --- | --- | --- |
| `create<Entity>` | `src/lib/<module>/actions.ts` | `<FormInput>` | `{ success, id \| error }` | `/<route>` |
| `update<Entity>` | `…` | `…` | `…` | `…` |
| `delete<Entity>` | `…` | `id` | `…` | `…` |

**Route Handlers (if any)**

| Method + path | Why not a Server Action |
| --- | --- |
| `POST /api/<…>` | `<large upload / streaming / AI>` |

**Audit events**

- `<event name>` on `<action>`

---

## UI

### List

- Page: `src/app/(erp)/<route>/page.tsx` (Server Component)
- View: `src/components/<module>/<Name>View.tsx` (`"use client"`)
- Columns: `<…>`
- Filters: `<search, status, …>`
- Primary CTA: `<New …>` → modal / route

### Create / edit

- Modal: `src/components/<module>/<Name>FormModal.tsx`
- Fields: `<match DB columns>`
- Required: `<…>`
- States: loading, validation errors, Cancel, close, Escape, backdrop

### Detail

- Route: `/<route>/[id]`
- Shell: `EntityWorkspace` — yes/no
- Overview fields: `<…>`
- Tabs / panels: `<documents, timeline, linked, finance>`

### Toasts & refresh

- Success message: `"<Entity> saved successfully."`
- `router.refresh()` after create/update/delete

---

## Validation

### Client

- Required fields before submit
- Max file size / MIME if uploads
- Disable submit while saving

### Server

- Re-validate required + uniqueness
- Map Supabase errors to operator copy
- Reject unknown / extra dangerous fields

### Schema reference

- Types: `src/lib/<module>/types.ts`
- Optional Zod: `src/lib/<module>/validation.ts`

---

## Testing

### Manual

1. `<List loads>`
2. `<Create validation>`
3. `<Create success → visible in table>`
4. `<Detail opens>`
5. `<Permission denied path>`
6. `<Contract link / hub tab if any>`

### Automated (optional v1)

- `<pure functions to unit test>`

### Environments

- Local: `pnpm dev` / `npm run dev`
- Build: `pnpm build`
- DB: migrations applied to shared/dev Supabase

---

## Future improvements

- [ ] `<e.g. soft delete UI>`
- [ ] `<e.g. role-scoped RLS>`
- [ ] `<e.g. analytics events>`
- [ ] `<e.g. bulk import>`

---

## Implementation checklist

Use with [DEVELOPMENT_WORKFLOW.md](./DEVELOPMENT_WORKFLOW.md):

1. [ ] Analysis complete (this template filled)
2. [ ] Database designed
3. [ ] Migration written & applied
4. [ ] Server Actions / API routes
5. [ ] UI list + modal + detail
6. [ ] Testing script passed
7. [ ] Review against standards
8. [ ] `pnpm build` clean
9. [ ] Git commit / PR when requested
10. [ ] [ARCHITECTURE.md](./ARCHITECTURE.md) status updated (`Planned` → `Present`)

---

## Notes

`<Freeform risks, open questions, links to Linear/issues>`
