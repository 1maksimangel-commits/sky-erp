-- =============================================================================
-- P0 PROPOSAL ONLY — RLS / anon access hardening
-- =============================================================================
-- STATUS: DOCUMENTATION + NO-OP. Requires EXPLICIT APPROVAL before any live
-- privilege changes. This file must NOT be treated as an applied hardening.
--
-- BLOCKER (missing authentication):
--   The Next.js app uses the Supabase publishable key via @supabase/ssr with
--   no middleware / session gate (getCurrentRole() stubs admin). Unauthenticated
--   PostgREST calls therefore run as role `anon`. Server Actions and RPCs
--   (finance_register_payment, warehouse_*, log_activity, add_timeline_event,
--   create_notification) currently depend on anon EXECUTE + open table policies.
--
--   Safe company-scoped RLS cannot be invented here without a real auth.uid()
--   membership model (user_profiles / company membership) that is not wired
--   in application code yet. Do not invent that model in this batch.
--
-- Confirmed issues in earlier migrations (do not edit those files):
--   - to public using (true) / with check (true) on hub, warehouse, finance,
--     platform, documents, CRM, contract_imports, etc.
--   - grant execute ... to anon on warehouse_*, finance_register_payment,
--     refresh_invoice_balances, log_activity, add_timeline_event,
--     create_notification
--   - storage.objects policies for bucket `documents` without ownership checks
--
-- Intended future changes (COMMENTED — do not enable until auth + RLS design
-- are approved and the app uses authenticated sessions):
--
--   -- revoke execute on function public.finance_register_payment(...) from anon;
--   -- revoke execute on function public.refresh_invoice_balances(uuid) from anon;
--   -- revoke execute on function public.warehouse_receive_stock(...) from anon;
--   -- revoke execute on function public.warehouse_issue_stock(...) from anon;
--   -- revoke execute on function public.warehouse_transfer_stock(...) from anon;
--   -- revoke execute on function public.warehouse_adjust_stock(...) from anon;
--   -- revoke execute on function public.log_activity(...) from anon;
--   -- revoke execute on function public.add_timeline_event(...) from anon;
--   -- revoke execute on function public.create_notification(...) from anon;
--   -- drop/replace Public * policies with authenticated + company-scoped checks
--   -- tighten storage.objects policies to authenticated owners / path ACLs
--
-- Why no revoke in this file:
--   Revoking anon EXECUTE or dropping using(true) policies today would break
--   the current application (publishable-key / anon path). That is not a
--   "clearly unnecessary" revoke under current constraints.
--
-- Report: docs/audits/P0_SECURITY_BATCH_01_2026-08-05.md
-- =============================================================================

do $$
begin
  raise notice
    'P0 RLS/anon hardening proposal: no grants or policies changed. Auth wiring required before applying real hardening. See docs/audits/P0_SECURITY_BATCH_01_2026-08-05.md';
end $$;
