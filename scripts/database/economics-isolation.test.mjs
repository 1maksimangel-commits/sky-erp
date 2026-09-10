import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

test('active AI and Contract Deal view do not call legacy profitability', () => {
  const ai = readFileSync('src/lib/platform/ai.ts','utf8');
  assert.match(ai, /Canonical Deal profitability is not available yet/);
  assert.doesNotMatch(ai, /Estimated profit:|Profit summary for|const profit\s*=/);
  const page = readFileSync('src/app/(erp)/contracts/[id]/business-case/page.tsx','utf8');
  assert.doesNotMatch(page, /getBusinessCaseProfitResult/);
  const component = readFileSync('src/components/contracts/ContractBusinessCaseTab.tsx','utf8');
  assert.doesNotMatch(component, /Profit result|profit\?\./);
  const reports = readFileSync('src/components/finance/ReportsView.tsx','utf8');
  assert.match(reports, />\s*Legacy reports — unverified until the Deal economics phase\./);
});

test('no new application consumer may use the deprecated profit calculators', () => {
  const allowed = new Set(['src/lib/finance/db.ts', 'src/app/(erp)/finance/reports/page.tsx']);
  function inspect(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = `${directory}/${entry.name}`;
      assert.equal(entry.isSymbolicLink(), false, `Do not follow source symlinks: ${file}`);
      if (entry.isDirectory()) inspect(file);
      else if (/\.tsx?$/.test(file) && !allowed.has(file)) {
        assert.doesNotMatch(readFileSync(file, 'utf8'), /\b(?:getFinanceReports|getBusinessCaseProfitResult)\b/, `Legacy profitability consumer: ${file}`);
      }
    }
  }
  inspect('src');
});
