import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

export type ContractTemplateData = Record<string, unknown>;

export function renderContractDocx(templateBytes: Uint8Array, data: ContractTemplateData): Uint8Array {
  const zip = new PizZip(templateBytes);
  const document = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });
  document.render(data);
  const output = document.getZip().generate({ type: "uint8array", compression: "DEFLATE" });
  return output;
}

export function renderUploadedDocx(templateBytes: Uint8Array, data: ContractTemplateData & { products?: Array<Record<string, unknown>> }): Uint8Array {
  const zip = new PizZip(templateBytes);
  const xmlFile = zip.file("word/document.xml");
  if (!xmlFile) return renderContractDocx(templateBytes, data);
  let xml = xmlFile.asText();
  const products = data.products ?? [];
  const rowPattern = /<w:tr[\s\S]*?<\/w:tr>/g;
  xml = xml.replace(rowPattern, (row) => {
    if (!row.includes("{{product.")) return row;
    return products.map((product, index) => row.replace(/\{\{\s*product\.([\w]+)\s*\}\}/g, (_m, key: string) => escapeXml(String(key === "number" ? index + 1 : product[key] ?? "")))).join("");
  });
  xml = xml.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, key: string) => escapeXml(String(data[key.trim()] ?? "")));
  zip.file("word/document.xml", xml);
  return zip.generate({ type: "uint8array", compression: "DEFLATE" });
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Render an in-app plain-text master template into a valid DOCX package. */
export function renderTextTemplateDocx(content: string, data: ContractTemplateData): Uint8Array {
  const plainContent = content.replace(/<br\s*\/?>(?=.)/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "");
  const paragraphs = plainContent.split(/\r?\n/).map((line) => line.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, rawKey: string) => {
    const key = rawKey.trim();
    const direct = data[key] ?? data[key.replaceAll(".", "_")];
    return direct == null ? "" : String(direct);
  }));
  const body = paragraphs.map((line) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`).join("");
  const zip = new PizZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`);
  return zip.generate({ type: "uint8array", compression: "DEFLATE" });
}
