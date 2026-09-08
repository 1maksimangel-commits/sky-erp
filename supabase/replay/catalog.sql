-- Metadata only. Never includes users, credentials, tokens, or business rows.
select json_build_object(
  'columns', (select coalesce(json_agg(row_to_json(c) order by c.table_name, c.column_name), '[]') from (
    select table_name, column_name, udt_name as type, is_nullable = 'YES' as nullable,
      column_default as default_value
    from information_schema.columns where table_schema = 'public'
  ) c),
  'foreignKeys', (select coalesce(json_agg(row_to_json(f) order by f.name), '[]') from (
    select con.conname as name, source.relname as source, target.relname as target,
      array(select a.attname from unnest(con.conkey) with ordinality k(attnum, n)
        join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum order by k.n) as columns,
      array(select a.attname from unnest(con.confkey) with ordinality k(attnum, n)
        join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum order by k.n) as target_columns,
      con.convalidated as validated
    from pg_constraint con
    join pg_class source on source.oid = con.conrelid
    join pg_namespace ns on ns.oid = source.relnamespace
    join pg_class target on target.oid = con.confrelid
    where con.contype = 'f' and ns.nspname = 'public'
  ) f),
  'functions', (select coalesce(json_agg(row_to_json(f) order by f.name), '[]') from (
    select p.proname as name,
      coalesce(p.proargnames[1:p.pronargs], array[]::text[]) as args,
      p.pronargs - p.pronargdefaults as required,
      pg_get_function_identity_arguments(p.oid) as signature
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.prokind = 'f'
  ) f),
  'buckets', (select coalesce(json_agg(id order by id), '[]') from storage.buckets),
  'migrations', (select coalesce(json_agg(version order by version), '[]') from supabase_migrations.schema_migrations),
  'rls', (select coalesce(json_agg(row_to_json(t) order by t.name), '[]') from (
    select c.relname as name, c.relrowsecurity as enabled
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  ) t)
);
