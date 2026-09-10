// Real authenticated server actions and PostgREST against the isolated replay fixture.
export async function verifyShipmentsHttp({ users, fixtures }) {
  const [,a,b] = users;
  const [fa,fb] = fixtures;
  const check=(ok,label)=>{if(!ok)throw new Error('Shipment regression failed: '+label);};
  const actions=a.load('src/lib/logistics/actions.ts');
  const empty=a.load('src/lib/logistics/types.ts').emptyShipmentForm;
  const input={...empty(),company_id:fa.company,contract_id:fa.contractId,business_case_id:fa.deal,remarks:'Fictional operational shipment'};
  const ids=[];
  for(let n=0;n<2;n++){
    const result=await actions.createShipment({...input,container:'TEST-SHIP-'+n});
    check(result.success,'CREATE '+(result.error??''));ids.push(result.id);
  }
  const products=await a.load('src/lib/logistics/line-actions.ts').getShipmentContractProducts(fa.contractId);
  check(products.length===3,'three canonical contract products');
  const lines=products.map(p=>({contract_product_id:p.id,product_id:p.product_id,description:p.description,quantity:10,unit:'MT',net_weight:10,gross_weight:11}));
  const saved=await a.load('src/lib/logistics/line-actions.ts').saveShipmentLines(ids[0],lines);
  check(saved.success,'product lines CREATE '+(saved.error??''));
  const read=await a.load('src/lib/logistics/line-actions.ts').getShipmentLines(ids[0]);
  check(!read.error&&read.data.length===3,'line READ');
  const invalid=await a.load('src/lib/logistics/line-actions.ts').saveShipmentLines(ids[0],[{...lines[0],quantity:-1}]);
  check(!invalid.success,'negative quantity blocked');
  const updated=await actions.updateShipment(ids[0],{...input,container:'TEST-SHIP-0',remarks:'Updated fictional shipment'});
  check(updated.success,'UPDATE '+(updated.error??''));
  const detail=await a.load('src/lib/logistics/db.ts').getShipmentById(ids[0]);
  check(!detail.error&&detail.data.business_case_id===fa.deal&&detail.data.remarks==='Updated fictional shipment','detail and Deal linkage');
  const list=await a.load('src/lib/logistics/db.ts').getShipmentsByContractId(fa.contractId);
  check(!list.error&&ids.every(id=>list.data.some(s=>s.id===id)),'multiple shipments per contract');
  const wrongDeal=await a.client.from('shipments').update({business_case_id:fb.deal}).eq('id',ids[0]);
  check(wrongDeal.error,'wrong Deal rejected in database');
  const privateRead=await b.client.from('shipments').select('id').in('id',ids);
  check(!privateRead.error&&privateRead.data.length===0,'private shipment isolation');
  const privateLines=await b.client.from('shipment_lines').select('id').eq('shipment_id',ids[0]);
  check(!privateLines.error&&privateLines.data.length===0,'private line isolation');
  const denied=await b.load('src/lib/logistics/line-actions.ts').saveShipmentLines(ids[0],lines);
  check(!denied.success,'cross company line write denied');
  const internal=await b.load('src/lib/logistics/actions.ts').createShipment({...empty(),company_id:fb.company,contract_id:fb.contractId,business_case_id:fa.deal,remarks:'Internal Company B logistics context'});
  check(internal.success,'internal legal party may own shipment '+(internal.error??''));
  const internalAudit=await b.client.from('timeline_events').select('id').eq('entity_type','shipment').eq('entity_id',internal.id);
  check(!internalAudit.error&&internalAudit.data.length===1,'internal company shipment records its own audit without cross-company fanout');
  const sharedProducts=await b.load('src/lib/logistics/line-actions.ts').getShipmentContractProducts(fb.contractId);
  const internalLines=await b.load('src/lib/logistics/line-actions.ts').saveShipmentLines(internal.id,sharedProducts.map(p=>({contract_product_id:p.id,product_id:p.product_id,description:p.description,quantity:1,unit:'MT'})));
  check(internalLines.success,'internal contract legal lines retain canonical Product FK '+(internalLines.error??''));
  const privateFromA=await a.client.from('shipments').select('id').eq('id',internal.id);
  check(!privateFromA.error&&privateFromA.data.length===0,'Company B private operational record not shared merely by Deal');
  const temporary=await actions.createShipment({...input,remarks:'Fictional removable planned shipment'});
  check(temporary.success,'temporary CREATE');
  const removed=await actions.deleteShipment(temporary.id);
  check(removed.success,'planned DELETE');
  const delivered=await actions.updateShipment(ids[1],{...input,status:'Delivered',container:'TEST-SHIP-1',vessel:'Fictional vessel',voyage:'TEST-1',port_of_loading:'Test origin',port_of_destination:'Test destination',consignee:'Fictional consignee',notify_party:'Fictional notify',etd:'2026-09-01',eta:'2026-09-10',ata:'2026-09-10'});
  // Planned -> Delivered is disallowed. Follow the existing In Transit transition.
  check(!delivered.success,'lifecycle cannot skip In Transit');
  const transitInput={...input,status:'In Transit',container:'TEST-SHIP-1',vessel:'Fictional vessel',voyage:'TEST-1',port_of_loading:'Test origin',port_of_destination:'Test destination',consignee:'Fictional consignee',notify_party:'Fictional notify',etd:'2026-09-01',eta:'2026-09-10',ata:'2026-09-10'};
  check((await actions.updateShipment(ids[1],transitInput)).success,'In Transit transition');
  check((await a.load('src/lib/logistics/line-actions.ts').saveShipmentLines(ids[1],lines)).success,'actual product lines before delivery');
  check((await actions.updateShipment(ids[1],{...transitInput,status:'Delivered'})).success,'Delivered transition');
  const deliveredLines=await a.load('src/lib/logistics/line-actions.ts').getShipmentLines(ids[1]);
  const reparent=await a.client.from('shipment_lines').update({shipment_id:ids[0]}).eq('id',deliveredLines.data[0].id);
  check(reparent.error,'delivered line cannot be moved to editable shipment');
  const deleteDelivered=await actions.deleteShipment(ids[1]);
  check(!deleteDelivered.success,'delivered history cannot be deleted');
  const editDelivered=await actions.updateShipment(ids[1],{...transitInput,status:'Planned'},'Planned');
  check(!editDelivered.success,'client supplied previous status cannot reopen Delivered');
  fa.shipmentIds=ids;fa.shipmentId=ids[0];fb.shipmentId=internal.id;
  return {shipments:2,multiProductLines:3,companyIsolation:true,internalContractContext:true};
}
