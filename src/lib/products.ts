import { createClient } from "@/lib/supabase/server";

export type Product = {
  id: string;
  sku: string;
  name: string;
  scientific_name: string | null;
  category: string | null;
  country: string | null;
  size: string | null;
  purchase_price: number | null;
  sale_price: number | null;
  currency: string | null;
  image_url: string | null;
  is_active: boolean;
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
  "id, sku, name, scientific_name, category, country, size, purchase_price, sale_price, currency, image_url, is_active" as const;

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

  const { data, error } = await supabase
    .from("products")
    .select(productColumns)
    .order("name");

  if (error) {
    return { data: null, stats: null, error: error.message };
  }

  const products = data ?? [];

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

  return { data: data as Product, error: null };
}
