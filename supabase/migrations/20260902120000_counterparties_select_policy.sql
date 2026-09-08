alter table public.counterparties enable row level security;

drop policy if exists "Public select counterparties" on public.counterparties;
create policy "Public select counterparties"
  on public.counterparties
  for select
  to public
  using (true);
