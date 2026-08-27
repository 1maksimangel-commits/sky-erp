# SKY ERP — Company Model & Ownership Inventory

**Status:** Design + inventory from repository migrations/app usage  
**Rule:** Every business record must belong to a company. No user may access another company’s data (except Platform Admin, audited).

---

## 1. Company entity

| Concept | Confirmed / Planned |
| --- | --- |
| Legal entity table | `public.companies` (assumed master; insert RLS policy exists) |
| Business ownership | `company_id` on operational records |
| Membership | **Planned:** `public.company_memberships` |
| Active company | **Planned:** session/cookie resolved in middleware |

### Membership (Planned)

```text
company_memberships (
  id uuid PK,
  user_id uuid → auth.users,
  company_id uuid → companies,
  role_code text → roles.code,
  counterparty_id uuid null → counterparties,  -- external roles
  is_active boolean,
  created_at, updated_at,
  created_by, updated_by uuid null
  unique (user_id, company_id)
)
```

---

## 2. Isolation rules

| Rule |
| --- |
| Queries for non–platform-admin users include `company_id = active_company` |
| Inserts set `company_id` from session (never trust client alone) |
| Updates/deletes must not change `company_id` across tenants |
| Child rows inherit company from parent **and** should store denormalized `company_id` for RLS performance (Planned) |
| Storage paths should include company segment when redesigned (Planned) |

---

## 3. Table ownership inventory

Based on `supabase/migrations/*.sql` and confirmed app selects.  
**Assumed masters** (`companies`, `contracts`, `counterparties`, `products`, `payments`, …) may exist outside this migration folder — marked **Assumed**.

### Legend

| Mark | Meaning |
| --- | --- |
| Y | Present in migrations (or clearly created there) |
| A | Assumed / used by app; not created in this migration folder |
| N | Not found in migrations |
| n/a | Not applicable (platform/reference/self) |
| via | Should inherit; denormalized `company_id` still Planned for RLS |

### Inventory

| Table | company_id | created_by | updated_by | Notes |
| --- | --- | --- | --- | --- |
| companies | n/a (self) | N | N | Add audit actors Planned |
| counterparties | A/N | N | N | Assumed master; company ownership Planned |
| products | A/N | N | N | Assumed master; company or shared catalog TBD — **Planned decision** |
| contracts | A | N | N | App requires `company_id`; not created in migrations folder |
| business_cases | Y | N | N | Has `company_id` |
| contract_products | N | N | N | via contract — add `company_id` Planned |
| shipments | N | N | N | has `business_case_id`; add `company_id` Planned |
| shipment_timeline_events | N | N | N | via shipment |
| invoices | Y | N | N | |
| invoice_items | N | N | N | via invoice |
| payments | Y | N | N | column via finance + P0 migration proposal |
| payment_allocations | N | N | N | via payment |
| bank_accounts | Y | N | N | |
| bank_transactions | N | N | N | via bank_account |
| expenses | Y | N | N | |
| expense_categories | n/a | N | N | reference |
| currencies | n/a | N | N | reference |
| exchange_rates | n/a | N | N | reference |
| accounts | Y | N | N | mentioned in finance migration patterns |
| warehouse_locations | N | N | N | **missing company_id** |
| inventory | N | N | N | **missing company_id** |
| inventory_lots | N | N | N | **missing company_id** |
| stock_movements | N | N | N | **missing company_id** |
| warehouse_transfers | N | N | N | **missing company_id** |
| inventory_reservations | N | N | N | **missing company_id** |
| documents | Y | Y (text drift) | N | Prefer uuid actors Planned |
| document_versions | N | N | N | via document |
| activity_log | N | Y (text) | N | add company_id Planned |
| timeline_events | N | Y (text) | N | add company_id Planned |
| notifications | N | Y (text) | N | add company_id Planned |
| roles | n/a | N | N | platform catalog |
| user_profiles | N | Y (text) | N | link `user_id`; not tenant row |
| contract_imports | N | Y (uuid) | N | add company_id Planned |
| contract_import_field_reviews | N | N | N | via import |
| crm_customers | Y | Y (uuid) | Y (uuid) | model for others |
| crm_contacts | N | N | N | via customer — denormalize Planned |
| crm_notes | N | Y | N | via customer |
| crm_communications | N | Y | N | via customer |
| crm_tasks | N | Y | N | via customer |
| crm_timeline_events | N | Y | N | via customer |
| crm_attachments | N | N | N | via customer |

---

## 4. Priority gaps (for migration proposal)

### P0 ownership columns (business-critical)

Add nullable `company_id` (+ index + FK) where missing on:

- warehouse_locations, inventory, inventory_lots, stock_movements, warehouse_transfers, inventory_reservations  
- shipments, contract_products  
- contract_imports  
- activity_log, timeline_events, notifications (for filtering)

### P0 actor columns

Prefer `created_by` / `updated_by` as **uuid → auth.users** (CRM pattern).  
Where `created_by` is `text` (documents/platform), proposal documents type normalization as a **separate approved migration** (do not force unsafe casts here).

### Assumed masters

Document need for a future **baseline masters migration** (or introspection against live DB) before NOT NULL company constraints.

---

## 5. Products multi-company (open decision)

| Option | Note |
| --- | --- |
| A — company-owned products | Each company has its own SKUs |
| B — shared global catalog | `company_id` null means global; RLS allows read-all catalog |

**Status:** Not decided in code. Mark **Planned** — do not invent NOT NULL without product decision.

---

## 6. RLS direction (Planned — after auth)

```sql
-- Pseudocode only — not applied
-- using (
--   company_id in (
--     select cm.company_id from company_memberships cm
--     where cm.user_id = auth.uid() and cm.is_active
--   )
--   or exists (select 1 from company_memberships cm
--              where cm.user_id = auth.uid() and cm.role_code = 'platform_admin')
-- )
```

Cannot be enabled safely until sessions use `authenticated` and memberships exist.
