-- =============================================================================
-- PROPOSAL ONLY — Contract import processing TTL / stuck-row recovery
-- =============================================================================
-- STATUS: Documentation migration. No schema changes executed.
-- DO NOT apply as a "fix" until approved.
--
-- Problem (confirmed in audits):
--   contract_imports rows can remain status='processing' if the Node process
--   dies mid-extraction (K-13). Application routes now mark failed on abort /
--   interrupt, but a DB-side sweeper is still useful for orphaned rows.
--
-- Proposed follow-up (copy into a NEW executable migration when approved):
--
--   -- Optional helper to fail stale processing imports (> 30 minutes)
--   create or replace function public.fail_stale_contract_imports(p_max_age interval default interval '30 minutes')
--   returns integer
--   language plpgsql
--   as $$
--   declare
--     n integer;
--   begin
--     update public.contract_imports
--     set status = 'failed',
--         error_message = coalesce(error_message, 'Marked failed: processing exceeded time limit.')
--     where status = 'processing'
--       and updated_at < now() - p_max_age;
--     get diagnostics n = row_count;
--     return n;
--   end;
--   $$;
--
--   -- Do NOT grant execute to anon. Call only from a scheduled job / service role
--   -- after authentication hardening is in place.
--
-- Related report: docs/audits/CONTRACT_HUB_STABILIZATION_2026-08-05.md
-- =============================================================================

do $$
begin
  raise notice
    'CONTRACT IMPORT TTL PROPOSAL: no changes applied. See comments in 20260805080000_contract_import_processing_ttl_proposal.sql';
end $$;
