-- Optional business role classification for legal entities.
-- Additive only; existing company records remain valid.
alter table public.companies
  add column if not exists business_role text;

alter table public.companies
  drop constraint if exists companies_business_role_check;

alter table public.companies
  add constraint companies_business_role_check
  check (business_role is null or business_role in ('Seller', 'Buyer', 'Agent', 'Other'));

create index if not exists companies_business_role_idx
  on public.companies (business_role);
