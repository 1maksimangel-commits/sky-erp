-- Preserve contract history and related business records while allowing users
-- to remove contracts from active SKY ERP workflows.

alter table public.contracts
  add column if not exists deleted_at timestamptz;

create index if not exists contracts_active_idx
  on public.contracts (contract_date desc, contract_number desc)
  where deleted_at is null;

notify pgrst, 'reload schema';
