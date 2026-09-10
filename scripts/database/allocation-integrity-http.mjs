import assert from 'node:assert/strict';

// Fictional authenticated fixture only; never invokes an external project.
export async function verifyAllocationIntegrityHttp({ users, fixtures }) {
  const [admin, user] = users;
  const [fixture, other] = fixtures;
  const client = user.client;
  const saved = (result, label) => { assert.equal(result.success, true, `${label}: ${result.error ?? ''}`); return result.id; };
  const form = user.load('src/lib/contracts/form-types.ts').emptyContractForm();
  const contract = saved(await user.load('src/lib/contracts/actions.ts').createContract({
    ...form, company_id: fixture.company, business_case_id: fixture.deal, deal_id: fixture.deal,
    contract_number: 'FICTIONAL-ALLOCATION-TARGET', currency: 'USD',
    parties: [
      { role_code: 'seller', internal_company_id: fixture.company, counterparty_id: null, snapshot: { legal_name: 'Fictional Company A' } },
      { role_code: 'buyer', internal_company_id: null, counterparty_id: fixture.parties[1], snapshot: { legal_name: 'Fictional Buyer' } },
    ],
    product_lines: [{ product_id: fixture.products[0], description: 'Fictional allocation line', quantity: 1, unit: 'MT', unit_price: 100, currency: 'USD' }],
  }), 'allocation Draft Contract');
  const shipment = saved(await user.load('src/lib/logistics/actions.ts').createShipment({
    ...user.load('src/lib/logistics/types.ts').emptyShipmentForm(), company_id: fixture.company,
    contract_id: contract, business_case_id: fixture.deal, remarks: 'Fictional allocation shipment without lines',
  }), 'allocation Shipment');
  const productRead = await client.from('contract_products').select('id').eq('contract_id', contract).single();
  assert.equal(productRead.error, null);
  const contractProduct = productRead.data.id;
  const dealProduct = saved(await user.load('src/lib/deals/actions.ts').addDealProduct({
    ...fixture.lineInput, product_id: fixture.products[0],
  }), 'allocation Deal product');
  const expense = saved(await user.load('src/lib/finance/operational-actions.ts').saveExpense(null, {
    company_id: fixture.company, business_case_id: fixture.deal, amount: 30, currency: 'USD',
    description: 'Fictional target integrity cost', expense_date: '2026-09-10', status: 'Posted',
  }), 'allocation expense');
  const allocate = user.load('src/lib/finance/economic-input-actions.ts').allocateOperationalCost;
  for (const target of [{ shipment_id: shipment }, { contract_product_id: contractProduct }, { deal_product_id: dealProduct }]) {
    saved(await allocate({ company_id: fixture.company, expense_id: expense, business_case_id: fixture.deal,
      basis: 'manual', amount: '10.00', currency: 'USD', ...target }), 'explicit target allocation');
  }
  const denied = async (table, id, change) => {
    const result = await client.from(table).update(change).eq('id', id);
    assert.ok(result.error, `${table} allocated identity change must fail`);
  };
  await denied('shipments', shipment, { contract_id: fixture.contractId });
  await denied('contract_products', contractProduct, { product_id: fixture.products[1] });
  await denied('deal_products', dealProduct, { product_id: fixture.products[1] });
  await denied('contracts', contract, { business_case_id: null, deal_id: null });
  assert.ok((await admin.client.from('products').update({ company_id: other.company }).eq('id', fixture.products[0])).error, 'Allocated Product retains owner');
  assert.equal((await client.from('shipments').update({ remarks: 'Fictional scheduling note remains editable' }).eq('id', shipment)).error, null);
  assert.equal((await client.from('contract_products').update({ description: 'Fictional corrected description' }).eq('id', contractProduct)).error, null);
  assert.equal((await client.from('deal_products').update({ notes: 'Fictional commercial note' }).eq('id', dealProduct)).error, null);
  const retained = await client.from('cost_allocations').select('id,shipment_id,contract_id,business_case_id,product_id').eq('expense_id', expense);
  assert.equal(retained.error, null);
  assert.equal(retained.data.length, 3);
  assert.ok(retained.data.every(row => row.business_case_id === fixture.deal));
  assert.equal(retained.data.find(row => row.shipment_id === shipment).contract_id, contract);
  console.log('Allocation integrity: target relationships cannot drift; unrelated descriptions and notes remain editable.');
}
