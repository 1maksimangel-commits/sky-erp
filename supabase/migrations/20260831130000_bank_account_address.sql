-- Postal/registered address of the bank for generated commercial documents.
-- Additive only; existing bank accounts remain unchanged.

alter table public.bank_accounts
  add column if not exists bank_address text;

notify pgrst, 'reload schema';
