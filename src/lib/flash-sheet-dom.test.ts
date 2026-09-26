// Flash-deal sheet rendering tests — docs/design/
// 87-promo-offers-and-flash.md, "The flash-deal sheet" (AC4, AC6).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderFlashSheet } from './flash-sheet-dom';
import { resetTrack, setTrack } from './tracking';
import type { FlashDraw } from './flash-deal';
import { formatMoneyForCity } from './money';

const DRAW: FlashDraw = {
  drawnAt: 0,
  amountMinor: 15000,
  restaurants: [
    { slug: 'ben-thanh-banh-mi', feeMode: 'free' },
    { slug: 'saigon-pho-quan', feeMode: 'reduced' },
  ],
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  resetTrack();
  vi.useRealTimers();
});

function root(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('renderFlashSheet — anatomy (AC4)', () => {
  it('shows the drawn amount, a 15:00 countdown, the min-spend line, and both drawn restaurants', () => {
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, vi.fn(), () => Date.now());

    expect(el.querySelector('.sheet-header h1')?.textContent).toBe(`${formatMoneyForCity(15000, 'hcmc')} off flash deals`);
    expect(el.querySelector('[data-testid="flash-sheet-countdown"]')?.textContent).toBe('15:00');
    expect(el.querySelector('.min-spend-line')?.textContent).toContain(formatMoneyForCity(80000, 'hcmc'));
    expect(el.querySelector('[data-testid="flash-restaurant-ben-thanh-banh-mi"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="flash-restaurant-saigon-pho-quan"]')).not.toBeNull();
  });

  it('a free-mode restaurant shows "Free" with the original fee struck through', () => {
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, vi.fn(), () => Date.now());
    const fee = el.querySelector('[data-testid="flash-restaurant-ben-thanh-banh-mi"] .restaurant-fee');
    expect(fee?.textContent).toContain('Free');
    expect(fee?.textContent).toContain(formatMoneyForCity(10000, 'hcmc')); // ben-thanh-banh-mi's own normal fee
  });

  it('the countdown ticks down as the fake clock advances', () => {
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, vi.fn(), () => Date.now());
    vi.advanceTimersByTime(60_000);
    expect(el.querySelector('[data-testid="flash-sheet-countdown"]')?.textContent).toBe('14:00');
  });
});

describe('renderFlashSheet — dismissal and its event (AC4, AC6)', () => {
  it('tapping the scrim closes the sheet and fires flash_sheet_closed with outcome dismissed', () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, vi.fn(), () => Date.now());

    vi.advanceTimersByTime(30_000); // 30s in
    el.querySelector<HTMLElement>('[data-testid="flash-sheet-scrim"]')?.click();

    expect(el.querySelector('[data-testid="flash-sheet"]')).toBeNull();
    expect(stub).toHaveBeenCalledWith('flash_sheet_closed', {
      city: 'hcmc',
      outcome: 'dismissed',
      seconds_remaining: 870,
      restaurant_slug: 'none',
    });
  });

  it('tapping a restaurant row closes the sheet, navigates to it, and fires outcome restaurant_tapped with its slug', () => {
    const stub = vi.fn();
    setTrack(stub);
    const navigate = vi.fn();
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, navigate, () => Date.now());

    el.querySelector<HTMLElement>('[data-testid="flash-restaurant-saigon-pho-quan"]')?.click();

    expect(navigate).toHaveBeenCalledWith('/restaurants/saigon-pho-quan/');
    expect(stub).toHaveBeenCalledWith('flash_sheet_closed', {
      city: 'hcmc',
      outcome: 'restaurant_tapped',
      seconds_remaining: 900,
      restaurant_slug: 'saigon-pho-quan',
    });
  });

  it('the countdown reaching 00:00 auto-closes the sheet with outcome expired', () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, vi.fn(), () => Date.now());

    vi.advanceTimersByTime(15 * 60 * 1000);

    expect(el.querySelector('[data-testid="flash-sheet"]')).toBeNull();
    expect(stub).toHaveBeenCalledWith('flash_sheet_closed', {
      city: 'hcmc',
      outcome: 'expired',
      seconds_remaining: 0,
      restaurant_slug: 'none',
    });
  });

  it('fires flash_sheet_closed exactly once even if closed twice', () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    const handle = renderFlashSheet(el, 'hcmc', DRAW, vi.fn(), () => Date.now());

    el.querySelector<HTMLElement>('[data-testid="flash-sheet-close"]')?.click();
    handle.expire();

    expect(stub.mock.calls.filter(([name]) => name === 'flash_sheet_closed')).toHaveLength(1);
  });
});
