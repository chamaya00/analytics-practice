import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initCheckoutPage } from './checkout-dom';
import { setFlashDraw } from './flash-deal';
import { addToCart, getCart, getLatestOrder, getVisitorId } from './order-store';
import { estimateEtaMinutes } from './eta';
import { resetTrack, setTrack } from './tracking';

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

    expect(stub).toHaveBeenCalledWith('checkout_viewed', { item_count: 1, amount_minor: 2150, currency: 'USD' });
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

    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();
    const [, props] = stub.mock.calls.find(([name]) => name === 'order_placed')!;
    expect(props.applied_voucher_ids).toEqual([]);
    expect(props.saved_amount_minor).toBe(0);
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
    expect(stub).toHaveBeenCalledWith('checkout_viewed', { item_count: 1, amount_minor: 425, currency: 'USD' });
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
