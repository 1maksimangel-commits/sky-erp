-- =============================================================================
-- P0: Add payments.business_case_id (additive schema fix)
-- =============================================================================
-- Problem:
--   public.finance_register_payment (20260804180000_finance_module.sql) INSERTs
--   into payments (..., business_case_id, ...) using v_invoice.business_case_id,
--   but the payments ALTER block in that migration never added the column.
--
-- Relationship:
--   Optional link from a payment to the commercial Business Case that the
--   related invoice belongs to (copied from invoices.business_case_id at
--   payment registration time). Nullable so existing payment rows stay valid.
--
-- Safety:
--   - Additive only (no DROP / no data rewrite)
--   - IF NOT EXISTS / guarded constraint creation for re-run safety
--   - Do not apply remotely without explicit approval
-- =============================================================================

-- Nullable FK: payment may optionally reference a business case.
alter table public.payments
  add column if not exists business_case_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payments_business_case_id_fkey'
  ) then
    alter table public.payments
      add constraint payments_business_case_id_fkey
      foreign key (business_case_id)
      references public.business_cases (id)
      on delete set null;
  end if;
end $$;

create index if not exists payments_business_case_id_idx
  on public.payments (business_case_id);

comment on column public.payments.business_case_id is
  'Optional Business Case linked from the paid invoice (finance_register_payment). Nullable; ON DELETE SET NULL.';
