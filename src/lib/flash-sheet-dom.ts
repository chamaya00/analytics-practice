// The flash-deal bottom sheet (docs/design/87-promo-offers-and-flash.md,
// "The flash-deal sheet"): drag handle, header with the drawn amount and a
// live mm:ss countdown, the minimum-spend line, and the two drawn
// restaurants — dismissible by the handle, the scrim, the "×", or tapping a
// restaurant row, and auto-closing at 00:00. `flash_sheet_closed` fires
// exactly once per sheet, by whichever of those four exits happens first
// (contract §7's "at most one per flash_sheet_shown").

import { formatMoneyForCity, type City } from './money';
import { getRestaurant, etaRangeLabel } from './restaurants';
import { track } from './tracking';
import { flashFeeForRestaurant, flashSecondsRemaining, type FlashDraw } from './flash-deal';
import { FLASH_MINIMUM_SPEND_MINOR, formatCountdown } from './vouchers';

export type FlashCloseOutcome = 'restaurant_tapped' | 'dismissed' | 'expired';

export interface FlashSheetHandle {
  /** Closes the sheet as if the countdown had reached zero — used by the home feed once it independently learns the window has ended. */
  expire(): void;
}

export function renderFlashSheet(
  root: HTMLElement,
  city: City,
  draw: FlashDraw,
  navigate: (path: string) => void = (path) => {
    window.location.href = path;
  },
  now: () => number = Date.now,
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

  const list = document.createElement('div');
  list.className = 'restaurant-list';

  let closed = false;
  let intervalId: ReturnType<typeof setInterval> | undefined;

  function close(outcome: FlashCloseOutcome, restaurantSlug?: string): void {
    if (closed) return;
    closed = true;
    if (intervalId !== undefined) clearInterval(intervalId);
    track('flash_sheet_closed', {
      city,
      outcome,
      seconds_remaining: flashSecondsRemaining(draw, now()),
      restaurant_slug: outcome === 'restaurant_tapped' ? (restaurantSlug ?? 'none') : 'none',
    });
    overlay.remove();
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

    const name = document.createElement('p');
    name.className = 'restaurant-name';
    name.textContent = restaurant.name;

    const meta = document.createElement('p');
    meta.className = 'restaurant-meta';
    meta.textContent = `★${restaurant.rating.toFixed(1)} · ${restaurant.cuisineTag} · ${etaRangeLabel(restaurant)}`;

    const fee = document.createElement('p');
    fee.className = 'restaurant-fee';
    const displayFeeMinor =
      flashFeeForRestaurant(draw, city, restaurant.slug, restaurant.deliveryFeeMinor, now()) ?? restaurant.deliveryFeeMinor;
    fee.textContent = displayFeeMinor === 0 ? 'Free' : formatMoneyForCity(displayFeeMinor, city);
    const original = document.createElement('span');
    original.className = 'original';
    original.textContent = formatMoneyForCity(restaurant.deliveryFeeMinor, city);
    fee.append(original);

    row.append(name, meta, fee);
    row.addEventListener('click', () => {
      close('restaurant_tapped', restaurant.slug);
      navigate(`/restaurants/${restaurant.slug}/`);
    });
    list.append(row);
  }

  function renderCountdown(): void {
    countdown.textContent = formatCountdown(flashSecondsRemaining(draw, now()));
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
