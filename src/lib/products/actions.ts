"use server";

import { assertCan } from "@/lib/platform/permissions";
import { requireCoreCompany } from "@/lib/core/ownership";
import { productInputSchema, validationError, uuid } from "@/lib/core/validation";
import { revalidatePath } from "next/cache";
import { formatProductActionError } from "@/lib/products/errors";
import type { ProductFormInput } from "@/lib/products/types";
import { createClient } from "@/lib/supabase/server";

export type CreateProductResult =
  | { success: true; id?: string }
  | { success: false; error: string };

export type ImportProductsResult =
  | { success: true; imported: number }
  | { success: false; error: string };

export type CheckExistingSkusResult =
  | { success: true; existingSkus: string[] }
  | { success: false; error: string };

function nullIfEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function productInputToRow(input: ProductFormInput) {
  const sku = input.sku.trim();
  const name = input.name.trim();

  return {
    unit: nullIfEmpty(input.unit),
    size_grade: nullIfEmpty(input.size_grade),
    image_url: nullIfEmpty(input.image_url),
    sku,
    code: nullIfEmpty(input.code),
    name,
    scientific_name: nullIfEmpty(input.scientific_name),
    category: nullIfEmpty(input.category),
    species: nullIfEmpty(input.species),
    origin: nullIfEmpty(input.origin),
    country: nullIfEmpty(input.country),
    brand: nullIfEmpty(input.brand),
    size: nullIfEmpty(input.size),
    glaze: input.glaze,
    package_type: nullIfEmpty(input.package_type),
    net_weight: input.net_weight,
    gross_weight: input.gross_weight,
    hs_code: nullIfEmpty(input.hs_code),
    purchase_price: input.purchase_price,
    sale_price: input.sale_price,
    currency: nullIfEmpty(input.currency)?.toUpperCase() ?? "USD",
    description: nullIfEmpty(input.description),
    is_active: input.is_active,
  };
}

function isUniqueViolation(error: { code?: string; message: string }): boolean {
  return error.code === "23505" || /unique|duplicate/i.test(error.message);
}

export async function checkExistingSkus(
  skus: string[]
): Promise<CheckExistingSkusResult> {
  const uniqueSkus = [...new Set(skus.map((sku) => sku.trim()).filter(Boolean))];

  if (uniqueSkus.length === 0) {
    return { success: true, existingSkus: [] };
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("find_core_product_skus", { p_skus: uniqueSkus });

    if (error) {
      return {
        success: false,
        error: formatProductActionError(error, "sku-check"),
      };
    }

    return {
      success: true,
      existingSkus: (data ?? []).filter((value: unknown): value is string => typeof value === "string"),
    };
  } catch (error) {
    return {
      success: false,
      error: formatProductActionError(error, "sku-check"),
    };
  }
}

export async function importProducts(
  products: ProductFormInput[]
): Promise<ImportProductsResult> {
  if (products.length === 0) {
    return { success: false, error: "No products to import." };
  }

  try {
    const supabase = await createClient();

    const denied = await assertCan("products.write");
    if (denied) return { success: false, error: denied };
    const companyId = await requireCoreCompany();
    for (const product of products) {
      const invalid = validationError(productInputSchema, product);
      if (invalid) return { success: false, error: invalid };
    }

    const { error } = await supabase
      .from("products")
      .insert(products.map(input => ({ ...productInputToRow(input), company_id: companyId })));

    if (error) {
      if (isUniqueViolation(error)) {
        return { success: false, error: "SKU must be unique." };
      }

      return {
        success: false,
        error: formatProductActionError(error, "import"),
      };
    }

    revalidatePath("/products");
    revalidatePath("/dashboard");
    return { success: true, imported: products.length };
  } catch (error) {
    return {
      success: false,
      error: formatProductActionError(error, "import"),
    };
  }
}

export async function createProduct(
  input: ProductFormInput
): Promise<CreateProductResult> {
  // Never throw out of this server action: Next.js 16 can surface a secondary
  // "TypeError: args.map is not a function" when action errors are rethrown.
  try {
    if (!input || typeof input !== "object") {
      return {
        success: false,
        error: "Invalid product payload. Please reload and try again.",
      };
    }

    const denied = await assertCan("products.write");
    if (denied) return { success: false, error: denied };
    const invalid = validationError(productInputSchema, input);
    if (invalid) return { success: false, error: invalid };
    const companyId = await requireCoreCompany();
    const sku = (input.sku ?? "").trim();
    const name = (input.name ?? "").trim();

    if (!name) {
      return { success: false, error: "Product name is required." };
    }

    const supabase = await createClient();

    if (sku) {
      const { data: existing, error: lookupError } = await supabase
        .from("products")
        .select("id")
        .eq("sku", sku)
        .eq("company_id", companyId)
        .maybeSingle();

      if (lookupError) {
        return {
          success: false,
          error: formatProductActionError(lookupError, "create"),
        };
      }

      if (existing) {
        return { success: false, error: "SKU must be unique." };
      }
    }

    const { data, error } = await supabase
      .from("products")
      .insert({ ...productInputToRow({ ...input, sku, name }), company_id: companyId })
      .select("id")
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        return { success: false, error: "SKU must be unique." };
      }

      return {
        success: false,
        error: formatProductActionError(error, "create"),
      };
    }

    revalidatePath("/products");
    revalidatePath("/dashboard");
    return { success: true, id: data.id };
  } catch (error) {
    return {
      success: false,
      error: formatProductActionError(error, "create"),
    };
  }
}

export async function updateProduct(id: string, input: ProductFormInput): Promise<CreateProductResult> {
  try {
    const denied = await assertCan("products.write");
    if (denied) return { success: false, error: denied };
    const invalid = validationError(productInputSchema, input);
    if (invalid || !uuid.safeParse(id).success) return { success: false, error: invalid ?? "Invalid Product ID." };
    const client = await createClient();
    const { data, error } = await client.from("products").update(productInputToRow(input)).eq("id", id).select("id").maybeSingle();
    if (error || !data) return { success: false, error: error?.message ?? "Product not found or access denied." };
    revalidatePath("/products"); revalidatePath(`/products/${id}`);
    return { success: true, id };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Unable to update Product." }; }
}
export async function setProductActive(id: string, active: boolean): Promise<CreateProductResult> {
  const denied = await assertCan("products.write");
  if (denied) return { success: false, error: denied };
  if (!uuid.safeParse(id).success || typeof active !== "boolean") return { success: false, error: "Invalid Product status request." };
  const client = await createClient();
  const { data, error } = await client.from("products").update({ is_active: active }).eq("id", id).select("id").maybeSingle();
  if (error || !data) return { success: false, error: error?.message ?? "Product not found or access denied." };
  revalidatePath("/products"); revalidatePath(`/products/${id}`);
  return { success: true, id };
}
