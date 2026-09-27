// Swipe-to-reveal for a cart row: drag a row left and a "Remove" action
// slides out from behind it. Pointer Events, so a finger and a mouse drag
// behave the same. The row only claims a gesture once it is mostly
// horizontal (|dx| > |dy|) — the row's CSS sets `touch-action: pan-y`, so a
// vertical drag stays the browser's own scroll and never reaches here as a
// swipe. On release it snaps open past 40% of the action's width, else
// back. One row open at a time; a tap anywhere else closes it.
//
// The decisions (which axis, how far, open or closed) are the pure
// functions below, unit-tested on their own; attachSwipeRow only wires them
// to pointer events and a CSS class (`.is-open`), which BaseLayout.astro's
// global styles turn into the slide.

/** How far the row slides to uncover its action, in CSS pixels — `.cart-row.is-open > .cart-line`'s translateX in BaseLayout.astro. */
export const SWIPE_OPEN_OFFSET_PX = 88;
/** The fraction of the open offset a release has to pass to snap open rather than back. */
export const SWIPE_OPEN_THRESHOLD = 0.4;
/** Movement below this on both axes is still a tap, not a gesture. */
export const SWIPE_SLOP_PX = 8;

export type GestureAxis = 'pending' | 'horizontal' | 'vertical';

/** Which way a drag is going: undecided inside the slop, horizontal only when strictly more sideways than vertical. */
export function gestureAxis(dx: number, dy: number, slop: number = SWIPE_SLOP_PX): GestureAxis {
  if (Math.abs(dx) < slop && Math.abs(dy) < slop) return 'pending';
  return Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
}

/** The row's translateX while dragging: from wherever it started (open or closed), clamped between fully closed (0) and fully open (-openOffset). */
export function swipeOffset(startOpen: boolean, dx: number, openOffset: number = SWIPE_OPEN_OFFSET_PX): number {
  const start = startOpen ? -openOffset : 0;
  return Math.min(0, Math.max(-openOffset, start + dx));
}

/** Where a released drag settles: open once it is at least `threshold` of the way open, closed otherwise. */
export function settleSwipe(
  startOpen: boolean,
  dx: number,
  openOffset: number = SWIPE_OPEN_OFFSET_PX,
  threshold: number = SWIPE_OPEN_THRESHOLD,
): 'open' | 'closed' {
  return -swipeOffset(startOpen, dx, openOffset) >= openOffset * threshold ? 'open' : 'closed';
}

export interface SwipeRowHandle {
  readonly row: HTMLElement;
  isOpen(): boolean;
  open(): void;
  close(): void;
}

// Module-level, because "opening one row closes any other" and "tapping
// elsewhere closes it" are page-wide rules, and the cart re-renders its rows
// from scratch on every change.
let openRow: SwipeRowHandle | null = null;
let documentListenerInstalled = false;

function installOutsideTapListener(doc: Document): void {
  if (documentListenerInstalled) return;
  documentListenerInstalled = true;
  doc.addEventListener(
    'pointerdown',
    (event) => {
      if (!openRow) return;
      if (!openRow.row.isConnected) {
        openRow = null;
        return;
      }
      // A press inside the open row is the row's own to handle (its action,
      // or a tap on its content, which closes it).
      if (event.target instanceof Node && openRow.row.contains(event.target)) return;
      openRow.close();
    },
    true,
  );
}

/** Closes whichever row is open, if any. */
export function closeOpenSwipeRow(): void {
  openRow?.close();
}

/**
 * Wires one row. `content` is the part that slides (and carries
 * `touch-action: pan-y`); `action` sits behind it at the trailing edge and
 * is out of the tab order and hidden from assistive tech while covered —
 * the keyboard and screen-reader way to remove a line is the stepper's
 * minus, which confirms first.
 */
export function attachSwipeRow(row: HTMLElement, content: HTMLElement, action: HTMLElement): SwipeRowHandle {
  installOutsideTapListener(row.ownerDocument);

  let isOpen = false;
  let gesture: { pointerId: number; x: number; y: number; startOpen: boolean; axis: GestureAxis } | null = null;
  // A drag (or the tap that closes an open row) is followed by a click the
  // browser synthesises on release; it must not also press the stepper
  // button the pointer happened to start on.
  let swallowClickUntil = 0;

  function applyActionVisibility(): void {
    action.tabIndex = isOpen ? 0 : -1;
    action.setAttribute('aria-hidden', String(!isOpen));
  }

  const handle: SwipeRowHandle = {
    row,
    isOpen: () => isOpen,
    open() {
      if (openRow && openRow !== handle) openRow.close();
      isOpen = true;
      openRow = handle;
      row.classList.add('is-open');
      content.style.transform = '';
      applyActionVisibility();
    },
    close() {
      isOpen = false;
      if (openRow === handle) openRow = null;
      row.classList.remove('is-open');
      content.style.transform = '';
      applyActionVisibility();
    },
  };
  applyActionVisibility();

  content.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    gesture = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, startOpen: isOpen, axis: 'pending' };
  });

  content.addEventListener('pointermove', (event) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;

    if (gesture.axis === 'pending') {
      const axis = gestureAxis(dx, dy);
      if (axis === 'pending') return;
      if (axis === 'vertical') {
        // Mostly vertical: the page's scroll, not a swipe.
        gesture = null;
        return;
      }
      gesture.axis = axis;
      if (openRow && openRow !== handle) openRow.close();
      row.classList.add('is-dragging');
      try {
        content.setPointerCapture(event.pointerId);
      } catch {
        // Not every environment supports capture; the drag still tracks
        // while the pointer stays over the row.
      }
    }

    event.preventDefault();
    content.style.transform = `translateX(${swipeOffset(gesture.startOpen, dx)}px)`;
  });

  function finish(event: PointerEvent, cancelled: boolean): void {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const ended = gesture;
    gesture = null;

    if (ended.axis !== 'horizontal') {
      // A tap. On an open row it closes the row and does nothing else.
      if (ended.startOpen && !cancelled) {
        swallowClickUntil = Date.now() + 400;
        handle.close();
      }
      return;
    }

    row.classList.remove('is-dragging');
    swallowClickUntil = Date.now() + 400;
    const settled = cancelled ? (ended.startOpen ? 'open' : 'closed') : settleSwipe(ended.startOpen, event.clientX - ended.x);
    if (settled === 'open') handle.open();
    else handle.close();
  }

  content.addEventListener('pointerup', (event) => finish(event, false));
  content.addEventListener('pointercancel', (event) => finish(event, true));

  content.addEventListener(
    'click',
    (event) => {
      // detail 0 is a keyboard-activated click, never the tail of a drag.
      if (event.detail !== 0 && Date.now() < swallowClickUntil) {
        swallowClickUntil = 0;
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true,
  );

  return handle;
}
