// Tracker screen (docs/design/65-parody-flow.md, screen 7; states 7a-7e) —
// the screen the whole joke depends on. Renders from computeTrackerView,
// re-rendering on an interval so the stepper/flavor text advance without a
// reload; fires tracker_viewed once per page load (not per re-render), and
// never for the empty state (7e), matching
// docs/measurement/66-parody-event-contract.md §4 exactly.

import { clearOrder, getOrder, minutesSinceOrder, recordTrackerView } from './order-store';
import { computeTrackerView, STEPS, type TrackerView } from './tracker-state';
import { track } from './tracking';

export function renderTrackerView(root: HTMLElement, view: TrackerView, onStartOver: () => void): void {
  root.innerHTML = '';

  if (view.kind === 'empty') {
    const empty = document.createElement('div');
    empty.setAttribute('data-testid', 'tracker-empty');
    const message = document.createElement('p');
    message.textContent = "Nothing to track yet. Go order something that won't arrive.";
    const link = document.createElement('a');
    link.href = '/restaurants/';
    link.className = 'place-order';
    link.textContent = 'Browse restaurants';
    empty.append(message, link);
    root.append(empty);
    return;
  }

  if (view.kind === 'given-up') {
    const givenUp = document.createElement('div');
    givenUp.setAttribute('data-testid', 'tracker-given-up');

    const glyph = document.createElement('p');
    glyph.className = 'drop-glyph dropped';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.innerHTML =
      '<svg width="28" height="42" viewBox="0 0 16 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 8C4 13 3 17 3 19C3 21.5 5.5 23 8 23C10.5 23 13 21.5 13 19C13 17 12 13 8 8Z" fill="currentColor" stroke="none"/></svg>';

    const headline = document.createElement('p');
    headline.className = 'headline';
    headline.textContent = "Well. We dropped it.";

    const startOver = document.createElement('button');
    startOver.type = 'button';
    startOver.className = 'reset-button';
    startOver.setAttribute('data-testid', 'start-over');
    startOver.textContent = 'Start over';
    startOver.addEventListener('click', onStartOver);

    givenUp.append(glyph, headline, startOver);
    root.append(givenUp);
    return;
  }

  const stepper = document.createElement('ul');
  stepper.className = 'stepper';
  stepper.setAttribute('aria-live', 'polite');
  stepper.setAttribute('data-testid', 'tracker-stepper');

  const currentIndex = view.kind === 'fresh' ? view.currentStepIndex : STEPS.length - 1;

  STEPS.forEach((label, index) => {
    const item = document.createElement('li');
    if (index < currentIndex) item.classList.add('done');
    if (index === currentIndex) {
      item.classList.add('current');
      item.setAttribute('aria-current', 'step');
    }
    const stepLabel = document.createElement('span');
    stepLabel.className = 'step-label';
    stepLabel.textContent = label;
    item.append(stepLabel);
    stepper.append(item);
  });

  const flavor = document.createElement('p');
  flavor.className = 'flavor-text';
  flavor.setAttribute('data-testid', 'tracker-flavor');
  flavor.textContent = view.flavorText;

  root.append(stepper, flavor);
}

export function initTrackerPage(
  root: HTMLElement,
  storage: Storage = window.localStorage,
  navigate: (path: string) => void = (path) => {
    window.location.href = path;
  },
): () => void {
  const order = getOrder(storage);

  if (order) {
    const viewNumber = recordTrackerView(storage);
    track('tracker_viewed', {
      order_id: order.orderId,
      minutes_since_order: minutesSinceOrder(order),
      view_number: viewNumber,
    });
  }

  function onStartOver(): void {
    const current = getOrder(storage);
    if (!current) return;
    track('order_abandoned', {
      order_id: current.orderId,
      minutes_since_order: minutesSinceOrder(current),
      view_count: current.viewCount,
    });
    clearOrder(storage);
    navigate('/restaurants/');
  }

  function render(): void {
    const latest = getOrder(storage);
    renderTrackerView(root, computeTrackerView(latest), onStartOver);
  }

  render();

  const intervalId = window.setInterval(render, 3000);
  return () => window.clearInterval(intervalId);
}
