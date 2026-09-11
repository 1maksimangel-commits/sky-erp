import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

test('active AI and Contract Deal view do not call legacy profitability', () => {
  const ai = readFileSync('src/lib/platform/ai.ts','utf8');
  // Phase 7 shipped the canonical engine: the assistant must point at it and still never compute profit itself.
  assert.match(ai, /Canonical Deal profitability is calculated by the Deal Economics tab/);
  assert.match(ai, /This assistant does not calculate profit/);
  assert.doesNotMatch(ai, /Estimated profit:|Profit summary for|const profit\s*=/);
  const page = readFileSync('src/app/(erp)/contracts/[id]/business-case/page.tsx','utf8');
  assert.doesNotMatch(page, /getBusinessCaseProfitResult/);
  const component = readFileSync('src/components/contracts/ContractBusinessCaseTab.tsx','utf8');
  assert.doesNotMatch(component, /Profit result|profit\?\./);
  const reports = readFileSync('src/components/finance/ReportsView.tsx','utf8');
  assert.match(reports, />\s*Legacy reports — superseded by canonical Deal economics\./);
  assert.match(reports, /use the Deal Economics tab for profitability/);
});

test('no new application consumer may use the deprecated profit calculators', () => {
  const allowed = new Set(['src/lib/finance/db.ts', 'src/app/(erp)/finance/reports/page.tsx']);
  function inspect(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = `${directory}/${entry.name}`;
      assert.equal(entry.isSymbolicLink(), false, `Do not follow source symlinks: ${file}`);
      if (entry.isDirectory()) inspect(file);
      else if (/\.tsx?$/.test(file) && !allowed.has(file)) {
        assert.doesNotMatch(readFileSync(file, 'utf8'), /\b(?:getFinanceReports|getBusinessCaseProfitResult|buildExpectedFinanceSummary)\b/, `Legacy profitability consumer: ${file}`);
      }
    }
  }
  inspect('src');
});

test('exactly one canonical profitability engine, and it never uses Number money', () => {
  const engines = [];
  function inspect(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = `${directory}/${entry.name}`;
      assert.equal(entry.isSymbolicLink(), false, `Do not follow source symlinks: ${file}`);
      if (entry.isDirectory()) inspect(file);
      else if (/\.tsx?$/.test(file) && /export function calculateDealProfitability\b/.test(readFileSync(file, 'utf8'))) engines.push(file);
    }
  }
  inspect('src');
  assert.deepEqual(engines, ['src/lib/finance/profitability-engine.ts'], 'There must be exactly one canonical profitability engine.');
  for (const file of ['src/lib/finance/profitability-engine.ts', 'src/lib/finance/exact.ts']) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /\b(?:parseFloat|parseInt|toFixed)\s*\(|\bNumber\s*\(|\bMath\./, `Floating-point money in canonical engine: ${file}`);
  }
});
