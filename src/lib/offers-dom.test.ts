// Offers screen rendering tests — docs/design/87-promo-offers-and-flash.md
// (AC1, AC2, AC5). Uses the same "hand every init function its own Storage"
// pattern the rest of the DOM tests use (flow.test.ts), threading a real
// cart through order-store.ts rather than stubbing it.

import { beforeEach, describe, expect, it } from 'vitest';
import { renderOffers } from './offers-dom';
import { addToCart } from './order-store';
import { setFlashDraw } from './flash-deal';
import { formatMoney } from './money';

const HCMC_LINE = {
  itemId: 'ben-thanh-banh-mi-thit-nuong',
  restaurantSlug: 'ben-thanh-banh-mi',
  restaurantName: 'Bến Thành Bánh Mì',
  name: 'Bánh mì thịt nướng',
  amountMinor: 250000,
  currency: 'VND' as const,
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

function root(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('renderOffers — HCMC ₫250.000 worked example (AC1, AC2)', () => {
  beforeEach(() => {
    addToCart(window.localStorage, HCMC_LINE);
  });

  it('shows t2 and the delivery entry checked, t1 qualifying-but-unchecked, t3 greyed with its exact nudge', () => {
    const el = root();
    renderOffers(el, window.localStorage, window.sessionStorage);

    expect(el.querySelector<HTMLInputElement>('[data-testid="voucher-checkbox-hcmc-discount-t2"]')?.checked).toBe(
      true,
    );
    expect(
      el.querySelector<HTMLInputElement>('[data-testid="voucher-checkbox-hcmc-delivery-entry"]')?.checked,
    ).toBe(true);
    expect(
      el.querySelector<HTMLInputElement>('[data-testid="voucher-checkbox-hcmc-discount-t1"]')?.checked,
    ).toBe(false);
    expect(
      el.querySelector<HTMLInputElement>('[data-testid="voucher-checkbox-hcmc-discount-t1"]')?.disabled,
    ).toBe(false);

    const t3Checkbox = el.querySelector<HTMLInputElement>('[data-testid="voucher-checkbox-hcmc-discount-t3"]');
    expect(t3Checkbox?.disabled).toBe(true);
    expect(el.querySelector('[data-testid="voucher-nudge-hcmc-discount-t3"]')?.textContent).toBe(
      `Spend ${formatMoney(100000, 'VND')} more to enjoy this offer`,
    );
  });

  it('every control is a checkbox or a button — no typed field anywhere (AC5)', () => {
    const el = root();
    renderOffers(el, window.localStorage, window.sessionStorage);
    expect(el.querySelectorAll('input:not([type="checkbox"]), textarea').length).toBe(0);
  });

  it('checking t1 unchecks t2 (one per stack group), and leaves the delivery group untouched', () => {
    const el = root();
    renderOffers(el, window.localStorage, window.sessionStorage);

    el.querySelector<HTMLInputElement>('[data-testid="voucher-checkbox-hcmc-discount-t1"]')?.click();

    expect(el.querySelector<HTMLInputElement>('[data-testid="voucher-checkbox-hcmc-discount-t1"]')?.checked).toBe(
      true,
    );
    expect(el.querySelector<HTMLInputElement>('[data-testid="voucher-checkbox-hcmc-discount-t2"]')?.checked).toBe(
      false,
    );
    expect(
      el.querySelector<HTMLInputElement>('[data-testid="voucher-checkbox-hcmc-delivery-entry"]')?.checked,
    ).toBe(true);
  });

  it('the footer names the sum of the applied discount voucher and the restaurant’s own waived delivery fee', () => {
    const el = root();
    renderOffers(el, window.localStorage, window.sessionStorage);
    // ben-thanh-banh-mi's own normal delivery fee is ₫10.000 (restaurants.ts) — the doc's worked example uses a
    // different mock restaurant with a ₫15.000 fee; this cart's own arithmetic is 25.000 (t2) + 10.000 (delivery) = 35.000.
    expect(el.querySelector('[data-testid="offers-saved"]')?.textContent).toBe(
      `You saved ${formatMoney(35000, 'VND')}`,
    );
  });
});

describe('renderOffers — SF $21.50 worked example (AC1)', () => {
  beforeEach(() => {
    addToCart(window.localStorage, SF_LINE);
  });

  it('shows the exact nudges for t2 and t3', () => {
    const el = root();
    renderOffers(el, window.localStorage, window.sessionStorage);

    expect(el.querySelector('[data-testid="voucher-nudge-sf-discount-t2"]')?.textContent).toBe(
      `Spend ${formatMoney(1850, 'USD')} more to enjoy this offer`,
    );
    expect(el.querySelector('[data-testid="voucher-nudge-sf-discount-t3"]')?.textContent).toBe(
      `Spend ${formatMoney(3850, 'USD')} more to enjoy this offer`,
    );
  });
});

describe('renderOffers — drop-below-minimum removes an applied voucher (AC1)', () => {
  it('re-syncs against a cart change made elsewhere (the Cart page) between two Offers-screen mounts', () => {
    addToCart(window.localStorage, HCMC_LINE);
    const first = root();
    renderOffers(first, window.localStorage, window.sessionStorage);
    expect(first.querySelector<HTMLInputElement>('[data-testid="voucher-checkbox-hcmc-discount-t2"]')?.checked).toBe(
      true,
    );

    // Simulate removing a ₫60.000 item on the Cart page: swap the stored cart for one totalling ₫190.000.
    window.localStorage.setItem('parody.cart', JSON.stringify([{ ...HCMC_LINE, amountMinor: 190000, quantity: 1 }]));

    const second = root();
    renderOffers(second, window.localStorage, window.sessionStorage);
    // Moved back into the greyed section: still rendered, but unchecked and disabled.
    const t2Checkbox = second.querySelector<HTMLInputElement>('[data-testid="voucher-checkbox-hcmc-discount-t2"]');
    expect(t2Checkbox?.checked).toBe(false);
    expect(t2Checkbox?.disabled).toBe(true);
    expect(second.querySelector('[data-testid="voucher-nudge-hcmc-discount-t2"]')?.textContent).toBe(
      `Spend ${formatMoney(10000, 'VND')} more to enjoy this offer`,
    );
    expect(
      second.querySelector<HTMLInputElement>('[data-testid="voucher-checkbox-hcmc-discount-t1"]')?.checked,
    ).toBe(false); // not auto-reselected — matches the doc's own worked error scenario
  });
});

describe('renderOffers — the flash voucher (AC2, AC4)', () => {
  it('a larger live flash draw beats t2 and is the one auto-selected', () => {
    addToCart(window.localStorage, HCMC_LINE);
    setFlashDraw(window.sessionStorage, 'hcmc', {
      drawnAt: Date.now(),
      amountMinor: 30000,
      restaurants: [
        { slug: 'ben-thanh-banh-mi', feeMode: 'free' },
        { slug: 'saigon-pho-quan', feeMode: 'reduced' },
      ],
    });

    const el = root();
    renderOffers(el, window.localStorage, window.sessionStorage);

    expect(el.querySelector<HTMLInputElement>('[data-testid="voucher-checkbox-hcmc-flash"]')?.checked).toBe(true);
    expect(el.querySelector<HTMLInputElement>('[data-testid="voucher-checkbox-hcmc-discount-t2"]')?.checked).toBe(
      false,
    );
    expect(el.querySelector('[data-testid="voucher-row-hcmc-flash"]')?.querySelector('.flash-tag')).not.toBeNull();
  });

  it('the flash row disappears once its window has ended, rather than showing greyed', () => {
    addToCart(window.localStorage, HCMC_LINE);
    setFlashDraw(window.sessionStorage, 'hcmc', {
      drawnAt: Date.now() - 16 * 60 * 1000, // 16 minutes ago — past the 15:00 window
      amountMinor: 30000,
      restaurants: [
        { slug: 'ben-thanh-banh-mi', feeMode: 'free' },
        { slug: 'saigon-pho-quan', feeMode: 'reduced' },
      ],
    });

    const el = root();
    renderOffers(el, window.localStorage, window.sessionStorage);

    expect(el.querySelector('[data-testid="voucher-row-hcmc-flash"]')).toBeNull();
  });
});
