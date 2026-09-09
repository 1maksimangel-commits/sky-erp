-- Phase 5: retain uploaded originals and every generated version. No legacy
-- ownership, numbers or snapshots are guessed. Rollback is forward-only: leave
-- retained files/records in place and deploy an application compatibility fix.
alter table public.document_templates
  add column original_hash text check(original_hash is null or original_hash ~ '^[a-f0-9]{64}$'),
  add column original_filename text,
  add column original_mime_type text,
  add column configured_storage_path text,
  add column configured_hash text check(configured_hash is null or configured_hash ~ '^[a-f0-9]{64}$'),
  add column family_id uuid references public.document_templates(id) on delete restrict;
alter table public.template_mappings add column required boolean not null default false;
alter table public.document_templates add constraint configured_template_checksum_pair
  check((configured_storage_path is null)=(configured_hash is null));
-- Preserve every existing category while permitting the documented extension
-- categories; this expands validation and does not rewrite existing records.
alter table public.document_templates drop constraint document_templates_document_type_check;
alter table public.document_templates add constraint document_templates_document_type_check
  check(document_type in ('contract','supplement','annex','invoice','packing_list','certificate','bl','commission_invoice','acceptance_transfer_act','specification','proforma_invoice','other'));
alter table public.generated_documents
  add column output_hash text check(output_hash is null or output_hash ~ '^[a-f0-9]{64}$'),
  add column document_series_id uuid references public.generated_documents(id) on delete restrict;
create unique index document_template_family_version on public.document_templates(family_id,version) where family_id is not null;
create unique index generated_document_series_version on public.generated_documents(document_series_id,version) where document_series_id is not null;
create unique index generated_document_number_root on public.generated_documents(company_id,document_type,document_number)
  where document_series_id=id and document_number is not null;

-- Only these three document tables need the global-template exception. Keep
-- Phase 2 ownership enforcement untouched for every other business table.
create function erp_private.document_ownership() returns trigger
language plpgsql security invoker set search_path='' as $$
declare owner_id uuid; source_company uuid; source_id uuid; source_exists boolean; item record; data jsonb:=to_jsonb(new); prior jsonb;
begin
  if tg_op='UPDATE' then prior=to_jsonb(old); end if;
  owner_id=(data->>'company_id')::uuid;
  if tg_table_name='template_mappings' then
    select company_id into source_company from public.document_templates where id=(data->>'template_id')::uuid;
    if not found then raise exception 'Template is unavailable' using errcode='42501'; end if;
    if owner_id is not null and owner_id is distinct from source_company then raise exception 'Template company mismatch' using errcode='42501'; end if;
    owner_id=source_company;
  elsif tg_table_name='generated_documents' and owner_id is null then
    -- Derive only from canonical business ownership, never from the selected
    -- template (which can intentionally be global or a legal party's template).
    if data->>'contract_id' is not null then
      select company_id into owner_id from public.contracts where id=(data->>'contract_id')::uuid;
    end if;
    if owner_id is null and coalesce(data->>'deal_id',data->>'business_case_id') is not null then
      select company_id into owner_id from public.business_cases where id=coalesce(data->>'deal_id',data->>'business_case_id')::uuid;
    end if;
    owner_id=coalesce(owner_id,public.active_company_id());
  end if;
  if auth.uid() is not null and not erp_private.has_permission(owner_id,'documents','write') then raise exception 'Document company access denied' using errcode='42501'; end if;
  if tg_op='UPDATE' and owner_id is distinct from (prior->>'company_id')::uuid then raise exception 'Document ownership is immutable' using errcode='42501'; end if;
  for item in select a.attname as field, t.relname as target from pg_catalog.pg_constraint c
    join pg_catalog.pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
    join pg_catalog.pg_class t on t.oid=c.confrelid
    join pg_catalog.pg_namespace n on n.oid=t.relnamespace
    where c.conrelid=tg_relid and c.contype='f' and array_length(c.conkey,1)=1 and n.nspname='public' and a.attname<>'company_id'
  loop
    source_id=(data->>item.field)::uuid;
    if source_id is null or (item.target=tg_table_name and source_id=(data->>'id')::uuid) then continue; end if;
    execute format('select true,company_id from public.%I where id=$1',item.target) into source_exists,source_company using source_id;
    if source_exists is not true then raise exception 'Related document source is unavailable' using errcode='42501'; end if;
    if source_company is distinct from owner_id and not (tg_table_name='generated_documents' and item.field='source_template_id' and (
      source_company is null or exists(select 1 from public.contract_parties
        where contract_id=(data->>'contract_id')::uuid and internal_company_id=source_company and role_code in ('seller','buyer'))
    )) then
      raise exception 'Cross-company document relationship rejected: %',item.field using errcode='42501';
    end if;
  end loop;
  for item in select value as field from unnest(array['storage_path','configured_storage_path','docx_storage_path','pdf_storage_path']) value loop
    if auth.uid() is not null and data->>item.field is not null and (tg_op='INSERT' or data->item.field is distinct from prior->item.field) then
      if owner_id is null then
        if not erp_private.is_admin() or split_part(data->>item.field,'/',1)<>'global' then raise exception 'Global template storage is Admin-only' using errcode='42501'; end if;
      elsif split_part(data->>item.field,'/',1)<>'companies' or split_part(data->>item.field,'/',2)<>owner_id::text then
        raise exception 'Document storage company mismatch' using errcode='42501';
      end if;
    end if;
  end loop;
  data=data||jsonb_build_object('company_id',owner_id);
  if tg_op='INSERT' then
    if data ? 'uploaded_by' then data=data||jsonb_build_object('uploaded_by',auth.uid()); end if;
    if data ? 'created_by' then data=data||jsonb_build_object('created_by',auth.uid()); end if;
  end if;
  new=jsonb_populate_record(new,data);
  return new;
end $$;
create or replace trigger enforce_company_ownership before insert or update on public.document_templates for each row execute function erp_private.document_ownership();
create or replace trigger enforce_company_ownership before insert or update on public.template_mappings for each row execute function erp_private.document_ownership();
create or replace trigger enforce_company_ownership before insert or update on public.generated_documents for each row execute function erp_private.document_ownership();
alter policy member_read on public.document_templates using(erp_private.has_permission(company_id,'documents','read') or (company_id is null and public.authorize_permission('companies.read')));
alter policy member_read on public.template_mappings using(erp_private.has_permission(company_id,'documents','read') or (company_id is null and exists(select 1 from public.document_templates t where t.id=template_id and t.company_id is null)));
create policy configured_template_read on storage.objects for select to authenticated using(
  bucket_id='documents' and exists(select 1 from public.document_templates where configured_storage_path=name)
);

-- Defaults are selected independently for each language. The advisory lock
-- serializes competing defaults without choosing a historical row in a backfill.
create or replace function public.set_document_template_default() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.is_default then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(coalesce(new.company_id::text,'global')||':'||new.document_type||':'||new.language,0));
    update public.document_templates set is_default=false,updated_at=now()
      where document_type=new.document_type and language=new.language
        and company_id is not distinct from new.company_id and id<>new.id and is_default;
  end if;
  new.updated_at=now(); return new;
end $$;

-- A shared template can be used by another workspace; retaining its version
-- cannot depend on whether the editor can read that workspace's documents.
create function erp_private.template_has_history(template uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.generated_documents where source_template_id=template);
$$;
revoke all on function erp_private.template_has_history(uuid) from public,anon;
grant execute on function erp_private.template_has_history(uuid) to authenticated;

create function erp_private.guard_template_history() returns trigger
language plpgsql security invoker set search_path='' as $$
declare parent public.document_templates;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('template-config:'||coalesce(new.id,old.id)::text,0));
  if tg_op='DELETE' then
    if old.original_hash is not null then raise exception 'Archive uploaded templates instead of deleting originals'; end if;
    return old;
  end if;
  if tg_op='INSERT' and auth.uid() is not null and new.storage_path is not null and new.original_hash is null then raise exception 'Uploaded templates require an original checksum'; end if;
  if tg_op='INSERT' and new.original_hash is not null then
    if new.storage_path is null or nullif(btrim(new.original_filename),'') is null then raise exception 'Original template metadata is required'; end if;
    if new.supersedes_id is null then new.family_id=new.id; new.version=1;
    else
      select * into parent from public.document_templates where id=new.supersedes_id for update;
      if not found or parent.company_id is distinct from new.company_id or parent.document_type<>new.document_type or parent.language<>new.language then raise exception 'Template version must preserve its company, type and language'; end if;
      new.family_id=coalesce(parent.family_id,parent.id); new.version=parent.version+1;
    end if;
  end if;
  if tg_op='UPDATE' and old.original_hash is not null then
    if (new.storage_path,new.original_hash,new.original_filename,new.original_mime_type,new.family_id,new.version,new.supersedes_id,new.company_id,new.document_type,new.language,new.uploaded_by,new.created_at)
      is distinct from (old.storage_path,old.original_hash,old.original_filename,old.original_mime_type,old.family_id,old.version,old.supersedes_id,old.company_id,old.document_type,old.language,old.uploaded_by,old.created_at) then raise exception 'Uploaded template original is immutable; upload a new version' using errcode='42501'; end if;
    if (new.configured_storage_path,new.configured_hash,new.variable_schema,new.template_content) is distinct from (old.configured_storage_path,old.configured_hash,old.variable_schema,old.template_content)
      and erp_private.template_has_history(old.id) then raise exception 'Used template configuration is locked; upload a new version' using errcode='42501'; end if;
  end if;
  return new;
end $$;
create trigger a_template_history before insert or update or delete on public.document_templates for each row execute function erp_private.guard_template_history();

create function erp_private.guard_used_template_mapping() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('template-config:'||coalesce(new.template_id,old.template_id)::text,0));
  if erp_private.template_has_history(coalesce(new.template_id,old.template_id)) then
    if tg_op<>'UPDATE' or (to_jsonb(new)-'updated_at') is distinct from (to_jsonb(old)-'updated_at') then raise exception 'Used template mapping is locked; upload a new version' using errcode='42501'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger a_used_template_mapping before insert or update or delete on public.template_mappings for each row execute function erp_private.guard_used_template_mapping();

create function erp_private.guard_generated_history() returns trigger
language plpgsql security invoker set search_path='' as $$
declare parent public.generated_documents; source public.document_templates; contract_deal uuid; current_mappings jsonb;
begin
  if tg_op='DELETE' then
    if old.output_hash is not null then raise exception 'Generated document versions must be retained'; end if;
    return old;
  end if;
  if tg_op='INSERT' and auth.uid() is not null and new.output_hash is null then raise exception 'Generated documents require an output checksum'; end if;
  if tg_op='INSERT' and new.output_hash is not null then
    if new.company_id is null and new.contract_id is not null then
      select company_id into new.company_id from public.contracts where id=new.contract_id;
    end if;
    if new.company_id is null and coalesce(new.deal_id,new.business_case_id) is not null then
      select company_id into new.company_id from public.business_cases where id=coalesce(new.deal_id,new.business_case_id);
    end if;
    new.company_id=coalesce(new.company_id,public.active_company_id());
    if new.status<>'Draft' then raise exception 'Generated documents begin as Draft'; end if;
    if new.company_id is null or new.docx_storage_path is null or new.source_template_id is null or new.snapshot_data='{}'::jsonb or new.snapshot_hash !~ '^[a-f0-9]{64}$' then raise exception 'Generated document source, snapshot and DOCX are required'; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('template-config:'||new.source_template_id::text,0));
    select * into source from public.document_templates where id=new.source_template_id;
    if not found or source.version is distinct from new.source_template_version or source.document_type<>new.document_type then raise exception 'Template version/type mismatch'; end if;
    if source.original_hash is not null then
      if new.snapshot_data->>'templateHash' is distinct from coalesce(source.configured_hash,source.original_hash) then
        raise exception 'Template configuration changed; review the current template before generating';
      end if;
      select coalesce(jsonb_object_agg(placeholder,sky_variable),'{}'::jsonb) into current_mappings
        from public.template_mappings where template_id=source.id and nullif(sky_variable,'') is not null;
      if new.snapshot_data->'mappings' is distinct from current_mappings then
        raise exception 'Template mapping changed; review the current template before generating';
      end if;
    end if;
    if new.deal_id is not null and new.business_case_id is not null and new.deal_id<>new.business_case_id then raise exception 'Deal references disagree'; end if;
    new.deal_id=coalesce(new.deal_id,new.business_case_id); new.business_case_id=new.deal_id;
    if new.contract_id is not null then
      select coalesce(deal_id,business_case_id) into contract_deal from public.contracts where id=new.contract_id;
      if new.deal_id is distinct from contract_deal then raise exception 'Contract and Deal references disagree'; end if;
    end if;
    if new.supersedes_id is null then
      new.document_series_id=new.id; new.version=1;
      new.document_number=coalesce(nullif(btrim(new.document_number),''),upper(case new.document_type when 'invoice' then 'INV' when 'supplement' then 'SUP' else 'DOC' end)||'-'||new.id::text);
    else
      select * into parent from public.generated_documents where id=new.supersedes_id for update;
      if not found or parent.company_id is distinct from new.company_id or parent.document_type<>new.document_type or parent.contract_id is distinct from new.contract_id or parent.deal_id is distinct from new.deal_id then raise exception 'Document revision must preserve its source and company'; end if;
      new.document_series_id=coalesce(parent.document_series_id,parent.id); new.version=parent.version+1; new.document_number=parent.document_number;
    end if;
    new.created_by=auth.uid(); new.created_at=now(); new.finalized_at=null; new.issued_at=null;
  end if;
  if tg_op='UPDATE' and old.output_hash is not null then
    if (to_jsonb(new)-array['status','finalized_at','issued_at']) is distinct from (to_jsonb(old)-array['status','finalized_at','issued_at']) then raise exception 'Generated snapshot and output are immutable; generate a new version' using errcode='42501'; end if;
    if new.status<>old.status and not ((old.status='Draft' and new.status='Final') or (old.status='Final' and new.status='Issued')) then raise exception 'Document lifecycle is Draft, Final, then Issued'; end if;
    new.finalized_at=case when old.status='Draft' and new.status='Final' then now() else old.finalized_at end;
    new.issued_at=case when old.status='Final' and new.status='Issued' then now() else old.issued_at end;
  end if;
  return new;
end $$;
create trigger a_generated_history before insert or update or delete on public.generated_documents for each row execute function erp_private.guard_generated_history();

create function erp_private.document_file_retained(object_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.document_templates where (storage_path=object_name or configured_storage_path=object_name) and original_hash is not null)
    or exists(select 1 from public.generated_documents where (docx_storage_path=object_name or pdf_storage_path=object_name or storage_path=object_name) and output_hash is not null);
$$;
revoke all on function erp_private.document_file_retained(text) from public,anon;
grant execute on function erp_private.document_file_retained(text) to authenticated;
create policy document_original_no_overwrite on storage.objects as restrictive for update to authenticated
  using(not(bucket_id='documents' and erp_private.document_file_retained(name))) with check(not(bucket_id='documents' and erp_private.document_file_retained(name)));
create policy document_original_no_delete on storage.objects as restrictive for delete to authenticated
  using(not(bucket_id='documents' and erp_private.document_file_retained(name)));
notify pgrst, 'reload schema';
