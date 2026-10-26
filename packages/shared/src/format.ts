import type { Money } from './domain';

/** 120 → "120M", 1500 → "1,5Md". */
export function formatMoney(amount: Money): string {
  if (amount >= 1000) {
    const v = amount / 1000;
    return `${Number.isInteger(v) ? v : v.toFixed(1).replace('.', ',')}Md`;
  }
  return `${amount}M`;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
