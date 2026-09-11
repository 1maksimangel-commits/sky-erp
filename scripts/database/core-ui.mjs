import { spawn } from 'node:child_process';
import http from 'node:http';
import { createServerClient } from '@supabase/ssr';

export async function verifyLoopbackTransport() {
  const probe = http.createServer((_request, response) => response.end('sky-core-loopback-probe'));
  await new Promise((resolve,reject) => { probe.once('error',reject); probe.listen(55323,'127.0.0.1',resolve); });
  try {
    const text = await new Promise((resolve,reject) => {
      const request = http.get('http://127.0.0.1:55323/', { agent: false, signal: AbortSignal.timeout(5000) }, response => {
        let body = ''; response.on('data',chunk => { body += chunk; }); response.on('end',() => resolve(body)); response.on('error',reject);
      });
      request.on('error',reject);
    });
    if (text !== 'sky-core-loopback-probe') throw new Error('Loopback probe response mismatch');
    console.log('Direct loopback transport on port 55323 passed.');
  } finally { await new Promise(resolve => probe.close(resolve)); }
}

if (process.argv[1]?.endsWith('/core-ui.mjs') && process.argv[2] === '--transport') {
  await verifyLoopbackTransport();
}

// HTTP SSR verification only: no browser automation or personal browser profile.
// This child is owned by this test and only binds loopback on a dedicated port.
export async function verifyCoreUi({ publicKey, users, fixtures }) {
  await verifyLoopbackTransport();
  const origin = 'http://127.0.0.1:55323';
  const env = { ...process.env, NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1' };
  for (const name of Object.keys(env)) if (/SUPABASE|OPENAI|DATABASE_URL|^PG/.test(name)) delete env[name];
  env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:55321';
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = publicKey;
  // Never inherit a real AI key. No AI/upload endpoints are requested.
  env.OPENAI_API_KEY = '';
  env.SKY_CORE_UI_TEST = '1';
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '55323'], { cwd: process.cwd(), env, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
  let exited = false, ready = false, diagnostics = '';
  server.stdout.on('data', chunk => { diagnostics = (diagnostics + String(chunk)).slice(-16000); if (String(chunk).includes('Ready in')) ready = true; });
  // Withhold framework output: it may include configuration or session details.
  server.stderr.on('data', chunk => { diagnostics = (diagnostics + String(chunk)).slice(-16000); });
  const stopped = new Promise(resolve => { server.once('exit', () => { exited = true; resolve(); }); server.once('error', () => { exited = true; resolve(); }); });
  const check = (ok, label) => { if (!ok) throw new Error(`Core UI HTTP failed: ${label} (response withheld)`); };
  const request = async (route, options) => {
    try { return await new Promise((resolve, reject) => {
      const req = http.get(origin + route, { headers: options.headers, signal: options.signal, agent: false }, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('error', reject);
        response.on('end', () => resolve({ status: response.statusCode, headers: new Headers(Object.entries(response.headers).flatMap(([name,value]) => value == null ? [] : [[name, String(value)]])), text: async () => Buffer.concat(chunks).toString('utf8'), bytes: async () => Buffer.concat(chunks) }));
      });
      req.on('error', reject);
    }); }
    catch (error) {
      const flags = ['Turbopack', 'Compiling', 'Compiled', 'Ready in', 'Restarting', 'panicked', 'FATAL', 'out of memory', 'EACCES', 'EPERM', 'ENOENT', 'ENOSPC', 'Cannot find module', 'SIGABRT', 'SIGSEGV'].filter(text => diagnostics.includes(text));
      throw new Error(`Core UI transport failed on ${route}; code=${error.cause?.code ?? error.code ?? error.name}; owned server exited=${exited}; diagnostic categories=${flags.join(',') || 'none'}`);
    }
  };
  try {
    for (let i = 0; i < 120 && !ready && !exited; i++) await new Promise(resolve => setTimeout(resolve, 500));
    check(ready && !exited, 'isolated Next server startup');
    const login = await request('/login', { signal: AbortSignal.timeout(90000) });
    check(login.status === 200, 'login HTTP availability');
    for (const fixture of fixtures) {
      const jar = new Map();
      const ssr = createServerClient('http://127.0.0.1:55321', publicKey, { cookies: {
        getAll: () => [...jar].map(([name,value]) => ({ name,value })),
        setAll: values => values.forEach(({name,value}) => jar.set(name,value)),
      } });
      const session = (await fixture.user.client.auth.getSession()).data.session;
      check(session, 'fixture authenticated session');
      const attached = await ssr.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
      check(!attached.error, 'SSR session cookies');
      const cookie = [...jar].map(([name,value]) => `${name}=${value}`).join('; ');
      const ownRoutes = [
        ['/warehouse', 'Warehouse'], ['/logistics', 'Logistics'], ['/finance', 'Finance'], ['/crm', 'CRM'],
        ['/finance/invoices', 'Invoices'], ['/finance/payments', 'Payments'], ['/finance/bank-accounts', 'Bank Accounts'], ['/finance/exchange-rates', 'Exchange Rates'],
        ['/finance/expenses', 'Expenses'], ['/finance/commissions', 'Commissions'],
        ...(fixture.shipmentId ? [[`/logistics/${fixture.shipmentId}`, 'Shipment']] : []),
        ...(fixture.invoiceId ? [[`/finance/invoices/${fixture.invoiceId}`, 'Invoice']] : []),
        ...(fixture.paymentId ? [[`/finance/payments/${fixture.paymentId}`, 'Payment']] : []),
        ...(fixture.crmId ? [[`/crm/${fixture.crmId}`, 'Linked business records']] : []),
        ['/contracts', 'Contracts'], ['/contracts?new=1', 'New Contract'],
        ['/document-templates', 'Document Templates'], ['/documents/generate', 'Generate Documents'],
        ...(fixture.generatedContractId ? [[`/documents/generate?contractId=${fixture.generatedContractId}`, 'Document history']] : []),
        ...(fixture.contractId ? [[`/contracts/${fixture.contractId}`, 'Legal parties']] : []),
        ...(fixture.importId ? [[`/contracts/import/${fixture.importId}`, 'Review imported contract']] : []),
        ['/companies', 'SKY TEST'], ['/counterparties', 'PACIFIC TEST SEAFOOD'], ['/products', 'Pacific Cod'], ['/business-cases', 'Updated fictional Deal'],
        [`/companies/${fixture.company}`, 'SKY TEST'], [`/counterparties/${fixture.parties[0]}`, 'PACIFIC TEST SEAFOOD'],
        [`/products/${fixture.products[0]}`, 'Pacific Cod'], [`/business-cases/${fixture.deal}`, 'Updated fictional Deal'],
        [`/business-cases/${fixture.deal}?tab=economics`, 'Company perspective'],
        ['/counterparties?new=1', 'New Counterparty'], ['/products?new=1', 'New Product'], ['/business-cases?new=1', 'New Deal'],
      ];
      for (const [route, marker] of ownRoutes) {
        console.log(`Checking authenticated core route: ${route}`);
        const response = await request(route, { headers: { cookie }, redirect: 'manual', signal: AbortSignal.timeout(90000) });
        const html = await response.text();
        check(response.status === 200 && html.includes(marker), `${fixture.user.tag} ${route}`);
        // The canonical profitability report is heavy: it must render only when the
        // Economics tab is actually requested, never on an ordinary Deal view.
        if (/^\/business-cases\/[0-9a-f-]{36}$/.test(route)) {
          check(!html.includes('Company perspective'), `${route} does not eagerly render Deal economics`);
        }
        check(!/permission denied for table|column [^<]* does not exist|Could not find[^<]*(?:schema cache|relationship)|Failed to load (?:companies|counterparties|products|business cases)|Unable to load operational records|schema is incomplete/i.test(html), `${route} schema/permission compatibility`);
      }
      const foreign = fixtures.find(row => row.company !== fixture.company);
      if (fixture.generatedDocumentId) {
        const output = await request(`/api/documents/generated/${fixture.generatedDocumentId}`, { headers: { cookie }, signal: AbortSignal.timeout(30000) });
        check(output.status === 200 && output.headers.get('content-type')?.includes('wordprocessingml.document'), 'retained DOCX HTTP download');
        fixture.user.load('src/lib/document-templates/docx-engine.ts').assertDocxIntegrity(await output.bytes());
      }
      if (foreign.generatedDocumentId) {
        const denied = await request(`/api/documents/generated/${foreign.generatedDocumentId}`, { headers: { cookie }, signal: AbortSignal.timeout(30000) });
        check(denied.status === 404, 'foreign generated DOCX HTTP download denied');
      }
      for (const route of [`/companies/${foreign.company}`, `/counterparties/${foreign.parties[0]}`, `/products/${foreign.products[0]}`, `/business-cases/${foreign.deal}`]) {
        const response = await request(route, { headers: { cookie }, redirect: 'manual', signal: AbortSignal.timeout(30000) });
        const html = await response.text();
        check(response.status === 404 || html.includes('NEXT_HTTP_ERROR_FALLBACK;404'), `${route} foreign detail hidden`);
      }
    }
    const anon = await request('/products', { redirect: 'manual', signal: AbortSignal.timeout(30000) });
    check([303,307].includes(anon.status) && anon.headers.get('location')?.includes('/login'), 'anonymous UI redirects to login');
    console.log('Core UI: authenticated list/detail/create SSR routes, joined data, bilateral foreign-detail denial and anonymous redirect passed. No browser was launched.');
  } finally {
    if (!exited) server.kill('SIGTERM');
    await Promise.race([stopped, new Promise((_,reject) => { const timer = setTimeout(() => reject(new Error('Owned core UI server did not stop')), 15000); timer.unref(); })]);
    for (const user of users) await user.client.auth.signOut();
    console.log('Stopped the owned isolated Next test server on port 55323.');
  }
}
