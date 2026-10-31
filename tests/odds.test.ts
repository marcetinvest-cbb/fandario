import { describe, it, expect } from 'vitest';
import { toDecimal, toAmerican, payoutCents, isValidAmerican } from '@/lib/odds';
describe('odds', () => {
  it('converts', () => {
    expect(toDecimal(100)).toBe(2);
    expect(toDecimal(-100)).toBe(2);
    expect(toDecimal(-300)).toBeCloseTo(1.3333, 4);
    expect(toDecimal(450)).toBe(5.5);
  });
  it('payouts', () => {
    expect(payoutCents(1000, [100])).toBe(2000);
    expect(payoutCents(1000, [-300])).toBe(1333);
    expect(payoutCents(500, [-150, 400])).toBe(Math.floor(500 * (5 / 3) * 5)); // 4166
    expect(payoutCents(100, [2500])).toBe(2600);
  });
  it('parlay american', () => {
    expect(toAmerican(toDecimal(100) * toDecimal(100))).toBe(300);
    expect(toAmerican(toDecimal(-300))).toBe(-300);
  });
  it('validates', () => {
    expect(isValidAmerican(-75)).toBe(false);
    expect(isValidAmerican(75)).toBe(false);
    expect(isValidAmerican(-100)).toBe(true);
  });
});

import { parseOdds } from '@/lib/odds';
describe('parseOdds', () => {
  it('is forgiving', () => {
    expect(parseOdds('-125')).toBe(-125);
    expect(parseOdds('- 125')).toBe(-125);
    expect(parseOdds('\u2212125')).toBe(-125);
    expect(parseOdds('+250')).toBe(250);
    expect(parseOdds(' 2,500 ')).toBe(2500);
    expect(parseOdds(-110)).toBe(-110);
    expect(Number.isNaN(parseOdds('abc'))).toBe(true);
  });
});
