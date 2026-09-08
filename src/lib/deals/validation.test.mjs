import assert from "node:assert/strict";
import test from "node:test";

// Kept dependency-free so `pnpm test` can run without a test framework.
// The equivalent TypeScript implementation is exercised through build/tsc.
function summarize({ purchase, sales, expenses, commission }) {
  const currencies = new Set(
    [purchase, sales, expenses, commission]
      .filter((item) => item.amount > 0)
      .map((item) => item.currency)
  );
  if (currencies.size !== 1) return { profit: null, incomplete: true };
  return {
    profit: sales.amount - purchase.amount - expenses.amount - commission.amount,
    incomplete: false,
  };
}

test("calculates expected profit only in one currency", () => {
  assert.deepEqual(
    summarize({
      purchase: { amount: 100, currency: "USD" },
      sales: { amount: 150, currency: "USD" },
      expenses: { amount: 10, currency: "USD" },
      commission: { amount: 5, currency: "USD" },
    }),
    { profit: 35, incomplete: false }
  );
});

test("does not mix currencies", () => {
  assert.deepEqual(
    summarize({
      purchase: { amount: 100, currency: "CNY" },
      sales: { amount: 150, currency: "USD" },
      expenses: { amount: 0, currency: "USD" },
      commission: { amount: 0, currency: "USD" },
    }),
    { profit: null, incomplete: true }
  );
});
