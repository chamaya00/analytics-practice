// Flash-deal sheet rendering tests — docs/design/
// 87-promo-offers-and-flash.md, "The flash-deal sheet" (AC4, AC6).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SHEET_DISMISS_THRESHOLD_PX,
  SHEET_DISMISS_VELOCITY_PX_MS,
  renderFlashReopenBar,
  renderFlashSheet,
  sheetDragDirection,
  sheetDragOffset,
  shouldDismissSheet,
} from './flash-sheet-dom';
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
  it('shows the title, subtitle, a 15:00 countdown under "Ends in", and both drawn restaurants', () => {
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, 'visitor-1', vi.fn(), () => Date.now());

    expect(el.querySelector('.sheet-header h1')?.textContent).toBe('Flash deals');
    expect(el.querySelector('.sheet-subtitle')?.textContent).toBe(
      `${formatMoneyForCity(15000, 'hcmc')} off orders over ${formatMoneyForCity(80000, 'hcmc')}`,
    );
    expect(el.querySelector('.countdown-label')?.textContent).toBe('Ends in');
    expect(el.querySelector('[data-testid="flash-sheet-countdown"]')?.textContent).toBe('15:00');
    expect(el.querySelector('.min-spend-line')).toBeNull(); // #126 AC5: folded into the subtitle
    expect(el.querySelector('[data-testid="flash-restaurant-ben-thanh-banh-mi"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="flash-restaurant-saigon-pho-quan"]')).not.toBeNull();
  });

  it('a free-mode restaurant shows "Free delivery" with the original fee struck through (#126 AC5)', () => {
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, 'visitor-1', vi.fn(), () => Date.now());
    const fee = el.querySelector('[data-testid="flash-restaurant-ben-thanh-banh-mi"] .restaurant-fee');
    expect(fee?.textContent).toContain('Free delivery');
    expect(fee?.textContent).toContain(formatMoneyForCity(10000, 'hcmc')); // ben-thanh-banh-mi's own normal fee
  });

  it('a reduced-mode restaurant shows "X delivery" with the original fee struck through (#126 AC5)', () => {
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, 'visitor-1', vi.fn(), () => Date.now());
    const fee = el.querySelector('[data-testid="flash-restaurant-saigon-pho-quan"] .restaurant-fee');
    expect(fee?.textContent).toContain(`${formatMoneyForCity(5000, 'hcmc')} delivery`); // 15.000 - 10.000
    expect(fee?.textContent).toContain(formatMoneyForCity(15000, 'hcmc')); // saigon-pho-quan's own normal fee
  });

  it('a restaurant whose normal fee is already 0 shows "Free delivery" with no struck-through amount (#126 AC4)', () => {
    const draw: FlashDraw = { ...DRAW, restaurants: [{ slug: 'ca-phe-nha-go-18', feeMode: 'reduced' }] };
    const el = root();
    renderFlashSheet(el, 'hcmc', draw, 'visitor-1', vi.fn(), () => Date.now());
    const fee = el.querySelector('[data-testid="flash-restaurant-ca-phe-nha-go-18"] .restaurant-fee');
    expect(fee?.textContent).toBe('Free delivery');
    expect(fee?.querySelector('.original')).toBeNull();
  });

  it('the close button carries the required aria-label (#126 AC2)', () => {
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, 'visitor-1', vi.fn(), () => Date.now());
    expect(el.querySelector('[data-testid="flash-sheet-close"]')?.getAttribute('aria-label')).toBe('Close flash deals');
  });

  it('each drawn restaurant shows a thumbnail with a "Deal" sticker (AC4)', () => {
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, 'visitor-1', vi.fn(), () => Date.now());
    const row = el.querySelector('[data-testid="flash-restaurant-ben-thanh-banh-mi"]');
    const photo = row?.querySelector('.restaurant-photo');
    expect(photo?.querySelector('img')?.getAttribute('src')).toBeTruthy();
    expect(photo?.querySelector('.deal-sticker')?.textContent).toBe('Deal');
  });

  it('the countdown is split into MM/SS tiles around a separator (AC4)', () => {
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, 'visitor-1', vi.fn(), () => Date.now());
    const countdown = el.querySelector('[data-testid="flash-sheet-countdown"]');
    const tiles = countdown?.querySelectorAll('.tile');
    expect(Array.from(tiles ?? []).map((tile) => tile.textContent)).toEqual(['15', '00']);
    expect(countdown?.querySelector('.tile-sep')?.textContent).toBe(':');
  });

  it('the countdown ticks down as the fake clock advances', () => {
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, 'visitor-1', vi.fn(), () => Date.now());
    vi.advanceTimersByTime(60_000);
    expect(el.querySelector('[data-testid="flash-sheet-countdown"]')?.textContent).toBe('14:00');
  });

  it('renders one row per drawn restaurant, 5–6 of them for a Grab-sized draw (AC1)', () => {
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, 'visitor-1', vi.fn(), () => Date.now());
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
    renderFlashSheet(el, 'hcmc', DRAW, 'visitor-1', vi.fn(), () => Date.now());

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
    renderFlashSheet(el, 'hcmc', DRAW, 'visitor-1', navigate, () => Date.now());

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
    renderFlashSheet(el, 'hcmc', DRAW, 'visitor-1', vi.fn(), () => Date.now());

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
    const handle = renderFlashSheet(el, 'hcmc', DRAW, 'visitor-1', vi.fn(), () => Date.now());

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
      renderFlashSheet(el, 'hcmc', DRAW, 'visitor-1', vi.fn(), () => Date.now(), { onDismissed });
      el.querySelector<HTMLElement>(`[data-testid="${testid}"]`)?.click();
      expect(onDismissed).toHaveBeenCalledTimes(1);
    }
  });

  it('an expired close never calls onDismissed — an open sheet does not collapse into a bar (AC3)', () => {
    const onDismissed = vi.fn();
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, 'visitor-1', vi.fn(), () => Date.now(), { onDismissed });

    vi.advanceTimersByTime(15 * 60 * 1000);

    expect(onDismissed).not.toHaveBeenCalled();
  });

  it('tapping a restaurant row never calls onDismissed', () => {
    const onDismissed = vi.fn();
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, 'visitor-1', vi.fn(), () => Date.now(), { onDismissed });

    el.querySelector<HTMLElement>('[data-testid="flash-restaurant-ben-thanh-banh-mi"]')?.click();

    expect(onDismissed).not.toHaveBeenCalled();
  });

  it('eventAlreadyFired suppresses flash_sheet_closed on a reopened sheet’s own close (AC7)', () => {
    const stub = vi.fn();
    setTrack(stub);
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, 'visitor-1', vi.fn(), () => Date.now(), { eventAlreadyFired: true });

    el.querySelector<HTMLElement>('[data-testid="flash-sheet-close"]')?.click();

    expect(stub.mock.calls.filter(([name]) => name === 'flash_sheet_closed')).toHaveLength(0);
  });
});

describe('renderFlashReopenBar — the collapsed state (AC2, AC3)', () => {
  it('shows "Flash deals · X off", "Ends in", and a live mm:ss that ticks every second (#126 AC5)', () => {
    const el = root();
    renderFlashReopenBar(el, 'hcmc', DRAW, vi.fn(), () => Date.now());

    expect(el.querySelector('.label')?.textContent).toBe(`Flash deals · ${formatMoneyForCity(15000, 'hcmc')} off`);
    expect(el.querySelector('.countdown-label')?.textContent).toBe('Ends in');
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
      renderFlashSheet(el, 'hcmc', DRAW, 'visitor-1', vi.fn(), () => Date.now(), {
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

describe('sheetDragDirection — pending inside the slop, down only when net-downward and more vertical than horizontal (#126 AC1)', () => {
  it('is pending inside the slop on both axes', () => {
    expect(sheetDragDirection(0, 0)).toBe('pending');
    expect(sheetDragDirection(5, -5)).toBe('pending');
  });

  it('is "down" once a mostly-downward drag passes the slop', () => {
    expect(sheetDragDirection(0, 20)).toBe('down');
    expect(sheetDragDirection(5, 20)).toBe('down');
  });

  it('is "ignored" for an upward drag, however far', () => {
    expect(sheetDragDirection(0, -50)).toBe('ignored');
  });

  it('is "ignored" for a horizontal or diagonal-horizontal drag', () => {
    expect(sheetDragDirection(50, 0)).toBe('ignored');
    expect(sheetDragDirection(40, 20)).toBe('ignored');
  });
});

describe('sheetDragOffset — follows the finger down only (#126 AC1)', () => {
  it('tracks a downward dy one-to-one', () => {
    expect(sheetDragOffset(40)).toBe(40);
  });

  it('clamps an upward dy at 0 rather than lifting the sheet', () => {
    expect(sheetDragOffset(-30)).toBe(0);
  });
});

describe('shouldDismissSheet — past the distance threshold, or a fast enough flick (#126 AC1)', () => {
  it('dismisses once released past the distance threshold, even at zero velocity', () => {
    expect(shouldDismissSheet(SHEET_DISMISS_THRESHOLD_PX - 1, 0)).toBe(false);
    expect(shouldDismissSheet(SHEET_DISMISS_THRESHOLD_PX, 0)).toBe(true);
  });

  it('dismisses on a fast flick even far short of the distance threshold', () => {
    expect(shouldDismissSheet(20, SHEET_DISMISS_VELOCITY_PX_MS - 0.01)).toBe(false);
    expect(shouldDismissSheet(20, SHEET_DISMISS_VELOCITY_PX_MS)).toBe(true);
  });

  it('honours explicit thresholds', () => {
    expect(shouldDismissSheet(49, 0, 50)).toBe(false);
    expect(shouldDismissSheet(50, 0, 50)).toBe(true);
  });
});

describe('renderFlashSheet — swipe-to-dismiss wiring with synthetic Pointer Events (#126 AC1)', () => {
  function pointer(target: EventTarget, type: string, clientY: number, clientX = 0): void {
    target.dispatchEvent(
      new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', clientX, clientY }),
    );
  }

  it('the sheet follows the finger while dragging the handle down, with no transition class while dragging', () => {
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, 'visitor-1', vi.fn(), () => Date.now());
    const handle = el.querySelector<HTMLElement>('[data-testid="flash-sheet-drag-handle"]')!;
    const panel = el.querySelector<HTMLElement>('.sheet')!;

    pointer(handle, 'pointerdown', 0);
    pointer(handle, 'pointermove', 40);

    expect(panel.classList.contains('is-dragging')).toBe(true);
    expect(panel.style.transform).toBe('translateY(40px)');
  });

  it('releasing past the 96px threshold dismisses the sheet, collapse-into-bar outcome dismissed, once per draw', () => {
    const stub = vi.fn();
    setTrack(stub);
    const onDismissed = vi.fn();
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, 'visitor-1', vi.fn(), () => Date.now(), { onDismissed });
    const handle = el.querySelector<HTMLElement>('[data-testid="flash-sheet-drag-handle"]')!;

    pointer(handle, 'pointerdown', 0);
    vi.advanceTimersByTime(1000); // slow drag: distance triggers dismissal, not velocity
    pointer(handle, 'pointermove', 120);
    pointer(handle, 'pointerup', 120);

    expect(el.querySelector('[data-testid="flash-sheet"]')).toBeNull();
    expect(onDismissed).toHaveBeenCalledTimes(1);
    expect(stub.mock.calls.filter(([name]) => name === 'flash_sheet_closed')).toHaveLength(1);
    expect(stub).toHaveBeenCalledWith('flash_sheet_closed', {
      city: 'hcmc',
      outcome: 'dismissed',
      seconds_remaining: 899, // 1 second of fake time advanced during the drag
      restaurant_slug: 'none',
    });
  });

  it('a fast downward flick dismisses well short of the 96px threshold', () => {
    const onDismissed = vi.fn();
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, 'visitor-1', vi.fn(), () => Date.now(), { onDismissed });
    const handle = el.querySelector<HTMLElement>('[data-testid="flash-sheet-drag-handle"]')!;

    pointer(handle, 'pointerdown', 0);
    pointer(handle, 'pointermove', 20); // exceeds slop, no time elapsed: high instantaneous velocity
    pointer(handle, 'pointerup', 20);

    expect(onDismissed).toHaveBeenCalledTimes(1);
  });

  it('releasing short of the threshold at low velocity snaps back without dismissing', () => {
    const onDismissed = vi.fn();
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, 'visitor-1', vi.fn(), () => Date.now(), { onDismissed });
    const handle = el.querySelector<HTMLElement>('[data-testid="flash-sheet-drag-handle"]')!;
    const panel = el.querySelector<HTMLElement>('.sheet')!;

    pointer(handle, 'pointerdown', 0);
    vi.advanceTimersByTime(500);
    pointer(handle, 'pointermove', 30); // below the 96px threshold, and 30px/500ms is far under the velocity threshold
    pointer(handle, 'pointerup', 30);

    expect(onDismissed).not.toHaveBeenCalled();
    expect(el.querySelector('[data-testid="flash-sheet"]')).not.toBeNull();
    expect(panel.classList.contains('is-dragging')).toBe(false);
    expect(panel.style.transform).toBe('');
  });

  it('an upward drag on the handle does nothing', () => {
    const onDismissed = vi.fn();
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, 'visitor-1', vi.fn(), () => Date.now(), { onDismissed });
    const handle = el.querySelector<HTMLElement>('[data-testid="flash-sheet-drag-handle"]')!;
    const panel = el.querySelector<HTMLElement>('.sheet')!;

    pointer(handle, 'pointerdown', 100);
    pointer(handle, 'pointermove', 20);
    pointer(handle, 'pointerup', 20);

    expect(onDismissed).not.toHaveBeenCalled();
    expect(panel.style.transform).toBe('');
  });

  it('a horizontal drag on the handle does nothing', () => {
    const onDismissed = vi.fn();
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, 'visitor-1', vi.fn(), () => Date.now(), { onDismissed });
    const handle = el.querySelector<HTMLElement>('[data-testid="flash-sheet-drag-handle"]')!;
    const panel = el.querySelector<HTMLElement>('.sheet')!;

    pointer(handle, 'pointerdown', 0, 0);
    pointer(handle, 'pointermove', 0, 80);
    pointer(handle, 'pointerup', 0, 80);

    expect(onDismissed).not.toHaveBeenCalled();
    expect(panel.style.transform).toBe('');
  });

  it('dragging the header down past the threshold dismisses the sheet too', () => {
    const onDismissed = vi.fn();
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, 'visitor-1', vi.fn(), () => Date.now(), { onDismissed });
    const header = el.querySelector<HTMLElement>('.sheet-header')!;

    pointer(header, 'pointerdown', 0);
    vi.advanceTimersByTime(1000);
    pointer(header, 'pointermove', 120);
    pointer(header, 'pointerup', 120);

    expect(onDismissed).toHaveBeenCalledTimes(1);
  });

  it('a drag that snaps back does not also trigger the handle\'s own click-to-dismiss afterwards', () => {
    const onDismissed = vi.fn();
    const el = root();
    renderFlashSheet(el, 'hcmc', DRAW, 'visitor-1', vi.fn(), () => Date.now(), { onDismissed });
    const handle = el.querySelector<HTMLElement>('[data-testid="flash-sheet-drag-handle"]')!;

    pointer(handle, 'pointerdown', 0);
    vi.advanceTimersByTime(500);
    pointer(handle, 'pointermove', 30);
    pointer(handle, 'pointerup', 30);
    handle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));

    expect(onDismissed).not.toHaveBeenCalled();
  });
});
