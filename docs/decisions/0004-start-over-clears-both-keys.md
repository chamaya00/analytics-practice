# ADR 0004: Starting over clears both poll keys, not just the event log

Date: 2026-09-20
Status: accepted

## Context

`docs/design/3-swipe-poll.md` derives the current pair from `poll.events`
and re-derives it on every render, so a visitor who has voted on all five
pairs lands back in the End state on every reload — by design, and with no
way out of it short of clearing site data in devtools. That is the state
anyone testing the demo reaches after five taps, and it made repeated
passes through the card impossible.

Adding a control that empties the log is the obvious fix, but it forces a
second decision the design doc does not cover: whether `poll.variant` goes
with it. ADR 0002 records that a `variant_seen` event is appended exactly
once, at the moment a variant is first assigned. Clearing the log alone
would leave a persisted variant with no `variant_seen` event anywhere
behind it — a combination no ordinary visit can produce, and one that
would silently break the property ADR 0002 exists to hold: that every
assignment a browser was given is recorded in the log it also votes into.

## Decision

The start-over control calls `resetPoll`, which removes both `poll.events`
and `poll.variant`. The page then re-renders through the same
`assignVariant` path a first-time visitor takes: a fresh arm is rolled with
even odds, a single `variant_seen` event is appended, and the card starts at
pair 1. The control renders in the SwipeCard's End state and at the foot of
the DogfoodingView, which are the two places a finished visitor can be.

## Consequences

A browser's poll state has exactly two shapes after this: absent, or one
`variant_seen` event followed by that arm's votes. ADR 0002's invariant is
restated slightly — one `variant_seen` per *log*, rather than one per
browser for all time — and every stats function still reads that one log,
so nothing downstream changes. Re-rolling the arm on each restart is what
makes the demo testable in both arms from one browser, which sticky
assignment otherwise prevents.

The cost is that a restart is destructive and irreversible: the votes in
that browser are gone, and the arm a tester was in does not survive it. For
a single-browser demo whose whole event log is five taps old that is the
intended reading of "start over," but it is the reason the control is
labelled plainly and the results page says what it clears before it is
pressed. Once this demo is backed by real storage rather than
`localStorage`, a reset will need to decide what it does to rows other
people can see — this ADR does not answer that, and should be revisited
rather than extended.

## Alternatives rejected

- **Clear `poll.events` and keep `poll.variant`.** Rejected: it leaves an
  assigned arm with no `variant_seen` event in the log, contradicting ADR
  0002, and it pins a tester to one arm for the life of the browser
  profile — the opposite of what a restart is for here.
- **A reset that only appears in a debug mode or behind a query string.**
  Rejected: it is the finished visitor, not only the developer, who has
  nowhere to go from the End state, and a control nobody can find is
  indistinguishable from the problem it was added to solve.
- **A confirmation step before clearing.** Rejected for now: the data at
  risk is five taps in one browser, and the control's own labelling says
  what it does. Worth revisiting the moment a reset can destroy anything a
  second person could see.
