export const PRODUCT_CATEGORIES = [
  "Fish",
  "Crab",
  "Shrimp",
  "Shellfish",
  "Cephalopod",
  "Roe",
  "Other",
] as const;

export const PRODUCT_COUNTRIES = [
  "Russia",
  "China",
  "Japan",
  "South Korea",
  "Norway",
  "Canada",
  "United States",
  "Other",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export type ProductCountry = (typeof PRODUCT_COUNTRIES)[number];

export type ProductSpeciesPreset = {
  species: string;
  scientific_name?: string;
  category?: ProductCategory;
  hs_code?: string;
};

/** Lightweight local seafood presets for New Product suggestions. */
export const PRODUCT_SPECIES_PRESETS: ProductSpeciesPreset[] = [
  {
    species: "Top Shell",
    scientific_name: "Neptunea polycostata",
    category: "Shellfish",
  },
  {
    species: "Pacific Cod",
    scientific_name: "Gadus macrocephalus",
    category: "Fish",
  },
  {
    species: "Pollock",
    scientific_name: "Gadus chalcogrammus",
    category: "Fish",
  },
  {
    species: "Northern Shrimp",
    scientific_name: "Pandalus borealis",
    category: "Shrimp",
  },
  {
    species: "Snow Crab",
    scientific_name: "Chionoecetes opilio",
    category: "Crab",
  },
  {
    species: "Whelk",
    category: "Shellfish",
  },
];

export function matchProductPreset(
  species: string
): ProductSpeciesPreset | null {
  const normalized = species.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return (
    PRODUCT_SPECIES_PRESETS.find(
      (preset) => preset.species.toLowerCase() === normalized
    ) ?? null
  );
}

type PresetSuggestionFields = {
  scientific_name: string;
  category: string;
  hs_code: string;
};

/**
 * Suggest preset values only into empty fields.
 * Never overwrites values already entered by the user.
 */
export function applyProductPresetSuggestions<T extends PresetSuggestionFields>(
  current: T,
  preset: ProductSpeciesPreset
): T {
  return {
    ...current,
    scientific_name: current.scientific_name.trim()
      ? current.scientific_name
      : (preset.scientific_name ?? current.scientific_name),
    category: current.category.trim()
      ? current.category
      : (preset.category ?? current.category),
    hs_code: current.hs_code.trim()
      ? current.hs_code
      : (preset.hs_code ?? current.hs_code),
  };
}
