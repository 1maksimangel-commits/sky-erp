import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Called only inside the isolated canonical replay. Real server actions + RLS.
export async function verifyWarehouseHttp({ users, fixtures }) {
  const [admin, a, b] = users;
  const [fa, fb] = fixtures;
  assert.equal((await a.client.from('products').update({ unit: 'MT' }).eq('id', fa.products[0])).error, null, 'Explicit fictional MT stock unit');
  const must = (result, label) => { assert.equal(result.success, true, `${label}: ${result.error || ''}`); return result.id; };
  const location = randomUUID(), otherLocation = randomUUID();
  let result = await a.client.from('warehouse_locations').insert([
    { id: location, company_id: fa.company, code: 'OPS-WH', name: 'Fictional shared cold store' },
    { id: otherLocation, company_id: fa.company, code: 'OPS-DOCK', name: 'Fictional dock' },
  ]);
  assert.equal(result.error, null, 'Create owned warehouse locations');
  result = await admin.client.from('warehouse_company_access').insert({ warehouse_id: location, company_id: fb.company });
  assert.equal(result.error, null, 'Admin explicitly assigns shared physical warehouse');
  const actions = a.load('src/lib/warehouse/actions.ts');
  const input = { company_id: fa.company, warehouse_id: location, product_id: fa.products[0], quantity: 100, lot_number: 'OPS-LOT', production_date: null, expiry_date: null, reference: 'Fictional warehouse receipt', contract_id: fa.contractId, business_case_id: fa.deal, shipment_id: fa.shipmentId || null };
  const receipt = must(await actions.receiveInventory(input), 'Receive 100 MT');
  const release = must(await actions.issueInventory({ ...input, quantity: 35 }), 'Release 35 MT');
  const readBalance = async (client, company) => {
    const read = await client.from('inventory').select('id, quantity, available_quantity, company_id, unit').eq('company_id', company).eq('warehouse_id', location).eq('product_id', fa.products[0]).single();
    assert.equal(read.error, null); return read.data;
  };
  assert.equal(Number((await readBalance(a.client, fa.company)).quantity), 65);
  assert.equal((await readBalance(a.client, fa.company)).unit, 'MT');
  // Same warehouse AND same Product ID; only economic owner differs.
  must(await admin.load('src/lib/warehouse/actions.ts').receiveInventory({ ...input, company_id: fb.company, contract_id: fb.contractId, quantity: 20, shipment_id: null }), 'Receive same Product for B');
  assert.equal(Number((await readBalance(a.client, fa.company)).quantity), 65);
  assert.equal(Number((await readBalance(b.client, fb.company)).quantity), 20);
  const physical = await admin.client.from('inventory').select('quantity').eq('warehouse_id', location).eq('product_id', fa.products[0]);
  assert.equal(physical.error, null);
  assert.equal(physical.data.reduce((total, item) => total + Number(item.quantity), 0), 85);
  assert.equal((await b.client.from('products').select('id').eq('id', fa.products[0])).data.length, 0, 'Shared stock does not reveal private Product master');
  const bBoard = await b.load('src/lib/warehouse/db.ts').getWarehouseBoard();
  assert.equal(bBoard.error, null);
  assert.ok(bBoard.data.some(item => item.product_id === fa.products[0] && item.product?.name && item.company_id === fb.company), 'Owned stock keeps receipt Product label without exposing master');
  assert.equal((await b.client.from('warehouse_company_access').insert({ warehouse_id: otherLocation, company_id: fb.company })).error?.code, '42501');
  for (const [user, owner] of [[a, fb.company], [b, fa.company]]) {
    const read = await user.client.from('inventory').select('id').eq('company_id', owner);
    assert.equal(read.error, null); assert.equal(read.data.length, 0, 'Private owner inventory isolation');
    assert.equal((await user.load('src/lib/warehouse/actions.ts').issueInventory({ ...input, company_id: owner, quantity: 1 })).success, false, 'Foreign owner movement denied');
  }
  assert.equal((await actions.issueInventory({ ...input, quantity: 66 })).success, false, 'Negative stock denied');
  const competing = await Promise.all([actions.issueInventory({ ...input, quantity: 40 }), actions.issueInventory({ ...input, quantity: 40 })]);
  assert.equal(competing.filter(item => item.success).length, 1, 'Concurrent issues cannot oversell 65 MT');
  must(await actions.receiveInventory({ ...input, quantity: 40 }), 'Return fictional concurrency release');
  assert.equal((await actions.receiveInventory({ ...input, quantity: -1 })).success, false, 'Negative receipt denied');
  const inv = await readBalance(a.client, fa.company);
  assert.equal((await a.client.from('inventory').update({ quantity: 999, available_quantity: 999 }).eq('id', inv.id)).error?.code, '42501', 'Manual balance edit denied');
  assert.equal((await a.client.from('stock_movements').delete().eq('id', receipt)).error?.code, '42501', 'Movement history retained');
  assert.equal((await a.client.from('stock_movements').update({ quantity: 999 }).eq('id', release)).error?.code, '42501', 'Movement immutable');
  const reservation = await a.client.from('inventory_reservations').insert({ inventory_id: inv.id, company_id: fa.company, quantity: 60 }).select('id').single();
  assert.equal(reservation.error, null);
  assert.equal((await actions.issueInventory({ ...input, quantity: 6 })).success, false, 'Reserved stock cannot be released');
  assert.equal((await a.client.from('inventory_reservations').update({ status: 'Released' }).eq('id', reservation.data.id)).error, null);
  assert.equal(Number((await readBalance(a.client, fa.company)).available_quantity), 65, 'Reservation release restores availability');
  const trace = await a.client.from('stock_movements').select('company_id, business_case_id, contract_id, quantity').in('id', [receipt, release]);
  assert.equal(trace.error, null); assert.equal(trace.data.length, 2);
  assert.ok(trace.data.every(item => item.company_id === fa.company && item.business_case_id === fa.deal && item.contract_id === fa.contractId));
  assert.equal((await actions.receiveInventory({ ...input, business_case_id: fb.deal, quantity: 1 })).success, false, 'Deal/Contract graft rejected');
  must(await actions.transferInventory({ ...input, from_location: location, to_location: otherLocation, quantity: 5, transfer_date: '2026-09-10' }), 'Atomic transfer');
  assert.equal(Number((await readBalance(a.client, fa.company)).quantity), 60);
  must(await actions.transferInventory({ ...input, from_location: otherLocation, to_location: location, quantity: 5, transfer_date: '2026-09-10' }), 'Return transfer');
  must(await actions.adjustInventory({ ...input, quantity: 1, reason: 'Fictional count adjustment' }), 'Positive adjustment');
  must(await actions.adjustInventory({ ...input, quantity: -1, reason: 'Fictional correcting adjustment' }), 'Negative adjustment');
  assert.equal(Number((await readBalance(a.client, fa.company)).quantity), 65);
  const board = await a.load('src/lib/warehouse/db.ts').getWarehouseBoard();
  const ledger = await a.client.from('stock_movements').select('quantity, unit').eq('company_id', fa.company).eq('warehouse_id', location).eq('product_id', fa.products[0]).eq('ledger_posted', true);
  assert.equal(ledger.error, null);
  assert.equal(ledger.data.reduce((sum, row) => sum + Number(row.quantity), 0), 65, 'Balance reconstructs from posted movements');
  assert.ok(ledger.data.every(row => row.unit === 'MT'));
  assert.equal(board.error, null); assert.ok(board.data.some(item => item.company_id === fa.company && item.quantity === 65));
  const lot = board.data.find(item => item.product_id === fa.products[0] && item.warehouse_id === location);
  assert.equal((await a.load('src/lib/warehouse/db.ts').getWarehouseLotById(lot.id)).error, null);
  assert.equal((await a.load('src/lib/warehouse/actions.ts').getWarehouseOperationChoices()).error, null);
  fa.warehouseLotId = lot.id;
  assert.equal((await a.client.from('products').update({ unit: 'kg' }).eq('id', fa.products[0])).error, null);
  assert.equal((await readBalance(a.client, fa.company)).unit, 'MT', 'Master unit edits preserve stock unit snapshot');
  console.log('Warehouse: movement ledger, transfers, adjustments, 100−35=65, same Product/warehouse B20, physical85, immutable balances/history, traceability and bilateral isolation passed.');
}
