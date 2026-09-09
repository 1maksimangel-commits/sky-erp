import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { inflateRawSync } from "node:zlib";

const LIMIT = 32 * 1024 * 1024;
const WORD_PART = /^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/;
const KEY = /^[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*$/;
const fail = (message: string): never => { throw new Error(`DOCX: ${message}`); };
const decode = (s: string) => s.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, entity => {
  const named: Record<string,string> = {"&amp;":"&","&lt;":"<","&gt;":">","&quot;":'"',"&apos;":"'"};
  return named[entity] ?? String.fromCodePoint(parseInt(entity.slice(entity.startsWith("&#x") ? 3 : 2, -1),entity.startsWith("&#x") ? 16 : 10));
});
const escape = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const textOf = (xml: string) => [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map(m=>decode(m[1])).join("");

function validateXml(xml: string) {
  if (/<!DOCTYPE|<!ENTITY|[\x00-\x08\x0b\x0c\x0e-\x1f]/i.test(xml)) fail("unsafe XML content");
  const stack: string[] = []; let roots = 0; let cursor = 0;
  const tags = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/?[\w:.-]+(?:\s+[\w:.-]+\s*=\s*(?:"[^"<]*"|'[^'<]*'))*\s*\/?\s*>/g;
  for (const m of xml.matchAll(tags)) {
    const between=xml.slice(cursor,m.index);
    if (between.includes("<") || (!stack.length && between.trim())) fail("invalid XML structure");
    cursor=m.index+m[0].length;
    if (m[0].startsWith("<?") || m[0].startsWith("<!--")) continue;
    const name=/^<\/?([\w:.-]+)/.exec(m[0])![1];
    if (m[0].startsWith("</")) { if(stack.pop()!==name) fail("unbalanced XML tags"); }
    else { if(!stack.length) roots++; if(!/\/\s*>$/.test(m[0])) stack.push(name); }
  }
  if(stack.length || roots!==1 || xml.slice(cursor).trim()) fail("invalid XML document");
  if (/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);)/i.test(xml)) fail("invalid XML entity");
  for(const entity of xml.matchAll(/&#(x[\da-f]+|\d+);/gi)) {
    const code=entity[1].startsWith("x")?parseInt(entity[1].slice(1),16):Number(entity[1]);
    if(![9,10,13].includes(code) && (code<32 || code>0x10ffff || (code>=0xd800 && code<=0xdfff) || code===0xfffe || code===0xffff)) fail("invalid XML character reference");
  }
}

/** Validate before PizZip can decompress anything. Limits apply to actual inflated
 * bytes, not just untrusted ZIP directory sizes. No filesystem extraction. */
function readZip(bytes: Uint8Array): PizZip {
  const b=Buffer.from(bytes); if(b.length>LIMIT) fail("file exceeds 32 MB");
  let end=-1;
  for(let p=b.length-22;p>=Math.max(0,b.length-65557);p--) if(b.readUInt32LE(p)===0x06054b50 && p+22+b.readUInt16LE(p+20)===b.length){end=p;break;}
  if(end<0 || b.readUInt16LE(end+4) || b.readUInt16LE(end+6)) fail("invalid ZIP archive");
  const count=b.readUInt16LE(end+10), directory=b.readUInt32LE(end+16);
  if(!count || count>2000 || directory+b.readUInt32LE(end+12)!==end) fail("unsupported ZIP directory");
  let cursor=directory,total=0; const names=new Set<string>();
  for(let n=0;n<count;n++) {
    if(cursor+46>end || b.readUInt32LE(cursor)!==0x02014b50) fail("invalid ZIP entry");
    const flags=b.readUInt16LE(cursor+8),method=b.readUInt16LE(cursor+10),compressed=b.readUInt32LE(cursor+20),expanded=b.readUInt32LE(cursor+24),local=b.readUInt32LE(cursor+42);
    const length=b.readUInt16LE(cursor+28),extra=b.readUInt16LE(cursor+30),comment=b.readUInt16LE(cursor+32);
    if(cursor+46+length+extra+comment>end) fail("invalid ZIP name");
    const name=b.subarray(cursor+46,cursor+46+length).toString("utf8");
    if(names.has(name)||name.includes("..")||name.includes("\\")||name.startsWith("/")||/vbaProject|\.bin$|activeX|embeddings/i.test(name)||flags&1||![0,8].includes(method)) fail("encrypted, duplicate or unsafe package part");
    names.add(name); total+=expanded;
    if(total>LIMIT || expanded>LIMIT || local+30>directory || b.readUInt32LE(local)!==0x04034b50) fail("unsafe ZIP expansion");
    const start=local+30+b.readUInt16LE(local+26)+b.readUInt16LE(local+28);
    if(start+compressed>directory || b.readUInt16LE(local+8)!==method || b.subarray(local+30,local+30+b.readUInt16LE(local+26)).toString("utf8")!==name) fail("invalid ZIP local entry");
    const data=method===8?inflateRawSync(b.subarray(start,start+compressed),{maxOutputLength:Math.max(1,Math.min(LIMIT,expanded))}):b.subarray(start,start+compressed);
    if(data.length!==expanded) fail("invalid ZIP expanded size");
    if(/\.(xml|rels)$/.test(name)) validateXml(data.toString("utf8"));
    cursor+=46+length+extra+comment;
  }
  if(cursor!==end||!names.has("[Content_Types].xml")||!names.has("word/document.xml")||!names.has("_rels/.rels")) fail("missing Word package parts");
  let zip:PizZip; try{zip=new PizZip(b,{checkCRC32:true});}catch{ return fail("corrupt ZIP checksum"); }
  const contentTypes=zip.file("[Content_Types].xml")!.asText();
  if(/macroEnabled/i.test(contentTypes)) fail("macros are not supported");
  const mainType=[...contentTypes.matchAll(/<Override\b([^>]*)\/?\s*>/g)].map(m=>Object.fromEntries([...m[1].matchAll(/([\w:]+)\s*=\s*["']([^"']*)["']/g)].map(a=>[a[1],a[2]]))).find(attrs=>attrs.PartName==="/word/document.xml");
  if(mainType?.ContentType!=="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml")fail("missing Word main document content type");
  const main=zip.file("word/document.xml")!.asText();
  const documentRoot=/<w:document\b([^>]*)>/.exec(main);
  if(!documentRoot || !/\bxmlns:w=["']http:\/\/schemas.openxmlformats.org\/wordprocessingml\/2006\/main["']/.test(documentRoot[1]) || !/<w:body\b/.test(main))fail("unsupported Word document namespace or body");
  for(const name of names) if(name.endsWith(".rels")) {
    const xml=zip.file(name)!.asText(); const ids=new Set<string>();
    for(const m of xml.matchAll(/<Relationship\b([^>]*)\/?\s*>/g)) {
      const attrs=Object.fromEntries([...m[1].matchAll(/([\w:]+)\s*=\s*["']([^"']*)["']/g)].map(a=>[a[1],decode(a[2])]));
      if(!attrs.Id||ids.has(attrs.Id)) fail("duplicate relationship ID"); ids.add(attrs.Id);
      if(attrs.TargetMode==="External") { if(!/\/hyperlink$/.test(attrs.Type??"")) fail("external document resources are not supported"); continue; }
      const base=name==="_rels/.rels"?[]:name.slice(0,name.lastIndexOf("/_rels/")).split("/");
      const target=attrs.Target??""; if(target.startsWith("/")) base.length=0;
      for(const part of target.split("/")){if(part==="..")base.pop();else if(part && part!==".")base.push(part);}
      if(!names.has(base.join("/"))) fail("missing relationship target");
    }
  }
  for(const name of names) if(WORD_PART.test(name)) {
    const relations=zip.file(name.replace(/\/([^/]+)$/, "/_rels/$1.rels"))?.asText()??"";
    const ids=new Set([...relations.matchAll(/\bId=["']([^"']+)["']/g)].map(m=>m[1]));
    for(const reference of zip.file(name)!.asText().matchAll(/\br:(?:id|embed|link)=["']([^"']+)["']/g)) if(!ids.has(reference[1]))fail("unresolved image or document relationship");
  }
  return zip;
}

export function assertDocxIntegrity(bytes: Uint8Array): void { readZip(bytes); }

function lookup(scope: unknown,key: string): unknown {
  if(!scope || typeof scope!=="object") return undefined;
  if(Object.hasOwn(scope,key)) return (scope as Record<string,unknown>)[key];
  return key.split(".").reduce<unknown>((value,part)=>value && typeof value==="object" && Object.hasOwn(value,part)?(value as Record<string,unknown>)[part]:undefined,scope);
}
function compiler(zip:PizZip,mappings:Record<string,string>={}) {
  return new Docxtemplater(zip,{delimiters:{start:"{{",end:"}}"},paragraphLoop:true,linebreaks:true,errorLogging:false,nullGetter:()=>"",parser:tag=>{
    if(!KEY.test(tag)||tag.split(".").some(p=>["__proto__","constructor","prototype"].includes(p))) fail(`unsupported placeholder: ${tag}`);
    return {get:(scope:unknown,context)=>{
      const value=lookup(scope,mappings[tag]??tag);
      if(value===null)return "";
      if(typeof value==="object" && context.meta.part.module!=="loop")return "";
      return value;
    }};
  }});
}

/** Standard optional blocks: {{#consignee}}...{{/consignee}} and inverse
 * {{^consignee}}...{{/consignee}}. Never evaluates code or raw XML tags. */
export function inspectDocx(bytes: Uint8Array): {placeholders:string[];text:string} {
  const zip=readZip(bytes); compiler(zip);
  for(const name of Object.keys(zip.files).filter(n=>WORD_PART.test(n))) {
    const xml=zip.file(name)!.asText();
    const outsideTables=textOf(xml.replace(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g,""));
    if(/\{\{\s*product\./.test(outsideTables) && !/\{\{\s*#products\s*\}\}/.test(outsideTables)) fail("product fields need a table prototype row or an explicit products loop");
  }
  const text=Object.keys(zip.files).filter(n=>WORD_PART.test(n)).map(n=>zip.file(n)!.asText().replace(/<\/w:p>/g,"</w:p>\n")).map(xml=>xml.split("\n").map(textOf).join("\n")).join("\n");
  const placeholders=[...new Set([...text.matchAll(/\{\{\s*([#^/]?)([^{}]+?)\s*\}\}/g)].map(m=>m[2].trim()))];
  return {placeholders,text};
}

export function renderDocx(bytes:Uint8Array,values:Record<string,unknown>,mappings:Record<string,string>={}):Uint8Array {
  const zip=readZip(bytes);
  for(const name of Object.keys(zip.files).filter(n=>WORD_PART.test(n))) {
    let xml=zip.file(name)!.asText();
    xml=xml.replace(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g,row=>{
      const text=textOf(row);
      const usesProduct=[...text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].some(m=>(mappings[m[1]]??m[1]).startsWith("product."));
      if(!usesProduct||/\{\{\s*[#/]products\s*\}\}/.test(text))return row;
      const nodes=[...row.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)];
      if(!nodes.length)return row;
      const first=nodes[0],last=nodes[nodes.length-1];
      const end=last.index+last[0].lastIndexOf("</w:t>"); row=row.slice(0,end)+"{{/products}}"+row.slice(end);
      const start=first.index+first[0].indexOf(">")+1; return row.slice(0,start)+"{{#products}}"+row.slice(start);
    });
    zip.file(name,xml);
  }
  const data={...values,products:Array.isArray(values.products)?values.products.map(product=>({product})):[]};
  const doc=compiler(zip,mappings); doc.render(data);
  const output=doc.getZip().generate({type:"uint8array",compression:"DEFLATE"}); assertDocxIntegrity(output); return output;
}

/** Bind only explicitly selected, unambiguous paragraph text. Runs/styles and
 * every unrelated package part remain intact; input bytes are never changed. */
export function bindDocxText(bytes:Uint8Array,bindings:Array<{text:string;variable:string}>):Uint8Array {
  const zip=readZip(bytes);
  for(const binding of bindings) {
    if(!binding.text.trim()||!KEY.test(binding.variable))fail("select text and a valid field");
    let matches=0;
    for(const name of Object.keys(zip.files).filter(n=>WORD_PART.test(n))) {
      const xml=zip.file(name)!.asText().replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g,paragraph=>{
        const text=textOf(paragraph),start=text.indexOf(binding.text);if(start<0)return paragraph;
        if(text.indexOf(binding.text,start+1)>=0)fail("selected text is ambiguous; use a unique value"); matches++;
        let offset=0;
        return paragraph.replace(/(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g,(_,open:string,content:string,close:string)=>{
          const decoded=decode(content),nodeStart=offset;offset+=decoded.length;
          if(offset<=start||nodeStart>=start+binding.text.length)return open+content+close;
          const before=decoded.slice(0,Math.max(0,start-nodeStart));const after=decoded.slice(Math.max(0,start+binding.text.length-nodeStart));
          return open+escape(before+(nodeStart<=start?`{{${binding.variable}}}`:"")+after)+close;
        });
      }); zip.file(name,xml);
    }
    if(matches!==1)fail(matches?"selected text occurs more than once; choose a unique value":"selected text was not found");
  }
  const output=zip.generate({type:"uint8array",compression:"DEFLATE"});inspectDocx(output);return output;
}
