-- Counterparty master data is edited through the ERP actions.
-- Keep RLS enabled and scope this migration to the missing write policies only.
alter table public.counterparties enable row level security;

drop policy if exists "Public insert counterparties" on public.counterparties;
create policy "Public insert counterparties"
  on public.counterparties
  for insert
  to public
  with check (true);

drop policy if exists "Public update counterparties" on public.counterparties;
create policy "Public update counterparties"
  on public.counterparties
  for update
  to public
  using (true)
  with check (true);
