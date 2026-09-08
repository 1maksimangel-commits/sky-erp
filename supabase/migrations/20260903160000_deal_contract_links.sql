alter table public.contracts
  add column if not exists deal_id uuid references public.business_cases(id) on delete set null,
  add column if not exists business_role text;
alter table public.contract_products
  add column if not exists deal_product_id uuid references public.deal_products(id) on delete set null;
alter table public.contracts
  drop constraint if exists contracts_business_role_check;
alter table public.contracts
  add constraint contracts_business_role_check check (business_role is null or business_role in ('Purchase','Sale','Commission','Logistics','Other'));
create index if not exists contracts_deal_id_idx on public.contracts(deal_id);
create index if not exists contract_products_deal_product_id_idx on public.contract_products(deal_product_id);
