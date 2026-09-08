import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont } from "pdf-lib";

export type ContractPdfLine = {
  name: string;
  sku: string | null;
  quantity: number | null;
};

export type ContractPdfInput = {
  documentKind?: "contract" | "annex" | "supplement" | "invoice";
  contractNumber: string;
  title: string | null;
  status: string | null;
  contractDate: string | null;
  expiryDate: string | null;
  company: string | null;
  buyer: string | null;
  supplier: string | null;
  currency: string | null;
  amount: number | null;
  incoterms: string | null;
  products: ContractPdfLine[];
  seal?: Uint8Array | null;
  sealMimeType?: string | null;
  signature?: Uint8Array | null;
  signatureMimeType?: string | null;
};

function printable(value: string): string {
  return value.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function formatMoney(amount: number | null, currency: string | null): string {
  if (amount == null) return "Not specified";
  return `${currency ?? ""} ${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`.trim();
}

async function embedImage(
  pdf: PDFDocument,
  bytes: Uint8Array | null | undefined,
  mimeType: string | null | undefined
): Promise<PDFImage | null> {
  if (!bytes) return null;
  if (mimeType === "image/png") return pdf.embedPng(bytes);
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return pdf.embedJpg(bytes);
  throw new Error("Seal and signature files must be PNG or JPEG images.");
}

function drawWrapped(
  page: ReturnType<PDFDocument["addPage"]>,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size = 10
): number {
  const words = printable(text).split(/\s+/);
  let line = "";
  let cursor = y;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) page.drawText(line, { x, y: cursor, size, font });
    cursor -= size + 4;
    line = word;
  }
  if (line) page.drawText(line, { x, y: cursor, size, font });
  return cursor - size - 4;
}

export async function createContractPdf(input: ContractPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]);
  const { height } = page.getSize();
  const margin = 52;
  let y = height - margin;

  const heading =
    input.documentKind === "annex" || input.documentKind === "supplement"
      ? "ANNEX TO CONTRACT"
      : input.documentKind === "invoice"
        ? "COMMERCIAL INVOICE"
        : "SALES CONTRACT";
  page.drawText(heading, { x: margin, y, size: 17, font: bold });
  page.drawText(printable(input.contractNumber), {
    x: 390,
    y,
    size: 11,
    font: bold,
  });
  y -= 30;

  const detail = (label: string, value: string | null) => {
    page.drawText(label, { x: margin, y, size: 9, font: bold, color: rgb(0.35, 0.35, 0.38) });
    y = drawWrapped(page, regular, value || "Not specified", margin + 120, y, 365, 10);
  };

  detail("Title", input.title);
  detail("Status", input.status ?? "Draft");
  detail("Contract date", input.contractDate);
  detail("Expiry date", input.expiryDate);
  y -= 6;
  detail("Seller / company", input.company);
  detail("Buyer", input.buyer);
  detail("Supplier", input.supplier);
  y -= 6;
  detail("Contract value", formatMoney(input.amount, input.currency));
  detail("Incoterms", input.incoterms);
  y -= 10;

  page.drawText("PRODUCTS", { x: margin, y, size: 11, font: bold });
  y -= 20;
  if (!input.products.length) {
    page.drawText("No product lines specified.", { x: margin, y, size: 10, font: regular });
    y -= 18;
  } else {
    for (const [index, product] of input.products.entries()) {
      const quantity = product.quantity == null ? "quantity not specified" : `qty ${product.quantity}`;
      y = drawWrapped(
        page,
        regular,
        `${index + 1}. ${product.name}${product.sku ? ` (${product.sku})` : ""} - ${quantity}`,
        margin,
        y,
        485,
        10
      );
    }
  }

  y = Math.min(y - 18, 225);
  page.drawLine({ start: { x: margin, y }, end: { x: 260, y }, thickness: 0.7 });
  page.drawLine({ start: { x: 335, y }, end: { x: 543, y }, thickness: 0.7 });
  page.drawText("For seller", { x: margin, y: y - 15, size: 9, font: regular });
  page.drawText("For buyer", { x: 335, y: y - 15, size: 9, font: regular });

  const [seal, signature] = await Promise.all([
    embedImage(pdf, input.seal, input.sealMimeType),
    embedImage(pdf, input.signature, input.signatureMimeType),
  ]);
  if (seal) {
    const scaled = seal.scaleToFit(105, 105);
    page.drawImage(seal, { x: 115, y: y - 5, width: scaled.width, height: scaled.height });
  }
  if (signature) {
    const scaled = signature.scaleToFit(120, 65);
    page.drawImage(signature, { x: 360, y: y - 2, width: scaled.width, height: scaled.height });
  }

  page.drawText(`Generated by SKY ERP on ${new Date().toISOString()}`, {
    x: margin,
    y: 28,
    size: 7,
    font: regular,
    color: rgb(0.45, 0.45, 0.48),
  });
  return pdf.save();
}
