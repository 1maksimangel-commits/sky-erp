export function formatMoney(
  value: number | null | undefined,
  currency: string | null | undefined = "USD"
): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toLocaleString()} ${currency ?? ""}`.trim();
  }
}

export function formatFinanceDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function toNumber(value: number | string | null | undefined): number {
  if (value == null) {
    return 0;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Round to 2 decimal places for money (cent precision). Avoids long float tails. */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function normalizeCurrencyCode(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

export function isSupportedFinanceCurrency(value: string | null | undefined): boolean {
  const code = normalizeCurrencyCode(value);
  return /^[A-Z]{3}$/.test(code);
}
