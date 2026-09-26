// The Offers screen (docs/design/87-promo-offers-and-flash.md, "The Offers
// screen"): reached from checkout's Offers row, one section per stack group
// membership (qualifying vs. greyed), a checkbox per voucher, and the
// sticky "You saved"/"Apply" footer. Every control here is a checkbox or a
// button — no typed field anywhere (#80's settled decision, AC5).

import { formatMoney, type City, type Currency } from './money';
import { cartSubtotalMinor, getCart, otherwiseDeliveryFeeMinor } from './order-store';
import { getStoredCity } from './location';
import { getFlashDraw, flashFeeForRestaurant, flashSecondsRemaining, isFlashLive } from './flash-deal';
import { getRestaurant } from './restaurants';
import { getOffersState, setOffersState } from './offers-store';
import {
  appliedDiscountAmountMinor,
  appliedVoucherIds,
  catalogueForCity,
  cheapestMinimumSpendMinor,
  flashCatalogueEntry,
  manualSelect,
  syncOffersState,
  type CatalogueEntry,
  type StackGroup,
  type VoucherView,
} from './vouchers';

export function prefersReducedMotion(): boolean {
  try {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** This city's static catalogue plus, only while a flash window is live, that session's own flash entry — never included once its window has ended (#87, "At 00:00"). */
export function entriesForCity(city: City, sessionStorage: Storage, now: number): CatalogueEntry[] {
  const entries = [...catalogueForCity(city)];
  const draw = getFlashDraw(sessionStorage, city);
  if (draw && isFlashLive(draw, now)) {
    entries.push(flashCatalogueEntry(city, draw.amountMinor, flashSecondsRemaining(draw, now)));
  }
  return entries;
}

function badgeIcon(): string {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2 20 2 20 10 11 19 3 11 12 2Z"/><circle cx="16" cy="6" r="1.4" fill="currentColor" stroke="none"/></svg>';
}

function clockIcon(): string {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function renderVoucherRow(
  view: VoucherView,
  currency: Currency,
  applied: boolean,
  justUnlocked: boolean,
  onToggle: () => void,
): HTMLElement {
  const { entry, qualifies, nudgeAmountMinor } = view;
  const row = document.createElement('label');
  row.className = `voucher-row ${qualifies ? 'qualified' : 'greyed'}${justUnlocked && !prefersReducedMotion() ? ' voucher-row-unlocking' : ''}`;
  row.setAttribute('data-testid', `voucher-row-${entry.id}`);

  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.innerHTML = badgeIcon();

  const main = document.createElement('span');
  main.className = 'voucher-main';

  const amount = document.createElement('p');
  amount.className = 'voucher-amount';
  amount.textContent = entry.tier === 'flash' ? entry.label.replace(/ off flash deals$/, ' off') : entry.label;
  if (entry.tier === 'flash') {
    const flashTag = document.createElement('span');
    flashTag.className = 'flash-tag';
    flashTag.textContent = 'Flash';
    amount.append(flashTag);
  }

  const min = document.createElement('p');
  min.className = 'voucher-min';
  min.textContent = `Minimum spend ${formatMoney(entry.minimumSpendMinor, currency)}`;

  const expiry = document.createElement('p');
  expiry.className = 'voucher-expiry';
  expiry.setAttribute('data-testid', `voucher-expiry-${entry.id}`);
  expiry.innerHTML = `${clockIcon()}<span>${entry.expiryLabel}</span>`;

  main.append(amount, min, expiry);

  if (!qualifies) {
    const nudge = document.createElement('p');
    nudge.className = 'voucher-nudge';
    nudge.setAttribute('data-testid', `voucher-nudge-${entry.id}`);
    nudge.textContent = `Spend ${formatMoney(nudgeAmountMinor, currency)} more to enjoy this offer`;
    main.append(nudge);
  }

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'checkbox';
  checkbox.checked = applied;
  checkbox.disabled = !qualifies;
  checkbox.setAttribute('data-testid', `voucher-checkbox-${entry.id}`);
  checkbox.setAttribute('aria-label', qualifies ? `Apply ${entry.label}` : `${entry.label} — not yet eligible`);
  checkbox.addEventListener('change', onToggle);

  row.append(badge, main, checkbox);
  return row;
}

export interface OffersView {
  cartIsEmpty: boolean;
}

export function renderOffers(
  root: HTMLElement,
  storage: Storage,
  sessionStorage: Storage,
  navigate: (path: string) => void = (path) => {
    window.location.href = path;
  },
  now: number = Date.now(),
): OffersView {
  root.innerHTML = '';

  const lines = getCart(storage);
  const city = lines[0]?.currency === 'VND' ? 'hcmc' : (getStoredCity(storage) ?? 'sf');
  if (lines.length === 0) {
    const empty = document.createElement('p');
    empty.setAttribute('data-testid', 'offers-empty');
    empty.textContent = 'Nothing qualifies yet. Add more to your cart to see offers.';
    root.append(empty);
    return { cartIsEmpty: true };
  }

  const currency = lines[0].currency;
  const subtotalMinor = cartSubtotalMinor(lines);
  const entries = entriesForCity(city, sessionStorage, now);

  const previous = getOffersState(storage);
  const sync = syncOffersState(previous, entries, subtotalMinor);
  setOffersState(storage, sync.state);

  const unlockedDiscountIds = sync.state.qualifyingDiscountIds.filter(
    (id) => !previous.qualifyingDiscountIds.includes(id),
  );
  const unlockedDeliveryIds = sync.state.qualifyingDeliveryIds.filter(
    (id) => !previous.qualifyingDeliveryIds.includes(id),
  );

  function rerender(): void {
    renderOffers(root, storage, sessionStorage, navigate, now);
  }

  function toggle(id: string, group: StackGroup): void {
    const next = manualSelect(getOffersState(storage), id as never, group);
    setOffersState(storage, next);
    rerender();
  }

  const topBar = document.createElement('div');
  topBar.className = 'top-bar';
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'back';
  back.setAttribute('aria-label', 'Back');
  back.setAttribute('data-testid', 'offers-back');
  back.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 5 8 12l7 7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  back.addEventListener('click', () => navigate('/checkout/'));
  const heading = document.createElement('h1');
  heading.textContent = 'Offers';
  topBar.append(back, heading);

  const subtotalLine = document.createElement('p');
  subtotalLine.className = 'subtotal-line';
  subtotalLine.setAttribute('data-testid', 'offers-subtotal');
  subtotalLine.textContent = `Your subtotal: ${formatMoney(subtotalMinor, currency)}`;

  root.append(topBar, subtotalLine);

  const qualifying = [...sync.discountViews, ...sync.deliveryViews].filter((view) => view.qualifies);
  const greyed = [...sync.discountViews, ...sync.deliveryViews].filter((view) => !view.qualifies);

  if (qualifying.length === 0 && greyed.length === 0) {
    const empty = document.createElement('p');
    empty.setAttribute('data-testid', 'offers-empty');
    empty.textContent = `Nothing qualifies yet. Add ${formatMoney(cheapestMinimumSpendMinor(city), currency)} more to unlock your first offer.`;
    root.append(empty);
    return { cartIsEmpty: false };
  }

  if (qualifying.length > 0) {
    const sectionTitle = document.createElement('h2');
    sectionTitle.className = 'section-title';
    sectionTitle.textContent = 'Qualifying now';
    const list = document.createElement('div');
    list.className = 'voucher-list';
    for (const view of qualifying) {
      const applied = view.entry.id === sync.state.discountId || view.entry.id === sync.state.deliveryId;
      const justUnlocked =
        unlockedDiscountIds.includes(view.entry.id) || unlockedDeliveryIds.includes(view.entry.id);
      list.append(
        renderVoucherRow(view, currency, applied, justUnlocked, () => toggle(view.entry.id, view.entry.stackGroup)),
      );
    }
    root.append(sectionTitle, list);
  }

  if (greyed.length > 0) {
    const sectionTitle = document.createElement('h2');
    sectionTitle.className = 'section-title';
    sectionTitle.textContent = 'Not yet — keep adding to your cart';
    const list = document.createElement('div');
    list.className = 'voucher-list';
    for (const view of greyed) {
      list.append(renderVoucherRow(view, currency, false, false, () => toggle(view.entry.id, view.entry.stackGroup)));
    }
    root.append(sectionTitle, list);
  }

  const restaurant = getRestaurant(lines[0].restaurantSlug);
  const normalFeeMinor = restaurant?.deliveryFeeMinor ?? 0;
  const draw = getFlashDraw(sessionStorage, city);
  const flashFeeMinor =
    restaurant && draw ? flashFeeForRestaurant(draw, city, restaurant.slug, normalFeeMinor, now) : null;
  const deliverySavingMinor = sync.state.deliveryId ? otherwiseDeliveryFeeMinor(normalFeeMinor, flashFeeMinor) : 0;
  const savedAmountMinor = appliedDiscountAmountMinor(sync.state, entries) + deliverySavingMinor;

  const footer = document.createElement('div');
  footer.className = 'footer-bar';
  const savedLabel = document.createElement('span');
  savedLabel.className = 'footer-saved';
  savedLabel.setAttribute('data-testid', 'offers-saved');
  const appliedCount = appliedVoucherIds(sync.state).length;
  savedLabel.textContent = appliedCount === 0 ? '' : `You saved ${formatMoney(savedAmountMinor, currency)}`;
  const applyButton = document.createElement('button');
  applyButton.type = 'button';
  applyButton.className = 'footer-apply';
  applyButton.setAttribute('data-testid', 'offers-apply');
  applyButton.textContent = 'Apply';
  applyButton.addEventListener('click', () => navigate('/checkout/'));
  footer.append(savedLabel, applyButton);
  root.append(footer);

  return { cartIsEmpty: false };
}

export function initOffersPage(
  root: HTMLElement,
  storage: Storage = window.localStorage,
  sessionStorage: Storage = window.sessionStorage,
  navigate: (path: string) => void = (path) => {
    window.location.href = path;
  },
): void {
  renderOffers(root, storage, sessionStorage, navigate);
}
