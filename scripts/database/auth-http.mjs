import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Called only by replay.mjs after verifying its fresh random local container.
// No environment credentials, remote URL, service-role key or CLI args accepted.
export async function verifyAuthHttp({ sql, publicKey }) {
  const url = 'http://127.0.0.1:55321';
  const assert = (ok, label) => { if (!ok) throw new Error(`Local Auth HTTP check failed: ${label} (response withheld)`); };
  let publicRole;
  try { publicRole = JSON.parse(Buffer.from(publicKey.split('.')[1], 'base64url').toString()).role; } catch { /* publishable key */ }
  assert(publicRole === 'anon' || /^sb_publishable_[A-Za-z0-9_-]+$/.test(publicKey), 'public key only');
  const makeClient = () => createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => {
      const target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      if (target.origin !== url) throw new Error('Auth gate refuses non-isolated HTTP targets');
      return fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(15000) });
    } },
  });
  const companyA = randomUUID(), companyB = randomUUID();
  const identities = ['A','B','Admin'].map(tag => ({ tag, id: randomUUID(), password: randomBytes(24).toString('hex'), client: makeClient() }));
  // Secret fixture values travel over stdin only; SQL error output is withheld.
  await sql(`insert into public.companies(id,code,name) values
    ('${companyA}','HTTP-A','Fictional HTTP Company A'),('${companyB}','HTTP-B','Fictional HTTP Company B');
    ${identities.map(u => `insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,created_at,updated_at)
      values('00000000-0000-0000-0000-000000000000','${u.id}','authenticated','authenticated','${u.id}@example.invalid',extensions.crypt('${u.password}',extensions.gen_salt('bf')),now(),'','','','',now(),now());`).join('\n')}
    insert into public.company_memberships(user_id,company_id,role_code) values
      ('${identities[0].id}','${companyA}','admin'),('${identities[1].id}','${companyB}','admin');
    update public.user_profiles set role_code='admin' where user_id='${identities[2].id}';`, true);
  for (const identity of identities) {
    const { data, error } = await identity.client.auth.signInWithPassword({ email: `${identity.id}@example.invalid`, password: identity.password });
    assert(!error && data.user?.id === identity.id && data.session, `${identity.tag} password sign-in`);
    const verified = await identity.client.auth.getUser();
    assert(!verified.error && verified.data.user?.id === identity.id, `${identity.tag} verified identity`);
    const refreshed = await identity.client.auth.refreshSession();
    assert(!refreshed.error && refreshed.data.session, `${identity.tag} session refresh`);
  }
  const [a,b,admin] = identities.map(u => u.client);
  for (const [client,own,other] of [[a,companyA,companyB],[b,companyB,companyA]]) {
    const companies = await client.from('companies').select('id');
    assert(!companies.error && companies.data.length === 1 && companies.data[0].id === own, 'HTTP company isolation');
    for (const [table,payload] of [
      ['notifications',{ title: 'Fictional private notification' }],
      ['timeline_events',{ title: 'Fictional private event' }],
      ['document_templates',{ company_id: own, name: 'Fictional private template', document_type: 'contract', template_content: '{{contract_number}}' }],
      ['contracts',{ contract_number: `HTTP-${own}` }],
      ['crm_customers',{ company_name: 'Fictional private CRM customer' }],
    ]) {
      const created = await client.from(table).insert(payload).select('id,company_id').single();
      assert(!created.error && created.data.company_id === own, `${table} authenticated INSERT and ownership`);
      const changed = await client.from(table).update(payload).eq('id', created.data.id).select('id');
      assert(!changed.error && changed.data.length === 1, `${table} authenticated UPDATE`);
      const foreign = await client.from(table).select('id').eq('company_id',other);
      assert(!foreign.error && foreign.data.length === 0, `${table} foreign SELECT`);
      const denied = await client.from(table).insert({ ...payload, company_id: other });
      assert(denied.error?.code === '42501', `${table} foreign INSERT`);
    }
    const ownPath = `companies/${own}/http-fixture.pdf`;
    const otherPath = `companies/${other}/http-fixture.pdf`;
    const upload = await client.storage.from('documents').upload(ownPath, new Blob(['%PDF-1.4 Fictional auth fixture'], { type: 'application/pdf' }));
    assert(!upload.error, 'owned Storage upload');
    const signed = await client.storage.from('documents').createSignedUrl(ownPath,30);
    assert(!signed.error && signed.data.signedUrl, 'owned Storage signed URL');
    const deniedUpload = await client.storage.from('documents').upload(`companies/${other}/forbidden.pdf`, new Blob(['Fictional'], { type: 'application/pdf' }));
    assert(deniedUpload.error, 'foreign Storage upload denied');
    const deniedSign = await client.storage.from('documents').createSignedUrl(otherPath,30);
    assert(deniedSign.error, 'foreign Storage signing denied');
  }
  const adminCompanies = await admin.from('companies').select('id');
  assert(!adminCompanies.error && adminCompanies.data.length === 2, 'Admin HTTP company access');
  const anon = makeClient();
  for (const table of ['companies','notifications','timeline_events','document_templates','contracts','crm_customers']) {
    const denied = await anon.from(table).select('id');
    assert(denied.error?.code === '42501', `${table} anonymous HTTP access denied`);
  }
  const anonSign = await anon.storage.from('documents').createSignedUrl(`companies/${companyA}/http-fixture.pdf`,30);
  assert(anonSign.error, 'anonymous Storage signing denied');
  const badLogin = await anon.auth.signInWithPassword({ email: `${identities[0].id}@example.invalid`, password: 'fictional-wrong-password' });
  assert(badLogin.error, 'invalid password denied');
  for (const identity of identities) {
    const session = await identity.client.auth.getSession();
    const refreshToken = session.data.session?.refresh_token;
    assert(refreshToken, 'session before logout');
    const signedOut = await identity.client.auth.signOut();
    assert(!signedOut.error, 'logout');
    const replayRefresh = await makeClient().auth.refreshSession({ refresh_token: refreshToken });
    assert(replayRefresh.error, 'logout revokes refresh token');
  }
  console.log('Auth HTTP: password login, verified identity, refresh/logout, PostgREST CRUD, company isolation and private Storage passed.');
}
