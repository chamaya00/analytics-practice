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
// Dismissal (scrim/×/drag handle/swipe-down, not a restaurant tap or
// expiry) collapses the sheet into `renderFlashReopenBar`'s pinned bar
// rather than discarding it outright — #120 AC2/AC3. The caller
// (home-dom.ts) owns persisting that collapsed state alongside the draw so
// it survives a reload.
//
// #126: swipe-to-dismiss on the handle or header, a real close button, and
// the copy/contrast/no-non-deal fixes below it in this file's diff.

import { formatMoneyForCity, type City } from './money';
import { getRestaurant } from './restaurants';
import { estimateEtaMinutes, etaLabel } from './eta';
import { track } from './tracking';
import { flashFeeForRestaurant, flashSecondsRemaining, type FlashDraw } from './flash-deal';
import { FLASH_MINIMUM_SPEND_MINOR, formatCountdown } from './vouchers';

export type FlashCloseOutcome = 'restaurant_tapped' | 'dismissed' | 'expired';

// Swipe-to-dismiss on the handle or the header (#126 AC1) — the same
// "decisions are pure functions, unit-tested on their own" split
// swipe-row.ts uses for the cart's reveal gesture, just vertical and
// one-directional (down only; an upward or horizontal drag does nothing).
/** Movement below this on both axes is still a tap, not a gesture. */
export const SHEET_DRAG_SLOP_PX = 8;
/** A release past this many px of downward drag dismisses the sheet. */
export const SHEET_DISMISS_THRESHOLD_PX = 96;
/** A downward release faster than this (px/ms) dismisses the sheet regardless of distance — a flick. */
export const SHEET_DISMISS_VELOCITY_PX_MS = 0.5;

export type SheetDragDirection = 'pending' | 'down' | 'ignored';

/** Which way a drag is going: undecided inside the slop, `down` only once it is both net-downward and more vertical than horizontal, `ignored` (upward or mostly horizontal) otherwise — those do nothing (AC1). */
export function sheetDragDirection(dx: number, dy: number, slop: number = SHEET_DRAG_SLOP_PX): SheetDragDirection {
  if (Math.abs(dx) < slop && Math.abs(dy) < slop) return 'pending';
  return dy > 0 && dy > Math.abs(dx) ? 'down' : 'ignored';
}

/** The sheet's translateY while dragging, in CSS px — following the finger downward only; an upward `dy` clamps to 0 rather than lifting the sheet above its resting position. */
export function sheetDragOffset(dy: number): number {
  return Math.max(0, dy);
}

/** Whether a released downward drag dismisses the sheet: past the distance threshold, or a flick faster than the velocity threshold — either is enough. */
export function shouldDismissSheet(
  dy: number,
  velocityPxPerMs: number,
  thresholdPx: number = SHEET_DISMISS_THRESHOLD_PX,
  velocityThreshold: number = SHEET_DISMISS_VELOCITY_PX_MS,
): boolean {
  return dy >= thresholdPx || velocityPxPerMs >= velocityThreshold;
}

interface SheetDragGesture {
  pointerId: number;
  startX: number;
  startY: number;
  lastY: number;
  lastT: number;
  /** px/ms, downward positive — updated on every pointermove from the previous sample, so it reflects the final flick speed rather than the whole gesture's average. */
  velocity: number;
  direction: SheetDragDirection;
}

/**
 * Wires vertical swipe-to-dismiss onto one trigger element (the handle or
 * the header), moving `panel`'s own transform while dragging. `now` is the
 * same injected clock `renderFlashSheet` already takes, so a test controls
 * the flick velocity with `vi.advanceTimersByTime` rather than depending on
 * real elapsed wall-clock time between synthetic events (#126 AC1).
 */
function attachSheetDragTrigger(trigger: HTMLElement, panel: HTMLElement, onDismiss: () => void, now: () => number): void {
  let gesture: SheetDragGesture | null = null;
  // A drag that snaps back is followed by a click the browser synthesises
  // on release; on the drag handle that click would otherwise dismiss the
  // sheet a second, unwanted way (its own click listener already dismisses
  // on a tap) — the same swallow-until pattern swipe-row.ts uses for the
  // cart's row drag.
  let swallowClickUntil = 0;

  trigger.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    gesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastY: event.clientY,
      lastT: now(),
      velocity: 0,
      direction: 'pending',
    };
  });

  trigger.addEventListener('pointermove', (event) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (gesture.direction === 'pending') {
      const direction = sheetDragDirection(dx, dy);
      if (direction === 'pending') return;
      if (direction === 'ignored') {
        gesture = null;
        return;
      }
      gesture.direction = direction;
      panel.classList.add('is-dragging');
      try {
        trigger.setPointerCapture(event.pointerId);
      } catch {
        // Not every environment supports capture; the drag still tracks
        // while the pointer stays over the trigger.
      }
    }

    event.preventDefault();
    const t = now();
    const elapsed = Math.max(1, t - gesture.lastT);
    gesture.velocity = (event.clientY - gesture.lastY) / elapsed;
    gesture.lastY = event.clientY;
    gesture.lastT = t;
    panel.style.transform = `translateY(${sheetDragOffset(dy)}px)`;
  });

  function finish(event: PointerEvent, cancelled: boolean): void {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const ended = gesture;
    gesture = null;
    if (ended.direction !== 'down') return; // a tap, or never left the slop — nothing to settle

    panel.classList.remove('is-dragging');
    swallowClickUntil = now() + 400;
    const dy = event.clientY - ended.startY;

    if (!cancelled && shouldDismissSheet(dy, ended.velocity)) {
      onDismiss();
      return;
    }
    panel.style.transform = '';
  }

  trigger.addEventListener('pointerup', (event) => finish(event, false));
  trigger.addEventListener('pointercancel', (event) => finish(event, true));

  trigger.addEventListener(
    'click',
    (event) => {
      if (now() < swallowClickUntil) {
        swallowClickUntil = 0;
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true,
  );
}

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

  // A 36px circle inside the header's own corner (not straddling the seam
  // between the sheet and the header), on a 44px hit area, in the header's
  // own text colour — #126 AC2. The circle is a separate layer
  // (`.sheet-close-fill`, styled via `background: currentColor` at partial
  // opacity) so the icon's stroke stays at full opacity while the fill
  // reads as translucent.
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'sheet-close';
  closeButton.setAttribute('data-testid', 'flash-sheet-close');
  closeButton.setAttribute('aria-label', 'Close flash deals');
  const closeButtonFill = document.createElement('span');
  closeButtonFill.className = 'sheet-close-fill';
  closeButtonFill.setAttribute('aria-hidden', 'true');
  closeButton.append(closeButtonFill);
  closeButton.insertAdjacentHTML(
    'beforeend',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round"/></svg>',
  );

  // Full-width, 44px-tall hit area (AC1) around a visibly larger 40×5px bar.
  const dragHandle = document.createElement('button');
  dragHandle.type = 'button';
  dragHandle.className = 'drag-handle';
  dragHandle.setAttribute('data-testid', 'flash-sheet-drag-handle');
  dragHandle.setAttribute('aria-label', 'Dismiss');
  const dragHandleBar = document.createElement('span');
  dragHandleBar.className = 'drag-handle-bar';
  dragHandleBar.setAttribute('aria-hidden', 'true');
  dragHandle.append(dragHandleBar);

  const header = document.createElement('div');
  header.className = 'sheet-header';
  const heading = document.createElement('h1');
  heading.textContent = 'Flash deals';
  const subtitle = document.createElement('p');
  subtitle.className = 'sheet-subtitle';
  subtitle.textContent = `${formatMoneyForCity(draw.amountMinor, city)} off orders over ${formatMoneyForCity(FLASH_MINIMUM_SPEND_MINOR[city], city)}`;
  const countdownRow = document.createElement('div');
  countdownRow.className = 'countdown-row';
  const countdownLabel = document.createElement('span');
  countdownLabel.className = 'countdown-label';
  countdownLabel.textContent = 'Ends in';
  const countdown = document.createElement('div');
  countdown.className = 'countdown';
  countdown.setAttribute('data-testid', 'flash-sheet-countdown');
  countdownRow.append(countdownLabel, countdown);
  header.append(heading, subtitle, countdownRow, closeButton);

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
  attachSheetDragTrigger(dragHandle, panel, () => close('dismissed'), now);
  attachSheetDragTrigger(header, panel, () => close('dismissed'), now);

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
    const flashFeeMinor = flashFeeForRestaurant(draw, city, restaurant.slug, restaurant.deliveryFeeMinor, now());
    const displayFeeMinor = flashFeeMinor ?? restaurant.deliveryFeeMinor;
    fee.textContent = displayFeeMinor === 0 ? 'Free delivery' : `${formatMoneyForCity(displayFeeMinor, city)} delivery`;
    // Only when the flash deal actually changed something — a restaurant
    // whose normal fee is already 0 has nothing to strike through (#126
    // AC4: no row ever shows a struck-through ₫0).
    if (flashFeeMinor !== null) {
      const original = document.createElement('span');
      original.className = 'original';
      original.textContent = formatMoneyForCity(restaurant.deliveryFeeMinor, city);
      fee.append(original);
    }

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

  panel.append(dragHandle, header, list);
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
  bar.setAttribute('aria-label', `Reopen flash deals, ${formatMoneyForCity(draw.amountMinor, city)} off`);

  const label = document.createElement('span');
  label.className = 'label';
  const labelDeals = document.createElement('span');
  labelDeals.className = 'label-deals';
  labelDeals.textContent = 'Flash deals';
  const labelSep = document.createElement('span');
  labelSep.className = 'label-sep';
  labelSep.setAttribute('aria-hidden', 'true');
  labelSep.textContent = ' · ';
  const labelOff = document.createElement('span');
  labelOff.className = 'label-off';
  labelOff.textContent = `${formatMoneyForCity(draw.amountMinor, city)} off`;
  label.append(labelDeals, labelSep, labelOff);

  const right = document.createElement('span');
  right.className = 'right';
  const lightning = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  lightning.setAttribute('class', 'lightning');
  lightning.setAttribute('viewBox', '0 0 24 24');
  lightning.setAttribute('fill', 'currentColor');
  lightning.setAttribute('aria-hidden', 'true');
  lightning.innerHTML = '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>';

  const countdownLabel = document.createElement('span');
  countdownLabel.className = 'countdown-label';
  countdownLabel.textContent = 'Ends in';

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

  right.append(lightning, countdownLabel, countdown);
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
