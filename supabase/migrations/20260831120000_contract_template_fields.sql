-- Structured commercial fields used by Contract / Annex / Commercial Invoice templates.
-- Additive only: existing contracts and product lines remain unchanged.

alter table public.contracts
  add column if not exists consignee_id uuid references public.counterparties (id) on delete set null,
  add column if not exists payment_terms text,
  add column if not exists loading_port text,
  add column if not exists destination_port text,
  add column if not exists delivery_place text,
  add column if not exists expected_shipment_date date;

-- Controlled company representative used by generated document templates.
-- Bank details remain normalized in the existing public.bank_accounts table.
alter table public.companies
  add column if not exists address text,
  add column if not exists authorized_signer_name text,
  add column if not exists authorized_signer_title text;

create index if not exists contracts_consignee_id_idx
  on public.contracts (consignee_id);

alter table public.contract_products
  add column if not exists description text,
  add column if not exists size_grade text,
  add column if not exists unit text,
  add column if not exists unit_price numeric,
  add column if not exists currency text,
  add column if not exists net_weight numeric,
  add column if not exists gross_weight numeric;

alter table public.contract_products
  drop constraint if exists contract_products_unit_price_nonnegative,
  add constraint contract_products_unit_price_nonnegative
    check (unit_price is null or unit_price >= 0),
  drop constraint if exists contract_products_net_weight_nonnegative,
  add constraint contract_products_net_weight_nonnegative
    check (net_weight is null or net_weight >= 0),
  drop constraint if exists contract_products_gross_weight_nonnegative,
  add constraint contract_products_gross_weight_nonnegative
    check (gross_weight is null or gross_weight >= 0);

notify pgrst, 'reload schema';
