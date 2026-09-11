import assert from 'node:assert/strict';

export async function verifyProfitabilityCommissionHttp({ users, fixtures }) {
  const [, a, b] = users;
  const [fa, fb] = fixtures;
  const api = a.load('src/lib/finance/commission-actions.ts');
  const Exact = a.load('src/lib/finance/exact.ts').Exact;
  const money = value => Exact.of(String(value)).format();
  const save = (result, label) => { assert.equal(result.success, true, `${label}: ${result.error ?? ''}`); return result.id; };
  const deal = save(await a.load('src/lib/business-cases/actions.ts').createBusinessCase({ ...fa.dealInput, case_number: 'FICTIONAL-COMMISSION-ENGINE', title: 'Fictional commission fixture' }), 'commission Deal');
  const productLine = save(await a.load('src/lib/deals/actions.ts').addDealProduct({ ...fa.lineInput, business_case_id: deal,
    product_id: fa.products[0], quantity: 95.04, net_weight: 95.04, gross_weight: 100, unit: 'MT' }), 'commission product line');
  const base = { company_id: fa.company, business_case_id: deal, beneficiary_id: fa.parties[0], beneficiary_name: 'Fictional independent agent',
    beneficiary_type: 'agent', label: 'Fictional commission', basis: 'per_mt', rate: '30', base_quantity: '100', base_amount: null,
    currency: 'USD', calculation_base: 'manual', status: 'Posted', confirmed: true, notes: 'Fictional agreed commission note', allocation: { scope: 'deal' } };
  const cases = [
    [{}, '3000.00'],
    [{ base_quantity: '95.04' }, '2851.20'],
    [{ basis: 'per_kg', rate: '0.03', base_quantity: '95040' }, '2851.20'],
    [{ basis: 'percentage', rate: '0.5', base_amount: '100000', base_quantity: null }, '500.00'],
    [{ basis: 'fixed', rate: '5000', base_quantity: null }, '5000.00'],
    [{ rate: '35', base_quantity: '95.04', override_amount: '5000', override_reason: 'Fictional negotiated fee' }, '5000.00'],
    [{ basis: 'per_kg', calculation_base: 'quantity', rate: '0.05', base_quantity: '100000', beneficiary_type: 'broker' }, '5000.00'],
    [{ basis: 'percentage', calculation_base: 'sale_revenue', rate: '1.5', base_amount: '150000', base_quantity: null, beneficiary_type: 'intermediary' }, '2250.00'],
    [{ basis: 'fixed', rate: '3000', base_quantity: null, beneficiary_type: 'external_counterparty' }, '3000.00'],
  ];
  const ids = [];
  for (const [index, [extra, expected]] of cases.entries()) {
    const input = { ...base, ...extra, label: `Fictional commission case ${index + 1}` };
    const preview = await api.previewCommission(input);
    assert.equal(preview.success, true, preview.error);
    assert.equal(preview.data.final_amount, expected);
    const id = save(await api.saveProfitabilityCommission(null, input), 'commission case ' + index);
    ids.push(id);
    const allocation = await a.client.from('cost_allocations').select('amount').eq('commission_id', id).single();
    assert.equal(allocation.error, null); assert.equal(money(allocation.data.amount), expected);
  }
  const overridden = await a.client.from('deal_commission_links').select('calculated_amount,expected_amount,override_reason,calculation_snapshot').eq('id', ids[5]).single();
  assert.equal(overridden.data.calculated_amount, 3326.4); assert.equal(overridden.data.expected_amount, 5000);
  assert.equal(overridden.data.calculation_snapshot.calculated_amount, '3326.40');
  assert.equal((await api.saveProfitabilityCommission(null, { ...base, override_amount: '2', override_reason: '' })).success, false);
  assert.equal((await api.saveProfitabilityCommission(null, { ...base, confirmed: false })).success, false);
  assert.equal((await api.saveProfitabilityCommission(null, { ...base, company_id: fb.company })).success, false);
  assert.ok((await a.client.from('deal_commission_links').update({ rate: 99 }).eq('id', ids[0])).error, 'Posted basis is immutable');
  assert.ok((await a.client.from('deal_commission_links').update({ notes: 'Attempted historical rewrite' }).eq('id', ids[0])).error, 'Posted notes retain agreed history');
  assert.ok((await a.client.from('deal_commission_links').update({ managed_accrual: false }).eq('id', ids[0])).error, 'Accrual protection cannot be cleared');
  const hidden = await b.load('src/lib/finance/commission-actions.ts').getCommissionInputs(deal, [fa.company]);
  assert.equal(hidden.error, null); assert.equal(hidden.data.length, 0);
  const draft = save(await api.saveProfitabilityCommission(null, { ...base, status: 'Draft', confirmed: false }), 'Draft commission');
  save(await api.saveProfitabilityCommission(draft, { ...base, status: 'Draft', confirmed: false, rate: '31' }), 'Draft edit');
  const dynamic = save(await api.saveProfitabilityCommission(null, { ...base, calculation_base: 'deal_net_weight', base_quantity: null,
    allocation: { scope: 'deal_product', deal_product_id: productLine } }), 'explicit product allocation');
  let records = await api.getCommissionInputs(deal, [fa.company]);
  assert.equal(records.data.find(row => row.id === ids[0]).notes, base.notes);
  assert.equal(records.error, null); assert.equal(records.data.find(row => row.id === dynamic).expected_amount, '2851.20');
  assert.equal(records.data.find(row => row.id === dynamic).basis_changed, false);
  assert.equal((await a.client.from('deal_products').update({ net_weight: 96 }).eq('id', productLine)).error, null);
  records = await api.getCommissionInputs(deal, [fa.company]);
  assert.equal(records.data.find(row => row.id === dynamic).basis_changed, true);
  assert.equal(records.data.find(row => row.id === dynamic).expected_amount, '2851.20', 'Base edits never recalculate accrued history');
  const operations = a.load('src/lib/finance/operational-actions.ts');
  const paymentInput = { company_id: fa.company, business_case_id: deal, payer_company_id: fa.company,
    payee_counterparty_id: fa.parties[0], currency: 'USD', amount: '1000', payment_date: '2026-09-10', status: 'Paid' };
  const payment = save(await operations.registerStandalonePayment(paymentInput), 'commission canonical payment');
  save(await api.allocateCommissionPayment(ids[0], payment, '1000'), 'commission partial settlement');
  assert.equal((await api.allocateCommissionPayment(ids[1], payment, '1')).success, false, 'Payment cannot settle twice');
  const revision = save(await api.reviseProfitabilityCommission(ids[0], { ...base, rate: '35', override_reason: 'Fictional revised fee' }), 'posted revision');
  records = await api.getCommissionInputs(deal, [fa.company]);
  assert.equal(records.data.some(row => row.id === ids[0]), false);
  const revised = records.data.find(row => row.id === revision);
  assert.equal(revised.root_id, ids[0]); assert.equal(revised.expected_amount, '3500.00');
  assert.equal(revised.paid_amount, '1000.00'); assert.equal(revised.outstanding_amount, '2500.00');
  assert.equal((await api.reviseProfitabilityCommission(revision, { ...base, rate: '1' })).success, false, 'Revision cannot strand settled money');
  const finalPayment = save(await operations.registerStandalonePayment({ ...paymentInput, amount: '2500', status: 'Pending' }), 'Pending commission payment');
  save(await api.allocateCommissionPayment(revision, finalPayment, '2500'), 'remaining allocation');
  records = await api.getCommissionInputs(deal, [fa.company]);
  assert.equal(records.data.find(row => row.id === revision).outstanding_amount, '2500.00', 'Pending is not paid');
  save(await operations.setPaymentStatus(finalPayment, 'Paid'), 'post commission payment');
  records = await api.getCommissionInputs(deal, [fa.company]);
  assert.equal(records.data.find(row => row.id === revision).outstanding_amount, '0.00');
  save(await operations.setPaymentStatus(finalPayment, 'Cancelled'), 'cancel commission payment');
  records = await api.getCommissionInputs(deal, [fa.company]);
  assert.equal(records.data.find(row => row.id === revision).outstanding_amount, '2500.00');
  const person = save(await api.saveProfitabilityCommission(null, { ...base, beneficiary_id: null, beneficiary_name: 'FICTIONAL PERSON', beneficiary_type: 'person' }), 'name-only person accrual');
  assert.equal((await api.allocateCommissionPayment(person, payment, '1')).success, false, 'Name-only beneficiary never guesses payment identity');
  assert.ok((await a.client.from('deal_commission_links').insert({ company_id: fa.company, business_case_id: deal, beneficiary_id: fa.parties[0],
    basis: 'fixed', rate: 1, currency: 'USD', status: 'Posted', family_id: ids[0], revision: 999 })).error, 'Legacy insertion cannot hijack revision lineage');
  const contract = save(await a.load('src/lib/contracts/actions.ts').createContract({
    ...a.load('src/lib/contracts/form-types.ts').emptyContractForm(), company_id: fa.company, business_case_id: deal, deal_id: deal,
    contract_number: 'FICTIONAL-COMMISSION-INVOICE', currency: 'USD', parties: [
      { role_code: 'seller', internal_company_id: null, counterparty_id: fa.parties[0], snapshot: { legal_name: 'Fictional agent supplier' } },
      { role_code: 'buyer', internal_company_id: fa.company, counterparty_id: null, snapshot: { legal_name: 'Fictional Company A' } },
    ], product_lines: [{ product_id: fa.products[0], description: 'Fictional commission cap fixture', quantity: 1, unit: 'MT', unit_price: 2000, currency: 'USD' }],
  }), 'commission payment-cap Contract');
  const invoice = save(await a.load('src/lib/finance/actions.ts').createInvoice({
    ...a.load('src/lib/finance/types.ts').emptyInvoiceForm(), company_id: fa.company, business_case_id: deal, contract_id: contract,
    invoice_number: 'FICTIONAL-COMMISSION-SHARED-PAYMENT', currency: 'USD', status: 'Issued',
    items: [{ product_id: fa.products[0], description: 'Fictional payment cap obligation', quantity: 1, unit_price: 2000, tax_rate: 0 }],
  }), 'shared payment obligation');
  const sharedPayment = save(await operations.registerStandalonePayment(paymentInput), 'shared invoice/commission payment');
  save(await api.allocateCommissionPayment(ids[4], sharedPayment, '600'), 'commission part of shared payment');
  assert.equal((await operations.allocatePayment(sharedPayment, invoice, '500')).success, false, 'Invoice validator includes commission allocations in payment cap');
  save(await operations.allocatePayment(sharedPayment, invoice, '400'), 'remaining invoice allocation');
  const sharedReverse = save(await operations.registerStandalonePayment(paymentInput), 'reverse shared payment');
  save(await operations.allocatePayment(sharedReverse, invoice, '600'), 'invoice part of shared payment');
  assert.equal((await api.allocateCommissionPayment(ids[4], sharedReverse, '500')).success, false, 'Commission validator includes invoice allocations in payment cap');
  const competingPayments = [];
  for (let index = 0; index < 2; index++) competingPayments.push(save(await operations.registerStandalonePayment({ ...paymentInput, amount: '4000' }), 'competing commission payment'));
  const competing = await Promise.all(competingPayments.map(id => api.allocateCommissionPayment(ids[5], id, '4000')));
  assert.equal(competing.filter(result => result.success).length, 1, 'Concurrent allocations cannot exceed family accrual');
  const requiredPartial = save(await api.saveProfitabilityCommission(null, { ...base, basis: 'fixed', rate: '5000', base_quantity: null }), 'required partial commission');
  const requiredPayment = save(await operations.registerStandalonePayment({ ...paymentInput, amount: '3000' }), 'required partial payment');
  save(await api.allocateCommissionPayment(requiredPartial, requiredPayment, '3000'), 'required partial allocation');
  records = await api.getCommissionInputs(deal, [fa.company]);
  const partial = records.data.find(row => row.id === requiredPartial);
  assert.equal(partial.expected_amount, '5000.00'); assert.equal(partial.paid_amount, '3000.00'); assert.equal(partial.outstanding_amount, '2000.00');
  for (const calculation_base of ['net_weight', 'gross_weight', 'purchase_value', 'gross_profit']) {
    const valueBase = ['purchase_value', 'gross_profit'].includes(calculation_base);
    const preview = await api.previewCommission({ ...base, calculation_base, basis: valueBase ? 'percentage' : 'per_mt',
      rate: valueBase ? '1.5' : '30', base_quantity: valueBase ? null : '95.04', base_amount: valueBase ? '150000' : null });
    assert.equal(preview.success, true, preview.error);
    assert.equal(preview.data.final_amount, valueBase ? '2250.00' : '2851.20');
  }
  console.log('Commission engine: six exact bases/override fixtures, review, immutable accruals, line allocation, basis-change warning, family settlement and isolation passed.');
}
