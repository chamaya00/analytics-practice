// VIP levels and the persisted ledger behind them — #174, docs/design/
// 162-rating-win-tips-rewards-vip.md, "VIP levels". Gold at 3 delivered
// orders (free delivery); Platinum at Gold plus $60.00/1.500.000 ₫ of spend
// in one currency, never added or converted across the two ("Refinement 1:
// Platinum requires Gold"). A level, once reached, is kept ("Refinement 2");
// the ledger is a high-water mark, never re-derived from history, so ADR
// 0009's eviction can never lower it (see order-store.ts's `sweepVipLedger`
// and `capOrders`'s `vipCounted` guard).
//
// This module owns the ledger's shape and pure arithmetic only. It does not
// import order-store.ts: the sweep that actually walks stored orders lives
// there, alongside `getOrders`/`setOrders`, and calls into the pure helpers
// below — keeping this module a leaf that any DOM module can read without
// pulling in the whole order store.

import type { Currency } from './money';

/** Never "tier" — vouchers.ts's `Tier` keeps that word; a VIP level is its own concept. */
export type VipLevel = 'none' | 'gold' | 'platinum';

/** 3 delivered orders reaches Gold, counted across both cities (a count has no currency). */
export const VIP_GOLD_ORDERS = 3;

/** Platinum's spend floor, checked per currency and never summed/converted across them. */
export const VIP_PLATINUM_SPEND_MINOR: Record<Currency, number> = { USD: 6000, VND: 1500000 };

export interface VipLedger {
  v: 1;
  deliveredCount: number;
  spendMinor: Record<Currency, number>;
  level: VipLevel;
}

export const EMPTY_VIP_LEDGER: VipLedger = {
  v: 1,
  deliveredCount: 0,
  spendMinor: { USD: 0, VND: 0 },
  level: 'none',
};

const VIP_LEDGER_KEY = 'parody.vip';

const LEVEL_RANK: Record<VipLevel, number> = { none: 0, gold: 1, platinum: 2 };

/** The higher of two levels — the high-water rule (Refinement 2): a level, once reached, is never displaced by a lower one. */
export function higherVipLevel(a: VipLevel, b: VipLevel): VipLevel {
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}

/** The level implied by raw counters alone, with no memory of any previous level — Platinum requires Gold, so a spend threshold reached before 3 delivered orders is still 'none'. */
export function computeVipLevel(deliveredCount: number, spendMinor: Record<Currency, number>): VipLevel {
  if (deliveredCount < VIP_GOLD_ORDERS) return 'none';
  const platinum = spendMinor.USD >= VIP_PLATINUM_SPEND_MINOR.USD || spendMinor.VND >= VIP_PLATINUM_SPEND_MINOR.VND;
  return platinum ? 'platinum' : 'gold';
}

/** Spend, as this rule counts it: the stored checkout total, or the subtotal for a legacy order whose total was never recorded — whether or not the wallet paid, tips excluded because they aren't spend on an order (docs/design/162-*, "Spend: the definition, and why"). */
export function vipSpendContributionMinor(order: { totalMinor: number | null; amountMinor: number }): number {
  return order.totalMinor ?? order.amountMinor;
}

/**
 * Folds one delivered, not-yet-counted order into a ledger — kept as a pure
 * reducer, separate from any storage walk, so a test can assert the
 * high-water and per-currency rules directly (AC1) without seeding
 * `localStorage`. `sweepVipLedger` (order-store.ts) is the only real caller.
 */
export function applyDeliveredOrderToLedger(
  ledger: VipLedger,
  order: { currency: Currency; totalMinor: number | null; amountMinor: number },
): VipLedger {
  const deliveredCount = ledger.deliveredCount + 1;
  const spendMinor = { ...ledger.spendMinor, [order.currency]: ledger.spendMinor[order.currency] + vipSpendContributionMinor(order) };
  const computed = computeVipLevel(deliveredCount, spendMinor);
  return { v: 1, deliveredCount, spendMinor, level: higherVipLevel(ledger.level, computed) };
}

function isVipLedger(value: unknown): value is VipLedger {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<VipLedger>;
  return (
    typeof candidate.deliveredCount === 'number' &&
    typeof candidate.spendMinor === 'object' &&
    candidate.spendMinor !== null &&
    typeof candidate.spendMinor.USD === 'number' &&
    typeof candidate.spendMinor.VND === 'number' &&
    (candidate.level === 'none' || candidate.level === 'gold' || candidate.level === 'platinum')
  );
}

/** The persisted ledger, or `EMPTY_VIP_LEDGER` for a device that has never had one, or one that failed to parse — a corrupt ledger reads as "not VIP yet" rather than throwing, matching every other `localStorage`-backed store in this codebase. */
export function readVipLedger(storage: Storage): VipLedger {
  let raw: string | null;
  try {
    raw = storage.getItem(VIP_LEDGER_KEY);
  } catch {
    return EMPTY_VIP_LEDGER;
  }
  if (!raw) return EMPTY_VIP_LEDGER;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isVipLedger(parsed) ? parsed : EMPTY_VIP_LEDGER;
  } catch {
    return EMPTY_VIP_LEDGER;
  }
}

export function writeVipLedger(storage: Storage, ledger: VipLedger): void {
  try {
    storage.setItem(VIP_LEDGER_KEY, JSON.stringify(ledger));
  } catch {
    // Storage blocked (private browsing): the level still applies for this
    // page load, the same fallback thanks-voucher.ts/offers-store.ts use.
  }
}

/** Platinum's 10% off, based on the subtotal before any voucher (docs/design/162-*, "Platinum's 10%: base and rounding"). USD floors to the whole cent; VND floors to the whole 1.000 ₫, matching how every menu price is written — flooring means the perk never gives more than 10%. */
export function platinumDiscountMinor(subtotalMinor: number, currency: Currency): number {
  const tenPercentMinor = subtotalMinor / 10;
  if (currency === 'VND') return Math.floor(tenPercentMinor / 1000) * 1000;
  return Math.floor(tenPercentMinor);
}

/** Minor units still needed, in `currency`, to reach Platinum's spend floor — 0 or negative once it's already met (a Gold card at Platinum's own spend level renders as Platinum, so this is only ever shown while still positive). */
export function platinumSpendRemainingMinor(ledger: VipLedger, currency: Currency): number {
  return VIP_PLATINUM_SPEND_MINOR[currency] - ledger.spendMinor[currency];
}
