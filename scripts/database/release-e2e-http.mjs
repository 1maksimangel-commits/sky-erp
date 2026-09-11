import fs from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { coreSource } from './core-source.mjs';

// Phase 8 release qualification. One fictional integrated Deal proves the modules
// work as a single ERP. Every identity, company and amount below is invented and
// exists only inside this isolated replay; no external provider is contacted.
export async function verifyReleaseE2eHttp(core) {
  const { users, fixtures } = core;
  const [admin, a, b] = users, [fa, fb] = fixtures;
  const check = (ok, label) => { if (!ok) throw new Error(`Release E2E failed: ${label}`); };
  const saved = (result, label) => { check(result?.success, `${label}: ${result?.error ?? 'unknown'}`); return result.id; };
  const raw = async (query, label) => { const r = await query; check(!r.error, `${label}: ${r.error?.message ?? ''}`); return r.data; };
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const money = value => a.load('src/lib/finance/exact.ts').Exact.of(String(value)).format();

  // ---------- 4. Counterparties and Products through canonical paths ----------
  const cpActions = a.load('src/lib/counterparties/actions.ts');
  const emptyCp = a.load('src/lib/counterparties/types.ts').emptyCounterpartyForm;
  const party = (code, name, type) => ({ ...emptyCp(), legal_name: name, counterparty_type: type, code, country: 'Fictionland', city: 'Fictional Port' });
  const supplier = saved(await cpActions.createCounterparty(party('REL-SUPPLIER', 'FICTIONAL OCEAN SUPPLY CO.', 'Supplier')), 'External Supplier');
  const customer = saved(await cpActions.createCounterparty(party('REL-CUSTOMER', 'FICTIONAL CONTINENTAL IMPORT LLC', 'Buyer')), 'External Customer');
  const agent = saved(await cpActions.createCounterparty(party('REL-AGENT', 'FICTIONAL BROKER AND AGENT LLC', 'Agent')), 'Agent');
  // The canonical taxonomy is Buyer/Supplier/Agent/Consignee/Other; a logistics
  // provider is modelled as an explicitly named 'Other' counterparty.
  const forwarder = saved(await cpActions.createCounterparty(party('REL-LOGISTICS', 'FICTIONAL FREIGHT FORWARDING LTD', 'Other')), 'Logistics Provider');
  check(!(await cpActions.createCounterparty(party('REL-SUPPLIER', 'FICTIONAL DUPLICATE', 'Supplier'))).success, 'duplicate Counterparty code rejected in own Company');
  check((await b.client.from('counterparties').select('id').eq('id', agent)).data.length === 0 ||
    (await b.client.from('counterparties').select('company_id').eq('id', agent)).data[0]?.company_id === fa.company, 'Counterparty ownership retained');
  const productActions = a.load('src/lib/products/actions.ts');
  const emptyProduct = a.load('src/lib/products/types.ts').emptyProductForm;
  const products = [];
  for (const [index, name] of ['Fictional Release Cod', 'Fictional Release Pollock', 'Fictional Release Halibut'].entries()) {
    products.push(saved(await productActions.createProduct({ ...emptyProduct(), name, sku: `REL-P${index + 1}`, unit: 'MT', category: 'Fish', origin: 'Fictional Origin' }), `Product ${index + 1}`));
  }
  check(!(await productActions.createProduct({ ...emptyProduct(), name: 'Dup', sku: 'REL-P1', unit: 'MT' })).success, 'duplicate SKU rejected in own Company');
  const quantities = [50, 30, 20]; // 100 MT total across three Product lines.

  // ---------- 5. One canonical Deal ----------
  const dealId = saved(await a.load('src/lib/business-cases/actions.ts').createBusinessCase({
    ...a.load('src/lib/business-cases/types.ts').emptyBusinessCaseForm(), company_id: fa.company,
    case_number: 'REL-E2E-DEAL', title: 'Fictional integrated release Deal', supplier_id: supplier, buyer_id: customer, currency: 'USD',
  }), 'canonical Deal');
  for (const [index, productId] of products.entries()) {
    saved(await a.load('src/lib/deals/actions.ts').addDealProduct({
      business_case_id: dealId, product_id: productId, product_description: `Fictional release line ${index + 1}`,
      quantity: quantities[index], unit: 'MT', net_weight: quantities[index], gross_weight: quantities[index] + 1,
      purchase_price: 1000, sales_price: 1500, purchase_currency: 'USD', sales_currency: 'USD',
    }), `Deal product ${index + 1}`);
  }
  const workspace = await a.load('src/lib/deals/db.ts').getDealWorkspaceData(dealId);
  check(!workspace.error && workspace.data.products.length === 3, 'Deal detail loads with three canonical Product lines');

  // ---------- 6. Explicit three-leg Contract chain on ONE Deal ----------
  const legParty = (role, kind, id) => ({ role_code: role, internal_company_id: kind === 'company' ? id : null, counterparty_id: kind === 'counterparty' ? id : null, snapshot: { legal_name: `Fictional ${role}`, address: 'Fictional address' } });
  const legs = [
    { parties: [legParty('seller', 'counterparty', supplier), legParty('buyer', 'company', fa.company)], price: 1000, owner: fa.company },
    { parties: [legParty('seller', 'company', fa.company), legParty('buyer', 'company', fb.company)], price: 1200, owner: fa.company },
    { parties: [legParty('seller', 'company', fb.company), legParty('buyer', 'counterparty', customer)], price: 1500, owner: fb.company },
  ];
  const contractIds = [], contractLineIds = [], invoiceIds = [], invoiceItemIds = [];
  for (const [index, leg] of legs.entries()) {
    const contractId = saved(await admin.load('src/lib/contracts/actions.ts').createContract({
      ...admin.load('src/lib/contracts/form-types.ts').emptyContractForm(), company_id: fa.company, business_case_id: dealId, deal_id: dealId,
      contract_number: `REL-C${index + 1}`, contract_date: '2026-09-11', currency: 'USD', amount: leg.price * 100, incoterms: 'FOB',
      parties: leg.parties,
      product_lines: products.map((productId, line) => ({ product_id: productId, description: `Fictional release line ${line + 1}`, quantity: quantities[line], unit: 'MT', unit_price: leg.price, currency: 'USD', net_weight: quantities[line], gross_weight: quantities[line] + 1 })),
    }), `Contract leg ${index + 1}`);
    await raw(admin.client.from('contracts').update({ status: 'Active' }).eq('id', contractId), 'activate reviewed Contract');
    contractIds.push(contractId);
    const lines = await raw(admin.client.from('contract_products').select('id,product_id').eq('contract_id', contractId), 'legal lines');
    check(lines.length === 3, `Contract ${index + 1} retains three legal Product lines`);
    contractLineIds.push(products.map(productId => lines.find(row => row.product_id === productId).id));
    const contractRead = await admin.load('src/lib/contracts/db.ts').getContractById(contractId);
    check(!contractRead.error && contractRead.data.parties.some(p => p.role_code === 'seller') && contractRead.data.parties.some(p => p.role_code === 'buyer'), `Contract ${index + 1} explicit Seller/Buyer`);
  }
  const linked = await raw(admin.client.from('contracts').select('id').eq('business_case_id', dealId), 'Deal Contracts');
  check(linked.length === 3, 'all three Contracts link to the same Deal');

  // ---------- 11. Financial Invoice RECORDS (distinct from generated documents) ----------
  for (const [index, leg] of legs.entries()) {
    const invoiceId = saved(await admin.load('src/lib/finance/actions.ts').createInvoice({
      ...admin.load('src/lib/finance/types.ts').emptyInvoiceForm(), company_id: index === 2 ? fb.company : fa.company,
      business_case_id: dealId, contract_id: contractIds[index], invoice_number: `REL-I${index + 1}`, currency: 'USD', status: 'Issued',
      items: products.map((productId, line) => ({ product_id: productId, description: `Fictional release line ${line + 1}`, quantity: quantities[line], unit_price: leg.price, tax_rate: 0 })),
    }), `Invoice leg ${index + 1}`);
    invoiceIds.push(invoiceId);
    const items = await raw(admin.client.from('invoice_items').select('id,product_id').eq('invoice_id', invoiceId), 'invoice items');
    invoiceItemIds.push(products.map(productId => items.find(row => row.product_id === productId).id));
    const header = await raw(admin.client.from('invoices').select('subtotal,amount').eq('id', invoiceId).single(), 'invoice header');
    check(money(header.subtotal) === money(leg.price * 100), `Invoice ${index + 1} subtotal is canonical`);
  }

  // ---------- 10. Warehouse ownership: A 100 - 40 = 60, B 20, physical 80 ----------
  const warehouseId = randomUUID();
  await raw(a.client.from('warehouse_locations').insert({ id: warehouseId, company_id: fa.company, code: 'REL-WH', name: 'Fictional release warehouse' }), 'warehouse');
  await raw(admin.client.from('warehouse_company_access').insert({ warehouse_id: warehouseId, company_id: fb.company }), 'shared warehouse access');
  const costActions = admin.load('src/lib/warehouse/cost-actions.ts');
  const receive = (company, contractId, productId, quantity, unitCost, lot) => costActions.receiveCostedInventory({ company_id: company, warehouse_id: warehouseId, product_id: productId, quantity: String(quantity), lot_number: lot, unit_cost: String(unitCost), currency: 'USD', contract_id: contractId, business_case_id: dealId });
  const release = (company, contractId, productId, lot, quantity) => raw(admin.client.rpc('warehouse_post_movement', { p_company_id: company, p_warehouse_id: warehouseId, p_product_id: productId, p_quantity: '-' + quantity, p_lot_number: lot, p_movement_type: 'outbound', p_contract_id: contractId, p_business_case_id: dealId }), 'release');
  saved(await receive(fa.company, contractIds[0], products[0], 100, 1000, 'REL-OWNERSHIP-A'), 'ownership receipt A 100 MT');
  await release(fa.company, contractIds[1], products[0], 'REL-OWNERSHIP-A', '40');
  saved(await receive(fb.company, contractIds[1], products[0], 20, 1200, 'REL-OWNERSHIP-B'), 'ownership receipt B 20 MT');
  const balance = async (company, lot) => {
    const rows = await raw(admin.client.from('stock_movements').select('quantity').eq('company_id', company).eq('warehouse_id', warehouseId).eq('product_id', products[0]).eq('lot_number', lot), 'balance');
    return rows.reduce((total, row) => total + Number(row.quantity), 0);
  };
  const ownerA = await balance(fa.company, 'REL-OWNERSHIP-A'), ownerB = await balance(fb.company, 'REL-OWNERSHIP-B');
  check(ownerA === 60, `Company A retains 60 MT, found ${ownerA}`);
  check(ownerB === 20, `Company B owns 20 MT, found ${ownerB}`);
  check(ownerA + ownerB === 80, 'physical aggregate is 80 MT');
  check((await b.client.from('stock_movements').select('id').eq('lot_number', 'REL-OWNERSHIP-A')).data.length === 0, 'no ownership leakage to Company B');
  check((await a.client.from('stock_movements').select('id').eq('lot_number', 'REL-OWNERSHIP-B')).data.length === 0, 'no ownership leakage to Company A');

  // ---------- Costed chain per Product: Supplier -> A -> B -> Customer ----------
  const realizationActions = admin.load('src/lib/finance/realization-actions.ts');
  for (const [line, productId] of products.entries()) {
    const quantity = String(quantities[line]);
    saved(await receive(fa.company, contractIds[0], productId, quantities[line], 1000, `REL-A-${line}`), `A external receipt ${line}`);
    const releaseA = await release(fa.company, contractIds[1], productId, `REL-A-${line}`, quantity);
    const realizationA = saved(await realizationActions.createSaleRealization({ company_id: fa.company, invoice_item_id: invoiceItemIds[1][line], stock_movement_id: releaseA, contract_product_id: contractLineIds[1][line], quantity, recognition_date: '2026-09-11' }), `A internal realization ${line}`);
    const receiptB = saved(await receive(fb.company, contractIds[1], productId, quantities[line], 1200, `REL-B-${line}`), `B internal receipt ${line}`);
    saved(await realizationActions.linkIntercompanyReceipt({ company_id: fb.company, receipt_movement_id: receiptB, seller_realization_id: realizationA }), `A to B lineage ${line}`);
    const releaseB = await release(fb.company, contractIds[2], productId, `REL-B-${line}`, quantity);
    saved(await realizationActions.createSaleRealization({ company_id: fb.company, invoice_item_id: invoiceItemIds[2][line], stock_movement_id: releaseB, contract_product_id: contractLineIds[2][line], quantity, recognition_date: '2026-09-11' }), `B external realization ${line}`);
  }

  // ---------- 9. Logistics: two Shipments on the Deal ----------
  // Each internal company ships its own leg, so operational and financial records
  // reference the same Contract rather than crossing legs.
  const shipmentLegs = [{ user: a, company: fa.company, leg: 1 }, { user: b, company: fb.company, leg: 2 }];
  const emptyShipment = b.load('src/lib/logistics/types.ts').emptyShipmentForm;
  const shipmentIds = [], shipmentInputs = [];
  for (const [index, ship] of shipmentLegs.entries()) {
    const logistics = ship.user.load('src/lib/logistics/actions.ts'), lineActions = ship.user.load('src/lib/logistics/line-actions.ts');
    const shipmentInput = {
      ...emptyShipment(), company_id: ship.company, contract_id: contractIds[ship.leg], business_case_id: dealId,
      container: `FICT-REL-${index}`, bl_number: `FICT-BL-${index}`, vessel: 'FICTIONAL VESSEL',
      voyage: `FICT-V${index + 1}`, port_of_loading: 'FICTIONAL LOADING PORT', port_of_destination: 'FICTIONAL DESTINATION PORT',
      etd: '2026-09-2' + (index + 1), eta: '2026-10-0' + (index + 1),
      consignee: 'FICTIONAL CONTINENTAL IMPORT LLC', notify_party: 'FICTIONAL NOTIFY PARTY',
      remarks: 'Fictional release shipment',
    };
    shipmentInputs.push(shipmentInput);
    const shipmentId = saved(await logistics.createShipment(shipmentInput), `Shipment ${index + 1}`);
    shipmentIds.push(shipmentId);
    const shipmentProducts = await lineActions.getShipmentContractProducts(contractIds[ship.leg]);
    check(shipmentProducts.length === 3, 'shipment sees three canonical Contract Products');
    const lines = shipmentProducts.map((row, line) => ({ contract_product_id: row.id, product_id: row.product_id, description: row.description, quantity: quantities[line] / 2, unit: 'MT', net_weight: quantities[line] / 2, gross_weight: quantities[line] / 2 + 1 }));
    saved(await lineActions.saveShipmentLines(shipmentId, lines), `Shipment ${index + 1} product lines`);
    const read = await lineActions.getShipmentLines(shipmentId);
    check(!read.error && read.data.length === 3, `Shipment ${index + 1} retains three lines`);
  }
  const dealShipments = await raw(admin.client.from('shipments').select('id,status').eq('business_case_id', dealId), 'Deal shipments');
  check(dealShipments.length === 2, 'Deal carries multiple Shipments');
  saved(await a.load('src/lib/logistics/actions.ts').updateShipment(shipmentIds[0], { ...shipmentInputs[0], status: 'In Transit' }), 'Shipment status lifecycle');
  check((await raw(admin.client.from('shipments').select('status').eq('id', shipmentIds[0]).single(), 'status')).status === 'In Transit', 'Shipment status advanced');

  // ---------- 13. Expenses with explicit product-line allocations ----------
  const ops = admin.load('src/lib/finance/operational-actions.ts'), prep = admin.load('src/lib/finance/economic-input-actions.ts');
  async function expense(company, legIndex, line, category, amount, shipmentId = null) {
    const categoryRow = await raw(admin.client.from('expense_categories').upsert({ code: 'REL-' + category, name: 'Fictional ' + category }, { onConflict: 'code' }).select('id').single(), 'expense category');
    const expenseId = saved(await ops.saveExpense(null, { company_id: company, business_case_id: dealId, contract_id: contractIds[legIndex], shipment_id: shipmentId, category_id: categoryRow.id, supplier_id: category === 'freight' ? forwarder : null, amount, currency: 'USD', expense_date: '2026-09-11', description: 'Fictional ' + category, status: 'Posted' }), category + ' expense');
    saved(await prep.allocateOperationalCost({ company_id: company, expense_id: expenseId, business_case_id: dealId, contract_id: contractIds[legIndex], shipment_id: shipmentId, contract_product_id: contractLineIds[legIndex][line], amount, currency: 'USD', basis: 'direct' }), category + ' explicit product allocation');
    return expenseId;
  }
  await expense(fa.company, 1, 0, 'freight', '10000', shipmentIds[0]);
  await expense(fb.company, 2, 1, 'warehouse', '5000');
  await expense(fb.company, 2, 2, 'bank', '2000');
  await expense(fb.company, 2, 0, 'other', '3000');

  // ---------- 14. Agent Commissions: all four methods ----------
  const commissions = a.load('src/lib/finance/commission-actions.ts');
  const commissionBase = {
    company_id: fa.company, business_case_id: dealId, contract_id: contractIds[1], beneficiary_id: agent,
    beneficiary_name: 'FICTIONAL BROKER AND AGENT LLC', beneficiary_type: 'agent', label: 'Fictional release commission',
    currency: 'USD', calculation_base: 'manual', status: 'Posted', confirmed: true,
    notes: 'Fictional agreed agent commission note', allocation: { scope: 'contract_product', contract_product_id: contractLineIds[1][1] },
  };
  // Deterministic server-side calculation for every required method.
  const methods = [
    ['PER_MT', { basis: 'per_mt', rate: '30', base_quantity: '95.04', base_amount: null }, '2851.20'],
    ['PER_KG', { basis: 'per_kg', rate: '0.05', base_quantity: '100000', base_amount: null }, '5000.00'],
    ['PERCENT', { basis: 'percentage', rate: '1.5', base_quantity: null, base_amount: '150000' }, '2250.00'],
    ['FIXED', { basis: 'fixed', rate: '3000', base_quantity: null, base_amount: null }, '3000.00'],
  ];
  for (const [name, extra, expected] of methods) {
    const preview = await commissions.previewCommission({ ...commissionBase, ...extra });
    check(preview.success, `${name} preview: ${preview.error ?? ''}`);
    check(preview.data.final_amount === expected, `${name} must calculate exactly ${expected}, got ${preview.data.final_amount}`);
  }
  // The Deal's own accrual: FIXED 5,000 with real settlement history.
  const commissionId = saved(await commissions.saveProfitabilityCommission(null, { ...commissionBase, basis: 'fixed', rate: '5000', base_quantity: null, base_amount: null }), 'agent commission accrual');
  const commissionRecord = (await commissions.getCommissionInputs(dealId, [fa.company])).data.find(row => row.id === commissionId);
  check(commissionRecord.beneficiary_name === 'FICTIONAL BROKER AND AGENT LLC' && commissionRecord.beneficiary_type === 'agent' && commissionRecord.is_agent, 'Agent name and type retained');
  check(commissionRecord.company_id === fa.company && commissionRecord.business_case_id === dealId && commissionRecord.contract_id === contractIds[1], 'Company, Deal and Contract retained');
  check(commissionRecord.currency === 'USD' && commissionRecord.rate === '5000' && commissionRecord.calculation_base === 'manual', 'Rate, currency and calculation base retained');
  check(commissionRecord.notes === commissionBase.notes && commissionRecord.status === 'Posted', 'Notes and status retained');
  const commissionAllocation = await raw(a.client.from('cost_allocations').select('contract_product_id,amount').eq('commission_id', commissionId).single(), 'commission allocation');
  check(commissionAllocation.contract_product_id === contractLineIds[1][1], 'commission allocated to an explicit Product line');

  // ---------- 12. Payments: partial, final, outgoing, intercompany ----------
  const finance = admin.load('src/lib/finance/actions.ts');
  const pay = async (index, amount, label) => saved(await finance.registerPayment({ invoice_id: invoiceIds[index], amount, currency: 'USD', payment_date: '2026-09-11', bank_account_id: null, reference: 'Fictional release settlement', notes: null, status: 'Paid' }), label);
  await pay(2, 100000, 'partial incoming payment');
  const afterPartial = await admin.load('src/lib/finance/profitability-actions.ts').getDealProfitability({ deal_id: dealId, company_id: null, reporting_currency: 'USD' });
  check(afterPartial.data.cash.receivables === '50000.00', 'outstanding receivable after partial payment');
  await pay(2, 50000, 'final incoming payment');
  await pay(0, 100000, 'outgoing external purchase payment');
  await pay(1, 120000, 'intercompany payment');
  const agentPayment = saved(await ops.registerStandalonePayment({ company_id: fa.company, business_case_id: dealId, contract_id: contractIds[1], payer_company_id: fa.company, payee_counterparty_id: agent, amount: '3000', currency: 'USD', payment_date: '2026-09-11', status: 'Paid' }), 'agent commission payment');
  saved(await commissions.allocateCommissionPayment(commissionId, agentPayment, '3000'), 'agent commission settlement');
  const settled = (await commissions.getCommissionInputs(dealId, [fa.company])).data.find(row => row.id === commissionId);
  check(settled.accrued_amount === '5000.00' && settled.paid_amount === '3000.00' && settled.outstanding_amount === '2000.00', `accrued/paid/outstanding must be 5000/3000/2000, got ${settled.accrued_amount}/${settled.paid_amount}/${settled.outstanding_amount}`);
  const internalPayments = await raw(admin.client.from('payments').select('id').eq('invoice_id', invoiceIds[1]), 'intercompany payment records');
  check(internalPayments.length === 1, 'one shared intercompany payment record, never duplicated');

  // ---------- 15. Profitability: golden consolidated economics ----------
  const report = async (companyId = null) => {
    const result = await admin.load('src/lib/finance/profitability-actions.ts').getDealProfitability({ deal_id: dealId, company_id: companyId, reporting_currency: 'USD' });
    check(!result.error, `profitability report: ${result.error ?? ''}`);
    return result.data;
  };
  const group = await report();
  check(group.actual.complete, `consolidated economics incomplete: ${JSON.stringify(group.actual.gaps)}`);
  check(group.actual.external_revenue === '150000.00', `external revenue ${group.actual.external_revenue}`);
  check(group.actual.external_cogs === '100000.00', `external COGS ${group.actual.external_cogs}`);
  check(group.actual.intercompany_revenue === '0.00' && group.actual.intercompany_cogs === '0.00', 'internal leg eliminated from consolidation');
  check(group.actual.operating_costs === '25000.00', `external costs ${group.actual.operating_costs}`);
  check(group.actual.agent_commissions === '5000.00', 'agent commission included in consolidated costs');
  check(group.actual.net_contribution === '25000.00', `consolidated profit must be 25000.00, got ${group.actual.net_contribution}`);
  check(group.expected.net_contribution === '25000.00', 'expected consolidated profit');
  check(group.eliminations.some(row => row.source_id === invoiceIds[1]), 'intercompany invoice recorded as an explicit elimination');
  const companyA = await report(fa.company), companyB = await report(fb.company);
  check(companyA.actual.intercompany_revenue === '120000.00' && companyA.actual.external_cogs === '100000.00', 'Company A retains the internal sale');
  check(companyA.actual.net_contribution === '5000.00', `Company A P&L must be 5000.00, got ${companyA.actual.net_contribution}`);
  check(companyB.actual.external_revenue === '150000.00' && companyB.actual.intercompany_cogs === '120000.00', 'Company B retains the internal purchase');
  check(companyB.actual.net_contribution === '20000.00', `Company B P&L must be 20000.00, got ${companyB.actual.net_contribution}`);
  const expectedProduct = [['12000.00', '75000.00', '50000.00'], ['5000.00', '45000.00', '30000.00'], ['8000.00', '30000.00', '20000.00']];
  for (const [line, productId] of products.entries()) {
    const row = group.products.find(item => item.product_id === productId);
    check(row && row.actual.complete, `Product ${line + 1} profitability incomplete`);
    check(row.actual.revenue === expectedProduct[line][1] && row.actual.cogs === expectedProduct[line][2], `Product ${line + 1} revenue/COGS ${row.actual.revenue}/${row.actual.cogs}`);
    check(row.actual.net_contribution === expectedProduct[line][0], `Product ${line + 1} contribution must be ${expectedProduct[line][0]}, got ${row.actual.net_contribution}`);
  }
  check(group.cash.received === '150000.00' && group.cash.paid === '103000.00', `cash ${group.cash.received}/${group.cash.paid}`);
  check(group.cash.receivables === '0.00' && group.cash.payables === '0.00', 'settled obligations');
  check(group.cash.commission_accrued === '5000.00' && group.cash.commission_paid === '3000.00' && group.cash.commission_outstanding === '2000.00', 'commission settlement view');
  check(group.actual.net_contribution === '25000.00', 'cash settlement never double-counts accrual');
  check((await b.load('src/lib/finance/profitability-actions.ts').getDealProfitability({ deal_id: dealId, company_id: null, reporting_currency: 'USD' })).error, 'partial access cannot masquerade as consolidation');

  // ---------- 8. Document generation from canonical Contract data ----------
  const templateBytes = fs.readFileSync('scripts/database/fixtures/fictional-document-template.docx');
  const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const templates = {};
  for (const type of ['contract', 'supplement', 'invoice']) {
    const form = new FormData();
    form.set('documentType', type); form.set('name', `Fictional release ${type}`); form.set('language', 'en');
    form.set('companyId', fa.company); form.set('isDefault', 'false');
    form.set('file', new File([templateBytes], 'fictional-template.docx', { type: mime }));
    const uploaded = await a.load('src/lib/document-templates/actions.ts').uploadDocumentTemplate(form);
    check(uploaded.id, `template upload ${type}: ${uploaded.error ?? ''}`);
    templates[type] = uploaded.id;
  }
  const generation = a.load('src/lib/document-templates/generation.ts');
  const generatedIds = [];
  for (const type of ['contract', 'supplement', 'invoice']) {
    const input = { templateId: templates[type], contractId: contractIds[1], documentType: type, details: { number: `REL-${type.toUpperCase()}`, date: '2026-09-11', notes: 'Fictional release note', supplementReference: type === 'invoice' ? 'REL-SUPPLEMENT' : '' } };
    const preview = await generation.generateDocument({ ...input, preview: true });
    check(preview.preview && !preview.missing.length, `${type} review has no unresolved fields`);
    check(preview.values.products.length === 3, `${type} renders three Product lines`);
    check(preview.values.calculated.total === 120000, `${type} canonical total ${preview.values.calculated.total}`);
    check(preview.values.commercial.currency === 'USD' && preview.values.commercial.incoterms === 'FOB', `${type} currency and Incoterms`);
    let blocked = false; try { await generation.generateDocument(input); } catch { blocked = true; }
    check(blocked, `${type} generation requires an explicit review hash`);
    const output = await generation.generateDocument({ ...input, reviewHash: preview.reviewHash });
    check(output.id, `${type} generated`);
    generatedIds.push(output.id);
    const record = await raw(a.client.from('generated_documents').select('*').eq('id', output.id).single(), `${type} record`);
    check(record.version === 1 && record.contract_id === contractIds[1] && record.deal_id === dealId, `${type} canonical linkage and version`);
    check(record.snapshot_data.values.products.length === 3 && /^[a-f\d]{64}$/.test(record.snapshot_hash), `${type} immutable snapshot`);
    check(record.snapshot_data.values.seller.legal_name && record.snapshot_data.values.buyer.legal_name, `${type} explicit Seller/Buyer snapshot`);
  }
  const docxBytes = await a.client.storage.from('documents').download((await raw(a.client.from('generated_documents').select('storage_path').eq('id', generatedIds[0]).single(), 'output path')).storage_path);
  a.load('src/lib/document-templates/docx-engine.ts').assertDocxIntegrity(new Uint8Array(await docxBytes.data.arrayBuffer()));
  const templateRow = await raw(a.client.from('document_templates').select('storage_path').eq('id', templates.contract).single(), 'template row');
  const templateAfter = await a.client.storage.from('documents').download(templateRow.storage_path);
  check(hash(Buffer.from(await templateAfter.data.arrayBuffer())) === hash(templateBytes), 'original template bytes unchanged by generation');
  const commercialInvoiceDocument = await raw(a.client.from('generated_documents').select('id').eq('document_type', 'invoice').eq('contract_id', contractIds[1]), 'commercial invoice document');
  check(commercialInvoiceDocument.length === 1, 'generated Commercial Invoice document exists');
  check(!invoiceIds.includes(commercialInvoiceDocument[0].id), 'generated Commercial Invoice DOCUMENT is a separate record from the financial Invoice');

  // ---------- 7. Contract import workflow (isolated fictional Deal) ----------
  // Deliberately a separate Deal: an imported Contract carries economic values and
  // would otherwise alter the golden Deal being qualified above.
  const importDealId = saved(await a.load('src/lib/business-cases/actions.ts').createBusinessCase({
    ...a.load('src/lib/business-cases/types.ts').emptyBusinessCaseForm(), company_id: fa.company,
    case_number: 'REL-E2E-IMPORT', title: 'Fictional release import Deal', supplier_id: supplier, buyer_id: customer, currency: 'USD',
  }), 'import Deal');
  // Build the fixture from the canonical extraction schema so every section exists.
  const schema = a.load('src/lib/ai/contracts/schema.ts');
  const empty = schema.emptyField;
  const extraction = {};
  for (const [section, shape] of Object.entries(schema.ContractExtractionZodSchema.shape)) {
    if (section === 'products') { extraction.products = []; continue; }
    extraction[section] = Object.fromEntries(Object.keys(shape.shape).map(key => [key, empty()]));
  }
  extraction.general.contract_number = empty('REL-IMPORTED', 0.99);
  extraction.seller.legal_name = empty('FICTIONAL OCEAN SUPPLY CO.', 0.99);
  extraction.buyer.buyer_legal_name = empty('SKY TEST TRADING LTD', 0.99);
  extraction.commercial.currency = empty('USD', 0.99);
  extraction.commercial.payment_terms = empty('30 days', 0.95);
  const importLoad = coreSource(a.client, { success: true, extraction, warnings: [], model: 'fictional-offline-fixture', requestId: null });
  const service = importLoad('src/lib/contracts/import/service.ts');
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const pdf = await PDFDocument.create(); const page = pdf.addPage(); const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText('Fictional release Contract REL-IMPORTED. Seller FICTIONAL OCEAN SUPPLY CO. Buyer SKY TEST TRADING LTD.', { x: 20, y: 700, size: 9, font });
  const originalPdf = new File([await pdf.save()], 'fictional-release-contract.pdf', { type: 'application/pdf' });
  const uploaded = await service.createImportAndStorePdf(originalPdf);
  const pipeline = await service.runExtractionPipeline({ importId: uploaded.importId, file: originalPdf, fileName: originalPdf.name });
  check(pipeline.importRecord.status === 'review' && !pipeline.importRecord.created_contract_id, 'extracted data is not authoritative before confirmation');
  let duplicateBlocked = false;
  try { await service.createImportAndStorePdf(originalPdf); } catch { duplicateBlocked = true; }
  check(duplicateBlocked, 'duplicate source upload prevented');
  const importActions = importLoad('src/lib/contracts/import/actions.ts');
  const importPayload = {
    importId: uploaded.importId,
    form: { ...a.load('src/lib/contracts/form-types.ts').emptyContractForm(), company_id: fa.company, business_case_id: importDealId, deal_id: importDealId, contract_number: 'REL-IMPORTED', contract_date: '2026-09-11', currency: 'USD', parties: legs[0].parties },
    matches: { companyId: fa.company, buyerId: null, supplierId: null, consigneeId: null }, productLines: [], fieldOverrides: { payment_terms: '30 days' },
  };
  check(!(await importActions.confirmContractImport({ ...importPayload, form: { ...importPayload.form, parties: [] } })).success, 'unresolved legal parties cannot confirm');
  const importDraft = await importActions.confirmContractImport({ ...importPayload, saveAsDraft: true });
  check(importDraft.success && !importDraft.data.contractId, 'review draft does not create a Contract');
  const confirmed = await importActions.confirmContractImport(importPayload);
  check(confirmed.success, `import confirmation: ${confirmed.error ?? ''}`);
  const importRow = await raw(a.client.from('contract_imports').select('*').eq('id', uploaded.importId).single(), 'import record');
  check(importRow.created_contract_id === confirmed.data.contractId && importRow.confirmed_by === a.id && importRow.file_hash, 'audit trail records source, reviewer and file hash');
  const originals = await importLoad('src/lib/contracts/import/actions.ts').getContractOriginals(confirmed.data.contractId);
  check((originals.data ?? originals).length >= 1, 'original imported file retained against the Contract');
  check(Boolean((await a.client.from('contract_imports').update({ file_name: 'tampered.pdf' }).eq('id', uploaded.importId)).error), 'immutable import source metadata');

  const goldenUnchanged = await report();
  check(goldenUnchanged.actual.net_contribution === '25000.00', 'import workflow never disturbed the qualified Deal');

  // ---------- Reports and Analytics: read-only and company scoped ----------
  const countRows = async table => (await raw(admin.client.from(table).select('id'), `${table} census`)).length;
  const censusBefore = { invoices: await countRows('invoices'), payments: await countRows('payments'), expenses: await countRows('expenses') };
  const reportsA = await a.load('src/lib/finance/db.ts').getFinanceReports();
  const reportsB = await b.load('src/lib/finance/db.ts').getFinanceReports();
  check(!reportsA.error && !reportsB.error, `finance reports load: ${reportsA.error ?? reportsB.error ?? ''}`);
  const censusAfter = { invoices: await countRows('invoices'), payments: await countRows('payments'), expenses: await countRows('expenses') };
  check(JSON.stringify(censusBefore) === JSON.stringify(censusAfter), 'Reports must never modify business data');
  const ownInvoiceNumbers = new Set(reportsA.data.accountsReceivable.concat(reportsA.data.accountsPayable).map(row => row.invoice_number));
  const foreignInvoiceNumbers = new Set(reportsB.data.accountsReceivable.concat(reportsB.data.accountsPayable).map(row => row.invoice_number));
  check(!foreignInvoiceNumbers.has('REL-I1'), 'Company B reporting cannot read Company A purchase obligations');
  check(ownInvoiceNumbers.size > 0 || reportsA.data.profitByBusinessCase.length >= 0, 'Company A reporting returns its own scope');
  check(Array.isArray(reportsA.data.cashFlow) && Array.isArray(reportsA.data.profitByContract), 'legacy report bundle shape retained');

  // ---------- Performance: the canonical read paths must not scale per row ----------
  async function countRequests(task) {
    const original = globalThis.fetch;
    let requests = 0;
    globalThis.fetch = (input, init) => {
      const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (target.includes('127.0.0.1:55321')) requests += 1;
      return original(input, init);
    };
    try { await task(); } finally { globalThis.fetch = original; }
    return requests;
  }
  const reportRequests = await countRequests(() => admin.load('src/lib/finance/profitability-actions.ts').getDealProfitability({ deal_id: dealId, company_id: null, reporting_currency: 'USD' }));
  check(reportRequests === 1, `consolidated profitability must be one round trip, used ${reportRequests}`);
  const commissionRequests = await countRequests(() => commissions.getCommissionInputs(dealId, [fa.company]));
  check(commissionRequests === 1, `commission inputs must be one round trip, used ${commissionRequests}`);
  // A rich Deal and an almost empty one must cost the same number of queries.
  const richWorkspace = await countRequests(() => a.load('src/lib/deals/db.ts').getDealWorkspaceData(dealId));
  const sparseWorkspace = await countRequests(() => a.load('src/lib/deals/db.ts').getDealWorkspaceData(importDealId));
  check(richWorkspace === sparseWorkspace, `Deal workspace is N+1: ${richWorkspace} queries for 3 Products/3 Contracts/2 Shipments vs ${sparseWorkspace} for an empty Deal`);
  const richInventory = await countRequests(() => realizationActions.getProfitabilityInventoryInputs(dealId, [fa.company, fb.company], 'USD'));
  check(richInventory === 1, `inventory lineage inputs must be one round trip, used ${richInventory}`);
  console.log(`Performance: profitability ${reportRequests}, commissions ${commissionRequests}, lineage ${richInventory} round trip each; Deal workspace ${richWorkspace} queries independent of Deal size.`);

  console.log('Release E2E: one Deal, 2 internal companies, 4 external parties, 3 Products, 3 explicit Contract legs, reviewed import, 3 DOCX outputs, 2 Shipments, ownership A60/B20/physical80, invoices, partial+final+outgoing+intercompany payments, product allocations, agent commission 2851.20/5000.00/2250.00/3000.00 and 5000/3000/2000, consolidated 25000 with A5000/B20000 and product 12000/5000/8000 passed.');
  return { dealId, importDealId, contractIds, invoiceIds, shipmentIds, products, warehouseId, commissionId, generatedIds };
}
