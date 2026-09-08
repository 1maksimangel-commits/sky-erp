-- Schema/RPC integration, exclusively fictional data in the freshly created stack.
-- Deliberately runs as the local database owner: this is NOT an auth/RLS pass.
-- All fixture changes roll back, including writes performed by security-definer RPCs.
begin;
do $$
declare
  company uuid;
  party uuid;
  product uuid;
  deal uuid;
  contract uuid;
  shipment uuid;
  invoice uuid;
  payment uuid;
  warehouse uuid;
  other_warehouse uuid;
  document uuid;
  template uuid;
  generated uuid;
  batch uuid;
  customer uuid;
  value numeric;
begin
  insert into public.companies(code, name) values ('REPLAY-CO', 'Fictional Replay Company') returning id into company;
  insert into public.counterparties(code, legal_name) values ('REPLAY-CP', 'Fictional Replay Counterparty') returning id into party;
  insert into public.products(sku, name, glaze, is_active) values ('REPLAY-P', 'Fictional Product', 10, true) returning id into product;
  insert into public.business_cases(case_number, company_id, buyer_id, supplier_id)
    values ('REPLAY-DEAL', company, party, party) returning id into deal;
  if (select number from public.business_cases where id = deal) is distinct from 'REPLAY-DEAL' then
    raise exception 'Canonical Deal insert did not populate required legacy number';
  end if;
  insert into public.business_cases(number, company_id) values ('REPLAY-LEGACY', company);
  if not exists (select 1 from public.business_cases where case_number = 'REPLAY-LEGACY') then
    raise exception 'Legacy Deal insert did not populate case_number';
  end if;
  insert into public.deal_products(business_case_id, product_id, product_description, quantity, unit)
    values (deal, product, 'Fictional Product', 10, 'kg');
  insert into public.contracts(contract_number, company_id, buyer_id, supplier_id, business_case_id, deal_id, currency, amount)
    values ('REPLAY-CONTRACT', company, party, party, deal, deal, null, null) returning id into contract;
  insert into public.contract_products(contract_id, product_id, quantity, unit_price) values (contract, product, 10, 10);
  insert into public.shipments(contract_id, business_case_id, company_id, port_of_loading, port_of_destination)
    values (contract, deal, company, 'Fictional Port A', 'Fictional Port B') returning id into shipment;
  insert into public.invoices(contract_id, business_case_id, company_id, invoice_number, amount, outstanding)
    values (contract, deal, company, 'REPLAY-INVOICE', 100, 100) returning id into invoice;
  insert into public.invoice_items(invoice_id, product_id, description, quantity, unit_price, line_total)
    values (invoice, product, 'Fictional line', 10, 10, 100);
  payment := public.finance_register_payment(invoice, 20, 'USD', date '2026-01-01');
  select outstanding into value from public.invoices where id = invoice;
  if value is distinct from 80 then raise exception 'Finance RPC failed to refresh invoice balance'; end if;
  if not exists (select 1 from public.payments where id = payment and business_case_id = deal) then
    raise exception 'Finance RPC failed to preserve Deal relationship';
  end if;
  insert into public.expenses(company_id, business_case_id, contract_id, amount, expense_date, status)
    values (company, deal, contract, 5, date '2026-01-01', 'Posted');
  insert into public.warehouse_locations(code, name) values ('REPLAY-W1', 'Fictional Warehouse 1') returning id into warehouse;
  insert into public.warehouse_locations(code, name) values ('REPLAY-W2', 'Fictional Warehouse 2') returning id into other_warehouse;
  perform public.warehouse_receive_stock(warehouse, product, 10, 'REPLAY-LOT');
  perform public.warehouse_issue_stock(warehouse, product, 2, 'REPLAY-LOT');
  perform public.warehouse_transfer_stock(warehouse, other_warehouse, product, 3, 'REPLAY-LOT');
  perform public.warehouse_adjust_stock(warehouse, product, 1, 'REPLAY-LOT', 'Fictional schema test');
  select quantity into value from public.inventory where warehouse_id = warehouse and product_id = product;
  if value is distinct from 6 then raise exception 'Warehouse RPC schema smoke failed'; end if;
  insert into public.contract_imports(file_path, file_name, status, created_contract_id)
    values ('imports/replay.pdf', 'replay.pdf', 'uploaded', contract);
  insert into public.documents(title, document_type, contract_id, business_case_id, file_path)
    values ('Fictional Supplement', 'supplement', contract, deal, 'replay/supplement.docx') returning id into document;
  insert into public.document_versions(document_id, version, file_path)
    values (document, 1, 'replay/supplement.docx');
  insert into public.document_templates(name, document_type, template_content)
    values ('Fictional text template', 'contract', '{{contract_number}}') returning id into template;
  insert into public.template_mappings(template_id, placeholder, sky_variable)
    values (template, 'contract_number', 'contract.number');
  insert into public.document_generation_batches(batch_number, deal_id) values ('REPLAY-BATCH', deal) returning id into batch;
  insert into public.generated_documents(title, document_type, source_template_id, business_case_id, deal_id, contract_id, batch_id, snapshot_hash)
    values ('Fictional Draft', 'contract', template, deal, deal, contract, batch, 'fictional-replay-hash') returning id into generated;
  update public.generated_documents set status = 'Final', finalized_at = now() where id = generated;
  insert into public.generated_documents(title, document_type, version, supersedes_id, business_case_id, snapshot_hash)
    values ('Fictional New Version', 'contract', 2, generated, deal, 'fictional-replay-hash');
  insert into public.crm_customers(company_name, company_id, counterparty_id)
    values ('Fictional CRM Customer', company, party) returning id into customer;
  insert into public.crm_contacts(customer_id, full_name) values (customer, 'Fictional Contact');
  insert into public.crm_notes(customer_id, body) values (customer, 'Fictional history');
  perform public.log_activity('contract', contract, 'created', 'Fictional schema test');
  perform public.add_timeline_event('contract', contract, 'created', 'Fictional schema test');
  perform public.create_notification('Fictional schema test');
  perform public.soft_delete_contract(contract);
  if not exists (select 1 from public.contracts where id = contract and deleted_at is not null) then
    raise exception 'Soft-delete RPC schema smoke failed';
  end if;
  -- Integrity must fail loudly, not merely expose columns with no actual FK.
  begin
    insert into public.contract_products(contract_id, product_id) values (gen_random_uuid(), product);
    raise exception 'Orphan contract product was accepted';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.document_templates(name, document_type) values ('Missing source', 'contract');
    raise exception 'Template without a source was accepted';
  exception when check_violation then null;
  end;
  if not exists (select 1 from storage.buckets where id = 'documents' and
    (allowed_mime_types is null or 'application/vnd.openxmlformats-officedocument.wordprocessingml.template' = any(allowed_mime_types))) then
    raise exception 'Existing DOTX upload MIME type is not allowed';
  end if;
end $$;
rollback;
