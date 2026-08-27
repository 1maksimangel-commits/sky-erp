-- =============================================================================
-- Logistics P0 — ownership + BL / parties columns (additive)
-- =============================================================================
-- Confirmed gaps:
--   - shipments.company_id missing (ownership only via contract join)
--   - no bl_number / consignee / notify_party columns
--   - no uniqueness guard for BL numbers
--
-- Safety:
--   - Additive only (no DROP / no data rewrite)
--   - IF NOT EXISTS / guarded constraints
--   - Do NOT apply remotely without explicit approval
-- =============================================================================

alter table public.shipments
  add column if not exists company_id uuid;

alter table public.shipments
  add column if not exists bl_number text;

alter table public.shipments
  add column if not exists consignee text;

alter table public.shipments
  add column if not exists notify_party text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shipments_company_id_fkey'
  ) then
    alter table public.shipments
      add constraint shipments_company_id_fkey
      foreign key (company_id)
      references public.companies (id)
      on delete restrict;
  end if;
end $$;

-- Backfill company_id from contracts where possible (non-destructive)
update public.shipments s
set company_id = c.company_id
from public.contracts c
where s.contract_id = c.id
  and s.company_id is null
  and c.company_id is not null;

-- Backfill business_case_id from contracts where possible
update public.shipments s
set business_case_id = c.business_case_id
from public.contracts c
where s.contract_id = c.id
  and s.business_case_id is null
  and c.business_case_id is not null;

create index if not exists shipments_company_id_idx
  on public.shipments (company_id);

create index if not exists shipments_bl_number_idx
  on public.shipments (bl_number);

create index if not exists shipments_booking_number_idx
  on public.shipments (booking_number);

-- Unique BL when present
do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'shipments_bl_number_uidx'
  ) then
    if exists (
      select 1
      from public.shipments
      where bl_number is not null and btrim(bl_number) <> ''
      group by bl_number
      having count(*) > 1
    ) then
      raise notice
        'SKIP shipments_bl_number_uidx: duplicate bl_number values exist. Clean data before re-applying.';
    else
      create unique index shipments_bl_number_uidx
        on public.shipments (bl_number)
        where bl_number is not null and btrim(bl_number) <> '';
    end if;
  end if;
end $$;

comment on column public.shipments.company_id is
  'Owning company; required by application. Backfilled from contracts.';
comment on column public.shipments.bl_number is
  'Bill of Lading number; unique when present.';
comment on column public.shipments.consignee is
  'Consignee party for the shipment.';
comment on column public.shipments.notify_party is
  'Notify party for the shipment.';

notify pgrst, 'reload schema';
