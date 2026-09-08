-- Allow PDF imports to preserve unknown monetary fields on incomplete Draft contracts.
-- Additive metadata change only: no rows are updated or deleted; RLS is unchanged.

alter table public.contracts
  alter column currency drop not null,
  alter column amount drop not null;

notify pgrst, 'reload schema';
