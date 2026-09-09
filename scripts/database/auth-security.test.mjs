import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    assert(!entry.isSymbolicLink(), `Symlink not allowed in security scan: ${entry.name}`);
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}
const sources = files('src').filter(file => /\.[jt]sx?$/.test(file));
const source = file => fs.readFileSync(file, 'utf8');
const compiled = file => ts.transpileModule(source(file), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

test('public key guard accepts public keys and rejects privileged JWTs, secret keys and malformed values', () => {
  const context = { exports: {}, atob };
  vm.runInNewContext(compiled('src/lib/supabase/public-key.ts'), context);
  const valid = context.exports.isPublicSupabaseKey;
  const jwt = role => ['e30', Buffer.from(JSON.stringify({ role })).toString('base64url'), 'fictional'].join('.');
  assert.equal(valid('sb_publishable_fictional_test'), true);
  assert.equal(valid(jwt('anon')), true);
  for (const key of ['', 'garbage', 'sb_secret_fictional_test', jwt('service_role'), jwt('authenticated'), 'e30.not-json.fake']) {
    assert.equal(valid(key), false, 'Non-public key accepted (value withheld)');
  }
});

test('browser dependency graph cannot include server credentials or server-only code', () => {
  const visited = new Set();
  function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);
    const text = compiled(file);
    if (/^[\s\S]*?"use server";/.test(text) && /^(?:\s|\/\/[^\n]*\n)*["']use server["']/.test(source(file))) return;
    assert(!/require\(["']server-only["']\)/.test(text), `Server-only module in browser graph: ${file}`);
    assert(!/process\.env(?:\.|\[)[^\n;]*(?:SERVICE_ROLE|SECRET|PRIVATE_KEY)/.test(text), `Privileged env access in browser graph: ${file}`);
    for (const match of text.matchAll(/require\(["']([^"']+)["']\)/g)) {
      const specifier = match[1];
      if (!specifier.startsWith('.') && !specifier.startsWith('@/')) continue;
      const base = specifier.startsWith('@/') ? path.join('src', specifier.slice(2)) : path.join(path.dirname(file), specifier);
      const target = [base, ...['.ts','.tsx','.js','.jsx','/index.ts','/index.tsx'].map(ext => base + ext)].find(candidate => sources.includes(candidate));
      if (target) visit(target);
    }
  }
  sources.filter(file => /^["']use client["']/.test(source(file).trimStart())).forEach(visit);
  visit('src/lib/supabase/client.ts');
  assert(visited.size > 50, 'Browser graph unexpectedly empty');
});

test('all Supabase client factories use validated public configuration; no local auth bypass', () => {
  const factories = new Set(['src/lib/supabase/client.ts','src/lib/supabase/server.ts','src/proxy.ts']);
  for (const file of sources) {
    const text = source(file);
    if (/from\s+["']@supabase\/(ssr|supabase-js)["']/.test(text)) {
      assert(factories.has(file), `Unreviewed Supabase factory: ${file}`);
      assert(text.includes('getSupabasePublicEnv'), `Missing public key validation: ${file}`);
      assert(text.includes('publishableKey'), `Missing public key use: ${file}`);
    }
    assert(!text.includes('SKY_ACTIVE_COMPANY_ID'), `Legacy environment authorization: ${file}`);
    assert(!/process\.env\.[A-Z_]*(?:SERVICE_ROLE|SUPABASE_SECRET)/.test(text), `Unreviewed privileged credential use: ${file}`);
  }
  assert(source('src/lib/platform/permissions.ts').includes('client.auth.getUser()'));
  assert(source('src/lib/platform/permissions.ts').includes('"authorize_permission"'));
  assert(source('src/proxy.ts').includes('client.auth.getUser()'));
  assert(source('src/lib/auth/actions.ts').includes('signInWithPassword'));
  assert(source('src/lib/auth/actions.ts').includes('client.auth.signOut()'));
});

test('built browser chunks contain no privileged keys', { skip: !process.argv.includes('--bundle') }, () => {
  const chunks = files('.next/static').filter(file => file.endsWith('.js'));
  assert(chunks.length > 0, 'Build browser chunks before checking exposure');
  for (const file of chunks) {
    const text = source(file);
    assert(!/sb_secret_[A-Za-z0-9_-]{15,}/.test(text), `Secret key detected in ${file} (value withheld)`);
    for (const match of text.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
      let payload;
      try { payload = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8')); } catch { continue; }
      assert(payload.role !== 'service_role', `Privileged JWT detected in ${file} (value withheld)`);
    }
  }
});
