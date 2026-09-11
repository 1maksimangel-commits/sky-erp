import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function compile(file, dependencies = {}) {
  const context = { exports: {}, require: name => { if (!(name in dependencies)) throw new Error('Unexpected dependency ' + name); return dependencies[name]; }, process: { env: {} } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return { module: context.exports, context };
}
const publicKey = compile('src/lib/supabase/public-key.ts').module;

/** Load the environment guard with an explicit fictional process.env. */
function withEnv(env) {
  const loaded = compile('src/lib/supabase/env.ts', { './public-key': publicKey });
  loaded.context.process.env = env;
  return loaded.module.getSupabasePublicEnv();
}
const validUrl = 'https://fictionalproject.supabase.co';
const validKey = 'sb_publishable_FICTIONALRELEASEKEYVALUE';

test('deployment refuses to start against a misconfigured or unsafe environment', () => {
  assert.equal(withEnv({ NEXT_PUBLIC_SUPABASE_URL: validUrl, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: validKey }).ok, true);
  assert.match(withEnv({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: validKey }).error, /NEXT_PUBLIC_SUPABASE_URL is missing/);
  assert.match(withEnv({ NEXT_PUBLIC_SUPABASE_URL: validUrl }).error, /PUBLISHABLE_KEY is missing/);
  assert.match(withEnv({ NEXT_PUBLIC_SUPABASE_URL: 'not a url', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: validKey }).error, /malformed or points at a disallowed local endpoint/);
  // A production build must never reach a developer's local database.
  assert.match(withEnv({ NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: validKey, NODE_ENV: 'production' }).error, /disallowed local endpoint/);
  assert.equal(withEnv({ NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: validKey, NODE_ENV: 'development' }).ok, true);
});

test('a secret key can never be handed to the browser client', () => {
  for (const secret of ['service_role', 'sb_secret_FICTIONALVALUE', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.fictional']) {
    const result = withEnv({ NEXT_PUBLIC_SUPABASE_URL: validUrl, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secret });
    assert.equal(result.ok, false, `secret-shaped key accepted: ${secret.slice(0, 12)}`);
  }
});

test('release limitations are recorded, not merely known', () => {
  const signoff = fs.readFileSync('knowledge/Development/ReleaseQualification.md', 'utf8');
  assert.match(signoff, /PDF/, 'PDF status must be declared');
  assert.match(signoff, /PARTIAL/, 'PDF must be recorded as an accepted PARTIAL limitation');
  assert.match(signoff, /25,000|25000/, 'the golden consolidated result must be recorded');
  assert.match(signoff, /Known limitations/i, 'a known-limitations section is required');
});

test('no secret material is committed to the repository', () => {
  const ignore = fs.readFileSync('.gitignore', 'utf8');
  assert.match(ignore, /^\.env\*/m, 'environment files must stay untracked');
});
