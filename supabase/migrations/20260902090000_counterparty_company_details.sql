alter table public.counterparties
  add column if not exists authorized_signer_name text,
  add column if not exists authorized_signer_title text,
  add column if not exists bank_account_name text,
  add column if not exists bank_name text,
  add column if not exists bank_address text,
  add column if not exists account_number text,
  add column if not exists iban text,
  add column if not exists swift text,
  add column if not exists bank_currency text default 'USD';
