import test from 'node:test';
import assert from 'node:assert/strict';
import { compareContract, splitSelect } from './compare.mjs';

const column = (table_name, column_name, options = {}) => ({ table_name, column_name, nullable: true, default_value: null, ...options });
const catalog = () => ({
  columns: [column('contracts', 'id', { nullable: false, default_value: 'gen_random_uuid()' }), column('contracts', 'company_id'), column('companies', 'id'), column('companies', 'name')],
  foreignKeys: [{ name: 'contracts_company_id_fkey', source: 'contracts', target: 'companies', columns: ['company_id'], target_columns: ['id'], validated: true }],
  functions: [{ name: 'test_rpc', args: ['required', 'optional'], required: 1 }],
  buckets: ['documents'],
});
const contract = () => ({ tables: ['contracts'], selects: [{ table: 'contracts', select: 'id, company:company_id(id,name)' }], columns: [], writes: [], rpcs: [{ name: 'test_rpc', args: ['required'] }], buckets: ['documents'], unresolved: [] });

test('resolves aliases, named FK hints, and reverse embedded relationships', () => {
  const c = contract();
  c.selects.push({ table: 'contracts', select: 'company:companies!contracts_company_id_fkey(id)' });
  c.selects.push({ table: 'companies', select: 'contracts(id)' });
  assert.deepEqual(compareContract(c, catalog()), []);
  assert.deepEqual(splitSelect('id,company:companies(id,name),amount'), ['id', 'company:companies(id,name)', 'amount']);
});

test('fails on removed table, column, FK, RPC, and bucket', () => {
  const db = catalog();
  db.columns = db.columns.filter(c => c.table_name !== 'contracts' && c.column_name !== 'name');
  db.foreignKeys = [];
  db.functions = [];
  db.buckets = [];
  const kinds = new Set(compareContract(contract(), db).map(e => e.kind));
  for (const kind of ['table', 'column', 'relationship', 'rpc', 'bucket']) assert.ok(kinds.has(kind), kind);
});

test('fails on ambiguous or unvalidated joins and RPC argument drift', () => {
  const db = catalog();
  db.foreignKeys.push({ ...db.foreignKeys[0], name: 'duplicate_fk' });
  db.functions[0].args = ['renamed'];
  let errors = compareContract(contract(), db);
  assert.ok(errors.some(e => e.kind === 'relationship'));
  assert.ok(errors.some(e => e.kind === 'rpc'));
  db.foreignKeys = [{ ...db.foreignKeys[0], validated: false }];
  errors = compareContract(contract(), db);
  assert.ok(errors.some(e => e.kind === 'relationship'));
});

test('fails when an insert omits a required column without a default', () => {
  const db = catalog(), c = contract();
  db.columns.push(column('contracts', 'contract_number', { nullable: false }));
  c.writes.push({ table: 'contracts', keys: ['company_id'] });
  assert.ok(compareContract(c, db).some(e => e.kind === 'required insert column'));
});

test('unresolved source never counts as a successful comparison', () => {
  const c = contract();
  c.unresolved.push({ kind: 'dynamic table', at: 'fixture.ts:1' });
  assert.ok(compareContract(c, catalog()).some(e => e.kind === 'unresolved source'));
  assert.throws(() => splitSelect('id,company(id'), /Malformed/);
});
