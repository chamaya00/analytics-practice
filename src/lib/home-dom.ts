// Home feed (docs/design/80-two-city-brand-and-flow.md, screens 1 and 2;
// carousel/header/grid per docs/design/137-carousel-header-tiles.md): `/`
// replaces both the old landing page and `/restaurants` — a real delivery
// app opens directly onto its feed. Renders the location picker (first
// visit or no persisted city) or the current city's feed (city pill in the
// header, search, promo carousel, cuisine shortcuts, a 2-column tile grid).

import { CITIES, CITY_CURRENCY, CITY_NAMES, formatMoneyForCity, type City } from './money';
import { getStoredCity, setStoredCity } from './location';
import { CITY_CHANGED_EVENT } from './city-events';
import { CUISINE_SHORTCUTS, restaurantsForCity, getRestaurant, type Restaurant } from './restaurants';
import { getVisitorId } from './order-store';
import { estimateEtaMinutes, etaLabel } from './eta';
import { formatReviewCount } from './reviews';
import { createVehicleIcon } from './vehicle-icon';
import { track } from './tracking';
import {
  ensureFlashDraw,
  flashFeeForRestaurant,
  flashSecondsRemaining,
  isFlashLive,
  setFlashDrawState,
  type FlashDraw,
} from './flash-deal';
import { renderFlashReopenBar, renderFlashSheet } from './flash-sheet-dom';
import { gestureAxis } from './swipe-row';

const STORAGE_PROBE_KEY = 'parody.storageProbe';

/** The carousel's first-order slide claim (docs/design/80-two-city-brand-and-flow.md's
 * original banner copy, carried forward unchanged — docs/design/137-carousel-header-tiles.md's
 * "seventh slide"), localized per city's own currency. Other code may still read the
 * full sentence, so this stays unchanged even though the panel itself now renders the
 * amount and "Your first order" as two separate elements — see PROMO_BANNER_AMOUNT. */
const PROMO_BANNER_CLAIM: Record<City, string> = {
  sf: '$2 off your first order',
  hcmc: '10.000 ₫ off your first order',
};

/** Just the amount ("$2 off" / "10.000 ₫ off"), for the ticket graphic's own value/off
 * split (docs/design/137-carousel-header-tiles.md, "First-order banner", #184). */
const PROMO_BANNER_AMOUNT: Record<City, string> = {
  sf: '$2 off',
  hcmc: '10.000 ₫ off',
};

/** HCMC's longer currency string doesn't fit the ticket at the base size and needs the
 * doc's `--compact` modifier; SF's stays at the base size (design doc, "First-order
 * banner": the compact size is applied "only for the long (HCMC) string"). */
const PROMO_BANNER_AMOUNT_COMPACT: Record<City, boolean> = {
  sf: false,
  hcmc: true,
};

/** Component-scoped mask id for the ticket's notch cutouts (docs/design/137's four mocks
 * each suffix this per file since only one instance of this slide exists in the DOM at
 * once, this module only ever renders one). */
const TICKET_NOTCH_MASK_ID = 'carousel-ticket-notch';

/** The ticket/coupon silhouette (docs/design/137-carousel-header-tiles.md, "First-order
 * banner": 148x104 viewBox, notch circles at cx=8/cx=140, r=9, cy=52, tear line at x=42)
 * — copied from the four mocks rather than redrawn, decorative so it's aria-hidden. */
const TICKET_SVG = `<svg viewBox="0 0 148 104" aria-hidden="true">
  <mask id="${TICKET_NOTCH_MASK_ID}">
    <rect x="0" y="0" width="148" height="104" fill="#ffffff"/>
    <circle cx="8" cy="52" r="9" fill="#000000"/>
    <circle cx="140" cy="52" r="9" fill="#000000"/>
  </mask>
  <path fill="#ffffff" mask="url(#${TICKET_NOTCH_MASK_ID})" d="M16,6 L132,6 A8,8 0 0 1 140,14 L140,90 A8,8 0 0 1 132,98 L16,98 A8,8 0 0 1 8,90 L8,14 A8,8 0 0 1 16,6 Z"/>
  <line x1="42" y1="14" x2="42" y2="90" stroke="#0b2e29" stroke-width="1.5" stroke-dasharray="3 4" opacity="0.3"/>
</svg>`;

/** Six restaurants per city, three ad slides and three promo slides, all named and
 * sourced against the catalogue by docs/design/137-carousel-header-tiles.md's "Content
 * picked" section — order fixed there too (first-order, then alternating ad/promo). */
const CAROUSEL_RESTAURANT_SLIDES: Record<City, Array<{ type: 'ad' | 'promo'; slug: string; claim?: string }>> = {
  sf: [
    { type: 'ad', slug: 'mission-taqueria' },
    { type: 'promo', slug: 'north-beach-pizzeria', claim: 'Free Garlic knots with a $20 minimum' },
    { type: 'ad', slug: 'inner-richmond-sushi-bar' },
    { type: 'promo', slug: 'noe-valley-morning-kitchen', claim: 'Buy 1 get 1 free: Buttermilk pancakes' },
    { type: 'ad', slug: 'ocean-beach-fish-house' },
    { type: 'promo', slug: 'valencia-street-tandoor', claim: 'Free Mango lassi with a $18 minimum' },
  ],
  hcmc: [
    { type: 'ad', slug: 'ben-thanh-banh-mi' },
    { type: 'promo', slug: 'saigon-pho-quan', claim: 'Free Gỏi cuốn with an 80.000 ₫ minimum' },
    { type: 'ad', slug: 'hu-tieu-nam-vang-hoa-phat' },
    { type: 'promo', slug: 'bun-cha-co-ba', claim: 'Buy 1 get 1 free: Bún chả Hà Nội' },
    { type: 'ad', slug: 'quan-lau-ut-hanh' },
    { type: 'promo', slug: 'bo-bit-tet-chu-tam-go-vap', claim: 'Free Khoai tây chiên with a 150.000 ₫ minimum' },
  ],
};

interface CarouselSlide {
  type: 'first-order' | 'ad' | 'promo';
  claim: string;
  sub: string;
  photo: string | null;
  href: string | null;
}

function carouselSlidesForCity(city: City): CarouselSlide[] {
  const firstOrder: CarouselSlide = {
    type: 'first-order',
    claim: PROMO_BANNER_CLAIM[city],
    sub: 'Applied automatically at checkout',
    photo: null,
    href: null,
  };

  const restaurantSlides: CarouselSlide[] = CAROUSEL_RESTAURANT_SLIDES[city].map((spec) => {
    const restaurant = getRestaurant(spec.slug)!;
    const isAd = spec.type === 'ad';
    return {
      type: spec.type,
      claim: isAd ? restaurant.name : spec.claim!,
      sub: isAd ? `${restaurant.cuisineTag} · ★ ${restaurant.rating.toFixed(1)}` : restaurant.name,
      photo: restaurant.heroImage,
      href: `/restaurants/${restaurant.slug}/`,
    };
  });

  // The first-order slide sits 4th of 7, not 1st (docs/design/137-carousel-header-tiles.md,
  // "Slide order," per #184) — CAROUSEL_RESTAURANT_SLIDES' own six-entry order is unchanged,
  // only where the first-order slide splices into the combined sequence moves.
  return [...restaurantSlides.slice(0, 3), firstOrder, ...restaurantSlides.slice(3)];
}

const CAROUSEL_ADVANCE_MS = 5000;
const CAROUSEL_RESUME_MS = 5000;
/** A horizontal drag past this many px, more horizontal than vertical (`gestureAxis`,
 * ./swipe-row), is a swipe; short of it, or more vertical, and the page's own
 * scroll wins (driver review, PR #150 round 1, item 3). */
const CAROUSEL_SWIPE_PX = 40;

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const PAUSE_ICON = '<path d="M8 5v14M16 5v14" stroke-linecap="round" stroke-linejoin="round"/>';
const PLAY_ICON = '<path d="M7 5v14l12-7Z" stroke-linejoin="round"/>';

/** Renders the 7-slide promo carousel (docs/design/137-carousel-header-tiles.md,
 * "Promo carousel" and "Motion, named") — auto-advances every 5s, pauses on
 * touch/pointer/focus interaction and resumes ~5s after it ends, never
 * auto-advances under `prefers-reduced-motion: reduce`, and the explicit
 * pause control is the only thing that stops rotation for good. `destroy()`
 * must be called before a re-render starts a second interval (#133's own
 * "traps" section) — `renderFeed` below does this via `carouselCleanups`. */
function renderCarousel(city: City): { element: HTMLElement; destroy: () => void } {
  const slides = carouselSlidesForCity(city);
  let current = 0;
  let advanceInterval: ReturnType<typeof setInterval> | null = null;
  let resumeTimeout: ReturnType<typeof setTimeout> | null = null;
  let pausedForGood = false;

  const carousel = document.createElement('div');
  carousel.className = 'carousel';
  carousel.setAttribute('data-testid', 'carousel');
  carousel.setAttribute('role', 'group');
  carousel.setAttribute('aria-roledescription', 'carousel');
  carousel.setAttribute('aria-label', 'Promotions');

  const slideEl = document.createElement('div');
  slideEl.className = 'carousel-slide';
  slideEl.setAttribute('data-testid', 'carousel-slide');
  slideEl.setAttribute('role', 'group');
  slideEl.setAttribute('aria-roledescription', 'slide');

  const media = document.createElement('div');
  media.className = 'carousel-slide-media';

  const pauseButton = document.createElement('button');
  pauseButton.type = 'button';
  pauseButton.className = 'carousel-pause';
  pauseButton.setAttribute('data-testid', 'carousel-pause');
  // The button is the full 44px hit area; the visible scrim disc is this
  // smaller inner mark, same split as .carousel-dot/.carousel-dot-mark below
  // (driver review, PR #150 round 1, item 5 — the mock's chip reads much
  // smaller than a 44px disc).
  const pauseMark = document.createElement('span');
  pauseMark.className = 'carousel-pause-mark';
  pauseButton.append(pauseMark);
  media.append(pauseButton);

  const caption = document.createElement('div');
  caption.className = 'carousel-caption';
  const claimEl = document.createElement('span');
  claimEl.className = 'carousel-claim';
  claimEl.setAttribute('data-testid', 'carousel-claim');
  const subEl = document.createElement('span');
  subEl.className = 'carousel-sub';
  subEl.setAttribute('data-testid', 'carousel-sub');
  caption.append(claimEl, subEl);

  const dotsRow = document.createElement('div');
  dotsRow.className = 'carousel-dots';
  dotsRow.setAttribute('data-testid', 'carousel-dots');

  const dots: HTMLButtonElement[] = slides.map((_slide, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'carousel-dot';
    dot.setAttribute('data-testid', `carousel-dot-${index}`);
    dot.setAttribute('aria-label', `Go to slide ${index + 1}`);
    const mark = document.createElement('span');
    mark.className = 'carousel-dot-mark';
    dot.append(mark);
    dot.addEventListener('click', () => {
      goToSlide(index);
      pauseAndScheduleResume();
    });
    dotsRow.append(dot);
    return dot;
  });

  function stopAutoAdvance(): void {
    if (advanceInterval !== null) {
      clearInterval(advanceInterval);
      advanceInterval = null;
    }
  }

  function clearResumeTimeout(): void {
    if (resumeTimeout !== null) {
      clearTimeout(resumeTimeout);
      resumeTimeout = null;
    }
  }

  function startAutoAdvance(): void {
    if (pausedForGood || prefersReducedMotion()) return;
    stopAutoAdvance();
    advanceInterval = setInterval(() => goToSlide(current + 1), CAROUSEL_ADVANCE_MS);
  }

  /** The temporary pause while a touch/pointer/focus interaction is ongoing —
   * distinct from the pause button's "for good" stop below. */
  function pauseTemporarily(): void {
    stopAutoAdvance();
    clearResumeTimeout();
  }

  function scheduleResume(): void {
    clearResumeTimeout();
    if (pausedForGood) return;
    resumeTimeout = setTimeout(() => {
      resumeTimeout = null;
      startAutoAdvance();
    }, CAROUSEL_RESUME_MS);
  }

  function pauseAndScheduleResume(): void {
    stopAutoAdvance();
    scheduleResume();
  }

  function updatePauseButton(): void {
    const label = pausedForGood ? 'Play carousel' : 'Pause carousel';
    pauseButton.setAttribute('aria-label', label);
    pauseButton.setAttribute('aria-pressed', pausedForGood ? 'true' : 'false');
    pauseMark.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${pausedForGood ? PLAY_ICON : PAUSE_ICON}</svg>`;
  }

  pauseButton.addEventListener('click', () => {
    pausedForGood = !pausedForGood;
    updatePauseButton();
    if (pausedForGood) {
      stopAutoAdvance();
      clearResumeTimeout();
    } else {
      startAutoAdvance();
    }
  });

  function renderSlideContent(): void {
    const slide = slides[current];
    const isFirstOrder = slide.type === 'first-order';

    const oldLink = media.querySelector('.carousel-slide-link');
    if (oldLink) oldLink.remove();

    const link = document.createElement(slide.href ? 'a' : 'div');
    link.className = 'carousel-slide-link';
    link.setAttribute('data-testid', 'carousel-slide-link');
    if (slide.href) (link as HTMLAnchorElement).href = slide.href;

    if (slide.photo) {
      const img = document.createElement('img');
      img.className = 'carousel-slide-photo';
      // Slide 0 is now the carousel's on-load, first-paint slide (docs/design/137,
      // #184's reordering) — its photo can't wait for a lazy decode. Every other
      // slide's image stays lazy.
      img.loading = current === 0 ? 'eager' : 'lazy';
      img.alt = '';
      img.src = slide.photo;
      link.append(img);
    } else {
      // The first-order slide has no photo (docs/design/137's "Image budget" — it
      // stays image-free). Its claim/sub render here instead, in a gradient/ticket
      // banner (#184, "First-order banner") rather than the old tinted panel — the
      // caption strip below stays empty for this slide rather than repeating the
      // same text twice.
      const panel = document.createElement('div');
      panel.className = 'carousel-slide-panel';
      panel.setAttribute('data-testid', 'carousel-panel');

      const ticket = document.createElement('div');
      ticket.className = 'carousel-slide-panel-ticket';
      ticket.innerHTML = TICKET_SVG;

      const amount = PROMO_BANNER_AMOUNT[city];
      const amountValue = amount.replace(/\s*off$/, '');
      const amountEl = document.createElement('span');
      amountEl.className = 'carousel-slide-panel-amount';
      amountEl.setAttribute('data-testid', 'carousel-panel-amount');
      const amountValueEl = document.createElement('span');
      amountValueEl.className = 'carousel-slide-panel-amount-value';
      amountValueEl.classList.toggle('carousel-slide-panel-amount-value--compact', PROMO_BANNER_AMOUNT_COMPACT[city]);
      amountValueEl.textContent = amountValue;
      const amountOffEl = document.createElement('span');
      amountOffEl.className = 'carousel-slide-panel-amount-off';
      amountOffEl.textContent = 'off';
      amountEl.append(amountValueEl, amountOffEl);
      ticket.append(amountEl);

      const copy = document.createElement('div');
      copy.className = 'carousel-slide-panel-copy';
      const panelClaim = document.createElement('span');
      panelClaim.className = 'carousel-slide-panel-claim';
      panelClaim.setAttribute('data-testid', 'carousel-panel-claim');
      panelClaim.textContent = 'Your first order';
      const panelSub = document.createElement('span');
      panelSub.className = 'carousel-slide-panel-sub';
      panelSub.setAttribute('data-testid', 'carousel-panel-sub');
      panelSub.textContent = slide.sub;
      copy.append(panelClaim, panelSub);

      // Ticket first in DOM order (screen reader meets the amount before "Your
      // first order", reconstructing the original sentence) even though CSS
      // row-reverse paints it last, on the right (docs/design/137, "Reading order").
      panel.append(ticket, copy);
      link.append(panel);
    }

    if (slide.type === 'ad') {
      const adLabel = document.createElement('span');
      adLabel.className = 'carousel-ad-label';
      adLabel.setAttribute('data-testid', 'carousel-ad-label');
      adLabel.textContent = 'Ad';
      link.append(adLabel);
    }

    media.prepend(link);

    // The first-order slide's claim/sub live in .carousel-slide-panel above,
    // not this strip, so the strip is hidden rather than left empty — an
    // empty-but-present .carousel-caption left a ~56px blank band between
    // the panel and the dots (driver review, PR #150 round 1; #151). The
    // media box grows by that same 56px (.carousel-slide-media--first-order)
    // so the slide's total height still matches every other slide.
    media.classList.toggle('carousel-slide-media--first-order', isFirstOrder);
    caption.hidden = isFirstOrder;
    claimEl.textContent = isFirstOrder ? '' : slide.claim;
    subEl.textContent = isFirstOrder ? '' : slide.sub;

    for (const [index, dot] of dots.entries()) {
      dot.classList.toggle('is-current', index === current);
      dot.setAttribute('aria-current', index === current ? 'true' : 'false');
    }
  }

  function goToSlide(index: number): void {
    current = ((index % slides.length) + slides.length) % slides.length;
    renderSlideContent();
  }

  for (const type of ['pointerdown', 'touchstart', 'focusin']) {
    carousel.addEventListener(type, pauseTemporarily);
  }
  for (const type of ['pointerup', 'touchend', 'focusout']) {
    carousel.addEventListener(type, scheduleResume);
  }

  // Swipe navigation (#133's own "can also be swiped", missed by #138's
  // split — driver review, PR #150 round 1, item 3). Pointer Events cover
  // touch the same way swipe-row.ts's cart-row drag already does; there is
  // no live drag-follow here (the design doc names none), so this only
  // reads the gesture on release, using the same axis lock (gestureAxis)
  // the cart row uses to tell a swipe from the page's own vertical scroll.
  let swipeStart: { pointerId: number; x: number; y: number } | null = null;

  carousel.addEventListener('pointerdown', (event) => {
    swipeStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  });

  carousel.addEventListener('pointerup', (event) => {
    if (!swipeStart || event.pointerId !== swipeStart.pointerId) return;
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    swipeStart = null;
    if (gestureAxis(dx, dy, CAROUSEL_SWIPE_PX) !== 'horizontal') return;
    goToSlide(current + (dx < 0 ? 1 : -1));
    pauseAndScheduleResume();
  });

  carousel.addEventListener('pointercancel', () => {
    swipeStart = null;
  });

  slideEl.append(media, caption);
  carousel.append(slideEl, dotsRow);

  renderSlideContent();
  updatePauseButton();
  startAutoAdvance();

  return {
    element: carousel,
    destroy(): void {
      stopAutoAdvance();
      clearResumeTimeout();
    },
  };
}

/** Storage-blocked (private browsing) is detected up front, not only after a failed write — #80's error state is a property of the sheet itself, shown before any tap rather than for the instant between a tap and the sheet dismissing. */
function isStorageBlocked(storage: Storage): boolean {
  try {
    storage.setItem(STORAGE_PROBE_KEY, '1');
    storage.removeItem(STORAGE_PROBE_KEY);
    return false;
  } catch {
    return true;
  }
}

/** Same in-memory fallback as the rest of this module's storage-blocked handling — the feed
 * still functions for this page load even though the ETA it shows won't persist to a reload. */
function safeVisitorId(storage: Storage): string {
  try {
    return getVisitorId(storage);
  } catch {
    return 'storage-blocked-visitor';
  }
}

function renderLocationPicker(root: HTMLElement, storage: Storage, onPicked: (city: City) => void): void {
  const sheet = document.createElement('div');
  sheet.className = 'location-picker';
  sheet.setAttribute('data-testid', 'location-picker');
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');

  const heading = document.createElement('h2');
  heading.textContent = 'Choose your city';
  sheet.append(heading);

  const cards = document.createElement('div');
  cards.className = 'location-cards';

  for (const city of CITIES) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'location-card';
    card.setAttribute('data-testid', `location-card-${city}`);

    const img = document.createElement('img');
    img.src = `/images/cities/${city}.jpg`;
    img.alt = '';
    img.width = 96;
    img.height = 64;

    const name = document.createElement('span');
    name.className = 'location-card-name';
    name.textContent = CITY_NAMES[city];

    const currencyNote = document.createElement('span');
    currencyNote.className = 'location-card-currency';
    currencyNote.textContent = city === 'sf' ? 'Prices in USD' : 'Prices in VND';

    card.append(img, name, currencyNote);
    card.addEventListener('click', () => {
      const previous = getStoredCity(storage);
      setStoredCity(storage, city);
      const isSwitch = previous !== null && previous !== city;
      track('location_selected', { city, is_switch: isSwitch });
      // The in-memory fallback: the sheet still functions for this page load
      // even when storage is blocked (the notice above already said so), so
      // the caller proceeds exactly as if the pick had been stored.
      onPicked(city);
    });
    cards.append(card);
  }

  sheet.append(cards);

  if (isStorageBlocked(storage)) {
    const notice = document.createElement('p');
    notice.className = 'location-blocked-notice';
    notice.setAttribute('data-testid', 'location-blocked-notice');
    notice.textContent = "Your city won't be remembered after you close this.";
    sheet.append(notice);
  }

  root.append(sheet);
}

function matchesFilter(restaurant: Restaurant, query: string, cuisine: string | null): boolean {
  if (cuisine && restaurant.cuisineTag !== cuisine) return false;
  if (!query) return true;
  const haystack = `${restaurant.name} ${restaurant.cuisineTag}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

/** A restaurant's flash fee, in minor units, while this session's draw is live for it — `null` otherwise (#87, "the effective delivery fee"). Read fresh on every render so the fee and the "Flash" badge disappear together the instant the window ends (AC4). */
function flashFeeFor(restaurant: Restaurant, draw: FlashDraw | null, now: number): number | null {
  if (!draw) return null;
  return flashFeeForRestaurant(draw, restaurant.city, restaurant.slug, restaurant.deliveryFeeMinor, now);
}

/** The "Near you" 2-column tile grid's own card (docs/design/137-carousel-header-tiles.md,
 * "Two-column tile grid") — a new class, `.tile-card`, not a restyle of `.restaurant-card`:
 * that class is still used, unchanged, by the cart list (cart-dom.ts) and the flash sheet
 * (flash-sheet-dom.ts), and restyling it in place would silently restyle both. */
function renderTileCard(restaurant: Restaurant, draw: FlashDraw | null, now: number, visitorId: string): HTMLElement {
  const card = document.createElement('a');
  card.className = 'tile-card';
  card.href = `/restaurants/${restaurant.slug}/`;
  card.setAttribute('data-testid', `restaurant-card-${restaurant.slug}`);

  const img = document.createElement('img');
  img.className = 'tile-card-photo';
  img.src = restaurant.heroImage;
  img.alt = '';
  img.loading = 'lazy';

  const body = document.createElement('div');
  body.className = 'tile-card-body';

  const name = document.createElement('span');
  name.className = 'tile-card-name';
  name.textContent = restaurant.name;

  const rating = document.createElement('span');
  rating.className = 'tile-card-rating';
  rating.textContent = `★ ${restaurant.rating.toFixed(1)} (${formatReviewCount(restaurant.reviewCount)})`;

  const flashFeeMinor = flashFeeFor(restaurant, draw, now);
  const effectiveFeeMinor = flashFeeMinor ?? restaurant.deliveryFeeMinor;

  const meta = document.createElement('span');
  meta.className = 'tile-card-meta';
  const feeLabel = effectiveFeeMinor === 0 ? 'Free' : formatMoneyForCity(effectiveFeeMinor, restaurant.city);
  const eta = etaLabel(estimateEtaMinutes(visitorId, restaurant.slug));
  // The tile grid's columns are much narrower than the old full-width rows
  // #130 fixed this on (2 per row at 375px, not 1) — moving the rating off
  // this line (#130's fix) isn't enough room here, so the fee and "delivery"
  // are their own non-wrapping unit instead: never split across two lines,
  // whichever line breaks before it (#151).
  const feeUnit = document.createElement('span');
  feeUnit.className = 'tile-card-fee';
  feeUnit.setAttribute('data-testid', 'tile-card-fee');
  feeUnit.textContent = `${feeLabel} delivery`;
  meta.append(createVehicleIcon(restaurant.city), `${eta} · `, feeUnit);

  body.append(name, rating, meta);

  if (restaurant.hasDeal) {
    const badge = document.createElement('span');
    badge.className = 'deal-badge';
    badge.setAttribute('data-testid', `deal-badge-${restaurant.slug}`);
    badge.textContent = 'Deal';
    card.append(badge);
  }

  if (flashFeeMinor !== null) {
    // A small badge beside the meta line, not a full-width bar underneath it
    // (#104) — appended inside .tile-card-meta itself so it sits on the same
    // line as the ETA/fee text rather than as its own row (#137's "Flash
    // badge: inline, next to the ETA/fee line").
    const flashBadge = document.createElement('span');
    flashBadge.className = 'flash-badge';
    flashBadge.setAttribute('data-testid', `flash-badge-${restaurant.slug}`);
    flashBadge.textContent = 'Flash';
    meta.append(flashBadge);
  }

  card.append(img, body);
  return card;
}

const carouselCleanups = new WeakMap<HTMLElement, () => void>();

function renderFeed(root: HTMLElement, pillRoot: HTMLElement, city: City, sessionStorage: Storage, visitorId: string): void {
  const now = Date.now();
  document.dispatchEvent(new CustomEvent(CITY_CHANGED_EVENT, { detail: { city } }));
  const initial = ensureFlashDraw(sessionStorage, city, now);
  const { isNewDraw } = initial;
  let draw = initial.draw;

  const feed = document.createElement('div');
  feed.className = 'home-feed';
  feed.setAttribute('data-testid', 'home-feed');

  pillRoot.innerHTML = '';
  const locationBar = document.createElement('button');
  locationBar.type = 'button';
  locationBar.className = 'location-bar';
  locationBar.setAttribute('data-testid', 'location-bar');
  locationBar.textContent = `${CITY_NAMES[city]} ▾`;
  locationBar.addEventListener('click', () => {
    root.innerHTML = '';
    renderLocationPicker(root, window.localStorage, (pickedCity) => {
      root.innerHTML = '';
      renderFeed(root, pillRoot, pickedCity, sessionStorage, visitorId);
    });
  });
  pillRoot.append(locationBar);

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'home-search';
  search.setAttribute('data-testid', 'home-search');
  search.setAttribute('placeholder', 'Search restaurants or cuisines');

  const carousel = renderCarousel(city);
  carouselCleanups.get(root)?.();
  carouselCleanups.set(root, carousel.destroy);

  const chipRow = document.createElement('div');
  chipRow.className = 'cuisine-chips';
  chipRow.setAttribute('data-testid', 'cuisine-chips');

  const nearYouHeading = document.createElement('h2');
  nearYouHeading.className = 'home-section-title';
  nearYouHeading.setAttribute('data-testid', 'near-you-heading');
  nearYouHeading.textContent = 'Near you';

  const tileGrid = document.createElement('div');
  tileGrid.className = 'tile-grid';
  tileGrid.setAttribute('data-testid', 'restaurant-list');

  const empty = document.createElement('p');
  empty.setAttribute('data-testid', 'home-empty');
  empty.hidden = true;

  let activeCuisine: string | null = null;

  function renderList(): void {
    const restaurants = restaurantsForCity(city);
    const matches = restaurants.filter((restaurant) => matchesFilter(restaurant, search.value, activeCuisine));

    const liveDraw = isFlashLive(draw, Date.now()) ? draw : null;

    tileGrid.innerHTML = '';
    for (const restaurant of matches) {
      tileGrid.append(renderTileCard(restaurant, liveDraw, Date.now(), visitorId));
    }

    if (matches.length === 0) {
      const label = activeCuisine ?? search.value;
      empty.textContent = `No restaurants match “${label}” in ${CITY_NAMES[city]} yet.`;
      empty.hidden = false;
      tileGrid.hidden = true;
    } else {
      empty.hidden = true;
      tileGrid.hidden = false;
    }
  }

  search.addEventListener('input', renderList);

  for (const cuisine of CUISINE_SHORTCUTS[city]) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'cuisine-chip';
    chip.textContent = cuisine;
    chip.setAttribute('data-testid', `cuisine-${cuisine.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
    chip.addEventListener('click', () => {
      activeCuisine = activeCuisine === cuisine ? null : cuisine;
      for (const candidate of Array.from(chipRow.children)) {
        candidate.classList.toggle('selected', candidate === chip && activeCuisine !== null);
      }
      renderList();
    });
    chipRow.append(chip);
  }

  renderList();

  feed.append(search, carousel.element, chipRow, nearYouHeading, tileGrid, empty);
  root.append(feed);

  if (isFlashLive(draw, Date.now())) {
    const remainingMs = flashSecondsRemaining(draw, Date.now()) * 1000;
    setTimeout(renderList, remainingMs);
  }

  let barHandle: { destroy(): void } | null = null;

  function showBar(): void {
    if (!isFlashLive(draw, Date.now())) return;
    barHandle = renderFlashReopenBar(root, city, draw, () => {
      draw = setFlashDrawState(sessionStorage, city, draw, { collapsed: false });
      openSheet();
    });
  }

  function openSheet(): void {
    if (barHandle) {
      barHandle.destroy();
      barHandle = null;
    }
    renderFlashSheet(
      root,
      city,
      draw,
      visitorId,
      (path) => {
        window.location.href = path;
      },
      Date.now,
      {
        eventAlreadyFired: draw.closedEventFired === true,
        onDismissed: () => {
          draw = setFlashDrawState(sessionStorage, city, draw, { collapsed: true, closedEventFired: true });
          showBar();
        },
      },
    );
  }

  if (isNewDraw) {
    // A 5-6 restaurant draw's own restaurant_slugs no longer matches
    // flash_sheet_shown's contract (exactly 2, tracking.ts's
    // isValidRestaurantSlugs and the store's own check) - all of this
    // draw's slugs are still passed through rather than truncated to 2, so
    // the event is dropped by that validation and goes quiet rather than
    // wrong (#120 AC6; docs/design/119-flash-sheet-tall-and-collapsed-
    // bar.md and the parent objective's "event tracking comes last" rule).
    track('flash_sheet_shown', {
      city,
      amount_minor: draw.amountMinor,
      currency: CITY_CURRENCY[city],
      restaurant_slugs: draw.restaurants.map((restaurant) => restaurant.slug),
    });
    openSheet();
  } else if (draw.collapsed) {
    showBar();
  }
}

export function initHomePage(
  root: HTMLElement,
  pillRoot: HTMLElement,
  storage: Storage = window.localStorage,
  sessionStorage: Storage = window.sessionStorage,
): void {
  root.innerHTML = '';
  const city = getStoredCity(storage);
  const visitorId = safeVisitorId(storage);

  if (city === null) {
    renderLocationPicker(root, storage, (pickedCity) => {
      root.innerHTML = '';
      renderFeed(root, pillRoot, pickedCity, sessionStorage, visitorId);
      track('home_viewed', { city: pickedCity });
    });
    return;
  }

  renderFeed(root, pillRoot, city, sessionStorage, visitorId);
  track('home_viewed', { city });
}
