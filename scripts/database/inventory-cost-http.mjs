import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Fictional only. Called after Phase 6 inside the isolated canonical replay.
export async function verifyInventoryCostHttp({ users, fixtures }) {
  const [admin, a, b] = users, [fa, fb] = fixtures;
  const location = randomUUID(), dock = randomUUID();
  const ok = (result, label) => { assert.equal(result.error, null, `${label}: ${result.error?.message}`); return result.data; };
  ok(await a.client.from('warehouse_locations').insert([
    { id: location, company_id: fa.company, code: 'COST-SHARED', name: 'Fictional cost shared warehouse' },
    { id: dock, company_id: fa.company, code: 'COST-DOCK', name: 'Fictional cost transfer dock' },
  ]), 'create warehouses');
  ok(await admin.client.from('warehouse_company_access').insert({ warehouse_id: location, company_id: fb.company }), 'share location');
  ok(await a.client.from('products').update({ unit: 'MT' }).eq('id', fa.products[0]), 'fictional MT unit');
  const input = { company_id: fa.company, warehouse_id: location, product_id: fa.products[0], quantity: '100', lot_number: 'COST-A', unit_cost: '1234.56', currency: 'USD', contract_id: fa.contractId, business_case_id: fa.deal };
  const receipt = await a.load('src/lib/warehouse/cost-actions.ts').receiveCostedInventory(input);
  assert.equal(receipt.success, true, receipt.error);
  assert.equal((await a.load('src/lib/warehouse/cost-actions.ts').receiveCostedInventory({ ...input, lot_number: 'UNREGISTERED-CURRENCY', quantity: '1', currency: 'ZZZ' })).success, false, 'unregistered acquisition currency rejected by FK');
  const movement = { p_company_id: fa.company, p_warehouse_id: location, p_product_id: fa.products[0], p_quantity: '-40', p_lot_number: 'COST-A', p_movement_type: 'outbound', p_contract_id: fa.contractId, p_business_case_id: fa.deal };
  const release = ok(await a.client.rpc('warehouse_post_movement', movement), 'release 40 MT');
  const costInput = async (user, id) => ok(await user.load('src/lib/warehouse/cost-actions.ts').getInventoryCostInput(id), 'exact cost input');
  const receiptInput = await costInput(a, receipt.id), releaseInput = await costInput(a, release);
  assert.equal(receiptInput.cost_amount, '123456.00');
  assert.equal(releaseInput.cost_amount, '-49382.40');
  assert.equal(releaseInput.quantity, '-40');
  assert.equal(releaseInput.unit_cost, '1234.56');
  assert.equal(releaseInput.remaining_quantity, '60');
  assert.equal(releaseInput.remaining_cost_amount, '74073.60');
  const getLot = async (client, company, warehouse, number) => {
    const inventory = ok(await client.from('inventory').select('id').eq('company_id', company).eq('warehouse_id', warehouse).eq('product_id', fa.products[0]).single(), 'inventory');
    return ok(await client.from('inventory_lots').select('id, quantity').eq('inventory_id', inventory.id).eq('lot_number', number).single(), 'lot');
  };
  let lotA = await getLot(a.client, fa.company, location, 'COST-A');
  assert.equal(String(lotA.quantity), '60'); assert.equal((await costInput(a, receipt.id)).lot_unit_cost, '1234.56');
  const second = await admin.load('src/lib/warehouse/cost-actions.ts').receiveCostedInventory({ ...input, company_id: fb.company, contract_id: fb.contractId, lot_number: 'COST-B', quantity: '20', unit_cost: '1500' });
  assert.equal(second.success, true, second.error);
  const lotB = await getLot(b.client, fb.company, location, 'COST-B');
  assert.equal(String(lotB.quantity), '20'); assert.equal((await costInput(b, second.id)).lot_unit_cost, '1500');
  assert.equal(await costInput(a, second.id), null, 'foreign cost DTO hidden by RLS');
  assert.equal(await costInput(b, receipt.id), null, 'foreign cost DTO hidden bilaterally');
  const physical = ok(await admin.client.from('inventory').select('quantity').eq('warehouse_id', location).eq('product_id', fa.products[0]), 'physical stock');
  assert.equal(physical.reduce((sum, row) => sum + Number(row.quantity), 0), 80);
  for (const [user, foreign] of [[a, lotB], [b, lotA]]) {
    assert.equal(ok(await user.client.from('inventory_lots').select('id').eq('id', foreign.id), 'private cost').length, 0);
  }
  assert.ok((await b.client.rpc('warehouse_post_movement', { ...movement, p_quantity: '-1' })).error, 'foreign release denied');
  assert.ok((await a.client.from('inventory_lots').update({ acquisition_unit_cost: '1' }).eq('id', lotA.id)).error, 'lot recost denied');
  assert.ok((await a.client.from('stock_movements').update({ cost_unit_amount: '1' }).eq('id', release)).error, 'historical cost change denied');
  assert.equal((await a.load('src/lib/warehouse/cost-actions.ts').receiveCostedInventory({ ...input, quantity: '1', unit_cost: '2000' })).success, false, 'different cost requires another lot');
  assert.ok((await a.client.rpc('warehouse_post_movement', { ...movement, p_quantity: '1', p_movement_type: 'inbound' })).error, 'uncosted receipt cannot silently dilute costed lot');
  assert.ok((await a.client.from('stock_movements').insert({ company_id: fa.company, warehouse_id: location, product_id: fa.products[0], lot_number: 'COST-A', quantity: '-1', movement_type: 'outbound', cost_unit_amount: '1', cost_currency: 'USD' })).error, 'raw release cannot forge cost');
  assert.equal((await a.load('src/lib/warehouse/cost-actions.ts').receiveCostedInventory({ ...input, lot_number: 'COST-A-SECOND', quantity: '2', unit_cost: '2000' })).success, true, 'distinct lot retains distinct acquisition');
  const transfer = { p_company_id: fa.company, p_from_location: location, p_to_location: dock, p_product_id: fa.products[0], p_quantity: '10', p_lot_number: 'COST-A' };
  ok(await a.client.rpc('warehouse_transfer_owned', transfer), 'costed transfer');
  const target = await getLot(a.client, fa.company, dock, 'COST-A');
  assert.equal(String(target.quantity), '10');
  const transferred = ok(await a.client.from('stock_movements').select('id, cost_transfer_source_id').eq('warehouse_id', dock).eq('lot_number', 'COST-A').single(), 'paired transfer snapshot');
  const transferInput = await costInput(a, transferred.id);
  assert.ok(transferred.cost_transfer_source_id); assert.equal(transferInput.cost_amount, '12345.60');
  assert.equal(transferInput.lot_unit_cost, '1234.56');
  assert.ok((await a.client.rpc('warehouse_transfer_owned', { ...transfer, p_quantity: '-1' })).error, 'negative transfer rejected');
  assert.ok((await b.client.rpc('warehouse_transfer_owned', transfer)).error, 'foreign costed transfer rejected');
  assert.ok((await a.client.from('stock_movements').insert({ company_id: fa.company, warehouse_id: dock, product_id: fa.products[0], quantity: '10', lot_number: 'COST-A', movement_type: 'transfer', cost_transfer_source_id: transferred.cost_transfer_source_id })).error, 'transfer source cannot be duplicated');
  assert.equal(String((await getLot(a.client, fa.company, dock, 'COST-A')).quantity), '10', 'failed duplicate rolls quantity back');
  ok(await a.client.rpc('warehouse_transfer_owned', { ...transfer, p_from_location: dock, p_to_location: location }), 'return transfer');
  lotA = await getLot(a.client, fa.company, location, 'COST-A');
  assert.equal(String(lotA.quantity), '60'); assert.equal((await costInput(a, receipt.id)).lot_unit_cost, '1234.56');
  const unknown = ok(await a.client.rpc('warehouse_post_movement', { ...movement, p_quantity: '1', p_movement_type: 'inbound', p_lot_number: 'UNKNOWN' }), 'legacy-compatible unknown cost');
  const unknownRow = await costInput(a, unknown);
  assert.equal(unknownRow.cost_amount, null); assert.equal(unknownRow.currency, null); assert.equal(unknownRow.cost_known, false);
  assert.equal((await a.load('src/lib/warehouse/cost-actions.ts').receiveCostedInventory({ ...input, lot_number: 'UNKNOWN', quantity: '1' })).success, false, 'no retrospective guess for unknown lot');
  const precise = await a.load('src/lib/warehouse/cost-actions.ts').receiveCostedInventory({ ...input, lot_number: 'EXACT-DECIMAL', quantity: '1', unit_cost: '9007199254740993.123456789' });
  assert.equal(precise.success, true, precise.error);
  const preciseInput = await costInput(a, precise.id);
  assert.equal(preciseInput.unit_cost, '9007199254740993.123456789');
  assert.equal(preciseInput.cost_amount, '9007199254740993.123456789');
  assert.equal(preciseInput.remaining_cost_amount, '9007199254740993.123456789');
  const preciseRelease = ok(await a.client.rpc('warehouse_post_movement', { ...movement, p_quantity: '-0.000000001', p_lot_number: 'EXACT-DECIMAL' }), 'precise partial release');
  const preciseReleaseInput = await costInput(a, preciseRelease);
  assert.equal(preciseReleaseInput.quantity, '-0.000000001');
  assert.equal(preciseReleaseInput.cost_amount, '-9007199.254740993123456789');
  assert.equal(preciseReleaseInput.remaining_quantity, '0.999999999');
  console.log('Inventory costing: immutable specific-lot basis, A100−40=60, B20 separate, exact numeric costs, explicit transfer carry, unknown legacy costs and authenticated tamper/isolation checks passed.');
}
