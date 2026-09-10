// Real authenticated actions and constraints in the canonical isolated replay.
export async function verifyEconomicsIdentityHttp({ users, fixtures, sql }) {
  const check = (ok, label) => { if (!ok) throw new Error(`Economics identifiers: ${label}`); };
  const saved = (result, label) => { check(result.success, `${label}: ${result.error ?? ''}`); return result.id; };
  for (const f of fixtures) {
    const load = f.user.load;
    const cp = { ...load('src/lib/counterparties/types.ts').emptyCounterpartyForm(), legal_name: 'Fictional scoped code supplier', counterparty_type: 'Supplier', code: 'ECON-SHARED-CODE' };
    saved(await load('src/lib/counterparties/actions.ts').createCounterparty(cp), 'same Counterparty code across companies');
    check(!(await load('src/lib/counterparties/actions.ts').createCounterparty(cp)).success, 'Counterparty duplicate in own company rejected');
    const product = { ...load('src/lib/products/types.ts').emptyProductForm(), name: 'Fictional scoped Product', sku: 'ECON-SHARED-SKU', code: 'ECON-SHARED-CODE', unit: 'MT' };
    saved(await load('src/lib/products/actions.ts').createProduct(product), 'same Product code/SKU across companies');
    check(!(await load('src/lib/products/actions.ts').createProduct({ ...product, sku: 'ECON-OTHER-SKU' })).success, 'Product duplicate code in own company rejected');
    const dealInput = { ...load('src/lib/business-cases/types.ts').emptyBusinessCaseForm(), company_id: f.company, case_number: 'ECON-SHARED-DEAL', title: 'Fictional scoped Deal', currency: 'USD' };
    const deal = saved(await load('src/lib/business-cases/actions.ts').createBusinessCase(dealInput), 'same Deal number across companies');
    check(!(await load('src/lib/business-cases/actions.ts').createBusinessCase(dealInput)).success, 'Deal duplicate in own company rejected');
    const inconsistent = await f.user.client.from('business_cases').update({ number: 'ECON-ONE', case_number: 'ECON-TWO' }).eq('id', deal);
    check(Boolean(inconsistent.error), 'conflicting Deal number aliases rejected');
    const contract = { ...load('src/lib/contracts/form-types.ts').emptyContractForm(), company_id: f.company, deal_id: deal, business_case_id: deal, contract_number: 'ECON-SHARED-CONTRACT', currency: 'USD', parties: [
      { role_code: 'seller', internal_company_id: null, counterparty_id: f.parties[0], snapshot: { legal_name: 'Fictional external supplier' } },
      { role_code: 'buyer', internal_company_id: f.company, counterparty_id: null, snapshot: { legal_name: 'Fictional internal company' } },
    ], product_lines: [] };
    const id = saved(await users[0].load('src/lib/contracts/actions.ts').createContract(contract), 'same Contract number across companies with Admin visibility');
    check(!(await load('src/lib/contracts/actions.ts').createContract(contract)).success, 'Contract duplicate in own company rejected');
    const aliases = await f.user.client.from('contracts').select('deal_id,business_case_id,business_role,deal_contract_role').eq('id', id).single();
    check(!aliases.error && aliases.data.deal_id === deal && aliases.data.business_case_id === deal && aliases.data.business_role === null && aliases.data.deal_contract_role === null, 'canonical Contract aliases and explicit-party perspective');
    const conflict = await f.user.client.from('contracts').update({ business_case_id: f.deal }).eq('id', id);
    check(Boolean(conflict.error), 'conflicting Contract Deal aliases rejected');
  }
  // Admin sees both scopes: callers must not accidentally use global prechecks.
  const all = await users[0].client.from('contracts').select('id,company_id').eq('contract_number','ECON-SHARED-CONTRACT');
  check(!all.error && all.data.length === 2 && new Set(all.data.map(row => row.company_id)).size === 2, 'two company-scoped Contract identifiers coexist');
  const issuer = await users[0].client.from('companies').select('code').eq('id', fixtures[0].company).single();
  check(!issuer.error && Boolean((await users[0].client.from('companies').update({ code: issuer.data.code }).eq('id',fixtures[1].company)).error), 'Company codes retain legitimate global uniqueness');
  const [admin, a, b] = users, [fa, fb] = fixtures;
  const companyA = await admin.client.from('companies').select('code,name').eq('id', fa.company).single();
  const companyB = await admin.client.from('companies').select('code,name').eq('id', fb.company).single();
  check(!companyA.error && !companyB.error, 'company profile fixture');
  const orphan = await a.client.from('counterparties').insert({ company_id: fa.company, code: companyA.data.code, legal_name: companyA.data.name, counterparty_type: 'buyer' }).select('id').single();
  check(!orphan.error, 'scoped unlinked Company profile fixture');
  const collision = await b.client.from('counterparties').insert({ company_id: fb.company, code: companyB.data.code, legal_name: 'Fictional unrelated code owner', counterparty_type: 'buyer' });
  check(!collision.error, 'scoped code collision fixture');
  check(!(await admin.client.rpc('set_active_company', { company_id: fb.company })).error, 'Admin active company B');
  const profiles = admin.load('src/lib/counterparties/actions.ts');
  const reused = saved(await profiles.addCompanyAsCounterparty(fa.company), 'reuse Company A profile while active B');
  check(reused === orphan.data.id, 'same canonical profile reused');
  check(saved(await profiles.addCompanyAsCounterparty(fa.company), 'repeat Company A profile') === reused, 'repeat retains canonical ID');
  const bProfile = saved(await profiles.addCompanyAsCounterparty(fb.company), 'collision creates profile without stealing code');
  check(saved(await profiles.addCompanyAsCounterparty(fb.company), 'repeat colliding Company profile') === bProfile, 'collision retry retains canonical ID');
  const bRead = await b.client.from('counterparties').select('company_id,source_company_id,code').eq('id', bProfile).single();
  check(!bRead.error && bRead.data.company_id === fb.company && bRead.data.source_company_id === fb.company && bRead.data.code === null, 'owner and represented Company retained with safe absent code');
  check(!(await b.client.from('counterparties').update({ code: 'ECON-CUSTOM-COMPANY-PROFILE' }).eq('id', bProfile)).error, 'explicit custom Company profile code');
  check(saved(await profiles.addCompanyAsCounterparty(fb.company), 'retry profile with custom code and Company-code collision') === bProfile, 'custom-code retry retains canonical ID');
  const custom = await b.client.from('counterparties').select('code').eq('id', bProfile).single();
  check(!custom.error && custom.data.code === 'ECON-CUSTOM-COMPANY-PROFILE', 'collision retry preserves existing custom code');
  check(!(await b.client.from('counterparties').update({ legal_name: companyB.data.name }).eq('code', companyB.data.code)).error, 'same-name unrelated collision fixture');
  check(saved(await profiles.addCompanyAsCounterparty(fb.company), 'retry existing link with same-name unlinked code owner') === bProfile, 'existing link wins over possible orphan reuse');
  check(!(await a.load('src/lib/counterparties/actions.ts').addCompanyAsCounterparty(fb.company)).success, 'foreign Company profile access remains denied');
  const profilesRead = await admin.client.from('counterparties').select('id').in('source_company_id', [fa.company, fb.company]);
  check(!profilesRead.error && profilesRead.data.length === 2, 'no duplicated Company profiles');
  // Privileged fictional SQL is confined to replay and rolled back. Normal
  // authenticated creation assigns an owner, so it cannot exercise quarantine.
  await sql(`begin;
    insert into public.contracts(contract_number) values ('ECON-NULL-CONTRACT');
    insert into public.counterparties(code,legal_name) values ('ECON-NULL-CP','Fictional quarantine');
    insert into public.products(code,name) values ('ECON-NULL-PRODUCT','Fictional quarantine');
    insert into public.business_cases(number) values ('ECON-NULL-DEAL');
    do $$ declare rejected boolean; begin
      rejected=false; begin insert into public.contracts(contract_number) values ('ECON-NULL-CONTRACT'); exception when unique_violation then rejected=true; end;
      if not rejected then raise exception 'Unassigned Contract duplicate allowed'; end if;
      rejected=false; begin insert into public.counterparties(code,legal_name) values ('ECON-NULL-CP','Fictional duplicate'); exception when unique_violation then rejected=true; end;
      if not rejected then raise exception 'Unassigned Counterparty duplicate allowed'; end if;
      rejected=false; begin insert into public.products(code,name) values ('ECON-NULL-PRODUCT','Fictional duplicate'); exception when unique_violation then rejected=true; end;
      if not rejected then raise exception 'Unassigned Product duplicate allowed'; end if;
      rejected=false; begin insert into public.business_cases(number) values ('ECON-NULL-DEAL'); exception when unique_violation then rejected=true; end;
      if not rejected then raise exception 'Unassigned Deal duplicate allowed'; end if;
    end $$;
    insert into public.counterparties(legal_name) values ('Fictional absent code one'),('Fictional absent code two');
    insert into public.products(name) values ('Fictional absent code one'),('Fictional absent code two');
    rollback;`);
  console.log('Economics prerequisites: business identifiers are company-scoped; canonical aliases remain consistent.');
}
