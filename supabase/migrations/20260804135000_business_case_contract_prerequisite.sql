-- platform_integration (20260804190000) reads this column during its backfill.
-- canonical_deal_engine later reasserts it. A forward migration cannot repair an
-- earlier replay failure, so the missing prerequisite must precede its consumer.
alter table public.business_cases add column if not exists contract_number text;
