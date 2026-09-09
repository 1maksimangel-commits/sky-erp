import test from 'node:test';
import assert from 'node:assert/strict';
import PizZip from 'pizzip';
import { coreSource } from './core-source.mjs';
const load=coreSource(null);
const { contractDirection, exactLegalMatches, contractLineAmount }=load('src/lib/contracts/parties.ts');
const { validateContractFormInput }=load('src/lib/contracts/validation.ts');
const a='11111111-1111-4111-8111-111111111111', b='22222222-2222-4222-8222-222222222222';
const parties=[{role_code:'seller',internal_company_id:a,counterparty_id:null,snapshot:{legal_name:'Fictional A'}},{role_code:'buyer',internal_company_id:b,counterparty_id:null,snapshot:{legal_name:'Fictional B'}}];
const form={...load('src/lib/contracts/form-types.ts').emptyContractForm(),company_id:a,contract_number:'FICTIONAL',parties};
test('one internal-to-internal Contract has both company perspectives',()=>{
  assert.equal(contractDirection(parties,a),'sale-side');
  assert.equal(contractDirection(parties,b),'purchase-side');
  assert.equal(contractDirection(parties,null),'not a party');
  assert.equal(contractDirection([],a),'needs review');
});
test('legal matching preserves entity distinctions and exposes ambiguity',()=>{
  const entities=[{legal_name:'Pacific Ltd',id:1},{legal_name:'Pacific Inc',id:2},{legal_name:'PACIFIC LTD',id:3}];
  assert.equal(exactLegalMatches(' Pacific Ltd ',entities).length,2);
  assert.equal(exactLegalMatches('Pacific',entities).length,0);
  assert.equal(exactLegalMatches('pacific inc',entities)[0].id,2);
});
test('review validation rejects missing parties, same entity, invalid UUID and amounts',()=>{
  assert.equal(validateContractFormInput(form),null);
  assert.ok(validateContractFormInput({...form,parties:[]}));
  assert.ok(validateContractFormInput({...form,parties:[parties[0],{...parties[0],role_code:'buyer'}]}));
  assert.ok(validateContractFormInput({...form,company_id:'not-a-uuid'}));
  assert.ok(validateContractFormInput({...form,amount:Infinity}));
  for(const quantity of [0,-1,NaN,Infinity]) assert.ok(validateContractFormInput({...form,product_lines:[{product_id:null,description:'Fictional fish',quantity,unit:'kg',unit_price:2,currency:'USD'}]}));
  assert.equal(contractLineAmount({quantity:3,unit_price:0.1}),0.3);
});
test('DOCX text reader accepts bounded Word text and rejects malformed, encrypted and expansive input',()=>{
  const {readContractDocxText}=load('src/lib/contracts/import/docx-text.ts');
  const zip=new PizZip();
  zip.file('[Content_Types].xml','<Types/>');
  zip.file('word/document.xml','<w:document xmlns:w="urn:word"><w:body><w:p><w:r><w:t>Fictional Contract &amp; seafood</w:t></w:r></w:p></w:body></w:document>');
  const valid=zip.generate({type:'nodebuffer',compression:'DEFLATE'});
  assert.equal(readContractDocxText(valid),'Fictional Contract & seafood');
  assert.throws(()=>readContractDocxText(Buffer.from('not a zip')),/DOCX/);
  zip.file('word/document.xml','<!DOCTYPE x [<!ENTITY danger SYSTEM "file:///private">]><w:document/>');
  assert.throws(()=>readContractDocxText(zip.generate({type:'nodebuffer'})),/DOCX/);
  zip.file('word/document.xml','x'.repeat(4*1024*1024+1));
  assert.throws(()=>readContractDocxText(zip.generate({type:'nodebuffer',compression:'DEFLATE'})),/DOCX/);
  const encrypted=Buffer.from(valid);
  const central=encrypted.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));
  encrypted.writeUInt16LE(1,central+8);
  assert.throws(()=>readContractDocxText(encrypted),/DOCX/);
});
