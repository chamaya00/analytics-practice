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
import { currencyForCity, formatMoney, type City } from './money';
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

// 105-tracker.html's own rail dot: a checkmark once a step is reached
// (current or done), nothing inside it while still ahead. Reused for the
// history row's "Delivered" state (#148), and for #162's Delivered hero
// stamp and done rail below — same mark, a muted colour on the history row.
const CHECK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M5 13l4 4 10-10" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const CHEVRON_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

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
 * a broken image. */
function renderThumb(className: string, restaurant: Restaurant | undefined): HTMLElement {
  if (restaurant) {
    const img = document.createElement('img');
    img.className = className;
    img.src = restaurant.heroImage;
    img.alt = '';
    return img;
  }
  const placeholder = document.createElement('div');
  placeholder.className = `${className} tracker-thumb-placeholder`;
  return placeholder;
}

/** A driver's headshot — falls back to a plain initial disc rather than a
 * broken image if the id has no avatar file (#147, "Partial / error" state;
 * shouldn't happen, since scripts/generate-driver-avatars.mjs covers every
 * id in drivers.ts, but the fallback costs nothing). */
function renderDriverAvatar(className: string, driver: PlacedOrder['driver']): HTMLElement {
  const img = document.createElement('img');
  img.className = className;
  img.src = `/avatars/drivers/${driver.id}.svg`;
  img.alt = '';
  img.addEventListener('error', () => {
    const fallback = document.createElement('span');
    fallback.className = `${className} tracker-avatar-fallback`;
    fallback.textContent = driver.name.charAt(0);
    img.replaceWith(fallback);
  });
  return img;
}

/** The driver slot (#147, "Driver slot") — a fixed-height area holding
 * either the pending-driver placeholder (before Picked up) or the driver
 * card (Picked up onward), so nothing below it jumps when a driver appears. */
function renderDriverSlot(order: PlacedOrder, view: TrackerView, city: Restaurant['city']): HTMLElement {
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

  const avatar = renderDriverAvatar('tracker-driver-avatar', order.driver);
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

/** #162's celebratory Delivered hero (docs/design/162-*, "Delivered") — the
 * check stamp, "Delivered", the early/on-time line, and the time line.
 * Replaces the old plain "Delivered N min ago" line entirely; it is never
 * shown for a live order. */
function renderDeliveredHero(order: PlacedOrder, city: Restaurant['city'], now: number): HTMLElement {
  const hero = document.createElement('div');
  hero.className = 'tracker-delivered-hero';
  hero.setAttribute('data-testid', 'tracker-delivered-hero');

  const stamp = document.createElement('span');
  stamp.className = 'tracker-delivered-stamp';
  stamp.setAttribute('aria-hidden', 'true');
  stamp.innerHTML = CHECK_ICON;
  hero.append(stamp);

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
  now: number = Date.now(),
): HTMLElement {
  const card = document.createElement('section');
  card.className = 'tracker-order-card';
  card.setAttribute('data-testid', 'tracker-open-card');

  const restaurant = getRestaurant(order.items[0]?.restaurantSlug ?? '');
  const city = restaurant?.city ?? 'sf';

  const head = document.createElement('div');
  head.className = 'tracker-card-head';
  head.append(renderThumb('tracker-thumb', restaurant));
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
    card.append(renderDeliveredHero(order, city, now));
    card.append(renderDoneRail());
  }

  card.append(renderDriverSlot(order, view, city));

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
function renderOrderRow(order: PlacedOrder, view: TrackerView, onSelect: (orderId: string) => void): HTMLElement {
  const restaurant = getRestaurant(order.items[0]?.restaurantSlug ?? '');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tracker-order-row';
  button.setAttribute('data-testid', 'tracker-order-row');
  button.setAttribute('data-order-id', order.orderId);
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', () => onSelect(order.orderId));

  button.append(renderThumb('tracker-row-thumb', restaurant));

  const mid = document.createElement('span');
  mid.className = 'tracker-row-mid';
  const name = document.createElement('span');
  name.className = 'tracker-row-name';
  name.textContent = order.items[0]?.restaurantName ?? '';
  const status = document.createElement('span');
  status.className = 'tracker-row-status';
  const stepIndex = view.kind === 'active' ? view.currentStepIndex : STEPS.length - 1;
  if (stepIndex >= 2) {
    status.append(renderDriverAvatar('tracker-row-driver-avatar', order.driver));
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

/** A past order — Rate (#163's sheet, at whichever step is unrated) and Order
 * again (#162's rule) alongside #147's read-only content; an empty slot is
 * left for #171's Tip control, which this issue does not build. */
function renderHistoryRow(
  order: PlacedOrder,
  onRate: (orderId: string) => void,
  onOrderAgain: (order: PlacedOrder, restaurant: Restaurant) => void,
): HTMLElement {
  const restaurant = getRestaurant(order.items[0]?.restaurantSlug ?? '');
  const li = document.createElement('li');
  li.className = 'tracker-history-row';
  li.setAttribute('data-testid', 'tracker-history-row');
  li.append(renderThumb('tracker-history-thumb', restaurant));

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
  by.append(renderDriverAvatar('tracker-history-driver-avatar', order.driver), order.driver.name);
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

  // #171's Tip control mounts here — deliberately empty until that issue
  // ships (this issue's driver brief: "leave a clear spot on the row").
  const tipSlot = document.createElement('div');
  tipSlot.className = 'tracker-history-tip-slot';
  tipSlot.setAttribute('data-testid', 'tracker-history-tip-slot');
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

  live.append(renderOpenCard(openOrder, computeTrackerView(openOrder, now), onRate, onOrderAgainFromDelivered, now));
  for (const order of stack.live) {
    if (order.orderId === openOrderId) continue;
    live.append(renderOrderRow(order, computeTrackerView(order, now), onSelectOrder));
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
      list.append(renderHistoryRow(order, onRate, onOrderAgainFromHistory));
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
    );
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
