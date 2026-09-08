import fs from 'node:fs';
import crypto from 'node:crypto';

export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
export function migrationFiles() {
  return fs.readdirSync('supabase/migrations').sort().map(name => {
    if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(name)) throw new Error(`Invalid migration filename: ${name}`);
    const file = `supabase/migrations/${name}`;
    if (!fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()) throw new Error(`Not a regular migration: ${file}`);
    return { name, file, sql: fs.readFileSync(file, 'utf8') };
  });
}
export function verifyHistory() {
  const lock = JSON.parse(fs.readFileSync('supabase/history-lock.json', 'utf8'));
  const files = migrationFiles();
  if (new Set(files.map(f => f.name.slice(0, 14))).size !== files.length) throw new Error('Duplicate migration timestamp');
  const recoveredPrerequisites = new Set([
    '20260804120000_foundational_prerequisites.sql',
    '20260804135000_business_case_contract_prerequisite.sql',
    '20260831045000_timeline_deal_prerequisite.sql',
  ]);
  for (const file of files) {
    if (file.name.slice(0, 14) <= '20260903180000' && !lock.migrations[file.name] && !recoveredPrerequisites.has(file.name)) {
      throw new Error(`Unreviewed insertion into frozen history: ${file.name}`);
    }
  }
  for (const [name, hash] of Object.entries(lock.migrations)) {
    const migration = files.find(f => f.name === name);
    if (!migration || sha256(migration.sql) !== hash) throw new Error(`Preserved migration changed or missing: ${name}`);
  }
  for (const [file, hash] of Object.entries(lock.reviewedSources)) {
    if (sha256(fs.readFileSync(file)) !== hash) throw new Error(`Re-review dynamic database usage before updating its checksum: ${file}`);
  }
  return files;
}
