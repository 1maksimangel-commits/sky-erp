import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/finance/decimal.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const decimal = context.exports.moneyDecimal;

test('money persistence rounds decimal ties exactly as PostgreSQL numeric', () => {
  for (const [input, expected] of [[10.075, '10.08'], [1.005, '1.01'], [-10.075, '-10.08'],
    [2851.2, '2851.20'], [0, '0.00'], [-0.001, '0.00'], ['9007199254740993.125', '9007199254740993.13'],
    ['1.005e2', '100.50'], [1e-7, '0.00'], ['1e3', '1000.00']]) assert.equal(decimal(input), expected);
  assert.notEqual(Math.round((10.075 + Number.EPSILON) * 100) / 100, Number(decimal(10.075)), 'Regression reproduces the former binary rounding defect');
});

test('invalid monetary input is rejected, never silently converted to zero', () => {
  for (const input of [NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '', 'NaN', '1,000', '0x10', '1e999999', 'bad']) assert.throws(() => decimal(input));
});

test('operational money removes floating tails while rates and quantities retain explicit precision', () => {
  assert.equal(decimal(0.1 + 0.2), '0.30');
  assert.equal(context.exports.basisDecimal('0.000125'), '0.000125000000');
  assert.equal(context.exports.basisDecimal('95.040000000001'), '95.040000000001');
  assert.equal(context.exports.basisDecimal('1.1234567890125'), '1.123456789013');
  assert.throws(() => context.exports.basisDecimal(Number.MAX_SAFE_INTEGER + 1));
});

test('payment and opening-balance persistence use decimal text and SQL balance validation', () => {
  const actions = fs.readFileSync('src/lib/finance/actions.ts', 'utf8');
  assert.match(actions, /amount = moneyDecimal\(input.amount\)/);
  assert.match(actions, /opening = moneyDecimal\(normalized.opening_balance\)/);
  assert.doesNotMatch(actions, /roundMoney|outstanding\s*\+\s*0\.0001/);
});
