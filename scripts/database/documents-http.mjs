import fs from 'node:fs';
import { createHash } from 'node:crypto';
import PizZip from 'pizzip';

// Called only inside the isolated canonical replay. All identities, companies,
// Contracts and documents below are fictional; no external provider is invoked.
export async function verifyDocumentsHttp({users,fixtures}) {
  const [admin,a,b]=users,[fa,fb]=fixtures;
  const check=(ok,label)=>{if(!ok)throw new Error('Document regression failed: '+label);};
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  const original=fs.readFileSync('scripts/database/fixtures/fictional-document-template.docx');
  const engine=a.load('src/lib/document-templates/docx-engine.ts');
  const actions=a.load('src/lib/document-templates/actions.ts');
  const generation=a.load('src/lib/document-templates/generation.ts');
  const mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  async function upload(user,type,companyId,name,extra={}) {
    const form=new FormData();form.set('documentType',type);form.set('name',name);form.set('language','en');form.set('companyId',companyId??'');form.set('isDefault','true');
    form.set('file',new File([original],'fictional-template.docx',{type:mime}));
    for(const [key,value] of Object.entries(extra))form.set(key,value);
    const result=await user.load('src/lib/document-templates/actions.ts').uploadDocumentTemplate(form);
    check(result.success,'template upload '+name+': '+(result.error??''));check(!result.unknown.length,'automatic canonical mapping '+name);return result.id;
  }
  const party=(role,internal,counterparty,name)=>({role_code:role,internal_company_id:internal,counterparty_id:counterparty,snapshot:{legal_name:name,address:'Fictional agreed address',bank_name:'FICTIONAL BANK',bank_account:'FICTIONAL-NOT-AN-ACCOUNT',bank_swift:'TESTONLY',signatory_name:'Fictional Director',signatory_title:'Director'}});
  const lines=fa.products.map((product_id,i)=>({product_id,description:['Pacific Cod','Pollock','Halibut'][i]+' fictional legal specification',quantity:i+1,unit:'kg',unit_price:10,currency:'USD',net_weight:i+1,gross_weight:i+2}));
  const created=await a.load('src/lib/contracts/actions.ts').createContract({...a.load('src/lib/contracts/form-types.ts').emptyContractForm(),company_id:fa.company,deal_id:fa.deal,business_case_id:fa.deal,contract_number:'GOLDEN-DOCUMENT-CONTRACT',contract_date:'2026-09-09',currency:'USD',incoterms:'FOB',payment_terms:'Fictional 30 days',delivery_place:'Fictional Test Port',legal_snapshot:{delivery_terms:'Fictional delivery terms'},product_lines:lines,parties:[party('seller',fa.company,null,'SKY FICTIONAL INTERNAL A'),party('buyer',null,fa.parties[1],'FICTIONAL EXTERNAL BUYER'),party('consignee',null,fa.parties[2],'FICTIONAL CONSIGNEE')]});
  check(created.success,'golden Contract with three products: '+(created.error??''));const contractId=created.id;
  const global=await upload(admin,'invoice',null,'Fictional global Invoice');
  const foreign=await upload(b,'invoice',fb.company,'Fictional B Invoice');
  const templates={};for(const type of ['contract','supplement','invoice'])templates[type]=await upload(a,type,fa.company,'Fictional A '+type);
  check((await actions.getDefaultDocumentTemplate('invoice',fa.company,'en')).id===templates.invoice,'company-specific default wins over global');
  check((await b.load('src/lib/document-templates/actions.ts').getDefaultDocumentTemplate('invoice',fb.company,'en')).id===foreign,'Company B default independent');
  const visible=await actions.listDocumentTemplates(fa.company);check(!visible.error&&visible.data.some(t=>t.id===global)&&!visible.data.some(t=>t.id===foreign),'global plus own template listing');
  check((await b.client.from('document_templates').select('id').eq('id',templates.invoice)).data.length===0,'private templates hidden from Company B');
  const templateRow=(await a.client.from('document_templates').select('*').eq('id',templates.contract).single()).data;
  check(templateRow.original_hash===hash(original)&&templateRow.original_filename==='fictional-template.docx'&&templateRow.version===1,'original template metadata');
  const templateDownload=await a.client.storage.from('documents').download(templateRow.storage_path);
  check(!templateDownload.error&&hash(Buffer.from(await templateDownload.data.arrayBuffer()))===hash(original),'original bytes retained');
  check(Boolean((await b.client.storage.from('documents').download(templateRow.storage_path)).error),'private template Storage isolation');
  check(Boolean((await a.client.storage.from('documents').update(templateRow.storage_path,original)).error),'template original overwrite blocked');

  const outputIds=[];
  for(const type of ['contract','supplement','invoice']) {
    const input={templateId:templates[type],contractId,documentType:type,details:{number:'GOLDEN-'+type.toUpperCase(),date:'2026-09-09',notes:'Fictional one-off note',supplementReference:type==='invoice'?'GOLDEN-SUPPLEMENT':''}};
    const preview=await generation.generateDocument({...input,preview:true});
    check(preview.preview&&!preview.missing.length&&preview.values.products.length===3,'review actual source values');
    check(preview.values.calculated.total===60&&preview.values.commercial.currency==='USD'&&preview.values.commercial.incoterms==='FOB','canonical calculations and terms');
    let blocked=false;try{await generation.generateDocument(input);}catch{blocked=true;}check(blocked,'generation requires review hash');
    const result=await generation.generateDocument({...input,reviewHash:preview.reviewHash});check(result.id,'generate '+type);outputIds.push(result.id);
    const record=(await a.client.from('generated_documents').select('*').eq('id',result.id).single()).data;
    check(record.status==='Draft'&&record.version===1&&record.contract_id===contractId&&record.deal_id===fa.deal&&record.source_template_id===templates[type]&&record.source_template_version===1,'generated linkage and lifecycle');
    check(record.snapshot_data.values.seller.legal_name==='SKY FICTIONAL INTERNAL A'&&record.snapshot_data.values.buyer.legal_name==='FICTIONAL EXTERNAL BUYER'&&record.snapshot_data.values.consignee.legal_name==='FICTIONAL CONSIGNEE','explicit Contract legal snapshots');
    check(record.snapshot_data.values.products.length===3&&record.snapshot_data.values.calculated.total===60&&/^[a-f\d]{64}$/.test(record.snapshot_hash),'persisted generated snapshot and checksum');
    const file=await a.client.storage.from('documents').download(record.docx_storage_path);check(!file.error,'output retained in Storage');
    const bytes=new Uint8Array(await file.data.arrayBuffer());engine.assertDocxIntegrity(bytes);check(hash(bytes)===record.output_hash,'output SHA256');
    const text=engine.inspectDocx(bytes).text;
    check(text.includes('SKY FICTIONAL INTERNAL A')&&text.includes('FICTIONAL EXTERNAL BUYER')&&text.includes('USD 60')&&text.includes('FOB')&&text.includes(result.number)&&text.includes('GOLDEN-DOCUMENT-CONTRACT'),'golden DOCX values and document references');
    check(result.number === (type === 'contract' ? 'GOLDEN-DOCUMENT-CONTRACT' : input.details.number),'Contract uses its canonical legal number');
    check((new PizZip(bytes).file('word/document.xml').asText().match(/<w:tr>/g)||[]).length===3,'three real Word product rows');
    check(!text.includes('{{')&&!/undefined|null|\[object Object\]/.test(text),'no unresolved or optional artifacts');
    check(Boolean((await b.client.storage.from('documents').download(record.docx_storage_path)).error),'generated file company isolation');
    check((await b.client.from('generated_documents').select('id').eq('id',result.id)).data.length===0,'generated record company isolation');
    check(Boolean((await a.client.storage.from('documents').update(record.docx_storage_path,original)).error),'output cannot be overwritten');
    check(Boolean((await a.client.from('generated_documents').update({snapshot_data:{tamper:true}}).eq('id',result.id)).error),'snapshot immutable');
    check(!(await a.client.from('generated_documents').update({status:'Final'}).eq('id',result.id)).error,'Draft to Final');
    check(!(await a.client.from('generated_documents').update({status:'Issued'}).eq('id',result.id)).error,'Final to Issued');
    check(Boolean((await a.client.from('generated_documents').update({status:'Draft'}).eq('id',result.id)).error),'Issued cannot reopen');
    const nextInput={...input,supersedesId:result.id,details:{...input.details,notes:'Fictional revised note'}};
    const nextPreview=await generation.generateDocument({...nextInput,preview:true});
    const revision=await generation.generateDocument({...nextInput,reviewHash:nextPreview.reviewHash});check(revision.version===2,'new immutable version');
    const nextRecord=(await a.client.from('generated_documents').select('supersedes_id,document_series_id,document_number,status').eq('id',revision.id).single()).data;
    check(nextRecord.supersedes_id===result.id&&nextRecord.document_series_id===result.id&&nextRecord.document_number===record.document_number&&nextRecord.status==='Draft','version lineage and number retained');
    check(!(await a.client.storage.from('documents').download(record.docx_storage_path)).error,'issued version remains downloadable');
  }
  const automaticInput={templateId:global,contractId,documentType:'invoice',details:{number:'',date:'2026-09-09',notes:'Fictional global template',supplementReference:''}};
  const automaticPreview=await generation.generateDocument({...automaticInput,preview:true});
  check(!automaticPreview.missing.length&&/^INV-/.test(automaticPreview.values.document.number),'global template available with reviewable automatic number');
  const automatic=await generation.generateDocument({...automaticInput,details:{...automaticInput.details,number:automaticPreview.values.document.number},reviewHash:automaticPreview.reviewHash});
  const automaticRecord=(await a.client.from('generated_documents').select('company_id,source_template_id,document_number,snapshot_data').eq('id',automatic.id).single()).data;
  check(automaticRecord.company_id===fa.company&&automaticRecord.source_template_id===global&&automaticRecord.document_number===automaticPreview.values.document.number&&automaticRecord.snapshot_data.values.document.number===automaticPreview.values.document.number,'reviewed automatic number roundtrip and global template ownership');

  const customZip=new PizZip(original);customZip.file('word/document.xml',customZip.file('word/document.xml').asText().replace('Example Legal Value','{{custom.bank}}'));
  const customForm=new FormData();customForm.set('name','Fictional custom required field');customForm.set('documentType','invoice');customForm.set('companyId',fa.company);customForm.set('language','en');customForm.set('file',new File([customZip.generate({type:'uint8array'})],'fictional-custom.docx',{type:mime}));
  const custom=await actions.uploadDocumentTemplate(customForm);check(custom.success&&custom.unknown.includes('custom.bank'),'unknown placeholder detected on real upload');
  const customInput={templateId:custom.id,contractId,documentType:'invoice',details:{number:'FICTIONAL-CUSTOM-INVOICE',date:'2026-09-09',notes:'',supplementReference:''}};
  const unresolved=await generation.generateDocument({...customInput,preview:true});check(unresolved.missing.some(message=>message.includes('custom.bank')),'unknown field requires configuration');
  let unresolvedBlocked=false;try{await generation.generateDocument({...customInput,reviewHash:unresolved.reviewHash});}catch{unresolvedBlocked=true;}check(unresolvedBlocked,'unknown placeholder cannot silently generate');
  check((await actions.configureDocumentTemplate({templateId:custom.id,mappings:[{placeholder:'custom.bank',skyVariable:'beneficiary.bank.account',required:true}]})).success,'custom mapping configured once');
  const required=await generation.generateDocument({...customInput,preview:true});check(required.missing.some(message=>message.includes('required by this template')),'missing required beneficiary bank blocks generation');
  let requiredBlocked=false;try{await generation.generateDocument({...customInput,reviewHash:required.reviewHash});}catch{requiredBlocked=true;}check(requiredBlocked,'required data enforced on server');
  check((await actions.configureDocumentTemplate({templateId:custom.id,mappings:[{placeholder:'custom.bank',skyVariable:'beneficiary.bank.account',required:false}]})).success,'unused template requirement configurable');
  const optional=await generation.generateDocument({...customInput,preview:true});check(!optional.missing.length,'absent optional bank does not block unrelated data');
  const optionalOutput=await generation.generateDocument({...customInput,reviewHash:optional.reviewHash});check(optionalOutput.id,'configured custom optional field renders');

  const amendedInput={templateId:templates.supplement,contractId,documentType:'supplement',details:{number:'FICTIONAL-AMENDED-SUPPLEMENT',date:'2026-09-09',notes:'Explicit fictional amendment',supplementReference:''},amendment:{paymentTerms:'Fictional amended 60 days',deliveryTerms:'Fictional amended delivery',products:lines.map((line,index)=>({...line,quantity:index===0?9:line.quantity}))}};
  const amendmentPreview=await generation.generateDocument({...amendedInput,preview:true});check(amendmentPreview.values.calculated.total===140&&amendmentPreview.values.commercial.payment_terms==='Fictional amended 60 days'&&amendmentPreview.values.commercial.delivery_terms==='Fictional amended delivery','Supplement reviews revised products and terms');
  const amendment=await generation.generateDocument({...amendedInput,reviewHash:amendmentPreview.reviewHash});
  const amendmentRecord=(await a.client.from('generated_documents').select('snapshot_data').eq('id',amendment.id).single()).data;
  check(amendmentRecord.snapshot_data.amendment.products[0].quantity===9&&amendmentRecord.snapshot_data.values.calculated.total===140,'explicit amendment retained in document snapshot');
  const unchanged=(await a.load('src/lib/contracts/db.ts').getContractById(contractId)).data;
  check(unchanged.payment_terms==='Fictional 30 days','Supplement preserves base Contract payment terms');
  check(unchanged.legal_snapshot.delivery_terms==='Fictional delivery terms','Supplement preserves base Contract delivery terms');
  check(lines.every(line=>unchanged.product_lines.some(saved=>saved.product_id===line.product_id&&saved.quantity===line.quantity&&saved.unit_price===line.unit_price)),'Supplement preserves every base Contract product quantity and price');
  const replacement=await upload(a,'contract',fa.company,'Fictional A replacement',{replacesId:templates.contract});
  check((await a.client.from('document_templates').select('version,family_id').eq('id',replacement).single()).data.version===2,'template versioning');
  check((await actions.getDefaultDocumentTemplate('contract',fa.company,'en')).id===replacement,'replacement default selected');
  const originalAgain=await a.client.storage.from('documents').download(templateRow.storage_path);check(hash(Buffer.from(await originalAgain.data.arrayBuffer()))===hash(original),'all generations leave original untouched');
  const before=(await a.client.from('generated_documents').select('id',{count:'exact',head:true})).count;
  const trial=await generation.generateDocument({templateId:replacement,documentType:'contract',details:{number:'FICTIONAL-TEST',date:'2026-09-09',notes:'',supplementReference:''},test:true});
  check(trial.test&&trial.bytes.length>0,'Test Generate returns real fictional DOCX');engine.assertDocxIntegrity(trial.bytes);
  check((await a.client.from('generated_documents').select('id',{count:'exact',head:true})).count===before,'Test Generate never creates business document records');
  let denied=false;try{await generation.prepareGeneration({templateId:foreign,contractId,documentType:'invoice',details:{number:'INVALID',date:'2026-09-09',notes:'',supplementReference:''}});}catch{denied=true;}check(denied,'foreign company template rejected on server');
  const sourceContract=(await a.load('src/lib/contracts/db.ts').getContractById(contractId)).data;
  const sourceForm=a.load('src/lib/contracts/form-types.ts').contractToFormInput(sourceContract);
  sourceForm.parties=sourceForm.parties.map(p=>p.role_code==='buyer'?{...p,snapshot:{...p.snapshot,address:'Fictional amended source address'}}:p);
  check((await a.load('src/lib/contracts/actions.ts').updateContract(contractId,sourceForm)).success,'later Draft source amendment allowed');
  const retained=(await a.client.from('generated_documents').select('snapshot_data').eq('id',outputIds[0]).single()).data;
  check(retained.snapshot_data.values.buyer.address==='Fictional agreed address','later source changes do not alter retained generated snapshot');
  fa.generatedDocumentId=outputIds[0];fa.documentTemplateId=replacement;fa.generatedContractId=contractId;
  console.log('Documents: real template Storage, canonical review, three golden DOCX outputs, SHA256 snapshots, lifecycle, versions, defaults and company isolation passed.');
}
