import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeEventStore, EVENT_STORE_BOOT_TIMEOUT_MS, openEventStore, storeWhatTheClientSends } from '../../test-support/event-store';
import { createSupabaseSender } from './tracking-transport';
import { initCheckoutPage, type CheckoutWalletDeps } from './checkout-dom';
import { setFlashDraw } from './flash-deal';
import { addToCart, getCart, getLatestOrder, getVisitorId } from './order-store';
import { estimateEtaMinutes } from './eta';
import { isValidEventProps, resetTrack, setTrack } from './tracking';
import { getThanksVoucher, unlockThanksVoucher } from './thanks-voucher';
import { writeVipLedger, type VipLedger } from './vip-level';
import type { SupabaseAuthLike } from './auth-client';

// North Beach Pizzeria's own deliveryFeeMinor (restaurants.ts) is 299 — the
// $2.99 figure AC1 names — and this line's amountMinor is chosen so the
// cart's subtotal is exactly AC1's $21.50 (2150 cents).
const LINE = {
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
});

function root(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('initCheckoutPage — empty cart (AC1)', () => {
  it('renders #80’s empty state, not a $0 checkout, and fires no checkout_viewed', () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();

    initCheckoutPage(el, window.localStorage, vi.fn());

    expect(el.querySelector('[data-testid="checkout-empty"]')?.textContent).toContain('Your cart is empty');
    expect(el.querySelector('[data-testid="checkout-breakdown"]')).toBeNull();
    expect(stub).not.toHaveBeenCalled();
  });
});

describe('initCheckoutPage — populated cart (AC1, AC2, AC3)', () => {
  beforeEach(() => {
    addToCart(window.localStorage, LINE);
  });

  it('fires checkout_viewed with the cart’s item_count, amount_minor and currency', () => {
    const stub = vi.fn();
    setTrack(stub);

    initCheckoutPage(root(), window.localStorage, vi.fn());

    expect(stub).toHaveBeenCalledWith('checkout_viewed', { item_count: 1, amount_minor: 2150, city: 'sf', currency: 'USD' });
  });

  it('renders the subtotal and service fee as separate lines, and the delivery/discount/total figures from #87\'s worked example (AC1, AC3 — this cart auto-qualifies for sf-discount-t1 and the delivery voucher)', () => {
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());

    expect(el.querySelector('[data-testid="breakdown-subtotal"]')?.textContent).toContain('$21.50');
    expect(el.querySelector('[data-testid="breakdown-delivery-fee"]')?.textContent).toContain('$2.99');
    expect(el.querySelector('[data-testid="breakdown-delivery-fee"]')?.textContent).toContain('Free');
    expect(el.querySelector('[data-testid="breakdown-service-fee"]')?.textContent).toContain('$1.50');
    expect(el.querySelector('[data-testid="breakdown-discount"]')?.textContent).toContain('$2.00');
    expect(el.querySelector('[data-testid="breakdown-saved"]')?.textContent).toContain('$4.99');
    expect(el.querySelector('[data-testid="breakdown-total"]')?.textContent).toContain('$21.00');
  });

  it('shows "Arrives in about N min" using this visitor\'s own estimate for this restaurant (AC2)', () => {
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());

    const visitorId = getVisitorId(window.localStorage);
    const expected = estimateEtaMinutes(visitorId, LINE.restaurantSlug);
    expect(el.querySelector('[data-testid="checkout-eta"]')?.textContent).toBe(`Arrives in about ${expected} min`);
  });

  it('a car icon (SF) precedes the estimate text (#130 AC4)', () => {
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());

    const etaLine = el.querySelector('[data-testid="checkout-eta"]');
    const icon = etaLine?.querySelector('.vehicle-icon');
    expect(icon?.getAttribute('data-vehicle')).toBe('car');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(icon?.nextSibling?.textContent).toMatch(/^Arrives in about \d+ min$/);
  });

  it('the Offers row names the applied count and "You saved" total, in the mock\'s violet label/summary/chevron shape (AC1)', () => {
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());
    const row = el.querySelector('[data-testid="offers-row"]');
    expect(row?.querySelector('.label')?.textContent).toBe('Offers');
    expect(row?.querySelector('.summary')?.textContent).toContain('2 applied');
    expect(row?.querySelector('.summary')?.textContent).toContain('$4.99');
    expect(row?.querySelector('.summary .chevron')).not.toBeNull();
  });

  it('the Discount line carries a tag icon (AC1)', () => {
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());
    expect(el.querySelector('[data-testid="breakdown-discount"] .icon-tag')).not.toBeNull();
  });

  it('renders the demo disclosure directly above "Place order" (AC1)', () => {
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());

    const children = Array.from(el.children);
    const disclosureIndex = children.findIndex((child) => child.getAttribute('data-testid') === 'demo-disclosure');
    const placeOrderIndex = children.findIndex((child) => child.getAttribute('data-testid') === 'place-order');
    expect(disclosureIndex).toBeGreaterThan(-1);
    expect(placeOrderIndex).toBe(disclosureIndex + 1);
    expect(el.querySelector('[data-testid="demo-disclosure"]')?.textContent).toContain(
      'This is a demo. No payment is taken and no food is sent.',
    );
    expect(el.querySelector('[data-testid="demo-disclosure"] a')?.getAttribute('href')).toBe('/about/');
  });

  it('the utensils control is a right-aligned pill pair on the label\'s own row, not stacked beneath it (AC2)', () => {
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());

    const field = el.querySelector('[data-testid="field-utensils"]');
    expect(field?.classList.contains('mini-field')).toBe(true);
    // Exactly the label and the chip-group as this row's own two children —
    // the mock's `.inline-row` has nothing else sharing the row.
    expect(field?.children).toHaveLength(2);
    expect(field?.children[0].classList.contains('mini-label')).toBe(true);
    const pills = field?.querySelectorAll('.chip-group .chip');
    expect(pills).toHaveLength(2);
    expect(Array.from(pills ?? []).map((pill) => pill.textContent)).toEqual(['Yes', 'No']);
  });

  it('Drop-off and Delivery instructions are muted section-title labels, not full-size headings (AC1)', () => {
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());

    const dropOffHeading = el.querySelector('[data-testid="field-drop-off"] h2');
    const deliveryHeading = el.querySelector('[data-testid="field-delivery-instructions"] h2');
    expect(dropOffHeading?.classList.contains('section-title')).toBe(true);
    expect(deliveryHeading?.classList.contains('section-title')).toBe(true);
  });

  it('renders exactly the three named preset fields and nothing typed anywhere (AC2)', () => {
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());

    expect(el.querySelector('[data-testid="field-drop-off"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="field-delivery-instructions"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="field-utensils"]')).not.toBeNull();

    expect(el.querySelectorAll('input, textarea')).toHaveLength(0);

    // Every field defaults to a preset choice — checkout is reachable with zero typing.
    expect(el.querySelector('[data-testid="drop-off-home"]')?.classList.contains('selected')).toBe(true);
    expect(el.querySelector('[data-testid="delivery-instructions-leave_at_door"]')?.classList.contains('selected')).toBe(
      true,
    );
  });

  it('the drop-off field is exactly #80’s three presets', () => {
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());
    const buttons = el.querySelectorAll('[data-testid="field-drop-off"] .chip-group button');
    expect(buttons).toHaveLength(3);
    expect(['Home', 'Office', 'Front desk']).toEqual(Array.from(buttons).map((button) => button.textContent));
  });

  it('the delivery-instructions field is exactly #80’s four presets', () => {
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());
    const buttons = el.querySelectorAll('[data-testid="field-delivery-instructions"] .chip-group button');
    expect(buttons).toHaveLength(4);
    expect(['Leave at door', 'Hand to me', 'Meet downstairs', 'Call on arrival']).toEqual(
      Array.from(buttons).map((button) => button.textContent),
    );
  });

  it('placing an order writes the stored order, clears the cart, and fires exactly one order_placed carrying this cart’s auto-applied vouchers (AC3, AC6)', () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());

    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();

    const orderPlacedCalls = stub.mock.calls.filter(([name]) => name === 'order_placed');
    expect(orderPlacedCalls).toHaveLength(1);
    const [, props] = orderPlacedCalls[0];
    const order = getLatestOrder(window.localStorage);
    expect(props).toEqual({
      order_id: order!.orderId,
      item_count: 1,
      amount_minor: 2150,
      currency: 'USD',
      drop_off_preset: 'home',
      delivery_instructions: 'leave_at_door',
      utensils: true,
      applied_voucher_ids: ['sf-discount-t1', 'sf-delivery-entry'],
      saved_amount_minor: 499,
      city: 'sf',
      restaurant_slug: 'north-beach-pizzeria',
      thanks_voucher_amount_minor: 0,
      vip_level: 'none',
      vip_saved_amount_minor: 0,
      wallet_paid: false,
    });
    expect(getCart(window.localStorage)).toEqual([]);
    expect(getLatestOrder(window.localStorage)).not.toBeNull();
    // order_placed.amount_minor stays the subtotal even though the stored
    // order's own totalMinor is the breakdown's total (#144 §5).
    expect(order?.amountMinor).toBe(2150);
    expect(order?.totalMinor).toBe(2100);
  });

  it('a rapid double-tap on "Place order" fires exactly one order_placed for one order_id (AC3, contract §4/§7)', () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());

    const button = el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')!;
    button.click();
    button.click();
    button.click();

    const orderPlacedCalls = stub.mock.calls.filter(([name]) => name === 'order_placed');
    expect(orderPlacedCalls).toHaveLength(1);
    expect(button.disabled).toBe(true);
  });

  it('navigates to /order-placed/ after placing an order', () => {
    const navigate = vi.fn();
    const el = root();
    initCheckoutPage(el, window.localStorage, navigate);

    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();

    expect(navigate).toHaveBeenCalledWith('/order-placed/');
  });

  it('selecting a non-default chip changes what gets submitted', () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());

    el.querySelector<HTMLButtonElement>('[data-testid="drop-off-office"]')?.click();
    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();

    const [, props] = stub.mock.calls.find(([name]) => name === 'order_placed')!;
    expect(props.drop_off_preset).toBe('office');
  });
});

describe('initCheckoutPage — a cart too small to qualify for any voucher (AC1, AC3)', () => {
  it('shows no Discount/"You saved" line, "Offers › Select an offer", and fires order_placed with the empty-voucher shape', () => {
    addToCart(window.localStorage, { ...LINE, amountMinor: 500 }); // below every SF voucher's own minimum spend
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());

    expect(el.querySelector('[data-testid="breakdown-discount"]')).toBeNull();
    expect(el.querySelector('[data-testid="breakdown-saved"]')).toBeNull();
    expect(el.querySelector('[data-testid="offers-row"]')?.textContent).toContain('Select an offer');
    expect(el.querySelector('[data-testid="offers-row"]')?.classList.contains('offers-row--unset')).toBe(true);

    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();
    const [, props] = stub.mock.calls.find(([name]) => name === 'order_placed')!;
    expect(props.applied_voucher_ids).toEqual([]);
    expect(props.saved_amount_minor).toBe(0);
  });
});

describe('initCheckoutPage — the thanks voucher (#166)', () => {
  beforeEach(() => {
    addToCart(window.localStorage, LINE); // SF, $21.50 — already auto-qualifies for sf-discount-t1 + free delivery
  });

  it('applies by itself alongside the catalogue vouchers: its own breakdown row, and folded into the total and "You saved"', () => {
    unlockThanksVoucher(window.localStorage, 'sf', 'source-order', Date.now());
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());

    expect(el.querySelector('[data-testid="breakdown-thanks-voucher"]')?.textContent).toContain('$3.00');
    // subtotal 21.50 + service 1.50 + delivery 0 (free) − discount 2.00 − thanks 3.00 = 18.00
    expect(el.querySelector('[data-testid="breakdown-total"]')?.textContent).toContain('$18.00');
    // catalogue saving 4.99 (delivery 2.99 + discount 2.00) + thanks 3.00
    expect(el.querySelector('[data-testid="breakdown-saved"]')?.textContent).toContain('$7.99');
  });

  it('order_placed keeps applied_voucher_ids/saved_amount_minor catalogue-only; the order itself records thanksVoucherMinor, and the voucher is consumed', () => {
    unlockThanksVoucher(window.localStorage, 'sf', 'source-order', Date.now());
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());

    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();

    const [, props] = stub.mock.calls.find(([name]) => name === 'order_placed')!;
    expect(props.applied_voucher_ids).toEqual(['sf-discount-t1', 'sf-delivery-entry']);
    expect(props.saved_amount_minor).toBe(499);

    const order = getLatestOrder(window.localStorage);
    expect(order?.thanksVoucherMinor).toBe(300);
    expect(order?.totalMinor).toBe(1800);
    expect(getThanksVoucher(window.localStorage, 'sf', Date.now())).toBeNull();
  });

  it('is not offered in the other city', () => {
    unlockThanksVoucher(window.localStorage, 'hcmc', 'source-order', Date.now());
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());

    expect(el.querySelector('[data-testid="breakdown-thanks-voucher"]')).toBeNull();
    expect(el.querySelector('[data-testid="breakdown-total"]')?.textContent).toContain('$21.00');
  });

  it('is not offered once expired (an already-past expiresAt)', () => {
    window.localStorage.setItem(
      'parody.thanksVoucher',
      JSON.stringify({
        sf: { amountMinor: 300, minimumSpendMinor: 1500, expiresAt: new Date(Date.now() - 1000).toISOString(), sourceOrderId: 'old-order' },
      }),
    );
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());

    expect(el.querySelector('[data-testid="breakdown-thanks-voucher"]')).toBeNull();
    expect(el.querySelector('[data-testid="breakdown-total"]')?.textContent).toContain('$21.00');
  });

  it('does not apply below its own minimum spend, even while held', () => {
    window.localStorage.clear();
    addToCart(window.localStorage, { ...LINE, amountMinor: 500 }); // below the $15.00 SF minimum
    unlockThanksVoucher(window.localStorage, 'sf', 'source-order', Date.now());
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());

    expect(el.querySelector('[data-testid="breakdown-thanks-voucher"]')).toBeNull();
    // Consumption never runs for a voucher that never applied.
    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();
    expect(getThanksVoucher(window.localStorage, 'sf', Date.now())).not.toBeNull();
  });
});

describe('initCheckoutPage — VIP perks (AC2, #174)', () => {
  beforeEach(() => {
    addToCart(window.localStorage, LINE); // SF, $21.50 — auto-qualifies for sf-discount-t1 and the delivery voucher (sf-delivery-entry)
  });

  function goldLedger(): VipLedger {
    return { v: 1, deliveredCount: 3, spendMinor: { USD: 0, VND: 0 }, level: 'gold' };
  }

  function platinumLedger(): VipLedger {
    return { v: 1, deliveredCount: 3, spendMinor: { USD: 6000, VND: 0 }, level: 'platinum' };
  }

  it('Gold suppresses the auto-qualifying catalogue delivery voucher: the fee still zeroes, tagged [Gold], but the saving moves out of the catalogue-only figures', () => {
    writeVipLedger(window.localStorage, goldLedger());
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());

    const deliveryRow = el.querySelector('[data-testid="breakdown-delivery-fee"]');
    expect(deliveryRow?.textContent).toContain('$2.99');
    expect(deliveryRow?.textContent).toContain('Free');
    expect(deliveryRow?.querySelector('[data-testid="breakdown-delivery-vip-tag"]')?.textContent).toBe('Gold');
    expect(el.querySelector('[data-testid="breakdown-vip-platinum"]')).toBeNull();

    const vipLine = el.querySelector('[data-testid="checkout-vip-line"]');
    expect(vipLine?.textContent).toContain('Gold');
    expect(vipLine?.textContent).toContain('free delivery is on this order');
    expect(vipLine?.textContent).toContain('$60.00 more spend to Platinum');

    // subtotal 21.50 + service 1.50 + delivery 0 (Gold) − discount 2.00 = 21.00 — the same total
    // #87's own delivery-voucher worked example produced, since either mechanism waives the same fee.
    expect(el.querySelector('[data-testid="breakdown-total"]')?.textContent).toContain('$21.00');
    // But "You saved" still folds Gold's own saving back in on the screen...
    expect(el.querySelector('[data-testid="breakdown-saved"]')?.textContent).toContain('$4.99');
  });

  it('order_placed keeps applied_voucher_ids/saved_amount_minor catalogue-only when Gold suppresses the delivery voucher', () => {
    writeVipLedger(window.localStorage, goldLedger());
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());

    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();

    const [, props] = stub.mock.calls.find(([name]) => name === 'order_placed')!;
    // The delivery voucher never applies once Gold is active — only the discount is a catalogue voucher here.
    expect(props.applied_voucher_ids).toEqual(['sf-discount-t1']);
    expect(props.saved_amount_minor).toBe(200);
    expect(isValidEventProps('order_placed', props)).toBe(true);
  });

  it('Platinum adds its own 10% row, on top of Gold\'s free delivery, and both stay out of the event', () => {
    writeVipLedger(window.localStorage, platinumLedger());
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());

    const platinumRow = el.querySelector('[data-testid="breakdown-vip-platinum"]');
    expect(platinumRow?.textContent).toContain('Platinum 10% off');
    expect(platinumRow?.textContent).toContain('of $21.50');
    expect(platinumRow?.textContent).toContain('$2.15');
    expect(el.querySelector('[data-testid="breakdown-delivery-vip-tag"]')?.textContent).toBe('Platinum');

    const vipLine = el.querySelector('[data-testid="checkout-vip-line"]');
    expect(vipLine?.textContent).toContain('Platinum');
    expect(vipLine?.textContent).toContain('free delivery and 10% off are on this order.');

    // 21.50 + 0 (Gold) + 1.50 − 2.00 (discount) − 2.15 (Platinum) = 18.85
    expect(el.querySelector('[data-testid="breakdown-total"]')?.textContent).toContain('$18.85');

    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();
    const [, props] = stub.mock.calls.find(([name]) => name === 'order_placed')!;
    expect(props.applied_voucher_ids).toEqual(['sf-discount-t1']);
    expect(props.saved_amount_minor).toBe(200);
    expect(isValidEventProps('order_placed', props)).toBe(true);
    expect(getLatestOrder(window.localStorage)?.totalMinor).toBe(1885);
  });

  it('renders no VIP line and no perk at all with no level (the existing #87 baseline is unaffected)', () => {
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());

    expect(el.querySelector('[data-testid="checkout-vip-line"]')).toBeNull();
    expect(el.querySelector('[data-testid="breakdown-delivery-vip-tag"]')).toBeNull();
    expect(el.querySelector('[data-testid="breakdown-vip-platinum"]')).toBeNull();
  });
});

describe('initCheckoutPage — an HCMC restaurant (#130 AC4)', () => {
  it('a motorbike icon precedes the estimate text, not a car', () => {
    addToCart(window.localStorage, {
      itemId: 'ben-thanh-banh-mi-thit-nuong',
      restaurantSlug: 'ben-thanh-banh-mi',
      restaurantName: 'Bến Thành Bánh Mì',
      name: 'Bánh mì thịt nướng',
      amountMinor: 35000,
      currency: 'VND',
    });
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());

    const icon = el.querySelector('[data-testid="checkout-eta"] .vehicle-icon');
    expect(icon?.getAttribute('data-vehicle')).toBe('motorbike');
  });
});

describe('initCheckoutPage — one cart per restaurant', () => {
  // Mission Taqueria's own deliveryFeeMinor is 199, and a $4.25 cart sits
  // below every SF voucher's minimum spend, so nothing auto-applies.
  const TACO = {
    itemId: 'mission-taqueria-al-pastor',
    restaurantSlug: 'mission-taqueria',
    restaurantName: 'Mission Taqueria',
    name: 'Al pastor taco',
    amountMinor: 425,
    currency: 'USD' as const,
  };

  beforeEach(() => {
    addToCart(window.localStorage, LINE);
    addToCart(window.localStorage, TACO);
  });

  it('?restaurant=<slug> prices only that restaurant’s lines, with its own delivery fee', () => {
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn(), window.sessionStorage, '?restaurant=mission-taqueria');

    expect(el.querySelector('[data-testid="checkout-restaurant"]')?.textContent).toContain('Mission Taqueria');
    expect(el.querySelector('[data-testid="breakdown-subtotal"]')?.textContent).toContain('$4.25');
    expect(el.querySelector('[data-testid="breakdown-delivery-fee"]')?.textContent).toBe('Delivery fee$1.99');
    expect(el.querySelector('[data-testid="breakdown-total"]')?.textContent).toContain('$7.74');
    expect(el.querySelector('[data-testid="offers-row"]')?.textContent).toContain('Select an offer');
  });

  it('fires checkout_viewed with that restaurant’s cart only', () => {
    const stub = vi.fn();
    setTrack(stub);
    initCheckoutPage(root(), window.localStorage, vi.fn(), window.sessionStorage, '?restaurant=mission-taqueria');
    expect(stub).toHaveBeenCalledWith('checkout_viewed', { item_count: 1, amount_minor: 425, city: 'sf', currency: 'USD' });
  });

  it('placing the order fires order_placed for that restaurant’s cart and leaves the other restaurant’s cart in place', () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn(), window.sessionStorage, '?restaurant=mission-taqueria');

    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();

    const [, props] = stub.mock.calls.find(([name]) => name === 'order_placed')!;
    expect(props).toMatchObject({ item_count: 1, amount_minor: 425, currency: 'USD', applied_voucher_ids: [] });
    expect(getLatestOrder(window.localStorage)?.items.map((line) => line.itemId)).toEqual([TACO.itemId]);
    expect(getCart(window.localStorage).map((line) => line.itemId)).toEqual([LINE.itemId]);
  });

  it('vouchers are kept per restaurant: the pizza cart’s auto-applied vouchers never reach the taco checkout', () => {
    initCheckoutPage(root(), window.localStorage, vi.fn(), window.sessionStorage, '?restaurant=north-beach-pizzeria');
    const taco = root();
    initCheckoutPage(taco, window.localStorage, vi.fn(), window.sessionStorage, '?restaurant=mission-taqueria');
    expect(taco.querySelector('[data-testid="breakdown-discount"]')).toBeNull();

    const pizza = root();
    initCheckoutPage(pizza, window.localStorage, vi.fn(), window.sessionStorage, '?restaurant=north-beach-pizzeria');
    expect(pizza.querySelector('[data-testid="offers-row"]')?.textContent).toContain('2 applied');
    // The highlight sweep is only for an unset row.
    expect(pizza.querySelector('[data-testid="offers-row"]')?.classList.contains('offers-row--unset')).toBe(false);
  });

  it('the Offers row carries the restaurant through to /offers/', () => {
    const navigate = vi.fn();
    const el = root();
    initCheckoutPage(el, window.localStorage, navigate, window.sessionStorage, '?restaurant=mission-taqueria');
    el.querySelector<HTMLButtonElement>('[data-testid="offers-row"]')?.click();
    expect(navigate).toHaveBeenCalledWith('/offers/?restaurant=mission-taqueria');
  });

  it('with several carts and no ?restaurant=, sends the visitor to /cart/ to choose one and fires no checkout_viewed', () => {
    const stub = vi.fn();
    setTrack(stub);
    const redirect = vi.fn();
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn(), window.sessionStorage, '', redirect);

    expect(redirect).toHaveBeenCalledWith('/cart/');
    expect(el.querySelector('[data-testid="place-order"]')).toBeNull();
    expect(el.querySelector('[data-testid="checkout-choose-cart"] a')?.getAttribute('href')).toBe('/cart/');
    expect(stub).not.toHaveBeenCalled();
  });
});

describe('checkout — the flash fee reaches every drawn restaurant, not just the first two (#120 AC4)', () => {
  it('a restaurant drawn last in a live 6-restaurant flash window still gets its free/reduced delivery fee', () => {
    addToCart(window.localStorage, LINE); // north-beach-pizzeria, sf
    setFlashDraw(window.sessionStorage, 'sf', {
      drawnAt: Date.now(),
      amountMinor: 500,
      restaurants: [
        { slug: 'mission-taqueria', feeMode: 'reduced' },
        { slug: 'dogpatch-burger-works', feeMode: 'reduced' },
        { slug: 'noriega-thai-kitchen', feeMode: 'reduced' },
        { slug: 'inner-richmond-sushi-bar', feeMode: 'reduced' },
        { slug: 'valencia-street-tandoor', feeMode: 'reduced' },
        { slug: 'north-beach-pizzeria', feeMode: 'free' }, // sixth and last of the draw
      ],
    });

    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn(), window.sessionStorage);

    expect(el.querySelector('[data-testid="breakdown-delivery-fee"]')?.textContent).toContain('Free');
  });
});

// --- #149: the wallet wired into checkout (ADR 0008, docs/design/143-wallet.md) ---

const WALLET_CONFIG = { url: 'https://abcdefgh.supabase.co', publishableKey: 'sb_publishable_test_key' };
const CHECKOUT_HREF = 'https://site.example/checkout/?restaurant=north-beach-pizzeria';

const RAW_SESSION = {
  access_token: 'token-abc',
  user: { id: 'user-1', email: 'visitor@example.com', app_metadata: { provider: 'google' } },
};

function signedInAuth(): Partial<SupabaseAuthLike> {
  return { getSession: vi.fn().mockResolvedValue({ data: { session: RAW_SESSION } }) };
}

function fakeAuth(overrides: Partial<SupabaseAuthLike> = {}): SupabaseAuthLike {
  return {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: RAW_SESSION }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    signInWithOAuth: vi.fn().mockResolvedValue({ data: { url: 'https://abcdefgh.supabase.co/auth/v1/authorize?provider=google' }, error: null }),
    ...overrides,
  };
}

interface WalletFetchOptions {
  providers?: { google?: boolean; apple?: boolean };
  ready?: boolean;
  balances?: { usd_minor: number; vnd_minor: number; window_start: string; next_window_start: string; claimed_this_window: boolean } | null;
  /** One entry per call; the last entry repeats for any call past the array's end. `'network-error'` rejects. */
  debit?: Array<{ status: 'debited' | 'already_debited' | 'insufficient' } | { blocked: string } | 'network-error'>;
  drip?: { claimed: boolean; usd_minor: number; vnd_minor: number; next_window_start: string } | null;
}

function walletFetch(opts: WalletFetchOptions) {
  let debitCalls = 0;
  return vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('/auth/v1/settings')) {
      return Promise.resolve({ ok: true, json: async () => ({ external: opts.providers ?? {} }) });
    }
    if (url.endsWith('/rest/v1/rpc/wallet_ready')) {
      return Promise.resolve({ ok: true, json: async () => opts.ready ?? false });
    }
    if (url.endsWith('/rest/v1/rpc/wallet_get')) {
      if (!opts.balances) return Promise.resolve({ ok: false, json: async () => ({}) });
      return Promise.resolve({ ok: true, json: async () => opts.balances });
    }
    if (url.endsWith('/rest/v1/rpc/wallet_claim_drip')) {
      if (!opts.drip) return Promise.resolve({ ok: false, json: async () => ({}) });
      return Promise.resolve({ ok: true, json: async () => opts.drip });
    }
    if (url.endsWith('/rest/v1/rpc/wallet_debit')) {
      const entries = opts.debit ?? [];
      const entry = entries[Math.min(debitCalls, entries.length - 1)];
      debitCalls += 1;
      if (entry === 'network-error') return Promise.reject(new Error('network down'));
      if (!entry) return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      if ('blocked' in entry) return Promise.resolve({ ok: false, status: 400, json: async () => ({ message: entry.blocked }) });
      return Promise.resolve({
        ok: true,
        json: async () => ({ status: entry.status, usd_minor: 900, vnd_minor: 750000, next_window_start: '2026-09-28T06:00:00.000Z' }),
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
}

async function flush(): Promise<void> {
  // A real macrotask drains the whole microtask queue first, however many
  // `await` hops the wallet gate probe, session lookup and balance fetch
  // chain through — counting ticks by hand undercounted in practice.
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function walletDeps(overrides: Partial<CheckoutWalletDeps> & { auth?: Partial<SupabaseAuthLike> } = {}): CheckoutWalletDeps {
  const { auth, ...rest } = overrides;
  return {
    config: WALLET_CONFIG,
    createAuth: vi.fn().mockResolvedValue(fakeAuth(auth)),
    fetchImpl: walletFetch({}),
    locationHref: CHECKOUT_HREF,
    replaceUrl: vi.fn(),
    navigateToOAuth: vi.fn(),
    ...rest,
  };
}

describe('initCheckoutPage — wallet dark because a probe fails at Place order (AC1 fallback)', () => {
  beforeEach(() => addToCart(window.localStorage, LINE));

  it('places the order exactly as today when wallet_ready() fails: placeOrder once, order_placed once with unchanged props, no prompt, no block, no debit', async () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    const fetchImpl = walletFetch({ providers: { google: true }, ready: false }); // wallet_ready() answers false
    initCheckoutPage(el, window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, walletDeps({ fetchImpl }));
    await flush();

    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();
    await flush();

    const orderPlacedCalls = stub.mock.calls.filter(([name]) => name === 'order_placed');
    expect(orderPlacedCalls).toHaveLength(1);
    const [, props] = orderPlacedCalls[0];
    const order = getLatestOrder(window.localStorage);
    expect(props).toEqual({
      order_id: order!.orderId,
      item_count: 1,
      amount_minor: 2150,
      currency: 'USD',
      drop_off_preset: 'home',
      delivery_instructions: 'leave_at_door',
      utensils: true,
      applied_voucher_ids: ['sf-discount-t1', 'sf-delivery-entry'],
      saved_amount_minor: 499,
      city: 'sf',
      restaurant_slug: 'north-beach-pizzeria',
      thanks_voucher_amount_minor: 0,
      vip_level: 'none',
      vip_saved_amount_minor: 0,
      wallet_paid: false,
    });
    expect(el.querySelector('[data-testid="sign-in-prompt"]')).toBeNull();
    expect(el.querySelector('[data-testid="wallet-short-balance"]')).toBeNull();
  });

  it('places the order exactly as today when the settings probe itself errors', async () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/auth/v1/settings')) return Promise.reject(new Error('network down'));
      if (url.endsWith('/rest/v1/rpc/wallet_ready')) return Promise.resolve({ ok: true, json: async () => true });
      throw new Error(`unexpected fetch ${url}`);
    });
    initCheckoutPage(el, window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, walletDeps({ fetchImpl }));
    await flush();

    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();
    await flush();

    expect(stub.mock.calls.filter(([name]) => name === 'order_placed')).toHaveLength(1);
    expect(getCart(window.localStorage)).toEqual([]);
  });
});

describe('initCheckoutPage — wallet live, signed out (AC2)', () => {
  beforeEach(() => addToCart(window.localStorage, LINE));

  it('the sign-in prompt appears on Place order, and nothing is placed, debited or tracked as order_placed', async () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    const fetchImpl = walletFetch({ providers: { google: true, apple: true }, ready: true });
    initCheckoutPage(
      el,
      window.localStorage,
      vi.fn(),
      window.sessionStorage,
      undefined,
      undefined,
      walletDeps({ fetchImpl, auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } }),
    );
    await flush();

    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();
    await flush();

    expect(el.querySelector('[data-testid="sign-in-prompt"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="google-signin"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="apple-signin"]')).not.toBeNull();
    expect(stub.mock.calls.filter(([name]) => name === 'order_placed')).toHaveLength(0);
    expect(getLatestOrder(window.localStorage)).toBeNull();
    expect(getCart(window.localStorage)).not.toEqual([]);
  });

  it('only the enabled provider’s button renders', async () => {
    const el = root();
    const fetchImpl = walletFetch({ providers: { google: true, apple: false }, ready: true });
    initCheckoutPage(el, window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, walletDeps({ fetchImpl }));
    await flush();

    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();
    await flush();

    expect(el.querySelector('[data-testid="google-signin"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="apple-signin"]')).toBeNull();
  });

  it('tapping a provider persists the pending order (choices + a pre-made orderId) and starts the OAuth redirect with this checkout’s URL', async () => {
    const el = root();
    const fetchImpl = walletFetch({ providers: { google: true }, ready: true });
    const navigateToOAuth = vi.fn();
    const signInWithOAuth = vi.fn().mockResolvedValue({ data: { url: 'https://abcdefgh.supabase.co/auth/v1/authorize?provider=google' }, error: null });
    initCheckoutPage(
      el,
      window.localStorage,
      vi.fn(),
      window.sessionStorage,
      undefined,
      undefined,
      walletDeps({ fetchImpl, navigateToOAuth, auth: { signInWithOAuth } }),
    );
    await flush();

    el.querySelector<HTMLButtonElement>('[data-testid="drop-off-office"]')?.click();
    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();
    await flush();
    el.querySelector<HTMLButtonElement>('[data-testid="google-signin"]')?.click();
    await flush();

    expect(signInWithOAuth).toHaveBeenCalledTimes(1);
    const [[{ provider, options }]] = signInWithOAuth.mock.calls;
    expect(provider).toBe('google');
    expect(options?.skipBrowserRedirect).toBe(true);
    expect(options?.redirectTo).toContain('restaurant=north-beach-pizzeria');
    expect(navigateToOAuth).toHaveBeenCalledWith('https://abcdefgh.supabase.co/auth/v1/authorize?provider=google');

    const pendingRaw = window.sessionStorage.getItem('parody.pendingOrder.north-beach-pizzeria');
    expect(pendingRaw).not.toBeNull();
    const pending = JSON.parse(pendingRaw!);
    expect(pending.dropOffPreset).toBe('office');
    expect(pending.provider).toBe('google');
    expect(typeof pending.orderId).toBe('string');
  });

  it('Not now closes the prompt and leaves checkout exactly as it was, re-enabling Place order', async () => {
    const el = root();
    const fetchImpl = walletFetch({ providers: { google: true }, ready: true });
    initCheckoutPage(el, window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, walletDeps({ fetchImpl }));
    await flush();

    const button = el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')!;
    button.click();
    await flush();
    el.querySelector<HTMLButtonElement>('[data-testid="sign-in-not-now"]')?.click();

    expect(el.querySelector('[data-testid="sign-in-prompt"]')).toBeNull();
    expect(button.disabled).toBe(false);
  });
});

describe('initCheckoutPage — returned from the OAuth round trip (AC2)', () => {
  beforeEach(() => addToCart(window.localStorage, LINE));

  it('restores the persisted choices, recomputes the total, and shows a changed-total notice', async () => {
    window.sessionStorage.setItem(
      'parody.pendingOrder.north-beach-pizzeria',
      JSON.stringify({
        orderId: 'order-pending-1',
        dropOffPreset: 'office',
        deliveryInstructions: 'hand_to_me',
        utensils: false,
        totalMinorAtSignIn: 999999,
        provider: 'google',
      }),
    );
    const el = root();
    const fetchImpl = walletFetch({ providers: { google: true }, ready: true, balances: { usd_minor: 3000, vnd_minor: 750000, window_start: 'w', next_window_start: 'n', claimed_this_window: false } });
    initCheckoutPage(
      el,
      window.localStorage,
      vi.fn(),
      window.sessionStorage,
      undefined,
      undefined,
      walletDeps({
        fetchImpl,
        locationHref: `${CHECKOUT_HREF}&code=abc123`,
        auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
      }),
    );
    await flush();

    expect(el.querySelector('[data-testid="drop-off-office"]')?.classList.contains('selected')).toBe(true);
    expect(el.querySelector('[data-testid="delivery-instructions-hand_to_me"]')?.classList.contains('selected')).toBe(true);
    expect(el.querySelector('[data-testid="utensils-no"]')?.classList.contains('selected')).toBe(true);
    expect(el.querySelector('[data-testid="breakdown-total"]')?.textContent).toContain('$21.00');
    const notice = el.querySelector('[data-testid="wallet-returned-notice"]');
    expect(notice?.textContent).toContain('$21.00');
    expect(notice?.textContent).toContain('$9,999.99');
  });

  it('shows the unchanged-total notice when the recomputed total matches', async () => {
    window.sessionStorage.setItem(
      'parody.pendingOrder.north-beach-pizzeria',
      JSON.stringify({
        orderId: 'order-pending-1',
        dropOffPreset: 'home',
        deliveryInstructions: 'leave_at_door',
        utensils: true,
        totalMinorAtSignIn: 2100,
        provider: 'google',
      }),
    );
    const el = root();
    const fetchImpl = walletFetch({ providers: { google: true }, ready: true, balances: { usd_minor: 3000, vnd_minor: 750000, window_start: 'w', next_window_start: 'n', claimed_this_window: false } });
    initCheckoutPage(
      el,
      window.localStorage,
      vi.fn(),
      window.sessionStorage,
      undefined,
      undefined,
      walletDeps({ fetchImpl, locationHref: `${CHECKOUT_HREF}&code=abc123` }),
    );
    await flush();

    expect(el.querySelector('[data-testid="wallet-returned-notice"]')?.textContent).toBe('Signed in. Your cart and offers are as you left them.');
  });

  it('a failed or cancelled return shows the neutral notice, and Place order is still enabled', async () => {
    const el = root();
    const fetchImpl = walletFetch({ providers: { google: true }, ready: true });
    initCheckoutPage(
      el,
      window.localStorage,
      vi.fn(),
      window.sessionStorage,
      undefined,
      undefined,
      walletDeps({ fetchImpl, locationHref: `${CHECKOUT_HREF}&error=access_denied` }),
    );
    await flush();

    expect(el.querySelector('[data-testid="wallet-signin-failed"]')?.textContent).toContain("Sign-in didn't finish");
    expect(el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.disabled).toBe(false);
  });

  it('names Apple specifically when the pending record says the failed attempt was Apple’s', async () => {
    window.sessionStorage.setItem(
      'parody.pendingOrder.north-beach-pizzeria',
      JSON.stringify({
        orderId: 'order-pending-1',
        dropOffPreset: 'home',
        deliveryInstructions: 'leave_at_door',
        utensils: true,
        totalMinorAtSignIn: 2100,
        provider: 'apple',
      }),
    );
    const el = root();
    const fetchImpl = walletFetch({ providers: { google: true, apple: true }, ready: true });
    initCheckoutPage(
      el,
      window.localStorage,
      vi.fn(),
      window.sessionStorage,
      undefined,
      undefined,
      walletDeps({ fetchImpl, locationHref: `${CHECKOUT_HREF}&error=server_error` }),
    );
    await flush();

    expect(el.querySelector('[data-testid="wallet-signin-failed"]')?.textContent).toBe("Apple sign-in isn't working right now; try Google.");
  });
});

describe('initCheckoutPage — wallet live, signed in, sufficient balance (AC3)', () => {
  beforeEach(() => addToCart(window.localStorage, LINE));

  function sufficientDeps(overrides: Partial<CheckoutWalletDeps> = {}) {
    return walletDeps({
      fetchImpl: walletFetch({
        providers: { google: true },
        ready: true,
        balances: { usd_minor: 3000, vnd_minor: 750000, window_start: 'w', next_window_start: 'n', claimed_this_window: false },
        debit: [{ status: 'debited' }],
      }),
      auth: signedInAuth(),
      ...overrides,
    });
  }

  it('debits totalMinor exactly once, stores the order, fires order_placed once only after the debit, and the shown balance decreases', async () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    const navigate = vi.fn();
    initCheckoutPage(el, window.localStorage, navigate, window.sessionStorage, undefined, undefined, sufficientDeps());
    await flush();

    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();
    await flush();

    const orderPlacedCalls = stub.mock.calls.filter(([name]) => name === 'order_placed');
    expect(orderPlacedCalls).toHaveLength(1);
    const order = getLatestOrder(window.localStorage);
    expect(order).not.toBeNull();
    expect(order!.totalMinor).toBe(2100);
    expect(navigate).toHaveBeenCalledWith('/order-placed/');
    expect(el.querySelector('[data-testid="wallet-pays-amount"]')?.textContent).toBe('$9.00'); // 900 cents from the stubbed debit response
    expect(window.sessionStorage.getItem('parody.pendingOrder.north-beach-pizzeria')).toBeNull();
  });

  it('a rapid double-tap sends exactly one debit call for one orderId', async () => {
    const el = root();
    const fetchImpl = walletFetch({
      providers: { google: true },
      ready: true,
      balances: { usd_minor: 3000, vnd_minor: 750000, window_start: 'w', next_window_start: 'n', claimed_this_window: false },
      debit: [{ status: 'debited' }],
    });
    initCheckoutPage(el, window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, sufficientDeps({ fetchImpl }));
    await flush();

    const button = el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')!;
    button.click();
    button.click();
    button.click();
    await flush();

    const debitCalls = fetchImpl.mock.calls.filter(([url]) => (url as string).endsWith('/rest/v1/rpc/wallet_debit'));
    expect(debitCalls).toHaveLength(1);
  });

  it('a first debit call that fails with a network error is retried with the same orderId, and still places exactly one order', async () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    const fetchImpl = walletFetch({
      providers: { google: true },
      ready: true,
      balances: { usd_minor: 3000, vnd_minor: 750000, window_start: 'w', next_window_start: 'n', claimed_this_window: false },
      debit: ['network-error', { status: 'debited' }],
    });
    initCheckoutPage(el, window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, sufficientDeps({ fetchImpl }));
    await flush();

    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();
    await flush();

    const debitCalls = fetchImpl.mock.calls.filter(([url]) => (url as string).endsWith('/rest/v1/rpc/wallet_debit'));
    expect(debitCalls).toHaveLength(2);
    const bodies = debitCalls.map(([, init]) => JSON.parse((init as RequestInit).body as string));
    expect(bodies[0].p_order_id).toBe(bodies[1].p_order_id);
    expect(stub.mock.calls.filter(([name]) => name === 'order_placed')).toHaveLength(1);
    expect(getLatestOrder(window.localStorage)).not.toBeNull();
  });
});

describe('initCheckoutPage — walletPaid recorded on the order (#165 AC1)', () => {
  beforeEach(() => addToCart(window.localStorage, LINE));

  it('is true when the debit answers debited', async () => {
    const el = root();
    initCheckoutPage(
      el,
      window.localStorage,
      vi.fn(),
      window.sessionStorage,
      undefined,
      undefined,
      walletDeps({
        fetchImpl: walletFetch({
          providers: { google: true },
          ready: true,
          balances: { usd_minor: 3000, vnd_minor: 750000, window_start: 'w', next_window_start: 'n', claimed_this_window: false },
          debit: [{ status: 'debited' }],
        }),
        auth: signedInAuth(),
      }),
    );
    await flush();

    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();
    await flush();

    expect(getLatestOrder(window.localStorage)?.walletPaid).toBe(true);
  });

  it('is true when the debit answers already_debited (a retry after the local write was lost)', async () => {
    const el = root();
    initCheckoutPage(
      el,
      window.localStorage,
      vi.fn(),
      window.sessionStorage,
      undefined,
      undefined,
      walletDeps({
        fetchImpl: walletFetch({
          providers: { google: true },
          ready: true,
          balances: { usd_minor: 3000, vnd_minor: 750000, window_start: 'w', next_window_start: 'n', claimed_this_window: false },
          debit: [{ status: 'already_debited' }],
        }),
        auth: signedInAuth(),
      }),
    );
    await flush();

    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();
    await flush();

    expect(getLatestOrder(window.localStorage)?.walletPaid).toBe(true);
  });

  it('is false when the wallet gate probe fails (D1 fallback places the order with no debit at all)', async () => {
    const el = root();
    const fetchImpl = walletFetch({ providers: { google: true }, ready: false });
    initCheckoutPage(el, window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, walletDeps({ fetchImpl }));
    await flush();

    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();
    await flush();

    expect(getLatestOrder(window.localStorage)?.walletPaid).toBe(false);
  });

  it('is false when the wallet is dark (no config at all — the exact original synchronous path)', async () => {
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, { config: null });
    await flush();

    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();
    await flush();

    expect(getLatestOrder(window.localStorage)?.walletPaid).toBe(false);
  });
});

describe('initCheckoutPage — wallet live, signed in, short balance (AC4)', () => {
  beforeEach(() => addToCart(window.localStorage, LINE));

  it('shows the shortfall and the next drip time, blocks Place order, and attempts no debit, no order, no order_placed', async () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    const fetchImpl = walletFetch({
      providers: { google: true },
      ready: true,
      balances: { usd_minor: 1000, vnd_minor: 750000, window_start: 'w', next_window_start: '2026-09-28T06:00:00.000Z', claimed_this_window: true },
    });
    initCheckoutPage(el, window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, walletDeps({ fetchImpl, auth: signedInAuth() }));
    await flush();

    expect(el.querySelector('[data-testid="wallet-short-balance-shortfall"]')?.textContent).toBe('$11.00 short');
    expect(el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.getAttribute('aria-disabled')).toBe('true');

    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();
    await flush();

    expect(stub.mock.calls.filter(([name]) => name === 'order_placed')).toHaveLength(0);
    expect(getLatestOrder(window.localStorage)).toBeNull();
    const debitCalls = fetchImpl.mock.calls.filter(([url]) => (url as string).endsWith('/rest/v1/rpc/wallet_debit'));
    expect(debitCalls).toHaveLength(0);
  });

  it('offers Collect when a drip is available', async () => {
    const el = root();
    const fetchImpl = walletFetch({
      providers: { google: true },
      ready: true,
      balances: { usd_minor: 1000, vnd_minor: 750000, window_start: 'w', next_window_start: 'n', claimed_this_window: false },
    });
    initCheckoutPage(el, window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, walletDeps({ fetchImpl, auth: signedInAuth() }));
    await flush();

    expect(el.querySelector('[data-testid="wallet-short-balance-collect"]')).not.toBeNull();
  });

  it('a debit that comes back insufficient (balance spent elsewhere) blocks after the fact, with no order and no order_placed', async () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    const fetchImpl = walletFetch({
      providers: { google: true },
      ready: true,
      balances: { usd_minor: 3000, vnd_minor: 750000, window_start: 'w', next_window_start: 'n', claimed_this_window: false },
      debit: [{ status: 'insufficient' }],
    });
    initCheckoutPage(el, window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, walletDeps({ fetchImpl, auth: signedInAuth() }));
    await flush();

    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();
    await flush();

    expect(el.querySelector('[data-testid="wallet-short-balance"]')).not.toBeNull();
    expect(stub.mock.calls.filter(([name]) => name === 'order_placed')).toHaveLength(0);
    expect(getLatestOrder(window.localStorage)).toBeNull();
  });
});

describe('initCheckoutPage — source of truth when a debit succeeds but the local write is lost (AC4)', () => {
  it('leaves the pending order in sessionStorage so a retry reuses the same orderId, rather than silently dropping it', async () => {
    addToCart(window.localStorage, LINE);
    const brokenStorage: Storage = {
      ...window.localStorage,
      getItem: (key: string) => window.localStorage.getItem(key),
      setItem: (key: string, value: string) => {
        if (key === 'parody.orders') throw new Error('storage full');
        window.localStorage.setItem(key, value);
      },
      removeItem: (key: string) => window.localStorage.removeItem(key),
      key: (index: number) => window.localStorage.key(index),
      clear: () => window.localStorage.clear(),
      get length() {
        return window.localStorage.length;
      },
    };
    const el = root();
    const fetchImpl = walletFetch({
      providers: { google: true },
      ready: true,
      balances: { usd_minor: 3000, vnd_minor: 750000, window_start: 'w', next_window_start: 'n', claimed_this_window: false },
      debit: [{ status: 'debited' }],
    });
    initCheckoutPage(el, brokenStorage, vi.fn(), window.sessionStorage, undefined, undefined, walletDeps({ fetchImpl, auth: signedInAuth() }));
    await flush();

    expect(() => el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click()).not.toThrow();
    await flush();

    const pendingRaw = window.sessionStorage.getItem('parody.pendingOrder.north-beach-pizzeria');
    expect(pendingRaw).not.toBeNull();
    const debitCalls = fetchImpl.mock.calls.filter(([url]) => (url as string).endsWith('/rest/v1/rpc/wallet_debit'));
    expect(debitCalls).toHaveLength(1);
  });
});

// --- #238: the #219 contract's events at checkout ---

const SIGNED_IN_BALANCES = { usd_minor: 3000, vnd_minor: 750000, window_start: 'w', next_window_start: 'n', claimed_this_window: false };
const SHORT_BALANCES = { usd_minor: 1000, vnd_minor: 750000, window_start: 'w', next_window_start: '2026-09-28T06:00:00.000Z', claimed_this_window: false };

/** Every call of one event name the stub received, props only. */
function propsOf(stub: ReturnType<typeof vi.fn>, eventName: string): Record<string, unknown>[] {
  return stub.mock.calls.filter(([name]) => name === eventName).map(([, props]) => props as Record<string, unknown>);
}

/** No new or changed event carries an email, a user id, a balance or a shortfall (the #79 rule, #219 §9). */
function expectNoIdentityOrBalance(stub: ReturnType<typeof vi.fn>): void {
  const sent = JSON.stringify(stub.mock.calls);
  expect(sent).not.toContain(RAW_SESSION.user.email);
  expect(sent).not.toContain(RAW_SESSION.user.id);
  expect(sent).not.toContain(RAW_SESSION.access_token);
  expect(sent).not.toMatch(/balance|shortfall|email|user_id/i);
}

describe('#238: checkout_viewed and order_placed carry the #219 §8 props, and the store keeps them (AC1)', () => {
  beforeEach(() => addToCart(window.localStorage, LINE));
  beforeAll(openEventStore, EVENT_STORE_BOOT_TIMEOUT_MS);
  afterAll(closeEventStore);

  it('checkout_viewed is exactly the four §8 props, and the store keeps that object', async () => {
    const stub = vi.fn();
    setTrack(stub);
    initCheckoutPage(root(), window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, { config: null });

    expect(propsOf(stub, 'checkout_viewed')).toEqual([{ item_count: 1, amount_minor: 2150, city: 'sf', currency: 'USD' }]);
    const [props] = propsOf(stub, 'checkout_viewed');
    await expect(storeWhatTheClientSends('checkout_viewed', props as never)).resolves.toEqual(props);
  });

  it('a dark-wallet order sends all 15 §4.2 keys, wallet_paid false, and the store keeps that object', async () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, { config: null });
    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();

    const order = getLatestOrder(window.localStorage)!;
    expect(propsOf(stub, 'order_placed')).toEqual([
      {
        order_id: order.orderId,
        item_count: 1,
        amount_minor: 2150,
        city: 'sf',
        restaurant_slug: 'north-beach-pizzeria',
        currency: 'USD',
        drop_off_preset: 'home',
        delivery_instructions: 'leave_at_door',
        utensils: true,
        applied_voucher_ids: ['sf-discount-t1', 'sf-delivery-entry'],
        saved_amount_minor: 499,
        thanks_voucher_amount_minor: 0,
        vip_level: 'none',
        vip_saved_amount_minor: 0,
        wallet_paid: false,
      },
    ]);
    const [props] = propsOf(stub, 'order_placed');
    await expect(storeWhatTheClientSends('order_placed', props as never)).resolves.toEqual(props);
  });

  it('Platinum with a thanks voucher sends vip_level, Gold\'s waived fee plus Platinum\'s 10%, and the voucher amount; the store keeps it', async () => {
    writeVipLedger(window.localStorage, { v: 1, deliveredCount: 3, spendMinor: { USD: 6000, VND: 0 }, level: 'platinum' });
    unlockThanksVoucher(window.localStorage, 'sf', 'source-order', Date.now());
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, { config: null });
    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();

    const [props] = propsOf(stub, 'order_placed');
    // 299 is North Beach Pizzeria's waived delivery fee (Gold's perk), 215 is 10% of the $21.50 subtotal (Platinum's).
    expect(props).toMatchObject({
      vip_level: 'platinum',
      vip_saved_amount_minor: 299 + 215,
      thanks_voucher_amount_minor: 300,
      applied_voucher_ids: ['sf-discount-t1'],
      saved_amount_minor: 200,
      wallet_paid: false,
    });
    await expect(storeWhatTheClientSends('order_placed', props as never)).resolves.toEqual(props);
  });

  it('Gold sends vip_level gold and the waived delivery fee only', () => {
    writeVipLedger(window.localStorage, { v: 1, deliveredCount: 3, spendMinor: { USD: 0, VND: 0 }, level: 'gold' });
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, { config: null });
    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();

    expect(propsOf(stub, 'order_placed')[0]).toMatchObject({ vip_level: 'gold', vip_saved_amount_minor: 299 });
  });

  it('a wallet-paid order sends wallet_paid true, and the store keeps that object', async () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    const fetchImpl = walletFetch({ providers: { google: true }, ready: true, balances: SIGNED_IN_BALANCES, debit: [{ status: 'debited' }] });
    initCheckoutPage(el, window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, walletDeps({ fetchImpl, auth: signedInAuth() }));
    await flush();
    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();
    await flush();

    const placed = propsOf(stub, 'order_placed');
    expect(placed).toHaveLength(1);
    expect(placed[0]).toMatchObject({ wallet_paid: true, order_id: getLatestOrder(window.localStorage)!.orderId });
    expectNoIdentityOrBalance(stub);
    await expect(storeWhatTheClientSends('order_placed', placed[0] as never)).resolves.toEqual(placed[0]);
  });

  it('a wallet-paid double tap still sends exactly one order_placed (§8: exactly one per order_id)', async () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    const fetchImpl = walletFetch({ providers: { google: true }, ready: true, balances: SIGNED_IN_BALANCES, debit: [{ status: 'debited' }] });
    initCheckoutPage(el, window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, walletDeps({ fetchImpl, auth: signedInAuth() }));
    await flush();
    const button = el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')!;
    button.click();
    button.click();
    await flush();

    expect(propsOf(stub, 'order_placed')).toHaveLength(1);
  });
});

describe('#238: wallet_short_shown at checkout (AC1, AC3)', () => {
  beforeEach(() => addToCart(window.localStorage, LINE));
  beforeAll(openEventStore, EVENT_STORE_BOOT_TIMEOUT_MS);
  afterAll(closeEventStore);

  it('fires once with only city and surface when the block first renders on load, and the store keeps that object', async () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    const fetchImpl = walletFetch({ providers: { google: true }, ready: true, balances: SHORT_BALANCES });
    initCheckoutPage(el, window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, walletDeps({ fetchImpl, auth: signedInAuth() }));
    await flush();

    expect(propsOf(stub, 'wallet_short_shown')).toEqual([{ city: 'sf', surface: 'checkout' }]);
    expectNoIdentityOrBalance(stub);
    const [props] = propsOf(stub, 'wallet_short_shown');
    await expect(storeWhatTheClientSends('wallet_short_shown', props as never)).resolves.toEqual(props);
  });

  it('a re-render (Collect that still leaves it short) and a second Place order tap fire no second one', async () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    const fetchImpl = walletFetch({
      providers: { google: true },
      ready: true,
      balances: { ...SHORT_BALANCES, usd_minor: 100 },
      drip: { claimed: true, usd_minor: 600, vnd_minor: 750000, next_window_start: '2026-09-28T06:00:00.000Z' },
    });
    initCheckoutPage(el, window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, walletDeps({ fetchImpl, auth: signedInAuth() }));
    await flush();
    el.querySelector<HTMLButtonElement>('[data-testid="wallet-short-balance-collect"]')?.click();
    await flush();
    expect(el.querySelector('[data-testid="wallet-short-balance-shortfall"]')?.textContent).toBe('$15.00 short');
    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();
    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();
    await flush();

    expect(propsOf(stub, 'wallet_short_shown')).toHaveLength(1);
  });

  it('fires once after an insufficient debit, and not again on a second insufficient debit', async () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    const fetchImpl = walletFetch({ providers: { google: true }, ready: true, balances: SIGNED_IN_BALANCES, debit: [{ status: 'insufficient' }] });
    initCheckoutPage(el, window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, walletDeps({ fetchImpl, auth: signedInAuth() }));
    await flush();
    expect(propsOf(stub, 'wallet_short_shown')).toHaveLength(0);

    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();
    await flush();
    expect(propsOf(stub, 'wallet_short_shown')).toEqual([{ city: 'sf', surface: 'checkout' }]);
  });

  it('never fires when the balance covers the order, or with the wallet dark', async () => {
    const stub = vi.fn();
    setTrack(stub);
    const fetchImpl = walletFetch({ providers: { google: true }, ready: true, balances: SIGNED_IN_BALANCES });
    initCheckoutPage(root(), window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, walletDeps({ fetchImpl, auth: signedInAuth() }));
    initCheckoutPage(root(), window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, { config: null });
    await flush();

    expect(propsOf(stub, 'wallet_short_shown')).toHaveLength(0);
  });
});

describe('#238: sign-in at Place order, across the OAuth round trip (AC1, AC2)', () => {
  beforeEach(() => addToCart(window.localStorage, LINE));
  beforeAll(openEventStore, EVENT_STORE_BOOT_TIMEOUT_MS);
  afterAll(closeEventStore);

  async function openSheet(el: HTMLElement, deps: CheckoutWalletDeps): Promise<void> {
    initCheckoutPage(el, window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, deps);
    await flush();
    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();
    await flush();
  }

  it('sign_in_prompt_shown fires once per opening, and dismissing it fires nothing; the store keeps it', async () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    await openSheet(el, walletDeps({ fetchImpl: walletFetch({ providers: { google: true }, ready: true }) }));
    expect(propsOf(stub, 'sign_in_prompt_shown')).toEqual([{ surface: 'checkout' }]);

    el.querySelector<HTMLButtonElement>('[data-testid="sign-in-not-now"]')?.click();
    expect(stub.mock.calls).toHaveLength(2); // checkout_viewed, then the one prompt
    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();
    await flush();
    expect(propsOf(stub, 'sign_in_prompt_shown')).toEqual([{ surface: 'checkout' }, { surface: 'checkout' }]);

    const [props] = propsOf(stub, 'sign_in_prompt_shown');
    await expect(storeWhatTheClientSends('sign_in_prompt_shown', props as never)).resolves.toEqual(props);
  });

  it('a provider tap writes parody.pendingSignIn, then POSTs sign_in_started with keepalive, then navigates; the store keeps it', async () => {
    const order: string[] = [];
    const sendFetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      order.push(`post:${JSON.parse(init.body as string).event_name}`);
      return Promise.resolve({ ok: true });
    });
    vi.stubGlobal('navigator', { webdriver: false, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
    const stub = vi.fn();
    const sender = createSupabaseSender({ url: 'https://abcdefgh.supabase.co', publishableKey: 'sb_publishable_test_key', fetchImpl: sendFetch });
    setTrack((name, props) => {
      stub(name, props);
      sender(name, props);
    });
    const navigateToOAuth = vi.fn().mockImplementation(() => {
      order.push('navigate');
      expect(JSON.parse(window.sessionStorage.getItem('parody.pendingSignIn')!)).toEqual({ provider: 'apple', surface: 'checkout' });
    });
    const el = root();
    try {
      await openSheet(el, walletDeps({ fetchImpl: walletFetch({ providers: { google: true, apple: true }, ready: true }), navigateToOAuth }));
      el.querySelector<HTMLButtonElement>('[data-testid="apple-signin"]')?.click();
      await flush();
    } finally {
      vi.unstubAllGlobals();
    }

    expect(order).toEqual(['post:checkout_viewed', 'post:sign_in_prompt_shown', 'post:sign_in_started', 'navigate']);
    const startedPost = sendFetch.mock.calls.find(([, init]) => JSON.parse((init as RequestInit).body as string).event_name === 'sign_in_started')!;
    expect((startedPost[1] as RequestInit).keepalive).toBe(true);
    expect(propsOf(stub, 'sign_in_started')).toEqual([{ provider: 'apple', surface: 'checkout' }]);
    const [props] = propsOf(stub, 'sign_in_started');
    await expect(storeWhatTheClientSends('sign_in_started', props as never)).resolves.toEqual(props);
  });

  it('when beginSignIn returns false, no sign_in_started fires and no pending record is written', async () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    const navigateToOAuth = vi.fn();
    await openSheet(
      el,
      walletDeps({
        fetchImpl: walletFetch({ providers: { google: true }, ready: true }),
        navigateToOAuth,
        auth: { signInWithOAuth: vi.fn().mockResolvedValue({ data: { url: null }, error: { message: 'nope' } }) },
      }),
    );
    el.querySelector<HTMLButtonElement>('[data-testid="google-signin"]')?.click();
    await flush();

    expect(navigateToOAuth).not.toHaveBeenCalled();
    expect(propsOf(stub, 'sign_in_started')).toHaveLength(0);
    expect(window.sessionStorage.getItem('parody.pendingSignIn')).toBeNull();
  });

  function returnDeps(query: string, fetchBalances = true): CheckoutWalletDeps {
    return walletDeps({
      fetchImpl: walletFetch({ providers: { google: true }, ready: true, balances: fetchBalances ? SIGNED_IN_BALANCES : null }),
      locationHref: `${CHECKOUT_HREF}${query}`,
    });
  }

  it('the return fires exactly one sign_in_completed, success, from the pending record — and a second reader finds nothing; the store keeps it', async () => {
    window.sessionStorage.setItem('parody.pendingSignIn', JSON.stringify({ provider: 'google', surface: 'checkout' }));
    const stub = vi.fn();
    setTrack(stub);
    initCheckoutPage(root(), window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, returnDeps('&code=abc123'));
    // Claimed in the same synchronous step, before any await (§7).
    expect(window.sessionStorage.getItem('parody.pendingSignIn')).toBeNull();
    initCheckoutPage(root(), window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, returnDeps('&code=abc123'));
    await flush();

    expect(propsOf(stub, 'sign_in_completed')).toEqual([{ outcome: 'success', provider: 'google', surface: 'checkout' }]);
    expect(window.sessionStorage.getItem('parody.pendingSignIn')).toBeNull();
    expectNoIdentityOrBalance(stub);
    const [props] = propsOf(stub, 'sign_in_completed');
    await expect(storeWhatTheClientSends('sign_in_completed', props as never)).resolves.toEqual(props);
  });

  it('a success followed by an unreachable wallet (D1 dark) is still success', async () => {
    window.sessionStorage.setItem('parody.pendingSignIn', JSON.stringify({ provider: 'google', surface: 'checkout' }));
    const stub = vi.fn();
    setTrack(stub);
    initCheckoutPage(root(), window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, returnDeps('&code=abc123', false));
    await flush();

    expect(propsOf(stub, 'sign_in_completed')).toEqual([{ outcome: 'success', provider: 'google', surface: 'checkout' }]);
  });

  it('a cancelled or failed return fires one sign_in_completed, failed; the store keeps it', async () => {
    window.sessionStorage.setItem('parody.pendingSignIn', JSON.stringify({ provider: 'apple', surface: 'checkout' }));
    const stub = vi.fn();
    setTrack(stub);
    initCheckoutPage(root(), window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, returnDeps('&error=access_denied'));
    await flush();

    expect(propsOf(stub, 'sign_in_completed')).toEqual([{ outcome: 'failed', provider: 'apple', surface: 'checkout' }]);
    const [props] = propsOf(stub, 'sign_in_completed');
    await expect(storeWhatTheClientSends('sign_in_completed', props as never)).resolves.toEqual(props);
  });

  it('a reload of the cleaned URL fires nothing, even with a record left over', async () => {
    window.sessionStorage.setItem('parody.pendingSignIn', JSON.stringify({ provider: 'google', surface: 'checkout' }));
    const stub = vi.fn();
    setTrack(stub);
    initCheckoutPage(root(), window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, returnDeps(''));
    await flush();

    expect(propsOf(stub, 'sign_in_completed')).toHaveLength(0);
  });

  it('a return with no pending record fires nothing', async () => {
    const stub = vi.fn();
    setTrack(stub);
    initCheckoutPage(root(), window.localStorage, vi.fn(), window.sessionStorage, undefined, undefined, returnDeps('&code=abc123'));
    await flush();

    expect(propsOf(stub, 'sign_in_completed')).toHaveLength(0);
  });
});
