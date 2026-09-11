/** Exact rational arithmetic for the single profitability engine. No Number money. */
export class Exact {
  private constructor(readonly numerator: bigint, readonly denominator: bigint) {}
  static of(value: string): Exact {
    const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(value);
    if (!match || value.length > 400) throw new Error("Invalid exact economic amount.");
    const scale = BigInt(10) ** BigInt((match[3] ?? "").length);
    return new Exact(BigInt((match[1] === "-" ? "-" : "") + match[2] + (match[3] ?? "")), scale);
  }
  static zero() { return Exact.of("0"); }
  private static ratio(n: bigint, d: bigint): Exact {
    if (d === BigInt(0)) throw new Error("Cannot divide by zero.");
    let a = n < BigInt(0) ? -n : n, b = d < BigInt(0) ? -d : d;
    while (b !== BigInt(0)) { const r = a % b; a = b; b = r; }
    const gcd = a || BigInt(1), sign = d < BigInt(0) ? -BigInt(1) : BigInt(1);
    return new Exact(n / gcd * sign, d / gcd * sign);
  }
  add(other: Exact) { return Exact.ratio(this.numerator * other.denominator + other.numerator * this.denominator, this.denominator * other.denominator); }
  sub(other: Exact) { return this.add(other.neg()); }
  neg() { return new Exact(-this.numerator, this.denominator); }
  mul(other: Exact) { return Exact.ratio(this.numerator * other.numerator, this.denominator * other.denominator); }
  div(other: Exact) { return Exact.ratio(this.numerator * other.denominator, this.denominator * other.numerator); }
  compare(other: Exact) { const n = this.numerator * other.denominator - other.numerator * this.denominator; return n < BigInt(0) ? -1 : n > BigInt(0) ? 1 : 0; }
  isZero() { return this.numerator === BigInt(0); }
  format(scale = 2) {
    const magnitude = this.numerator < BigInt(0) ? -this.numerator : this.numerator;
    const scaled = magnitude * BigInt(10) ** BigInt(scale);
    const rounded = (scaled * BigInt(2) + this.denominator) / (this.denominator * BigInt(2));
    const digits = rounded.toString().padStart(scale + 1, "0");
    const sign = this.numerator < BigInt(0) && rounded !== BigInt(0) ? "-" : "";
    return scale ? sign + digits.slice(0, -scale) + "." + digits.slice(-scale) : sign + digits;
  }
}
