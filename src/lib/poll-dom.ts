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
  resetPoll,
} from './poll';
import { resolveDragDirection } from './drag-gesture';

export const CONFIRMATION_MS = 1500;
export const TRANSITION_MS = 400;

/**
 * How far a pointer may travel and still count as a tap rather than a drag.
 *
 * It is also the point at which the card claims the pointer. Claiming it on
 * `pointerdown` - which this did until a tap was found to cast no vote at
 * all in Chromium - retargets the browser's own `pointerup` and `click` to
 * the capture element, so a tap on an option panel arrived as a click on the
 * card and the panel's handler never ran. Voting by swipe still worked,
 * which is why every test here stayed green: happy-dom dispatches the click
 * this code asks for rather than the one a browser would have retargeted, so
 * nothing in this suite could see the difference. Waiting for real movement
 * keeps a tap a tap, in the browser as well as in the tests.
 */
export const TAP_SLOP_PX = 8;

const ACCENT_CLASS: Record<Variant, string> = { a: 'accent-a', b: 'accent-b' };

export function renderSwipeCard(root: HTMLElement, storage: Storage, variant: Variant): void {
  root.innerHTML = '';
  root.classList.remove('accent-a', 'accent-b');
  root.classList.add(ACCENT_CLASS[variant]);

  const maybePair = getCurrentPair(getEvents(storage));
  if (!maybePair) {
    renderSwipeCardEnd(root, storage);
    return;
  }
  const pair = maybePair;

  let voting = false;

  const card = document.createElement('div');
  card.className = 'swipe-card';
  card.setAttribute('data-testid', 'swipe-card');
  card.setAttribute('data-pair-id', pair.id);

  const caption = document.createElement('p');
  caption.className = 'pair-caption';
  caption.setAttribute('data-testid', 'pair-caption');
  caption.textContent = `${pair.left} — ${pair.right}`;

  const optionRow = document.createElement('div');
  optionRow.className = 'option-row';

  // Derived from poll.events, never a counter — must never rules in
  // docs/design/3-swipe-poll.md hold vote progress only in the event log.
  const pairIndex = PAIRS.findIndex((candidate) => candidate.id === pair.id);
  const progress = document.createElement('p');
  progress.className = 'card-caption-sub';
  progress.setAttribute('data-testid', 'pair-progress');
  progress.textContent = `Pair ${pairIndex + 1} of ${PAIRS.length}`;

  const confirmation = document.createElement('p');
  confirmation.className = 'vote-confirmation';
  confirmation.setAttribute('data-testid', 'vote-confirmation');
  confirmation.hidden = true;

  function panelFor(direction: Direction): HTMLButtonElement {
    return direction === 'left' ? leftPanel : rightPanel;
  }

  function vote(direction: Direction): void {
    if (voting) return;
    voting = true;

    const event = castVote(storage, pair, direction, variant);

    panelFor(direction).classList.add('voted', ACCENT_CLASS[variant]);
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

  function attachDragHandlers(): void {
    let drag: {
      pointerId: number;
      startX: number;
      startY: number;
      startTime: number;
      panel: HTMLElement | null;
      captured: boolean;
    } | null = null;

    function endDrag(pointerId: number): void {
      card.classList.remove('swipe-card--dragging');
      card.style.transform = '';
      if (card.hasPointerCapture(pointerId)) {
        card.releasePointerCapture(pointerId);
      }
    }

    card.addEventListener('pointerdown', (event: PointerEvent) => {
      if (voting || drag) return;
      const target = event.target instanceof Element ? event.target : null;
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startTime: Date.now(),
        panel: target?.closest<HTMLElement>('.option-panel') ?? null,
        // Capture is deliberately not taken here - see the comment on
        // TAP_SLOP_PX. It is taken on the first move that proves this is a
        // drag rather than a tap.
        captured: false,
      };
      card.classList.add('swipe-card--dragging');
    });

    card.addEventListener('pointermove', (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.captured && Math.hypot(dx, dy) > TAP_SLOP_PX) {
        card.setPointerCapture(event.pointerId);
        drag.captured = true;
      }
      card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 20}deg)`;
    });

    card.addEventListener('pointerup', (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const { startX, startY, startTime, panel } = drag;
      drag = null;
      endDrag(event.pointerId);
      if (voting) return;

      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      const resolved = resolveDragDirection({
        horizontalDistance: dx,
        verticalDistance: dy,
        elapsedMs: Date.now() - startTime,
      });
      if (resolved) {
        vote(resolved);
        return;
      }

      // A press and release on a panel that never travelled is a tap, and
      // casts that panel's vote from here rather than waiting for the click
      // event. The panel's own click handler still runs when the browser
      // sends one - `voting` makes the second of the two a no-op - but a
      // browser that swallows it (see TAP_SLOP_PX) no longer loses the vote.
      if (panel && Math.hypot(dx, dy) <= TAP_SLOP_PX) {
        const direction = panel.getAttribute('data-direction');
        if (direction === 'left' || direction === 'right') vote(direction);
      }
    });

    card.addEventListener('pointercancel', (event: PointerEvent) => {
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
    button.addEventListener('click', () => vote(direction));
    return button;
  }

  const leftPanel = optionPanel(pair.left, 'left');
  const rightPanel = optionPanel(pair.right, 'right');
  optionRow.append(leftPanel, rightPanel);
  card.append(caption, optionRow, progress);
  attachDragHandlers();
  root.append(card, confirmation);
}

/**
 * The one control both pages use to start over. Clicking it wipes this
 * browser's poll state and hands back to the caller to re-render whatever
 * it was showing, now derived from an empty log.
 */
function resetButton(onReset: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'reset-button';
  button.setAttribute('data-testid', 'reset-poll');
  button.textContent = 'Start over';
  button.addEventListener('click', onReset);
  return button;
}

function renderSwipeCardEnd(root: HTMLElement, storage: Storage): void {
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-testid', 'swipe-card-end');

  const message = document.createElement('p');
  message.textContent = "That's all the pairs for now — thanks for voting!";

  const actions = document.createElement('div');
  actions.className = 'end-actions';

  const link = document.createElement('a');
  link.href = '/results/';
  link.textContent = 'See how everyone voted →';

  // A reload re-derives this same state from poll.events, so the only way
  // back to pair 1 is to empty that log - see docs/design/3-swipe-poll.md's
  // End state and ADR 0004.
  actions.append(
    link,
    resetButton(() => {
      resetPoll(storage);
      renderSwipeCard(root, storage, assignVariant(storage));
    }),
  );

  wrapper.append(message, actions);
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

  const resetHint = document.createElement('p');
  resetHint.className = 'stat-prompt stat-prompt--reset';
  resetHint.setAttribute('data-testid', 'reset-hint');
  resetHint.textContent = 'Starting over clears this browser\u2019s votes and re-rolls your variant.';

  root.append(
    total,
    yourVariant,
    perOption,
    perVariant,
    resetHint,
    resetButton(() => {
      resetPoll(storage);
      assignVariant(storage);
      renderDogfoodingView(root, storage);
    }),
  );
}

export function initSwipePage(root: HTMLElement, storage: Storage = window.localStorage): void {
  const variant = assignVariant(storage);
  renderSwipeCard(root, storage, variant);
}

export function initResultsPage(root: HTMLElement, storage: Storage = window.localStorage): void {
  assignVariant(storage);
  renderDogfoodingView(root, storage);
}
