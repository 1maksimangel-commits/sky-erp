-- Phase 8 release qualification. A fresh SKY ERP must be fully reproducible from
-- canonical migrations alone: structure, integrity, access control and indexes.
begin;
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Release readiness: %', message; end if; end $$;

-- Every business table is addressable and protected.
do $$ declare t record; begin
  for t in select c.oid, c.relname, c.relrowsecurity from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p') loop
    perform pg_temp.assert_true(
      exists(select 1 from pg_constraint where conrelid = t.oid and contype = 'p'),
      'Table without a primary key: ' || t.relname);
    perform pg_temp.assert_true(t.relrowsecurity, 'Table without RLS: ' || t.relname);
    perform pg_temp.assert_true(
      exists(select 1 from pg_policies where schemaname = 'public' and tablename = t.relname),
      'RLS enabled with zero policies: ' || t.relname);
  end loop;
end $$;

-- Referential integrity survives a clean rebuild, and no foreign key may dangle.
do $$ declare missing int; begin
  select count(*) into missing from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and con.contype = 'f' and not con.convalidated;
  perform pg_temp.assert_true(missing = 0, missing || ' unvalidated foreign keys');
  perform pg_temp.assert_true(
    (select count(*) from pg_constraint con join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and con.contype = 'f') > 50,
    'Foreign key graph did not reconstruct');
end $$;

-- Company scoping and the canonical economics chain must be index-supported.
do $$ declare t text; begin
  foreach t in array array['contracts','invoices','payments','expenses','stock_movements',
    'cost_allocations','financial_reporting_snapshots','sale_realizations',
    'intercompany_inventory_links','deal_commission_links','payment_allocations'] loop
    perform pg_temp.assert_true(
      exists(select 1 from pg_index i join pg_class c on c.oid = i.indrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = t),
      'Economics table without any index: ' || t);
  end loop;
  -- Lineage lookups are the hot path of consolidation.
  perform pg_temp.assert_true(
    exists(select 1 from pg_indexes where schemaname='public' and tablename='sale_realizations' and indexdef like '%stock_movement_id%'),
    'sale_realizations.stock_movement_id is not indexed');
  perform pg_temp.assert_true(
    exists(select 1 from pg_indexes where schemaname='public' and tablename='intercompany_inventory_links' and indexdef like '%seller_realization_id%'),
    'intercompany_inventory_links.seller_realization_id is not indexed');
  perform pg_temp.assert_true(
    exists(select 1 from pg_indexes where schemaname='public' and tablename='payment_allocations' and indexdef like '%commission_id%'),
    'payment_allocations.commission_id is not indexed');
end $$;

-- Private document Storage is reconstructed with its own policies, never public.
do $$ begin
  perform pg_temp.assert_true(exists(select 1 from storage.buckets where id = 'documents'), 'documents bucket missing');
  perform pg_temp.assert_true((select not public from storage.buckets where id = 'documents'), 'documents bucket must stay private');
  perform pg_temp.assert_true(
    (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects') > 0,
    'Storage object policies missing');
  -- Table-level storage grants are a Supabase platform default; the application's
  -- hardening is that every reconstructed object policy is authenticated-only.
  perform pg_temp.assert_true(
    (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='storage' and c.relname='objects'),
    'Storage objects RLS disabled');
  perform pg_temp.assert_true(
    not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'
      and ('anon' = any(roles) or 'public' = any(roles))),
    'Storage policy reachable by anonymous or public role: ' ||
      coalesce((select string_agg(policyname, ', ') from pg_policies where schemaname='storage' and tablename='objects'
        and ('anon' = any(roles) or 'public' = any(roles))), ''));
end $$;

-- The canonical profitability surface exists and stays server-side.
do $$ declare f text; begin
  foreach f in array array['profitability_inputs','profitability_inventory_inputs','profitability_commission_inputs',
    'profitability_save_commission','profitability_preview_commission','profitability_realize_sale','profitability_link_receipt',
    'economics_capture_reporting_input','economics_allocate_cost'] loop
    perform pg_temp.assert_true(
      exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = f),
      'Canonical RPC missing after rebuild: ' || f);
    perform pg_temp.assert_true(
      not exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = f and has_function_privilege('anon', p.oid, 'EXECUTE')),
      'Anonymous execute on: ' || f);
  end loop;
end $$;
rollback;
