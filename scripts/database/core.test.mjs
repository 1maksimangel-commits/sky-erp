import test from 'node:test';
import assert from 'node:assert/strict';
import { coreSource } from './core-source.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const load = coreSource(null);
const v = load('src/lib/core/validation.ts');
test('replay loopback endpoint is allowed only in development/test, never production', () => {
  const compile = file => ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const keyContext = { exports: {}, atob };
  vm.runInNewContext(compile('src/lib/supabase/public-key.ts'), keyContext);
  for (const mode of ['development','test','production']) {
    const context = { exports: {}, require: () => keyContext.exports, process: { env: { NODE_ENV: mode, NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55321', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fictional_test' } } };
    vm.runInNewContext(compile('src/lib/supabase/env.ts'), context);
    assert.equal(context.exports.getSupabasePublicEnv().ok, mode !== 'production');
  }
});
test('line amounts use decimal rounding and separate currency amounts', () => {
  assert.equal(v.lineAmount(3, 0.1), 0.3);
  assert.equal(v.lineAmount(1, 1.005), 1.01);
  assert.equal(v.lineAmount(12.5, 23.45), 293.13);
  assert.equal(v.lineAmount(0.0000001, 10000000), 1);
  assert.equal(v.lineAmount(3, null), null);
  for (const bad of [-1, NaN, Infinity, 1e10]) assert.throws(() => v.lineAmount(bad, 1));
});
test('core validation rejects blank names, foreign-key text and invalid values', () => {
  const product = load('src/lib/products/types.ts').emptyProductForm();
  assert.equal(v.productInputSchema.safeParse(product).success, false);
  assert.equal(v.productInputSchema.safeParse({ ...product, name: 'Pacific Cod', gross_weight: 1, net_weight: 2 }).success, false);
  assert.equal(v.productInputSchema.safeParse({ ...product, name: 'Pacific Cod', purchase_price: -1 }).success, false);
  assert.equal(v.productInputSchema.safeParse({ ...product, name: 'Pacific Cod', currency: 'dollars' }).success, false);
  assert.equal(v.uuid.safeParse('Pacific Test Seafood').success, false);
  const validate = load('src/lib/deals/validation.ts').validateDealProduct;
  assert.ok(validate({ business_case_id: 'invalid' }));
});
