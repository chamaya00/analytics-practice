import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initCheckoutPage } from './checkout-dom';
import { addToCart, getCart, getOrder } from './order-store';
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

  it('renders the subtotal, delivery fee, service fee and total as separate lines summing correctly (AC1)', () => {
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());

    expect(el.querySelector('[data-testid="breakdown-subtotal"]')?.textContent).toContain('$21.50');
    expect(el.querySelector('[data-testid="breakdown-delivery-fee"]')?.textContent).toContain('$2.99');
    expect(el.querySelector('[data-testid="breakdown-service-fee"]')?.textContent).toContain('$1.50');
    expect(el.querySelector('[data-testid="breakdown-total"]')?.textContent).toContain('$25.99');
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

  it('placing an order writes the stored order, clears the cart, and fires exactly one order_placed with exactly the no-voucher shape (AC3)', () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());

    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();

    const orderPlacedCalls = stub.mock.calls.filter(([name]) => name === 'order_placed');
    expect(orderPlacedCalls).toHaveLength(1);
    const [, props] = orderPlacedCalls[0];
    const order = getOrder(window.localStorage);
    expect(props).toEqual({
      order_id: order!.orderId,
      item_count: 1,
      amount_minor: 2150,
      currency: 'USD',
      drop_off_preset: 'home',
      delivery_instructions: 'leave_at_door',
      utensils: true,
      applied_voucher_ids: [],
      saved_amount_minor: 0,
    });
    expect(getCart(window.localStorage)).toEqual([]);
    expect(getOrder(window.localStorage)).not.toBeNull();
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
