// Tracker screen (docs/design/80-two-city-brand-and-flow.md, "Tracker";
// extended by #148/docs/design/147-tracker-multi-order-driver-history.md to
// several live orders, a driver card, and history below) — renders from
// every stored order's own computeTrackerView, re-rendering on an interval so
// each order's stepper advances without a reload; fires tracker_viewed once
// per page load (not per re-render, and not again when a row is opened), for
// the order open by default (chamaya00, #148 driver notes, D11); fires
// order_delivered once per order via delivery.ts's own sweep of every
// stored order (#144 §3), whether or not that order is the one on screen;
// and fires rating_submitted once, against the order currently open, when
// "Submit" is tapped.

import {
  cartItemCount,
  findOrder,
  getCart,
  getOrders,
  linesForRestaurant,
  markRatingPrompted,
  minutesSinceOrder,
  orderAgainLines,
  recordTrackerView,
  setRestaurantCart,
  storeTip,
  submitDriverRating,
  submitRating,
  sweepVipLedger,
  type PlacedOrder,
} from './order-store';
import {
  computeOrderStack,
  computeTrackerView,
  decideRatingPrompt,
  defaultOpenOrderId,
  deliveredAtMs,
  isDelivered,
  isRatingFullyDone,
  STEPS,
  type TrackerView,
} from './tracker-state';
import { checkDelivery } from './delivery';
import { track } from './tracking';
import { openRatingSheet, type RatingSheetOptions } from './rating-sheet-dom';
import { openConfirmDialog } from './confirm-dialog-dom';
import { renderDemoDisclosure } from './demo-disclosure';
import { formatCountdown } from './vouchers';
import { currencyForCity, formatMoney, type City, type Currency } from './money';
import { getStoredCity } from './location';
import {
  EMPTY_VIP_LEDGER,
  readVipLedger,
  VIP_GOLD_ORDERS,
  VIP_PLATINUM_SPEND_MINOR,
  platinumSpendRemainingMinor,
  type VipLedger,
} from './vip-level';
import { unlockThanksVoucher, type ThanksVoucherUnlock } from './thanks-voucher';
import { getRestaurant, type Restaurant } from './restaurants';
import { formatReviewCount } from './reviews';
import { createVehicleIcon } from './vehicle-icon';
import { formatHistoryDate } from './history-date';
import { cartPath } from './cart-routes';
import { readWalletEnvConfig, type WalletEnvConfig } from './wallet-config';
import { probeWalletGate } from './wallet-gate';
import {
  createSupabaseAuth,
  completeOAuthReturn,
  getCurrentSession,
  isOAuthReturn,
  stripOAuthParams,
  beginSignIn,
  type SupabaseAuthLike,
  type WalletSession,
  type OAuthProvider,
} from './auth-client';
import { getWallet, claimDrip, tipWallet, type WalletBalances } from './wallet-client';
import { formatNextDripHeadline } from './wallet-dom';
import { WALLET_BALANCE_CHANGED_EVENT } from './wallet-events';
import { renderSignInPrompt } from './sign-in-prompt-dom';
import { loadConfettiCannon } from './confetti-loader';

/** #162's fixed tip presets, integer minor units — `wallet_tip` (#164)
 * accepts exactly these six values and nothing else. The order's own
 * currency picks the row, never the city picker (docs/design/162-*,
 * "Tips"). */
const TIP_PRESETS_MINOR: Record<Currency, number[]> = {
  USD: [100, 200, 300],
  VND: [10000, 20000, 30000],
};

/** The drip's own fixed amounts (ADR 0008) — used only for the tip panel's
 * short-balance copy, the same constant checkout-dom.ts keeps for its own
 * short-balance block. */
const DRIP_MINOR: Record<Currency, number> = { USD: 500, VND: 100000 };

type TrackerWalletState =
  | { kind: 'dark' }
  | { kind: 'signed-out'; auth: SupabaseAuthLike; providers: { google: boolean; apple: boolean } }
  | { kind: 'signed-in'; auth: SupabaseAuthLike; session: WalletSession; balances: WalletBalances };

export interface TrackerWalletDeps {
  /** Injected in tests so no real config, network or `@supabase/supabase-js` client is ever touched. `undefined` (the default) reads the real env; pass `null` explicitly for "wallet off." */
  config?: WalletEnvConfig | null;
  createAuth?: (config: WalletEnvConfig) => Promise<SupabaseAuthLike>;
  fetchImpl?: typeof fetch;
  locationHref?: string;
  /** Cleans the OAuth-return query params off the URL after completing the round trip. */
  replaceUrl?: (next: string) => void;
  /** Starts the OAuth redirect — a real `window.location.href = url` by default, injected in tests so nothing actually navigates. */
  navigateToOAuth?: (url: string) => void;
  sessionStorage?: Storage;
}

interface TipRowState {
  walletState: TrackerWalletState;
  panelOpen: boolean;
  selectedPresetMinor: number | null;
  sending: boolean;
  errorMessage: string | null;
  /** `wallet_tip` refused this order outright (docs/design/162-*, "Send":
   * "Refused ... collapse to the D14 note") — shown with the same copy as a
   * never-wallet-paid order regardless of this order's own `walletPaid`
   * flag, since the refusal itself is the server's word that the account
   * behind this tap cannot tip it. */
  blocked: boolean;
  onToggle: (orderId: string) => void;
  onSignIn: (orderId: string) => void;
  onSelectPreset: (orderId: string, amountMinor: number) => void;
  onSend: (orderId: string) => void;
  onCancel: (orderId: string) => void;
  onCollectDrip: () => void;
}

/** The middle preset, or the largest one the balance actually covers
 * (docs/design/162-*, "The tip panel": "The middle preset is pre-selected,
 * or the largest affordable one if the middle is over the balance") —
 * falling back to the smallest preset when none is affordable, so the
 * short-balance block always names a real shortfall rather than the largest
 * possible one. */
function pickInitialPresetMinor(presets: number[], balanceMinor: number): number {
  const middle = presets[1];
  if (middle <= balanceMinor) return middle;
  for (let i = presets.length - 1; i >= 0; i--) {
    if (presets[i] <= balanceMinor) return presets[i];
  }
  return presets[0];
}

// 105-tracker.html's own rail dot: a checkmark once a step is reached
// (current or done), nothing inside it while still ahead. Reused for the
// history row's "Delivered" state (#148), and for #162's Delivered hero
// stamp and done rail below — same mark, a muted colour on the history row.
const CHECK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M5 13l4 4 10-10" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const CHEVRON_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

/** #193: `renderTrackerView` rebuilds the whole tree every tick
 * (`root.innerHTML = ''`), which used to mint a fresh restaurant-thumb and
 * driver-avatar `<img>` on every one of those rebuilds — flickering, and
 * losing the avatar's own load-failure fallback the moment a later tick
 * remade it as an `<img>` again. This cache, created once per `initTrackerPage`
 * call and threaded through every render, is keyed by the element's stable
 * slot ("open card", or an order id for a row/history entry) rather than by
 * anything about the render itself, so the same node comes back out on the
 * next tick and only its `src`/text gets updated in place. */
interface TrackerImageCache {
  thumbs: Map<string, HTMLElement>;
  avatars: Map<string, HTMLElement>;
  /** #189: order ids seen here while the open card's own view was still
   * `active` — the "watched it land" signal for the Delivered hero's landing
   * animation, the same concept `evaluateRatingPrompt`'s `watchedItLand`
   * computes from `pageLoadNow`, redone per-order against this cache instead
   * since that's what's actually threaded into `renderDeliveredHero`. An
   * order never seen here before turning up Delivered was already Delivered
   * the first time this page ever rendered it ("opened afterwards"). */
  watchedOpenOrderIds: Set<string>;
  /** #189: order ids whose Delivered hero has already been decided — played
   * the landing animation, or resolved static — so a later re-render (the
   * whole hero is rebuilt fresh every tick) never replays it. */
  deliveredHeroResolved: Set<string>;
}

function createTrackerImageCache(): TrackerImageCache {
  return { thumbs: new Map(), avatars: new Map(), watchedOpenOrderIds: new Set(), deliveredHeroResolved: new Set() };
}

function renderStepper(currentIndex: number): HTMLElement {
  const stepper = document.createElement('ul');
  stepper.className = 'stepper';
  stepper.setAttribute('aria-live', 'polite');
  stepper.setAttribute('data-testid', 'tracker-stepper');

  STEPS.forEach((label, index) => {
    const item = document.createElement('li');
    const reached = index <= currentIndex;
    if (index < currentIndex) item.classList.add('done');
    if (index === currentIndex) {
      item.classList.add('current');
      item.setAttribute('aria-current', 'step');
    }

    const rail = document.createElement('span');
    rail.className = 'step-rail';

    const dot = document.createElement('span');
    dot.className = 'step-dot';
    if (reached) dot.innerHTML = CHECK_ICON;
    rail.append(dot);

    if (index < STEPS.length - 1) {
      const line = document.createElement('span');
      line.className = 'step-line';
      rail.append(line);
    }

    const stepLabel = document.createElement('span');
    stepLabel.className = 'step-label';
    stepLabel.textContent = label;

    item.append(rail, stepLabel);
    stepper.append(item);
  });

  return stepper;
}

/** A restaurant photo, or a plain placeholder square when the order's own
 * restaurant slug no longer resolves (#147, "Partial / error" state) — never
 * a broken image. Reuses `cache`'s node for `key` across ticks (#193) rather
 * than minting a new `<img>`/placeholder every render; only its `src` (and,
 * across a selection change, its className) is written when they've moved
 * on from what's cached. */
function renderThumb(cache: TrackerImageCache, key: string, className: string, restaurant: Restaurant | undefined): HTMLElement {
  const existing = cache.thumbs.get(key);
  const wantsImg = restaurant !== undefined;
  if (existing && (existing.tagName === 'IMG') === wantsImg) {
    existing.className = wantsImg ? className : `${className} tracker-thumb-placeholder`;
    if (wantsImg) {
      const img = existing as HTMLImageElement;
      if (img.getAttribute('src') !== restaurant!.heroImage) img.src = restaurant!.heroImage;
    }
    return existing;
  }

  let created: HTMLElement;
  if (restaurant) {
    const img = document.createElement('img');
    img.className = className;
    img.src = restaurant.heroImage;
    img.alt = '';
    created = img;
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = `${className} tracker-thumb-placeholder`;
    created = placeholder;
  }
  cache.thumbs.set(key, created);
  return created;
}

/** A driver's headshot — falls back to a plain initial disc rather than a
 * broken image if the id has no avatar file (#147, "Partial / error" state;
 * shouldn't happen, since scripts/generate-driver-avatars.mjs covers every
 * id in drivers.ts, but the fallback costs nothing). Reuses `cache`'s node
 * for `key` across ticks (#193): an `<img>` already cached only gets its
 * `src` updated (a selection change can put a different order in the same
 * slot), and once that `<img>` has failed and been swapped for the fallback
 * `<span>`, the cached node stays a `<span>` forever — the next tick never
 * sees `wantsImg` at all, since the branch below never re-derives it from
 * the driver, only from what's already in the cache. */
function renderDriverAvatar(cache: TrackerImageCache, key: string, className: string, driver: PlacedOrder['driver']): HTMLElement {
  const existing = cache.avatars.get(key);
  if (existing) {
    if (existing.tagName === 'IMG') {
      const img = existing as HTMLImageElement;
      img.className = className;
      const nextSrc = `/avatars/drivers/${driver.id}.svg`;
      if (img.getAttribute('src') !== nextSrc) img.src = nextSrc;
    } else {
      existing.className = `${className} tracker-avatar-fallback`;
      existing.textContent = driver.name.charAt(0);
    }
    return existing;
  }

  const img = document.createElement('img');
  img.className = className;
  img.src = `/avatars/drivers/${driver.id}.svg`;
  img.alt = '';
  img.addEventListener('error', () => {
    const fallback = document.createElement('span');
    fallback.className = `${className} tracker-avatar-fallback`;
    fallback.textContent = driver.name.charAt(0);
    img.replaceWith(fallback);
    cache.avatars.set(key, fallback);
  });
  cache.avatars.set(key, img);
  return img;
}

/** The driver slot (#147, "Driver slot") — a fixed-height area holding
 * either the pending-driver placeholder (before Picked up) or the driver
 * card (Picked up onward), so nothing below it jumps when a driver appears. */
function renderDriverSlot(order: PlacedOrder, view: TrackerView, city: Restaurant['city'], cache: TrackerImageCache, avatarKey: string): HTMLElement {
  const slot = document.createElement('div');
  slot.setAttribute('data-testid', 'tracker-driver-slot');

  const beforePickup = view.kind === 'active' && view.currentStepIndex < 2;
  if (beforePickup) {
    slot.className = 'tracker-driver tracker-driver-pending';
    const placeholder = document.createElement('span');
    placeholder.className = 'tracker-driver-placeholder';
    placeholder.append(createVehicleIcon(city));
    const who = document.createElement('div');
    who.className = 'tracker-driver-who';
    const name = document.createElement('div');
    name.className = 'tracker-driver-name';
    name.textContent = 'Finding your driver';
    const kicker = document.createElement('div');
    kicker.className = 'tracker-driver-kicker';
    kicker.textContent = 'Assigned when your order is picked up';
    who.append(name, kicker);
    slot.append(placeholder, who);
    return slot;
  }

  slot.className = 'tracker-driver';
  slot.setAttribute('data-testid', 'tracker-driver-card');
  slot.setAttribute('data-driver-id', order.driver.id);

  const avatar = renderDriverAvatar(cache, avatarKey, 'tracker-driver-avatar', order.driver);
  const who = document.createElement('div');
  who.className = 'tracker-driver-who';
  const kicker = document.createElement('div');
  kicker.className = 'tracker-driver-kicker';
  kicker.textContent = view.kind === 'delivered' ? 'Delivered by' : 'Your driver';
  const name = document.createElement('div');
  name.className = 'tracker-driver-name';
  name.textContent = order.driver.name;
  const rating = document.createElement('div');
  rating.className = 'tracker-rating';
  rating.setAttribute('data-testid', 'tracker-driver-rating');
  rating.append(`★ ${order.driver.rating.toFixed(1)} `);
  const count = document.createElement('span');
  count.className = 'tracker-rating-count';
  count.textContent = `(${formatReviewCount(order.driver.ratingCount)})`;
  rating.append(count);
  who.append(kicker, name, rating);

  const vehicleTag = document.createElement('span');
  vehicleTag.className = 'tracker-driver-vehicle';
  vehicleTag.append(createVehicleIcon(city));

  slot.append(avatar, who, vehicleTag);
  return slot;
}

/** "Just now · 12:41" in the first minute, "Delivered N min ago" under an
 * hour, then #147's history date format past that — "Delivered today, 10:12
 * AM" / "Delivered today, 10:12" (docs/design/162-*, "Delivered"). Built on
 * the delivered moment (`deliveredAtMs`), not `placedAt`, since those differ
 * by the minutes the order took to arrive. */
function deliveredTimeLine(order: PlacedOrder, city: Restaurant['city'], now: number): string {
  const deliveredAt = deliveredAtMs(order);
  const minutesAgo = Math.floor((now - deliveredAt) / 60_000);

  if (minutesAgo < 1) {
    const clock = new Intl.DateTimeFormat(city === 'hcmc' ? 'vi-VN' : 'en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: city !== 'hcmc',
    }).format(deliveredAt);
    return `Just now · ${clock}`;
  }
  if (minutesAgo < 60) return `Delivered ${minutesAgo} min ago`;

  const dateLabel = formatHistoryDate(new Date(deliveredAt).toISOString(), city, now);
  const lower =
    dateLabel.startsWith('Today') || dateLabel.startsWith('Yesterday')
      ? dateLabel.charAt(0).toLowerCase() + dateLabel.slice(1)
      : dateLabel;
  return `Delivered ${lower}`;
}

/** #163's own reduced-motion check — the same `matchMedia` guard
 * rating-sheet-dom.ts (and home-dom.ts/offers-dom.ts) each already use, kept
 * local rather than shared since none of those import this module or vice
 * versa. */
function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** #189's once-per-landing decision: `true` only the one time an order's
 * Delivered hero is both genuinely watched (`cache.watchedOpenOrderIds`) and
 * not yet resolved. Every call — including this one — marks the order
 * resolved, which is what stops a later re-render (the hero is rebuilt fresh
 * every tick) from ever replaying the animation, and what makes an order
 * that was already Delivered the first time it rendered ("opened
 * afterwards") read as resolved-but-never-watched, i.e. static. */
function resolveDeliveredHeroAnimation(cache: TrackerImageCache, orderId: string): boolean {
  if (cache.deliveredHeroResolved.has(orderId)) return false;
  cache.deliveredHeroResolved.add(orderId);
  return cache.watchedOpenOrderIds.has(orderId);
}

/** #162's celebratory Delivered hero (docs/design/162-*, "Delivered") — the
 * check stamp, "Delivered", the early/on-time line, and the time line.
 * Replaces the old plain "Delivered N min ago" line entirely; it is never
 * shown for a live order.
 *
 * #189's "as it lands while watched" animation — the stamp presses in, a
 * ring expands behind it, and one burst leaves the stamp's own position —
 * plays at most once per order (`resolveDeliveredHeroAnimation`) and never
 * under reduced motion, in which case the stamp is simply there, exactly as
 * before this issue. */
function renderDeliveredHero(order: PlacedOrder, city: Restaurant['city'], now: number, cache: TrackerImageCache, root: HTMLElement): HTMLElement {
  const hero = document.createElement('div');
  hero.className = 'tracker-delivered-hero';
  hero.setAttribute('data-testid', 'tracker-delivered-hero');

  const isLanding = resolveDeliveredHeroAnimation(cache, order.orderId) && !prefersReducedMotion();

  const stampWrap = document.createElement('span');
  stampWrap.className = 'tracker-delivered-stamp-wrap';

  if (isLanding) {
    const ring = document.createElement('span');
    ring.className = 'tracker-delivered-ring';
    ring.setAttribute('aria-hidden', 'true');
    ring.setAttribute('data-testid', 'tracker-delivered-ring');
    stampWrap.append(ring);
  }

  const stamp = document.createElement('span');
  stamp.className = isLanding ? 'tracker-delivered-stamp tracker-delivered-stamp--landing' : 'tracker-delivered-stamp';
  stamp.setAttribute('aria-hidden', 'true');
  stamp.setAttribute('data-testid', 'tracker-delivered-stamp');
  stamp.innerHTML = CHECK_ICON;
  stampWrap.append(stamp);
  hero.append(stampWrap);

  // The one burst, from the stamp's own position (docs/design/162-*,
  // "Delivered": "one small burst of 26 particles leaves the stamp") — never
  // the library's default full-page canvas or a fixed centre origin. Loaded
  // through the same shared loader as the rating sheet's own win burst
  // (#189 AC4), so the two share one dynamic import however many bursts
  // actually play. A failed import (offline, blocked) never blocks the hero
  // itself — the press and the ring have already played without it.
  //
  // The tracker rebuilds this whole hero on its 1s tick (`root.innerHTML =
  // ''`), and this dynamic import can still be in flight when that happens —
  // most likely on a fresh visit, when the `canvas-confetti` chunk is
  // uncached. `stamp` is then a detached node whose `getBoundingClientRect()`
  // is all zeros, which would fire the burst from the viewport's top-left
  // corner instead of skipping or re-aiming it. Measure from the stamp still
  // in the document — the rebuilt hero is the same order at the same
  // position — and skip the burst entirely rather than ever firing from
  // `{0, 0}` if no such stamp exists any more (#189 driver review).
  if (isLanding) {
    loadConfettiCannon()
      .then((cannon) => {
        const currentStamp = stamp.isConnected
          ? stamp
          : root.querySelector<HTMLElement>('[data-testid="tracker-delivered-stamp"]');
        if (!currentStamp) return;
        const rect = currentStamp.getBoundingClientRect();
        cannon({
          particleCount: 26,
          ticks: 80,
          origin: {
            x: (rect.left + rect.width / 2) / window.innerWidth,
            y: (rect.top + rect.height / 2) / window.innerHeight,
          },
        });
      })
      .catch(() => {});
  }

  const text = document.createElement('div');

  const headline = document.createElement('p');
  headline.className = 'tracker-delivered-headline';
  headline.textContent = 'Delivered';
  text.append(headline);

  // Early is etaMinutes − deliveryMs/60000, floored — #121 always delivers
  // early, so this never says late; a non-positive result (a hand-patched
  // test fixture, say) still reads "on time" rather than a negative number.
  const earlyMinutes = Math.floor(order.etaMinutes - order.deliveryMs / 60_000);
  const early = document.createElement('p');
  early.className = 'tracker-delivered-early';
  early.setAttribute('data-testid', 'tracker-delivered-early');
  early.textContent = earlyMinutes > 0 ? `Arrived ${earlyMinutes} min early` : 'Arrived on time';
  text.append(early);

  const time = document.createElement('p');
  time.className = 'tracker-delivered-time';
  time.setAttribute('data-testid', 'tracker-delivered-time');
  time.textContent = deliveredTimeLine(order, city, now);
  text.append(time);

  hero.append(text);
  return hero;
}

/** The done rail (docs/design/162-*, "Delivered": "the five-step stepper
 * collapses to one thin completed rail") — five dots joined by a line, the
 * last orange, with only the first and last step's labels under the ends.
 * Reached only once a card is Delivered; every live state keeps the full
 * per-step `renderStepper`. */
function renderDoneRail(): HTMLElement {
  const rail = document.createElement('div');
  rail.className = 'tracker-done-rail';
  rail.setAttribute('data-testid', 'tracker-done-rail');
  rail.setAttribute('role', 'img');
  rail.setAttribute('aria-label', 'All five steps done');

  const track = document.createElement('div');
  track.className = 'tracker-done-rail-track';
  STEPS.forEach((_, index) => {
    const dot = document.createElement('span');
    dot.className = 'tracker-done-rail-dot';
    if (index === STEPS.length - 1) dot.classList.add('tracker-done-rail-dot--last');
    track.append(dot);
    if (index < STEPS.length - 1) {
      const line = document.createElement('span');
      line.className = 'tracker-done-rail-line';
      track.append(line);
    }
  });
  rail.append(track);

  const labels = document.createElement('div');
  labels.className = 'tracker-done-rail-labels';
  const placed = document.createElement('span');
  placed.textContent = STEPS[0];
  const delivered = document.createElement('span');
  delivered.textContent = STEPS[STEPS.length - 1];
  labels.append(placed, delivered);
  rail.append(labels);

  return rail;
}

/** The open order card (#147, "Open order card") — everything about the one
 * order currently on screen: restaurant, countdown or #162's Delivered hero,
 * stepper or done rail, driver slot, and (once Delivered) Rate/Order again
 * and the demo disclosure. */
function renderOpenCard(
  order: PlacedOrder,
  view: TrackerView,
  onRate: (orderId: string) => void,
  onOrderAgain: (order: PlacedOrder, restaurant: Restaurant) => void,
  cache: TrackerImageCache,
  root: HTMLElement,
  now: number = Date.now(),
): HTMLElement {
  const card = document.createElement('section');
  card.className = 'tracker-order-card';
  card.setAttribute('data-testid', 'tracker-open-card');

  const restaurant = getRestaurant(order.items[0]?.restaurantSlug ?? '');
  const city = restaurant?.city ?? 'sf';

  const head = document.createElement('div');
  head.className = 'tracker-card-head';
  // Keyed by slot, not by order id (#193) — the open card is always exactly
  // one element, so the same cached node follows whichever order is open,
  // its `src` updated rather than the node replaced when the selection changes.
  head.append(renderThumb(cache, 'open-thumb', 'tracker-thumb', restaurant));
  const info = document.createElement('div');
  const name = document.createElement('div');
  name.className = 'tracker-card-name';
  name.textContent = order.items[0]?.restaurantName ?? '';
  const meta = document.createElement('div');
  meta.className = 'tracker-meta';
  meta.setAttribute('data-testid', 'tracker-order-summary');
  const itemsText = order.itemCount === 1 ? '1 item' : `${order.itemCount} items`;
  meta.textContent = `${itemsText} · ${formatMoney(order.totalMinor ?? order.amountMinor, order.currency)}`;
  info.append(name, meta);
  head.append(info);
  card.append(head);

  if (view.kind === 'active') {
    // #189: seen active here — the open card's own view, not merely "exists
    // somewhere in storage" — is what "watched it land" means for the
    // Delivered hero's animation below.
    cache.watchedOpenOrderIds.add(order.orderId);
    const countdown = document.createElement('p');
    countdown.className = 'tracker-countdown';
    countdown.setAttribute('data-testid', 'tracker-countdown');
    countdown.append(createVehicleIcon(city));
    const big = document.createElement('span');
    big.className = 'tracker-countdown-big';
    big.textContent = formatCountdown(Math.ceil(view.remainingMs / 1000));
    countdown.append(big, ' until estimated arrival');
    card.append(countdown);
    card.append(renderStepper(view.currentStepIndex));
  } else {
    card.append(renderDeliveredHero(order, city, now, cache, root));
    card.append(renderDoneRail());
  }

  card.append(renderDriverSlot(order, view, city, cache, 'open-avatar'));

  if (view.kind === 'delivered') {
    const actions = document.createElement('div');
    actions.className = 'tracker-delivered-actions';
    actions.setAttribute('data-testid', 'tracker-delivered-actions');

    // Rate this order (#169, docs/design/162-*, "Delivered": "Actions") —
    // opens #163's sheet, the tracker's only rating surface now, at whichever
    // step is unrated; absent once both are rated, replaced by the same
    // rated summary the history row shows.
    if (isRatingFullyDone(order)) {
      actions.append(renderRatedSummary(order));
    } else {
      const rate = document.createElement('button');
      rate.type = 'button';
      rate.className = 'tracker-action-button tracker-action-primary';
      rate.setAttribute('data-testid', 'tracker-delivered-rate');
      rate.textContent = 'Rate this order';
      rate.addEventListener('click', () => onRate(order.orderId));
      actions.append(rate);
    }

    // Order again (#165, docs/design/162-*, "Order again": "From the
    // Delivered card ... straight to /cart/?restaurant=<slug>") — absent
    // when the restaurant no longer resolves, same as the history row.
    if (restaurant) {
      const again = document.createElement('button');
      again.type = 'button';
      again.className = 'tracker-action-button tracker-action-secondary';
      again.setAttribute('data-testid', 'tracker-delivered-order-again');
      again.textContent = 'Order again';
      again.addEventListener('click', () => onOrderAgain(order, restaurant));
      actions.append(again);
    }

    card.append(actions);
    card.append(renderDemoDisclosure());
  }

  return card;
}

/** A collapsed live order — the switcher (#147, "Order row"). Always an
 * order still active (never the open one, and rows are excluded from
 * `computeOrderStack`'s live set only by being the currently open order, so
 * a row's own view is always `active`). */
function renderOrderRow(
  order: PlacedOrder,
  view: TrackerView,
  onSelect: (orderId: string) => void,
  cache: TrackerImageCache,
): HTMLElement {
  const restaurant = getRestaurant(order.items[0]?.restaurantSlug ?? '');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tracker-order-row';
  button.setAttribute('data-testid', 'tracker-order-row');
  button.setAttribute('data-order-id', order.orderId);
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', () => onSelect(order.orderId));

  // Keyed by order id (#193) — unlike the open card, several rows can exist
  // at once, so each order's own thumb/avatar node has to be tracked apart
  // from the others rather than sharing one "row" slot.
  button.append(renderThumb(cache, `row-thumb:${order.orderId}`, 'tracker-row-thumb', restaurant));

  const mid = document.createElement('span');
  mid.className = 'tracker-row-mid';
  const name = document.createElement('span');
  name.className = 'tracker-row-name';
  name.textContent = order.items[0]?.restaurantName ?? '';
  const status = document.createElement('span');
  status.className = 'tracker-row-status';
  const stepIndex = view.kind === 'active' ? view.currentStepIndex : STEPS.length - 1;
  if (stepIndex >= 2) {
    status.append(renderDriverAvatar(cache, `row-avatar:${order.orderId}`, 'tracker-row-driver-avatar', order.driver));
    status.append(`${STEPS[stepIndex]} · `);
    const driverName = document.createElement('b');
    driverName.textContent = order.driver.name;
    status.append(driverName);
  } else {
    status.textContent = 'Preparing · Finding your driver';
  }
  mid.append(name, status);

  const eta = document.createElement('span');
  eta.className = 'tracker-row-eta';
  const minutes = view.kind === 'active' ? Math.max(0, Math.round(view.remainingMs / 60_000)) : 0;
  eta.append(String(minutes));
  const unit = document.createElement('span');
  unit.className = 'tracker-row-eta-unit';
  unit.textContent = 'min';
  eta.append(unit);

  const chevron = document.createElement('span');
  chevron.className = 'tracker-row-chev';
  chevron.innerHTML = CHEVRON_ICON;

  button.append(mid, eta, chevron);
  return button;
}

/** The "Minh T. ★★★★★ · Food ★★★★☆" summary (#165, docs/design/162-*,
 * "History rows") once both steps are rated — a skipped step stays `null`
 * forever, so this is never shown for one. */
function renderRatedSummary(order: PlacedOrder): HTMLElement {
  const summary = document.createElement('p');
  summary.className = 'tracker-history-rated-summary';
  summary.setAttribute('data-testid', 'tracker-history-rated-summary');
  const driverStars = order.driverRating!.stars;
  const restaurantStars = order.rating!.stars;
  const stars = (count: number) => '★'.repeat(count) + '☆'.repeat(5 - count);
  summary.textContent = `${order.driver.name} ${stars(driverStars)} · Food ${stars(restaurantStars)}`;
  return summary;
}

/** #143's short-balance block, redrawn for the tip panel (docs/design/162-*,
 * "The tip panel": "Short balance" — same shape as checkout-dom.ts's own
 * `renderShortBalance`, not shared with it since neither screen's version
 * depends on the other's DOM). */
function renderTipShortBlock(
  currency: Currency,
  balanceMinor: number,
  selectedMinor: number,
  balances: WalletBalances,
  city: Restaurant['city'],
  now: number,
  onCollect: () => void,
): HTMLElement {
  const block = document.createElement('div');
  block.className = 'tracker-tip-short';
  block.setAttribute('data-testid', 'tracker-tip-short');
  block.setAttribute('role', 'alert');

  const shortfallMinor = selectedMinor - balanceMinor;
  const lead = document.createElement('p');
  lead.className = 'tracker-tip-short-lead';
  lead.setAttribute('data-testid', 'tracker-tip-short-shortfall');
  lead.textContent = `${formatMoney(shortfallMinor, currency)} short`;
  block.append(lead);

  const dripMinor = DRIP_MINOR[currency];
  const drip = document.createElement('p');
  if (!balances.claimedThisWindow) {
    drip.textContent = `Today's drip adds ${formatMoney(dripMinor, currency)}.`;
    block.append(drip);

    const collect = document.createElement('button');
    collect.type = 'button';
    collect.setAttribute('data-testid', 'tracker-tip-short-collect');
    collect.textContent = 'Collect';
    collect.addEventListener('click', onCollect);
    block.append(collect);
  } else {
    drip.textContent = `${formatNextDripHeadline(balances.nextWindowStart, city, now)} adds ${formatMoney(dripMinor, currency)}.`;
    block.append(drip);
  }

  const smaller = document.createElement('p');
  smaller.textContent = 'Or pick a smaller tip.';
  block.append(smaller);

  return block;
}

/** The tip slot's one control (docs/design/162-*, "History rows": "The tip
 * slot, exactly one of ...") and, when the panel is open, the block that
 * mounts under the row rather than inside the slot itself — the mocks draw
 * the open panel as a sibling of the action strip, never squeezed into one
 * flex item. `tipMinor` already stored outranks every wallet-state check:
 * it's a fact about the order, not the gate, and D1 only hides controls that
 * would make a request. */
function renderTipControl(
  order: PlacedOrder,
  tip: TipRowState,
  city: Restaurant['city'],
  now: number,
): { slotContent: HTMLElement | null; underRow: HTMLElement | null } {
  if (order.tipMinor !== null) {
    const tipped = document.createElement('span');
    tipped.className = 'tracker-history-tipped';
    tipped.setAttribute('data-testid', 'tracker-history-tipped');
    tipped.innerHTML = CHECK_ICON;
    tipped.append(`Tipped ${formatMoney(order.tipMinor, order.currency)}`);
    return { slotContent: tipped, underRow: null };
  }

  if (tip.walletState.kind === 'dark') {
    // D1: absent, not disabled — no button, no note, nothing under the row.
    return { slotContent: null, underRow: null };
  }

  if (!order.walletPaid || tip.blocked) {
    const note = document.createElement('p');
    note.className = 'tracker-history-tip-note';
    note.setAttribute('data-testid', 'tracker-history-tip-note');
    note.textContent = "Placed without the wallet, so it can't take a tip.";
    return { slotContent: null, underRow: note };
  }

  if (tip.walletState.kind === 'signed-out') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tracker-action-button tracker-action-secondary';
    button.setAttribute('data-testid', 'tracker-history-tip-signin');
    button.textContent = 'Sign in to tip';
    button.addEventListener('click', () => tip.onSignIn(order.orderId));
    return { slotContent: button, underRow: null };
  }

  if (!tip.panelOpen) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tracker-action-button tracker-action-secondary';
    button.setAttribute('data-testid', 'tracker-history-tip');
    button.textContent = 'Tip';
    button.addEventListener('click', () => tip.onToggle(order.orderId));
    return { slotContent: button, underRow: null };
  }

  const balances = tip.walletState.balances;
  const balanceMinor = order.currency === 'USD' ? balances.usdMinor : balances.vndMinor;
  const presets = TIP_PRESETS_MINOR[order.currency];
  const selectedMinor = tip.selectedPresetMinor ?? pickInitialPresetMinor(presets, balanceMinor);
  const isShort = selectedMinor > balanceMinor;

  const panel = document.createElement('div');
  panel.className = 'tracker-tip-panel';
  panel.setAttribute('data-testid', 'tracker-tip-panel');

  const label = document.createElement('div');
  label.className = 'tracker-tip-panel-label';
  label.append(`Tip ${order.driver.name} `);
  const balanceNote = document.createElement('span');
  balanceNote.textContent = `From your wallet · ${formatMoney(balanceMinor, order.currency)}`;
  label.append(balanceNote);
  panel.append(label);

  const presetsRow = document.createElement('div');
  presetsRow.className = 'tracker-tip-presets';
  presetsRow.setAttribute('role', 'radiogroup');
  presetsRow.setAttribute('aria-label', 'Tip amount');
  for (const amountMinor of presets) {
    const presetButton = document.createElement('button');
    presetButton.type = 'button';
    presetButton.className = 'tracker-tip-preset';
    const over = amountMinor > balanceMinor;
    const selected = amountMinor === selectedMinor;
    presetButton.classList.toggle('tracker-tip-preset--over', over);
    presetButton.classList.toggle('selected', selected);
    presetButton.setAttribute('aria-pressed', String(selected));
    if (over) presetButton.setAttribute('aria-disabled', 'true');
    presetButton.textContent = formatMoney(amountMinor, order.currency);
    presetButton.addEventListener('click', () => tip.onSelectPreset(order.orderId, amountMinor));
    presetsRow.append(presetButton);
  }
  panel.append(presetsRow);

  if (isShort) {
    panel.append(renderTipShortBlock(order.currency, balanceMinor, selectedMinor, balances, city, now, tip.onCollectDrip));
  }

  if (tip.errorMessage) {
    const error = document.createElement('p');
    error.setAttribute('role', 'status');
    error.setAttribute('data-testid', 'tracker-tip-error');
    error.textContent = tip.errorMessage;
    panel.append(error);
  }

  const panelActions = document.createElement('div');
  panelActions.className = 'tracker-tip-panel-actions';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'tracker-action-button tracker-tip-cancel';
  cancel.setAttribute('data-testid', 'tracker-tip-cancel');
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => tip.onCancel(order.orderId));

  const send = document.createElement('button');
  send.type = 'button';
  send.className = 'tracker-action-button tracker-action-primary tracker-tip-send';
  send.setAttribute('data-testid', 'tracker-tip-send');
  send.textContent = tip.sending ? 'Sending…' : `Send ${formatMoney(selectedMinor, order.currency)} tip`;
  send.disabled = tip.sending;
  if (isShort) send.setAttribute('aria-disabled', 'true');
  send.addEventListener('click', () => {
    if (isShort || tip.sending) return;
    tip.onSend(order.orderId);
  });

  panelActions.append(cancel, send);
  panel.append(panelActions);

  return { slotContent: null, underRow: panel };
}

/** A past order — Rate (#163's sheet, at whichever step is unrated), the tip
 * control (#171, docs/design/162-*, "Tips"/"History rows") and Order again
 * (#162's rule) alongside #147's read-only content. */
function renderHistoryRow(
  order: PlacedOrder,
  onRate: (orderId: string) => void,
  onOrderAgain: (order: PlacedOrder, restaurant: Restaurant) => void,
  tip: TipRowState,
  now: number,
  cache: TrackerImageCache,
): HTMLElement {
  const restaurant = getRestaurant(order.items[0]?.restaurantSlug ?? '');
  const li = document.createElement('li');
  li.className = 'tracker-history-row';
  li.setAttribute('data-testid', 'tracker-history-row');
  li.setAttribute('data-order-id', order.orderId);
  // Keyed by order id (#193), same reasoning as the row list above.
  li.append(renderThumb(cache, `history-thumb:${order.orderId}`, 'tracker-history-thumb', restaurant));

  const mid = document.createElement('div');
  mid.className = 'tracker-history-mid';
  const name = document.createElement('div');
  name.className = 'tracker-history-name';
  name.textContent = order.items[0]?.restaurantName ?? '';
  const meta = document.createElement('div');
  meta.className = 'tracker-history-meta';
  meta.textContent = `${formatHistoryDate(order.placedAt, restaurant?.city ?? 'sf')} · ${order.itemCount} item${order.itemCount === 1 ? '' : 's'}`;
  const by = document.createElement('div');
  by.className = 'tracker-history-by';
  by.append(
    renderDriverAvatar(cache, `history-avatar:${order.orderId}`, 'tracker-history-driver-avatar', order.driver),
    order.driver.name,
  );
  mid.append(name, meta, by);

  const right = document.createElement('div');
  right.className = 'tracker-history-right';
  const total = document.createElement('div');
  total.className = 'tracker-history-total';
  total.setAttribute('data-testid', 'tracker-history-total');
  if (order.totalMinor !== null) {
    total.textContent = formatMoney(order.totalMinor, order.currency);
  } else {
    total.append(formatMoney(order.amountMinor, order.currency));
    const sub = document.createElement('span');
    sub.className = 'tracker-history-sub';
    sub.setAttribute('data-testid', 'tracker-history-subtotal-label');
    sub.textContent = 'subtotal';
    total.append(sub);
  }
  const state = document.createElement('span');
  state.className = 'tracker-history-state';
  state.innerHTML = CHECK_ICON;
  state.append('Delivered');
  right.append(total, state);

  const actions = document.createElement('div');
  actions.className = 'tracker-history-actions';
  actions.setAttribute('data-testid', 'tracker-history-actions');

  const bothRated = order.driverRating !== null && order.rating !== null;
  if (bothRated) {
    actions.append(renderRatedSummary(order));
  } else {
    const rate = document.createElement('button');
    rate.type = 'button';
    rate.className = 'tracker-action-button tracker-action-primary';
    rate.setAttribute('data-testid', 'tracker-history-rate');
    rate.textContent = 'Rate';
    rate.addEventListener('click', () => onRate(order.orderId));
    actions.append(rate);
  }

  // #171's Tip control (docs/design/162-*, "History rows": "The tip slot,
  // exactly one of ...") — the interactive control, if any, mounts in this
  // flex item; the open panel or the D14 note (`underRow`) mounts as its own
  // full-width sibling below the strip instead, matching the mocks.
  const tipSlot = document.createElement('div');
  tipSlot.className = 'tracker-history-tip-slot';
  tipSlot.setAttribute('data-testid', 'tracker-history-tip-slot');
  const { slotContent, underRow } = renderTipControl(order, tip, restaurant?.city ?? 'sf', now);
  if (slotContent) tipSlot.append(slotContent);
  actions.append(tipSlot);

  if (restaurant) {
    const again = document.createElement('button');
    again.type = 'button';
    again.className = 'tracker-action-button tracker-action-secondary tracker-history-order-again';
    again.setAttribute('data-testid', 'tracker-history-order-again');
    again.textContent = 'Order again';
    again.addEventListener('click', () => onOrderAgain(order, restaurant));
    actions.append(again);
  }

  li.append(mid, right, actions);
  if (underRow) li.append(underRow);
  return li;
}

/** The three-segment meter toward Gold (docs/design/162-*, "The VIP card: where and what") — filled segments capped at `total`, so a `deliveredCount` past it (impossible once Gold is reached, since the card stops showing this meter) still renders as full rather than overflowing. */
function renderVipMeter(filled: number, total: number): HTMLElement {
  const meter = document.createElement('div');
  meter.className = 'vip-meter';
  meter.setAttribute('data-testid', 'vip-card-meter');
  meter.setAttribute('role', 'img');
  meter.setAttribute('aria-label', `${Math.min(filled, total)} of ${total} delivered orders`);
  for (let i = 0; i < total; i++) {
    const segment = document.createElement('span');
    segment.className = 'vip-meter-segment';
    segment.classList.toggle('filled', i < filled);
    meter.append(segment);
  }
  return meter;
}

/** The VIP card (docs/design/162-*, "The VIP card: where and what") — the
 * five states collapse to three renders here: Gold's own state (3) and its
 * progress-to-Platinum state (4) differ only in how close the spend bar
 * reads, which the same markup already shows. Never fires anything (#174,
 * "Events": "Tier changes fire no event"). */
function renderVipCard(ledger: VipLedger, currentCity: City): HTMLElement {
  const card = document.createElement('div');
  card.className = 'vip-card';
  card.setAttribute('data-testid', 'vip-card');

  const stamp = document.createElement('span');
  stamp.className = `vip-stamp vip-stamp--${ledger.level}`;
  stamp.setAttribute('aria-hidden', 'true');
  card.append(stamp);

  const body = document.createElement('div');
  body.className = 'vip-card-body';

  const heading = document.createElement('p');
  heading.className = 'vip-card-heading';
  heading.setAttribute('data-testid', 'vip-card-heading');

  if (ledger.level === 'platinum') {
    heading.textContent = 'Platinum';
    const detail = document.createElement('p');
    detail.className = 'muted';
    detail.setAttribute('data-testid', 'vip-card-detail');
    detail.textContent = 'Free delivery and 10% off every order, both cities.';
    body.append(heading, detail);
  } else if (ledger.level === 'gold') {
    heading.append('Gold ');
    const pill = document.createElement('span');
    pill.className = 'vip-pill vip-pill--gold';
    pill.setAttribute('data-testid', 'vip-card-pill');
    pill.textContent = 'Free delivery';
    heading.append(pill);

    const currency = currencyForCity(currentCity);
    const spendMinor = ledger.spendMinor[currency];
    const targetMinor = VIP_PLATINUM_SPEND_MINOR[currency];
    const remainingMinor = platinumSpendRemainingMinor(ledger, currency);
    const spendLine = document.createElement('p');
    spendLine.className = 'vip-card-spend';
    spendLine.setAttribute('data-testid', 'vip-card-progress');
    spendLine.textContent = `${formatMoney(spendMinor, currency)} of ${formatMoney(targetMinor, currency)} · ${formatMoney(remainingMinor, currency)} to Platinum`;
    body.append(heading, spendLine);

    const otherCity: City = currentCity === 'sf' ? 'hcmc' : 'sf';
    const otherCurrency = currencyForCity(otherCity);
    const otherSpendMinor = ledger.spendMinor[otherCurrency];
    if (otherSpendMinor > 0) {
      const otherLine = document.createElement('p');
      otherLine.className = 'muted vip-card-other-currency';
      otherLine.setAttribute('data-testid', 'vip-card-other-currency');
      const otherTargetMinor = VIP_PLATINUM_SPEND_MINOR[otherCurrency];
      const cityLabel = otherCity === 'hcmc' ? 'HCMC' : 'SF';
      otherLine.textContent = `Plus ${formatMoney(otherSpendMinor, otherCurrency)} of ${formatMoney(otherTargetMinor, otherCurrency)} in ${cityLabel}, counted apart.`;
      body.append(otherLine);
    }
  } else {
    heading.textContent = 'Not VIP yet';
    const detail = document.createElement('p');
    detail.className = 'muted';
    detail.setAttribute('data-testid', 'vip-card-detail');
    detail.textContent = '3 delivered orders make you Gold: free delivery on every order.';
    body.append(heading, detail, renderVipMeter(ledger.deliveredCount, VIP_GOLD_ORDERS));

    const remaining = VIP_GOLD_ORDERS - ledger.deliveredCount;
    const progress = document.createElement('p');
    progress.className = 'muted vip-card-progress';
    progress.setAttribute('data-testid', 'vip-card-progress');
    progress.textContent =
      remaining > 0
        ? `${remaining} order${remaining === 1 ? '' : 's'} to Gold · ${ledger.deliveredCount} of ${VIP_GOLD_ORDERS} delivered orders`
        : `${ledger.deliveredCount} of ${VIP_GOLD_ORDERS} delivered orders`;
    body.append(progress);
  }

  const footer = document.createElement('p');
  footer.className = 'muted vip-card-footer';
  footer.setAttribute('data-testid', 'vip-card-footer');
  footer.textContent = 'Counted from orders on this device. A level, once reached, is kept.';
  body.append(footer);

  card.append(body);
  return card;
}

export function renderTrackerView(
  root: HTMLElement,
  orders: PlacedOrder[],
  openOrderId: string | null,
  onRate: (orderId: string) => void,
  onSelectOrder: (orderId: string) => void,
  onOrderAgainFromHistory: (order: PlacedOrder, restaurant: Restaurant) => void,
  onOrderAgainFromDelivered: (order: PlacedOrder, restaurant: Restaurant) => void,
  now: number = Date.now(),
  vipLedger: VipLedger = EMPTY_VIP_LEDGER,
  currentCity: City = 'sf',
  tipRowStateFor: (order: PlacedOrder) => TipRowState = () => ({
    walletState: { kind: 'dark' },
    panelOpen: false,
    selectedPresetMinor: null,
    sending: false,
    errorMessage: null,
    blocked: false,
    onToggle: () => {},
    onSignIn: () => {},
    onSelectPreset: () => {},
    onSend: () => {},
    onCancel: () => {},
    onCollectDrip: () => {},
  }),
  // Not persisted by default (#193) — a caller across several ticks (only
  // `initTrackerPage` today) has to create one cache and keep passing the
  // same object back in, or every render acts as if nothing were cached.
  cache: TrackerImageCache = createTrackerImageCache(),
): void {
  root.innerHTML = '';

  if (orders.length === 0 || openOrderId === null) {
    const empty = document.createElement('div');
    empty.setAttribute('data-testid', 'tracker-empty');
    const message = document.createElement('p');
    message.textContent = 'Nothing to track yet.';
    const link = document.createElement('a');
    link.href = '/';
    link.className = 'add-button';
    link.textContent = 'Browse restaurants';
    empty.append(message, link);
    root.append(empty);
    return;
  }

  const stack = computeOrderStack(orders, openOrderId, now);
  const openOrder = stack.live.find((order) => order.orderId === openOrderId) ?? null;
  if (!openOrder) {
    // Shouldn't happen given computeOrderStack's own guarantee that the open
    // order is always in `live` — defensive rather than reachable.
    root.append(document.createElement('div'));
    return;
  }

  const cols = document.createElement('div');
  cols.className = 'tracker-cols';

  const live = document.createElement('div');
  live.className = 'tracker-live';

  if (stack.live.length > 1) {
    const label = document.createElement('h2');
    label.className = 'tracker-section-label';
    const count = document.createElement('span');
    count.className = 'tracker-section-count';
    count.textContent = `· ${stack.live.length}`;
    label.append('Live now ', count);
    live.append(label);
  }

  live.append(renderOpenCard(openOrder, computeTrackerView(openOrder, now), onRate, onOrderAgainFromDelivered, cache, root, now));
  for (const order of stack.live) {
    if (order.orderId === openOrderId) continue;
    live.append(renderOrderRow(order, computeTrackerView(order, now), onSelectOrder, cache));
  }
  cols.append(live);

  cols.append(renderVipCard(vipLedger, currentCity));

  if (stack.past.length > 0) {
    const past = document.createElement('section');
    past.className = 'tracker-past';
    past.setAttribute('aria-labelledby', 'tracker-past-label');
    const label = document.createElement('h2');
    label.className = 'tracker-section-label';
    label.id = 'tracker-past-label';
    label.textContent = 'Past orders';
    const list = document.createElement('ul');
    list.className = 'tracker-history';
    list.setAttribute('data-testid', 'tracker-history');
    for (const order of stack.past) {
      list.append(renderHistoryRow(order, onRate, onOrderAgainFromHistory, tipRowStateFor(order), now, cache));
    }
    const note = document.createElement('p');
    note.className = 'tracker-device-note';
    note.textContent = 'Kept on this device only.';
    past.append(label, list, note);
    cols.append(past);
  }

  root.append(cols);
}

export function initTrackerPage(
  root: HTMLElement,
  storage: Storage = window.localStorage,
  navigate: (path: string) => void = (path) => {
    window.location.href = path;
  },
  walletDeps: TrackerWalletDeps = {},
): () => void {
  // Arriving from Order placed opens the order just placed (#147, "Order
  // stack rules"; order-placed-dom.ts's track link is `/tracker/#order-
  // <orderId>`). Read once, on load — the open choice afterward is page
  // state only, so a reload returns to the default (chamaya00, #148 driver
  // notes, D11).
  const hashMatch = /^#order-(.+)$/.exec(window.location.hash);
  const hashOrderId = hashMatch ? hashMatch[1] : null;
  const pageLoadNow = Date.now();
  const initialOrders = getOrders(storage);
  // One cache for this page's whole life, threaded into every `render()`
  // call below (#193) — a fresh one per tick would defeat the point.
  const trackerImageCache = createTrackerImageCache();
  let openOrderId =
    hashOrderId && initialOrders.some((order) => order.orderId === hashOrderId)
      ? hashOrderId
      : defaultOpenOrderId(initialOrders, pageLoadNow);

  if (openOrderId) {
    const opened = findOrder(storage, openOrderId);
    if (opened) {
      const viewNumber = recordTrackerView(storage, opened.orderId);
      track('tracker_viewed', {
        order_id: opened.orderId,
        minutes_since_order: minutesSinceOrder(opened),
        view_number: viewNumber,
      });
    }
  }

  function onSelectOrder(orderId: string): void {
    openOrderId = orderId;
    render();
  }

  function render(): void {
    checkDelivery(storage);
    // #174: sweep on every render, so a level reached since the last tick
    // shows immediately — docs/design/162-*, "The ledger": "It runs on the
    // tracker's render, on checkout mount, and inside placeOrder before
    // capOrders."
    const vipLedger = sweepVipLedger(storage, Date.now());
    const orders = getOrders(storage);
    renderTrackerView(
      root,
      orders,
      openOrderId,
      openRatingSheetManual,
      onSelectOrder,
      onOrderAgainFromHistory,
      onOrderAgainFromDelivered,
      Date.now(),
      vipLedger,
      getStoredCity(storage) ?? 'sf',
      tipRowStateFor,
      trackerImageCache,
    );
  }

  // --- Tip wallet plumbing (#171; docs/design/162-*, "Tips") ---
  //
  // D1, restated: absent config, a gate probe that fails or times out, and
  // `wallet_get` failing for a real session all resolve to `dark` — every
  // one of them the exact posture checkout-dom.ts's own wallet resolution
  // takes, redrawn here rather than shared with it (neither screen's own
  // DOM depends on the other's). `walletState` starts `null` (still
  // resolving) and `tipRowStateFor` reads that as dark too, so the very
  // first render — before the gate has ever answered — shows no tip control
  // rather than guessing live.
  const tipSessionStorage = walletDeps.sessionStorage ?? window.sessionStorage;
  const PENDING_TIP_ORDER_KEY = 'parody.pendingTipOrderId';

  function readPendingTipOrderId(): string | null {
    return tipSessionStorage.getItem(PENDING_TIP_ORDER_KEY);
  }
  function writePendingTipOrderId(orderId: string): void {
    tipSessionStorage.setItem(PENDING_TIP_ORDER_KEY, orderId);
  }
  function clearPendingTipOrderId(): void {
    tipSessionStorage.removeItem(PENDING_TIP_ORDER_KEY);
  }

  let walletConfig: WalletEnvConfig | null = null;
  let walletState: TrackerWalletState | null = null;
  const openTipPanels = new Set<string>();
  const tipSelectedPreset = new Map<string, number>();
  const tipSending = new Set<string>();
  const tipErrors = new Map<string, string>();
  const tipBlocked = new Set<string>();
  let signInPromptHandle: { close: () => void; element: HTMLElement } | null = null;

  function walletNavigate(url: string): void {
    if (walletDeps.navigateToOAuth) walletDeps.navigateToOAuth(url);
    else window.location.href = url;
  }

  async function resolveWalletState(config: WalletEnvConfig): Promise<TrackerWalletState> {
    const createAuth = walletDeps.createAuth ?? createSupabaseAuth;
    const fetchImpl = walletDeps.fetchImpl;

    const gate = await probeWalletGate(config, fetchImpl);
    if (!gate.ready) return { kind: 'dark' };

    let auth: SupabaseAuthLike;
    try {
      auth = await createAuth(config);
    } catch {
      return { kind: 'dark' };
    }

    const url = new URL(walletDeps.locationHref ?? window.location.href);
    let session: WalletSession | null;
    if (isOAuthReturn(url)) {
      const result = await completeOAuthReturn(auth, url);
      session = result.session;
      const replaceUrl = walletDeps.replaceUrl ?? ((next: string) => window.history.replaceState({}, '', next));
      replaceUrl(stripOAuthParams(url).toString());
      // #162's "Returning from OAuth lands on /tracker/ with that row's tip
      // panel open" — the order id was stashed before the redirect started
      // (`handleTipProviderTap`), the same `sessionStorage`-across-navigation
      // pattern checkout-dom.ts's own pending order uses.
      if (session) {
        const pendingOrderId = readPendingTipOrderId();
        if (pendingOrderId) openTipPanels.add(pendingOrderId);
      }
      clearPendingTipOrderId();
    } else {
      session = await getCurrentSession(auth);
    }

    if (!session) return { kind: 'signed-out', auth, providers: gate.providers };

    const balances = await getWallet({ url: config.url, publishableKey: config.publishableKey, accessToken: session.accessToken, fetchImpl });
    if (!balances) return { kind: 'dark' };

    return { kind: 'signed-in', auth, session, balances };
  }

  function handleTipSignIn(orderId: string): void {
    if (!walletState || walletState.kind !== 'signed-out' || signInPromptHandle) return;
    signInPromptHandle = renderSignInPrompt(
      walletState.providers,
      (provider) => void handleTipProviderTap(provider, orderId),
      () => {
        signInPromptHandle = null;
      },
      { heading: 'Sign in to tip' },
    );
    (root.parentElement ?? root).append(signInPromptHandle.element);
    signInPromptHandle.element.querySelector<HTMLElement>('.sheet')?.focus();
  }

  async function handleTipProviderTap(provider: OAuthProvider, orderId: string): Promise<void> {
    const signedOut = walletState;
    if (!signedOut || signedOut.kind !== 'signed-out') return;
    writePendingTipOrderId(orderId);
    const currentHref = walletDeps.locationHref ?? window.location.href;
    const started = await beginSignIn(signedOut.auth, provider, currentHref, walletNavigate);
    if (!started) signInPromptHandle?.close();
  }

  async function handleCollectTipDrip(): Promise<void> {
    const signedIn = walletState;
    if (!signedIn || signedIn.kind !== 'signed-in') return;
    const result = await claimDrip({
      url: walletConfig!.url,
      publishableKey: walletConfig!.publishableKey,
      accessToken: signedIn.session.accessToken,
      fetchImpl: walletDeps.fetchImpl,
    });
    if (!result) return; // best-effort, matches wallet-dom.ts's own claim-failed posture: the block simply stays as it was.
    const updatedBalances: WalletBalances = {
      usdMinor: result.usdMinor,
      vndMinor: result.vndMinor,
      windowStart: signedIn.balances.windowStart,
      nextWindowStart: result.nextWindowStart,
      claimedThisWindow: true,
    };
    walletState = { ...signedIn, balances: updatedBalances };
    document.dispatchEvent(new CustomEvent(WALLET_BALANCE_CHANGED_EVENT, { detail: { usdMinor: result.usdMinor, vndMinor: result.vndMinor } }));
    render();
  }

  /** `wallet_tip` (#164), idempotent per `order_id` — the guard against a
   * double-tap sending two calls is `tipSending` itself, checked before the
   * request starts and before the amount is even read, not just the button's
   * own `disabled` (docs/design/162-*, "Send": "a double tap sends one
   * call"). */
  async function handleSendTip(orderId: string): Promise<void> {
    if (tipSending.has(orderId)) return;
    const signedIn = walletState;
    if (!signedIn || signedIn.kind !== 'signed-in') return;
    const target = findOrder(storage, orderId);
    if (!target) return;

    const presets = TIP_PRESETS_MINOR[target.currency];
    const balanceMinor = target.currency === 'USD' ? signedIn.balances.usdMinor : signedIn.balances.vndMinor;
    const amountMinor = tipSelectedPreset.get(orderId) ?? pickInitialPresetMinor(presets, balanceMinor);
    if (amountMinor > balanceMinor) return; // short balance — Send is aria-disabled; this guards a stale-click race.

    tipSending.add(orderId);
    tipErrors.delete(orderId);
    render();

    const result = await tipWallet({
      url: walletConfig!.url,
      publishableKey: walletConfig!.publishableKey,
      accessToken: signedIn.session.accessToken,
      fetchImpl: walletDeps.fetchImpl,
      orderId,
      amountMinor,
    });

    tipSending.delete(orderId);

    if (result.kind === 'unreachable') {
      tipErrors.set(orderId, "Couldn't send the tip. Nothing was taken. Try again.");
      render();
      return;
    }
    if (result.kind === 'blocked') {
      // D14 collapse (docs/design/162-*, "Send": "Refused ... collapse to
      // the D14 note") — no debit row for this account, nothing stored.
      tipBlocked.add(orderId);
      openTipPanels.delete(orderId);
      tipSelectedPreset.delete(orderId);
      render();
      return;
    }

    const updatedBalances: WalletBalances = { ...signedIn.balances, usdMinor: result.usdMinor, vndMinor: result.vndMinor };
    walletState = { ...signedIn, balances: updatedBalances };

    if (result.status === 'insufficient') {
      // #162's "Short balance": nothing stored, the panel stays open and
      // re-renders against the refreshed balance.
      render();
      return;
    }

    // 'tipped' or 'already_tipped' — the RPC's own echoed amount, not
    // necessarily the preset this tap sent (docs/design/162-* on
    // `storeTip`).
    storeTip(storage, orderId, result.amountMinor);
    openTipPanels.delete(orderId);
    tipSelectedPreset.delete(orderId);
    document.dispatchEvent(new CustomEvent(WALLET_BALANCE_CHANGED_EVENT, { detail: { usdMinor: result.usdMinor, vndMinor: result.vndMinor } }));
    render();
  }

  /** The panel's own initial pick (docs/design/162-*, "The tip panel": "The
   * middle preset is pre-selected, or the largest affordable one if the
   * middle is over the balance") is made once, the first render the panel is
   * open for, and stuck to from then on — never recomputed against a balance
   * that has since moved (a drip collected, or the RPC's own updated answer
   * after `insufficient`), which would otherwise silently swap the visitor's
   * selection out from under them mid-panel. */
  function ensureInitialPresetSelected(order: PlacedOrder): void {
    if (tipSelectedPreset.has(order.orderId) || !walletState || walletState.kind !== 'signed-in') return;
    const presets = TIP_PRESETS_MINOR[order.currency];
    const balanceMinor = order.currency === 'USD' ? walletState.balances.usdMinor : walletState.balances.vndMinor;
    tipSelectedPreset.set(order.orderId, pickInitialPresetMinor(presets, balanceMinor));
  }

  function tipRowStateFor(order: PlacedOrder): TipRowState {
    if (openTipPanels.has(order.orderId)) ensureInitialPresetSelected(order);
    return {
      walletState: walletState ?? { kind: 'dark' },
      panelOpen: openTipPanels.has(order.orderId),
      selectedPresetMinor: tipSelectedPreset.get(order.orderId) ?? null,
      sending: tipSending.has(order.orderId),
      errorMessage: tipErrors.get(order.orderId) ?? null,
      blocked: tipBlocked.has(order.orderId),
      onToggle: (orderId) => {
        if (openTipPanels.has(orderId)) {
          openTipPanels.delete(orderId);
          tipSelectedPreset.delete(orderId);
        } else {
          openTipPanels.add(orderId);
        }
        render();
      },
      onSignIn: handleTipSignIn,
      onSelectPreset: (orderId, amountMinor) => {
        tipSelectedPreset.set(orderId, amountMinor);
        render();
      },
      onSend: (orderId) => void handleSendTip(orderId),
      onCancel: (orderId) => {
        openTipPanels.delete(orderId);
        tipSelectedPreset.delete(orderId);
        tipErrors.delete(orderId);
        render();
      },
      onCollectDrip: () => void handleCollectTipDrip(),
    };
  }

  // AC1: a config that isn't there makes no request at all — `walletState`
  // resolves to `dark` synchronously, the same "no `await` in the way" rule
  // #149's checkout wallet gate follows.
  walletConfig = walletDeps.config === undefined ? readWalletEnvConfig() : walletDeps.config;
  if (walletConfig) {
    void resolveWalletState(walletConfig).then((resolved) => {
      walletState = resolved;
      render();
    });
  } else {
    walletState = { kind: 'dark' };
  }

  // #163's multi-order rule (docs/design/162-*, "Two orders landing together"
  // / "Timing"): re-decided on every render tick, not just at load, so an
  // order that reaches Delivered while the tracker is already open (the
  // watched-landing case) is caught the moment it qualifies rather than only
  // on the next reload. `ratingSheetClaimed` is set the instant an order is
  // chosen — before its delay even starts — and never cleared, which is what
  // stops a second qualifying order from ever queuing or chaining behind the
  // first: once claimed, every further qualifying order (including the
  // claimed one re-selected on a later tick, before its own prompted flag is
  // written) is only marked prompted here, and this module never opens a
  // second sheet for the rest of this page load, open or already closed.
  let ratingSheetClaimed = false;
  let ratingSheetOpen = false;

  function evaluateRatingPrompt(now: number): void {
    const decision = decideRatingPrompt(getOrders(storage), openOrderId, now);
    for (const passedOverId of decision.passedOverOrderIds) {
      markRatingPrompted(storage, passedOverId);
    }
    if (!decision.openOrderId) return;
    if (ratingSheetClaimed) {
      markRatingPrompted(storage, decision.openOrderId);
      return;
    }

    const target = findOrder(storage, decision.openOrderId);
    if (!target) return;
    ratingSheetClaimed = true;
    const orderId = decision.openOrderId;
    // Watched it land: not yet Delivered when the page first loaded, so the
    // visitor saw the stepper finish live — 1.4s, so the Delivered stamp is
    // seen first. Otherwise it was already Delivered at load (a return
    // visit) — 600ms (docs/design/162-*, "Timing").
    const watchedItLand = !isDelivered(target, pageLoadNow);
    window.setTimeout(
      () => {
        if (ratingSheetOpen) return; // re-check nothing else opened meanwhile
        openRatingSheetFor(orderId);
      },
      watchedItLand ? 1400 : 600,
    );
  }

  /** The callbacks #163's sheet needs, shared by the auto-open path and a
   * manual Rate tap from history — the only difference between the two is
   * whether `markRatingPrompted` runs first (#165: "A manual Rate open does
   * not touch ratingPromptedAt"). Both share `submitRating`'s own guard, so
   * `rating_submitted` still fires at most once per `order_id` however the
   * sheet was reached. */
  function ratingSheetCallbacks(orderId: string): Omit<RatingSheetOptions, 'order'> {
    // #166: "the first step submitted for an order unlocks one" — neither
    // half rated yet is exactly "the first step," whichever of driver/
    // restaurant it turns out to be. A second step for this same order, or a
    // later history rating, finds one half already set and unlocks nothing
    // more (docs/design/162-*, "The thanks voucher").
    let thanksVoucherUnlock: ThanksVoucherUnlock | null = null;
    function maybeUnlockThanksVoucher(): void {
      const target = findOrder(storage, orderId);
      if (!target || target.rating !== null || target.driverRating !== null) return;
      const city: City = target.currency === 'VND' ? 'hcmc' : 'sf';
      thanksVoucherUnlock = unlockThanksVoucher(storage, city, orderId, Date.now());
    }
    return {
      onSubmitDriverRating: (stars) => {
        maybeUnlockThanksVoucher();
        submitDriverRating(storage, orderId, stars);
        render();
      },
      onSubmitRestaurant: (stars, tags) => {
        maybeUnlockThanksVoucher();
        const updated = submitRating(storage, orderId, stars, tags);
        if (!updated) return;
        track('rating_submitted', { order_id: orderId, stars, tags });
        render();
      },
      onClose: () => {
        ratingSheetOpen = false;
        render();
      },
      getThanksVoucherUnlock: () => thanksVoucherUnlock,
      // #169's VIP nudge (docs/design/162-*, "The win's VIP nudge") — a
      // read-only snapshot; the sweep that actually updates the ledger
      // already ran inside this same submit's `render()` call above.
      getVipLedger: () => readVipLedger(storage),
    };
  }

  function openRatingSheetFor(orderId: string): void {
    const target = findOrder(storage, orderId);
    if (!target) return;
    markRatingPrompted(storage, orderId);
    ratingSheetOpen = true;
    openRatingSheet({ order: target, ...ratingSheetCallbacks(orderId) });
  }

  /** A manual Rate tap from a history row (#165) — never marks the order
   * prompted, since that flag is reserved for the auto-open rule (#162's
   * "A manual Rate open does not touch ratingPromptedAt"). */
  function openRatingSheetManual(orderId: string): void {
    const target = findOrder(storage, orderId);
    if (!target) return;
    ratingSheetOpen = true;
    openRatingSheet({ order: target, ...ratingSheetCallbacks(orderId) });
  }

  let toastEl: HTMLElement | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  function dismissToast(): void {
    toastEl?.remove();
    toastEl = null;
    if (toastTimer !== null) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
  }

  /** The history-row Order again toast (#165, docs/design/162-*, "Order
   * again": "stays on the tracker and shows a toast ... lasts 6s, and pauses
   * while focused or hovered"). Never fires an event (AC3). */
  function showOrderAgainToast(restaurantName: string, restaurantSlug: string, availableCount: number, totalCount: number): void {
    dismissToast();
    const toast = document.createElement('div');
    toast.className = 'tracker-toast';
    toast.setAttribute('data-testid', 'tracker-order-again-toast');
    toast.setAttribute('role', 'status');
    const message =
      availableCount < totalCount
        ? `${availableCount} of ${totalCount} items are still on the menu. `
        : `Order again: ${availableCount} item${availableCount === 1 ? '' : 's'} from ${restaurantName} are in your cart. `;
    toast.append(message);
    const link = document.createElement('a');
    link.href = cartPath(restaurantSlug);
    link.textContent = 'View cart';
    toast.append(link);
    (root.parentElement ?? root).append(toast);
    toastEl = toast;

    function schedule(): void {
      toastTimer = setTimeout(dismissToast, 6000);
    }
    toast.addEventListener('mouseenter', () => {
      if (toastTimer !== null) {
        clearTimeout(toastTimer);
        toastTimer = null;
      }
    });
    toast.addEventListener('mouseleave', schedule);
    toast.addEventListener('focusin', () => {
      if (toastTimer !== null) {
        clearTimeout(toastTimer);
        toastTimer = null;
      }
    });
    toast.addEventListener('focusout', schedule);
    schedule();
  }

  /** Order again (#165, docs/design/162-*, "Order again") — fires no event
   * (AC3). `restaurant` is only ever passed for a slug that still resolves
   * (both callers only render the control then), so the "opens the
   * restaurant page instead" branch is the sole no-menu-item fallback. */
  function onOrderAgain(order: PlacedOrder, restaurant: Restaurant, surface: 'history' | 'delivered'): void {
    const restaurantSlug = restaurant.slug;
    const restaurantName = order.items[0]?.restaurantName ?? restaurant.name;
    const result = orderAgainLines(order);

    if (result.availableCount === 0) {
      navigate(`/restaurants/${restaurantSlug}/`);
      return;
    }

    function commit(): void {
      setRestaurantCart(storage, restaurantSlug, result.lines);
      if (surface === 'delivered') {
        navigate(cartPath(restaurantSlug));
      } else {
        showOrderAgainToast(restaurantName, restaurantSlug, result.availableCount, result.totalCount);
      }
    }

    const existing = linesForRestaurant(getCart(storage), restaurantSlug);
    if (existing.length > 0) {
      openConfirmDialog({
        title: `Replace your ${restaurantName} cart?`,
        body: `It has ${cartItemCount(existing)} item${cartItemCount(existing) === 1 ? '' : 's'}. Order again puts in the ${cartItemCount(result.lines)} from this order instead.`,
        confirmLabel: 'Replace',
        cancelLabel: 'Keep my cart',
        onConfirm: commit,
        // "Keep goes to that cart unchanged" (#162, "Order again") — the
        // cart is untouched either way, so there is nothing to toast.
        onCancel: () => navigate(cartPath(restaurantSlug)),
      });
      return;
    }

    commit();
  }

  function onOrderAgainFromHistory(order: PlacedOrder, restaurant: Restaurant): void {
    onOrderAgain(order, restaurant, 'history');
  }

  function onOrderAgainFromDelivered(order: PlacedOrder, restaurant: Restaurant): void {
    onOrderAgain(order, restaurant, 'delivered');
  }

  function tick(): void {
    render();
    evaluateRatingPrompt(Date.now());
  }

  tick();

  // Ticks every second (#121 AC4) — the live countdown depends on it, not
  // just the stepper advancing, and it's what lets the rating prompt above
  // catch an order the moment it reaches Delivered rather than only at load.
  const intervalId = window.setInterval(tick, 1000);
  return () => window.clearInterval(intervalId);
}
