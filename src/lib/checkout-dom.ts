// Checkout screen (docs/design/65-parody-flow.md, screen 5;
// docs/design/72-dontdropthatpromo-identity.md's field table): five preset-
// choice fields, all single-select, nothing typed anywhere, every field
// defaulted so checkout is reachable in one tap. "Place order" disables
// itself on first tap (docs/measurement/66-parody-event-contract.md §4's
// invariant) so a double-tap cannot fire two order_placed events for one
// order_id (issue #67 AC3).

import { cartItemCount, cartSubtotalCents, getCart, placeOrder } from './order-store';
import type { DropOffSpot, HandlingInstructions, PromoCode, TipPercent } from './tracking';
import { track } from './tracking';

interface ChoiceOption<T> {
  value: T;
  label: string;
}

const DROP_OFF_OPTIONS: ChoiceOption<DropOffSpot>[] = [
  { value: 'couch', label: 'My couch' },
  { value: 'wherever_i_am', label: 'Wherever I am' },
  { value: 'the_void', label: 'The void' },
  { value: 'behind_you', label: 'Behind you' },
];

const HANDLING_OPTIONS: ChoiceOption<HandlingInstructions>[] = [
  { value: 'guard_it', label: 'Guard it' },
  { value: 'wing_it', label: 'Wing it' },
  { value: 'two_hands', label: 'Two hands' },
  { value: 'surprise_me', label: 'Surprise me' },
];

const TIP_OPTIONS: ChoiceOption<TipPercent>[] = [
  { value: 0, label: '0%' },
  { value: 10, label: '10%' },
  { value: 15, label: '15%' },
  { value: 20, label: '20%' },
];

const PROMO_OPTIONS: ChoiceOption<PromoCode>[] = [
  { value: 'dont_drop10', label: 'DONTDROP10' },
  { value: 'still_here', label: 'STILLHERE' },
  { value: 'clumsy15', label: 'CLUMSY15' },
  { value: 'gotcha', label: 'GOTCHA' },
];

/** The chip/segmented button row itself, always one selected — docs/design/65-parody-flow.md's PresetChoiceGroup, "must never render with nothing selected". Defaults to the first option. */
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

export interface CheckoutView {
  redirectedToEmptyCart: boolean;
}

export function renderCheckout(
  root: HTMLElement,
  storage: Storage,
  navigate: (path: string) => void = (path) => {
    window.location.href = path;
  },
): CheckoutView {
  root.innerHTML = '';

  const lines = getCart(storage);
  if (lines.length === 0) {
    // AC9: an empty /checkout redirects to /cart rather than rendering a
    // screen with nothing to submit.
    navigate('/cart/');
    return { redirectedToEmptyCart: true };
  }

  const dropOff = choiceField('Drop-off spot', DROP_OFF_OPTIONS, 'drop-off', 'chip-group');
  const handling = choiceField('Handling instructions', HANDLING_OPTIONS, 'handling', 'chip-group');

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
  const tipField = miniField('Tip for the rider', TIP_OPTIONS, 'tip', 'field-tip');

  const miniFields = document.createElement('section');
  miniFields.className = 'checkout-field';
  miniFields.append(utensilsField.element, tipField.element);

  const promo = choiceField('Promo code (guard this)', PROMO_OPTIONS, 'promo', 'chip-group');

  const privacy = document.createElement('p');
  privacy.className = 'privacy-note';
  const privacyLink = document.createElement('a');
  privacyLink.href = '/about/';
  privacyLink.textContent = 'What we log, and why →';
  privacy.append(privacyLink);

  const placeOrderButton = document.createElement('button');
  placeOrderButton.type = 'button';
  placeOrderButton.className = 'place-order';
  placeOrderButton.setAttribute('data-testid', 'place-order');
  placeOrderButton.textContent = "Place order — it's free, no really";

  let placing = false;
  placeOrderButton.addEventListener('click', () => {
    // The guard against a double-tap firing two order_placed events for one
    // order_id: disable synchronously, on the very first click, before
    // anything else runs.
    if (placing) return;
    placing = true;
    placeOrderButton.disabled = true;

    const order = placeOrder(storage, {
      dropOffSpot: dropOff.getValue(),
      handlingInstructions: handling.getValue(),
      utensils: utensilsField.getValue() === 'yes',
      tipPercent: tipField.getValue(),
      promoCode: promo.getValue(),
    });

    track('order_placed', {
      order_id: order.orderId,
      item_count: order.itemCount,
      subtotal_cents: order.subtotalCents,
      drop_off_spot: order.dropOffSpot,
      handling_instructions: order.handlingInstructions,
      utensils: order.utensils,
      tip_percent: order.tipPercent,
      promo_code: order.promoCode,
    });

    navigate('/order-placed/');
  });

  root.append(dropOff.element, handling.element, miniFields, promo.element, privacy, placeOrderButton);
  return { redirectedToEmptyCart: false };
}

export function initCheckoutPage(
  root: HTMLElement,
  storage: Storage = window.localStorage,
  navigate: (path: string) => void = (path) => {
    window.location.href = path;
  },
): void {
  const view = renderCheckout(root, storage, navigate);
  if (view.redirectedToEmptyCart) return;

  const lines = getCart(storage);
  track('checkout_viewed', { item_count: cartItemCount(lines), subtotal_cents: cartSubtotalCents(lines) });
}
