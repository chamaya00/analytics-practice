// Checkout screen (docs/design/80-two-city-brand-and-flow.md, "Checkout"):
// two preset-choice fields (Drop-off, Delivery instructions), a utensils
// toggle, the Offers row and price breakdown (Subtotal, Delivery fee,
// Service fee, Discount, "You saved," Total — #87/#89), a demo disclosure
// directly above the CTA, and "Place order" — nothing typed anywhere.
// "Place order" disables itself on first tap (contract §7's invariant) so a
// double-tap cannot fire two order_placed events for one order_id.

import {
  cartItemCount,
  cartSubtotalMinor,
  computeCheckoutBreakdown,
  getCart,
  placeOrder,
  type CheckoutBreakdown,
} from './order-store';
import type { DeliveryInstructions, DropOffPreset } from './tracking';
import { track } from './tracking';
import { formatMoney } from './money';
import { getRestaurant } from './restaurants';
import { flashFeeForRestaurant, getFlashDraw } from './flash-deal';
import { clearOffersState, getOffersState, setOffersState } from './offers-store';
import { appliedDiscountAmountMinor, appliedVoucherIds, entriesForCity, syncOffersState } from './vouchers';
import type { City } from './money';

interface ChoiceOption<T> {
  value: T;
  label: string;
}

const DROP_OFF_OPTIONS: ChoiceOption<DropOffPreset>[] = [
  { value: 'home', label: 'Home' },
  { value: 'office', label: 'Office' },
  { value: 'front_desk', label: 'Front desk' },
];

const DELIVERY_INSTRUCTIONS_OPTIONS: ChoiceOption<DeliveryInstructions>[] = [
  { value: 'leave_at_door', label: 'Leave at door' },
  { value: 'hand_to_me', label: 'Hand to me' },
  { value: 'meet_downstairs', label: 'Meet downstairs' },
  { value: 'call_on_arrival', label: 'Call on arrival' },
];

/** The chip/segmented button row itself, always one selected — must never render with nothing selected. Defaults to the first option. */
function choiceButtons<T extends string | number>(
  legend: string,
  options: ChoiceOption<T>[],
  testIdPrefix: string,
  groupClass: string,
): { element: HTMLElement; getValue: () => T } {
  let selected = options[0].value;

  const group = document.createElement('div');
  group.className = groupClass;
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-label', legend);

  const buttons = new Map<T, HTMLButtonElement>();
  const buttonClass = groupClass === 'chip-group' ? 'chip' : undefined;

  for (const option of options) {
    const button = document.createElement('button');
    button.type = 'button';
    if (buttonClass) button.classList.add(buttonClass);
    button.textContent = option.label;
    button.setAttribute('data-testid', `${testIdPrefix}-${option.value}`);
    const isDefault = option.value === selected;
    button.classList.toggle('selected', isDefault);
    button.setAttribute('aria-pressed', String(isDefault));
    button.addEventListener('click', () => {
      selected = option.value;
      for (const [value, candidate] of buttons) {
        const isSelected = value === selected;
        candidate.classList.toggle('selected', isSelected);
        candidate.setAttribute('aria-pressed', String(isSelected));
      }
    });
    buttons.set(option.value, button);
    group.append(button);
  }

  return { element: group, getValue: () => selected };
}

/** A full checkout-field section: an `<h2>` heading above a choiceButtons group. */
function choiceField<T extends string | number>(
  legend: string,
  options: ChoiceOption<T>[],
  testIdPrefix: string,
  groupClass: string,
): { element: HTMLElement; getValue: () => T } {
  const wrapper = document.createElement('div');
  wrapper.className = 'checkout-field';
  wrapper.setAttribute('data-testid', `field-${testIdPrefix}`);

  const heading = document.createElement('h2');
  heading.textContent = legend;

  const { element: group, getValue } = choiceButtons(legend, options, testIdPrefix, groupClass);
  wrapper.append(heading, group);
  return { element: wrapper, getValue };
}

function renderBreakdown(breakdown: CheckoutBreakdown): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'checkout-breakdown';
  wrapper.setAttribute('data-testid', 'checkout-breakdown');

  function row(testId: string, label: string, amountMinor: number, extraClass?: string): HTMLElement {
    const el = document.createElement('div');
    el.className = extraClass ? `breakdown-row ${extraClass}` : 'breakdown-row';
    el.setAttribute('data-testid', testId);
    const labelEl = document.createElement('span');
    labelEl.className = 'muted';
    labelEl.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.textContent = formatMoney(amountMinor, breakdown.currency);
    el.append(labelEl, valueEl);
    return el;
  }

  wrapper.append(row('breakdown-subtotal', 'Subtotal', breakdown.subtotalMinor));

  const deliveryRow = document.createElement('div');
  deliveryRow.className = 'breakdown-row';
  deliveryRow.setAttribute('data-testid', 'breakdown-delivery-fee');
  const deliveryLabel = document.createElement('span');
  deliveryLabel.className = 'muted';
  deliveryLabel.textContent = 'Delivery fee';
  const deliveryValue = document.createElement('span');
  if (breakdown.deliveryFeeOriginalMinor !== null) {
    const struck = document.createElement('span');
    struck.className = 'struck';
    struck.textContent = formatMoney(breakdown.deliveryFeeOriginalMinor, breakdown.currency);
    const current = document.createElement('span');
    current.className = 'free';
    current.textContent = breakdown.deliveryFeeMinor === 0 ? 'Free' : formatMoney(breakdown.deliveryFeeMinor, breakdown.currency);
    deliveryValue.append(struck, document.createTextNode(' '), current);
  } else {
    deliveryValue.textContent = formatMoney(breakdown.deliveryFeeMinor, breakdown.currency);
  }
  deliveryRow.append(deliveryLabel, deliveryValue);
  wrapper.append(deliveryRow, row('breakdown-service-fee', 'Service fee', breakdown.serviceFeeMinor));

  if (breakdown.discountAmountMinor > 0) {
    wrapper.append(row('breakdown-discount', 'Discount', -breakdown.discountAmountMinor, 'discount'));
  }

  if (breakdown.savedAmountMinor > 0) {
    const saved = document.createElement('div');
    saved.className = 'saved-line';
    saved.setAttribute('data-testid', 'breakdown-saved');
    saved.textContent = `You saved ${formatMoney(breakdown.savedAmountMinor, breakdown.currency)}`;
    wrapper.append(saved);
  }

  const total = document.createElement('div');
  total.className = 'breakdown-row total';
  total.setAttribute('data-testid', 'breakdown-total');
  const totalLabel = document.createElement('span');
  totalLabel.textContent = 'Total';
  const totalValue = document.createElement('span');
  totalValue.textContent = formatMoney(breakdown.totalMinor, breakdown.currency);
  total.append(totalLabel, totalValue);
  wrapper.append(total);

  return wrapper;
}

/** #80's "Demo disclosure" — sits directly above "Place order", identical copy everywhere it appears. */
function renderDemoDisclosure(): HTMLElement {
  const disclosure = document.createElement('div');
  disclosure.className = 'demo-disclosure';
  disclosure.setAttribute('data-testid', 'demo-disclosure');

  const text = document.createElement('span');
  text.textContent = 'This is a demo. No payment is taken and no food is sent. ';

  const link = document.createElement('a');
  link.href = '/about/';
  link.textContent = 'What we log, and why →';

  text.append(link);
  disclosure.append(text);
  return disclosure;
}

export interface CheckoutView {
  cartIsEmpty: boolean;
}

export function renderCheckout(
  root: HTMLElement,
  storage: Storage,
  navigate: (path: string) => void = (path) => {
    window.location.href = path;
  },
  sessionStorage: Storage = window.sessionStorage,
  now: number = Date.now(),
): CheckoutView {
  root.innerHTML = '';

  const lines = getCart(storage);
  if (lines.length === 0) {
    // #80's checkout "Empty" state: an inline message and a CTA back to the
    // home feed, never a $0.00/₫0 breakdown that looks like a bug.
    const empty = document.createElement('div');
    empty.setAttribute('data-testid', 'checkout-empty');

    const message = document.createElement('p');
    message.textContent = 'Your cart is empty.';

    const link = document.createElement('a');
    link.href = '/';
    link.className = 'add-button';
    link.textContent = 'Browse restaurants';

    empty.append(message, link);
    root.append(empty);
    return { cartIsEmpty: true };
  }

  const dropOff = choiceField('Drop-off', DROP_OFF_OPTIONS, 'drop-off', 'chip-group');
  const deliveryInstructions = choiceField(
    'Delivery instructions',
    DELIVERY_INSTRUCTIONS_OPTIONS,
    'delivery-instructions',
    'chip-group',
  );

  const UTENSILS_OPTIONS: ChoiceOption<'yes' | 'no'>[] = [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
  ];

  function miniField<T extends string | number>(
    labelText: string,
    options: ChoiceOption<T>[],
    testIdPrefix: string,
    testId: string,
  ): { element: HTMLElement; getValue: () => T } {
    const wrapper = document.createElement('div');
    wrapper.className = 'mini-field';
    wrapper.setAttribute('data-testid', testId);
    const label = document.createElement('span');
    label.className = 'mini-label';
    label.textContent = labelText;
    const { element: group, getValue } = choiceButtons(labelText, options, testIdPrefix, 'segmented');
    wrapper.append(label, group);
    return { element: wrapper, getValue };
  }

  const utensilsField = miniField('Utensils & napkins', UTENSILS_OPTIONS, 'utensils', 'field-utensils');

  const miniFields = document.createElement('section');
  miniFields.className = 'checkout-field';
  miniFields.append(utensilsField.element);

  const city: City = lines[0].currency === 'VND' ? 'hcmc' : 'sf';
  const subtotalMinor = cartSubtotalMinor(lines);
  const entries = entriesForCity(city, sessionStorage, now);
  const previousOffers = getOffersState(storage);
  const sync = syncOffersState(previousOffers, entries, subtotalMinor);
  setOffersState(storage, sync.state);

  const restaurant = getRestaurant(lines[0].restaurantSlug);
  const normalDeliveryFeeMinor = restaurant?.deliveryFeeMinor ?? 0;
  const flashDraw = getFlashDraw(sessionStorage, city);
  const flashDeliveryFeeMinor =
    restaurant && flashDraw ? flashFeeForRestaurant(flashDraw, city, restaurant.slug, normalDeliveryFeeMinor, now) : null;

  const breakdown = computeCheckoutBreakdown(lines, normalDeliveryFeeMinor, {
    deliveryVoucherApplied: sync.state.deliveryId !== null,
    discountAmountMinor: appliedDiscountAmountMinor(sync.state, entries),
    flashDeliveryFeeMinor,
  });
  if (breakdown === null) return { cartIsEmpty: true };
  const breakdownEl = renderBreakdown(breakdown);

  const offersRow = document.createElement('button');
  offersRow.type = 'button';
  offersRow.className = 'offers-row';
  offersRow.setAttribute('data-testid', 'offers-row');
  const appliedCount = appliedVoucherIds(sync.state).length;
  offersRow.textContent =
    appliedCount === 0
      ? 'Offers  ›  Select an offer'
      : `Offers  ›  ${appliedCount} applied · You saved ${formatMoney(breakdown.savedAmountMinor, breakdown.currency)}`;
  offersRow.addEventListener('click', () => navigate('/offers/'));

  const dropNotice = document.createElement('p');
  dropNotice.className = 'offers-drop-notice';
  dropNotice.setAttribute('data-testid', 'offers-drop-notice');
  if (sync.discountDropped || sync.deliveryDropped) {
    dropNotice.textContent = 'Discount removed — it no longer qualifies at this subtotal.';
  } else {
    dropNotice.hidden = true;
  }

  const disclosure = renderDemoDisclosure();

  const placeOrderButton = document.createElement('button');
  placeOrderButton.type = 'button';
  placeOrderButton.className = 'place-order';
  placeOrderButton.setAttribute('data-testid', 'place-order');
  placeOrderButton.textContent = 'Place order';

  let placing = false;
  placeOrderButton.addEventListener('click', () => {
    // The guard against a double-tap firing two order_placed events for one
    // order_id: disable synchronously, on the very first click, before
    // anything else runs.
    if (placing) return;
    placing = true;
    placeOrderButton.disabled = true;

    const order = placeOrder(storage, {
      dropOffPreset: dropOff.getValue(),
      deliveryInstructions: deliveryInstructions.getValue(),
      utensils: utensilsField.getValue() === 'yes',
      appliedVoucherIds: appliedVoucherIds(sync.state),
      savedAmountMinor: breakdown.savedAmountMinor,
    });
    clearOffersState(storage);

    track('order_placed', {
      order_id: order.orderId,
      item_count: order.itemCount,
      amount_minor: order.amountMinor,
      currency: order.currency,
      drop_off_preset: order.dropOffPreset,
      delivery_instructions: order.deliveryInstructions,
      utensils: order.utensils,
      applied_voucher_ids: order.appliedVoucherIds,
      saved_amount_minor: order.savedAmountMinor,
    });

    navigate('/order-placed/');
  });

  root.append(
    offersRow,
    dropNotice,
    dropOff.element,
    deliveryInstructions.element,
    miniFields,
    breakdownEl,
    disclosure,
    placeOrderButton,
  );
  return { cartIsEmpty: false };
}

export function initCheckoutPage(
  root: HTMLElement,
  storage: Storage = window.localStorage,
  navigate: (path: string) => void = (path) => {
    window.location.href = path;
  },
  sessionStorage: Storage = window.sessionStorage,
): void {
  const view = renderCheckout(root, storage, navigate, sessionStorage);
  if (view.cartIsEmpty) return;

  const lines = getCart(storage);
  track('checkout_viewed', {
    item_count: cartItemCount(lines),
    amount_minor: cartSubtotalMinor(lines),
    currency: lines[0].currency,
  });
}
