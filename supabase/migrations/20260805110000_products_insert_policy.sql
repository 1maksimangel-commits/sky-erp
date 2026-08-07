-- Allow INSERT on public.products for the current SKY ERP client role.
-- Context (2026-08-06):
--   - App uses the publishable key (PostgREST role: anon / public) without login middleware.
--   - auth.uid() / company_memberships are NOT live (see 20260805070000 proposal).
--   - products has no company_id decision yet — company-scoped INSERT cannot be invented safely.
--   - Precedent: 20260805010000_companies_insert_policy.sql
--
-- Scope: INSERT policy only. Does not alter SELECT / UPDATE / DELETE policies.
-- RLS stays enabled. No service_role. No schema/column changes. No other tables.

alter table public.products enable row level security;

drop policy if exists "Public insert products" on public.products;
create policy "Public insert products"
  on public.products
  for insert
  to public
  with check (true);
