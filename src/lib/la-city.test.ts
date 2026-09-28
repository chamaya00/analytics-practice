// #230: an LA order is LA everywhere. LA spends USD, like SF, so every place
// that used to infer the city from the currency (`currency === 'VND' ?
// 'hcmc' : 'sf'`) silently filed an LA order under SF. These fixtures are a
// USD cart line and order whose restaurant is an `la` restaurant defined in
// this file (LA's real catalogue is #233's), so each assertion here fails if
// that inference comes back at its site.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Restaurant } from './restaurants';
import { initCheckoutPage } from './checkout-dom';
import { renderOffers } from './offers-dom';
import { initTrackerPage } from './tracker-dom';
import { initCartPage } from './cart-dom';
import { initHomePage } from './home-dom';
import { initWallet } from './wallet-dom';
import { addToCart, findOrder, getLatestOrder, ORDERS_KEY, placeOrder, type PlacedOrder } from './order-store';
import { isValidEventProps, resetTrack, setTrack } from './tracking';
import { getThanksVoucher, unlockThanksVoucher, THANKS_VOUCHER_AMOUNT_MINOR } from './thanks-voucher';
import { writeVipLedger } from './vip-level';
import { setStoredCity } from './location';
import * as money from './money';
import { catalogueForCity, flashCatalogueEntry } from './vouchers';

vi.mock('canvas-confetti', () => {
  const cannon = Object.assign(vi.fn(), { create: vi.fn(() => vi.fn()), reset: vi.fn() });
  return { default: cannon };
});

vi.mock('./restaurants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./restaurants')>();
  const LA_TEST_RESTAURANT: Restaurant = {
    slug: 'test-la-taqueria',
    name: 'Test LA Taqueria',
    city: 'la',
    cuisineTag: 'Tacos',
    rating: 4.5,
    reviewCount: 321,
    deliveryFeeMinor: 299,
    hasDeal: false,
    heroImage: '/images/restaurants/mission-taqueria-hero.jpg',
    menu: [
      {
        title: 'Tacos',
        items: [
          {
            id: 'test-la-taqueria-plate',
            name: 'Taco plate',
            description: 'Three tacos.',
            amountMinor: 2150,
            image: '/images/dishes/mission-taqueria-al-pastor.jpg',
          },
        ],
      },
    ],
  };
  const all = [...actual.ALL_RESTAURANTS, LA_TEST_RESTAURANT];
  const byCity = { ...actual.RESTAURANTS_BY_CITY, la: [LA_TEST_RESTAURANT] };
  return {
    ...actual,
    ALL_RESTAURANTS: all,
    RESTAURANTS_BY_CITY: byCity,
    restaurantsForCity: (city: keyof typeof byCity) => byCity[city],
    getRestaurant: (slug: string) => all.find((restaurant) => restaurant.slug === slug),
    getMenuItem: (itemId: string) => {
      for (const restaurant of all) {
        for (const section of restaurant.menu) {
          const item = section.items.find((candidate) => candidate.id === itemId);
          if (item) return { restaurant, item };
        }
      }
      return undefined;
    },
  };
});


// Same $21.50 subtotal and $2.99 fee as checkout-dom.test.ts's SF line, so
// the only difference from that fixture is the restaurant's city.
const LA_LINE = {
  itemId: 'test-la-taqueria-plate',
  restaurantSlug: 'test-la-taqueria',
  restaurantName: 'Test LA Taqueria',
  name: 'Taco plate',
  amountMinor: 2150,
  currency: 'USD' as const,
};

const SF_LINE = {
  itemId: 'north-beach-pizzeria-margherita',
  restaurantSlug: 'north-beach-pizzeria',
  restaurantName: 'North Beach Pizzeria',
  name: 'Margherita',
  amountMinor: 2150,
  currency: 'USD' as const,
};

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  resetTrack();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

function root(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function placeLaOrder(): PlacedOrder {
  addToCart(window.localStorage, LA_LINE);
  return placeOrder(
    window.localStorage,
    { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true },
    LA_LINE.restaurantSlug,
    () => 0.5,
  );
}

function patchOrder(orderId: string, patch: Partial<PlacedOrder>): void {
  const raw = JSON.parse(window.localStorage.getItem(ORDERS_KEY) ?? '[]') as PlacedOrder[];
  const next = raw.map((order) => (order.orderId === orderId ? { ...order, ...patch } : order));
  window.localStorage.setItem(ORDERS_KEY, JSON.stringify(next));
}

function reducedMotion(): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe('the city type knows LA (#230 AC2)', () => {
  it('isCity accepts la', () => {
    expect(money.isCity('la')).toBe(true);
  });

  it("gives LA #229's per-city values: USD, en-US, the name, and SF's voucher ladder under la-* ids", () => {
    expect(money.CITY_CURRENCY.la).toBe('USD');
    expect(money.CITY_LOCALE.la).toBe('en-US');
    expect(money.CITY_NAMES.la).toBe('Los Angeles');
    expect(THANKS_VOUCHER_AMOUNT_MINOR.la).toBe(300);
    expect(catalogueForCity('la').map((entry) => [entry.id, entry.minimumSpendMinor, entry.amountMinor, entry.label])).toEqual([
      ['la-delivery-entry', 1000, null, 'Free delivery'],
      ['la-discount-t1', 2000, 200, '$2 off'],
      ['la-discount-t2', 4000, 500, '$5 off'],
      ['la-discount-t3', 6000, 800, '$8 off'],
    ]);
    expect(catalogueForCity('la').every((entry) => entry.city === 'la')).toBe(true);
    const flash = flashCatalogueEntry('la', 400, 600);
    expect([flash.id, flash.label, flash.minimumSpendMinor]).toEqual(['la-flash', '$4.00 off flash deals', 1000]);
  });
});

describe('formatMoney formats with the city locale, not a city guessed from the currency (#230 AC1)', () => {
  it("formats an LA amount with CITY_LOCALE.la", () => {
    const expected = new Intl.NumberFormat(money.CITY_LOCALE.la, { style: 'currency', currency: 'USD' }).format(21.5);
    expect(money.formatMoneyForCity(2150, 'la')).toBe(expected);
    expect(money.formatMoneyForCity(2150, 'la')).toBe('$21.50');
  });

  it("formatMoney(amount, currency) agrees with formatMoneyForCity for every city that spends that currency", () => {
    for (const city of money.CITIES) {
      expect(money.formatMoney(123456, money.CITY_CURRENCY[city])).toBe(money.formatMoneyForCity(123456, city));
    }
  });
});

describe('an LA cart at checkout (#230 AC1)', () => {
  beforeEach(() => {
    addToCart(window.localStorage, LA_LINE);
  });

  it('checkout_viewed and order_placed carry city la, and order_placed carries the la-* vouchers this cart auto-qualifies for', () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());

    expect(stub).toHaveBeenCalledWith('checkout_viewed', { item_count: 1, amount_minor: 2150, city: 'la', currency: 'USD' });

    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();
    const [, props] = stub.mock.calls.find(([name]) => name === 'order_placed')!;
    expect(props.city).toBe('la');
    expect(props.applied_voucher_ids).toEqual(['la-discount-t1', 'la-delivery-entry']);
    expect(props.saved_amount_minor).toBe(499);
    expect(isValidEventProps('order_placed', props)).toBe(true);
  });

  it("applies LA's own thanks voucher at LA's amount, and never SF's", () => {
    unlockThanksVoucher(window.localStorage, 'la', 'source-order', Date.now());
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());
    expect(el.querySelector('[data-testid="breakdown-thanks-voucher"]')?.textContent).toContain('$3.00');

    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();
    expect(getLatestOrder(window.localStorage)?.thanksVoucherMinor).toBe(300);
    expect(getThanksVoucher(window.localStorage, 'la', Date.now())).toBeNull();
  });

  it("does not offer an SF thanks voucher on an LA cart, though both spend USD", () => {
    unlockThanksVoucher(window.localStorage, 'sf', 'source-order', Date.now());
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());
    expect(el.querySelector('[data-testid="breakdown-thanks-voucher"]')).toBeNull();
  });
});

describe('an LA cart on the cart page and Offers (#230 AC1)', () => {
  it('cart_viewed carries city la', () => {
    addToCart(window.localStorage, LA_LINE);
    const stub = vi.fn();
    setTrack(stub);
    initCartPage(root(), window.localStorage, '');
    expect(stub).toHaveBeenCalledWith('cart_viewed', { item_count: 1, amount_minor: 2150, city: 'la', currency: 'USD' });
  });

  it('Offers lists the la-* vouchers and no sf-* ones', () => {
    addToCart(window.localStorage, LA_LINE);
    const el = root();
    renderOffers(el, window.localStorage, window.sessionStorage);
    const ids = Array.from(el.querySelectorAll('[data-testid^="voucher-row-"]')).map((row) =>
      row.getAttribute('data-testid')!.replace('voucher-row-', ''),
    );
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => id.startsWith('la-'))).toBe(true);
    expect(ids).toContain('la-discount-t1');
  });
});

describe("an LA order in the tracker and history (#230 AC1)", () => {
  it("the order card shows the car icon, drawn from LA's own path data", () => {
    placeLaOrder();
    const el = root();
    initTrackerPage(el, window.localStorage);
    const icon = el.querySelector('[data-testid="tracker-countdown"] .vehicle-icon');
    expect(icon?.getAttribute('data-vehicle')).toBe('car');
    expect(icon?.querySelectorAll('circle').length).toBeGreaterThan(0);
  });

  it("rating it from history unlocks LA's thanks voucher at LA's amount, labelled Los Angeles", () => {
    vi.useFakeTimers();
    reducedMotion();
    const laOrder = placeLaOrder();
    patchOrder(laOrder.orderId, { placedAt: new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString() });
    addToCart(window.localStorage, SF_LINE);
    placeOrder(window.localStorage, { dropOffPreset: 'home', deliveryInstructions: 'hand_to_me', utensils: true }, SF_LINE.restaurantSlug, () => 0.5);

    const el = root();
    initTrackerPage(el, window.localStorage);
    const row = Array.from(el.querySelectorAll('[data-testid="tracker-history-row"]')).find((candidate) =>
      candidate.textContent?.includes(LA_LINE.restaurantName),
    );
    row?.querySelector<HTMLButtonElement>('[data-testid="tracker-history-rate"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-driver-skip"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-star-5"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="rating-sheet-restaurant-submit"]')?.click();

    expect(document.querySelector('[data-testid="rating-sheet-reward-ticket"]')?.textContent).toContain(
      '$3.00 off · Thanks voucher · For your next Los Angeles order over $15.00.',
    );
    expect(getThanksVoucher(window.localStorage, 'la', Date.now())?.sourceOrderId).toBe(laOrder.orderId);
    expect(getThanksVoucher(window.localStorage, 'sf', Date.now())).toBeNull();
    expect(findOrder(window.localStorage, laOrder.orderId)?.rating?.stars).toBe(5);
  });
});

describe('the "other city" line is the other currency (#229, #230 AC4)', () => {
  it.each([
    ['sf', 'Play money. San Francisco and Los Angeles orders spend dollars.', 'Ho Chi Minh City', 'HCMC'],
    ['hcmc', 'Play money. Ho Chi Minh City orders spend đồng.', 'San Francisco and Los Angeles', 'SF and LA'],
    ['la', 'Play money. Los Angeles and San Francisco orders spend dollars.', 'Ho Chi Minh City', 'HCMC'],
  ] as const)('from %s: the kicker, the other row and the VIP line match the mock', (city, kicker, otherRow, vipLabel) => {
    expect(money.walletKicker(city)).toBe(kicker);
    expect(money.otherCurrencyCitiesLabel(city)).toBe(otherRow);
    expect(money.otherCurrencyCitiesShortLabel(city)).toBe(vipLabel);
  });

  it('the tracker VIP card, from SF, names HCMC for the đồng spend', () => {
    setStoredCity(window.localStorage, 'sf');
    placeLaOrder();
    writeVipLedger(window.localStorage, { v: 1, deliveredCount: 3, spendMinor: { USD: 1840, VND: 420000 }, level: 'gold' });
    const el = root();
    initTrackerPage(el, window.localStorage);
    expect(el.querySelector('[data-testid="vip-card-other-currency"]')?.textContent).toBe(
      'Plus 420.000\u00a0₫ of 1.500.000\u00a0₫ in HCMC, counted apart.',
    );
  });

  it('the tracker VIP card, from HCMC, names SF and LA for the dollar spend', () => {
    setStoredCity(window.localStorage, 'hcmc');
    placeLaOrder();
    writeVipLedger(window.localStorage, { v: 1, deliveredCount: 3, spendMinor: { USD: 1840, VND: 420000 }, level: 'gold' });
    const el = root();
    initTrackerPage(el, window.localStorage);
    expect(el.querySelector('[data-testid="vip-card-other-currency"]')?.textContent).toBe(
      'Plus $18.40 of $60.00 in SF and LA, counted apart.',
    );
  });

  it('the wallet sheet, from LA, shows the dollar balance as its own and HCMC as the other row', async () => {
    document.body.innerHTML = '<div data-testid="balance-slot" aria-hidden="true"></div>';
    const chipRoot = document.querySelector<HTMLElement>('[data-testid="balance-slot"]')!;
    const session = { access_token: 'token-abc', user: { id: 'user-1', email: 'v@example.com', app_metadata: { provider: 'google' } } };
    const auth = {
      getSession: vi.fn().mockResolvedValue({ data: { session } }),
      exchangeCodeForSession: vi.fn(),
      signOut: vi.fn(),
      signInWithOAuth: vi.fn(),
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        usd_minor: 2000,
        vnd_minor: 100000,
        window_start: '2026-09-27T14:00:00.000Z',
        next_window_start: '2026-09-27T22:00:00.000Z',
        claimed_this_window: false,
      }),
    }) as unknown as typeof fetch;

    await initWallet(chipRoot, document.body, () => 'la', { url: 'https://abcdefgh.supabase.co', publishableKey: 'sb_publishable_test_key' }, {
      createAuth: async () => auth,
      fetchImpl,
      locationHref: 'https://site.example/',
    });
    expect(chipRoot.querySelector('[data-testid="wallet-chip-amount"]')?.textContent).toBe('$20.00');
    chipRoot.querySelector<HTMLButtonElement>('[data-testid="wallet-chip"]')!.click();

    const sheet = document.querySelector('[data-testid="wallet-sheet"]')!;
    expect(sheet.querySelector('.wallet-sheet-kicker')?.textContent).toBe('Play money. Los Angeles and San Francisco orders spend dollars.');
    expect(sheet.querySelector('[data-testid="wallet-sheet-balance"]')?.textContent).toBe('$20.00');
    expect(sheet.querySelector('.wallet-sheet-other-city')?.textContent).toBe('Ho Chi Minh City');
    expect(sheet.querySelector('[data-testid="wallet-sheet-other-balance"]')?.textContent).toBe('100.000\u00a0₫');
  });
});

describe('the picker offers LA as the third city (#233 AC3; #230 had pinned it at 2)', () => {
  it('the city picker offers San Francisco, Ho Chi Minh City and Los Angeles, in CITIES order', () => {
    const el = root();
    initHomePage(el, root(), window.localStorage);
    const cards = el.querySelectorAll('[data-testid^="location-card-"]');
    expect(cards).toHaveLength(3);
    expect(Array.from(cards).map((card) => card.getAttribute('data-testid'))).toEqual(['location-card-sf', 'location-card-hcmc', 'location-card-la']);
    expect(Array.from(cards).map((card) => card.querySelector('.location-card-name')?.textContent)).toEqual(['San Francisco', 'Ho Chi Minh City', 'Los Angeles']);
    expect(el.querySelector<HTMLImageElement>('[data-testid="location-card-la"] img')?.getAttribute('src')).toBe('/images/cities/la.jpg');
    expect(el.querySelector('[data-testid="location-card-la"] .location-card-currency')?.textContent).toBe('Prices in USD');
  });

  it('the header pill reopens that same three-city picker', () => {
    setStoredCity(window.localStorage, 'sf');
    const el = root();
    const pill = root();
    initHomePage(el, pill, window.localStorage);
    pill.querySelector<HTMLElement>('button, [role="button"]')?.click();
    expect(el.querySelectorAll('[data-testid^="location-card-"]')).toHaveLength(3);
  });
});
