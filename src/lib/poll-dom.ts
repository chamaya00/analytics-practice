// DOM rendering for the SwipeCard and DogfoodingView. Both the pages'
// client scripts and this module's tests call these same functions, so a
// test that "renders the page" exercises the exact markup and listeners a
// visitor gets.

import {
  type Direction,
  type Variant,
  OPTIONS,
  PAIRS,
  assignVariant,
  castVote,
  computeStats,
  getCurrentPair,
  getEvents,
  getVariant,
} from './poll';

export const CONFIRMATION_MS = 1500;
export const TRANSITION_MS = 400;

const ACCENT_CLASS: Record<Variant, string> = { a: 'accent-a', b: 'accent-b' };

export function renderSwipeCard(root: HTMLElement, storage: Storage, variant: Variant): void {
  root.innerHTML = '';
  root.classList.remove('accent-a', 'accent-b');
  root.classList.add(ACCENT_CLASS[variant]);

  const pair = getCurrentPair(getEvents(storage));
  if (!pair) {
    renderSwipeCardEnd(root);
    return;
  }

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

  function optionPanel(label: string, direction: Direction): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `option-panel option-panel--${direction}`;
    button.setAttribute('data-testid', `option-${direction}`);
    button.setAttribute('data-direction', direction);
    button.textContent = label;
    button.addEventListener('click', () => vote(direction, button));
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

export function renderDogfoodingView(root: HTMLElement, storage: Storage): void {
  root.innerHTML = '';

  const stats = computeStats(getEvents(storage));
  const variant = getVariant(storage);

  const total = document.createElement('p');
  total.setAttribute('data-testid', 'total-votes');
  total.textContent = `Total votes cast: ${stats.total}`;

  const yourVariant = document.createElement('p');
  yourVariant.setAttribute('data-testid', 'your-variant');
  yourVariant.textContent = `Your variant: ${variant ? variant.toUpperCase() : 'unknown'}`;

  const perOption = document.createElement('ul');
  perOption.setAttribute('data-testid', 'votes-per-option');
  for (const option of OPTIONS) {
    const item = document.createElement('li');
    item.setAttribute('data-option', option);
    item.textContent = `${option}: ${stats.perOption[option]}`;
    perOption.append(item);
  }

  const perVariant = document.createElement('ul');
  perVariant.setAttribute('data-testid', 'votes-per-variant');
  const variantA = document.createElement('li');
  variantA.setAttribute('data-variant', 'a');
  variantA.textContent = `A: ${stats.perVariant.a}`;
  const variantB = document.createElement('li');
  variantB.setAttribute('data-variant', 'b');
  variantB.textContent = `B: ${stats.perVariant.b}`;
  perVariant.append(variantA, variantB);

  root.append(total, yourVariant, perOption, perVariant);

  if (stats.total === 0) {
    const prompt = document.createElement('p');
    prompt.setAttribute('data-testid', 'no-votes-prompt');
    prompt.textContent = 'No votes yet — go vote on a pair.';
    const link = document.createElement('a');
    link.href = '/';
    link.textContent = 'Go vote';
    prompt.append(' ', link);
    root.append(prompt);
  }
}

export function initSwipePage(root: HTMLElement, storage: Storage = window.localStorage): void {
  const variant = assignVariant(storage);
  renderSwipeCard(root, storage, variant);
}

export function initResultsPage(root: HTMLElement, storage: Storage = window.localStorage): void {
  assignVariant(storage);
  renderDogfoodingView(root, storage);
}
