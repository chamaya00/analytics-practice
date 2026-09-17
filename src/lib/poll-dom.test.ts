import { beforeEach, describe, expect, it } from 'vitest';
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

beforeEach(() => {
  window.localStorage.clear();
  document.body.innerHTML = '<div id="root"></div>';
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
