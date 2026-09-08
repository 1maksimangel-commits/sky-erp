alter table public.counterparties
  add column if not exists source_company_id uuid references public.companies(id) on delete set null;

create unique index if not exists counterparties_source_company_unique
  on public.counterparties(source_company_id)
  where source_company_id is not null;
