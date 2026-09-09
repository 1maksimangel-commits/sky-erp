export type ProductFormInput = {
  unit?: string | null;
  size_grade?: string | null;
  image_url: string | null;
  sku: string;
  code: string | null;
  name: string;
  scientific_name: string | null;
  category: string | null;
  species: string | null;
  origin: string | null;
  country: string | null;
  brand: string | null;
  size: string | null;
  glaze: number | null;
  package_type: string | null;
  net_weight: number | null;
  gross_weight: number | null;
  hs_code: string | null;
  purchase_price: number | null;
  sale_price: number | null;
  currency: string | null;
  description: string | null;
  is_active: boolean;
};

export const emptyProductForm = (): ProductFormInput => ({
  image_url: null,
  unit: "kg",
  size_grade: null,
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
});
