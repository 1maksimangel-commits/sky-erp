-- Metadata only: suitable for CI artifacts. Never includes identities or keys.
select jsonb_build_object(
  'tables', (select jsonb_agg(jsonb_build_object(
    'table',c.relname,'rls_enabled',c.relrowsecurity,
    'ownership',case when c.relname='companies' then 'id'
      when c.relname in ('company_memberships','user_profiles') then 'user_id; global Admin writes'
      when c.relname='exchange_rates' then 'shared reference; Finance or global Admin writes'
      when exists(select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='company_id') then 'company_id; NULL is Admin-only'
      else 'shared reference; provisioned users read, global Admin writes' end,
    'anon_grants',(select jsonb_agg(op) from unnest(array['SELECT','INSERT','UPDATE','DELETE']) op where has_table_privilege('anon',c.oid,op)),
    'authenticated_grants',(select jsonb_agg(op) from unnest(array['SELECT','INSERT','UPDATE','DELETE']) op where has_table_privilege('authenticated',c.oid,op)),
    'policies',(select jsonb_agg(jsonb_build_object('name',p.policyname,'operation',p.cmd,'roles',p.roles,'using',p.qual,'check',p.with_check) order by p.policyname)
      from pg_policies p where p.schemaname='public' and p.tablename=c.relname)
  ) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')),
  'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'security_definer',p.prosecdef,
    'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE')) order by p.proname)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','erp_private')
      and not exists(select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')),
  'storage_policies',(select jsonb_agg(jsonb_build_object('name',policyname,'operation',cmd,'roles',roles,'using',qual,'check',with_check) order by policyname)
    from pg_policies where schemaname='storage' and tablename='objects')
);
