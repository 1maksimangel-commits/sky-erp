-- Allow the Counterparties management screen to remove a counterparty row.
-- The linked Company is preserved because source_company_id is not cascaded.
alter table public.counterparties enable row level security;

drop policy if exists "Public delete counterparties" on public.counterparties;
create policy "Public delete counterparties"
  on public.counterparties
  for delete
  to public
  using (true);
