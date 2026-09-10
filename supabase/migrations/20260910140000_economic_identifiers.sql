-- Phase 7 prerequisites only: business labels belong to their owning workspace.
-- UUIDs and Company codes remain global; historical rows are not renumbered.
alter table public.contracts drop constraint contracts_contract_number_key;
alter table public.contracts add constraint contracts_company_number_key unique(company_id,contract_number);
alter table public.counterparties drop constraint counterparties_code_key;
alter table public.counterparties add constraint counterparties_company_code_key unique(company_id,code);
alter table public.products drop constraint products_code_key;
alter table public.products add constraint products_company_code_key unique(company_id,code);
alter table public.business_cases drop constraint business_cases_number_key;
drop index public.business_cases_case_number_key;
alter table public.business_cases add constraint business_cases_company_number_key unique(company_id,number);
-- Quarantined legacy records retain their original uniqueness too. Partial
-- indexes permit multiple absent optional codes, as the old keys did.
create unique index contracts_unassigned_number_key on public.contracts(contract_number) where company_id is null;
create unique index counterparties_unassigned_code_key on public.counterparties(code) where company_id is null;
create unique index products_unassigned_code_key on public.products(code) where company_id is null;
create unique index business_cases_unassigned_number_key on public.business_cases(number) where company_id is null;
-- Existing synchronization/conflict triggers keep case_number equal to number.
comment on column public.business_cases.case_number is 'Canonical Deal display number, unique within company_id. number is a synchronized compatibility alias.';
comment on column public.contracts.deal_id is 'Canonical Deal FK for reviewed Contracts; business_case_id is a synchronized compatibility alias.';
comment on column public.companies.business_role is 'Legacy descriptive metadata only. Never determines legal Contract or financial direction; use explicit transaction parties.';
notify pgrst,'reload schema';
