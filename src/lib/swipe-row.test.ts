import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SWIPE_OPEN_OFFSET_PX,
  attachSwipeRow,
  closeOpenSwipeRow,
  gestureAxis,
  settleSwipe,
  swipeOffset,
} from './swipe-row';

describe('gestureAxis', () => {
  it('is still pending inside the slop on both axes — a tap, not a gesture', () => {
    expect(gestureAxis(0, 0)).toBe('pending');
    expect(gestureAxis(-7, 5)).toBe('pending');
  });

  it('is horizontal only when the drag is strictly more sideways than vertical', () => {
    expect(gestureAxis(-20, 5)).toBe('horizontal');
    expect(gestureAxis(20, -19)).toBe('horizontal');
  });

  it('is vertical when the drag is as much or more vertical — the page scroll keeps it', () => {
    expect(gestureAxis(-10, 30)).toBe('vertical');
    expect(gestureAxis(-15, 15)).toBe('vertical');
    expect(gestureAxis(2, -12)).toBe('vertical');
  });
});

describe('swipeOffset', () => {
  it('follows a left drag from closed, clamped at fully open', () => {
    expect(swipeOffset(false, -30)).toBe(-30);
    expect(swipeOffset(false, -500)).toBe(-SWIPE_OPEN_OFFSET_PX);
  });

  it('never moves right of closed', () => {
    expect(swipeOffset(false, 40)).toBe(0);
  });

  it('starts from fully open when the row was open, and a right drag closes it', () => {
    expect(swipeOffset(true, 0)).toBe(-88);
    expect(swipeOffset(true, 30)).toBe(-58);
    expect(swipeOffset(true, 200)).toBe(0);
    expect(swipeOffset(true, -30)).toBe(-88);
  });
});

describe('settleSwipe — snap open past 40% of the action, else back', () => {
  // 40% of 88px is 35.2px.
  it('snaps back from a short left drag', () => {
    expect(settleSwipe(false, -20)).toBe('closed');
    expect(settleSwipe(false, -35)).toBe('closed');
  });

  it('snaps open once a left drag passes 40% of the action width', () => {
    expect(settleSwipe(false, -36)).toBe('open');
    expect(settleSwipe(false, -88)).toBe('open');
    expect(settleSwipe(false, -300)).toBe('open');
  });

  it('an open row stays open under a small right drag and closes past the threshold', () => {
    expect(settleSwipe(true, 20)).toBe('open');
    expect(settleSwipe(true, 52)).toBe('open'); // still 36px open
    expect(settleSwipe(true, 53)).toBe('closed'); // 35px open
  });

  it('respects an explicit offset and threshold', () => {
    expect(settleSwipe(false, -49, 100, 0.5)).toBe('closed');
    expect(settleSwipe(false, -50, 100, 0.5)).toBe('open');
  });
});

describe('attachSwipeRow — pointer wiring', () => {
  afterEach(() => {
    closeOpenSwipeRow();
    document.body.innerHTML = '';
  });

  function makeRow(): { row: HTMLElement; content: HTMLElement; action: HTMLButtonElement; inner: HTMLButtonElement } {
    const row = document.createElement('li');
    const action = document.createElement('button');
    const content = document.createElement('div');
    const inner = document.createElement('button');
    content.append(inner);
    row.append(action, content);
    document.body.append(row);
    return { row, content, action, inner };
  }

  function pointer(target: EventTarget, type: string, x: number, y = 0): void {
    target.dispatchEvent(
      new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', clientX: x, clientY: y }),
    );
  }

  function drag(target: HTMLElement, fromX: number, toX: number, toY = 0): void {
    pointer(target, 'pointerdown', fromX);
    pointer(target, 'pointermove', fromX + (toX - fromX) / 2, toY / 2);
    pointer(target, 'pointermove', toX, toY);
    pointer(target, 'pointerup', toX, toY);
  }

  it('the action starts covered: out of the tab order and hidden from assistive tech', () => {
    const { row, content, action } = makeRow();
    attachSwipeRow(row, content, action);
    expect(action.tabIndex).toBe(-1);
    expect(action.getAttribute('aria-hidden')).toBe('true');
  });

  it('a long left drag opens the row and uncovers the action', () => {
    const { row, content, action } = makeRow();
    const handle = attachSwipeRow(row, content, action);
    drag(content, 200, 120);
    expect(handle.isOpen()).toBe(true);
    expect(row.classList.contains('is-open')).toBe(true);
    expect(action.tabIndex).toBe(0);
    expect(action.getAttribute('aria-hidden')).toBe('false');
  });

  it('a short left drag snaps back', () => {
    const { row, content, action } = makeRow();
    const handle = attachSwipeRow(row, content, action);
    drag(content, 200, 180);
    expect(handle.isOpen()).toBe(false);
  });

  it('a mostly vertical drag is left to the page scroll and never moves the row', () => {
    const { row, content, action } = makeRow();
    const handle = attachSwipeRow(row, content, action);
    drag(content, 200, 150, 120);
    expect(handle.isOpen()).toBe(false);
    expect(content.style.transform).toBe('');
  });

  it('opening one row closes any other', () => {
    const first = makeRow();
    const second = makeRow();
    const a = attachSwipeRow(first.row, first.content, first.action);
    const b = attachSwipeRow(second.row, second.content, second.action);
    drag(first.content, 200, 100);
    drag(second.content, 200, 100);
    expect(a.isOpen()).toBe(false);
    expect(b.isOpen()).toBe(true);
  });

  it('a press anywhere outside the open row closes it', () => {
    const { row, content, action } = makeRow();
    const handle = attachSwipeRow(row, content, action);
    drag(content, 200, 100);
    pointer(document.body, 'pointerdown', 10);
    expect(handle.isOpen()).toBe(false);
  });

  it('pressing the uncovered action does not close the row before its own click runs', () => {
    const { row, content, action } = makeRow();
    const handle = attachSwipeRow(row, content, action);
    drag(content, 200, 100);
    pointer(action, 'pointerdown', 300);
    expect(handle.isOpen()).toBe(true);
  });

  it('a tap on an open row’s content closes it without pressing the control under the finger', () => {
    const { row, content, action, inner } = makeRow();
    const handle = attachSwipeRow(row, content, action);
    const onInner = vi.fn();
    inner.addEventListener('click', onInner);
    drag(content, 200, 100);

    pointer(inner, 'pointerdown', 50);
    pointer(inner, 'pointerup', 50);
    inner.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));

    expect(handle.isOpen()).toBe(false);
    expect(onInner).not.toHaveBeenCalled();
  });

  it('the click that ends a drag started on a control does not press it', () => {
    const { row, content, action, inner } = makeRow();
    attachSwipeRow(row, content, action);
    const onInner = vi.fn();
    inner.addEventListener('click', onInner);

    drag(inner, 200, 100);
    inner.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));

    expect(onInner).not.toHaveBeenCalled();
  });

  it('a keyboard-activated click is never swallowed', () => {
    const { row, content, action, inner } = makeRow();
    attachSwipeRow(row, content, action);
    const onInner = vi.fn();
    inner.addEventListener('click', onInner);

    drag(inner, 200, 100);
    inner.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));

    expect(onInner).toHaveBeenCalledTimes(1);
  });
});
