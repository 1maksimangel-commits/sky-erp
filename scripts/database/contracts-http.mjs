import { randomUUID, createHash } from 'node:crypto';
import { coreSource } from './core-source.mjs';

// Uses only the replay runner's fictional authenticated fixtures and local client.
export async function verifyContractsHttp({ users, fixtures }) {
  const [admin,a,b] = users;
  const [fa,fb] = fixtures;
  const check = (ok,label) => { if (!ok) throw new Error('Contract regression failed: '+label); };
  const save = (result,label) => { check(result.success, label+': '+(result.error ?? '')); return result.id; };
  const model = a.load('src/lib/contracts/parties.ts');
  const party = (role, kind, id, name) => ({ role_code: role, internal_company_id: kind==='company'?id:null, counterparty_id: kind==='counterparty'?id:null, snapshot:{ legal_name:name,address:'Fictional agreed address' } });
  const supplier = party('seller','counterparty',fa.parties[0],'PACIFIC TEST SEAFOOD CO.');
  const companyA = party('buyer','company',fa.company,'SKY INTERNAL A');
  const companyB = party('buyer','company',fb.company,'SKY INTERNAL B');
  const buyer = party('buyer','counterparty',fa.parties[1],'ASIA TEST IMPORT CO.');
  const lines = fa.products.map((product_id,i) => ({ product_id, description:['Pacific Cod','Pollock','Halibut'][i]+' legal specification',quantity:10+i,unit:'kg',unit_price:2.5,currency:'USD',net_weight:10+i,gross_weight:11+i,packing:'Fictional carton',origin:'Fictional origin' }));
  const base = { ...a.load('src/lib/contracts/form-types.ts').emptyContractForm(),company_id:fa.company,business_case_id:fa.deal,deal_id:fa.deal,contract_date:'2026-09-09',product_lines:lines,legal_snapshot:{notes:'Fictional agreed text'},payment_terms:'30 days' };
  const legs = [[supplier,companyA],[{...companyA,role_code:'seller'},companyB],[{...companyB,role_code:'seller'},buyer]];
  const ids=[];
  for (const [index,parties] of legs.entries()) ids.push(save(await admin.load('src/lib/contracts/actions.ts').createContract({...base,contract_number:'CHAIN-'+(index+1),parties}), 'chain CREATE'));
  for (const [i,id] of ids.entries()) {
    const result=await a.load('src/lib/contracts/db.ts').getContractById(id);
    check(!result.error && result.data.product_lines.length===3 && result.data.deal_id===fa.deal,'joined Contract READ');
    check(result.data.parties.length===2 && result.data.product_lines[0].packing==='Fictional carton','legal parties and commercial lines retained');
    check(model.contractDirection(result.data.parties,fa.company)===(i===0?'purchase-side':i===1?'sale-side':'not a party'),'Company A perspective');
    check(model.contractDirection(result.data.parties,fb.company)===(i===0?'not a party':i===1?'purchase-side':'sale-side'),'Company B perspective');
  }
  check((await a.load('src/lib/contracts/db.ts').getRelatedContracts(fa.deal)).length===3,'one Deal many Contracts');
  const dealContracts=await a.load('src/lib/deals/db.ts').getDealWorkspaceData(fa.deal);
  check(!dealContracts.error && dealContracts.data.contracts.length===3 && dealContracts.data.contracts.every(c=>c.parties_reviewed && c.parties.length===2),'Deal Contract reader uses explicit legal parties');
  check(!(await a.load('src/lib/deals/actions.ts').classifyDealContract({dealId:fa.deal,contractId:ids[0],role:'sales'})).success,'legacy global perspective classification isolated');
  check((await b.load('src/lib/contracts/db.ts').getContractById(ids[0])).data===null,'private leg hidden from B');
  check((await b.load('src/lib/contracts/db.ts').getContractById(ids[1])).data?.parties.length===2,'shared internal-to-internal leg visible to B');
  const forbidden = await b.client.from('contracts').update({title:'forbidden'}).eq('id',ids[1]).select('id');
  check(!forbidden.error && forbidden.data.length===0,'shared party cannot edit owning workspace');
  const graft = await a.client.from('contract_parties').update({internal_company_id:fb.company,counterparty_id:null}).eq('contract_id',ids[0]).eq('role_code','seller');
  check(Boolean(graft.error),'client cannot assign unauthorized internal company');
  const read=await a.load('src/lib/contracts/db.ts').getContractById(ids[0]);
  const input=a.load('src/lib/contracts/form-types.ts').contractToFormInput(read.data);
  save(await a.load('src/lib/contracts/actions.ts').updateContract(ids[0],{...input,title:'Reviewed fictional Contract'}),'Draft UPDATE');
  await admin.client.from('companies').update({address:'Changed master address'}).eq('id',fa.company);
  check((await a.load('src/lib/contracts/db.ts').getContractById(ids[0])).data.parties.find(p=>p.role_code==='buyer').snapshot.address==='Fictional agreed address','master edits preserve legal snapshot');
  const active=await a.client.from('contracts').update({status:'Active'}).eq('id',ids[0]);
  check(!active.error,'activate reviewed Contract');
  check(Boolean((await a.client.from('contracts').update({title:'tamper'}).eq('id',ids[0])).error),'final header locked');
  check(Boolean((await a.client.from('contract_parties').update({snapshot:{legal_name:'tamper'}}).eq('contract_id',ids[0])).error),'final party locked');
  check(Boolean((await a.client.from('contract_products').update({unit_price:100}).eq('contract_id',ids[0])).error),'final commercial lines locked');
  check(Boolean((await a.client.from('contracts').update({status:'Draft'}).eq('id',ids[0])).error),'final cannot revert to Draft');
  const privateB=save(await b.load('src/lib/contracts/actions.ts').createContract({...base,company_id:fb.company,deal_id:fb.deal,business_case_id:fb.deal,contract_number:'PRIVATE-B',parties:[party('seller','counterparty',fb.parties[0],'Fictional B supplier'),companyB],product_lines:[{...lines[0],product_id:fb.products[0]}]}),'Company B CREATE');
  check((await a.load('src/lib/contracts/db.ts').getContractById(privateB)).data===null,'private B hidden from A');
  const invalid=await admin.load('src/lib/contracts/actions.ts').createContract({...base,contract_number:'ROLLBACK-CONTRACT',parties:legs[0],product_lines:[{...lines[0],product_id:randomUUID()}]});
  check(!invalid.success,'missing Product rejects transaction');
  check((await admin.client.from('contracts').select('id').eq('contract_number','ROLLBACK-CONTRACT')).data.length===0,'header rolled back with bad line');
  check(model.contractLineAmount(lines[1])===27.5,'Contract quantity times price');
  save(await b.load('src/lib/contracts/actions.ts').deleteContract(privateB),'archive Contract');
  check((await b.load('src/lib/contracts/db.ts').getContractById(privateB)).data===null,'archive removes active detail');
  check((await b.client.from('contracts').select('deleted_at').eq('id',privateB).single()).data.deleted_at,'archive preserves row');

  // Deterministic provider fixture only; actual upload, persistence, review action,
  // transactional RPC, PostgREST, Storage and RLS are real.
  const schema=a.load('src/lib/ai/contracts/schema.ts');
  const empty=schema.emptyField;
  const extraction={};
  for (const [section,shape] of Object.entries(schema.ContractExtractionZodSchema.shape)) {
    if(section==='products') {extraction.products=[];continue;}
    extraction[section]=Object.fromEntries(Object.keys(shape.shape).map(key=>[key,empty()]));
  }
  extraction.general.contract_number=empty('IMPORT-REVIEWED',0.99);
  extraction.seller.legal_name=empty('PACIFIC TEST SEAFOOD CO.',0.99);
  extraction.buyer.buyer_legal_name=empty('SKY INTERNAL A',0.99);
  extraction.commercial.currency=empty('USD',0.99);
  extraction.commercial.payment_terms=empty('30 days',0.95);
  const provider={success:true,extraction,warnings:[],model:'fictional-offline-fixture',requestId:null};
  const load=coreSource(a.client,provider);
  const service=load('src/lib/contracts/import/service.ts');
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const pdf=await PDFDocument.create(); const page=pdf.addPage(); const font=await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText('Fictional Contract IMPORT-REVIEWED. Seller PACIFIC TEST SEAFOOD CO. Buyer SKY INTERNAL A.',{x:20,y:700,size:9,font});
  const original=new File([await pdf.save()], 'fictional-contract.pdf',{type:'application/pdf'});
  const uploaded=await service.createImportAndStorePdf(original);
  const pipeline=await service.runExtractionPipeline({importId:uploaded.importId,file:original,fileName:original.name});
  check(pipeline.importRecord.status==='review' && !pipeline.importRecord.created_contract_id,'extraction never creates Contract');
  let duplicateUpload=false;
  try {await service.createImportAndStorePdf(original);} catch {duplicateUpload=true;}
  check(duplicateUpload,'source hash duplicate upload prevented');
  const actions=load('src/lib/contracts/import/actions.ts');
  const payload={importId:uploaded.importId,form:{...base,contract_number:'IMPORT-REVIEWED',parties:legs[0]},matches:{companyId:fa.company,buyerId:null,supplierId:null,consigneeId:null},productLines:[],fieldOverrides:{payment_terms:'30 days'}};
  const bad=await actions.confirmContractImport({...payload,form:{...payload.form,parties:[]}});
  check(!bad.success,'unresolved legal parties cannot confirm');
  const draft=await actions.confirmContractImport({...payload,saveAsDraft:true});
  check(draft.success && !draft.data.contractId,'review draft does not create Contract');
  const confirmed=await actions.confirmContractImport(payload);
  check(confirmed.success,'review confirmation: '+(confirmed.error??''));
  const importRead=await a.client.from('contract_imports').select('*').eq('id',uploaded.importId).single();
  check(importRead.data.created_contract_id===confirmed.data.contractId && importRead.data.review_result && importRead.data.confirmed_by===a.id && importRead.data.file_hash,'source metadata and audit trail');
  check(!(await actions.confirmContractImport(payload)).success,'repeat confirmation cannot create duplicate');
  const originalRead=await a.client.storage.from('documents').download(uploaded.filePath);
  check(!originalRead.error && Buffer.from(await originalRead.data.arrayBuffer()).equals(Buffer.from(await original.arrayBuffer())),'original bytes retained');
  check(Boolean((await a.client.storage.from('documents').update(uploaded.filePath,original)).error),'source overwrite denied');
  await a.client.storage.from('documents').remove([uploaded.filePath]);
  check(!(await a.client.storage.from('documents').download(uploaded.filePath)).error,'source delete denied');
  check(Boolean((await b.client.storage.from('documents').download(uploaded.filePath)).error),'private source hidden from B');
  check(Boolean((await a.client.from('contract_imports').update({file_name:'changed.pdf'}).eq('id',uploaded.importId)).error),'immutable source metadata');
  check(Boolean((await a.client.from('contract_imports').update({review_result:{tamper:true}}).eq('id',uploaded.importId)).error),'confirmed review immutable');
  const PizZip=(await import('pizzip')).default;
  const zip=new PizZip();
  zip.file('[Content_Types].xml','<Types/>');
  zip.file('word/document.xml','<w:document xmlns:w="urn:word"><w:body><w:p><w:r><w:t>Fictional DOCX Contract</w:t></w:r></w:p></w:body></w:document>');
  const docx=new File([zip.generate({type:'uint8array',compression:'DEFLATE'})],'fictional-contract.docx',{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  const uploadedDocx=await service.createImportAndStorePdf(docx);
  const docxReview=await service.runExtractionPipeline({importId:uploadedDocx.importId,file:docx,fileName:docx.name});
  check(docxReview.importRecord.status==='review' && docxReview.importRecord.mime_type===docx.type,'DOCX reaches reviewed extraction with original MIME');
  const docxConfirmed=await actions.confirmContractImport({...payload,importId:uploadedDocx.importId,form:{...payload.form,contract_number:'DOCX-REVIEWED',parties:legs[1]}});
  // User A cannot select Company B; use Admin to confirm the shared internal leg.
  check(!docxConfirmed.success,'unauthorized internal Company still rejected during import');
  const adminImport=coreSource(admin.client,provider)('src/lib/contracts/import/actions.ts');
  const shared=await adminImport.confirmContractImport({...payload,importId:uploadedDocx.importId,form:{...payload.form,contract_number:'DOCX-REVIEWED',parties:legs[1]}});
  check(shared.success,'Admin reviewed shared DOCX import');
  check(!(await b.client.storage.from('documents').download(uploadedDocx.filePath)).error,'legal Company B may read shared Contract original');
  const sharedSources=await coreSource(b.client,provider)('src/lib/contracts/import/actions.ts').getContractOriginals(shared.data.contractId);
  check(!sharedSources.error && sharedSources.data.length===1,'shared original link loader');
  const pendingPdf=new File([await pdf.save(),new Uint8Array([10])],'fictional-pending.pdf',{type:'application/pdf'});
  const pending=await service.createImportAndStorePdf(pendingPdf);
  await service.runExtractionPipeline({importId:pending.importId,file:pendingPdf,fileName:pendingPdf.name});
  const interruptedSource=new File([await pdf.save(),new Uint8Array([10,10])],'fictional-interrupted.pdf',{type:'application/pdf'});
  const interruptedId=randomUUID();
  const interruptedPath=`companies/${fa.company}/imports/${interruptedId}/fictional-interrupted.pdf`;
  const interrupted=await a.client.from('contract_imports').insert({id:interruptedId,company_id:fa.company,file_path:interruptedPath,file_name:interruptedSource.name,mime_type:interruptedSource.type,file_size:interruptedSource.size,file_hash:createHash('sha256').update(Buffer.from(await interruptedSource.arrayBuffer())).digest('hex'),status:'failed'});
  check(!interrupted.error,'interrupted upload registration fixture');
  const retry=await service.createImportAndStorePdf(interruptedSource);
  check(retry.importId===interruptedId && !(await a.client.storage.from('documents').download(interruptedPath)).error,'failed original upload retries same immutable import');
  check(Boolean((await a.client.from('contract_import_field_reviews').update({confirmed_value:{tamper:true}}).eq('import_id',uploaded.importId)).error),'confirmed field review locked');
  fa.contractId=ids[0]; fb.contractId=ids[1]; fa.importId=pending.importId;
  console.log('Contracts: real CRUD, three-leg chain, perspectives, snapshots, isolation, original retention and atomic reviewed PDF import passed. AI provider response is fictional; no external AI call.');
}
