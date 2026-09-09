import { inflateRawSync } from "node:zlib";

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_XML = 4 * 1024 * 1024;

/** Bounded ZIP reader for Word text only. Never extracts files or follows links.
 * Encrypted/ZIP64/macro packages are rejected. Expansion is bounded by zlib,
 * independently of the untrusted directory's claimed uncompressed size.
 */
export function readContractDocxText(bytes: Uint8Array): string {
  const zip = Buffer.from(bytes);
  const fail = (): never => { throw new Error("Unsupported or malformed DOCX. Export the Contract as PDF."); };
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0,zip.length - 65557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50 && i + 22 + zip.readUInt16LE(i+20) === zip.length) { end = i; break; }
  }
  if (end < 0 || zip.readUInt16LE(end+4) || zip.readUInt16LE(end+6)) return fail();
  const count = zip.readUInt16LE(end+10);
  const directorySize = zip.readUInt32LE(end+12);
  let cursor = zip.readUInt32LE(end+16);
  if (!count || count > 1000 || cursor + directorySize !== end) return fail();
  const names = new Set<string>();
  const texts: string[] = [];
  let total = 0;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || zip.readUInt32LE(cursor) !== 0x02014b50) return fail();
    const flags = zip.readUInt16LE(cursor+8), method = zip.readUInt16LE(cursor+10);
    const compressed = zip.readUInt32LE(cursor+20), expanded = zip.readUInt32LE(cursor+24);
    const nameLength = zip.readUInt16LE(cursor+28), extraLength = zip.readUInt16LE(cursor+30), commentLength = zip.readUInt16LE(cursor+32);
    const local = zip.readUInt32LE(cursor+42);
    if (cursor + 46 + nameLength + extraLength + commentLength > end) return fail();
    const name = zip.subarray(cursor+46,cursor+46+nameLength).toString("utf8");
    if (names.has(name) || name.includes("..") || name.includes("\\") || name.startsWith("/") || /vbaProject|\.bin$/i.test(name) || flags & 1 || ![0,8].includes(method) || expanded > 32*1024*1024) return fail();
    names.add(name);
    total += expanded;
    if (total > 32*1024*1024) return fail();
    cursor += 46 + nameLength + extraLength + commentLength;
    if (!/^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/.test(name)) continue;
    if (expanded > MAX_XML || local + 30 > zip.length || zip.readUInt32LE(local) !== 0x04034b50) return fail();
    const localNameLength = zip.readUInt16LE(local+26), localExtraLength = zip.readUInt16LE(local+28);
    const start = local + 30 + localNameLength + localExtraLength;
    if (start + compressed > zip.readUInt32LE(end+16) || zip.subarray(local+30,local+30+localNameLength).toString("utf8") !== name || zip.readUInt16LE(local+8) !== method) return fail();
    const payload = zip.subarray(start,start+compressed);
    const xmlBytes = method === 8 ? inflateRawSync(payload,{maxOutputLength:MAX_XML}) : payload;
    if (xmlBytes.length !== expanded || xmlBytes.length > MAX_XML) return fail();
    const xml = xmlBytes.toString("utf8");
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) return fail();
    const text = xml.replace(/<w:(tab|br)\b[^>]*\/>/g," ").replace(/<\/w:(p|tr)>/g,"\n").replace(/<[^>]+>/g,"")
      .replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, entity => {
        const named: Record<string,string> = {"&amp;":"&","&lt;":"<","&gt;":">","&quot;":'"',"&apos;":"'"};
        if (named[entity]) return named[entity];
        const code = entity.startsWith("&#x") ? parseInt(entity.slice(3,-1),16) : parseInt(entity.slice(2,-1),10);
        return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : "";
      });
    texts.push(text.trim());
  }
  if (cursor !== end || !names.has("[Content_Types].xml") || !names.has("word/document.xml")) return fail();
  const result = texts.join("\n\n").trim();
  if (!result || result.length > 500000) return fail();
  return result;
}
