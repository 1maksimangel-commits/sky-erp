import assert from 'node:assert/strict';

export async function verifyOperationalDecimalHttp({ users, fixtures }) {
  const [, user] = users;
  const [fixture] = fixtures;
  const actions = user.load('src/lib/finance/operational-actions.ts');
  const saved = (result, label) => { assert.equal(result.success, true, `${label}: ${result.error ?? ''}`); return result.id; };
  const expenseInput = { company_id: fixture.company, business_case_id: fixture.deal,
    amount: 0.1 + 0.2, currency: 'USD', description: 'Fictional decimal boundary expense',
    expense_date: '2026-09-10', status: 'Posted' };
  const expense = saved(await actions.saveExpense(null, expenseInput), 'decimal expense');
  const expenseRead = await user.client.from('expenses').select('amount').eq('id', expense).single();
  assert.equal(expenseRead.error, null);
  assert.equal(expenseRead.data.amount, 0.3, 'Original expense must not freeze a binary tail');
  for (const amount of [Infinity, Number.MAX_SAFE_INTEGER + 1, 'NaN']) {
    assert.equal((await actions.saveExpense(null, { ...expenseInput, amount })).success, false, 'Unsafe amount rejected');
  }

  const invoice = saved(await user.load('src/lib/finance/actions.ts').createInvoice({
    ...user.load('src/lib/finance/types.ts').emptyInvoiceForm(), company_id: fixture.company,
    contract_id: fixture.generatedContractId, business_case_id: fixture.deal,
    invoice_number: 'FICTIONAL-DECIMAL-SETTLEMENT', currency: 'USD', status: 'Issued',
    items: [{ product_id: fixture.products[0], description: 'Fictional decimal obligation', quantity: 1, unit_price: 1, tax_rate: 0 }],
  }), 'decimal invoice');
  const legacyActions = user.load('src/lib/finance/actions.ts');
  for (const rate of [Infinity, Number.MAX_SAFE_INTEGER + 1, 'NaN', '-0.1', '0.0000000000001']) {
    assert.equal((await legacyActions.upsertExchangeRate({base_currency:'CNY',quote_currency:'USD',rate,rate_date:'2026-09-11'})).success, false, 'Invalid or zero-rounded FX rate rejected');
  }
  for (const unsafe of [Number.MAX_SAFE_INTEGER + 1, Number.MAX_SAFE_INTEGER / 10]) {
    const paymentRejected = await legacyActions.registerPayment({
      invoice_id: invoice, amount: unsafe, currency: 'USD', payment_date: '2026-09-10',
      bank_account_id: null, reference: null, notes: null, status: 'Paid',
    });
    assert.equal(paymentRejected.success, false, 'Unsafe invoice payment returns a structured failure');
    assert.equal(typeof paymentRejected.error, 'string');
    const bankRejected = await legacyActions.createBankAccount({
      ...user.load('src/lib/finance/types.ts').emptyBankAccountForm(), company_id: fixture.company,
      name: 'FICTIONAL REJECTED UNSAFE BANK', currency: 'USD', opening_balance: unsafe,
    });
    assert.equal(bankRejected.success, false, 'Unsafe bank opening returns a structured failure');
    assert.equal(typeof bankRejected.error, 'string');
  }
  const paymentInput = { company_id: fixture.company, business_case_id: fixture.deal,
    contract_id: fixture.generatedContractId, payer_counterparty_id: fixture.parties[1], payee_company_id: fixture.company,
    amount: 0.1 + 0.2, currency: 'USD', payment_date: '2026-09-10', status: 'Paid' };
  const payment = saved(await actions.registerStandalonePayment(paymentInput), 'decimal payment');
  const allocation = saved(await actions.allocatePayment(payment, invoice, 0.1 + 0.2), 'decimal allocation');
  for (const [table, id] of [['payments', payment], ['payment_allocations', allocation]]) {
    const read = await user.client.from(table).select('amount').eq('id', id).single();
    assert.equal(read.error, null); assert.equal(read.data.amount, 0.3, `${table} cents preserved`);
  }
  const settled = await user.client.from('invoices').select('outstanding').eq('id', invoice).single();
  assert.equal(settled.error, null); assert.equal(settled.data.outstanding, 0.7);
  assert.equal((await actions.registerStandalonePayment({ ...paymentInput, amount: '0.001' })).success, false, 'Payment cannot round to zero');

  for (const [rate, quantity, expected] of [['30', '95.04', 2851.2], ['0.00125', '100000', 125]]) {
    const commission = saved(await actions.saveCommission(null, {
      company_id: fixture.company, business_case_id: fixture.deal, contract_id: fixture.contractId,
      label: 'Fictional precision commission', currency: 'USD', basis: 'per_mt',
      rate, base_quantity: quantity, status: 'Posted',
    }), 'exact commission');
    const read = await user.client.from('deal_commission_links').select('rate,base_quantity,expected_amount').eq('id', commission).single();
    assert.equal(read.error, null); assert.equal(read.data.expected_amount, expected);
    assert.equal(read.data.rate, Number(rate), 'Rates retain sub-cent precision');
    assert.equal(read.data.base_quantity, Number(quantity));
  }
  console.log('Operational decimal boundary: expense/payment/allocation cents and precise commission rate/quantity passed.');
}
