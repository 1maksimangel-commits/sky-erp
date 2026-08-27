import type { ProductFormInput } from "@/lib/products/types";

export type ImportStep =
  | "excel"
  | "preview"
  | "validation"
  | "import"
  | "products";

export type ParsedImportRow = {
  rowNumber: number;
  data: ProductFormInput;
  errors: string[];
};

export type ParseExcelResult =
  | { success: true; rows: ParsedImportRow[]; fileName: string }
  | { success: false; error: string };

const COLUMN_ALIASES: Record<string, keyof ProductFormInput | "is_active"> = {
  sku: "sku",
  code: "code",
  name: "name",
  product: "name",
  product_name: "name",
  scientific_name: "scientific_name",
  scientificname: "scientific_name",
  category: "category",
  species: "species",
  origin: "origin",
  country: "country",
  brand: "brand",
  size: "size",
  glaze: "glaze",
  glaze_percent: "glaze",
  glaze_pct: "glaze",
  package_type: "package_type",
  packagetype: "package_type",
  net_weight: "net_weight",
  netweight: "net_weight",
  gross_weight: "gross_weight",
  grossweight: "gross_weight",
  hs_code: "hs_code",
  hscode: "hs_code",
  purchase_price: "purchase_price",
  purchaseprice: "purchase_price",
  sale_price: "sale_price",
  saleprice: "sale_price",
  currency: "currency",
  description: "description",
  image_url: "image_url",
  imageurl: "image_url",
  photo: "image_url",
  status: "is_active",
  is_active: "is_active",
  active: "is_active",
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[%]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function cellToString(value: unknown): string {
  if (value == null) {
    return "";
  }

  return String(value).trim();
}

function parseOptionalNumber(
  value: unknown,
  field: string,
  errors: string[]
): number | null {
  const text = cellToString(value);
  if (!text) {
    return null;
  }

  const num = Number(text.replace(/,/g, ""));
  if (!Number.isFinite(num)) {
    errors.push(`${field} must be a number`);
    return null;
  }

  return num;
}

function parseBoolean(value: unknown): boolean {
  const text = cellToString(value).toLowerCase();

  if (!text) {
    return true;
  }

  if (["inactive", "false", "no", "0", "disabled"].includes(text)) {
    return false;
  }

  if (["active", "true", "yes", "1", "enabled"].includes(text)) {
    return true;
  }

  return true;
}

function mapHeaders(headers: unknown[]): Map<number, keyof ProductFormInput> {
  const mapping = new Map<number, keyof ProductFormInput>();

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    const field = COLUMN_ALIASES[normalized];
    if (field && field !== "is_active") {
      mapping.set(index, field);
    }
  });

  return mapping;
}

function getStatusColumnIndex(headers: unknown[]): number | null {
  const index = headers.findIndex((header) => {
    const normalized = normalizeHeader(header);
    return COLUMN_ALIASES[normalized] === "is_active";
  });

  return index >= 0 ? index : null;
}

type StringProductField = {
  [K in keyof ProductFormInput]: ProductFormInput[K] extends string | null
    ? K
    : never;
}[keyof ProductFormInput];

function assignStringField(
  data: ProductFormInput,
  field: StringProductField,
  value: string
) {
  data[field] = value;
}

function rowToProductInput(
  values: unknown[],
  mapping: Map<number, keyof ProductFormInput>,
  statusIndex: number | null,
  rowNumber: number
): ParsedImportRow {
  const errors: string[] = [];
  const data: ProductFormInput = {
    image_url: null,
    sku: "",
    code: null,
    name: "",
    scientific_name: null,
    category: null,
    species: null,
    origin: null,
    country: null,
    brand: null,
    size: null,
    glaze: null,
    package_type: null,
    net_weight: null,
    gross_weight: null,
    hs_code: null,
    purchase_price: null,
    sale_price: null,
    currency: "USD",
    description: null,
    is_active: true,
  };

  for (const [index, field] of mapping.entries()) {
    const raw = values[index];

    if (
      field === "glaze" ||
      field === "net_weight" ||
      field === "gross_weight" ||
      field === "purchase_price" ||
      field === "sale_price"
    ) {
      data[field] = parseOptionalNumber(raw, field, errors);
      continue;
    }

    const text = cellToString(raw);
    if (!text) {
      continue;
    }

    if (field === "currency") {
      data.currency = text.toUpperCase();
      continue;
    }

    if (field === "sku" || field === "name") {
      data[field] = text;
      continue;
    }

    if (field === "is_active") {
      continue;
    }

    assignStringField(data, field as StringProductField, text);
  }

  if (statusIndex != null) {
    data.is_active = parseBoolean(values[statusIndex]);
  }

  if (!data.name.trim()) {
    errors.push("Product name is required");
  }

  return { rowNumber, data, errors };
}

export function applyDatabaseSkuConflicts(
  rows: ParsedImportRow[],
  existingSkus: string[]
): ParsedImportRow[] {
  const existing = new Set(existingSkus.map((sku) => sku.trim().toLowerCase()));

  return rows.map((row) => {
    const errors = row.errors.filter(
      (error) => error !== "SKU already exists in catalog"
    );
    const sku = row.data.sku.trim().toLowerCase();

    if (sku && existing.has(sku)) {
      errors.push("SKU already exists in catalog");
    }

    return { ...row, errors };
  });
}

export function validateImportRows(rows: ParsedImportRow[]): ParsedImportRow[] {
  const skuCounts = new Map<string, number>();

  for (const row of rows) {
    const sku = row.data.sku.trim().toLowerCase();
    if (sku) {
      skuCounts.set(sku, (skuCounts.get(sku) ?? 0) + 1);
    }
  }

  return rows.map((row) => {
    const errors = [...row.errors];
    const sku = row.data.sku.trim().toLowerCase();

    if (sku && (skuCounts.get(sku) ?? 0) > 1) {
      errors.push("Duplicate SKU in file");
    }

    return { ...row, errors };
  });
}

export async function parseProductExcel(file: File): Promise<ParseExcelResult> {
  try {
    const buffer = await file.arrayBuffer();
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return { success: false, error: "The workbook has no sheets." };
    }

    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
    });

    if (matrix.length < 2) {
      return {
        success: false,
        error: "The file must include a header row and at least one data row.",
      };
    }

    const headers = matrix[0] ?? [];
    const mapping = mapHeaders(headers);
    const statusIndex = getStatusColumnIndex(headers);

    if (![...mapping.values()].includes("name")) {
      return {
        success: false,
        error: 'Missing required column: "Name" or "Product Name".',
      };
    }

    const parsedRows = matrix.slice(1).map((row, index) => {
      const values = Array.isArray(row) ? row : [];
      const isEmpty = values.every((cell) => !cellToString(cell));

      if (isEmpty) {
        return null;
      }

      return rowToProductInput(values, mapping, statusIndex, index + 2);
    });

    const rows = validateImportRows(
      parsedRows.filter((row): row is ParsedImportRow => row != null)
    );

    if (rows.length === 0) {
      return { success: false, error: "No product rows found in the file." };
    }

    return { success: true, rows, fileName: file.name };
  } catch {
    return {
      success: false,
      error: "Unable to read the Excel file. Please upload a valid .xlsx or .xls file.",
    };
  }
}

export const IMPORT_STEPS: { id: ImportStep; label: string }[] = [
  { id: "excel", label: "Excel" },
  { id: "preview", label: "Preview" },
  { id: "validation", label: "Validation" },
  { id: "import", label: "Import" },
  { id: "products", label: "Products" },
];
