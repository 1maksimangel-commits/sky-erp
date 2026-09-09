# Authentication and RLS — Phase 2

## Canonical model

Supabase Auth password login → verified user ID → active `user_profiles` row →
`company_memberships(user_id, company_id, role_code)` → database role permissions →
company-owned rows. The same model applies in local development and production.

`src/proxy.ts` refreshes SSR cookies and calls Auth `getUser()`. Unauthenticated
pages redirect to `/login`; API routes return 401. ERP layout requires a provisioned
profile and membership, or global Admin. Users without membership see
`/access-pending`. Settings selects an accessible company through a validated RPC.
Memberships determine authorization; the active company is a write default and UI
filter, never a substitute for RLS. Users with several memberships can access each
permitted company; they cannot graft records between those companies.

The migration is `20260908120000_authenticated_company_access.sql`, appended after
the preserved Phase 1 chain. No historical SQL or production database was changed.

## Audit findings and removed conflicts

| Previous path | Evidence at the Phase 1 baseline | Phase 2 result |
| --- | --- | --- |
| Fake application Admin | `src/lib/platform/permissions.ts` returned Admin unconditionally | Verified identity and database permission RPC; no fallback Admin |
| Environment authorization | `company-scope.ts` used optional `SKY_ACTIVE_COMPANY_ID`; null meant unrestricted | Membership-backed request context; environment bypass removed |
| Incomplete session UX | No login/proxy; UserMenu was a fake Admin and sign-out only closed a menu | Password login, cookie refresh, genuine sign-out |
| Conflicting public policies | Historical platform, CRM, warehouse, finance, DMS and compatibility migrations accumulated `to public ... true` policies | One forward migration replaces policies with explicit authenticated company policies |
| Missing table privileges | SQL privileges and RLS were patched separately; ignored local bootstrap grants differed from migration history | Explicit authenticated grants AND operation policies, verified under actual database roles and PostgREST |
| Privileged RPC bypass | Finance, warehouse, activity, timeline, notification and soft-delete RPCs used SECURITY DEFINER | Existing transactional bodies/signatures preserved with SECURITY INVOKER |
| Missing company ownership | Many child/master tables lacked company_id; proposals mentioned memberships but created none | Actual membership table, ownership columns, parent derivation and relationship validation |
| Shared storage authorization | Historical public object policies and multiple unscoped path conventions | Private bucket with company path policies; historical paths require visible registered metadata |
| Encoded privileged key | Old env validator only looked for literal service-role/secret strings | Decode JWT role; reject non-public keys; browser dependency and bundle gates |

The earlier errors on notifications, timeline_events, document_templates, contracts
and crm_customers were consequences of inconsistent identity, grants and policies,
not five independent missing-policy defects. Each now passes authenticated
SELECT/INSERT/UPDATE/DELETE and cross-company rejection tests. Unauthorized access
still fails deliberately.

## Roles

`roles.permissions` is the only permission registry; Settings reads it.

| Role | Read | Write |
| --- | --- | --- |
| Global Admin | All companies and unassigned legacy records | Administrative and business access across companies |
| Company membership with admin role | Its company | All business modules in that company; cannot create companies, change roles/profiles/memberships or promote itself |
| sales | Its company | Counterparties, products, Deals, contracts/import, CRM, documents, platform events |
| finance | Its company | Finance, documents, platform events; shared exchange rates |
| warehouse | Its company | Warehouse, documents, platform events |
| logistics | Its company | Logistics, documents, platform events |
| management / readonly | Its company | None |

Global Admin requires an active profile with `role_code='admin'`. Other profile
role values do not grant company access; membership roles do. Disabled profiles
lose business access even with memberships. Revoking membership takes effect in
database policy evaluation without waiting for JWT expiry.

Signup creates a readonly profile with no memberships. User metadata and matching
email addresses never grant roles or bind a user to the old seeded Admin. Existing
Auth identities without profiles receive the same unprivileged profile. Profiles
have a unique Auth user ID and an FK to `auth.users`.

## Complete RLS inventory

All **49 public tables** have RLS enabled. All 42 private tables below have explicit
authenticated SELECT, INSERT, UPDATE and DELETE grants and four matching policies.
SELECT requires company membership; writes additionally require the listed
module's write permission. Every private table has `company_id`, an Admin override,
and no anonymous access. No private table relies on browser/server service-role
access. The exact policy expressions, function privileges and storage policies are
emitted to each run's `rls-inventory.json`.

| Private table | Permission domain | S / I / U / D policies |
| --- | --- | --- |
| `accounts` | `finance` | Yes / Yes / Yes / Yes |
| `activity_log` | `platform` | Yes / Yes / Yes / Yes |
| `bank_accounts` | `finance` | Yes / Yes / Yes / Yes |
| `bank_transactions` | `finance` | Yes / Yes / Yes / Yes |
| `business_cases` | `business_cases` | Yes / Yes / Yes / Yes |
| `contract_import_field_reviews` | `contracts` | Yes / Yes / Yes / Yes |
| `contract_imports` | `contracts` | Yes / Yes / Yes / Yes |
| `contract_products` | `contracts` | Yes / Yes / Yes / Yes |
| `contracts` | `contracts` | Yes / Yes / Yes / Yes |
| `counterparties` | `counterparties` | Yes / Yes / Yes / Yes |
| `crm_attachments` | `documents` | Yes / Yes / Yes / Yes |
| `crm_communications` | `crm` | Yes / Yes / Yes / Yes |
| `crm_contacts` | `crm` | Yes / Yes / Yes / Yes |
| `crm_customers` | `crm` | Yes / Yes / Yes / Yes |
| `crm_notes` | `crm` | Yes / Yes / Yes / Yes |
| `crm_tasks` | `crm` | Yes / Yes / Yes / Yes |
| `crm_timeline_events` | `crm` | Yes / Yes / Yes / Yes |
| `deal_commission_links` | `finance` | Yes / Yes / Yes / Yes |
| `deal_participants` | `business_cases` | Yes / Yes / Yes / Yes |
| `deal_products` | `business_cases` | Yes / Yes / Yes / Yes |
| `document_generation_batches` | `documents` | Yes / Yes / Yes / Yes |
| `document_templates` | `documents` | Yes / Yes / Yes / Yes |
| `document_versions` | `documents` | Yes / Yes / Yes / Yes |
| `documents` | `documents` | Yes / Yes / Yes / Yes |
| `expenses` | `finance` | Yes / Yes / Yes / Yes |
| `generated_documents` | `documents` | Yes / Yes / Yes / Yes |
| `inventory` | `warehouse` | Yes / Yes / Yes / Yes |
| `inventory_lots` | `warehouse` | Yes / Yes / Yes / Yes |
| `inventory_reservations` | `warehouse` | Yes / Yes / Yes / Yes |
| `invoice_items` | `finance` | Yes / Yes / Yes / Yes |
| `invoices` | `finance` | Yes / Yes / Yes / Yes |
| `notifications` | `platform` | Yes / Yes / Yes / Yes |
| `payment_allocations` | `finance` | Yes / Yes / Yes / Yes |
| `payments` | `finance` | Yes / Yes / Yes / Yes |
| `products` | `products` | Yes / Yes / Yes / Yes |
| `shipment_timeline_events` | `logistics` | Yes / Yes / Yes / Yes |
| `shipments` | `logistics` | Yes / Yes / Yes / Yes |
| `stock_movements` | `warehouse` | Yes / Yes / Yes / Yes |
| `template_mappings` | `documents` | Yes / Yes / Yes / Yes |
| `timeline_events` | `platform` | Yes / Yes / Yes / Yes |
| `warehouse_locations` | `warehouse` | Yes / Yes / Yes / Yes |
| `warehouse_transfers` | `warehouse` | Yes / Yes / Yes / Yes |

| Other table | SELECT | INSERT / UPDATE / DELETE |
| --- | --- | --- |
| companies | Member of that company or global Admin | Global Admin |
| user_profiles | Own profile or global Admin | Global Admin |
| company_memberships | Own memberships or global Admin | Global Admin |
| roles | Provisioned user or global Admin | Global Admin |
| currencies | Provisioned user or global Admin | Global Admin |
| expense_categories | Provisioned user or global Admin | Global Admin |
| exchange_rates | Provisioned user or global Admin | Finance permission or global Admin |

There is no separate commissions table in the reconstructed schema: existing
commission associations use `deal_commission_links` and finance expense records.

Ownership triggers derive child ownership from parents, validate company-owned
foreign keys and polymorphic document/event links, prevent ownership reassignment,
and bind user/upload actor IDs to the authenticated user. Existing NULL ownership
is not guessed or exposed to members; it remains accessible to global Admin.
Global Admin can maintain unassigned legacy records. Assigning historical
ownership requires a separately reviewed data migration, not a browser edit.

## Storage and browser security

Browser and server Supabase clients both use the public publishable key (or legacy
JWT with role anon) plus the user's authenticated session. There is **no service
role client** in the application. Server client, permission context and storage
scope modules are server-only. Browser graph and built chunks are checked for
privileged credential exposure.

The documents bucket remains private. New object names use
`companies/<company UUID>/...`; global Admin without an active company may use
`global/...`. PDF import, hub uploads, DMS versions, CRM attachments, DOCX templates
and generation uploads all use the same path helper. RLS validates the prefix for
read/write/signing. Copying a historical path requires existing company-owned
metadata (or global Admin); inserting a different company's path is rejected.

Anon may reach Auth/login and static application assets. It receives no ERP table
CRUD, ERP RPC execution or private document access. There is no special local anon
mode. Ignored legacy bootstrap directories remain untouched but are not inputs to
the canonical replay. Do not reuse their grants.

Business RPCs run as the caller. Narrow identity/permission helpers and the
ownership trigger use fixed-search-path SECURITY DEFINER functions; private
helpers are not exposed by PostgREST, and internal trigger helpers have no
authenticated execution grant. No OpenAI credentials or extraction behavior changed.

## Provisioning and existing-environment adoption

This phase does not apply migrations, create users, assign real roles, change env
files or move real data in an existing local/remote project.

Before an approved adoption, review the actual schema and migration ledger, check
duplicate/orphan profile IDs, identify a verified Auth UUID for the first global
Admin, and review ownership for NULL or conflicting company links. The migration
fails on invalid profile uniqueness/FK assumptions rather than deleting identities.

The first real Admin must be provisioned by an explicitly approved, narrowly
targeted operation using that verified Auth UUID. There is no hardcoded account,
email-based promotion, automatic Admin or shared development password. An existing
global Admin can then manage memberships through authenticated administrative
access. No new user-management product feature is included.

For manual verification after an approved local environment switch: sign in as
each provisioned test user, confirm company visibility and Settings selection,
upload/download a company document, then sign out and confirm protected routes
require login again. Browser automation was not run.

## Automated gate

```sh
pnpm db:check
pnpm db:test
pnpm auth:test
pnpm db:replay
pnpm exec tsc --noEmit
pnpm lint
pnpm build
pnpm auth:bundle
git diff --check
```

The replay still checks historical hashes, ordered reconstruction, all application
schema references and the unchanged Phase 1 schema smoke test. It additionally:

- Inventories every public table and rejects unclassified/new untested tables,
  disabled RLS, anon grants, missing authenticated grants/policies, and unreviewed
  security-definer RPCs.
- Seeds fictional Company A/B and uses real authenticated and anon PostgreSQL
  roles. Tests all private-table CRUD, isolation both ways, Admin access, role
  matrix, disabled/pending/readonly users, self-promotion, FK/path grafts and RPCs.
- Tests actual password login, verified identity, refresh, logout/revoked refresh
  tokens, PostgREST CRUD and private Storage with public-key clients over the
  newly created isolated localhost stack.
- Preserves rollback-only SQL fixtures. HTTP tests create fictional identities,
  business rows and objects only in that disposable test stack; its stopped local
  volume backup is retained. No fixture passwords, JWTs or API keys are printed
  or included in evidence artifacts.
- Stops its own containers even on failure and writes PASS only after cleanup.

Sign-out clears the session and revokes refresh tokens. Supabase access tokens
already issued remain valid until expiry; immediate business access revocation
uses inactive profiles or removed memberships.

CI includes the source security tests, replay and post-build bundle check. Remote
CI and branch protection are not changed by running the local gate. This gate
proves the access contract, not a full browser E2E run of every business module.
Phase 3 and later business stabilization remain outside this phase.


## Phase 2 local verification — 2026-09-08

PASS on a fresh isolated Mac replay of **49 migrations**, with all historical
checksums intact. The source contract covers **42 application tables**, **260
selects**, **1,082 column uses**, **39 insert/upsert payloads** and **13 RPC names**.
No missing schema objects or required relationships were reported. All **49 public
tables** are inventoried; functional CRUD and A/B isolation cover **42 private tables**.

Final replay evidence:
`.db-replay/sky-erp-replay-c6c02caa058940938619/{catalog,rls-inventory,result}.json`.
Schema smoke, authenticated/anon SQL, role matrix, Auth/PostgREST/Storage HTTP,
and stack cleanup passed. TypeScript, lint and production build passed. Source
security tests and the built-browser key scan passed. No browser UI automation
was used, and remote behavior is not claimed as verified.

No remote Supabase changes, remote migrations, commits or pushes were made.
No application dev server or watcher was started; all replay containers stopped.
Phase 1 remains the baseline commit `5b9769e8116466fd6230c36d06386a81851c7e4b`.
Only the two reviewed dynamic-source checksums changed in `history-lock.json`,
after reviewing async authorization call-site changes; historical hashes did not.

## Exact Phase 2 file inventory

- `.github/workflows/database-replay.yml`
- `README.md`
- `knowledge/02_SYSTEM_ARCHITECTURE.md`
- `knowledge/DOCUMENTATION_INDEX.md`
- `knowledge/Development/DatabaseReconstruction.md`
- `knowledge/Development/Testing.md`
- `knowledge/Memory/KNOWN_ISSUES.md`
- `package.json`
- `scripts/database/replay.mjs`
- `src/app/(erp)/layout.tsx`
- `src/app/(erp)/settings/page.tsx`
- `src/app/api/contracts/[id]/generate/route.ts`
- `src/app/api/contracts/import/[id]/reextract/route.ts`
- `src/app/api/contracts/import/route.ts`
- `src/app/api/document-templates/[id]/download/route.ts`
- `src/app/api/documents/generate/route.ts`
- `src/components/layout/UserMenu.tsx`
- `src/lib/business-cases/actions.ts`
- `src/lib/companies/actions.ts`
- `src/lib/contracts/actions.ts`
- `src/lib/contracts/documents.ts`
- `src/lib/contracts/hub-actions.ts`
- `src/lib/contracts/import/actions.ts`
- `src/lib/contracts/import/service.ts`
- `src/lib/crm/actions.ts`
- `src/lib/crm/db.ts`
- `src/lib/deals/actions.ts`
- `src/lib/document-templates/actions.ts`
- `src/lib/document-templates/generated-actions.ts`
- `src/lib/documents/actions.ts`
- `src/lib/documents/db.ts`
- `src/lib/documents/generation-actions.ts`
- `src/lib/documents/signed-url-auth.ts`
- `src/lib/finance/actions.ts`
- `src/lib/logistics/actions.ts`
- `src/lib/logistics/auth.ts`
- `src/lib/logistics/db.ts`
- `src/lib/platform/company-scope.ts`
- `src/lib/platform/permissions.ts`
- `src/lib/supabase/env.ts`
- `src/lib/supabase/server.ts`
- `src/lib/warehouse/actions.ts`
- `supabase/history-lock.json`
- `knowledge/Development/AuthRLS.md`
- `scripts/database/auth-http.mjs`
- `scripts/database/auth-security.test.mjs`
- `src/app/access-pending/page.tsx`
- `src/app/login/page.tsx`
- `src/lib/auth/actions.ts`
- `src/lib/documents/storage-scope.ts`
- `src/lib/supabase/public-key.ts`
- `src/proxy.ts`
- `supabase/migrations/20260908120000_authenticated_company_access.sql`
- `supabase/replay/auth-rls.sql`
- `supabase/replay/rls-inventory.sql`

