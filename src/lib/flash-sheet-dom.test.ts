// Flash-deal sheet rendering tests — docs/design/
// 87-promo-offers-and-flash.md, "The flash-deal sheet" (AC4, AC6).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderFlashReopenBar, renderFlashSheet } from './flash-sheet-dom';
import { resetTrack, setTrack } from './tracking';
import type { FlashDraw } from './flash-deal';
import { formatMoneyForCity } from './money';

const DRAW: FlashDraw = {
  drawnAt: 0,
  amountMinor: 15000,
  restaurants: [
    { slug: 'ben-thanh-banh-mi', feeMode: 'free' },
    { slug: 'saigon-pho-quan', feeMode: 'reduced' },
    { slug: 'com-tam-quan-nha', feeMode: 'free' },
    { slug: 'bun-cha-co-ba', feeMode: 'reduced' },
    { slug: 'hu-tieu-nam-vang-hoa-phat', feeMode: 'free' },
    { slug: 'goi-cuon-co-hai-cho-cu', feeMode: 'reduced' },
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

  it('each drawn restaurant shows a thumbnail with a "Deal" sticker (AC4)', () => {
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, vi.fn(), () => Date.now());
    const row = el.querySelector('[data-testid="flash-restaurant-ben-thanh-banh-mi"]');
    const photo = row?.querySelector('.restaurant-photo');
    expect(photo?.querySelector('img')?.getAttribute('src')).toBeTruthy();
    expect(photo?.querySelector('.deal-sticker')?.textContent).toBe('Deal');
  });

  it('the countdown is split into MM/SS tiles around a separator (AC4)', () => {
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, vi.fn(), () => Date.now());
    const countdown = el.querySelector('[data-testid="flash-sheet-countdown"]');
    const tiles = countdown?.querySelectorAll('.tile');
    expect(Array.from(tiles ?? []).map((tile) => tile.textContent)).toEqual(['15', '00']);
    expect(countdown?.querySelector('.tile-sep')?.textContent).toBe(':');
  });

  it('the countdown ticks down as the fake clock advances', () => {
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, vi.fn(), () => Date.now());
    vi.advanceTimersByTime(60_000);
    expect(el.querySelector('[data-testid="flash-sheet-countdown"]')?.textContent).toBe('14:00');
  });

  it('renders one row per drawn restaurant, 5–6 of them for a Grab-sized draw (AC1)', () => {
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, vi.fn(), () => Date.now());
    const rows = el.querySelectorAll('.restaurant-row');
    expect(rows.length).toBe(DRAW.restaurants.length);
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(rows.length).toBeLessThanOrEqual(6);
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

describe('renderFlashSheet — onDismissed, the collapse trigger (AC2, AC3)', () => {
  it('a dismissal via the scrim, "×", or the drag handle calls onDismissed', () => {
    for (const testid of ['flash-sheet-scrim', 'flash-sheet-close', 'flash-sheet-drag-handle']) {
      const onDismissed = vi.fn();
      const el = root();
      renderFlashSheet(el, 'hcmc', DRAW, vi.fn(), () => Date.now(), { onDismissed });
      el.querySelector<HTMLElement>(`[data-testid="${testid}"]`)?.click();
      expect(onDismissed).toHaveBeenCalledTimes(1);
    }
  });

  it('an expired close never calls onDismissed — an open sheet does not collapse into a bar (AC3)', () => {
    const onDismissed = vi.fn();
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, vi.fn(), () => Date.now(), { onDismissed });

    vi.advanceTimersByTime(15 * 60 * 1000);

    expect(onDismissed).not.toHaveBeenCalled();
  });

  it('tapping a restaurant row never calls onDismissed', () => {
    const onDismissed = vi.fn();
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, vi.fn(), () => Date.now(), { onDismissed });

    el.querySelector<HTMLElement>('[data-testid="flash-restaurant-ben-thanh-banh-mi"]')?.click();

    expect(onDismissed).not.toHaveBeenCalled();
  });

  it('eventAlreadyFired suppresses flash_sheet_closed on a reopened sheet’s own close (AC7)', () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, vi.fn(), () => Date.now(), { eventAlreadyFired: true });

    el.querySelector<HTMLElement>('[data-testid="flash-sheet-close"]')?.click();

    expect(stub.mock.calls.filter(([name]) => name === 'flash_sheet_closed')).toHaveLength(0);
  });
});

describe('renderFlashReopenBar — the collapsed state (AC2, AC3)', () => {
  it('shows the amount and a live mm:ss that ticks every second', () => {
    const el = root();
    renderFlashReopenBar(el, 'hcmc', DRAW, vi.fn(), () => Date.now());

    expect(el.querySelector('[data-testid="flash-reopen-bar"]')?.textContent).toContain(
      `${formatMoneyForCity(15000, 'hcmc')} off flash deals`,
    );
    expect(el.querySelector('[data-testid="flash-reopen-bar-countdown"]')?.textContent).toBe('15:00');

    vi.advanceTimersByTime(60_000);
    expect(el.querySelector('[data-testid="flash-reopen-bar-countdown"]')?.textContent).toBe('14:00');
  });

  it('tapping the bar removes it and calls onReopen — the sheet reopens', () => {
    const onReopen = vi.fn();
    const el = root();
    renderFlashReopenBar(el, 'hcmc', DRAW, onReopen, () => Date.now());

    el.querySelector<HTMLElement>('[data-testid="flash-reopen-bar"]')?.click();

    expect(onReopen).toHaveBeenCalledTimes(1);
    expect(el.querySelector('[data-testid="flash-reopen-bar"]')).toBeNull();
  });

  it('the window ending while collapsed removes the bar on its own, firing nothing (AC3, AC7)', () => {
    const stub = vi.fn();
    setTrack(stub);
    const onReopen = vi.fn();
    const el = root();
    renderFlashReopenBar(el, 'hcmc', DRAW, onReopen, () => Date.now());

    vi.advanceTimersByTime(15 * 60 * 1000);

    expect(el.querySelector('[data-testid="flash-reopen-bar"]')).toBeNull();
    expect(onReopen).not.toHaveBeenCalled();
    expect(stub).not.toHaveBeenCalled();
  });
});

describe('the dismiss → collapse → reopen → close-again flow fires the event once (AC7)', () => {
  it('never fires flash_sheet_closed a second time across a full reopen', () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    let eventAlreadyFired = false;

    function openSheet(): void {
      renderFlashSheet(el, 'hcmc', DRAW, vi.fn(), () => Date.now(), {
        eventAlreadyFired,
        onDismissed: () => {
          eventAlreadyFired = true;
          renderFlashReopenBar(el, 'hcmc', DRAW, openSheet, () => Date.now());
        },
      });
    }

    openSheet();
    el.querySelector<HTMLElement>('[data-testid="flash-sheet-scrim"]')?.click(); // first dismissal: fires, collapses
    el.querySelector<HTMLElement>('[data-testid="flash-reopen-bar"]')?.click(); // tap to reopen
    el.querySelector<HTMLElement>('[data-testid="flash-sheet-scrim"]')?.click(); // dismissed again: no event

    expect(stub.mock.calls.filter(([name]) => name === 'flash_sheet_closed')).toHaveLength(1);
  });
});
