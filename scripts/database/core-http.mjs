import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { coreSource } from './core-source.mjs';

// Invoked exclusively by the verified fresh-stack replay runner.
export async function verifyCoreHttp({ sql, publicKey }) {
  const origin = 'http://127.0.0.1:55321';
  const check = (ok, label) => { if (!ok) throw new Error(`Core regression failed: ${label}`); };
  const client = () => createClient(origin, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => {
      const target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      if (target.origin !== origin) throw new Error('Core gate refuses external HTTP targets');
      return fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(15000) });
    } },
  });
  const users = ['Admin', 'A', 'B'].map(tag => ({ id: randomUUID(), tag, password: randomBytes(24).toString('hex'), client: client() }));
  await sql(users.map(u => `insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,created_at,updated_at)
    values('00000000-0000-0000-0000-000000000000','${u.id}','authenticated','authenticated','${u.id}@example.invalid',extensions.crypt('${u.password}',extensions.gen_salt('bf')),now(),'','','','',now(),now());`).join('\n') + `update public.user_profiles set role_code='admin' where user_id='${users[0].id}';`, true);
  for (const u of users) {
    const signed = await u.client.auth.signInWithPassword({ email: `${u.id}@example.invalid`, password: u.password });
    check(!signed.error && signed.data.user?.id === u.id, `${u.tag} login`);
    u.load = coreSource(u.client);
  }
  const [admin, a, b] = users;
  const mustSave = (result, label) => { check(result.success, `${label}: ${result.error ?? 'unknown'}`); return result.id; };
  const companyActions = admin.load('src/lib/companies/actions.ts');
  const companyInput = { ...admin.load('src/lib/companies/types.ts').emptyCompanyForm(), code: 'CORE-A', name: 'SKY TEST TRADING LTD', short_name: 'SKY TEST', address: 'Fictional Test Address', tax_id: 'TEST-TAX', registration_number: 'TEST-REG', bank_name: 'Fictional Test Bank', bank_account_name: 'Fictional account', account_number: 'TEST-ONLY', bank_currency: 'USD' };
  const companyA = mustSave(await companyActions.createCompany(companyInput), 'Company CREATE');
  const companyB = mustSave(await companyActions.createCompany({ ...companyInput, code: 'CORE-B', name: 'SKY TEST COMPANY B' }), 'Company B CREATE');
  await sql(`insert into public.company_memberships(user_id,company_id,role_code) values ('${a.id}','${companyA}','admin'),('${b.id}','${companyB}','admin');`, true);
  const companyRead = await admin.load('src/lib/companies.ts').getCompanyById(companyA);
  check(!companyRead.error && companyRead.data.bank_accounts.length === 1 && companyRead.data.tax_id === 'TEST-TAX', 'Company and bank READ');
  mustSave(await companyActions.updateCompany(companyA, { ...companyInput, city: 'Fictional City' }), 'Company UPDATE');
  check(!(await companyActions.createCompany({ ...companyInput, code: 'CORE-ROLLBACK', bank_currency: 'ZZZ' })).success, 'Company bank invalid FK rejected');
  const rolledBack = await admin.client.from('companies').select('id').eq('code', 'CORE-ROLLBACK');
  check(!rolledBack.error && rolledBack.data.length === 0, 'Company/bank transaction rollback');
  const fixtures = [];
  for (const [user, company] of [[a, companyA], [b, companyB]]) {
    const load = user.load;
    const cp = load('src/lib/counterparties/actions.ts');
    const pa = load('src/lib/products/actions.ts');
    const da = load('src/lib/deals/actions.ts');
    const parties = [];
    const partyInputs = [];
    for (const [role, name] of [['Supplier','PACIFIC TEST SEAFOOD CO.'], ['Buyer','ASIA TEST IMPORT CO.'], ['Consignee','DALIAN TEST COLD STORAGE']]) {
      const input = { ...load('src/lib/counterparties/types.ts').emptyCounterpartyForm(), legal_name: name, counterparty_type: role, code: `${user.tag}-${role}` };
      partyInputs.push(input);
      parties.push(mustSave(await cp.createCounterparty(input), `${role} CREATE`));
    }
    mustSave(await cp.updateCounterparty(parties[0], { ...partyInputs[0], city: 'Fictional Port' }), 'Counterparty UPDATE');
    check((await load('src/lib/counterparties.ts').getCounterpartyById(parties[0])).data?.city === 'Fictional Port', 'Counterparty READ');
    const products = [];
    const inputs = [];
    for (const [i, name] of ['Pacific Cod','Pollock','Halibut'].entries()) {
      const input = { ...load('src/lib/products/types.ts').emptyProductForm(), name, sku: `CORE-${i}`, scientific_name: `Fictional species ${i}`, category: 'Fish', origin: 'Fictional Origin', hs_code: '0303', size_grade: 'TEST', unit: 'kg', purchase_price: 2.5, sale_price: 3, net_weight: 10, gross_weight: 11 };
      inputs.push(input);
      products.push(mustSave(await pa.createProduct(input), 'Product CREATE'));
    }
    mustSave(await pa.updateProduct(products[0], { ...inputs[0], scientific_name: 'Gadus macrocephalus' }), 'Product UPDATE');
    check((await load('src/lib/products.ts').getProductById(products[0])).data?.scientific_name === 'Gadus macrocephalus', 'Product scientific name READ');
    check(!(await pa.createProduct(inputs[0])).success, 'duplicate SKU rejected within Company');
    check(!(await pa.createProduct({ ...inputs[0], sku: inputs[0].sku.toLowerCase() })).success, 'case-insensitive duplicate SKU rejected');
    const skuPreview = await pa.checkExistingSkus([inputs[0].sku.toLowerCase()]);
    check(skuPreview.success && skuPreview.existingSkus.includes(inputs[0].sku), 'batch SKU preview matches database uniqueness');
    const dealInput = { ...load('src/lib/business-cases/types.ts').emptyBusinessCaseForm(), case_number: `CORE-${user.tag}`, title: 'Fictional seafood Deal', company_id: company, supplier_id: parties[0], buyer_id: parties[1], consignee_id: parties[2], currency: 'USD', notes: 'Fictional only' };
    const deal = mustSave(await load('src/lib/business-cases/actions.ts').createBusinessCase(dealInput), 'Deal CREATE via canonical adapter');
    mustSave(await da.saveDealCore(deal, { ...dealInput, case_number: `CORE-${user.tag}-UPDATED`, title: 'Updated fictional Deal' }), 'Deal UPDATE');
    const lines = [];
    const lineInput = { business_case_id: deal, product_description: 'Fictional specification', size_grade: 'TEST', quantity: 12.5, unit: 'kg', net_weight: 12.5, gross_weight: 13, purchase_price: 2.5, sales_price: 3, purchase_currency: 'USD', sales_currency: 'USD', notes: 'Fictional line notes' };
    for (const product_id of products) lines.push(mustSave(await da.addDealProduct({ ...lineInput, product_id }), 'Product line CREATE'));
    mustSave(await da.updateDealProduct(lines[0], { ...lineInput, product_id: products[0], quantity: 15 }), 'Product line UPDATE');
    const workspace = await load('src/lib/deals/db.ts').getDealWorkspaceData(deal);
    check(!workspace.error && workspace.data.products.length === 3, 'Deal workspace reads three joined lines');
    const read = await load('src/lib/business-cases.ts').getBusinessCaseById(deal);
    const aliases = await user.client.from('business_cases').select('number,case_number').eq('id',deal).single();
    check(!read.error && !aliases.error && aliases.data.number === read.data.case_number && read.data.supplier_id === parties[0] && read.data.supplier?.legal_name === partyInputs[0].legal_name, 'one canonical Deal, number aliases and party FKs');
    check(load('src/lib/core/validation.ts').lineAmount(workspace.data.products.find(p => p.id === lines[0]).quantity, 3) === 45, 'line amount after UPDATE');
    const lists = await Promise.all([load('src/lib/companies.ts').getCompanies(), load('src/lib/counterparties.ts').getCounterparties(), load('src/lib/products.ts').getProducts(), load('src/lib/business-cases.ts').getBusinessCases()]);
    check(lists.every(result => !result.error), 'all core list loaders');
    check(lists[1].data.length === 3 && lists[2].data.length === 3 && lists[3].data.length === 1, 'company-scoped lists');
    for (const [action,id,loader] of [[cp.setCounterpartyActive, parties[0], () => load('src/lib/counterparties.ts').getCounterpartyById(parties[0])], [pa.setProductActive, products[0], () => load('src/lib/products.ts').getProductById(products[0])]]) {
      mustSave(await action(id, false), 'master ARCHIVE');
      check((await loader()).data?.is_active === false, 'archive retains master record');
      mustSave(await action(id, true), 'master RESTORE');
    }
    mustSave(await da.setDealArchived(deal,true), 'Deal ARCHIVE');
    check(!(await da.addDealProduct({ ...lineInput, product_id: products[0] })).success, 'archived Deal rejects new lines');
    mustSave(await da.setDealArchived(deal,false), 'Deal RESTORE');
    const spare = mustSave(await da.addDealProduct({ ...lineInput, product_id: products[0] }), 'removable line CREATE');
    mustSave(await da.removeDealProduct(deal, spare), 'unlinked line DELETE');
    check((await load('src/lib/deals/db.ts').loadDealProducts([deal])).data.length === 3, 'line DELETE retains other lines');
    check(!(await da.addDealProduct({ ...lineInput, product_id: products[0], quantity: 0 })).success, 'zero quantity rejected');
    const missing = await user.client.from('deal_products').insert({ ...lineInput, product_id: randomUUID() });
    check(Boolean(missing.error), 'missing Product FK rejected');
    const referenced = await user.client.from('products').delete().eq('id', products[0]);
    check(referenced.error?.code === '23503', 'referenced Product cannot be deleted');
    fixtures.push({ user, company, parties, products, deal, lines, lineInput, dealInput, partyInputs, inputs });
  }
  for (const [own, other] of [[fixtures[0],fixtures[1]],[fixtures[1],fixtures[0]]]) {
    for (const [table, id] of [['counterparties',other.parties[0]], ['products',other.products[0]], ['business_cases',other.deal], ['deal_products',other.lines[0]]]) {
      const read = await own.user.client.from(table).select('id').eq('id',id);
      const changed = await own.user.client.from(table).update(table === 'deal_products' ? { notes: 'forbidden' } : table === 'business_cases' ? { title: 'forbidden' } : { is_active: false }).eq('id',id).select('id');
      check(!read.error && read.data.length === 0 && !changed.error && changed.data.length === 0, `${table} bilateral isolation`);
      const anonymous = await client().from(table).select('id');
      check(anonymous.error?.code === '42501', `${table} anon denied`);
    }
    const da = own.user.load('src/lib/deals/actions.ts');
    check(!(await da.addDealProduct({ ...own.lineInput, product_id: other.products[0] })).success, 'foreign Product action rejected');
    check(!(await da.saveDealCore(own.deal, { ...own.dealInput, buyer_id: other.parties[1] })).success, 'foreign Buyer action rejected');
    check(!(await da.updateDealProduct(other.lines[0], { ...own.lineInput, product_id: own.products[0] })).success, 'line cannot be reparented from another Deal');
    const direct = await own.user.client.from('deal_products').insert({ ...own.lineInput, product_id: other.products[0] });
    check(Boolean(direct.error), 'database cross-company FK guard');
  }
  mustSave(await companyActions.setCompanyActive(companyA,false), 'Company ARCHIVE');
  check((await admin.load('src/lib/companies.ts').getCompanyById(companyA)).data?.is_active === false, 'Company archive retained');
  mustSave(await companyActions.setCompanyActive(companyA,true), 'Company RESTORE');
  console.log('Core: real authenticated action/loader CRUD, atomic Company/bank save, three products/lines, calculations, archives, FK integrity and bilateral isolation passed.');
  return { users, fixtures };
}
