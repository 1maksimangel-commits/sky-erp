import { verifyInventoryCostHttp } from './inventory-cost-http.mjs';
import { verifyEconomicsIdentityHttp } from './economics-identity-http.mjs';
import { verifyAllocationIntegrityHttp } from './allocation-integrity-http.mjs';
import { verifyOperationalDecimalHttp } from './operational-decimal-http.mjs';

// Only called inside canonical fresh local replay. No final profitability calculation.
export async function verifyEconomicsHttp(core) {
 const {users,fixtures}=core;
 const [admin,a,b]=users,[fa,fb]=fixtures;
 const check=(ok,label)=>{if(!ok)throw new Error('Economics prerequisite: '+label);};
 const saved=(r,label)=>{check(r.success,label+': '+(r.error??''));return r.id;};
 const raw=async(query,label)=>{const r=await query;check(!r.error,label+': '+(r.error?.message??''));return r.data;};
 const input=a.load('src/lib/finance/economic-input-actions.ts');
 const ops=a.load('src/lib/finance/operational-actions.ts');
 const legs=await raw(admin.client.from('contracts').select('id,contract_number').eq('business_case_id',fa.deal).in('contract_number',['CHAIN-1','CHAIN-2','CHAIN-3']),'canonical three-leg chain');
 check(legs.length===3,'three explicit Contract legs retained');
 const invoices=[];
 for(const [index,amount] of [100000,120000,150000].entries()) {
   const company=index===2?fb.company:fa.company;
   const contract=legs.find(x=>x.contract_number==='CHAIN-'+(index+1)).id;
   const id=saved(await admin.load('src/lib/finance/actions.ts').createInvoice({
     ...admin.load('src/lib/finance/types.ts').emptyInvoiceForm(),company_id:company,
     contract_id:contract,business_case_id:fa.deal,invoice_number:'PREWORK-LEG-'+index,
     currency:'USD',status:'Issued',items:[{description:'FICTIONAL obligation only',quantity:1,unit_price:amount,tax_rate:0}],
   }),'chain obligation');
   invoices.push(await raw(admin.client.from('invoices').select('*').eq('id',id).single(),'chain obligation read'));
 }
 check(invoices[0].issuer_counterparty_id===fa.parties[0]&&invoices[0].recipient_company_id===fa.company,'A external purchase');
 check(invoices[1].issuer_company_id===fa.company&&invoices[1].recipient_company_id===fb.company,'one A to B internal transfer');
 check(invoices[2].issuer_company_id===fb.company&&invoices[2].recipient_counterparty_id===fa.parties[1],'B external sale');
 check(invoices.every(i=>i.business_case_id===fa.deal),'one canonical Deal');
 check(invoices.filter(i=>i.issuer_company_id&&i.recipient_company_id).length===1,'explicit internal-transfer elimination key, no duplicate obligation');
 for(const user of [a,b]) check((await raw(user.client.from('invoices').select('id').eq('id',invoices[1].id),'shared obligation')).length===1,'both company perspectives share one ID');
 const internalPayment=saved(await a.load('src/lib/finance/actions.ts').registerPayment({invoice_id:invoices[1].id,amount:120000,currency:'USD',payment_date:'2026-09-10',bank_account_id:null,reference:'FICTIONAL INTERNAL',notes:null,status:'Paid'}),'one internal payment');
 const internal=await raw(b.client.from('payments').select('payer_company_id,payee_company_id,amount').eq('id',internalPayment).single(),'shared canonical payment');
 check(internal.payer_company_id===fb.company&&internal.payee_company_id===fa.company&&internal.amount===120000,'same settlement outgoing B / incoming A');
 const sA=saved(await input.captureReportingInput({company_id:fa.company,invoice_id:invoices[1].id,reporting_currency:'USD',reporting_date:'2026-09-10'}),'A internal reporting perspective');
 saved(await input.captureReportingInput({company_id:fa.company,invoice_id:invoices[0].id,reporting_currency:'USD',reporting_date:'2026-09-10'}),'external USD purchase reporting input');
 saved(await input.captureReportingInput({company_id:fa.company,payment_id:internalPayment,reporting_currency:'USD',reporting_date:'2026-09-10'}),'internal settlement reporting input');
 const sB=saved(await b.load('src/lib/finance/economic-input-actions.ts').captureReportingInput({company_id:fb.company,invoice_id:invoices[1].id,reporting_currency:'USD',reporting_date:'2026-09-10'}),'B internal reporting perspective');
 check(sA!==sB,'separate reporting inputs share the same economic source ID');
 const allocations=[];
 for(const [name,amount] of [['Freight',10000],['Warehouse',5000],['Other',3000]]) {
   const expense=saved(await ops.saveExpense(null,{company_id:fa.company,business_case_id:fa.deal,contract_id:fa.contractId,expense_date:'2026-09-10',description:'FICTIONAL '+name,amount,currency:'USD',status:'Posted'}),'explicit '+name);
   allocations.push(saved(await input.allocateOperationalCost({company_id:fa.company,expense_id:expense,business_case_id:fa.deal,contract_id:fa.contractId,basis:'direct',amount:String(amount),currency:'USD'}),'direct '+name));
   check(!(await input.allocateOperationalCost({company_id:fa.company,expense_id:expense,business_case_id:fa.deal,contract_id:fa.contractId,basis:'manual',amount:'1',currency:'USD'})).success,'cannot double allocate cost');
   check(Boolean((await a.client.from('expenses').update({amount:amount+1}).eq('id',expense)).error),'allocated source amount locked');
 }
 const commission=saved(await ops.saveCommission(null,{company_id:fa.company,business_case_id:fa.deal,contract_id:fa.contractId,label:'FICTIONAL COMMISSION',currency:'USD',basis:'fixed',rate:5000,status:'Posted'}),'5000 commission');
 check(!(await input.allocateOperationalCost({company_id:fb.company,commission_id:commission,business_case_id:fa.deal,contract_id:fa.contractId,basis:'manual',amount:'1',currency:'USD'})).success,'cannot insert allocation under foreign owner with owned source');
 check(!(await input.captureReportingInput({company_id:fb.company,commission_id:commission,reporting_currency:'USD',reporting_date:'2026-09-10'})).success,'cannot insert snapshot under foreign owner with owned source');
 allocations.push(saved(await input.allocateOperationalCost({company_id:fa.company,commission_id:commission,business_case_id:fa.deal,contract_id:fa.contractId,basis:'percentage',basis_value:'100',amount:'5000',currency:'USD'}),'commission allocation'));
 saved(await input.captureReportingInput({company_id:fa.company,commission_id:commission,reporting_currency:'USD',reporting_date:'2026-09-10'}),'commission reporting input');
 const invalidExpense=await raw(a.client.from('expenses').insert({company_id:fa.company,description:'FICTIONAL UNPOSTED',amount:10,currency:'USD',status:'Unposted',expense_date:'2026-09-10'}).select('id').single(),'unposted legacy status fixture');
 check(!(await input.captureReportingInput({company_id:fa.company,expense_id:invalidExpense.id,reporting_currency:'USD',reporting_date:'2026-09-10'})).success,'unknown cost status cannot be captured');
 const nullPayment=await raw(a.client.from('payments').insert({company_id:fa.company,amount:10,currency:'USD',status:null,payer_counterparty_id:fa.parties[0],payee_company_id:fa.company}).select('id').single(),'null legacy payment status fixture');
 check(!(await input.captureReportingInput({company_id:fa.company,payment_id:nullPayment.id,reporting_currency:'USD',reporting_date:'2026-09-10'})).success,'null payment status cannot be captured');
 check((await raw(b.client.from('cost_allocations').select('id').in('id',allocations),'private splits')).length===0,'private company costs are not shared through Deal');
 for(const id of allocations) {
   check((await raw(a.client.from('cost_allocations').update({amount:1}).eq('id',id).select('id'),'immutable update')).length===0,'allocation update denied');
   check((await raw(a.client.from('cost_allocations').delete().eq('id',id).select('id'),'immutable delete')).length===0,'allocation delete denied');
 }
 // Mixed currencies capture explicitly chosen rates, never a latest-rate join.
 const snapshotIds=[];
 for(const [currency,amount,rate,expected] of [['CNY',7000,'0.140000000000','980.00'],['RUB',9000,'0.010000000000','90.00'],['CNY',1,'12345.123456789123','12345.12']]) {
   saved(await admin.load('src/lib/finance/actions.ts').upsertExchangeRate({base_currency:currency,quote_currency:'USD',rate,rate_date:'2026-09-10',source:'FICTIONAL HISTORICAL RATE'}),'rate');
   const fx=await raw(admin.client.from('exchange_rates').select('id').eq('base_currency',currency).eq('quote_currency','USD').eq('rate_date','2026-09-10').single(),'explicit FX choice');
   const expense=saved(await ops.saveExpense(null,{company_id:fa.company,business_case_id:fa.deal,contract_id:fa.contractId,expense_date:'2026-09-10',description:'FICTIONAL '+currency+' expense/bank fee',amount,currency,status:'Posted'}),'multi-currency cost');
   const id=saved(await input.captureReportingInput({company_id:fa.company,expense_id:expense,reporting_currency:'USD',reporting_date:'2026-09-10',exchange_rate_id:fx.id}),'capture historical FX');
   snapshotIds.push(id);
   const before=await input.getReportingInput(id);check(!before.error&&typeof before.data.original_amount==='string'&&typeof before.data.fx_rate==='string','decimal text boundary');
   check(before.data.fx_rate===rate,'FX input text retains twelve decimal places beyond a double round trip');
   check(before.data.original_amount===`${amount}.00`&&before.data.original_currency===currency&&before.data.reporting_currency==='USD'&&before.data.reporting_amount===expected,'chosen rate and original values produce exact reporting input');
   saved(await admin.load('src/lib/finance/actions.ts').upsertExchangeRate({base_currency:currency,quote_currency:'USD',rate:'1',rate_date:'2026-09-10',source:'FICTIONAL CHANGED CURRENT RATE'}),'change mutable rate');
   const after=await input.getReportingInput(id);check(JSON.stringify(before.data)===JSON.stringify(after.data),'historical FX inputs unchanged');
   check(Boolean((await a.client.from('expenses').update({currency:'USD'}).eq('id',expense)).error),'original currency frozen after capture');
   check(!(await input.captureReportingInput({company_id:fa.company,expense_id:expense,reporting_currency:'USD',reporting_date:'2026-09-10',exchange_rate_id:fx.id})).success,'duplicate capture cannot replace historical rate');
   check(!(await b.load('src/lib/finance/economic-input-actions.ts').captureReportingInput({company_id:fb.company,expense_id:expense,reporting_currency:'USD',reporting_date:'2026-09-10',exchange_rate_id:fx.id})).success,'foreign source capture denied');
   await raw(a.client.from('expenses').update({status:'Cancelled'}).eq('id',expense),'later source cancellation');
   check((await input.getReportingInput(id)).data.source_status==='Posted','captured status is explicitly historical, not current eligibility');
 }
 check((await raw(b.client.from('financial_reporting_snapshots').select('id').in('id',snapshotIds),'private FX snapshots')).length===0,'snapshot isolation');
 const ownB=saved(await b.load('src/lib/finance/operational-actions.ts').saveExpense(null,{company_id:fb.company,expense_date:'2026-09-10',description:'FICTIONAL private B cost',amount:'10.00',currency:'USD',status:'Posted'}),'B private cost');
 const inputB=b.load('src/lib/finance/economic-input-actions.ts');
 const allocationB=saved(await inputB.allocateOperationalCost({company_id:fb.company,expense_id:ownB,basis:'direct',amount:'10.00',currency:'USD'}),'B private allocation');
 const snapshotB=saved(await inputB.captureReportingInput({company_id:fb.company,expense_id:ownB,reporting_currency:'USD',reporting_date:'2026-09-10'}),'B private snapshot');
 for(const [table,id] of [['cost_allocations',allocationB],['financial_reporting_snapshots',snapshotB]]) {
   check((await raw(a.client.from(table).select('id').eq('id',id),'reverse private isolation')).length===0,'A cannot read B reporting inputs');
   check((await raw(a.client.from(table).update({company_id:fa.company}).eq('id',id).select('id'),'reverse foreign update')).length===0,'A cannot reparent B reporting inputs');
   check((await raw(a.client.from(table).delete().eq('id',id).select('id'),'reverse foreign delete')).length===0,'A cannot delete B reporting inputs');
 }
 check((await raw(a.client.from('financial_reporting_snapshots').update({fx_rate:999}).eq('id',snapshotIds[0]).select('id'),'snapshot update')).length===0,'snapshot tampering denied');
 // Exercise the actual history triggers independently of the immutable RLS policies.
 for(const [table,id,change,message] of [
   ['financial_reporting_snapshots',snapshotIds[0],'fx_rate=999','Reporting inputs are immutable%'],
   ['cost_allocations',allocations[0],'amount=1','Cost allocations are immutable%'],
 ]) {
   check(/^[0-9a-f-]{36}$/.test(id),'trusted fictional UUID');
   for(const statement of [`update public.${table} set ${change} where id='${id}'::uuid`,`delete from public.${table} where id='${id}'::uuid`]) {
     await core.sql(`begin; do $$ begin begin ${statement}; raise exception 'Immutable trigger did not reject'; exception when raise_exception then if sqlerrm not like '${message}' then raise; end if; end; end $$; rollback;`);
   }
 }
 const bank=saved(await a.load('src/lib/finance/actions.ts').createBankAccount({...a.load('src/lib/finance/types.ts').emptyBankAccountForm(),company_id:fa.company,name:'FICTIONAL DECIMAL',bank_name:'FICTIONAL',currency:'USD',opening_balance:10.075}),'exact bank input');
 check((await raw(a.client.from('bank_accounts').select('opening_balance').eq('id',bank).single(),'exact bank read')).opening_balance===10.08,'10.075 decimal tie persisted as10.08');
 const money=saved(await a.load('src/lib/finance/actions.ts').registerPayment({invoice_id:invoices[0].id,amount:10.075,currency:'USD',payment_date:'2026-09-10',bank_account_id:null,reference:'FICTIONAL ROUNDING',notes:null,status:'Paid'}),'exact payment input');
 check((await raw(a.client.from('payments').select('amount').eq('id',money).single(),'exact payment read')).amount===10.08,'payment decimal tie persisted exactly');
 await verifyInventoryCostHttp(core);
 await verifyEconomicsIdentityHttp(core);
 await verifyAllocationIntegrityHttp(core);
 await verifyOperationalDecimalHttp(core);
 console.log('Economics prerequisites: explicit intercompany chain, elimination identifiers, immutable FX, allocations, cost basis, ownership, scoped numbers and exact decimal inputs passed. No profit calculated.');
}
