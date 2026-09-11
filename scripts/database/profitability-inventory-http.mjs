import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyProfitabilityInventoryHttp(core) {
  const { users, fixtures } = core;
  const [admin, a, b] = users, [fa, fb] = fixtures;
  const raw = async (query, label) => { const r = await query; assert.equal(r.error, null, `${label}: ${r.error?.message}`); return r.data; };
  const saved = (r, label) => { assert.equal(r.success, true, `${label}: ${r.error}`); return r.id; };
  const actions = admin.load('src/lib/finance/realization-actions.ts');
  const party = (role, kind, id) => ({ role_code: role, internal_company_id: kind === 'company' ? id : null, counterparty_id: kind === 'counterparty' ? id : null, snapshot: { legal_name: 'Fictional ' + role, address: 'Fictional address' } });
  async function chain(prefix, externalRelease = '100') {
    const productId = saved(await a.load('src/lib/products/actions.ts').createProduct({ ...a.load('src/lib/products/types.ts').emptyProductForm(), name: 'Fictional costing cod', sku: prefix, unit: 'MT' }), 'costing Product');
    const dealId = saved(await a.load('src/lib/business-cases/actions.ts').createBusinessCase({ ...a.load('src/lib/business-cases/types.ts').emptyBusinessCaseForm(), company_id: fa.company, case_number: prefix, title: 'Fictional recognition chain', supplier_id: fa.parties[0], buyer_id: fa.parties[1], currency: 'USD' }), 'recognition Deal');
    saved(await a.load('src/lib/deals/actions.ts').addDealProduct({ business_case_id: dealId, product_id: productId, product_description: 'Fictional 100 MT', quantity: 100, unit: 'MT', purchase_price: 1000, sales_price: 1500, purchase_currency: 'USD', sales_currency: 'USD' }), 'canonical Deal line');
    const legParties = [
      [party('seller','counterparty',fa.parties[0]),party('buyer','company',fa.company)],
      [party('seller','company',fa.company),party('buyer','company',fb.company)],
      [party('seller','company',fb.company),party('buyer','counterparty',fa.parties[1])],
    ];
    const contractIds = [], invoiceIds = [], contractProductIds = [], invoiceItems = [];
    for (let index = 0; index < 3; index++) {
      const contract = saved(await admin.load('src/lib/contracts/actions.ts').createContract({ ...admin.load('src/lib/contracts/form-types.ts').emptyContractForm(), company_id: fa.company, business_case_id: dealId, deal_id: dealId, contract_number: prefix + '-C' + index, contract_date: '2026-09-10', currency: 'USD', amount: [100000,120000,150000][index], parties: legParties[index], product_lines: [{ product_id: productId, description: 'Fictional cod legal line', quantity: 100, unit: 'MT', unit_price: [1000,1200,1500][index], currency: 'USD' }] }), 'Contract leg');
      await raw(admin.client.from('contracts').update({ status: 'Active' }).eq('id', contract), 'activate reviewed Contract');
      contractIds.push(contract);
      contractProductIds.push((await raw(admin.client.from('contract_products').select('id').eq('contract_id', contract).single(), 'legal line')).id);
      const invoice = saved(await admin.load('src/lib/finance/actions.ts').createInvoice({ ...admin.load('src/lib/finance/types.ts').emptyInvoiceForm(), company_id: index === 2 ? fb.company : fa.company, business_case_id: dealId, contract_id: contract, invoice_number: prefix + '-I' + index, currency: 'USD', status: 'Issued', items: [{ product_id: productId, description: 'Fictional cod', quantity: 100, unit_price: [1000,1200,1500][index], tax_rate: 0 }] }), 'Invoice leg');
      invoiceIds.push(invoice);
      invoiceItems.push((await raw(admin.client.from('invoice_items').select('id').eq('invoice_id', invoice).single(), 'Invoice item')).id);
    }
    const warehouseId = randomUUID();
    await raw(a.client.from('warehouse_locations').insert({ id: warehouseId, company_id: fa.company, code: prefix, name: 'Fictional recognition warehouse' }), 'warehouse');
    await raw(admin.client.from('warehouse_company_access').insert({ warehouse_id: warehouseId, company_id: fb.company }), 'shared location assignment');
    const receipt = (company, contract, cost, lot) => admin.load('src/lib/warehouse/cost-actions.ts').receiveCostedInventory({ company_id: company, warehouse_id: warehouseId, product_id: productId, quantity: '100', lot_number: lot, unit_cost: cost, currency: 'USD', contract_id: contract, business_case_id: dealId });
    const release = (company, contract, lot, quantity) => raw(admin.client.rpc('warehouse_post_movement', { p_company_id: company, p_warehouse_id: warehouseId, p_product_id: productId, p_quantity: '-' + quantity, p_lot_number: lot, p_movement_type: 'outbound', p_contract_id: contract, p_business_case_id: dealId }), 'physical release');
    const receiptA = saved(await receipt(fa.company, contractIds[0], '1000', 'ACQUISITION-A'), 'external cost receipt');
    const releaseA = await release(fa.company, contractIds[1], 'ACQUISITION-A', '100');
    const realizationA = saved(await actions.createSaleRealization({ company_id: fa.company, invoice_item_id: invoiceItems[1], stock_movement_id: releaseA, contract_product_id: contractProductIds[1], quantity: '100', recognition_date: '2026-09-10' }), 'internal sale realization');
    const receiptB = saved(await receipt(fb.company, contractIds[1], '1200', 'ACQUISITION-B'), 'internal acquisition receipt');
    saved(await actions.linkIntercompanyReceipt({ company_id: fb.company, receipt_movement_id: receiptB, seller_realization_id: realizationA }), 'explicit A to B acquisition lineage');
    const releaseB = await release(fb.company, contractIds[2], 'ACQUISITION-B', externalRelease);
    const realizationB = saved(await actions.createSaleRealization({ company_id: fb.company, invoice_item_id: invoiceItems[2], stock_movement_id: releaseB, contract_product_id: contractProductIds[2], quantity: externalRelease, recognition_date: '2026-09-10' }), 'external sale realization');
    return { dealId, companyA: fa.company, companyB: fb.company, productId, contractIds, invoiceIds, invoiceItems, realizationIds: [realizationA,realizationB], receiptIds: [receiptA,receiptB], releaseIds: [releaseA,releaseB], contractProductIds, warehouseId };
  }
  const golden = await chain('PROFIT-GOLDEN');
  const inputs = await actions.getProfitabilityInventoryInputs(golden.dealId, [fa.company,fb.company], 'USD');
  assert.equal(inputs.error, null); assert.equal(inputs.data.length, 2);
  const localA = inputs.data.find(row => row.company_id === fa.company), localB = inputs.data.find(row => row.company_id === fb.company);
  assert.equal(localA.local_unit_cost, '1000'); assert.equal(localB.local_unit_cost, '1200');
  assert.equal(localA.ultimate_unit_cost, '1000'); assert.equal(localB.ultimate_unit_cost, '1000');
  assert.equal(localB.ultimate_source_movement_id, golden.receiptIds[0]);
  assert.equal(localB.quantity, '100'); assert.equal(localB.lineage_gap, false);
  assert.equal(localA.acquisition_internal, false); assert.equal(localB.acquisition_internal, true);
  assert.equal(localB.local_fx_rate, '1'); assert.equal(localB.ultimate_fx_rate, '1');
  const privateB = await b.load('src/lib/finance/realization-actions.ts').getProfitabilityInventoryInputs(golden.dealId, [fb.company], 'USD');
  assert.equal(privateB.error, null); assert.equal(privateB.data.length, 1);
  assert.equal(privateB.data[0].local_unit_cost, '1200'); assert.equal(privateB.data[0].ultimate_unit_cost, null); assert.equal(privateB.data[0].lineage_gap, true, 'B cannot discover A acquisition costs');
  assert.equal(privateB.data[0].acquisition_internal, true); assert.equal(privateB.data[0].acquisition_seller_company_id, fa.company, 'own purchase direction does not require private upstream costs');
  assert.ok((await b.load('src/lib/finance/realization-actions.ts').getProfitabilityInventoryInputs(golden.dealId, [fa.company,fb.company], 'USD')).error, 'unauthorized consolidation denied');
  const repeat = { company_id: fa.company, invoice_item_id: golden.invoiceItems[1], stock_movement_id: golden.releaseIds[0], contract_product_id: golden.contractProductIds[1], quantity: '1', recognition_date: '2026-09-10' };
  assert.equal((await actions.createSaleRealization(repeat)).success, false, 'cannot recognize released quantity twice');
  assert.equal((await b.load('src/lib/finance/realization-actions.ts').createSaleRealization(repeat)).success, false, 'foreign recognition denied');
  assert.equal((await actions.createSaleRealization({ ...repeat, stock_movement_id: golden.receiptIds[0] })).success, false, 'inbound is not realized COGS');
  assert.equal((await actions.linkIntercompanyReceipt({ company_id: fb.company, receipt_movement_id: golden.receiptIds[1], seller_realization_id: golden.realizationIds[0] })).success, false, 'duplicate receipt lineage denied');
  assert.equal((await a.client.from('sale_realizations').update({ quantity: 1 }).eq('id', golden.realizationIds[0]).select('id')).data.length, 0, 'realization immutable');
  assert.equal((await b.client.from('sale_realizations').select('id').eq('id', golden.realizationIds[0])).data.length, 0, 'private realization hidden');
  assert.ok((await a.client.from('contract_products').update({ quantity: 1 }).eq('id', golden.contractProductIds[1])).error, 'realized legal line frozen');
  const capture = admin.load('src/lib/finance/economic-input-actions.ts');
  for (const [company_id, source] of [[fa.company,{contract_id:golden.contractIds[0]}],[fb.company,{contract_id:golden.contractIds[1]}],[fa.company,{stock_movement_id:golden.receiptIds[0]}],[fb.company,{stock_movement_id:golden.releaseIds[1]}]]) {
    saved(await capture.captureReportingInput({ company_id, ...source, reporting_currency: 'USD', reporting_date: '2026-09-10' }), 'Contract/stock immutable FX capture');
  }
  const partial = await chain('PROFIT-PARTIAL', '40');
  const partialInputs = await actions.getProfitabilityInventoryInputs(partial.dealId, [fa.company,fb.company], 'USD');
  assert.equal(partialInputs.error, null);
  const partialB = partialInputs.data.find(row => row.company_id === fb.company);
  assert.equal(partialB.quantity, '40'); assert.equal(partialB.local_unit_cost, '1200'); assert.equal(partialB.ultimate_unit_cost, '1000');
  const remainder = await admin.load('src/lib/warehouse/cost-actions.ts').getInventoryCostInput(partial.releaseIds[1]);
  assert.equal(remainder.data.remaining_quantity, '60'); assert.equal(remainder.data.remaining_cost_amount, '72000');
  const rateInput = { base_currency: 'USD', quote_currency: 'CNY', rate: '7.000000000000', rate_date: '2026-09-10', source: 'Fictional recognition historical FX' };
  saved(await admin.load('src/lib/finance/actions.ts').upsertExchangeRate(rateInput), 'recognition explicit FX');
  const rate = await raw(admin.client.from('exchange_rates').select('id').eq('base_currency','USD').eq('quote_currency','CNY').eq('rate_date','2026-09-10').single(), 'recognition FX identifier');
  const immutableInputs = [];
  for (const source of [{contract_id:partial.contractIds[0]},{stock_movement_id:partial.receiptIds[0]}]) {
    const id = saved(await capture.captureReportingInput({ company_id:fa.company,...source,reporting_currency:'CNY',reporting_date:'2026-09-10',exchange_rate_id:rate.id }), 'capture new source kind historical FX');
    const read = await capture.getReportingInput(id);
    assert.equal(read.error, null); assert.equal(read.data.reporting_amount,'700000.00');
    assert.equal(read.data.fx_rate,'7.000000000000');
    immutableInputs.push([id,read.data]);
  }
  saved(await admin.load('src/lib/finance/actions.ts').upsertExchangeRate({...rateInput,rate:'8.000000000000'}), 'change current recognition FX');
  for (const [id,before] of immutableInputs) assert.deepEqual((await capture.getReportingInput(id)).data,before,'Contract/stock historical FX does not join current rate');
  assert.equal((await b.load('src/lib/finance/economic-input-actions.ts').captureReportingInput({company_id:fb.company,stock_movement_id:partial.receiptIds[0],reporting_currency:'USD',reporting_date:'2026-09-10'})).success,false,'foreign stock FX cannot expose acquisition amount');
  console.log('Profitability inventory: explicit realization, 100k→120k→150k lineage, partial40/remaining60, immutable Contract/stock snapshots and company-private upstream basis passed.');
  return { ...golden, partialDealId: partial.dealId };
}
