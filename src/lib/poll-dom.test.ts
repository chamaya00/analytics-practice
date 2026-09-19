import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DISTANCE_THRESHOLD_PX } from './drag-gesture';
import { EVENTS_KEY, PAIRS, generateId, getEvents, type VoteEvent } from './poll';
import { renderDogfoodingView, renderSwipeCard } from './poll-dom';

function voteEvent(pairId: string, option: string, direction: 'left' | 'right', variant: 'a' | 'b'): VoteEvent {
  return {
    id: generateId(),
    type: 'vote',
    pairId,
    option,
    direction,
    variant,
    timestamp: new Date().toISOString(),
  };
}

let nextPointerId = 1;

// The implementation derives velocity from real elapsed time (Date.now()), so a drag
// test that cares about staying under the velocity threshold has to advance a fake
// clock between pointerdown and pointerup — dispatching both in the same real tick
// makes elapsedMs an unpredictable 0 or 1, which flips the velocity check at random.
function drag(panel: HTMLElement, dx: number, dy = 0, elapsedMs = 0): void {
  const pointerId = nextPointerId++;
  panel.dispatchEvent(new PointerEvent('pointerdown', { pointerId, clientX: 0, clientY: 0, bubbles: true }));
  if (elapsedMs) vi.advanceTimersByTime(elapsedMs);
  panel.dispatchEvent(new PointerEvent('pointermove', { pointerId, clientX: dx, clientY: dy, bubbles: true }));
  panel.dispatchEvent(new PointerEvent('pointerup', { pointerId, clientX: dx, clientY: dy, bubbles: true }));
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  document.body.innerHTML = '<div id="root"></div>';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SwipeCard', () => {
  it('renders the placeholder pair and casts a vote when a panel is activated (AC1)', () => {
    const root = document.getElementById('root') as HTMLElement;
    renderSwipeCard(root, window.localStorage, 'a');

    const left = root.querySelector('[data-testid="option-left"]') as HTMLButtonElement;
    const right = root.querySelector('[data-testid="option-right"]') as HTMLButtonElement;
    expect(left.textContent).toBe(PAIRS[0].left);
    expect(right.textContent).toBe(PAIRS[0].right);

    left.click();

    const votes = getEvents(window.localStorage).filter((event) => event.type === 'vote');
    expect(votes).toHaveLength(1);
  });

  it('logs the vote with option, direction, and a timestamp, and ignores a second input on the same pair (AC2)', () => {
    const root = document.getElementById('root') as HTMLElement;
    renderSwipeCard(root, window.localStorage, 'b');

    const right = root.querySelector('[data-testid="option-right"]') as HTMLButtonElement;
    right.click();
    right.click(); // must not register a second vote for the same pair

    const events = getEvents(window.localStorage);
    expect(events).toHaveLength(1);

    const [event] = events;
    expect(event.type).toBe('vote');
    if (event.type !== 'vote') throw new Error('expected a vote event');
    expect(event.option).toBe(PAIRS[0].right);
    expect(event.direction).toBe('right');
    expect(event.variant).toBe('b');
    expect(Number.isNaN(Date.parse(event.timestamp))).toBe(false);
  });

  it('casts a vote identical to a click when a panel is dragged past the threshold and released (AC1)', () => {
    const root = document.getElementById('root') as HTMLElement;
    renderSwipeCard(root, window.localStorage, 'a');

    const right = root.querySelector('[data-testid="option-right"]') as HTMLButtonElement;
    drag(right, DISTANCE_THRESHOLD_PX + 10);

    const votes = getEvents(window.localStorage).filter((event) => event.type === 'vote');
    expect(votes).toHaveLength(1);

    const [event] = votes;
    if (event.type !== 'vote') throw new Error('expected a vote event');
    expect(event.option).toBe(PAIRS[0].right);
    expect(event.direction).toBe('right');
    expect(event.variant).toBe('a');
  });

  it('casts no vote and resets the transform when a drag is released before the threshold (AC2)', () => {
    const root = document.getElementById('root') as HTMLElement;
    renderSwipeCard(root, window.localStorage, 'a');

    const left = root.querySelector('[data-testid="option-left"]') as HTMLButtonElement;
    drag(left, -(DISTANCE_THRESHOLD_PX - 20), 0, 200);

    const votes = getEvents(window.localStorage).filter((event) => event.type === 'vote');
    expect(votes).toHaveLength(0);
    expect(left.style.transform).toBe('');
    expect(left.classList.contains('option-panel--dragging')).toBe(false);
  });

  it('ignores a second drag input while a vote from a first drag is mid-flight (AC4)', () => {
    const root = document.getElementById('root') as HTMLElement;
    renderSwipeCard(root, window.localStorage, 'a');

    const right = root.querySelector('[data-testid="option-right"]') as HTMLButtonElement;
    drag(right, DISTANCE_THRESHOLD_PX + 10);
    drag(right, DISTANCE_THRESHOLD_PX + 10);

    const votes = getEvents(window.localStorage).filter((event) => event.type === 'vote');
    expect(votes).toHaveLength(1);
  });

  it('ignores a click while a vote from a drag is mid-flight (AC4)', () => {
    const root = document.getElementById('root') as HTMLElement;
    renderSwipeCard(root, window.localStorage, 'a');

    const right = root.querySelector('[data-testid="option-right"]') as HTMLButtonElement;
    drag(right, DISTANCE_THRESHOLD_PX + 10);
    right.click();

    const votes = getEvents(window.localStorage).filter((event) => event.type === 'vote');
    expect(votes).toHaveLength(1);
  });

  it('shows the end state once every pair has a matching vote event', () => {
    const events = PAIRS.map((pair) => voteEvent(pair.id, pair.left, 'left', 'a'));
    window.localStorage.setItem(EVENTS_KEY, JSON.stringify(events));

    const root = document.getElementById('root') as HTMLElement;
    renderSwipeCard(root, window.localStorage, 'a');

    expect(root.querySelector('[data-testid="swipe-card-end"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="swipe-card"]')).toBeNull();
  });
});

describe('DogfoodingView', () => {
  it('shows total, per-option, and per-variant counts computed from events written directly into the log (AC3)', () => {
    const events = [
      voteEvent('pair-1', 'Coffee', 'left', 'a'),
      voteEvent('pair-1', 'Coffee', 'left', 'a'),
      voteEvent('pair-2', 'Dogs', 'right', 'b'),
    ];
    window.localStorage.setItem(EVENTS_KEY, JSON.stringify(events));

    const root = document.getElementById('root') as HTMLElement;
    renderDogfoodingView(root, window.localStorage);

    expect(root.querySelector('[data-testid="total-votes"]')?.textContent).toContain('3');
    expect(root.querySelector('li[data-option="Coffee"]')?.textContent).toContain('2');
    expect(root.querySelector('li[data-option="Dogs"]')?.textContent).toContain('1');
    expect(root.querySelector('li[data-option="Tea"]')?.textContent).toContain('0');
    expect(root.querySelector('li[data-variant="a"]')?.textContent).toContain('2');
    expect(root.querySelector('li[data-variant="b"]')?.textContent).toContain('1');
  });

  it('shows a zeroed, labeled empty state with a link back to the card when there are no votes', () => {
    const root = document.getElementById('root') as HTMLElement;
    renderDogfoodingView(root, window.localStorage);

    expect(root.querySelector('[data-testid="total-votes"]')?.textContent).toContain('0');
    expect(root.querySelector('[data-testid="no-votes-prompt"]')).not.toBeNull();
  });
});
