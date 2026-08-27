-- Superseded by 20260804160000_shipments_logistics_columns.sql
-- Kept for migration history continuity. Safe no-op if 160000 already applied.

alter table public.shipments
  add column if not exists voyage text;

alter table public.shipments
  add column if not exists business_case_id uuid references public.business_cases (id) on delete set null;
