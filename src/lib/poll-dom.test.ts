import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DISTANCE_THRESHOLD_PX } from './drag-gesture';
import { EVENTS_KEY, PAIRS, VARIANT_KEY, generateId, getEvents, getVariant, type VoteEvent } from './poll';
import { TAP_SLOP_PX, renderDogfoodingView, renderSwipeCard } from './poll-dom';

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

// A tap as a browser sends it: pointer events, then the click. `dx` moves the
// pointer between down and up, for the shaky-finger cases.
function tap(target: HTMLElement, dx = 0, dy = 0, { withClick = true } = {}): void {
  const pointerId = nextPointerId++;
  target.dispatchEvent(new PointerEvent('pointerdown', { pointerId, clientX: 0, clientY: 0, bubbles: true }));
  if (dx || dy) {
    target.dispatchEvent(new PointerEvent('pointermove', { pointerId, clientX: dx, clientY: dy, bubbles: true }));
  }
  target.dispatchEvent(new PointerEvent('pointerup', { pointerId, clientX: dx, clientY: dy, bubbles: true }));
  // Chromium retargets this click to whichever element holds pointer capture,
  // so a card that captured on pointerdown never lets it reach the panel —
  // withClick: false is that browser, and the vote must survive it.
  if (withClick) target.click();
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
  it('renders the placeholder pair as one card, with a dominant caption and progress line, and casts a vote when a panel is activated (AC2)', () => {
    const root = document.getElementById('root') as HTMLElement;
    renderSwipeCard(root, window.localStorage, 'a');

    expect(root.querySelector('[data-testid="swipe-card"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="pair-caption"]')?.textContent).toBe(
      `${PAIRS[0].left} — ${PAIRS[0].right}`,
    );
    expect(root.querySelector('[data-testid="pair-progress"]')?.textContent).toBe(`Pair 1 of ${PAIRS.length}`);

    const left = root.querySelector('[data-testid="option-left"]') as HTMLButtonElement;
    const right = root.querySelector('[data-testid="option-right"]') as HTMLButtonElement;
    expect(left.textContent).toBe(PAIRS[0].left);
    expect(right.textContent).toBe(PAIRS[0].right);

    left.click();

    const votes = getEvents(window.localStorage).filter((event) => event.type === 'vote');
    expect(votes).toHaveLength(1);
  });

  it('names the second pair in the progress line once the first has a matching event', () => {
    window.localStorage.setItem(
      EVENTS_KEY,
      JSON.stringify([voteEvent(PAIRS[0].id, PAIRS[0].left, 'left', 'a')]),
    );

    const root = document.getElementById('root') as HTMLElement;
    renderSwipeCard(root, window.localStorage, 'a');

    expect(root.querySelector('[data-testid="pair-progress"]')?.textContent).toBe(`Pair 2 of ${PAIRS.length}`);
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

  it('casts one vote and animates the card off when the card itself is dragged past the threshold (AC1)', () => {
    const root = document.getElementById('root') as HTMLElement;
    renderSwipeCard(root, window.localStorage, 'a');

    const card = root.querySelector('[data-testid="swipe-card"]') as HTMLElement;
    drag(card, DISTANCE_THRESHOLD_PX + 10);

    const votes = getEvents(window.localStorage).filter((event) => event.type === 'vote');
    expect(votes).toHaveLength(1);

    const [event] = votes;
    if (event.type !== 'vote') throw new Error('expected a vote event');
    expect(event.option).toBe(PAIRS[0].right);
    expect(event.direction).toBe('right');
    expect(event.variant).toBe('a');
    expect(card.classList.contains('swipe-out-right')).toBe(true);
  });

  it('casts a left vote when the card is dragged left past the threshold (AC1)', () => {
    const root = document.getElementById('root') as HTMLElement;
    renderSwipeCard(root, window.localStorage, 'a');

    const card = root.querySelector('[data-testid="swipe-card"]') as HTMLElement;
    drag(card, -(DISTANCE_THRESHOLD_PX + 10));

    const votes = getEvents(window.localStorage).filter((event) => event.type === 'vote');
    expect(votes).toHaveLength(1);

    const [event] = votes;
    if (event.type !== 'vote') throw new Error('expected a vote event');
    expect(event.option).toBe(PAIRS[0].left);
    expect(event.direction).toBe('left');
    expect(card.classList.contains('swipe-out-left')).toBe(true);
  });

  it('casts no vote and resets the card transform when a drag is released before the threshold', () => {
    const root = document.getElementById('root') as HTMLElement;
    renderSwipeCard(root, window.localStorage, 'a');

    const card = root.querySelector('[data-testid="swipe-card"]') as HTMLElement;
    drag(card, -(DISTANCE_THRESHOLD_PX - 20), 0, 200);

    const votes = getEvents(window.localStorage).filter((event) => event.type === 'vote');
    expect(votes).toHaveLength(0);
    expect(card.style.transform).toBe('');
    expect(card.classList.contains('swipe-card--dragging')).toBe(false);
  });

  it('ignores a second drag input while a vote from a first drag is mid-flight', () => {
    const root = document.getElementById('root') as HTMLElement;
    renderSwipeCard(root, window.localStorage, 'a');

    const card = root.querySelector('[data-testid="swipe-card"]') as HTMLElement;
    drag(card, DISTANCE_THRESHOLD_PX + 10);
    drag(card, DISTANCE_THRESHOLD_PX + 10);

    const votes = getEvents(window.localStorage).filter((event) => event.type === 'vote');
    expect(votes).toHaveLength(1);
  });

  it('a completed drag release and a click on the same render write only one event (AC2)', () => {
    const root = document.getElementById('root') as HTMLElement;
    renderSwipeCard(root, window.localStorage, 'a');

    const card = root.querySelector('[data-testid="swipe-card"]') as HTMLElement;
    const right = root.querySelector('[data-testid="option-right"]') as HTMLButtonElement;
    drag(card, DISTANCE_THRESHOLD_PX + 10);
    right.click();

    const votes = getEvents(window.localStorage).filter((event) => event.type === 'vote');
    expect(votes).toHaveLength(1);
  });

  it('a click followed by a completed drag release on the same render write only one event (AC2)', () => {
    const root = document.getElementById('root') as HTMLElement;
    renderSwipeCard(root, window.localStorage, 'a');

    const card = root.querySelector('[data-testid="swipe-card"]') as HTMLElement;
    const left = root.querySelector('[data-testid="option-left"]') as HTMLButtonElement;
    left.click();
    drag(card, DISTANCE_THRESHOLD_PX + 10);

    const votes = getEvents(window.localStorage).filter((event) => event.type === 'vote');
    expect(votes).toHaveLength(1);
  });

  // Regression tests for a tap casting no vote at all in Chromium: the card
  // captured the pointer on pointerdown, and the browser then retargeted its
  // own pointerup and click from the panel to the card, so the panel's click
  // handler never ran and only swiping worked. See TAP_SLOP_PX in poll-dom.ts.
  it('does not claim the pointer on a press that has not moved, so the browser leaves a tap on the panel', () => {
    const root = document.getElementById('root') as HTMLElement;
    renderSwipeCard(root, window.localStorage, 'a');

    const card = root.querySelector('[data-testid="swipe-card"]') as HTMLElement;
    const capture = vi.spyOn(card, 'setPointerCapture');
    const left = root.querySelector('[data-testid="option-left"]') as HTMLButtonElement;

    tap(left);

    expect(capture).not.toHaveBeenCalled();
  });

  it('claims the pointer once a drag passes the tap slop, so a real drag keeps its events', () => {
    const root = document.getElementById('root') as HTMLElement;
    renderSwipeCard(root, window.localStorage, 'a');

    const card = root.querySelector('[data-testid="swipe-card"]') as HTMLElement;
    const capture = vi.spyOn(card, 'setPointerCapture');

    drag(card, DISTANCE_THRESHOLD_PX + 10);

    expect(capture).toHaveBeenCalled();
  });

  it('casts a panel tap as a vote even when the browser sends no click for it (AC2)', () => {
    const root = document.getElementById('root') as HTMLElement;
    renderSwipeCard(root, window.localStorage, 'a');

    const left = root.querySelector('[data-testid="option-left"]') as HTMLButtonElement;
    tap(left, 0, 0, { withClick: false });

    const votes = getEvents(window.localStorage).filter((event) => event.type === 'vote');
    expect(votes).toHaveLength(1);
    expect(votes[0]).toMatchObject({ pairId: PAIRS[0].id, option: PAIRS[0].left, direction: 'left' });
  });

  it('writes one event, not two, when a tap is followed by the click the browser normally sends', () => {
    const root = document.getElementById('root') as HTMLElement;
    renderSwipeCard(root, window.localStorage, 'a');

    tap(root.querySelector('[data-testid="option-right"]') as HTMLButtonElement);

    expect(getEvents(window.localStorage).filter((event) => event.type === 'vote')).toHaveLength(1);
  });

  it('still counts a tap that wobbles within the slop, and still refuses one that became a short drag', () => {
    const root = document.getElementById('root') as HTMLElement;
    renderSwipeCard(root, window.localStorage, 'a');

    tap(root.querySelector('[data-testid="option-left"]') as HTMLButtonElement, TAP_SLOP_PX - 3, 0, {
      withClick: false,
    });
    expect(getEvents(window.localStorage).filter((event) => event.type === 'vote')).toHaveLength(1);

    // A deliberate short drag off a panel, released below the vote threshold,
    // is a cancelled swipe and stays one.
    window.localStorage.clear();
    renderSwipeCard(root, window.localStorage, 'a');
    drag(root.querySelector('[data-testid="option-left"]') as HTMLButtonElement, DISTANCE_THRESHOLD_PX - 20, 0, 200);
    expect(getEvents(window.localStorage).filter((event) => event.type === 'vote')).toHaveLength(0);
  });

  it('shows the end state once every pair has a matching vote event', () => {
    const events = PAIRS.map((pair) => voteEvent(pair.id, pair.left, 'left', 'a'));
    window.localStorage.setItem(EVENTS_KEY, JSON.stringify(events));

    const root = document.getElementById('root') as HTMLElement;
    renderSwipeCard(root, window.localStorage, 'a');

    expect(root.querySelector('[data-testid="swipe-card-end"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="swipe-card"]')).toBeNull();
  });

  it('offers a start-over control in the end state that empties the log and renders pair 1 again', () => {
    const events = PAIRS.map((pair) => voteEvent(pair.id, pair.left, 'left', 'a'));
    window.localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
    window.localStorage.setItem(VARIANT_KEY, 'a');

    const root = document.getElementById('root') as HTMLElement;
    renderSwipeCard(root, window.localStorage, 'a');

    const reset = root.querySelector('[data-testid="reset-poll"]') as HTMLButtonElement;
    expect(reset).not.toBeNull();
    reset.click();

    expect(getEvents(window.localStorage).filter((event) => event.type === 'vote')).toHaveLength(0);
    expect(root.querySelector('[data-testid="swipe-card-end"]')).toBeNull();
    expect(root.querySelector('[data-testid="pair-progress"]')?.textContent).toBe(`Pair 1 of ${PAIRS.length}`);
    expect(root.querySelector('[data-testid="pair-caption"]')?.textContent).toBe(
      `${PAIRS[0].left} — ${PAIRS[0].right}`,
    );
  });

  it('re-assigns a variant on start over, so the restarted run logs one variant_seen and accents the card with it', () => {
    const events = PAIRS.map((pair) => voteEvent(pair.id, pair.left, 'left', 'a'));
    window.localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
    window.localStorage.setItem(VARIANT_KEY, 'a');

    const root = document.getElementById('root') as HTMLElement;
    renderSwipeCard(root, window.localStorage, 'a');
    (root.querySelector('[data-testid="reset-poll"]') as HTMLButtonElement).click();

    const variant = getVariant(window.localStorage);
    expect(variant).not.toBeNull();
    const seen = getEvents(window.localStorage).filter((event) => event.type === 'variant_seen');
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ variant });
    expect(root.classList.contains(`accent-${variant}`)).toBe(true);

    // And the restarted run still records votes, against the new variant.
    (root.querySelector('[data-testid="option-left"]') as HTMLButtonElement).click();
    const votes = getEvents(window.localStorage).filter((event) => event.type === 'vote');
    expect(votes).toHaveLength(1);
    expect(votes[0]).toMatchObject({ pairId: PAIRS[0].id, variant });
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

  it('offers a start-over control that clears the counts it is rendered from', () => {
    window.localStorage.setItem(
      EVENTS_KEY,
      JSON.stringify([voteEvent('pair-1', 'Coffee', 'left', 'a'), voteEvent('pair-2', 'Dogs', 'right', 'b')]),
    );
    window.localStorage.setItem(VARIANT_KEY, 'a');

    const root = document.getElementById('root') as HTMLElement;
    renderDogfoodingView(root, window.localStorage);
    expect(root.querySelector('[data-testid="total-votes"]')?.textContent).toContain('2');
    expect(root.querySelector('[data-testid="reset-hint"]')).not.toBeNull();

    (root.querySelector('[data-testid="reset-poll"]') as HTMLButtonElement).click();

    expect(getEvents(window.localStorage).filter((event) => event.type === 'vote')).toHaveLength(0);
    expect(root.querySelector('[data-testid="total-votes"]')?.textContent).toContain('0');
    expect(root.querySelector('li[data-option="Coffee"]')?.textContent).toContain('0');
    expect(root.querySelector('[data-testid="no-votes-prompt"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="your-variant"]')?.textContent).not.toContain('unknown');
  });
});
