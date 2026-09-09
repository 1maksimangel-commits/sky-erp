import { getActiveCompanyId } from "@/lib/platform/company-scope";
import { createClient } from "@/lib/supabase/server";

type ProductInput = import("@/lib/products/types").ProductFormInput;
export type Product = Partial<ProductInput> & Pick<ProductInput,
  "sku" | "name" | "scientific_name" | "category" | "country" | "size" |
  "purchase_price" | "sale_price" | "currency" | "image_url" | "is_active"
> & {
  id: string;
  company_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ProductStats = {
  total: number;
  active: number;
  inactive: number;
  categories: number;
};

export type ProductsResult =
  | { data: Product[]; stats: ProductStats; error: null }
  | { data: null; stats: null; error: string };

const productColumns =
  "id, company_id, created_at, updated_at, sku, code, name, scientific_name, category, species, origin, country, brand, size, size_grade, unit, glaze, package_type, net_weight, gross_weight, hs_code, description, purchase_price, sale_price, currency, image_url, is_active" as const;

function computeStats(products: Product[]): ProductStats {
  const categories = new Set(
    products.map((p) => p.category).filter((c): c is string => Boolean(c))
  );

  return {
    total: products.length,
    active: products.filter((p) => p.is_active).length,
    inactive: products.filter((p) => !p.is_active).length,
    categories: categories.size,
  };
}

export async function getProducts(): Promise<ProductsResult> {
  const supabase = await createClient();

  let query = supabase.from("products").select(productColumns).order("name");
  const companyId = await getActiveCompanyId();
  if (companyId) query = query.eq("company_id", companyId);
  const { data, error } = await query;

  if (error) {
    return { data: null, stats: null, error: error.message };
  }

  const products = (data ?? []).map(row => ({ ...row, sku: row.sku ?? "" }));

  return {
    data: products,
    stats: computeStats(products),
    error: null,
  };
}

export type ProductResult =
  | { data: Product; error: null }
  | { data: null; error: string };

export async function getProductById(id: string): Promise<ProductResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(productColumns)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  if (!data) {
    return { data: null, error: "Product not found." };
  }

  return { data: { ...data, sku: data.sku ?? "" }, error: null };
}
