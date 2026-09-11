-- Reconciles a production database that was not built from this migration chain.
--
-- Context: the production project records only 15 of the canonical migrations as
-- applied, yet already contains 45 tables created by other means. Baselining the
-- 17 fully-materialised migrations (a separate, controlled ledger step - never
-- performed by this file) skips the DDL they declared inside CREATE TABLE bodies.
-- This migration supplies exactly that skipped DDL, and nothing else.
--
-- On a clean canonical rebuild this migration is a deliberate NO-OP: every column
-- it adds already exists, every NOT NULL it relaxes is already nullable, every
-- constraint it drops is already absent, and its two conditional constraint
-- additions are suppressed by the canonical company-scoped keys.
--
-- Forward-only. Purely additive or relaxing. No DROP TABLE, DROP COLUMN,
-- TRUNCATE, DELETE, type change or ownership change. Existing rows, auth users,
-- Storage objects and the retained legacy objects are untouched.
--
-- Proven on a restored production clone: 62/62 migrations applied, business data
-- preserved, all Phase 1-8 gates and the Golden E2E passing.

-- 1. Canonical columns declared inside baselined CREATE TABLE bodies.
alter table public.bank_transactions add column if not exists company_id uuid references public.companies(id);
alter table public.business_cases add column if not exists departure_port text;
alter table public.business_cases add column if not exists gross_profit numeric;
alter table public.business_cases add column if not exists incoterm text;
alter table public.business_cases add column if not exists net_profit numeric;
alter table public.business_cases add column if not exists number text;
alter table public.business_cases add column if not exists purchase_amount numeric;
alter table public.business_cases add column if not exists sale_amount numeric;
alter table public.contract_import_field_reviews add column if not exists company_id uuid references public.companies(id);
alter table public.counterparties add column if not exists company_id uuid references public.companies(id);
alter table public.crm_attachments add column if not exists company_id uuid references public.companies(id);
alter table public.crm_communications add column if not exists company_id uuid references public.companies(id);
alter table public.crm_contacts add column if not exists company_id uuid references public.companies(id);
alter table public.crm_notes add column if not exists company_id uuid references public.companies(id);
alter table public.crm_tasks add column if not exists company_id uuid references public.companies(id);
alter table public.crm_timeline_events add column if not exists company_id uuid references public.companies(id);
alter table public.document_versions add column if not exists company_id uuid references public.companies(id);
alter table public.invoice_items add column if not exists company_id uuid references public.companies(id);
alter table public.payment_allocations add column if not exists company_id uuid references public.companies(id);
alter table public.products add column if not exists company_id uuid references public.companies(id);
alter table public.products add column if not exists size_grade text;
alter table public.products add column if not exists unit text;
alter table public.shipment_timeline_events add column if not exists company_id uuid references public.companies(id);

-- 2. Global keys that 20260910140000 expects to exist before replacing them with
--    company-scoped identifiers. Suppressed once the replacement is in place, so
--    a clean rebuild never regains global uniqueness.
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.products'::regclass and conname='products_company_code_key')
     and not exists (select 1 from pg_constraint where conrelid='public.products'::regclass and conname='products_code_key') then
    alter table public.products add constraint products_code_key unique (code);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.business_cases'::regclass and conname='business_cases_company_number_key')
     and not exists (select 1 from pg_constraint where conrelid='public.business_cases'::regclass and conname='business_cases_number_key') then
    alter table public.business_cases add constraint business_cases_number_key unique (number);
  end if;
end $$;

-- 3. Production-only legacy objects that reject canonical writes.
--    business_cases_case_number_key: production holds it as a UNIQUE CONSTRAINT;
--    canonical uses a partial unique INDEX of the same name, which a later
--    migration drops. A constraint-backed index cannot be dropped as an index.
alter table public.business_cases drop constraint if exists business_cases_case_number_key;
--    Legacy lowercase vocabularies. Canonical declares these columns as plain
--    text with no CHECK and validates values in the application layer.
alter table public.counterparties drop constraint if exists counterparties_counterparty_type_check;
alter table public.business_cases drop constraint if exists business_cases_status_check;
alter table public.payments drop constraint if exists payments_status_check;
--    Legacy GLOBAL unique on products.sku. Canonical scopes SKU uniqueness per
--    company, so two companies must be able to hold the same SKU.
alter table public.products drop constraint if exists products_sku_key;

-- 4. Canonical nullability. The canonical RPCs pass explicit NULLs, which bypass
--    column defaults, so production NOT NULLs reject legitimate writes.
alter table public.business_cases alter column case_number drop not null;
alter table public.business_cases alter column case_type drop not null;
alter table public.business_cases alter column company_id drop not null;
alter table public.business_cases alter column contract_amount drop not null;
alter table public.business_cases alter column created_at drop not null;
alter table public.business_cases alter column currency drop not null;
alter table public.business_cases alter column status drop not null;
alter table public.business_cases alter column updated_at drop not null;
alter table public.contracts alter column created_at drop not null;
alter table public.contracts alter column status drop not null;
alter table public.contracts alter column updated_at drop not null;
alter table public.counterparties alter column counterparty_type drop not null;
alter table public.counterparties alter column created_at drop not null;
alter table public.counterparties alter column updated_at drop not null;
alter table public.documents alter column document_type drop not null;
alter table public.documents alter column storage_path drop not null;
alter table public.documents alter column title drop not null;
alter table public.documents alter column uploaded_at drop not null;
alter table public.documents alter column version_no drop not null;
alter table public.payments alter column amount drop not null;
alter table public.payments alter column business_case_id drop not null;
alter table public.payments alter column created_at drop not null;
alter table public.payments alter column currency drop not null;
alter table public.payments alter column payment_date drop not null;
alter table public.payments alter column status drop not null;
alter table public.products alter column created_at drop not null;
alter table public.products alter column updated_at drop not null;
alter table public.timeline_events alter column created_at drop not null;
alter table public.timeline_events alter column event_type drop not null;

-- 5. Legacy column that does not exist in canonical at all. Canonical never
--    populates it, so its NOT NULL silently discarded every audit write.
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='timeline_events' and column_name='event_title') then
    alter table public.timeline_events alter column event_title drop not null;
  end if;
end $$;

-- Canonical RLS and authenticated/company-scoped document Storage security are
-- delivered by 20260908120000, 20260909120000 and 20260909150000, which are part
-- of the forward set. They are deliberately not duplicated here.
notify pgrst,'reload schema';
