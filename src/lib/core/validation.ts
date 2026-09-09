import { z } from "zod";
import { COUNTERPARTY_TYPES } from "@/lib/counterparties/types";
import { DEAL_STATUSES } from "@/lib/deals/types";

export const uuid = z.string().uuid("Select a valid record.");
export const optionalUuid = uuid.nullish();
export const currency = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a three-letter currency code.");
const text = z.string().trim().nullable().optional();
const name = z.string().trim().min(1, "Name is required.").max(500);
const amount = z.number().finite().min(0).max(1_000_000_000).nullable().optional();
const date = z.string().date("Use a valid calendar date.").nullable().optional();

export const companyInputSchema = z.object({
  code: name, name, business_role: z.enum(["Seller", "Buyer", "Agent", "Other"]).nullable(),
  bank_currency: currency, is_active: z.boolean(),
}).passthrough();
export const counterpartyInputSchema = z.object({
  legal_name: name, code: z.string().trim(), source_company_id: optionalUuid,
  counterparty_type: z.string().transform(v => v.trim().toLowerCase()).refine(v => COUNTERPARTY_TYPES.some(t => t.toLowerCase() === v), "Select a valid counterparty type."),
  bank_currency: currency.nullable(), is_active: z.boolean(),
}).passthrough();
export const productInputSchema = z.object({
  name, sku: z.string().trim(), currency: currency.nullable(), is_active: z.boolean(),
  category: z.string().trim().max(100).nullish(), unit: z.string().trim().max(50).nullish(),
  purchase_price: amount, sale_price: amount, net_weight: amount, gross_weight: amount,
  glaze: z.number().finite().min(0).max(100).nullable(),
}).passthrough().refine(v => v.gross_weight == null || v.net_weight == null || v.gross_weight >= v.net_weight, "Gross weight cannot be below net weight.");
export const dealCoreSchema = z.object({
  case_number: name, company_id: uuid, buyer_id: optionalUuid, supplier_id: optionalUuid,
  consignee_id: optionalUuid, status: z.enum(DEAL_STATUSES), currency,
  contract_amount: amount, contract_date: date, expected_shipment_date: date, eta: date,
  title: text, notes: text,
}).passthrough();

export function validationError(schema: z.ZodType, input: unknown): string | null {
  const result = schema.safeParse(input);
  return result.success ? null : result.error.issues[0]?.message ?? "Invalid input.";
}

/** The existing line basis is quantity × price, independently per currency.
 * Round decimal arithmetic once to cents, avoiding binary floating-point drift. */
export function lineAmount(quantity: number, price: number | null): number | null {
  if (price == null) return null;
  if (![quantity, price].every(v => Number.isFinite(v) && v >= 0 && v <= 1_000_000_000)) throw new Error("Invalid line amount inputs.");
  const decimal = (value: number) => {
    const [mantissa, exponent = "0"] = String(value).split("e");
    const [whole, fraction = ""] = mantissa.split(".");
    const scale = fraction.length - Number(exponent);
    const digits = BigInt(whole + fraction);
    return { digits: scale < 0 ? digits * BigInt(10) ** BigInt(-scale) : digits, scale: Math.max(0, scale) };
  };
  const left = decimal(quantity), right = decimal(price);
  const divisor = BigInt(10) ** BigInt(left.scale + right.scale);
  const cents = (left.digits * right.digits * BigInt(100) + divisor / BigInt(2)) / divisor;
  return Number(cents) / 100;
}
