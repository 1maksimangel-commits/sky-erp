-- Narrow soft-delete entry point for the current pre-auth SKY ERP runtime.
-- This does not permit arbitrary UPDATE or physical DELETE operations.

create or replace function public.soft_delete_contract(target_id uuid)
returns table (
  id uuid,
  contract_number text,
  status text,
  deleted_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.contracts as contract
  set
    deleted_at = now(),
    updated_at = now()
  where contract.id = target_id
    and contract.deleted_at is null
  returning
    contract.id,
    contract.contract_number,
    contract.status,
    contract.deleted_at;
$$;

revoke all on function public.soft_delete_contract(uuid) from public;
grant execute on function public.soft_delete_contract(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
