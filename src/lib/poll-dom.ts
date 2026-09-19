// DOM rendering for the SwipeCard and DogfoodingView. Both the pages'
// client scripts and this module's tests call these same functions, so a
// test that "renders the page" exercises the exact markup and listeners a
// visitor gets.

import {
  type Direction,
  type Variant,
  OPTIONS,
  assignVariant,
  castVote,
  computeStats,
  getCurrentPair,
  getEvents,
  getVariant,
} from './poll';
import { resolveDragDirection } from './drag-gesture';

export const CONFIRMATION_MS = 1500;
export const TRANSITION_MS = 400;

const ACCENT_CLASS: Record<Variant, string> = { a: 'accent-a', b: 'accent-b' };

export function renderSwipeCard(root: HTMLElement, storage: Storage, variant: Variant): void {
  root.innerHTML = '';
  root.classList.remove('accent-a', 'accent-b');
  root.classList.add(ACCENT_CLASS[variant]);

  const maybePair = getCurrentPair(getEvents(storage));
  if (!maybePair) {
    renderSwipeCardEnd(root);
    return;
  }
  const pair = maybePair;

  let voting = false;

  const card = document.createElement('div');
  card.className = 'swipe-card';
  card.setAttribute('data-testid', 'swipe-card');
  card.setAttribute('data-pair-id', pair.id);

  const confirmation = document.createElement('p');
  confirmation.className = 'vote-confirmation';
  confirmation.setAttribute('data-testid', 'vote-confirmation');
  confirmation.hidden = true;

  function vote(direction: Direction, panel: HTMLButtonElement): void {
    if (voting) return;
    voting = true;

    const event = castVote(storage, pair, direction, variant);

    panel.classList.add('voted', ACCENT_CLASS[variant]);
    confirmation.hidden = false;
    confirmation.textContent = `Voted: ${event.option}`;
    window.setTimeout(() => {
      confirmation.hidden = true;
    }, CONFIRMATION_MS);

    card.classList.add(direction === 'left' ? 'swipe-out-left' : 'swipe-out-right');
    window.setTimeout(() => {
      renderSwipeCard(root, storage, variant);
    }, TRANSITION_MS);
  }

  function attachDragHandlers(panel: HTMLButtonElement): void {
    let drag: { pointerId: number; startX: number; startY: number; startTime: number } | null = null;

    function endDrag(pointerId: number): void {
      panel.classList.remove('option-panel--dragging');
      panel.style.transform = '';
      if (panel.hasPointerCapture(pointerId)) {
        panel.releasePointerCapture(pointerId);
      }
    }

    panel.addEventListener('pointerdown', (event: PointerEvent) => {
      if (voting || drag) return;
      drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startTime: Date.now() };
      panel.classList.add('option-panel--dragging');
      panel.setPointerCapture(event.pointerId);
    });

    panel.addEventListener('pointermove', (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      panel.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 20}deg)`;
    });

    panel.addEventListener('pointerup', (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const { startX, startY, startTime } = drag;
      drag = null;
      endDrag(event.pointerId);
      if (voting) return;

      const resolved = resolveDragDirection({
        horizontalDistance: event.clientX - startX,
        verticalDistance: event.clientY - startY,
        elapsedMs: Date.now() - startTime,
      });
      if (resolved) vote(resolved, panel);
    });

    panel.addEventListener('pointercancel', (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag = null;
      endDrag(event.pointerId);
    });
  }

  function optionPanel(label: string, direction: Direction): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `option-panel option-panel--${direction}`;
    button.setAttribute('data-testid', `option-${direction}`);
    button.setAttribute('data-direction', direction);
    button.textContent = label;
    button.addEventListener('click', () => vote(direction, button));
    attachDragHandlers(button);
    return button;
  }

  card.append(optionPanel(pair.left, 'left'), optionPanel(pair.right, 'right'));
  root.append(card, confirmation);
}

function renderSwipeCardEnd(root: HTMLElement): void {
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-testid', 'swipe-card-end');

  const message = document.createElement('p');
  message.textContent = "That's all the pairs for now — thanks for voting!";

  const link = document.createElement('a');
  link.href = '/results/';
  link.textContent = 'See how everyone voted →';

  wrapper.append(message, link);
  root.append(wrapper);
}

function statRow(labelText: string, valueText: string, valueClass: string): HTMLLIElement {
  const row = document.createElement('li');
  row.className = 'stat-row';
  const label = document.createElement('span');
  label.className = 'stat-label';
  label.textContent = labelText;
  const value = document.createElement('span');
  value.className = valueClass;
  value.textContent = valueText;
  row.append(label, value);
  return row;
}

export function renderDogfoodingView(root: HTMLElement, storage: Storage): void {
  root.innerHTML = '';

  const stats = computeStats(getEvents(storage));
  const variant = getVariant(storage);
  const hasVotes = stats.total > 0;
  const valueClass = hasVotes ? 'stat-value' : 'stat-value stat-value--muted';

  if (!hasVotes) {
    const prompt = document.createElement('p');
    prompt.className = 'stat-prompt';
    prompt.setAttribute('data-testid', 'no-votes-prompt');
    prompt.textContent = 'No votes yet — go vote on a pair.';
    const link = document.createElement('a');
    link.href = '/';
    link.textContent = 'Go vote';
    prompt.append(' ', link);
    root.append(prompt);
  }

  const total = document.createElement('p');
  total.className = 'stat-total';
  total.setAttribute('data-testid', 'total-votes');
  const totalNumber = document.createElement('span');
  totalNumber.className = 'stat-total-number';
  totalNumber.textContent = String(stats.total);
  const totalLabel = document.createElement('span');
  totalLabel.className = 'stat-total-label';
  totalLabel.textContent = 'total votes cast';
  total.append(totalNumber, totalLabel);

  const yourVariant = document.createElement('p');
  yourVariant.className = 'stat-row stat-row--meta';
  yourVariant.setAttribute('data-testid', 'your-variant');
  yourVariant.textContent = `Your variant: ${variant ? variant.toUpperCase() : 'unknown'}`;

  const perOption = document.createElement('ul');
  perOption.className = 'stat-list';
  perOption.setAttribute('data-testid', 'votes-per-option');
  for (const option of OPTIONS) {
    const item = statRow(option, String(stats.perOption[option]), valueClass);
    item.setAttribute('data-option', option);
    perOption.append(item);
  }

  const perVariant = document.createElement('ul');
  perVariant.setAttribute('data-testid', 'votes-per-variant');
  perVariant.className = 'stat-list';
  const variantA = statRow('A', String(stats.perVariant.a), hasVotes ? 'stat-value accent-a' : valueClass);
  variantA.setAttribute('data-variant', 'a');
  const variantB = statRow('B', String(stats.perVariant.b), hasVotes ? 'stat-value accent-b' : valueClass);
  variantB.setAttribute('data-variant', 'b');
  perVariant.append(variantA, variantB);

  root.append(total, yourVariant, perOption, perVariant);
}

export function initSwipePage(root: HTMLElement, storage: Storage = window.localStorage): void {
  const variant = assignVariant(storage);
  renderSwipeCard(root, storage, variant);
}

export function initResultsPage(root: HTMLElement, storage: Storage = window.localStorage): void {
  assignVariant(storage);
  renderDogfoodingView(root, storage);
}
