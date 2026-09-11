import { getDealProfitability } from "@/lib/finance/profitability-actions";
import { getCompanies } from "@/lib/companies";
import { DealEconomicsView } from "./DealEconomicsView";
import { getExchangeRates } from "@/lib/finance/db";
import { getRealizationChoices } from "@/lib/finance/realization-actions";

export async function DealEconomics({ dealId, companyId, contracts, dealLines }: { dealId: string; companyId: string | null; contracts: { id: string; label: string }[]; dealLines: { id: string; label: string }[] }) {
  const [result, companies, rates, choices] = await Promise.all([
    getDealProfitability({ deal_id: dealId, company_id: companyId, reporting_currency: "USD" }),
    getCompanies(),
    getExchangeRates(),
    getRealizationChoices(dealId),
  ]);
  return <DealEconomicsView dealId={dealId} initialCompanyId={companyId} initialReport={result.data}
    initialError={result.error ?? companies.error ?? rates.error ?? choices.error} companies={(companies.data ?? []).map(company => ({ id: company.id, name: company.name }))}
    contracts={contracts} dealLines={dealLines} contractLines={choices.contractProducts.map(line => ({ id: line.id, label: `${line.description} · ${line.unit}` }))}
    rates={(rates.data ?? []).map(rate => ({ id: rate.id, base: rate.base_currency, quote: rate.quote_currency, label: `${rate.base_currency} → ${rate.quote_currency} · ${rate.rate_date} · ${rate.source ?? "Recorded rate"}` }))} />;
}
