export type ProductLine = { name: string; size?: string | null; quantity: number; unit?: string | null; netWeight?: number | null; grossWeight?: number | null; unitPrice?: number | null };
export type ProductLineResult = ProductLine & { lineAmount: number };
export type PageSettings = { paper: "A4"; orientation: "portrait" | "landscape"; marginTop: number; marginRight: number; marginBottom: number; marginLeft: number; pageNumbers: boolean };
export const DEFAULT_PAGE_SETTINGS: PageSettings = { paper: "A4", orientation: "portrait", marginTop: 20, marginRight: 20, marginBottom: 20, marginLeft: 20, pageNumbers: true };

export function calculateProductLines(lines: ProductLine[]) {
  const rows = lines.map((line) => ({ ...line, lineAmount: Number(((line.quantity || 0) * (line.unitPrice || 0)).toFixed(2)) }));
  return { rows, subtotal: Number(rows.reduce((sum, row) => sum + row.lineAmount, 0).toFixed(2)), totalNetWeight: Number(rows.reduce((sum, row) => sum + (row.netWeight || 0), 0).toFixed(3)), totalGrossWeight: Number(rows.reduce((sum, row) => sum + (row.grossWeight || 0), 0).toFixed(3)) };
}

export function renderRepeatingProductRows(lines: ProductLine[]) {
  return calculateProductLines(lines).rows.map((row, index) => [index + 1, row.name, row.size || "", row.quantity, row.unit || "", row.netWeight ?? "", row.grossWeight ?? "", row.unitPrice ?? "", row.lineAmount]);
}

export type DocumentLifecycle = "Draft" | "Final" | "Issued";
export type DocumentSnapshot<T> = { status: DocumentLifecycle; version: number; snapshot: T; createdAt: string; hash: string; supersedesId: string | null };

export function createImmutableSnapshot<T>(data: T, status: DocumentLifecycle = "Draft", version = 1, supersedesId: string | null = null): DocumentSnapshot<T> {
  const snapshot = structuredClone(data);
  const serialized = JSON.stringify(snapshot);
  let hash = 0;
  for (let i = 0; i < serialized.length; i += 1) hash = (hash * 31 + serialized.charCodeAt(i)) | 0;
  return { status, version, snapshot, createdAt: new Date().toISOString(), hash: String(hash), supersedesId };
}

export const REUSABLE_BLOCKS = ["SELLER_DETAILS", "BUYER_DETAILS", "SUPPLIER_DETAILS", "CONSIGNEE_DETAILS", "BANK_DETAILS", "PRODUCT_TABLE", "DELIVERY_TERMS", "PAYMENT_TERMS", "SIGNATURES"] as const;
