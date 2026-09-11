import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function compile(file, dependencies = {}) {
  const context = { exports: {}, require: name => { if (!(name in dependencies)) throw new Error('Unexpected dependency '+name); return dependencies[name]; } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022} }).outputText, context);
  return context.exports;
}
const exact = compile('src/lib/finance/exact.ts');
const { calculateDealProfitability: calculate } = compile('src/lib/finance/profitability-engine.ts', {'./exact':exact});
const D = exact.Exact.of;
test('exact canonical accounting has no floating drift or ratio rounding loss',()=>{
  assert.equal(D('100000').sub(D('30000')).sub(D('70000')).format(),'0.00');
  assert.equal(D('95.04').mul(D('30')).format(),'2851.20');
  assert.equal(D('100000').mul(D('0.05')).format(),'5000.00');
  assert.equal(D('150000').mul(D('1.5')).div(D('100')).format(),'2250.00');
  assert.equal(D('1').div(D('3')).mul(D('3')).format(),'1.00');
  assert.equal(D('-1.005').format(),'-1.01');
  assert.equal(D('9007199254740993.123456789').mul(D('0.000000001')).format(18),'9007199.254740993123456789');
  assert.throws(()=>D('NaN'));assert.throws(()=>D('1').div(D('0')));
});
function fixture(){
  const invoices=['cod','pollock'].map(id=>({id,company_id:'A',contract_id:'contract',invoice_number:id,currency:'USD',status:'Issued',issuer_company_id:'A',recipient_company_id:null,amount:'100',subtotal:'100',outstanding:'100'}));
  return {deal_id:'deal',company_id:null,reporting_currency:'USD',companies:[{id:'A',name:'Fictional Company'}],contracts:[],contract_lines:[],invoices,
    invoice_lines:invoices.map(i=>({id:i.id+'-line',invoice_id:i.id,product_id:i.id,description:i.id,quantity:'1',unit_price:'100',unit:null})),
    realizations:invoices.map(i=>({realization_id:i.id+'-release',company_id:'A',invoice_id:i.id,invoice_item_id:i.id+'-line',contract_id:'contract',contract_product_id:null,product_id:i.id,stock_movement_id:i.id+'-movement',quantity:'1',unit:'MT',invoice_status:'Issued',local_unit_cost:'50',local_currency:'USD',local_fx_rate:'1',local_snapshot_id:null,ultimate_unit_cost:'50',ultimate_currency:'USD',ultimate_fx_rate:'1',ultimate_snapshot_id:null,ultimate_source_movement_id:i.id+'-receipt',ultimate_company_id:'A',lineage_gap:false,fx_gap:false,acquisition_internal:false,acquisition_seller_company_id:null,source_ids:[]})),
    payments:[],payment_allocations:[],expenses:[],snapshots:[],deal_lines:[],internal_commission_ids:[],products:[{id:'cod',name:'Pacific Cod'},{id:'pollock',name:'Pollock'}],
    commissions:[{id:'commission',root_id:'commission',is_current:true,company_id:'A',business_case_id:'deal',contract_id:null,beneficiary_name:'Fictional Agent',beneficiary_type:'agent',basis:'fixed',rate:'10',currency:'USD',expected_amount:'10',paid_amount:'0',outstanding_amount:'10',status:'Posted',basis_changed:false,is_agent:true}],
    allocations:[{id:'allocation',company_id:'A',business_case_id:'deal',expense_id:null,commission_id:'commission',product_id:'cod',contract_product_id:null,deal_product_id:null,amount:'10',currency:'USD'}]};
}
test('product-specific commission never reaches another product; cash is separate',()=>{
  const result=calculate(fixture());
  assert.equal(result.actual.net_contribution,'90.00');
  assert.equal(result.products.find(p=>p.product_id==='cod').actual.net_contribution,'40.00');
  assert.equal(result.products.find(p=>p.product_id==='pollock').actual.net_contribution,'50.00');
  assert.equal(result.cash.commission_outstanding,'10.00');assert.equal(result.cash.paid,'0.00');
});
test('missing release, unknown COGS, missing FX and unallocated costs cannot become zero profit inputs',()=>{
  for(const change of [f=>{f.realizations=[];},f=>{f.realizations[0].ultimate_unit_cost=null;},f=>{f.invoices[0].currency='CNY';},f=>{f.allocations=[];}]){
    const f=fixture();change(f);const result=calculate(f);assert.equal(result.actual.complete,false);assert.equal(result.actual.net_contribution,null);
  }
});
test('internal party aliases and internal beneficiaries cannot silently become external economics',()=>{
  const aliased=fixture();
  aliased.contracts=[{id:'contract',company_id:'A',contract_number:'ALIAS',status:'Active',currency:'USD',parties_reviewed:true,party_alias_conflict:true,seller_company_id:'A',buyer_company_id:null}];
  aliased.contract_lines=[{id:'line',contract_id:'contract',product_id:'cod',description:'Fictional line',quantity:'1',unit_price:'100',agreed_amount:null,currency:'USD',unit:'MT'}];
  const flagged=calculate(aliased);
  assert.equal(flagged.expected.complete,false);
  assert.equal(flagged.expected.net_contribution,null,'a Company profile used as an external party cannot finalise expected profit');
  assert.equal(flagged.actual.gaps.some(g=>g.code==='internal_party_alias'),true);
  const internalCost=fixture();
  internalCost.internal_commission_ids=['commission'];
  const paired=calculate(internalCost);
  assert.equal(paired.actual.complete,false);
  assert.equal(paired.actual.net_contribution,null,'an internal beneficiary cost is never consolidated as an external cost');
  assert.equal(paired.actual.gaps.some(g=>g.code==='unpaired_internal_cost'),true);
});
test('cancelled obligations excluded; zero revenue margins are undefined',()=>{
  const f=fixture();f.invoices.forEach(i=>i.status='Cancelled');const r=calculate(f);
  assert.equal(r.actual.revenue,'0.00');assert.equal(r.actual.gross_margin_percent,null);assert.equal(r.cash.receivables,'0.00');
});

// Supplier -> A -> B -> Customer, as a pure engine fixture so consolidation math is
// locked without requiring the containerised stack.
function chainFixture(){
  const contract=(id,seller,buyer)=>({id,company_id:seller??buyer,contract_number:id,status:'Active',currency:'USD',parties_reviewed:true,party_alias_conflict:false,seller_company_id:seller,buyer_company_id:buyer});
  const line=(id,contract_id,price)=>({id,contract_id,product_id:'cod',description:'Fictional cod',quantity:'100',unit_price:price,agreed_amount:null,currency:'USD',unit:'MT'});
  const invoice=(id,contract_id,issuer,recipient,total)=>({id,company_id:issuer??recipient,contract_id,invoice_number:id,currency:'USD',status:'Issued',issuer_company_id:issuer,recipient_company_id:recipient,amount:total,subtotal:total,outstanding:'0'});
  const invoiceLine=(id,invoice_id,price)=>({id,invoice_id,product_id:'cod',description:'Fictional cod',quantity:'100',unit_price:price,unit:null});
  const realization=(id,company,invoice_id,item,local,ultimate,internal)=>({realization_id:id,company_id:company,invoice_id,invoice_item_id:item,contract_id:'c1',contract_product_id:null,product_id:'cod',stock_movement_id:id+'-move',quantity:'100',unit:'MT',invoice_status:'Issued',local_unit_cost:local,local_currency:'USD',local_fx_rate:'1',local_snapshot_id:null,ultimate_unit_cost:ultimate,ultimate_currency:'USD',ultimate_fx_rate:'1',ultimate_snapshot_id:null,ultimate_source_movement_id:id+'-origin',ultimate_company_id:'A',lineage_gap:false,fx_gap:false,acquisition_internal:internal,acquisition_seller_company_id:internal?'A':null,source_ids:[]});
  const cost=(id,company,amount,category)=>({id,company_id:company,business_case_id:'deal',contract_id:null,currency:'USD',amount,status:'Posted',category,description:'Fictional '+category,internal_beneficiary:false});
  const alloc=(id,company,expense_id,amount)=>({id,company_id:company,business_case_id:'deal',expense_id,commission_id:null,product_id:'cod',contract_product_id:null,deal_product_id:null,amount,currency:'USD'});
  return {deal_id:'deal',company_id:null,reporting_currency:'USD',
    companies:[{id:'A',name:'Fictional Company A'},{id:'B',name:'Fictional Company B'}],
    contracts:[contract('c0',null,'A'),contract('c1','A','B'),contract('c2','B',null)],
    contract_lines:[line('l0','c0','1000'),line('l1','c1','1200'),line('l2','c2','1500')],
    invoices:[invoice('i0','c0',null,'A','100000'),invoice('i1','c1','A','B','120000'),invoice('i2','c2','B',null,'150000')],
    invoice_lines:[invoiceLine('i0-line','i0','1000'),invoiceLine('i1-line','i1','1200'),invoiceLine('i2-line','i2','1500')],
    realizations:[realization('rA','A','i1','i1-line','1000','1000',false),realization('rB','B','i2','i2-line','1200','1000',true)],
    payments:[],payment_allocations:[],
    expenses:[cost('e-freight','A','10000','freight'),cost('e-warehouse','B','5000','warehouse'),cost('e-bank','B','2000','bank'),cost('e-other','B','3000','other')],
    allocations:[alloc('a1','A','e-freight','10000'),alloc('a2','B','e-warehouse','5000'),alloc('a3','B','e-bank','2000'),alloc('a4','B','e-other','3000'),
      {id:'a5',company_id:'A',business_case_id:'deal',expense_id:null,commission_id:'commission',product_id:'cod',contract_product_id:null,deal_product_id:null,amount:'5000',currency:'USD'}],
    snapshots:[],deal_lines:[],internal_commission_ids:[],products:[{id:'cod',name:'Pacific Cod'}],
    commissions:[{id:'commission',root_id:'commission',is_current:true,company_id:'A',business_case_id:'deal',contract_id:'c1',beneficiary_name:'Fictional Agent',beneficiary_type:'agent',basis:'fixed',rate:'5000',currency:'USD',expected_amount:'5000',paid_amount:'0',outstanding_amount:'5000',status:'Posted',basis_changed:false,is_agent:true}]};
}
test('golden chain: consolidation eliminates the internal leg and never double-counts',()=>{
  const group=calculate(chainFixture());
  assert.equal(group.actual.complete,true,JSON.stringify(group.actual.gaps));
  assert.equal(group.actual.external_revenue,'150000.00');
  assert.equal(group.actual.intercompany_revenue,'0.00','internal revenue must not survive consolidation');
  assert.equal(group.actual.external_cogs,'100000.00');
  assert.equal(group.actual.intercompany_cogs,'0.00','internal COGS must not survive consolidation');
  assert.equal(group.actual.operating_costs,'25000.00');
  assert.equal(group.actual.agent_commissions,'5000.00');
  assert.equal(group.actual.gross_profit,'50000.00');
  assert.equal(group.actual.net_contribution,'25000.00');
  assert.equal(group.expected.net_contribution,'25000.00');
  assert.equal(group.eliminations.some(e=>e.source_id==='i1'),true);
  const byCompany=Object.fromEntries(group.company_breakdown.map(row=>[row.company_id,row]));
  assert.equal(byCompany.A.actual.intercompany_revenue,'120000.00','Company A retains the internal sale');
  assert.equal(byCompany.A.actual.external_cogs,'100000.00');
  assert.equal(byCompany.A.actual.net_contribution,'5000.00');
  assert.equal(byCompany.B.actual.external_revenue,'150000.00');
  assert.equal(byCompany.B.actual.intercompany_cogs,'120000.00','Company B retains the internal purchase');
  assert.equal(byCompany.B.actual.net_contribution,'20000.00');
  // A + B before elimination is 25000 only because the internal leg nets out.
  assert.equal(D(byCompany.A.actual.net_contribution).add(D(byCompany.B.actual.net_contribution)).format(),'25000.00');
});
test('unresolved internal lineage cannot silently produce consolidated profit',()=>{
  const broken=chainFixture();
  broken.realizations[1].lineage_gap=true; broken.realizations[1].ultimate_unit_cost=null;
  const group=calculate(broken);
  assert.equal(group.actual.complete,false);
  assert.equal(group.actual.net_contribution,null);
  assert.equal(group.actual.gaps.some(g=>g.code==='missing_cost_basis'),true);
});
