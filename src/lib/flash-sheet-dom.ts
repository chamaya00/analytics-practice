// The flash-deal bottom sheet (docs/design/119-flash-sheet-tall-and-
// collapsed-bar.md, superseding the short two-row card at docs/design/
// 87-flash-sheet-hcmc.html): drag handle, a full-bleed header with the drawn
// amount and a live mm:ss countdown, the minimum-spend line, and a scrolling
// list of the draw's 5–6 restaurants — dismissible by the handle, the scrim,
// the "×", or tapping a restaurant row, and auto-closing at 00:00.
// `flash_sheet_closed` fires exactly once per draw (contract §7's "at most
// one per flash_sheet_shown"), tracked via `options.eventAlreadyFired` so a
// sheet reopened from the collapsed bar (below) never fires it twice.
//
// Dismissal (scrim/×/drag handle, not a restaurant tap or expiry) collapses
// the sheet into `renderFlashReopenBar`'s pinned bar rather than discarding
// it outright — #120 AC2/AC3. The caller (home-dom.ts) owns persisting that
// collapsed state alongside the draw so it survives a reload.

import { formatMoneyForCity, type City } from './money';
import { getRestaurant } from './restaurants';
import { estimateEtaMinutes, etaLabel } from './eta';
import { track } from './tracking';
import { flashFeeForRestaurant, flashSecondsRemaining, type FlashDraw } from './flash-deal';
import { FLASH_MINIMUM_SPEND_MINOR, formatCountdown } from './vouchers';

export type FlashCloseOutcome = 'restaurant_tapped' | 'dismissed' | 'expired';

export interface FlashSheetHandle {
  /** Closes the sheet as if the countdown had reached zero — used by the home feed once it independently learns the window has ended. */
  expire(): void;
}

export interface FlashSheetOptions {
  /** True once `flash_sheet_closed` has already fired for this draw (a reopen from the collapsed bar) — closing again still runs the rest of `close()` (collapsing again on a `dismissed` outcome) but never fires the event a second time (AC7). */
  eventAlreadyFired?: boolean;
  /** Called after a `dismissed` close only — not `restaurant_tapped` (navigates away) or `expired` (AC3: an expired sheet never collapses). The caller uses this to persist the collapsed state and show the reopen bar. */
  onDismissed?: () => void;
}

export function renderFlashSheet(
  root: HTMLElement,
  city: City,
  draw: FlashDraw,
  visitorId: string,
  navigate: (path: string) => void = (path) => {
    window.location.href = path;
  },
  now: () => number = Date.now,
  options: FlashSheetOptions = {},
): FlashSheetHandle {
  const overlay = document.createElement('div');
  overlay.className = 'flash-sheet-overlay';
  overlay.setAttribute('data-testid', 'flash-sheet');

  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.setAttribute('data-testid', 'flash-sheet-scrim');

  const panel = document.createElement('div');
  panel.className = 'sheet';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'sheet-close';
  closeButton.setAttribute('data-testid', 'flash-sheet-close');
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round"/></svg>';

  const dragHandle = document.createElement('button');
  dragHandle.type = 'button';
  dragHandle.className = 'drag-handle';
  dragHandle.setAttribute('data-testid', 'flash-sheet-drag-handle');
  dragHandle.setAttribute('aria-label', 'Dismiss');

  const header = document.createElement('div');
  header.className = 'sheet-header';
  const heading = document.createElement('h1');
  heading.textContent = `${formatMoneyForCity(draw.amountMinor, city)} off flash deals`;
  const countdown = document.createElement('div');
  countdown.className = 'countdown';
  countdown.setAttribute('data-testid', 'flash-sheet-countdown');
  header.append(heading, countdown);

  const minSpendLine = document.createElement('p');
  minSpendLine.className = 'min-spend-line';
  minSpendLine.textContent = `Order now with min. spend ${formatMoneyForCity(FLASH_MINIMUM_SPEND_MINOR[city], city)}`;

  // Its own class, not home-dom.ts's `.restaurant-list` — that global rule
  // sets a margin/gap meant for the home feed's card list, which leaked
  // into this scrolling region and doubled its row spacing before this was
  // split out (found rendering the tall sheet, #120).
  const list = document.createElement('div');
  list.className = 'deal-list';

  let closed = false;
  let intervalId: ReturnType<typeof setInterval> | undefined;

  function close(outcome: FlashCloseOutcome, restaurantSlug?: string): void {
    if (closed) return;
    closed = true;
    if (intervalId !== undefined) clearInterval(intervalId);
    if (!options.eventAlreadyFired) {
      track('flash_sheet_closed', {
        city,
        outcome,
        seconds_remaining: flashSecondsRemaining(draw, now()),
        restaurant_slug: outcome === 'restaurant_tapped' ? (restaurantSlug ?? 'none') : 'none',
      });
    }
    overlay.remove();
    if (outcome === 'dismissed') options.onDismissed?.();
  }

  scrim.addEventListener('click', () => close('dismissed'));
  closeButton.addEventListener('click', () => close('dismissed'));
  dragHandle.addEventListener('click', () => close('dismissed'));

  for (const drawn of draw.restaurants) {
    const restaurant = getRestaurant(drawn.slug);
    if (!restaurant) continue;

    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'restaurant-row';
    row.setAttribute('data-testid', `flash-restaurant-${restaurant.slug}`);

    const photo = document.createElement('span');
    photo.className = 'restaurant-photo';
    const img = document.createElement('img');
    img.src = restaurant.heroImage;
    img.alt = '';
    img.loading = 'lazy';
    img.width = 60;
    img.height = 60;
    const sticker = document.createElement('span');
    sticker.className = 'deal-sticker';
    sticker.textContent = 'Deal';
    photo.append(img, sticker);

    const main = document.createElement('span');
    main.className = 'restaurant-main';

    const name = document.createElement('p');
    name.className = 'restaurant-name';
    name.textContent = restaurant.name;

    const meta = document.createElement('p');
    meta.className = 'restaurant-meta';
    const eta = etaLabel(estimateEtaMinutes(visitorId, restaurant.slug));
    meta.textContent = `★${restaurant.rating.toFixed(1)} · ${restaurant.cuisineTag} · ${eta}`;

    const fee = document.createElement('p');
    fee.className = 'restaurant-fee';
    const displayFeeMinor =
      flashFeeForRestaurant(draw, city, restaurant.slug, restaurant.deliveryFeeMinor, now()) ?? restaurant.deliveryFeeMinor;
    fee.textContent = displayFeeMinor === 0 ? 'Free' : formatMoneyForCity(displayFeeMinor, city);
    const original = document.createElement('span');
    original.className = 'original';
    original.textContent = formatMoneyForCity(restaurant.deliveryFeeMinor, city);
    fee.append(original);

    main.append(name, meta, fee);
    row.append(photo, main);
    row.addEventListener('click', () => {
      close('restaurant_tapped', restaurant.slug);
      navigate(`/restaurants/${restaurant.slug}/`);
    });
    list.append(row);
  }

  const countdownMinutes = document.createElement('span');
  countdownMinutes.className = 'tile';
  const countdownSeparator = document.createElement('span');
  countdownSeparator.className = 'tile-sep';
  countdownSeparator.textContent = ':';
  const countdownSeconds = document.createElement('span');
  countdownSeconds.className = 'tile';
  countdown.append(countdownMinutes, countdownSeparator, countdownSeconds);

  function renderCountdown(): void {
    const [minutes, seconds] = formatCountdown(flashSecondsRemaining(draw, now())).split(':');
    countdownMinutes.textContent = minutes;
    countdownSeconds.textContent = seconds;
    if (flashSecondsRemaining(draw, now()) <= 0) close('expired');
  }

  renderCountdown();
  if (!closed) intervalId = setInterval(renderCountdown, 1000);

  panel.append(dragHandle, closeButton, header, minSpendLine, list);
  overlay.append(scrim, panel);
  root.append(overlay);

  return {
    expire: () => close('expired'),
  };
}

export interface FlashBarHandle {
  /** Removes the bar and stops its own ticking countdown — called both when the bar is tapped (about to reopen the sheet) and by the bar itself once the window ends while collapsed (AC3: "a showing bar disappears", no event). */
  destroy(): void;
}

/**
 * The collapsed reopen bar (docs/design/119-flash-bar-collapsed-hcmc.html):
 * pinned above the tab bar, "{amount} off flash deals" plus a live mm:ss,
 * reopening the sheet on tap. Ticks independently of the sheet — it only
 * ever exists while the sheet doesn't — and tears itself down at 00:00
 * without firing anything, since `flash_sheet_closed` already fired once,
 * on the dismissal that collapsed it here (AC7).
 */
export function renderFlashReopenBar(
  root: HTMLElement,
  city: City,
  draw: FlashDraw,
  onReopen: () => void,
  now: () => number = Date.now,
): FlashBarHandle {
  const bar = document.createElement('button');
  bar.type = 'button';
  bar.className = 'reopen-bar';
  bar.setAttribute('data-testid', 'flash-reopen-bar');
  bar.setAttribute('aria-label', `Reopen ${formatMoneyForCity(draw.amountMinor, city)} off flash deals`);

  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = `${formatMoneyForCity(draw.amountMinor, city)} off flash deals`;

  const right = document.createElement('span');
  right.className = 'right';
  const lightning = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  lightning.setAttribute('class', 'lightning');
  lightning.setAttribute('viewBox', '0 0 24 24');
  lightning.setAttribute('fill', 'currentColor');
  lightning.setAttribute('aria-hidden', 'true');
  lightning.innerHTML = '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>';

  const countdown = document.createElement('span');
  countdown.className = 'countdown';
  countdown.setAttribute('data-testid', 'flash-reopen-bar-countdown');
  const minutesTile = document.createElement('span');
  minutesTile.className = 'tile';
  const separator = document.createElement('span');
  separator.className = 'tile-sep';
  separator.textContent = ':';
  const secondsTile = document.createElement('span');
  secondsTile.className = 'tile';
  countdown.append(minutesTile, separator, secondsTile);

  right.append(lightning, countdown);
  bar.append(label, right);

  let intervalId: ReturnType<typeof setInterval> | undefined;
  let destroyed = false;

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    if (intervalId !== undefined) clearInterval(intervalId);
    bar.remove();
  }

  function renderCountdown(): void {
    const secondsRemaining = flashSecondsRemaining(draw, now());
    const [minutes, seconds] = formatCountdown(secondsRemaining).split(':');
    minutesTile.textContent = minutes;
    secondsTile.textContent = seconds;
    if (secondsRemaining <= 0) destroy();
  }

  bar.addEventListener('click', () => {
    destroy();
    onReopen();
  });

  renderCountdown();
  if (!destroyed) intervalId = setInterval(renderCountdown, 1000);

  root.append(bar);

  return { destroy };
}
