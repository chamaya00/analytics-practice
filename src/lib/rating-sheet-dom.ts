// The post-delivery rating sheet (#163, docs/design/162-rating-win-tips-
// rewards-vip.md, "The rating sheet and the win"): a two-step modal — driver,
// then restaurant — each independently skippable, dismissible at any point,
// ending in a win screen with a canvas-confetti burst (a still frame under
// `prefers-reduced-motion`). The overlay/scrim/focus-trap shape follows
// confirm-dialog-dom.ts's pattern: a module-level singleton, so opening a
// second sheet always closes the first and the DOM never holds more than one.
//
// This module never touches order-store.ts or tracking.ts directly — it
// reports what happened through its two `onSubmit*` callbacks, and the
// caller (tracker-dom.ts) is what actually stores the rating and fires
// `rating_submitted`, reusing the exact same guarded path the existing
// inline Delivered-card prompt already calls. That is what makes a second
// restaurant submit, from either surface, fire nothing (order-store.ts's
// `submitRating` returns `null` on an already-rated order).
//
// Swipe-to-dismiss (flash-sheet-dom.ts's pattern) is not wired here: the ×,
// the scrim, and Escape all dismiss, which is what #163's acceptance
// criteria (the sheet can be dismissed) actually check. The drag gesture is
// left for a follow-up if the driver wants full parity with the mock.

import type { PlacedOrder } from './order-store';
import { RATING_TAGS, type RatingTag } from './tracking';
import { getRestaurant } from './restaurants';
import { formatMoney } from './money';
import type { ConfettiFn } from 'canvas-confetti';

const STAR_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3.5 14.4 9.6 21 10.2 16 14.4 17.6 21 12 17.3 6.4 21 8 14.4 3 10.2 9.6 9.6Z"/></svg>';

const CLOSE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round"/></svg>';

const TAG_LABELS: Record<RatingTag, string> = {
  fast: 'Fast',
  great_packaging: 'Great packaging',
  order_was_correct: 'Order was correct',
};

const STAR_WORDS = ['', 'Bad', 'Not great', 'OK', 'Good', 'Great'];

/** #163's own reduced-motion check — the same `matchMedia` guard home-dom.ts
 * and offers-dom.ts each already use, kept local rather than shared since
 * neither of those imports this module or vice versa. */
function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type ConfettiFactory = (canvas: HTMLCanvasElement, options?: { resize?: boolean }) => ConfettiFn;

/** Dynamic `import()`, only ever reached when motion is allowed (docs/design/
 * 162-*, "The animation": "loaded ... only when motion is allowed"). */
const defaultLoadConfetti: () => Promise<ConfettiFactory> = async () => {
  const mod = await import('canvas-confetti');
  return mod.default.create.bind(mod.default);
};

export interface RatingSheetOptions {
  order: PlacedOrder;
  /** Stores the driver step's rating — the caller's job, and it fires no event (docs/design/162-*, "Events"). */
  onSubmitDriverRating: (stars: number) => void;
  /** Stores the restaurant step's rating and fires `rating_submitted` exactly
   * the way the existing inline prompt already does — reused, not
   * reimplemented, so the "at most once per order_id" guard is one guard,
   * not two. */
  onSubmitRestaurant: (stars: number, tags: RatingTag[]) => void;
  /** Called once, however the sheet ends: Done, ×, scrim, or Escape. */
  onClose?: () => void;
  /** Where focus returns on close — `null`/omitted for the sheet's usual
   * case, auto-opening with nothing to return to. */
  returnFocusTo?: HTMLElement | null;
  /** Injectable for tests — never invoked when reduced motion is requested. */
  loadConfetti?: () => Promise<ConfettiFactory>;
}

export interface RatingSheetHandle {
  readonly element: HTMLElement;
  close(): void;
}

type Step = 'driver' | 'restaurant' | 'win';

let current: RatingSheetHandle | null = null;

function starRow(
  testidPrefix: string,
  selected: number,
  onSelect: (stars: number) => void,
): { row: HTMLElement; word: HTMLElement } {
  const row = document.createElement('div');
  row.className = 'star-picker';
  row.setAttribute('role', 'radiogroup');
  row.setAttribute('aria-label', 'Rating');

  const word = document.createElement('p');
  word.className = 'rating-sheet-star-word';
  word.setAttribute('data-testid', `${testidPrefix}-word`);
  word.textContent = STAR_WORDS[selected];

  for (let i = 1; i <= 5; i += 1) {
    const star = document.createElement('button');
    star.type = 'button';
    star.className = 'star';
    star.setAttribute('data-testid', `${testidPrefix}-${i}`);
    star.setAttribute('aria-pressed', String(i <= selected));
    star.setAttribute('aria-label', `${i} star${i === 1 ? '' : 's'}`);
    if (i <= selected) star.classList.add('selected');
    star.innerHTML = STAR_ICON;
    star.addEventListener('click', () => onSelect(i));
    row.append(star);
  }

  return { row, word };
}

export function openRatingSheet(options: RatingSheetOptions, doc: Document = document): RatingSheetHandle {
  current?.close();

  const { order } = options;
  const loadConfetti = options.loadConfetti ?? defaultLoadConfetti;
  const startedAtRestaurant = order.driverRating !== null;

  const overlay = doc.createElement('div');
  overlay.className = 'rating-sheet-overlay';
  overlay.setAttribute('data-testid', 'rating-sheet');

  const scrim = doc.createElement('div');
  scrim.className = 'scrim';
  scrim.setAttribute('data-testid', 'rating-sheet-scrim');

  const panel = doc.createElement('div');
  panel.className = 'sheet rating-sheet';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  const headingId = `rating-sheet-heading-${Math.random().toString(36).slice(2)}`;
  panel.setAttribute('aria-labelledby', headingId);

  const closeButton = doc.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'rating-sheet-close';
  closeButton.setAttribute('data-testid', 'rating-sheet-close');
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.innerHTML = CLOSE_ICON;

  const body = doc.createElement('div');
  body.className = 'rating-sheet-body';

  panel.append(closeButton, body);
  overlay.append(scrim, panel);

  let closed = false;
  let step: Step = startedAtRestaurant ? 'restaurant' : 'driver';
  let driverStars = 0;
  let restaurantStars = 0;
  const selectedTags = new Set<RatingTag>();
  let driverSubmittedThisOpen = false;
  let restaurantSubmittedThisOpen = false;

  function teardown(): void {
    closed = true;
    doc.removeEventListener('keydown', onKeydown, true);
    overlay.remove();
    if (current === handle) current = null;
  }

  function close(): void {
    if (closed) return;
    teardown();
    options.onClose?.();
    options.returnFocusTo?.focus();
  }

  function getFocusable(): HTMLElement[] {
    return Array.from(
      panel.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])'),
    ).filter((el) => !el.hasAttribute('disabled'));
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === 'Tab') {
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && doc.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && doc.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  scrim.addEventListener('click', close);
  closeButton.addEventListener('click', close);
  doc.addEventListener('keydown', onKeydown, true);

  function stepLabel(name: 'Driver' | 'Restaurant'): string {
    if (startedAtRestaurant) return `1 of 1 · ${name}`;
    return name === 'Driver' ? '1 of 2 · Driver' : '2 of 2 · Restaurant';
  }

  function renderDriverStep(): void {
    body.innerHTML = '';

    const avatar = doc.createElement('img');
    avatar.className = 'rating-sheet-avatar';
    avatar.src = `/avatars/drivers/${order.driver.id}.svg`;
    avatar.alt = '';
    body.append(avatar);

    const label = doc.createElement('p');
    label.className = 'rating-sheet-step-label';
    label.setAttribute('data-testid', 'rating-sheet-step-label');
    label.textContent = stepLabel('Driver');
    body.append(label);

    const heading = doc.createElement('h2');
    heading.id = headingId;
    heading.textContent = `How was ${order.driver.name}?`;
    body.append(heading);

    const meta = doc.createElement('p');
    meta.className = 'rating-sheet-meta';
    meta.textContent = `Delivered by ${order.driver.name} · ★ ${order.driver.rating.toFixed(1)}`;
    body.append(meta);

    const { row, word } = starRow('rating-sheet-driver-star', driverStars, (stars) => {
      driverStars = stars;
      renderDriverStep();
    });
    body.append(row, word);

    const actions = doc.createElement('div');
    actions.className = 'rating-sheet-actions';

    const skip = doc.createElement('button');
    skip.type = 'button';
    skip.className = 'rating-sheet-skip';
    skip.setAttribute('data-testid', 'rating-sheet-driver-skip');
    skip.textContent = 'Skip';
    skip.addEventListener('click', () => {
      step = 'restaurant';
      renderRestaurantStep();
    });

    const next = doc.createElement('button');
    next.type = 'button';
    next.className = 'place-order';
    next.setAttribute('data-testid', 'rating-sheet-driver-next');
    next.textContent = 'Next';
    if (driverStars === 0) next.setAttribute('aria-disabled', 'true');
    next.addEventListener('click', () => {
      if (driverStars === 0) return;
      options.onSubmitDriverRating(driverStars);
      driverSubmittedThisOpen = true;
      step = 'restaurant';
      renderRestaurantStep();
    });

    actions.append(skip, next);
    body.append(actions);
  }

  function renderRestaurantStep(): void {
    body.innerHTML = '';

    const restaurantSlug = order.items[0]?.restaurantSlug ?? '';
    const restaurant = getRestaurant(restaurantSlug);
    const restaurantName = order.items[0]?.restaurantName ?? '';

    if (restaurant) {
      const photo = doc.createElement('img');
      photo.className = 'rating-sheet-restaurant-photo';
      photo.src = restaurant.heroImage;
      photo.alt = '';
      body.append(photo);
    }

    const label = doc.createElement('p');
    label.className = 'rating-sheet-step-label';
    label.setAttribute('data-testid', 'rating-sheet-step-label');
    label.textContent = stepLabel('Restaurant');
    body.append(label);

    const heading = doc.createElement('h2');
    heading.id = headingId;
    heading.textContent = `How was ${restaurantName}?`;
    body.append(heading);

    const meta = doc.createElement('p');
    meta.className = 'rating-sheet-meta';
    const itemsText = order.itemCount === 1 ? '1 item' : `${order.itemCount} items`;
    meta.textContent = `${itemsText} · ${formatMoney(order.totalMinor ?? order.amountMinor, order.currency)}`;
    body.append(meta);

    const { row, word } = starRow('rating-sheet-restaurant-star', restaurantStars, (stars) => {
      restaurantStars = stars;
      renderRestaurantStep();
    });
    body.append(row, word);

    const tagGroup = doc.createElement('div');
    tagGroup.className = 'chip-group';
    tagGroup.setAttribute('data-testid', 'rating-sheet-restaurant-tags');
    for (const tag of RATING_TAGS) {
      const chip = doc.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.setAttribute('data-testid', `rating-sheet-restaurant-tag-${tag}`);
      const selected = selectedTags.has(tag);
      chip.setAttribute('aria-pressed', String(selected));
      if (selected) chip.classList.add('selected');
      chip.textContent = TAG_LABELS[tag];
      chip.addEventListener('click', () => {
        if (selectedTags.has(tag)) selectedTags.delete(tag);
        else selectedTags.add(tag);
        renderRestaurantStep();
      });
      tagGroup.append(chip);
    }
    body.append(tagGroup);

    const actions = doc.createElement('div');
    actions.className = 'rating-sheet-actions';

    const skip = doc.createElement('button');
    skip.type = 'button';
    skip.className = 'rating-sheet-skip';
    skip.setAttribute('data-testid', 'rating-sheet-restaurant-skip');
    skip.textContent = 'Skip';
    skip.addEventListener('click', () => {
      if (driverSubmittedThisOpen) {
        step = 'win';
        renderWin();
      } else {
        close();
      }
    });

    const submit = doc.createElement('button');
    submit.type = 'button';
    submit.className = 'place-order';
    submit.setAttribute('data-testid', 'rating-sheet-restaurant-submit');
    submit.textContent = 'Submit';
    if (restaurantStars === 0) submit.setAttribute('aria-disabled', 'true');
    submit.addEventListener('click', () => {
      if (restaurantStars === 0 || restaurantSubmittedThisOpen) return;
      restaurantSubmittedThisOpen = true;
      options.onSubmitRestaurant(restaurantStars, Array.from(selectedTags));
      step = 'win';
      renderWin();
    });

    actions.append(skip, submit);
    body.append(actions);
  }

  function renderWin(): void {
    body.innerHTML = '';
    const reduced = prefersReducedMotion();

    const winEl = doc.createElement('div');
    winEl.setAttribute('data-testid', reduced ? 'rating-sheet-win-still' : 'rating-sheet-win');

    let canvas: HTMLCanvasElement | null = null;
    if (!reduced) {
      canvas = doc.createElement('canvas');
      canvas.className = 'rating-sheet-confetti';
      canvas.setAttribute('data-testid', 'rating-sheet-confetti');
      canvas.setAttribute('aria-hidden', 'true');
      winEl.append(canvas);
    }

    const stamp = doc.createElement('div');
    stamp.className = 'rating-sheet-stamp';
    stamp.setAttribute('aria-hidden', 'true');
    stamp.innerHTML = STAR_ICON;
    winEl.append(stamp);

    const heading = doc.createElement('h2');
    heading.id = headingId;
    heading.textContent = 'Thank you!';
    winEl.append(heading);

    const summary = doc.createElement('p');
    summary.className = 'rating-sheet-win-summary';
    summary.setAttribute('role', 'status');
    summary.setAttribute('data-testid', 'rating-sheet-win-summary');
    const parts: string[] = [];
    if (driverSubmittedThisOpen || order.driverRating) {
      const stars = driverSubmittedThisOpen ? driverStars : (order.driverRating?.stars ?? 0);
      parts.push(`${order.driver.name} ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}`);
    }
    if (restaurantSubmittedThisOpen) {
      parts.push(`Food ${'★'.repeat(restaurantStars)}${'☆'.repeat(5 - restaurantStars)}`);
    }
    summary.textContent = parts.join(' · ');
    winEl.append(summary);

    // #166's reward unlock (the thanks voucher, the VIP nudge) mounts here —
    // deliberately empty until that issue ships (docs/design/162-*, "For the
    // engineers": #163 "leaves a clearly marked slot for #166's reward
    // unlock").
    const rewardSlot = doc.createElement('div');
    rewardSlot.setAttribute('data-testid', 'rating-sheet-reward-slot');
    rewardSlot.setAttribute('aria-hidden', 'true');
    winEl.append(rewardSlot);

    const done = doc.createElement('button');
    done.type = 'button';
    done.className = 'place-order';
    done.setAttribute('data-testid', 'rating-sheet-done');
    done.textContent = 'Done';
    done.addEventListener('click', close);
    winEl.append(done);

    body.append(winEl);

    if (canvas) {
      loadConfetti()
        .then((create) => {
          if (closed) return;
          const burst = create(canvas, { resize: true });
          burst({ particleCount: 70, spread: 70, startVelocity: 38, ticks: 160, gravity: 1.1, disableForReducedMotion: true });
        })
        .catch(() => {
          // A failed dynamic import (offline, blocked) never blocks the win
          // screen itself — the stamp, the summary and Done are already up.
        });
    }
  }

  if (step === 'driver') renderDriverStep();
  else renderRestaurantStep();

  const handle: RatingSheetHandle = { element: overlay, close };
  current = handle;

  doc.body.append(overlay);
  closeButton.focus();
  return handle;
}
