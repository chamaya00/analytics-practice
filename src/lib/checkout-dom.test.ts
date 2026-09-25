import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initCheckoutPage } from './checkout-dom';
import { addToCart, getCart, getOrder } from './order-store';
import { resetTrack, setTrack } from './tracking';

const LINE = {
  itemId: 'one-job-pizza-margherita',
  restaurantSlug: 'one-job-pizza',
  restaurantName: 'One Job Pizza',
  name: 'Margherita, carried flat',
  priceCents: 1400,
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

describe('initCheckoutPage — empty cart (AC9)', () => {
  it('redirects to /cart/ and renders nothing when the cart is empty', () => {
    const navigate = vi.fn();
    const el = root();

    initCheckoutPage(el, window.localStorage, navigate);

    expect(navigate).toHaveBeenCalledWith('/cart/');
    expect(el.children.length).toBe(0);
  });

  it('does not fire checkout_viewed when redirecting', () => {
    const stub = vi.fn();
    setTrack(stub);

    initCheckoutPage(root(), window.localStorage, vi.fn());

    expect(stub).not.toHaveBeenCalled();
  });
});

describe('initCheckoutPage — populated cart (AC3, AC4)', () => {
  beforeEach(() => {
    addToCart(window.localStorage, LINE);
  });

  it('fires checkout_viewed with the cart’s item_count and subtotal_cents', () => {
    const stub = vi.fn();
    setTrack(stub);

    initCheckoutPage(root(), window.localStorage, vi.fn());

    expect(stub).toHaveBeenCalledWith('checkout_viewed', { item_count: 1, subtotal_cents: 1400 });
  });

  it('renders exactly the five named fields and nothing typed anywhere (AC4)', () => {
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());

    expect(el.querySelector('[data-testid="field-drop-off"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="field-handling"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="field-utensils"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="field-tip"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="field-promo"]')).not.toBeNull();

    expect(el.querySelectorAll('input, textarea')).toHaveLength(0);

    // Every field defaults to a preset choice — checkout is reachable with zero typing.
    expect(el.querySelector('[data-testid="drop-off-couch"]')?.classList.contains('selected')).toBe(true);
    expect(el.querySelector('[data-testid="promo-dont_drop10"]')?.classList.contains('selected')).toBe(true);
  });

  it('the promo-code field is a preset choice, not free text — only the four named codes exist', () => {
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());
    const promoButtons = el.querySelectorAll('[data-testid="field-promo"] .chip-group button');
    expect(promoButtons).toHaveLength(4);
    expect(['DONTDROP10', 'STILLHERE', 'CLUMSY15', 'GOTCHA']).toEqual(
      Array.from(promoButtons).map((button) => button.textContent),
    );
  });

  it('placing an order writes the stored order, clears the cart, and fires exactly one order_placed', () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    initCheckoutPage(el, window.localStorage, vi.fn());

    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();

    const orderPlacedCalls = stub.mock.calls.filter(([name]) => name === 'order_placed');
    expect(orderPlacedCalls).toHaveLength(1);
    expect(orderPlacedCalls[0][1]).toMatchObject({ drop_off_spot: 'couch', promo_code: 'dont_drop10' });
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

    el.querySelector<HTMLButtonElement>('[data-testid="promo-clumsy15"]')?.click();
    el.querySelector<HTMLButtonElement>('[data-testid="place-order"]')?.click();

    const [, props] = stub.mock.calls.find(([name]) => name === 'order_placed')!;
    expect(props.promo_code).toBe('clumsy15');
  });
});
