// Tracker screen (docs/design/80-two-city-brand-and-flow.md, "Tracker") — a
// five-stage stepper ending in Delivered, which reveals a rating prompt in
// the same screen. Renders from computeTrackerView, re-rendering on an
// interval so the stepper advances without a reload; fires tracker_viewed
// once per page load (not per re-render), order_delivered exactly once per
// order the first time the computation observes Delivered, and
// rating_submitted once when "Submit" is tapped — matching
// docs/measurement/81-two-city-event-contract.md §7 exactly.

import {
  getOrder,
  markOrderDelivered,
  minutesSinceOrder,
  recordTrackerView,
  submitRating,
} from './order-store';
import { computeTrackerView, STEPS, type TrackerView } from './tracker-state';
import { RATING_TAGS, track, type RatingTag } from './tracking';
import { renderDemoDisclosure } from './demo-disclosure';

const STAR_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3.5 14.4 9.6 21 10.2 16 14.4 17.6 21 12 17.3 6.4 21 8 14.4 3 10.2 9.6 9.6Z"/></svg>';

const TAG_LABELS: Record<RatingTag, string> = {
  fast: 'Fast',
  great_packaging: 'Great packaging',
  order_was_correct: 'Order was correct',
};

function renderStepper(currentIndex: number): HTMLElement {
  const stepper = document.createElement('ul');
  stepper.className = 'stepper';
  stepper.setAttribute('aria-live', 'polite');
  stepper.setAttribute('data-testid', 'tracker-stepper');

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

  return stepper;
}

/** The Delivered state's interactive rating prompt — five stars (required) plus optional preset tag chips, "Submit" enabled once a star count is picked (design doc, "Tracker"). */
function renderRatingPrompt(onSubmit: (stars: number, tags: RatingTag[]) => void): HTMLElement {
  const prompt = document.createElement('div');
  prompt.setAttribute('data-testid', 'rating-prompt');

  const heading = document.createElement('h2');
  heading.textContent = 'Rate your order';
  prompt.append(heading);

  let stars = 0;
  const selectedTags = new Set<RatingTag>();

  const starRow = document.createElement('div');
  starRow.className = 'star-picker';
  starRow.setAttribute('role', 'radiogroup');
  starRow.setAttribute('aria-label', 'Rating');

  const submitButton = document.createElement('button');
  submitButton.type = 'button';
  submitButton.className = 'place-order';
  submitButton.setAttribute('data-testid', 'rating-submit');
  submitButton.textContent = 'Submit';
  submitButton.disabled = true;

  const starButtons: HTMLButtonElement[] = [];
  for (let i = 1; i <= 5; i += 1) {
    const star = document.createElement('button');
    star.type = 'button';
    star.className = 'star';
    star.setAttribute('data-testid', `star-${i}`);
    star.setAttribute('aria-pressed', 'false');
    star.setAttribute('aria-label', `${i} star${i === 1 ? '' : 's'}`);
    star.innerHTML = STAR_ICON;
    star.addEventListener('click', () => {
      stars = i;
      starButtons.forEach((button, index) => {
        const filled = index < stars;
        button.classList.toggle('selected', filled);
        button.setAttribute('aria-pressed', String(filled));
      });
      submitButton.disabled = false;
    });
    starButtons.push(star);
    starRow.append(star);
  }
  prompt.append(starRow);

  const tagGroup = document.createElement('div');
  tagGroup.className = 'chip-group';
  tagGroup.setAttribute('data-testid', 'rating-tags');
  for (const tag of RATING_TAGS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.setAttribute('data-testid', `rating-tag-${tag}`);
    chip.setAttribute('aria-pressed', 'false');
    chip.textContent = TAG_LABELS[tag];
    chip.addEventListener('click', () => {
      const nowSelected = !selectedTags.has(tag);
      if (nowSelected) selectedTags.add(tag);
      else selectedTags.delete(tag);
      chip.classList.toggle('selected', nowSelected);
      chip.setAttribute('aria-pressed', String(nowSelected));
    });
    tagGroup.append(chip);
  }
  prompt.append(tagGroup);

  submitButton.addEventListener('click', () => {
    if (stars === 0) return;
    onSubmit(stars, Array.from(selectedTags));
  });
  prompt.append(submitButton);

  return prompt;
}

/** The already-rated state (return visit after submitting) — static, non-interactive, prevents a second submission (design doc, "Tracker"). */
function renderRatedPrompt(stars: number): HTMLElement {
  const prompt = document.createElement('div');
  prompt.setAttribute('data-testid', 'rating-prompt');

  const message = document.createElement('p');
  message.textContent = 'Thanks for rating this order';
  prompt.append(message);

  const starRow = document.createElement('div');
  starRow.className = 'star-picker';
  starRow.setAttribute('aria-hidden', 'true');
  for (let i = 1; i <= 5; i += 1) {
    const star = document.createElement('span');
    star.className = i <= stars ? 'star selected' : 'star';
    star.innerHTML = STAR_ICON;
    starRow.append(star);
  }
  prompt.append(starRow);

  return prompt;
}

export function renderTrackerView(
  root: HTMLElement,
  view: TrackerView,
  onSubmitRating: (stars: number, tags: RatingTag[]) => void,
): void {
  root.innerHTML = '';

  if (view.kind === 'empty') {
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

  const currentIndex = view.kind === 'active' ? view.currentStepIndex : STEPS.length - 1;
  root.append(renderStepper(currentIndex));

  if (view.kind === 'delivered') {
    root.append(renderDemoDisclosure());
    root.append(view.rated ? renderRatedPrompt(view.stars) : renderRatingPrompt(onSubmitRating));
  }
}

export function initTrackerPage(root: HTMLElement, storage: Storage = window.localStorage): () => void {
  const order = getOrder(storage);

  if (order) {
    const viewNumber = recordTrackerView(storage);
    track('tracker_viewed', {
      order_id: order.orderId,
      minutes_since_order: minutesSinceOrder(order),
      view_number: viewNumber,
    });
  }

  function onSubmitRating(stars: number, tags: RatingTag[]): void {
    const current = getOrder(storage);
    if (!current) return;
    const updated = submitRating(storage, stars, tags);
    if (!updated) return;
    track('rating_submitted', { order_id: current.orderId, stars, tags });
    render();
  }

  function render(): void {
    const latest = getOrder(storage);
    const view = computeTrackerView(latest);

    if (latest && view.kind === 'delivered' && !latest.deliveredEventFired) {
      markOrderDelivered(storage);
      track('order_delivered', {
        order_id: latest.orderId,
        minutes_since_order: minutesSinceOrder(latest),
      });
    }

    renderTrackerView(root, view, onSubmitRating);
  }

  render();

  const intervalId = window.setInterval(render, 3000);
  return () => window.clearInterval(intervalId);
}
