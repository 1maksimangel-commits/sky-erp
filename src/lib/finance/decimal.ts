/** Decimal boundary for PostgreSQL numeric. Round ties away from zero, like
 * PostgreSQL round(numeric), and send text rather than a binary-float result.
 * Numbers remain accepted for existing forms; strings preserve exact inputs. */
export function moneyDecimal(value: number | string): string {
  if (typeof value === "number" && Math.abs(value) > Number.MAX_SAFE_INTEGER / 100) throw new Error("Use an exact decimal string for large monetary amounts.");
  return decimalAtScale(value, 2);
}

/** Commission rates and physical quantities retain twelve decimal places.
 * This precision is independent from two-place monetary settlement amounts. */
export function basisDecimal(value: number | string): string {
  return decimalAtScale(value, 12);
}

function decimalAtScale(value: number | string, scale: number): string {
  if (typeof value === "number" && (!Number.isFinite(value) || !Number.isSafeInteger(Math.trunc(value)))) throw new Error("A finite, safely represented decimal value is required; use a string for large values.");
  const text = String(value).trim();
  const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(text);
  if (!match || text.length > 400) throw new Error("Invalid decimal amount.");
  const exponent = Number(match[4] ?? 0);
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 308) throw new Error("Decimal amount is outside the supported range.");
  const fraction = match[3] ?? "";
  const digits = BigInt(match[2] + fraction);
  const shift = scale + exponent - fraction.length;
  const divisor = shift < 0 ? BigInt(10) ** BigInt(-shift) : BigInt(1);
  const cents = shift < 0 ? (digits + divisor / BigInt(2)) / divisor : digits * BigInt(10) ** BigInt(shift);
  const padded = cents.toString().padStart(scale + 1, "0");
  return `${match[1] === "-" && cents !== BigInt(0) ? "-" : ""}${padded.slice(0, -scale)}.${padded.slice(-scale)}`;
}
