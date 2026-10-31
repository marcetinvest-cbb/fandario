// American odds helpers. All money is integer cents.
export function isValidAmerican(a: number): boolean {
  return Number.isInteger(a) && Math.abs(a) >= 100;
}
export function toDecimal(a: number): number {
  return a > 0 ? 1 + a / 100 : 1 + 100 / -a;
}
export function toAmerican(dec: number): number {
  if (dec >= 2) return Math.round((dec - 1) * 100);
  return Math.round(-100 / (dec - 1));
}
export function fmtOdds(a: number): string {
  return a > 0 ? `+${a}` : `${a}`;
}
export function parlayDecimal(odds: number[]): number {
  return odds.reduce((p, a) => p * toDecimal(a), 1);
}
export function payoutCents(stakeCents: number, odds: number[]): number {
  // small epsilon so 10.00 * 2.0 doesn't floor to 19.99 from float error
  return Math.floor(stakeCents * parlayDecimal(odds) + 1e-6);
}
export function fmtMoney(cents: number): string {
  const neg = cents < 0;
  const v = Math.abs(cents) / 100;
  const s = v % 1 === 0 ? v.toFixed(0) : v.toFixed(2);
  return `${neg ? '-' : ''}$${s}`;
}

// Forgiving odds parser: accepts "-125", "- 125", "−125" (phone minus), "+250", "250", "2,500".
export function parseOdds(v: unknown): number {
  const s = String(v ?? '').replace(/[\u2212\u2010-\u2015\uFE63\uFF0D]/g, '-').replace(/[\s,+]/g, '');
  return /^-?\d+$/.test(s) ? Number(s) : NaN;
}
