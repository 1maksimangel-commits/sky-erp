"use client";

import { AlertCircle, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Toast } from "@/components/ui/Toast";
import { upsertExchangeRate } from "@/lib/finance/actions";
import type { ExchangeRate } from "@/lib/finance/db";
import { formatFinanceDate } from "@/lib/finance/format";
import { FINANCE_CURRENCIES, emptyExchangeRateForm } from "@/lib/finance/types";

type ExchangeRatesViewProps = {
  rates: ExchangeRate[] | null;
  currencies: string[];
  error: string | null;
};

export function ExchangeRatesView({
  rates,
  currencies,
  error,
}: ExchangeRatesViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const codes = currencies.length ? currencies : [...FINANCE_CURRENCIES];
  const [form, setForm] = useState({
    base_currency: "USD",
    quote_currency: "EUR",
    rate: "1",
    rate_date: new Date().toISOString().slice(0, 10),
    source: "",
  });

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    const result = await upsertExchangeRate({
      ...emptyExchangeRateForm(),
      base_currency: form.base_currency,
      quote_currency: form.quote_currency,
      rate: Number(form.rate),
      rate_date: form.rate_date,
      source: form.source || null,
    });

    setSaving(false);

    if (!result.success) {
      setFormError(result.error);
      return;
    }

    setToast("Exchange rate saved.");
    startTransition(() => router.refresh());
  }

  return (
    <div className={`space-y-4 ${isPending ? "opacity-70" : ""}`}>
      <p className="text-sm text-muted-foreground">
        Historical FX for USD, EUR, RUB, CNY, JPY, KRW, AED
      </p>

      {toast ? <Toast message={toast} onClose={() => setToast(null)} /> : null}

      <form
        onSubmit={handleSubmit}
        className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 xl:grid-cols-5"
      >
        {formError ? (
          <p className="text-sm text-red-300 sm:col-span-2 xl:col-span-5">
            {formError}
          </p>
        ) : null}
        <select
          value={form.base_currency}
          onChange={(e) =>
            setForm((c) => ({ ...c, base_currency: e.target.value }))
          }
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          {codes.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        <select
          value={form.quote_currency}
          onChange={(e) =>
            setForm((c) => ({ ...c, quote_currency: e.target.value }))
          }
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          {codes.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        <input
          type="number"
          step="any"
          required
          value={form.rate}
          onChange={(e) => setForm((c) => ({ ...c, rate: e.target.value }))}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="Rate"
        />
        <input
          type="date"
          required
          value={form.rate_date}
          onChange={(e) => setForm((c) => ({ ...c, rate_date: e.target.value }))}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Save Rate
        </button>
      </form>

      {!rates?.length ? (
        <div className="rounded-lg border border-card-border bg-card p-12 text-center text-sm text-muted-foreground">
          No exchange rates stored yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-card-border bg-card">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-accent/30">
                {["Date", "Base", "Quote", "Rate", "Source"].map((label) => (
                  <th
                    key={label}
                    className="px-4 py-3 text-xs font-medium text-muted-foreground"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rates.map((rate) => (
                <tr key={rate.id} className="hover:bg-accent/20">
                  <td className="px-4 py-3">
                    {formatFinanceDate(rate.rate_date)}
                  </td>
                  <td className="px-4 py-3">{rate.base_currency}</td>
                  <td className="px-4 py-3">{rate.quote_currency}</td>
                  <td className="px-4 py-3 font-mono text-xs">{rate.rate}</td>
                  <td className="px-4 py-3">{rate.source ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
