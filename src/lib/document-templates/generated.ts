import { calculateProductLines, type PageSettings, DEFAULT_PAGE_SETTINGS, type ProductLine, createImmutableSnapshot } from "./engine";

export type CanonicalDocumentData = {
  deal?: Record<string, unknown>;
  contract?: Record<string, unknown>;
  seller?: Record<string, unknown> | null;
  buyer?: Record<string, unknown> | null;
  supplier?: Record<string, unknown> | null;
  consignee?: Record<string, unknown> | null;
  products?: ProductLine[];
  commercial?: Record<string, unknown>;
  delivery?: Record<string, unknown>;
  shipment?: Record<string, unknown>;
  manual?: Record<string, unknown>;
};

const valueAt = (root: unknown, path: string): unknown => path.split(".").reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, root);

export function calculatedValues(products: ProductLine[] = []) {
  const result = calculateProductLines(products);
  return { line_amount: result.rows.map((row) => row.lineAmount), subtotal: result.subtotal, total: result.subtotal, total_net_weight: result.totalNetWeight, total_gross_weight: result.totalGrossWeight };
}

export function renderTemplate(template: string, data: CanonicalDocumentData, overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = { ...data, ...overrides, calculated: calculatedValues(data.products ?? []) };
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, key: string) => {
    const value = valueAt(values, key.trim());
    return value == null ? "" : String(value);
  });
}

export function renderProductTable(products: ProductLine[] = []) {
  const rows = calculateProductLines(products).rows;
  const header = ["No.", "Product", "Size/Grade", "Quantity", "Unit", "Net Weight", "Gross Weight", "Unit Price", "Amount"];
  return [header, ...rows.map((row, index) => [index + 1, row.name, row.size ?? "", row.quantity, row.unit ?? "", row.netWeight ?? "", row.grossWeight ?? "", row.unitPrice ?? "", row.lineAmount])];
}

export type GeneratedDocumentState = { id?: string; status: "Draft" | "Final" | "Issued"; version: number; templateVersion: number; pageSettings: PageSettings; canonical: CanonicalDocumentData; overrides: Record<string, unknown>; rendered: string; calculated: ReturnType<typeof calculatedValues>; createdAt: string; generatedBy?: string | null; supersedesId?: string | null };

export function createGeneratedDocument(input: Omit<GeneratedDocumentState, "status" | "version" | "createdAt" | "calculated" | "rendered" | "pageSettings"> & { template: string; pageSettings?: PageSettings; status?: "Draft" | "Final" | "Issued"; version?: number; supersedesId?: string | null }) {
  const rendered = renderTemplate(input.template, input.canonical, input.overrides);
  const snapshot = createImmutableSnapshot({ canonical: input.canonical, overrides: input.overrides, rendered, calculated: calculatedValues(input.canonical.products ?? []), templateVersion: input.templateVersion, pageSettings: input.pageSettings ?? DEFAULT_PAGE_SETTINGS }, input.status ?? "Draft", input.version ?? 1, input.supersedesId ?? null);
  return { ...input, status: snapshot.status, version: snapshot.version, createdAt: snapshot.createdAt, rendered, calculated: calculatedValues(input.canonical.products ?? []), pageSettings: input.pageSettings ?? DEFAULT_PAGE_SETTINGS, supersedesId: input.supersedesId ?? null } satisfies GeneratedDocumentState;
}

export function createRevision(previous: GeneratedDocumentState, changes: Partial<Pick<GeneratedDocumentState, "canonical" | "overrides" | "rendered" | "pageSettings" | "templateVersion">>, template: string) {
  if (previous.status !== "Final" && previous.status !== "Issued") throw new Error("Only Final/Issued documents can be revised.");
  const canonical = changes.canonical ?? previous.canonical;
  return createGeneratedDocument({ template, canonical, overrides: changes.overrides ?? previous.overrides, templateVersion: changes.templateVersion ?? previous.templateVersion, pageSettings: changes.pageSettings ?? previous.pageSettings, status: "Draft", version: previous.version + 1, supersedesId: previous.id ?? null, generatedBy: previous.generatedBy });
}
