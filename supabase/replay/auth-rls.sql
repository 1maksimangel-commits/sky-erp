-- Phase 2 functional gate. Fictional fixtures only; every change rolls back.
-- SET LOCAL ROLE is essential: these assertions never run with owner RLS bypass.
begin;
create function pg_temp.fixture_id(tag text, entity text) returns uuid language sql immutable
as $$ select md5('sky-auth-fixture-' || tag || '-' || entity)::uuid $$;
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Auth/RLS assertion: %', message; end if; end $$;
create temporary table private_tables(name text primary key);
insert into private_tables values ('counterparties'),('products'),('business_cases'),('contracts'),('shipments'),('invoices'),('payments'),('accounts'),('bank_accounts'),('bank_transactions'),('expenses'),('contract_products'),('contract_parties'),('shipment_timeline_events'),('warehouse_locations'),('inventory'),('inventory_lots'),('stock_movements'),('warehouse_transfers'),('inventory_reservations'),('invoice_items'),('payment_allocations'),('documents'),('document_versions'),('contract_imports'),('contract_import_field_reviews'),('crm_customers'),('crm_contacts'),('crm_notes'),('crm_communications'),('crm_tasks'),('crm_timeline_events'),('crm_attachments'),('deal_participants'),('deal_products'),('deal_commission_links'),('document_templates'),('generated_documents'),('template_mappings'),('document_generation_batches'),('notifications'),('timeline_events'),('activity_log');
grant select on private_tables to authenticated, anon;

-- Fail when a future table is added without a fixture and an explicit classification.
do $$ declare t record; op text; begin
  for t in select c.oid,c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') loop
    perform pg_temp.assert_true(t.relrowsecurity,'RLS disabled: ' || t.relname);
    perform pg_temp.assert_true(t.relname in ('companies','company_memberships','user_profiles','roles','currencies','exchange_rates','expense_categories')
      or exists(select 1 from private_tables where name=t.relname),'Unclassified table: ' || t.relname);
    foreach op in array array['SELECT','INSERT','UPDATE','DELETE'] loop
      perform pg_temp.assert_true(not has_table_privilege('anon',t.oid,op),'Anonymous grant: ' || t.relname || ' ' || op);
      perform pg_temp.assert_true(has_table_privilege('authenticated',t.oid,op),'Missing authenticated grant: ' || t.relname || ' ' || op);
    end loop;
    if exists(select 1 from private_tables where name=t.relname) then
      perform pg_temp.assert_true((select count(*)=4 from pg_policies where schemaname='public' and tablename=t.relname
        and roles=array['authenticated']::name[] and cmd in ('SELECT','INSERT','UPDATE','DELETE')),'Missing CRUD policies: ' || t.relname);
    end if;
  end loop;
  for t in select p.oid,p.proname,p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and not exists(select 1 from pg_depend d where d.objid=p.oid and d.deptype='e') loop
    perform pg_temp.assert_true(not has_function_privilege('anon',t.oid,'EXECUTE'),'Anonymous function: ' || t.proname);
    perform pg_temp.assert_true(not t.prosecdef or t.proname in ('authorize_permission','active_company_id','set_active_company','storage_company_for_entity'),
      'Unreviewed security-definer RPC: ' || t.proname);
  end loop;
end $$;

insert into auth.users(id,email,raw_user_meta_data)
select pg_temp.fixture_id(tag,'user'),'fictional-' || tag || '@example.invalid','{"role":"admin","role_code":"admin"}'::jsonb
from unnest(array['A','B','Admin','Read','Pending','Disabled']) tag;
select pg_temp.assert_true((select count(*)=6 from public.user_profiles where user_id in (
  select pg_temp.fixture_id(tag,'user') from unnest(array['A','B','Admin','Read','Pending','Disabled']) tag) and role_code='readonly'),
  'Signup metadata must not grant Admin');
update public.user_profiles set role_code='admin' where user_id=pg_temp.fixture_id('Admin','user');
insert into public.companies(id,code,name) values
  (pg_temp.fixture_id('A','companies'),'AUTH-A','Fictional Company A'),
  (pg_temp.fixture_id('B','companies'),'AUTH-B','Fictional Company B');
insert into public.company_memberships(user_id,company_id,role_code) values
  (pg_temp.fixture_id('A','user'),pg_temp.fixture_id('A','companies'),'admin'),
  (pg_temp.fixture_id('B','user'),pg_temp.fixture_id('B','companies'),'admin'),
  (pg_temp.fixture_id('Read','user'),pg_temp.fixture_id('A','companies'),'readonly'),
  (pg_temp.fixture_id('Disabled','user'),pg_temp.fixture_id('A','companies'),'admin');
update public.user_profiles set is_active=false where user_id=pg_temp.fixture_id('Disabled','user');
insert into public.notifications(id,title) values (pg_temp.fixture_id('Legacy','notifications'),'Fictional unassigned legacy row');
insert into auth.users(id,email)
select pg_temp.fixture_id(tag,'user'),'fictional-' || tag || '@example.invalid'
from unnest(array['sales','finance','warehouse','logistics','management']) tag;
insert into public.company_memberships(user_id,company_id,role_code)
select pg_temp.fixture_id(tag,'user'),pg_temp.fixture_id('A','companies'),tag
from unnest(array['sales','finance','warehouse','logistics','management']) tag;

create function pg_temp.seed_company(tag text, company uuid) returns void language plpgsql as $$
begin
  insert into public.counterparties(id,company_id,legal_name) values (pg_temp.fixture_id(tag,'counterparties'),company,'Fictional-' || tag || '-legal_name');
  update public.counterparties set id=id where id=pg_temp.fixture_id(tag,'counterparties');
  perform pg_temp.assert_true(found,'Own UPDATE counterparties');
  delete from public.counterparties where id=pg_temp.fixture_id(tag,'counterparties');
  perform pg_temp.assert_true(found,'Own DELETE counterparties');
  insert into public.counterparties(id,company_id,legal_name) values (pg_temp.fixture_id(tag,'counterparties'),company,'Fictional-' || tag || '-legal_name');
  insert into public.products(id,company_id,name) values (pg_temp.fixture_id(tag,'products'),company,'Fictional-' || tag || '-name');
  update public.products set id=id where id=pg_temp.fixture_id(tag,'products');
  perform pg_temp.assert_true(found,'Own UPDATE products');
  delete from public.products where id=pg_temp.fixture_id(tag,'products');
  perform pg_temp.assert_true(found,'Own DELETE products');
  insert into public.products(id,company_id,name) values (pg_temp.fixture_id(tag,'products'),company,'Fictional-' || tag || '-name');
  insert into public.business_cases(id,company_id,number) values (pg_temp.fixture_id(tag,'business_cases'),company,'Fictional-' || tag || '-number');
  update public.business_cases set id=id where id=pg_temp.fixture_id(tag,'business_cases');
  perform pg_temp.assert_true(found,'Own UPDATE business_cases');
  delete from public.business_cases where id=pg_temp.fixture_id(tag,'business_cases');
  perform pg_temp.assert_true(found,'Own DELETE business_cases');
  insert into public.business_cases(id,company_id,number) values (pg_temp.fixture_id(tag,'business_cases'),company,'Fictional-' || tag || '-number');
  insert into public.contracts(id,company_id,contract_number) values (pg_temp.fixture_id(tag,'contracts'),company,'Fictional-' || tag || '-contract_number');
  update public.contracts set id=id where id=pg_temp.fixture_id(tag,'contracts');
  perform pg_temp.assert_true(found,'Own UPDATE contracts');
  delete from public.contracts where id=pg_temp.fixture_id(tag,'contracts');
  perform pg_temp.assert_true(found,'Own DELETE contracts');
  insert into public.contracts(id,company_id,contract_number) values (pg_temp.fixture_id(tag,'contracts'),company,'Fictional-' || tag || '-contract_number');
  insert into public.contract_parties(id,company_id,contract_id,role_code,internal_company_id,snapshot)
  values(pg_temp.fixture_id(tag,'contract_parties'),company,pg_temp.fixture_id(tag,'contracts'),'consignee',company,'{"legal_name":"Fictional party"}');
  update public.contract_parties set id=id where id=pg_temp.fixture_id(tag,'contract_parties');
  perform pg_temp.assert_true(found,'Own UPDATE contract_parties');
  delete from public.contract_parties where id=pg_temp.fixture_id(tag,'contract_parties');
  perform pg_temp.assert_true(found,'Own DELETE contract_parties');
  insert into public.contract_parties(id,company_id,contract_id,role_code,internal_company_id,snapshot)
  values(pg_temp.fixture_id(tag,'contract_parties'),company,pg_temp.fixture_id(tag,'contracts'),'consignee',company,'{"legal_name":"Fictional party"}');
  insert into public.shipments(id,company_id,contract_id) values (pg_temp.fixture_id(tag,'shipments'),company,pg_temp.fixture_id(tag,'contracts'));
  update public.shipments set id=id where id=pg_temp.fixture_id(tag,'shipments');
  perform pg_temp.assert_true(found,'Own UPDATE shipments');
  delete from public.shipments where id=pg_temp.fixture_id(tag,'shipments');
  perform pg_temp.assert_true(found,'Own DELETE shipments');
  insert into public.shipments(id,company_id,contract_id) values (pg_temp.fixture_id(tag,'shipments'),company,pg_temp.fixture_id(tag,'contracts'));
  insert into public.invoices(id,company_id,contract_id,invoice_number,amount,outstanding) values (pg_temp.fixture_id(tag,'invoices'),company,pg_temp.fixture_id(tag,'contracts'),'Fictional-' || tag || '-invoice_number',100,100);
  update public.invoices set id=id where id=pg_temp.fixture_id(tag,'invoices');
  perform pg_temp.assert_true(found,'Own UPDATE invoices');
  delete from public.invoices where id=pg_temp.fixture_id(tag,'invoices');
  perform pg_temp.assert_true(found,'Own DELETE invoices');
  insert into public.invoices(id,company_id,contract_id,invoice_number,amount,outstanding) values (pg_temp.fixture_id(tag,'invoices'),company,pg_temp.fixture_id(tag,'contracts'),'Fictional-' || tag || '-invoice_number',100,100);
  insert into public.payments(id,company_id) values (pg_temp.fixture_id(tag,'payments'),company);
  update public.payments set id=id where id=pg_temp.fixture_id(tag,'payments');
  perform pg_temp.assert_true(found,'Own UPDATE payments');
  delete from public.payments where id=pg_temp.fixture_id(tag,'payments');
  perform pg_temp.assert_true(found,'Own DELETE payments');
  insert into public.payments(id,company_id) values (pg_temp.fixture_id(tag,'payments'),company);
  insert into public.accounts(id,company_id,account_type,code,name) values (pg_temp.fixture_id(tag,'accounts'),company,'Asset','Fictional-' || tag || '-code','Fictional-' || tag || '-name');
  update public.accounts set id=id where id=pg_temp.fixture_id(tag,'accounts');
  perform pg_temp.assert_true(found,'Own UPDATE accounts');
  delete from public.accounts where id=pg_temp.fixture_id(tag,'accounts');
  perform pg_temp.assert_true(found,'Own DELETE accounts');
  insert into public.accounts(id,company_id,account_type,code,name) values (pg_temp.fixture_id(tag,'accounts'),company,'Asset','Fictional-' || tag || '-code','Fictional-' || tag || '-name');
  insert into public.bank_accounts(id,company_id,name) values (pg_temp.fixture_id(tag,'bank_accounts'),company,'Fictional-' || tag || '-name');
  update public.bank_accounts set id=id where id=pg_temp.fixture_id(tag,'bank_accounts');
  perform pg_temp.assert_true(found,'Own UPDATE bank_accounts');
  delete from public.bank_accounts where id=pg_temp.fixture_id(tag,'bank_accounts');
  perform pg_temp.assert_true(found,'Own DELETE bank_accounts');
  insert into public.bank_accounts(id,company_id,name) values (pg_temp.fixture_id(tag,'bank_accounts'),company,'Fictional-' || tag || '-name');
  insert into public.bank_transactions(id,company_id,amount,bank_account_id,transaction_type) values (pg_temp.fixture_id(tag,'bank_transactions'),company,1,pg_temp.fixture_id(tag,'bank_accounts'),'credit');
  update public.bank_transactions set id=id where id=pg_temp.fixture_id(tag,'bank_transactions');
  perform pg_temp.assert_true(found,'Own UPDATE bank_transactions');
  delete from public.bank_transactions where id=pg_temp.fixture_id(tag,'bank_transactions');
  perform pg_temp.assert_true(found,'Own DELETE bank_transactions');
  insert into public.bank_transactions(id,company_id,amount,bank_account_id,transaction_type) values (pg_temp.fixture_id(tag,'bank_transactions'),company,1,pg_temp.fixture_id(tag,'bank_accounts'),'credit');
  insert into public.expenses(id,company_id,amount) values (pg_temp.fixture_id(tag,'expenses'),company,1);
  update public.expenses set id=id where id=pg_temp.fixture_id(tag,'expenses');
  perform pg_temp.assert_true(found,'Own UPDATE expenses');
  delete from public.expenses where id=pg_temp.fixture_id(tag,'expenses');
  perform pg_temp.assert_true(found,'Own DELETE expenses');
  insert into public.expenses(id,company_id,amount) values (pg_temp.fixture_id(tag,'expenses'),company,1);
  insert into public.contract_products(id,company_id,contract_id,product_id) values (pg_temp.fixture_id(tag,'contract_products'),company,pg_temp.fixture_id(tag,'contracts'),pg_temp.fixture_id(tag,'products'));
  update public.contract_products set id=id where id=pg_temp.fixture_id(tag,'contract_products');
  perform pg_temp.assert_true(found,'Own UPDATE contract_products');
  delete from public.contract_products where id=pg_temp.fixture_id(tag,'contract_products');
  perform pg_temp.assert_true(found,'Own DELETE contract_products');
  insert into public.contract_products(id,company_id,contract_id,product_id) values (pg_temp.fixture_id(tag,'contract_products'),company,pg_temp.fixture_id(tag,'contracts'),pg_temp.fixture_id(tag,'products'));
  insert into public.shipment_timeline_events(id,company_id,shipment_id,title) values (pg_temp.fixture_id(tag,'shipment_timeline_events'),company,pg_temp.fixture_id(tag,'shipments'),'Fictional-' || tag || '-title');
  update public.shipment_timeline_events set id=id where id=pg_temp.fixture_id(tag,'shipment_timeline_events');
  perform pg_temp.assert_true(found,'Own UPDATE shipment_timeline_events');
  delete from public.shipment_timeline_events where id=pg_temp.fixture_id(tag,'shipment_timeline_events');
  perform pg_temp.assert_true(found,'Own DELETE shipment_timeline_events');
  insert into public.shipment_timeline_events(id,company_id,shipment_id,title) values (pg_temp.fixture_id(tag,'shipment_timeline_events'),company,pg_temp.fixture_id(tag,'shipments'),'Fictional-' || tag || '-title');
  insert into public.warehouse_locations(id,company_id,code,name) values (pg_temp.fixture_id(tag,'warehouse_locations'),company,'Fictional-' || tag || '-code','Fictional-' || tag || '-name');
  update public.warehouse_locations set id=id where id=pg_temp.fixture_id(tag,'warehouse_locations');
  perform pg_temp.assert_true(found,'Own UPDATE warehouse_locations');
  delete from public.warehouse_locations where id=pg_temp.fixture_id(tag,'warehouse_locations');
  perform pg_temp.assert_true(found,'Own DELETE warehouse_locations');
  insert into public.warehouse_locations(id,company_id,code,name) values (pg_temp.fixture_id(tag,'warehouse_locations'),company,'Fictional-' || tag || '-code','Fictional-' || tag || '-name');
  insert into public.warehouse_locations(id,company_id,code,name) values (pg_temp.fixture_id(tag,'warehouse_other'),company,'Other-' || tag,'Fictional second warehouse');
  insert into public.inventory(id,company_id,product_id,warehouse_id) values (pg_temp.fixture_id(tag,'inventory'),company,pg_temp.fixture_id(tag,'products'),pg_temp.fixture_id(tag,'warehouse_locations'));
  update public.inventory set id=id where id=pg_temp.fixture_id(tag,'inventory');
  perform pg_temp.assert_true(found,'Own UPDATE inventory');
  delete from public.inventory where id=pg_temp.fixture_id(tag,'inventory');
  perform pg_temp.assert_true(found,'Own DELETE inventory');
  insert into public.inventory(id,company_id,product_id,warehouse_id) values (pg_temp.fixture_id(tag,'inventory'),company,pg_temp.fixture_id(tag,'products'),pg_temp.fixture_id(tag,'warehouse_locations'));
  insert into public.inventory_lots(id,company_id,inventory_id,lot_number) values (pg_temp.fixture_id(tag,'inventory_lots'),company,pg_temp.fixture_id(tag,'inventory'),'Fictional-' || tag || '-lot_number');
  update public.inventory_lots set id=id where id=pg_temp.fixture_id(tag,'inventory_lots');
  perform pg_temp.assert_true(found,'Own UPDATE inventory_lots');
  delete from public.inventory_lots where id=pg_temp.fixture_id(tag,'inventory_lots');
  perform pg_temp.assert_true(found,'Own DELETE inventory_lots');
  insert into public.inventory_lots(id,company_id,inventory_id,lot_number) values (pg_temp.fixture_id(tag,'inventory_lots'),company,pg_temp.fixture_id(tag,'inventory'),'Fictional-' || tag || '-lot_number');
  insert into public.stock_movements(id,company_id,movement_type,product_id,quantity,warehouse_id) values (pg_temp.fixture_id(tag,'stock_movements'),company,'inbound',pg_temp.fixture_id(tag,'products'),1,pg_temp.fixture_id(tag,'warehouse_locations'));
  update public.stock_movements set id=id where id=pg_temp.fixture_id(tag,'stock_movements');
  perform pg_temp.assert_true(found,'Own UPDATE stock_movements');
  delete from public.stock_movements where id=pg_temp.fixture_id(tag,'stock_movements');
  perform pg_temp.assert_true(found,'Own DELETE stock_movements');
  insert into public.stock_movements(id,company_id,movement_type,product_id,quantity,warehouse_id) values (pg_temp.fixture_id(tag,'stock_movements'),company,'inbound',pg_temp.fixture_id(tag,'products'),1,pg_temp.fixture_id(tag,'warehouse_locations'));
  insert into public.warehouse_transfers(id,company_id,from_location,product_id,quantity,to_location) values (pg_temp.fixture_id(tag,'warehouse_transfers'),company,pg_temp.fixture_id(tag,'warehouse_locations'),pg_temp.fixture_id(tag,'products'),1,pg_temp.fixture_id(tag,'warehouse_other'));
  update public.warehouse_transfers set id=id where id=pg_temp.fixture_id(tag,'warehouse_transfers');
  perform pg_temp.assert_true(found,'Own UPDATE warehouse_transfers');
  delete from public.warehouse_transfers where id=pg_temp.fixture_id(tag,'warehouse_transfers');
  perform pg_temp.assert_true(found,'Own DELETE warehouse_transfers');
  insert into public.warehouse_transfers(id,company_id,from_location,product_id,quantity,to_location) values (pg_temp.fixture_id(tag,'warehouse_transfers'),company,pg_temp.fixture_id(tag,'warehouse_locations'),pg_temp.fixture_id(tag,'products'),1,pg_temp.fixture_id(tag,'warehouse_other'));
  insert into public.inventory_reservations(id,company_id,inventory_id,quantity) values (pg_temp.fixture_id(tag,'inventory_reservations'),company,pg_temp.fixture_id(tag,'inventory'),1);
  update public.inventory_reservations set id=id where id=pg_temp.fixture_id(tag,'inventory_reservations');
  perform pg_temp.assert_true(found,'Own UPDATE inventory_reservations');
  delete from public.inventory_reservations where id=pg_temp.fixture_id(tag,'inventory_reservations');
  perform pg_temp.assert_true(found,'Own DELETE inventory_reservations');
  insert into public.inventory_reservations(id,company_id,inventory_id,quantity) values (pg_temp.fixture_id(tag,'inventory_reservations'),company,pg_temp.fixture_id(tag,'inventory'),1);
  insert into public.invoice_items(id,company_id,description,invoice_id) values (pg_temp.fixture_id(tag,'invoice_items'),company,'Fictional-' || tag || '-description',pg_temp.fixture_id(tag,'invoices'));
  update public.invoice_items set id=id where id=pg_temp.fixture_id(tag,'invoice_items');
  perform pg_temp.assert_true(found,'Own UPDATE invoice_items');
  delete from public.invoice_items where id=pg_temp.fixture_id(tag,'invoice_items');
  perform pg_temp.assert_true(found,'Own DELETE invoice_items');
  insert into public.invoice_items(id,company_id,description,invoice_id) values (pg_temp.fixture_id(tag,'invoice_items'),company,'Fictional-' || tag || '-description',pg_temp.fixture_id(tag,'invoices'));
  insert into public.payment_allocations(id,company_id,amount,invoice_id,payment_id) values (pg_temp.fixture_id(tag,'payment_allocations'),company,1,pg_temp.fixture_id(tag,'invoices'),pg_temp.fixture_id(tag,'payments'));
  update public.payment_allocations set id=id where id=pg_temp.fixture_id(tag,'payment_allocations');
  perform pg_temp.assert_true(found,'Own UPDATE payment_allocations');
  delete from public.payment_allocations where id=pg_temp.fixture_id(tag,'payment_allocations');
  perform pg_temp.assert_true(found,'Own DELETE payment_allocations');
  insert into public.payment_allocations(id,company_id,amount,invoice_id,payment_id) values (pg_temp.fixture_id(tag,'payment_allocations'),company,1,pg_temp.fixture_id(tag,'invoices'),pg_temp.fixture_id(tag,'payments'));
  insert into public.documents(id,company_id,title,file_path) values (pg_temp.fixture_id(tag,'documents'),company,'Fictional private document','companies/' || company::text || '/fixture.docx');
  update public.documents set id=id where id=pg_temp.fixture_id(tag,'documents');
  perform pg_temp.assert_true(found,'Own UPDATE documents');
  delete from public.documents where id=pg_temp.fixture_id(tag,'documents');
  perform pg_temp.assert_true(found,'Own DELETE documents');
  insert into public.documents(id,company_id,title,file_path) values (pg_temp.fixture_id(tag,'documents'),company,'Fictional private document','companies/' || company::text || '/fixture.docx');
  insert into public.document_versions(id,company_id,document_id,file_path) values (pg_temp.fixture_id(tag,'document_versions'),company,pg_temp.fixture_id(tag,'documents'),'companies/' || company::text || '/document_versions.docx');
  update public.document_versions set id=id where id=pg_temp.fixture_id(tag,'document_versions');
  perform pg_temp.assert_true(found,'Own UPDATE document_versions');
  delete from public.document_versions where id=pg_temp.fixture_id(tag,'document_versions');
  perform pg_temp.assert_true(found,'Own DELETE document_versions');
  insert into public.document_versions(id,company_id,document_id,file_path) values (pg_temp.fixture_id(tag,'document_versions'),company,pg_temp.fixture_id(tag,'documents'),'companies/' || company::text || '/document_versions.docx');
  insert into public.contract_imports(id,company_id) values (pg_temp.fixture_id(tag,'contract_imports'),company);
  update public.contract_imports set id=id where id=pg_temp.fixture_id(tag,'contract_imports');
  perform pg_temp.assert_true(found,'Own UPDATE contract_imports');
  delete from public.contract_imports where id=pg_temp.fixture_id(tag,'contract_imports');
  perform pg_temp.assert_true(found,'Own DELETE contract_imports');
  insert into public.contract_imports(id,company_id) values (pg_temp.fixture_id(tag,'contract_imports'),company);
  insert into public.contract_import_field_reviews(id,company_id,field_path,import_id) values (pg_temp.fixture_id(tag,'contract_import_field_reviews'),company,'Fictional-' || tag || '-field_path',pg_temp.fixture_id(tag,'contract_imports'));
  update public.contract_import_field_reviews set id=id where id=pg_temp.fixture_id(tag,'contract_import_field_reviews');
  perform pg_temp.assert_true(found,'Own UPDATE contract_import_field_reviews');
  delete from public.contract_import_field_reviews where id=pg_temp.fixture_id(tag,'contract_import_field_reviews');
  perform pg_temp.assert_true(found,'Own DELETE contract_import_field_reviews');
  insert into public.contract_import_field_reviews(id,company_id,field_path,import_id) values (pg_temp.fixture_id(tag,'contract_import_field_reviews'),company,'Fictional-' || tag || '-field_path',pg_temp.fixture_id(tag,'contract_imports'));
  insert into public.crm_customers(id,company_id,company_name) values (pg_temp.fixture_id(tag,'crm_customers'),company,'Fictional-' || tag || '-company_name');
  update public.crm_customers set id=id where id=pg_temp.fixture_id(tag,'crm_customers');
  perform pg_temp.assert_true(found,'Own UPDATE crm_customers');
  delete from public.crm_customers where id=pg_temp.fixture_id(tag,'crm_customers');
  perform pg_temp.assert_true(found,'Own DELETE crm_customers');
  insert into public.crm_customers(id,company_id,company_name) values (pg_temp.fixture_id(tag,'crm_customers'),company,'Fictional-' || tag || '-company_name');
  insert into public.crm_contacts(id,company_id,customer_id,full_name) values (pg_temp.fixture_id(tag,'crm_contacts'),company,pg_temp.fixture_id(tag,'crm_customers'),'Fictional-' || tag || '-full_name');
  update public.crm_contacts set id=id where id=pg_temp.fixture_id(tag,'crm_contacts');
  perform pg_temp.assert_true(found,'Own UPDATE crm_contacts');
  delete from public.crm_contacts where id=pg_temp.fixture_id(tag,'crm_contacts');
  perform pg_temp.assert_true(found,'Own DELETE crm_contacts');
  insert into public.crm_contacts(id,company_id,customer_id,full_name) values (pg_temp.fixture_id(tag,'crm_contacts'),company,pg_temp.fixture_id(tag,'crm_customers'),'Fictional-' || tag || '-full_name');
  insert into public.crm_notes(id,company_id,body,customer_id) values (pg_temp.fixture_id(tag,'crm_notes'),company,'Fictional-' || tag || '-body',pg_temp.fixture_id(tag,'crm_customers'));
  update public.crm_notes set id=id where id=pg_temp.fixture_id(tag,'crm_notes');
  perform pg_temp.assert_true(found,'Own UPDATE crm_notes');
  delete from public.crm_notes where id=pg_temp.fixture_id(tag,'crm_notes');
  perform pg_temp.assert_true(found,'Own DELETE crm_notes');
  insert into public.crm_notes(id,company_id,body,customer_id) values (pg_temp.fixture_id(tag,'crm_notes'),company,'Fictional-' || tag || '-body',pg_temp.fixture_id(tag,'crm_customers'));
  insert into public.crm_communications(id,company_id,customer_id) values (pg_temp.fixture_id(tag,'crm_communications'),company,pg_temp.fixture_id(tag,'crm_customers'));
  update public.crm_communications set id=id where id=pg_temp.fixture_id(tag,'crm_communications');
  perform pg_temp.assert_true(found,'Own UPDATE crm_communications');
  delete from public.crm_communications where id=pg_temp.fixture_id(tag,'crm_communications');
  perform pg_temp.assert_true(found,'Own DELETE crm_communications');
  insert into public.crm_communications(id,company_id,customer_id) values (pg_temp.fixture_id(tag,'crm_communications'),company,pg_temp.fixture_id(tag,'crm_customers'));
  insert into public.crm_tasks(id,company_id,customer_id,title) values (pg_temp.fixture_id(tag,'crm_tasks'),company,pg_temp.fixture_id(tag,'crm_customers'),'Fictional-' || tag || '-title');
  update public.crm_tasks set id=id where id=pg_temp.fixture_id(tag,'crm_tasks');
  perform pg_temp.assert_true(found,'Own UPDATE crm_tasks');
  delete from public.crm_tasks where id=pg_temp.fixture_id(tag,'crm_tasks');
  perform pg_temp.assert_true(found,'Own DELETE crm_tasks');
  insert into public.crm_tasks(id,company_id,customer_id,title) values (pg_temp.fixture_id(tag,'crm_tasks'),company,pg_temp.fixture_id(tag,'crm_customers'),'Fictional-' || tag || '-title');
  insert into public.crm_timeline_events(id,company_id,customer_id,event_type,title) values (pg_temp.fixture_id(tag,'crm_timeline_events'),company,pg_temp.fixture_id(tag,'crm_customers'),'Note','Fictional-' || tag || '-title');
  update public.crm_timeline_events set id=id where id=pg_temp.fixture_id(tag,'crm_timeline_events');
  perform pg_temp.assert_true(found,'Own UPDATE crm_timeline_events');
  delete from public.crm_timeline_events where id=pg_temp.fixture_id(tag,'crm_timeline_events');
  perform pg_temp.assert_true(found,'Own DELETE crm_timeline_events');
  insert into public.crm_timeline_events(id,company_id,customer_id,event_type,title) values (pg_temp.fixture_id(tag,'crm_timeline_events'),company,pg_temp.fixture_id(tag,'crm_customers'),'Note','Fictional-' || tag || '-title');
  insert into public.crm_attachments(id,company_id,customer_id,file_name,file_path) values (pg_temp.fixture_id(tag,'crm_attachments'),company,pg_temp.fixture_id(tag,'crm_customers'),'Fictional-' || tag || '-file_name','companies/' || company::text || '/crm_attachments.docx');
  update public.crm_attachments set id=id where id=pg_temp.fixture_id(tag,'crm_attachments');
  perform pg_temp.assert_true(found,'Own UPDATE crm_attachments');
  delete from public.crm_attachments where id=pg_temp.fixture_id(tag,'crm_attachments');
  perform pg_temp.assert_true(found,'Own DELETE crm_attachments');
  insert into public.crm_attachments(id,company_id,customer_id,file_name,file_path) values (pg_temp.fixture_id(tag,'crm_attachments'),company,pg_temp.fixture_id(tag,'crm_customers'),'Fictional-' || tag || '-file_name','companies/' || company::text || '/crm_attachments.docx');
  insert into public.deal_participants(id,company_id,business_case_id,counterparty_id,role_code) values (pg_temp.fixture_id(tag,'deal_participants'),company,pg_temp.fixture_id(tag,'business_cases'),pg_temp.fixture_id(tag,'counterparties'),'supplier');
  update public.deal_participants set id=id where id=pg_temp.fixture_id(tag,'deal_participants');
  perform pg_temp.assert_true(found,'Own UPDATE deal_participants');
  delete from public.deal_participants where id=pg_temp.fixture_id(tag,'deal_participants');
  perform pg_temp.assert_true(found,'Own DELETE deal_participants');
  insert into public.deal_participants(id,company_id,business_case_id,counterparty_id,role_code) values (pg_temp.fixture_id(tag,'deal_participants'),company,pg_temp.fixture_id(tag,'business_cases'),pg_temp.fixture_id(tag,'counterparties'),'supplier');
  insert into public.deal_products(id,company_id,business_case_id,quantity,unit) values (pg_temp.fixture_id(tag,'deal_products'),company,pg_temp.fixture_id(tag,'business_cases'),1,'Fictional-' || tag || '-unit');
  update public.deal_products set id=id where id=pg_temp.fixture_id(tag,'deal_products');
  perform pg_temp.assert_true(found,'Own UPDATE deal_products');
  delete from public.deal_products where id=pg_temp.fixture_id(tag,'deal_products');
  perform pg_temp.assert_true(found,'Own DELETE deal_products');
  insert into public.deal_products(id,company_id,business_case_id,quantity,unit) values (pg_temp.fixture_id(tag,'deal_products'),company,pg_temp.fixture_id(tag,'business_cases'),1,'Fictional-' || tag || '-unit');
  insert into public.deal_commission_links(id,company_id,business_case_id) values (pg_temp.fixture_id(tag,'deal_commission_links'),company,pg_temp.fixture_id(tag,'business_cases'));
  update public.deal_commission_links set id=id where id=pg_temp.fixture_id(tag,'deal_commission_links');
  perform pg_temp.assert_true(found,'Own UPDATE deal_commission_links');
  delete from public.deal_commission_links where id=pg_temp.fixture_id(tag,'deal_commission_links');
  perform pg_temp.assert_true(found,'Own DELETE deal_commission_links');
  insert into public.deal_commission_links(id,company_id,business_case_id) values (pg_temp.fixture_id(tag,'deal_commission_links'),company,pg_temp.fixture_id(tag,'business_cases'));
  insert into public.document_templates(id,company_id,document_type,name,template_content) values (pg_temp.fixture_id(tag,'document_templates'),company,'contract','Fictional-' || tag || '-name','{{contract_number}}');
  update public.document_templates set id=id where id=pg_temp.fixture_id(tag,'document_templates');
  perform pg_temp.assert_true(found,'Own UPDATE document_templates');
  delete from public.document_templates where id=pg_temp.fixture_id(tag,'document_templates');
  perform pg_temp.assert_true(found,'Own DELETE document_templates');
  insert into public.document_templates(id,company_id,document_type,name,template_content) values (pg_temp.fixture_id(tag,'document_templates'),company,'contract','Fictional-' || tag || '-name','{{contract_number}}');
  insert into public.template_mappings(id,company_id,placeholder,template_id) values (pg_temp.fixture_id(tag,'template_mappings'),company,'Fictional-' || tag || '-placeholder',pg_temp.fixture_id(tag,'document_templates'));
  update public.template_mappings set id=id where id=pg_temp.fixture_id(tag,'template_mappings');
  perform pg_temp.assert_true(found,'Own UPDATE template_mappings');
  delete from public.template_mappings where id=pg_temp.fixture_id(tag,'template_mappings');
  perform pg_temp.assert_true(found,'Own DELETE template_mappings');
  insert into public.template_mappings(id,company_id,placeholder,template_id) values (pg_temp.fixture_id(tag,'template_mappings'),company,'Fictional-' || tag || '-placeholder',pg_temp.fixture_id(tag,'document_templates'));
  insert into public.generated_documents(id,company_id,document_type,snapshot_hash,title,output_hash,docx_storage_path,source_template_id,source_template_version,snapshot_data)
    values (pg_temp.fixture_id(tag,'generated_documents'),company,'contract',repeat('a',64),'Fictional-' || tag || '-title',repeat('b',64),'companies/'||company::text||'/fictional-output.docx',pg_temp.fixture_id(tag,'document_templates'),1,'{"fictional":true}');
  update public.generated_documents set id=id where id=pg_temp.fixture_id(tag,'generated_documents');
  perform pg_temp.assert_true(found,'Own UPDATE generated_documents');
  begin
    delete from public.generated_documents where id=pg_temp.fixture_id(tag,'generated_documents');
    raise exception 'Generated document retention was bypassed' using errcode='23514';
  exception when raise_exception then
    perform pg_temp.assert_true(sqlerrm='Generated document versions must be retained','Generated document retention guard');
  end;
  insert into public.document_generation_batches(id,company_id,batch_number) values (pg_temp.fixture_id(tag,'document_generation_batches'),company,'Fictional-' || tag || '-batch_number');
  update public.document_generation_batches set id=id where id=pg_temp.fixture_id(tag,'document_generation_batches');
  perform pg_temp.assert_true(found,'Own UPDATE document_generation_batches');
  delete from public.document_generation_batches where id=pg_temp.fixture_id(tag,'document_generation_batches');
  perform pg_temp.assert_true(found,'Own DELETE document_generation_batches');
  insert into public.document_generation_batches(id,company_id,batch_number) values (pg_temp.fixture_id(tag,'document_generation_batches'),company,'Fictional-' || tag || '-batch_number');
  insert into public.notifications(id,company_id) values (pg_temp.fixture_id(tag,'notifications'),company);
  update public.notifications set id=id where id=pg_temp.fixture_id(tag,'notifications');
  perform pg_temp.assert_true(found,'Own UPDATE notifications');
  delete from public.notifications where id=pg_temp.fixture_id(tag,'notifications');
  perform pg_temp.assert_true(found,'Own DELETE notifications');
  insert into public.notifications(id,company_id) values (pg_temp.fixture_id(tag,'notifications'),company);
  insert into public.timeline_events(id,company_id) values (pg_temp.fixture_id(tag,'timeline_events'),company);
  update public.timeline_events set id=id where id=pg_temp.fixture_id(tag,'timeline_events');
  perform pg_temp.assert_true(found,'Own UPDATE timeline_events');
  delete from public.timeline_events where id=pg_temp.fixture_id(tag,'timeline_events');
  perform pg_temp.assert_true(found,'Own DELETE timeline_events');
  insert into public.timeline_events(id,company_id) values (pg_temp.fixture_id(tag,'timeline_events'),company);
  insert into public.activity_log(id,company_id) values (pg_temp.fixture_id(tag,'activity_log'),company);
  update public.activity_log set id=id where id=pg_temp.fixture_id(tag,'activity_log');
  perform pg_temp.assert_true(found,'Own UPDATE activity_log');
  delete from public.activity_log where id=pg_temp.fixture_id(tag,'activity_log');
  perform pg_temp.assert_true(found,'Own DELETE activity_log');
  insert into public.activity_log(id,company_id) values (pg_temp.fixture_id(tag,'activity_log'),company);
end $$;
create function pg_temp.check_company(tag text, other_tag text) returns void language plpgsql as $$
declare t text; n integer; payload jsonb; begin
  perform pg_temp.assert_true(not erp_private.is_admin(),'Company Admin must not be global Admin');
  perform pg_temp.assert_true(not public.authorize_permission('companies.write'),'Company Admin must not administer company identities');
  perform pg_temp.assert_true((select count(*)=1 from public.companies),'Company list isolation');
  for t in select name from private_tables loop
    execute format('select count(*) from public.%I where id=$1',t) into n using pg_temp.fixture_id(tag,t);
    perform pg_temp.assert_true(n=1,'Own SELECT ' || t);
    execute format('select count(*) from public.%I where company_id is distinct from $1',t) into n using pg_temp.fixture_id(tag,'companies');
    perform pg_temp.assert_true(n=0,'Cross-company or NULL SELECT ' || t);
    execute format('update public.%I set id=id where id=$1',t) using pg_temp.fixture_id(other_tag,t);
    get diagnostics n=row_count;
    perform pg_temp.assert_true(n=0,'Cross-company UPDATE ' || t);
    execute format('delete from public.%I where id=$1',t) using pg_temp.fixture_id(other_tag,t);
    get diagnostics n=row_count;
    perform pg_temp.assert_true(n=0,'Cross-company DELETE ' || t);
    begin
      execute format('update public.%I set company_id=$1 where id=$2',t) using pg_temp.fixture_id(other_tag,'companies'),pg_temp.fixture_id(tag,t);
      raise exception 'Ownership reassignment accepted: %',t;
    exception when insufficient_privilege then null; end;
    execute format('select to_jsonb(r) from public.%I r where id=$1',t) into payload using pg_temp.fixture_id(tag,t);
    payload := payload || jsonb_build_object('id',gen_random_uuid(),'company_id',pg_temp.fixture_id(other_tag,'companies'));
    begin
      execute format('insert into public.%I select (jsonb_populate_record(null::public.%I,$1)).*',t,t) using payload;
      raise exception 'Cross-company INSERT accepted: %',t;
    exception when insufficient_privilege then null; end;
  end loop;
  update public.user_profiles set role_code='admin' where user_id=auth.uid();
  get diagnostics n=row_count;
  perform pg_temp.assert_true(n=0,'Profile self-promotion');
  begin
    insert into public.company_memberships values(auth.uid(),pg_temp.fixture_id(other_tag,'companies'),'admin');
    raise exception 'Membership self-promotion';
  exception when insufficient_privilege then null; end;
  begin
    perform public.set_active_company(pg_temp.fixture_id(other_tag,'companies'));
    raise exception 'Unauthorized company selection';
  exception when insufficient_privilege then null; end;
  begin
    update public.contract_products set product_id=pg_temp.fixture_id(other_tag,'products') where id=pg_temp.fixture_id(tag,'contract_products');
    raise exception 'Cross-company FK graft accepted';
  exception when insufficient_privilege then null; end;
  begin
    update public.documents set file_path='companies/' || pg_temp.fixture_id(other_tag,'companies')::text || '/fixture.docx' where id=pg_temp.fixture_id(tag,'documents');
    raise exception 'Storage metadata graft accepted';
  exception when insufficient_privilege then null; end;
  perform pg_temp.assert_true(erp_private.storage_access('companies/' || pg_temp.fixture_id(tag,'companies')::text || '/file.docx','write'),'Own storage write');
  perform pg_temp.assert_true(not erp_private.storage_access('companies/' || pg_temp.fixture_id(other_tag,'companies')::text || '/file.docx','read'),'Cross-company storage read');
  perform pg_temp.assert_true(not erp_private.storage_access('companies/' || pg_temp.fixture_id(other_tag,'companies')::text || '/file.docx','write'),'Cross-company storage write');
  perform pg_temp.assert_true(not erp_private.storage_access('global/private.docx','read'),'Global storage isolation');
end $$;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id('A','user')::text,true);
set local role authenticated;
select pg_temp.seed_company('A',pg_temp.fixture_id('A','companies'));
select set_config('request.jwt.claim.sub',pg_temp.fixture_id('B','user')::text,true);
select pg_temp.seed_company('B',pg_temp.fixture_id('B','companies'));
select set_config('request.jwt.claim.sub',pg_temp.fixture_id('A','user')::text,true);
select pg_temp.check_company('A','B');
select set_config('request.jwt.claim.sub',pg_temp.fixture_id('B','user')::text,true);
select pg_temp.check_company('B','A');

-- RPCs must succeed for owned data and respect RLS for foreign data.
select set_config('request.jwt.claim.sub',pg_temp.fixture_id('A','user')::text,true);
select public.log_activity('contract',pg_temp.fixture_id('A','contracts'),'created','Fictional authenticated test');
select public.add_timeline_event('contract',pg_temp.fixture_id('A','contracts'),'created','Fictional authenticated test');
select public.create_notification('Fictional authenticated test');
select public.finance_register_payment(pg_temp.fixture_id('A','invoices'),20,'USD',date '2026-01-01');
select public.warehouse_receive_stock(pg_temp.fixture_id('A','warehouse_locations'),pg_temp.fixture_id('A','products'),10,'AUTH-LOT');
select public.warehouse_issue_stock(pg_temp.fixture_id('A','warehouse_locations'),pg_temp.fixture_id('A','products'),2,'AUTH-LOT');
select public.warehouse_transfer_stock(pg_temp.fixture_id('A','warehouse_locations'),pg_temp.fixture_id('A','warehouse_other'),pg_temp.fixture_id('A','products'),3,'AUTH-LOT');
select public.warehouse_adjust_stock(pg_temp.fixture_id('A','warehouse_locations'),pg_temp.fixture_id('A','products'),1,'AUTH-LOT','Fictional adjustment');
do $$ begin
  begin
    perform public.finance_register_payment(pg_temp.fixture_id('B','invoices'),20,'USD',date '2026-01-01');
    raise exception 'Cross-company finance RPC accepted' using errcode='P7777';
  exception when sqlstate 'P7777' then raise; when others then
    if sqlerrm not like '%Invoice not found%' and sqlstate <> '42501' then raise; end if;
  end;
  begin
    perform public.warehouse_receive_stock(pg_temp.fixture_id('B','warehouse_locations'),pg_temp.fixture_id('B','products'),10,'AUTH-LOT');
    raise exception 'Cross-company warehouse RPC accepted';
  exception when insufficient_privilege then null; end;
end $$;

-- Read-only, disabled, and unprovisioned identities are fail-closed.
select set_config('request.jwt.claim.sub',pg_temp.fixture_id('finance','user')::text,true);
insert into public.exchange_rates(base_currency,quote_currency,rate,rate_date) values ('USD','USD',1,date '2026-01-02');
-- Independently specified expectations for each existing business role.
do $$ declare role_name text; t text; n integer; expected boolean; begin
  foreach role_name in array array['sales','finance','warehouse','logistics','management'] loop
    perform set_config('request.jwt.claim.sub',pg_temp.fixture_id(role_name,'user')::text,true);
    foreach t in array array['contracts','crm_customers','expenses','warehouse_locations','shipments','document_templates'] loop
      expected := (role_name='sales' and t in ('contracts','crm_customers','document_templates'))
        or (role_name='finance' and t in ('expenses','document_templates'))
        or (role_name='warehouse' and t in ('warehouse_locations','document_templates'))
        or (role_name='logistics' and t in ('shipments','document_templates'));
      execute format('select count(*) from public.%I where id=$1',t) into n using pg_temp.fixture_id('A',t);
      perform pg_temp.assert_true(n=1,role_name || ' own read ' || t);
      execute format('update public.%I set id=id where id=$1',t) using pg_temp.fixture_id('A',t);
      get diagnostics n=row_count;
      perform pg_temp.assert_true(n=case when expected then 1 else 0 end,role_name || ' write scope ' || t);
    end loop;
  end loop;
end $$;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id('Read','user')::text,true);
select pg_temp.assert_true((select count(*)=1 from public.contracts),'Readonly owned SELECT');
do $$ declare n integer; begin
  update public.contracts set contract_number='Forbidden' where id=pg_temp.fixture_id('A','contracts');
  get diagnostics n=row_count; perform pg_temp.assert_true(n=0,'Readonly UPDATE');
  begin insert into public.notifications(title) values('Forbidden'); raise exception 'Readonly INSERT'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id('Disabled','user')::text,true);
select pg_temp.assert_true((select count(*)=0 from public.contracts),'Disabled access');
select set_config('request.jwt.claim.sub',pg_temp.fixture_id('Pending','user')::text,true);
select pg_temp.assert_true((select count(*)=0 from public.contracts),'Unprovisioned access');

select set_config('request.jwt.claim.sub',pg_temp.fixture_id('Admin','user')::text,true);
select pg_temp.assert_true(erp_private.is_admin(),'Global Admin');
do $$ declare t text; n integer; begin
  for t in select name from private_tables loop
    execute format('select count(*) from public.%I where id in ($1,$2)',t) into n using pg_temp.fixture_id('A',t),pg_temp.fixture_id('B',t);
    perform pg_temp.assert_true(n=2,'Admin SELECT ' || t);
    execute format('update public.%I set id=id where id=$1',t) using pg_temp.fixture_id('B',t);
    get diagnostics n=row_count; perform pg_temp.assert_true(n=1,'Admin UPDATE ' || t);
  end loop;
end $$;
select pg_temp.assert_true((select count(*)=1 from public.notifications where id=pg_temp.fixture_id('Legacy','notifications')),'Admin legacy access');
insert into public.companies(id,code,name) values(pg_temp.fixture_id('Admin','companies'),'AUTH-ADMIN','Fictional Admin company');
insert into public.company_memberships values(pg_temp.fixture_id('Pending','user'),pg_temp.fixture_id('Admin','companies'),'readonly');

set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname='public' loop
    begin execute format('select * from public.%I limit 1',t); raise exception 'Anonymous SELECT accepted: %',t;
    exception when insufficient_privilege then null; end;
  end loop;
  begin perform public.create_notification('Forbidden'); raise exception 'Anonymous RPC'; exception when insufficient_privilege then null; end;
end $$;
rollback;
