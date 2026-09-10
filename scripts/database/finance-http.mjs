// Real authenticated actions against the fresh isolated canonical replay only.
export async function verifyFinanceHttp({ users, fixtures }) {
  const [admin,a,b]=users,[fa,fb]=fixtures;
  const check=(ok,label)=>{if(!ok)throw new Error('Finance regression failed: '+label);};
  const save=(r,label)=>{check(r.success,label+': '+(r.error??''));return r.id;};
  const actions=a.load('src/lib/finance/actions.ts'),ops=a.load('src/lib/finance/operational-actions.ts');
  check(Boolean((await a.client.from('payments').insert({company_id:fa.company,amount:1,currency:'USD'})).error),'raw payment cannot omit explicit parties');
  check(Boolean((await a.client.from('deal_commission_links').insert({company_id:fa.company,business_case_id:fa.deal,currency:'USD',expected_amount:9000})).error),'raw commission cannot omit calculation basis');
  const empty=a.load('src/lib/finance/types.ts').emptyInvoiceForm;
  async function invoice(user,company,contract,number,value,status='Issued',extra={}) {
    const input={...empty(),company_id:company,contract_id:contract,business_case_id:fa.deal,
      invoice_number:number,currency:'USD',status,items:fa.products.map((product_id,index)=>({product_id,description:'Fictional product '+index,quantity:1,unit_price:index===0?value-2:1,tax_rate:0})),...extra};
    return {id:save(await user.load('src/lib/finance/actions.ts').createInvoice(input),'invoice '+number),input};
  }
  const document=(await a.client.from('generated_documents').select('id').eq('contract_id',fa.generatedContractId).eq('document_type','invoice').limit(1)).data[0];
  check(Boolean(document),'existing Commercial Invoice artifact remains separate');
  const sales=await invoice(a,fa.company,fa.generatedContractId,'OPS-100000',100000,'Draft',{generated_document_id:document.id});
  check((await a.client.from('invoices').select('generated_document_id,paid_amount').eq('id',sales.id).single()).data.paid_amount===0,'explicit artifact linkage never pays obligation');
  save(await actions.updateInvoice(sales.id,{...sales.input,notes:'Fictional reviewed obligation'}),'Draft update');
  save(await actions.updateInvoice(sales.id,{...sales.input,status:'Issued'}),'issue invoice');
  const bank=save(await actions.createBankAccount({...a.load('src/lib/finance/types.ts').emptyBankAccountForm(),company_id:fa.company,name:'FICTIONAL OPERATIONS BANK',bank_name:'FICTIONAL TEST BANK',account_number:'TEST-NOT-REAL',currency:'USD',opening_balance:0}),'bank create');
  async function payment(user,invoiceId,value,bankId=null,status='Paid') {
    return save(await user.load('src/lib/finance/actions.ts').registerPayment({invoice_id:invoiceId,amount:value,currency:'USD',payment_date:'2026-09-10',bank_account_id:bankId,reference:'FICTIONAL ONLY',notes:null,status}),'payment '+value);
  }
  const first=await payment(a,sales.id,30000,bank);
  let row=(await a.client.from('invoices').select('*').eq('id',sales.id).single()).data;
  check(Number(row.outstanding)===70000&&row.status==='Partially Paid','partial payment balance');
  await payment(a,sales.id,70000,bank);
  row=(await a.client.from('invoices').select('*').eq('id',sales.id).single()).data;
  check(Number(row.amount)===100000&&Number(row.paid_amount)===100000&&Number(row.outstanding)===0&&row.status==='Paid','100000 = 30000 + 70000');
  const firstAllocation=(await a.client.from('payment_allocations').select('id').eq('payment_id',first).single()).data.id;
  check(!(await a.client.from('payment_allocations').delete().eq('id',firstAllocation)).error,'explicit allocation removal');
  check(Number((await a.client.from('invoices').select('outstanding').eq('id',sales.id).single()).data.outstanding)===30000,'removing last allocation never guesses direct settlement');
  save(await ops.allocatePayment(first,sales.id,30000),'explicit reallocation');
  check(Number((await a.client.rpc('finance_bank_balance',{p_bank_account_id:bank})).data)===100000,'posted incoming bank balance');
  check(!(await a.client.from('bank_accounts').update({current_balance:9000000}).eq('id',bank)).error,'bank balance is a derived projection');
  check(Number((await a.client.from('bank_accounts').select('current_balance').eq('id',bank).single()).data.current_balance)===100000,'forged cached bank balance rederived');
  check(Boolean((await a.client.from('bank_accounts').update({currency:'CNY'}).eq('id',bank)).error),'bank currency cannot reinterpret posted originals');
  check(Boolean((await a.client.from('bank_accounts').update({opening_balance:9000000}).eq('id',bank)).error),'opening balance locked after transaction history');
  check(!(await actions.registerPayment({invoice_id:sales.id,amount:1,currency:'USD',payment_date:'2026-09-10',bank_account_id:null,reference:null,notes:null,status:'Paid'})).success,'overpayment rejected');
  check(Boolean((await a.client.from('invoices').update({party_snapshot:null}).eq('id',sales.id)).error),'snapshot clearing rejected');
  check(Boolean((await a.client.from('invoices').update({status:'Draft'}).eq('id',sales.id)).error),'issued cannot reopen');
  check(Boolean((await a.client.from('payments').update({amount:1}).eq('id',first)).error),'original amount immutable');
  const unpaid=await invoice(a,fa.company,fa.generatedContractId,'OPS-150000',150000);
  const pending=await payment(a,unpaid.id,100000,null,'Pending');
  check(Number((await a.client.from('invoices').select('outstanding').eq('id',unpaid.id).single()).data.outstanding)===150000,'Pending allocations are not settled money');
  save(await ops.setPaymentStatus(pending,'Paid'),'post Pending payment');
  check(Number((await a.client.from('invoices').select('outstanding').eq('id',unpaid.id).single()).data.outstanding)===50000,'150000 less 100000 = 50000');
  await a.client.from('invoices').update({paid_amount:150000,outstanding:0,status:'Paid'}).eq('id',unpaid.id);
  check(Number((await a.client.from('invoices').select('outstanding').eq('id',unpaid.id).single()).data.outstanding)===50000,'balance forgery cannot settle obligation');
  const outgoing=await invoice(a,fa.company,fa.contractId,'OPS-PURCHASE',20000);
  await payment(a,outgoing.id,20000,bank);
  check(Number((await a.client.rpc('finance_bank_balance',{p_bank_account_id:bank})).data)===80000,'outgoing derived from explicit Buyer company');
  const shared=await invoice(admin,fa.company,fb.contractId,'OPS-INTERNAL',5000);
  const internal=await payment(a,shared.id,5000,bank);
  const sharedPayment=await b.client.from('payments').select('payer_company_id,payee_company_id').eq('id',internal).single();
  check(!sharedPayment.error&&sharedPayment.data.payer_company_id===fb.company&&sharedPayment.data.payee_company_id===fa.company,'one internal payment is outgoing B and incoming A');
  check((await b.client.from('invoices').select('id').eq('id',shared.id)).data.length===1,'explicit internal invoice visibility');
  check((await b.client.from('invoices').select('id').eq('id',sales.id)).data.length===0,'private invoice hidden B');
  check((await b.client.from('payments').select('id').eq('id',first)).data.length===0,'private payment hidden B');
  check((await b.client.from('bank_accounts').select('id').eq('id',bank)).data.length===0,'bank details never shared through payment');
  check(!(await b.load('src/lib/finance/actions.ts').cancelInvoice(shared.id)).success,'shared visibility does not grant writes');
  const splitA=await invoice(a,fa.company,fa.generatedContractId,'OPS-SPLIT-A',60000);
  const splitB=await invoice(a,fa.company,fa.generatedContractId,'OPS-SPLIT-B',40000);
  const split=save(await ops.registerStandalonePayment({company_id:fa.company,business_case_id:fa.deal,contract_id:fa.generatedContractId,payer_company_id:null,payer_counterparty_id:fa.parties[1],payee_company_id:fa.company,payee_counterparty_id:null,amount:100000,currency:'USD',payment_date:'2026-09-10',status:'Paid'}),'standalone payment');
  check(Boolean((await a.client.from('payments').update({payee_company_id:null,amount:1}).eq('id',split)).error),'standalone payment cannot clear its internal party to bypass original immutability');
  check(Number((await a.client.from('payments').select('amount').eq('id',split).single()).data.amount)===100000,'failed marker clearing preserves original amount');
  save(await ops.allocatePayment(split,splitA.id,60000),'split allocation A');
  save(await ops.allocatePayment(split,splitB.id,40000),'split allocation B');
  check(!(await ops.allocatePayment(split,unpaid.id,1)).success,'allocation cannot exceed payment');
  for(const target of [splitA.id,splitB.id]) check(Number((await a.client.from('invoices').select('outstanding').eq('id',target).single()).data.outstanding)===0,'split obligation settled once');
  save(await ops.setPaymentStatus(split,'Cancelled'),'cancel allocation payment');
  check(Number((await a.client.from('invoices').select('outstanding').eq('id',splitA.id).single()).data.outstanding)===60000,'cancellation refreshes allocations');
  const categories=(await a.client.from('expense_categories').select('id,code')).data;
  for(const [code,amount] of [['FREIGHT',1000],['STORAGE',200],['BANK',30]]) {
    const id=save(await ops.saveExpense(null,{company_id:fa.company,business_case_id:fa.deal,contract_id:fa.contractId,shipment_id:fa.shipmentId??null,category_id:categories.find(c=>c.code===code).id,expense_date:'2026-09-10',description:'FICTIONAL '+code,amount,currency:'USD',status:'Posted'}),'expense '+code);
    check((await b.client.from('expenses').select('id').eq('id',id)).data.length===0,'private expenses hidden');
  }
  for(const [basis,rate,base_quantity,base_amount,expected] of [['per_mt',30,95.04,null,2851.2],['percentage',0.5,null,100000,500]]) {
    const id=save(await ops.saveCommission(null,{company_id:fa.company,business_case_id:fa.deal,contract_id:fa.contractId,beneficiary_id:fa.parties[0],label:'FICTIONAL '+basis,currency:'USD',basis,rate,base_quantity,base_amount,status:'Posted'}),'commission');
    const saved=(await a.client.from('deal_commission_links').select('expected_amount,basis,rate').eq('id',id).single()).data;
    check(Number(saved.expected_amount)===expected,'exact numeric '+basis+' commission');
    check((await b.client.from('deal_commission_links').select('id').eq('id',id)).data.length===0,'private commissions hidden');
  }
  save(await admin.load('src/lib/finance/actions.ts').upsertExchangeRate({base_currency:'USD',quote_currency:'CNY',rate:7.25,rate_date:'2026-09-10',source:'FICTIONAL FIXTURE'}),'FX rate');
  const originalPayment=(await a.client.from('payments').select('currency,amount').eq('id',first).single()).data;
  check(originalPayment.currency==='USD'&&Number(originalPayment.amount)===30000,'FX preserves original amount and currency');
  const cancelled=await invoice(a,fa.company,fa.generatedContractId,'OPS-CANCEL',10,'Draft');
  const reserved=await payment(a,cancelled.id,5,null,'Pending');
  check(!(await actions.updateInvoice(cancelled.id,cancelled.input)).success,'Pending allocations reserve invoice values');
  save(await actions.cancelInvoice(cancelled.id),'cancel unpaid Draft');
  check(!(await ops.setPaymentStatus(reserved,'Paid')).success,'cancelled obligation cannot receive posted allocated payment');
  save(await ops.setPaymentStatus(reserved,'Cancelled'),'cancel pending reserved payment');
  check(!(await actions.cancelInvoice(sales.id)).success,'cannot cancel paid invoice');
  check(!(await actions.createInvoice({...sales.input,invoice_number:'OPS-100000'})).success,'company invoice number collision rejected');
  for(const user of [a,b]) {
    check(!(await user.load('src/lib/finance/db.ts').getFinanceInvoices()).error,'canonical invoice list');
    check(!(await user.load('src/lib/finance/db.ts').getFinancePayments()).error,'canonical payment list');
    check(!(await user.load('src/lib/finance/db.ts').getBankAccounts()).error,'canonical bank list');
  }
  fa.invoiceId=sales.id;fa.paymentId=first;fb.invoiceId=shared.id;fb.paymentId=internal;
  console.log('Finance: canonical invoice CRUD, explicit internal parties, allocations, partial/Cancelled/Pending balances, expenses, exact commissions, bank/FX and isolation passed.');
}
