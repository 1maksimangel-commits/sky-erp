import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import PizZip from 'pizzip';

const source='src/lib/document-templates/docx-engine.ts';
const compiled=ts.transpileModule(fs.readFileSync(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const loaded={exports:{}};
vm.runInNewContext(compiled,{module:loaded,exports:loaded.exports,require:createRequire(import.meta.url),Buffer,console},{filename:source});
const {inspectDocx,renderDocx,bindDocxText,assertDocxIntegrity}=loaded.exports;

// Entirely fictional package authored for SKY ERP tests, no customer material.
export function fictionalDocx() {
  const zip=new PizZip();
  const p=text=>`<w:p><w:r><w:rPr><w:rFonts w:ascii="Arial"/><w:b/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
  zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>');
  zip.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/_rels/document.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="header1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="logo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/></Relationships>');
  zip.file('word/header1.xml',`<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${p('FICTIONAL {{contract.number}}')}</w:hdr>`);
  zip.file('word/media/logo.png',Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1kAAAAASUVORK5CYII=','base64'));
  zip.file('word/document.xml',`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>{{seller.</w:t></w:r><w:r><w:t>legal_name}}</w:t></w:r></w:p>${p('{{buyer.legal_name}}')}${p('{{#consignee}}{{consignee.legal_name}}{{/consignee}}')}${p('Example Legal Value')}<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="4000"/><w:gridCol w:w="2000"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="4000" w:type="dxa"/></w:tcPr>${p('{{product.description}}')}</w:tc><w:tc>${p('{{product.quantity}} × {{product.unit_price}} = {{product.amount}}')}</w:tc></w:tr></w:tbl>${p('{{commercial.currency}} {{totals.total}}')}${p('{{manual.notes}}')}<w:sectPr><w:headerReference w:type="default" r:id="header1"/><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr></w:body></w:document>`);
  const drawing='<w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="914400" cy="914400"/><wp:docPr id="1" name="Fictional logo"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="Fictional logo"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="logo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
  zip.file('word/document.xml',zip.file('word/document.xml').asText().replace('<w:body>','<w:body>'+drawing+p('{{document.number}} {{document.date}} {{contract.date}}')+p('{{commercial.incoterms}} {{commercial.payment_terms}} {{commercial.delivery_terms}} {{supplement.reference}}')).replace('{{totals.total}}','{{calculated.total}}'));
  return zip.generate({type:'nodebuffer',compression:'DEFLATE'});
}

const fixturePath='scripts/database/fixtures/fictional-document-template.docx';
if(process.argv.includes('--write-fixture')) {fs.mkdirSync('scripts/database/fixtures',{recursive:true});fs.writeFileSync(fixturePath,fictionalDocx());}
const fixture=fs.readFileSync(fixturePath);
test('inspect canonical split-run/header placeholders and unknown custom fields',()=>{
  const info=inspectDocx(fixture);
  assert.ok(info.placeholders.includes('seller.legal_name'));
  assert.ok(info.placeholders.includes('contract.number'));
  const bound=bindDocxText(fixture,[{text:'Example Legal Value',variable:'custom.unknown'}]);
  assert.ok(inspectDocx(bound).placeholders.includes('custom.unknown'));
  assert.equal(inspectDocx(fixture).text.includes('Example Legal Value'),true);
});
for(const count of [1,3,20]) test(`DOCX-native ${count} product rows, optional fields, supplied controlled totals and fidelity`,()=>{
  const products=Array.from({length:count},(_,i)=>({description:`Fictional fish ${i+1}`,quantity:2,unit_price:3,amount:6}));
  const output=renderDocx(fixture,{seller:{legal_name:'FICTIONAL SKY A'},buyer:{legal_name:'FICTIONAL BUYER'},contract:{number:'TEST-1'},products,commercial:{currency:'USD'},calculated:{total:count*6},consignee:null,manual:{notes:null}});
  assertDocxIntegrity(output);
  const info=inspectDocx(output);assert.equal(info.placeholders.length,0);
  assert.ok(info.text.includes(`USD ${count*6}`));assert.ok(info.text.includes('FICTIONAL SKY A'));assert.ok(!/undefined|null|\[object Object\]/.test(info.text));
  const rendered=new PizZip(output), original=new PizZip(fixture), xml=rendered.file('word/document.xml').asText();
  assert.equal((xml.match(/<w:tr>/g)||[]).length,count);
  for(const marker of ['w:orient="landscape"','<w:b/>','w:ascii="Arial"','w:val="22"','<w:tblBorders>','w:w="4000"']) assert.ok(xml.includes(marker),marker);
  assert.deepEqual(rendered.file('word/media/logo.png').asNodeBuffer(),original.file('word/media/logo.png').asNodeBuffer());
  assert.equal(xml.match(/<w:drawing>[\s\S]*?<\/w:drawing>/)[0],original.file('word/document.xml').asText().match(/<w:drawing>[\s\S]*?<\/w:drawing>/)[0]);
  assert.equal(rendered.file('word/_rels/document.xml.rels').asText(),original.file('word/_rels/document.xml.rels').asText());
  assert.ok(rendered.file('word/header1.xml').asText().includes('TEST-1'));
});
test('safe explicit text binding preserves split runs and refuses ambiguity',()=>{
  const zip=new PizZip(fixture);zip.file('word/document.xml',zip.file('word/document.xml').asText().replace('Example Legal Value','Example </w:t></w:r><w:r><w:t>Legal Value'));
  const output=bindDocxText(zip.generate({type:'uint8array'}),[{text:'Example Legal Value',variable:'manual.notes'}]);
  assert.ok(inspectDocx(output).placeholders.includes('manual.notes'));
  assert.throws(()=>bindDocxText(fixture,[{text:'missing',variable:'manual.notes'}]),/not found/);
});
test('rejects corrupt, unsafe, malformed and missing-relationship packages',()=>{
  assert.throws(()=>assertDocxIntegrity(Buffer.from('broken')),/DOCX/);
  for(const replacement of ['<!DOCTYPE x><w:document/>','<w:document><w:body></w:document>','<w:document>&unknown;</w:document>']) {
    const zip=new PizZip(fixture);zip.file('word/document.xml',replacement);assert.throws(()=>assertDocxIntegrity(zip.generate({type:'uint8array'})),/DOCX/);
  }
  const missing=new PizZip(fixture);missing.remove('word/media/logo.png');assert.throws(()=>assertDocxIntegrity(missing.generate({type:'uint8array'})),/relationship/);
  const macro=new PizZip(fixture);macro.file('word/vbaProject.bin','bad');assert.throws(()=>assertDocxIntegrity(macro.generate({type:'uint8array'})),/unsafe/);
  const namespace=new PizZip(fixture);namespace.file('word/document.xml',namespace.file('word/document.xml').asText().replace('http://schemas.openxmlformats.org/wordprocessingml/2006/main','urn:not-word'));assert.throws(()=>assertDocxIntegrity(namespace.generate({type:'uint8array'})),/namespace/);
  const wrongType=new PizZip(fixture);wrongType.file('[Content_Types].xml',wrongType.file('[Content_Types].xml').asText().replace('application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml','application/xml'));assert.throws(()=>assertDocxIntegrity(wrongType.generate({type:'uint8array'})),/content type/);
  const malformed=new PizZip(fixture);malformed.file('word/header1.xml',malformed.file('word/header1.xml').asText().replace('{{contract.number}}','{{contract.number}'));assert.throws(()=>inspectDocx(malformed.generate({type:'uint8array'})));
});
