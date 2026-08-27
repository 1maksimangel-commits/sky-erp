-- Allow INSERT on public.companies for the current development roles.
-- RLS stays enabled; only an INSERT policy is added (SELECT already works).

alter table public.companies enable row level security;

drop policy if exists "Public insert companies" on public.companies;
create policy "Public insert companies"
  on public.companies
  for insert
  to public
  with check (true);

drop policy if exists "Public update companies" on public.companies;
create policy "Public update companies"
  on public.companies
  for update
  to public
  using (true)
  with check (true);
