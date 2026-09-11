import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { verifyHistory, sha256 } from './history.mjs';
import { collectSourceContract } from './source-contract.mjs';
import { compareContract } from './compare.mjs';
import { verifyAuthHttp } from './auth-http.mjs';
import { verifyCoreHttp } from './core-http.mjs';
import { verifyCoreUi } from './core-ui.mjs';
import { verifyContractsHttp } from './contracts-http.mjs';
import { verifyDocumentsHttp } from './documents-http.mjs';
import { verifyOperationsHttp } from './operations-http.mjs';
import { verifyEconomicsHttp } from './economics-http.mjs';
import { verifyProfitabilityHttp } from './profitability-http.mjs';

// No connection-string, project-ref, workdir, or remote-target arguments accepted.
// Only this process's newly created, randomly named local Supabase is reachable.
if (process.argv.length !== 2) throw new Error('db:replay accepts no arguments');
const root = process.cwd();
const migrations = verifyHistory();
const contract = collectSourceContract(root);
if (contract.unresolved.length) throw new Error('Unresolved database usage. Run pnpm db:check.');
// CLI 2.115 truncates long project IDs in container names. Keep the entire
// identifier below that limit so discovery can verify the complete random ID.
const nonce = randomUUID().replaceAll('-', '').slice(0, 20);
const project = `sky-erp-replay-${nonce}`;
const workdir = path.join(root, '.db-replay', project);
let container;
const env = { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1' };
// Do not pass configured project credentials to child commands.
for (const key of Object.keys(env)) {
  if (/^(SUPABASE_|NEXT_PUBLIC_SUPABASE_|PG|DATABASE_URL)/.test(key) && key !== 'SUPABASE_TELEMETRY_DISABLED') delete env[key];
}
function run(command, args, input, quiet = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(`${command} ${args[0]} failed (${code}). ${quiet ? 'CLI output withheld because it may contain local credentials.' : stderr.slice(-12000)}`)));
    child.stdin.end(input);
  });
}
const sql = (query, quiet = false) => run('docker', ['exec', '-i', container, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], query, quiet);
let started = false;
let verifiedResult;
try {
  const version = (await run('supabase', ['--version'], undefined, true)).trim();
  if (version !== '2.115.0') throw new Error(`Replay requires Supabase CLI 2.115.0; found ${version}. Review platform upgrades explicitly.`);
  await run('docker', ['version', '--format', '{{.Server.Version}}']);
  fs.mkdirSync(path.join(root, '.db-replay'), { recursive: true });
  if (fs.lstatSync(path.join(root, '.db-replay')).isSymbolicLink()) throw new Error('Replay directory must not be a symlink');
  fs.mkdirSync(workdir); // Exclusive creation; never reuse an existing database.
  fs.mkdirSync(path.join(workdir, 'supabase'));
  const config = fs.readFileSync('supabase/replay/config.toml', 'utf8').replace('project_id = "sky-erp-replay"', `project_id = "${project}"`);
  fs.writeFileSync(path.join(workdir, 'supabase/config.toml'), config, { flag: 'wx' });
  console.log(`Starting fresh isolated Supabase: ${project} (ports 55320–55322).`);
  started = true; // Also clean up a partially started stack.
  await run('supabase', ['start', '--yes', '--agent', 'no', '--workdir', workdir], undefined, true);
  // Resolve only containers belonging to this unique test run; CLI releases may
  // change separators in names. Never inspect or target the existing local stack.
  const names = (await run('docker', ['ps', '--filter', 'publish=55322', '--format', '{{.Names}}'])).trim().split('\n');
  const databases = names.filter(name => /^supabase[_-]db[_-]/.test(name) && name.includes(nonce));
  if (databases.length !== 1) {
    throw new Error(`Expected one database container with this run's complete ID on port 55322; found ${databases.length}. Check CLI version and dedicated port availability. Startup output is withheld because it includes local credentials.`);
  }
  container = databases[0];
  const existing = JSON.parse(await sql("select coalesce(json_agg(tablename), '[]') from pg_tables where schemaname = 'public';"));
  if (existing.length) throw new Error(`Expected empty public schema, found: ${existing.join(', ')}`);
  fs.mkdirSync(path.join(workdir, 'supabase/migrations'));
  for (const migration of migrations) fs.writeFileSync(path.join(workdir, 'supabase/migrations', migration.name), migration.sql, { flag: 'wx' });
  console.log(`Replaying ${migrations.length} canonical migrations in timestamp order.`);
  await run('supabase', ['migration', 'up', '--local', '--yes', '--agent', 'no', '--workdir', workdir]);
  const catalog = JSON.parse(await sql(fs.readFileSync('supabase/replay/catalog.sql', 'utf8')));
  const expectedVersions = migrations.map(m => m.name.slice(0, 14));
  if (JSON.stringify(catalog.migrations) !== JSON.stringify(expectedVersions)) throw new Error('Applied migration ledger does not match the canonical chain');
  fs.writeFileSync(path.join(workdir, 'catalog.json'), JSON.stringify(catalog, null, 2));
  const rlsInventory = JSON.parse(await sql(fs.readFileSync('supabase/replay/rls-inventory.sql', 'utf8')));
  fs.writeFileSync(path.join(workdir, 'rls-inventory.json'), JSON.stringify(rlsInventory, null, 2));
  const errors = compareContract(contract, catalog);
  if (errors.length) throw new Error(`Application/schema mismatches:\n${JSON.stringify(errors, null, 2)}`);
  for (const name of ['companies', 'counterparties', 'products', 'contracts', 'payments']) {
    if (!catalog.rls.some(t => t.name === name && t.enabled)) throw new Error(`Foundational RLS missing: ${name}`);
  }
  console.log('Schema contract: zero missing tables, columns, embedded relationships, RPC signatures, or buckets.');
  await sql(fs.readFileSync('supabase/replay/schema-smoke.sql', 'utf8'));
  await sql(fs.readFileSync('supabase/replay/auth-rls.sql', 'utf8'));
  console.log('Auth/RLS: table grants, company isolation, authenticated CRUD, RPCs, Admin, readonly, disabled and anon assertions passed.');
  const localStatus = JSON.parse(await run('supabase', ['status', '--output', 'json', '--workdir', workdir], undefined, true));
  await verifyAuthHttp({ sql, publicKey: localStatus.ANON_KEY ?? localStatus.PUBLISHABLE_KEY ?? '' });
  const core = await verifyCoreHttp({ sql, publicKey: localStatus.ANON_KEY ?? localStatus.PUBLISHABLE_KEY ?? '' });
  await verifyContractsHttp(core);
  await verifyDocumentsHttp(core);
  await verifyOperationsHttp({ ...core, sql });
  await verifyEconomicsHttp({ ...core, sql });
  await verifyProfitabilityHttp({ ...core, sql });
  await verifyCoreUi({ ...core, publicKey: localStatus.ANON_KEY ?? localStatus.PUBLISHABLE_KEY ?? '' });
  verifiedResult = {
    status: 'PASS', cli: version, migrations: migrations.map(m => ({ name: m.name, sha256: sha256(m.sql) })),
    tablesChecked: contract.tables.length, selectsChecked: contract.selects.length,
    columnUsesChecked: contract.columns.length, rpcNamesChecked: [...new Set(contract.rpcs.map(r => r.name))],
    schemaSmoke: 'PASS', authRlsFunctionalTests: 'PASS', authHttpTests: 'PASS', coreCrudTests: 'PASS', coreUiHttpTests: 'PASS', contractsFunctionalTests: 'PASS', documentsFunctionalTests: 'PASS', operationsFunctionalTests: 'PASS', economicsPrerequisites: 'PASS', profitability: 'PASS',
  };
} catch (error) {
  console.error(error.message);
  console.error('FAIL: database replay is not verified. No PASS artifact was written.');
  process.exitCode = 1;
} finally {
  if (started) {
    try {
      // Only this fresh test stack. Keep its diagnostic files and volume backup;
      // no reset, database deletion, or changes to another local stack.
      await run('supabase', ['stop', '--yes', '--agent', 'no', '--workdir', workdir], undefined, true);
      const running = (await run('docker', ['ps', '--filter', `name=${nonce}`, '--format', '{{.Names}}'])).trim();
      if (running) throw new Error('Isolated containers are still running');
      console.log(`Stopped isolated stack ${project}. Local replay evidence retained.`);
    } catch {
      console.error(`Cleanup failed. Stop this test stack with: SUPABASE_TELEMETRY_DISABLED=1 supabase stop --workdir ${path.relative(root, workdir)}`);
      process.exitCode = 1;
    }
  }
}
if (verifiedResult && !process.exitCode) {
  fs.writeFileSync(path.join(workdir, 'result.json'), JSON.stringify(verifiedResult, null, 2));
  console.log(`PASS: clean replay, catalog comparison, rollback-only schema smoke tests, and stack cleanup. Evidence: ${path.relative(root, workdir)}`);
}
