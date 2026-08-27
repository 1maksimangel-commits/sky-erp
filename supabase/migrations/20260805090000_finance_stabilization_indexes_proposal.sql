-- =============================================================================
-- Finance stabilization — additive indexes / uniqueness (PROPOSAL)
-- =============================================================================
-- Confirmed gaps vs application expectations:
--   1. invoice_number is not unique per company (duplicate numbers possible)
--   2. payments.company_id lacks a dedicated index (list/filter by company)
--
-- Safety:
--   - Additive only
--   - Unique index is PARTIAL and created CONCURRENTLY is not used here (DDL
--     in migration transaction); use IF NOT EXISTS
--   - Unique constraint skips NULL company_id rows
--   - Do NOT apply remotely without explicit approval
--   - Do NOT apply if duplicate (company_id, invoice_number) rows already exist
-- =============================================================================

-- Fast company-scoped payment lists
create index if not exists payments_company_id_idx
  on public.payments (company_id);

create index if not exists invoices_company_id_idx
  on public.invoices (company_id);

-- Prevent duplicate invoice numbers within the same company (when company set)
do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'invoices_company_invoice_number_uidx'
  ) then
    -- Fail loud if duplicates exist so operators can clean data first.
    if exists (
      select 1
      from public.invoices
      where company_id is not null
      group by company_id, invoice_number
      having count(*) > 1
    ) then
      raise notice
        'SKIP invoices_company_invoice_number_uidx: duplicate (company_id, invoice_number) rows exist. Clean data before re-applying.';
    else
      create unique index invoices_company_invoice_number_uidx
        on public.invoices (company_id, invoice_number)
        where company_id is not null;
    end if;
  end if;
end $$;
