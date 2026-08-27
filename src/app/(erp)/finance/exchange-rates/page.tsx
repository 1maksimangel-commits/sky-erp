import { ExchangeRatesView } from "@/components/finance/ExchangeRatesView";
import { getExchangeRates, getFinanceOptions } from "@/lib/finance/db";

export default async function ExchangeRatesPage() {
  const [{ data, error }, options] = await Promise.all([
    getExchangeRates(),
    getFinanceOptions(),
  ]);

  return (
    <ExchangeRatesView
      rates={data}
      currencies={options.currencies}
      error={error}
    />
  );
}
