// The thanks voucher (#166, docs/design/162-rating-win-tips-rewards-vip.md,
// "The thanks voucher"): a rating's reward, unlocked once per order and
// applied automatically at a later checkout. Deliberately outside
// vouchers.ts's catalogue — it is not a `VoucherId`, never enters
// `CatalogueEntry[]`/`OffersState`, and is never in `order_placed.
// applied_voucher_ids` (tracking.ts's `VOUCHER_IDS` stays the ten catalogue
// ids; see checkout-dom.ts and tracking.test.ts). VIP levels, the tracker
// card and checkout perks that the same design document specifies are #174's,
// not this module's.

import { CITIES, type City } from './money';

export const THANKS_VOUCHER_AMOUNT_MINOR: Record<City, number> = { sf: 300, hcmc: 30000, la: 300 };
export const THANKS_VOUCHER_MINIMUM_SPEND_MINOR: Record<City, number> = { sf: 1500, hcmc: 150000, la: 1500 };
export const THANKS_VOUCHER_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const THANKS_VOUCHER_KEY = 'parody.thanksVoucher';

export interface ThanksVoucher {
  amountMinor: number;
  minimumSpendMinor: number;
  /** ISO instant — the device clock 7 days on from unlock, or from the most recent top-up. */
  expiresAt: string;
  sourceOrderId: string;
}

/** What renders in the win's reward slot right after an unlock or a top-up (#166's own type, rating-sheet-dom.ts never imports order-store.ts/tracking.ts directly per that module's own rule). */
export interface ThanksVoucherUnlock {
  voucher: ThanksVoucher;
  /** True when a voucher was already held, unexpired, in this city — its expiry was refreshed rather than a second one created ("at most one per city"). */
  toppedUp: boolean;
  city: City;
}

type ThanksVoucherStore = Partial<Record<City, ThanksVoucher>>;

function isThanksVoucher(value: unknown): value is ThanksVoucher {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as ThanksVoucher;
  return (
    typeof candidate.amountMinor === 'number' &&
    typeof candidate.minimumSpendMinor === 'number' &&
    typeof candidate.expiresAt === 'string' &&
    typeof candidate.sourceOrderId === 'string'
  );
}

function readStore(storage: Storage): ThanksVoucherStore {
  let raw: string | null;
  try {
    raw = storage.getItem(THANKS_VOUCHER_KEY);
  } catch {
    return {};
  }
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const store: ThanksVoucherStore = {};
    for (const city of CITIES) {
      const entry = (parsed as Record<string, unknown>)[city];
      if (isThanksVoucher(entry)) store[city] = entry;
    }
    return store;
  } catch {
    return {};
  }
}

function writeStore(storage: Storage, store: ThanksVoucherStore): void {
  try {
    storage.setItem(THANKS_VOUCHER_KEY, JSON.stringify(store));
  } catch {
    // Storage blocked (private browsing): the unlock still applies for this
    // page load, same fallback offers-store.ts uses.
  }
}

/**
 * Unlocks (or tops up) this city's thanks voucher. Called at most once per
 * order — the caller (tracker-dom.ts) only calls this for "the first step
 * submitted for an order" (docs/design/162-*), so a second rating step for
 * the same order never reaches this function.
 */
export function unlockThanksVoucher(storage: Storage, city: City, sourceOrderId: string, now: number): ThanksVoucherUnlock {
  const store = readStore(storage);
  const existing = store[city];
  const toppedUp = existing !== undefined && new Date(existing.expiresAt).getTime() > now;
  const voucher: ThanksVoucher = {
    amountMinor: THANKS_VOUCHER_AMOUNT_MINOR[city],
    minimumSpendMinor: THANKS_VOUCHER_MINIMUM_SPEND_MINOR[city],
    expiresAt: new Date(now + THANKS_VOUCHER_EXPIRY_MS).toISOString(),
    sourceOrderId,
  };
  store[city] = voucher;
  writeStore(storage, store);
  return { voucher, toppedUp, city };
}

/** The held, unexpired voucher for this city, or `null` — an expired one is removed silently (never shown greyed, docs/design/162-*, "Expired"). */
export function getThanksVoucher(storage: Storage, city: City, now: number): ThanksVoucher | null {
  const store = readStore(storage);
  const existing = store[city];
  if (!existing) return null;
  if (new Date(existing.expiresAt).getTime() <= now) {
    delete store[city];
    writeStore(storage, store);
    return null;
  }
  return existing;
}

/** Removes this city's held voucher — called once an order it applied to has actually been written (docs/design/162-*, "Consumed"). Never called when placing fails or the debit is refused, so it is not consumed then. */
export function consumeThanksVoucher(storage: Storage, city: City): void {
  const store = readStore(storage);
  delete store[city];
  writeStore(storage, store);
}

/** The amount this voucher actually takes off a checkout's subtotal — 0 when there is none, or the subtotal falls below its minimum (checkout-dom.ts's own "applies by itself," no checkbox). */
export function thanksVoucherDiscountMinor(voucher: ThanksVoucher | null, subtotalMinor: number): number {
  if (!voucher) return 0;
  return subtotalMinor >= voucher.minimumSpendMinor ? voucher.amountMinor : 0;
}

/** "4 Oct" — day then abbreviated month, the win ticket's own date form (docs/design/162-*, "Win"), independent of city (unlike history-date.ts's locale-per-city rule: the four voucher figures are all guesses, and a date form was never specified as one of them). */
export function formatThanksVoucherExpiry(expiresAt: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(expiresAt));
}
