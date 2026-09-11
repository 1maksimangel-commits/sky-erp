import assert from 'node:assert/strict';
import { verifyProfitabilityInventoryHttp } from './profitability-inventory-http.mjs';
import { verifyProfitabilityCommissionHttp } from './profitability-commission-http.mjs';

export async function verifyProfitabilityHttp(core) {
  const chain = await verifyProfitabilityInventoryHttp(core);
  await verifyProfitabilityCommissionHttp(core);
  const [admin, a, b] = core.users, [fa] = core.fixtures;
  const raw = async (q, label) => { const r = await q; assert.equal(r.error, null, `${label}: ${r.error?.message}`); return r.data; };
  const saved = (r, label) => { assert.equal(r.success, true, `${label}: ${r.error}`); return r.id; };
  const reportApi = admin.load('src/lib/finance/profitability-actions.ts');
  const report = async (company_id = null, deal_id = chain.dealId) => { const r = await reportApi.getDealProfitability({ deal_id, company_id, reporting_currency:'USD' }); assert.equal(r.error,null); return r.data; };
  const ops = admin.load('src/lib/finance/operational-actions.ts'), prep = admin.load('src/lib/finance/economic-input-actions.ts');
  async function expense(owner, contractIndex, category, amount, currency='USD') {
    const c = await raw(admin.client.from('expense_categories').upsert({code:'PROFIT-'+category,name:'Fictional '+category},{onConflict:'code'}).select('id').single(),'category');
    const id = saved(await ops.saveExpense(null,{company_id:owner,business_case_id:chain.dealId,contract_id:chain.contractIds[contractIndex],category_id:c.id,amount,currency,expense_date:'2026-09-10',description:'Fictional '+category,status:'Posted'}),'cost');
    saved(await prep.allocateOperationalCost({company_id:owner,expense_id:id,business_case_id:chain.dealId,contract_id:chain.contractIds[contractIndex],contract_product_id:chain.contractProductIds[contractIndex],amount,currency,basis:'direct'}),'explicit product cost allocation');
    return id;
  }
  await expense(chain.companyA,1,'freight','10000');
  await expense(chain.companyB,2,'warehouse','5000');
  await expense(chain.companyB,2,'bank','2000');
  await expense(chain.companyB,2,'other','3000');
  const comm = admin.load('src/lib/finance/commission-actions.ts');
  const commissionId = saved(await comm.saveProfitabilityCommission(null,{company_id:chain.companyA,business_case_id:chain.dealId,contract_id:chain.contractIds[1],beneficiary_id:fa.parties[0],beneficiary_name:'Fictional independent seafood agent',beneficiary_type:'agent',label:'Golden agent commission',basis:'fixed',rate:'5000',currency:'USD',calculation_base:'manual',status:'Posted',confirmed:true,allocation:{scope:'contract_product',contract_product_id:chain.contractProductIds[1]}}),'agent accrual');
  let consolidated = await report();
  assert.equal(consolidated.actual.complete,true,JSON.stringify(consolidated.actual.gaps));
  assert.equal(consolidated.actual.external_revenue,'150000.00');
  assert.equal(consolidated.actual.cogs,'100000.00');
  assert.equal(consolidated.actual.operating_costs,'25000.00');
  assert.equal(consolidated.actual.agent_commissions,'5000.00');
  assert.equal(consolidated.actual.gross_profit,'50000.00');
  assert.equal(consolidated.actual.net_contribution,'25000.00');
  assert.equal(consolidated.actual.net_margin_percent,'16.6667');
  assert.equal(consolidated.expected.net_contribution,'25000.00');
  assert.equal(consolidated.eliminations.some(e=>e.source_id===chain.invoiceIds[1]),true);
  const companyA=await report(chain.companyA),companyB=await report(chain.companyB);
  assert.equal(companyA.actual.intercompany_revenue,'120000.00');
  assert.equal(companyA.actual.external_cogs,'100000.00');
  assert.equal(companyA.actual.net_contribution,'5000.00');
  assert.equal(companyB.actual.external_revenue,'150000.00');
  assert.equal(companyB.actual.intercompany_cogs,'120000.00');
  assert.equal(companyB.actual.net_contribution,'20000.00');
  const ownB=await b.load('src/lib/finance/profitability-actions.ts').getDealProfitability({deal_id:chain.dealId,company_id:chain.companyB,reporting_currency:'USD'});
  assert.equal(ownB.error,null);assert.equal(ownB.data.actual.intercompany_cogs,'120000.00');
  assert.equal(ownB.data.actual.net_contribution,'20000.00','B company report does not require or reveal A acquisition margin');
  assert.ok((await b.load('src/lib/finance/profitability-actions.ts').getDealProfitability({deal_id:chain.dealId,company_id:null,reporting_currency:'USD'})).error,'partial RLS visibility cannot masquerade as consolidation');
  assert.ok((await a.load('src/lib/finance/profitability-actions.ts').getDealProfitability({deal_id:chain.dealId,company_id:chain.companyB,reporting_currency:'USD'})).error);
  const product=consolidated.products.find(p=>p.product_id===chain.productId);
  assert.equal(product.actual.net_contribution,'25000.00','explicit product cost allocations reconcile');
  const partial=await report(null,chain.partialDealId);
  assert.equal(partial.actual.cogs,'40000.00');assert.equal(partial.progress.unrecognized_sale,'90000.00');
  assert.equal(partial.actual.complete,false);assert.equal(partial.actual.net_contribution,null,'unmatched invoiced quantity cannot inflate finalized profit');
  const finance=admin.load('src/lib/finance/actions.ts');
  const pay=async(index,amount)=>saved(await finance.registerPayment({invoice_id:chain.invoiceIds[index],amount,currency:'USD',payment_date:'2026-09-10',bank_account_id:null,reference:'Fictional golden settlement',notes:null,status:'Paid'}),'invoice payment');
  await pay(2,100000);
  assert.equal((await report()).cash.receivables,'50000.00');
  await pay(2,50000);await pay(0,100000);await pay(1,120000);
  const agentPayment=saved(await ops.registerStandalonePayment({company_id:chain.companyA,business_case_id:chain.dealId,contract_id:chain.contractIds[1],payer_company_id:chain.companyA,payee_counterparty_id:fa.parties[0],amount:'3000',currency:'USD',payment_date:'2026-09-10',status:'Paid'}),'agent cash payment');
  saved(await comm.allocateCommissionPayment(commissionId,agentPayment,'3000'),'agent allocation');
  consolidated=await report();
  assert.equal(consolidated.cash.received,'150000.00');assert.equal(consolidated.cash.paid,'103000.00');
  assert.equal(consolidated.cash.receivables,'0.00');assert.equal(consolidated.cash.payables,'0.00');
  assert.equal(consolidated.cash.commission_accrued,'5000.00');assert.equal(consolidated.cash.commission_paid,'3000.00');assert.equal(consolidated.cash.commission_outstanding,'2000.00');
  assert.equal(consolidated.actual.net_contribution,'25000.00','cash settlement does not double-count cost');
  for(const [currency,amount,rate,category] of [['CNY','7000','0.14','freight'],['RUB','9000','0.01','bank']]) {
    const id=await expense(chain.companyB,2,category,amount,currency);
    saved(await finance.upsertExchangeRate({base_currency:currency,quote_currency:'USD',rate,rate_date:'2026-09-11',source:'FICTIONAL PROFIT RATE'}),'explicit rate');
    const rateRow=await raw(admin.client.from('exchange_rates').select('id').eq('base_currency',currency).eq('quote_currency','USD').eq('rate_date','2026-09-11').single(),'rate ID');
    const missing=await report();assert.equal(missing.actual.complete,false,'missing FX is not zero');
    saved(await prep.captureReportingInput({company_id:chain.companyB,expense_id:id,reporting_currency:'USD',reporting_date:'2026-09-11',exchange_rate_id:rateRow.id}),'capture cost FX');
  }
  const before=await report();assert.equal(before.actual.net_contribution,'23930.00');
  for(const currency of ['CNY','RUB']) saved(await finance.upsertExchangeRate({base_currency:currency,quote_currency:'USD',rate:'9.999999999999',rate_date:'2026-09-11',source:'FICTIONAL CHANGED LATEST'}),'change latest');
  const after=await report();assert.deepEqual(after.actual,before.actual);assert.deepEqual(after.expected,before.expected);assert.deepEqual(after.cash,before.cash);
  assert.equal((await raw(admin.client.from('payments').select('id').eq('invoice_id',chain.invoiceIds[1]),'one internal payment')).length,1);
  console.log('Canonical profitability: golden25k, A5k/B20k, internal120kelimination, realizedlotCOGS, explicitproductallocations, partialincomplete, cash≠accrual, agent5000/3000/2000 and immutablemulti-currency23930 passed.');
  core.profitabilityFixture=chain;
}
