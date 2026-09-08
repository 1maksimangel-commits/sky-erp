import { collectSourceContract } from './source-contract.mjs';
import fs from 'node:fs';
import { migrationFiles, sha256, verifyHistory } from './history.mjs';

// Read-only inventory for a human-reviewed checksum update. Never invoked by CI.
if (process.argv.includes('--inventory')) {
  console.log(JSON.stringify({
    migrations: Object.fromEntries(migrationFiles().filter(f => f.name !== '20260804120000_foundational_prerequisites.sql' && f.name !== '20260804135000_business_case_contract_prerequisite.sql' && f.name !== '20260831045000_timeline_deal_prerequisite.sql' && f.name.slice(0, 14) <= '20260903180000').map(f => [f.name, sha256(f.sql)])),
    reviewedSources: Object.fromEntries(['src/lib/logistics/db.ts', 'src/lib/documents/db.ts', 'src/lib/platform/ai.ts'].map(file => [file, sha256(fs.readFileSync(file))])),
  }, null, 2));
  process.exit(0);
}

const migrations = verifyHistory();
console.log(`Migration inventory: ${migrations.length}; historical checksums intact.`);

const contract = collectSourceContract();
console.log(`Application inventory: ${contract.tables.length} tables, ${contract.selects.length} selects, ${contract.columns.length} column uses, ${contract.writes.length} writes, ${new Set(contract.rpcs.map(r => r.name)).size} RPCs.`);
if (contract.unresolved.length) {
  console.error(JSON.stringify(contract.unresolved, null, 2));
  process.exitCode = 1;
} else {
  console.log('Source extraction complete. Database consistency requires db:replay.');
}
