import type {
  ContractExtractionResult,
  ContractImportMatchBundle,
  EntityMatchCandidate,
  EntityMatchResult,
  MatchState,
  ProductLineMatch,
} from "@/lib/ai/contracts/schema";
import { asNumber, asString } from "@/lib/ai/contracts/schema";
import type { Company } from "@/lib/companies";
import type { Counterparty } from "@/lib/counterparties";
import type { Product } from "@/lib/products";

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function scoreNames(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.86;
  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = new Set(b.split(" ").filter(Boolean));
  if (!aTokens.size || !bTokens.size) return 0;
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }
  const ratio = overlap / Math.max(aTokens.size, bTokens.size);
  return ratio >= 0.6 ? 0.7 + ratio * 0.2 : ratio * 0.65;
}

function matchStateFromCandidates(
  candidates: EntityMatchCandidate[]
): MatchState {
  if (candidates.length === 0) return "none";
  const top = candidates[0];
  const close = candidates.filter((item) => item.score >= 0.9);
  if (close.length > 1) return "multiple";
  if (top.score >= 0.98) return "exact";
  if (top.score >= 0.75) return "probable";
  return "none";
}

function buildEntityMatch(input: {
  role: EntityMatchResult["role"];
  extractedName: string | null;
  candidates: EntityMatchCandidate[];
}): EntityMatchResult {
  const ranked = [...input.candidates]
    .filter((item) => item.score >= 0.55)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  const state = matchStateFromCandidates(ranked);
  return {
    role: input.role,
    extractedName: input.extractedName,
    state,
    selectedId: state === "exact" && ranked[0] ? ranked[0].id : null,
    candidates: ranked,
    requiresConfirmation: state === "probable" || state === "multiple",
  };
}

export function matchCompanies(
  extractedName: string | null,
  registrationNumber: string | null,
  taxId: string | null,
  companies: Company[]
): EntityMatchResult {
  const normalized = normalizeName(extractedName);
  const candidates: EntityMatchCandidate[] = [];

  for (const company of companies) {
    let score = 0;
    let reason = "Normalized name similarity";

    const nameScore = Math.max(
      scoreNames(normalized, normalizeName(company.name)),
      scoreNames(normalized, normalizeName(company.short_name))
    );
    score = nameScore;
    if (nameScore >= 0.99) reason = "Normalized legal/short name exact match";

    if (company.code && normalized === normalizeName(company.code)) {
      score = Math.max(score, 0.95);
      reason = "Code match";
    }

    // Company table in app has no tax/registration fields yet; keep name priority.
    void registrationNumber;
    void taxId;

    if (score >= 0.55) {
      candidates.push({
        id: company.id,
        label: company.name,
        score,
        reason,
      });
    }
  }

  return buildEntityMatch({
    role: "company",
    extractedName,
    candidates,
  });
}

export function matchCounterparties(
  role: "buyer" | "supplier" | "consignee",
  extractedName: string | null,
  shortName: string | null,
  registrationNumber: string | null,
  taxId: string | null,
  counterparties: Counterparty[]
): EntityMatchResult {
  const normalized = normalizeName(extractedName);
  const normalizedShort = normalizeName(shortName);
  const reg = registrationNumber?.trim().toLowerCase() ?? "";
  const tax = taxId?.trim().toLowerCase() ?? "";
  const candidates: EntityMatchCandidate[] = [];

  for (const party of counterparties) {
    let score = 0;
    let reason = "Normalized name similarity";

    if (tax && party.tax_id?.trim().toLowerCase() === tax) {
      score = 1;
      reason = "tax_id exact match";
    } else if (
      reg &&
      party.registration_number?.trim().toLowerCase() === reg
    ) {
      score = 0.99;
      reason = "registration_number exact match";
    } else {
      const legalScore = scoreNames(
        normalized,
        normalizeName(party.legal_name)
      );
      const shortScore = Math.max(
        scoreNames(normalizedShort, normalizeName(party.short_name)),
        scoreNames(normalized, normalizeName(party.short_name)),
        scoreNames(normalizedShort, normalizeName(party.legal_name))
      );
      score = Math.max(legalScore, shortScore);
      if (legalScore >= 0.99) reason = "normalized legal_name exact match";
      else if (shortScore >= 0.99) reason = "normalized short_name exact match";
      else if (score >= 0.75) reason = "fuzzy legal_name probable match";
    }

    if (score >= 0.55) {
      candidates.push({
        id: party.id,
        label: party.legal_name,
        score,
        reason,
      });
    }
  }

  return buildEntityMatch({
    role,
    extractedName,
    candidates,
  });
}

export function matchProducts(
  extraction: ContractExtractionResult,
  products: Product[]
): ProductLineMatch[] {
  return extraction.products.map((line, lineIndex) => {
    const label =
      asString(line.product_name) ||
      asString(line.description) ||
      asString(line.scientific_name);
    const sku = asString(line.sku);
    const scientific = normalizeName(asString(line.scientific_name));
    const normalized = normalizeName(label);
    const size = normalizeName(asString(line.size));
    const candidates: EntityMatchCandidate[] = [];

    for (const product of products) {
      let score = 0;
      let reason = "Probable product match";

      if (sku && product.sku.trim().toLowerCase() === sku.toLowerCase()) {
        score = 1;
        reason = "SKU exact match";
      } else {
        score = Math.max(
          scoreNames(normalized, normalizeName(product.name)),
          scoreNames(scientific, normalizeName(product.scientific_name)),
          scoreNames(normalizeName(sku), normalizeName(product.sku))
        );
        if (size && normalizeName(product.size) === size) {
          score = Math.min(1, score + 0.08);
        }
        if (score >= 0.95) reason = "Strong product name/scientific match";
      }

      if (score >= 0.55) {
        candidates.push({
          id: product.id,
          label: `${product.sku} — ${product.name}`,
          score,
          reason,
        });
      }
    }

    const ranked = candidates.sort((a, b) => b.score - a.score).slice(0, 5);
    const state = matchStateFromCandidates(ranked);

    return {
      lineIndex,
      state: state === "none" ? "create" : state,
      selectedProductId: state === "exact" && ranked[0] ? ranked[0].id : null,
      candidates: ranked,
      extractedLabel: label,
      quantity: asNumber(line.quantity),
    };
  });
}

export function buildImportMatches(input: {
  extraction: ContractExtractionResult;
  companies: Company[];
  counterparties: Counterparty[];
  products: Product[];
}): ContractImportMatchBundle {
  const { extraction, companies, counterparties, products } = input;

  const company = matchCompanies(
    asString(extraction.company.company_legal_name),
    asString(extraction.company.company_registration_number),
    asString(extraction.company.company_tax_id),
    companies
  );

  const buyer = matchCounterparties(
    "buyer",
    asString(extraction.buyer.buyer_legal_name),
    asString(extraction.buyer.buyer_short_name),
    asString(extraction.buyer.buyer_registration_number),
    asString(extraction.buyer.buyer_tax_id),
    counterparties
  );

  const supplier = matchCounterparties(
    "supplier",
    asString(extraction.supplier.supplier_legal_name),
    asString(extraction.supplier.supplier_short_name),
    asString(extraction.supplier.supplier_registration_number),
    asString(extraction.supplier.supplier_tax_id),
    counterparties
  );

  const consignee = matchCounterparties(
    "consignee",
    asString(extraction.consignee.consignee_legal_name),
    null,
    null,
    null,
    counterparties
  );

  return {
    company,
    buyer,
    supplier,
    consignee,
    products: matchProducts(extraction, products),
  };
}
