# Swipe poll: card, dogfooding view, and A/B variant

Spec for issue #3, serving parent objective #1. Framework-agnostic by
design — layout is described in words and structure, not code. Builds
on `docs/research/2-framework-choice.md`, which already fixed two
`localStorage` keys this spec reuses rather than renaming:

- `poll.variant` — the string `'a'` or `'b'`, this browser's assigned arm.
- `poll.events` — a JSON array of vote events, appended to on every vote.

Everything below — the swipe card, the dogfooding view, and the A/B
split — reads and writes only those two keys. Nothing else holds state.

## Data model: the event log

One event is appended to `poll.events` per vote:

| field       | type              | meaning                                              |
|-------------|-------------------|-------------------------------------------------------|
| `id`        | string            | unique id for the event (e.g. a UUID)                 |
| `pairId`    | string            | which placeholder pair this vote was cast on          |
| `option`    | string            | the label of the option chosen (e.g. `"Coffee"`)      |
| `direction` | `'left' \| 'right'` | which side of the card was swiped/tapped             |
| `variant`   | `'a' \| 'b'`      | this browser's arm at the moment of voting             |
| `timestamp` | string (ISO 8601) | when the vote was cast                                 |

This maps directly to the "couple of Supabase tables" constraint from
the parent objective: one `votes` row per event, columns `option`,
`direction`, `variant`, `ts`, plus `pair_id` and `id`.

Every number the dogfooding view shows is computed by reading and
reducing this same array — no separate counter is ever written.

## Placeholder content

A fixed, ordered queue of 5 pairs, each a genuinely unrelated pair of
options (not fantasy-football matchups — that's a separate objective):

1. `pair-1`: Coffee (left) vs. Tea (right)
2. `pair-2`: Cats (left) vs. Dogs (right)
3. `pair-3`: Beach (left) vs. Mountains (right)
4. `pair-4`: Morning person (left) vs. Night owl (right)
5. `pair-5`: Sweet (left) vs. Savory (right)

The 10 option labels above are the full set "votes per option" (AC2)
enumerates — each appears in exactly one pair, so a per-option count is
also a per-pair-per-side count; no option recurs across pairs in this
placeholder set.

The card determines the **current pair** by finding the first `pairId`
(in the order above) with no matching event in `poll.events`. This
keeps "which pair is next" derived from the event log rather than a
second hand-maintained progress counter, for the same reason the
dogfooding view must stay circular with the log. If every `pairId` has
a matching event, there is no current pair — see End state below.

## Component: SwipeCard

**Purpose:** show the current pair, accept a vote, log it.

**Structure (revised by #46 — phone-native card, nav, and dark-theme
spec):** one card, a single physical unit that is flung left or right
as a whole. The card itself is the drag surface: a pointer-drag or
touch-drag started anywhere on the card's face moves the entire card
as one rigid piece (translate + a small rotation proportional to
horizontal displacement), and releasing past the existing threshold in
`drag-gesture.ts` (80px distance or 0.5px/ms velocity, unchanged,
mostly-vertical drags still rejected) commits a vote in the direction
released. This replaces the previous structure, where each
`OptionPanel` was its own drag surface and the card read as two narrow
side-by-side columns rather than one thing — the two-column reading is
exactly what issue #46 diagnosed as not feeling native on a phone.

The card's dominant, first-read content is the current pair itself
(e.g. a centered "Coffee — Tea" caption) — not two competing option
columns. Two `OptionPanel`s remain inside the card, but demoted to a
secondary row of compact tap targets anchored along the card's bottom
edge, one toward the left half labeled with the left option and one
toward the right half labeled with the right option, each at least
44px tall (the same floor `Header.astro`'s nav links already use).
Each panel is a focusable, `Enter`/`Space`-activatable element, and
clicking, tapping, or keyboard-activating one **casts a vote for that
option immediately** — it is not a drag start and does not require
crossing the fling threshold. This is the answer to "swipe or an
equivalent tappable control": the equivalent control is a panel, not a
separate button, and tap/click/keyboard voting is never touch-only,
exactly as before — only which element owns the drag gesture has
changed, not that a panel remains individually tappable.

**Inputs:** the current pair (from the derivation above).

**States:**

1. **Viewing a pair (happy path start).** The card is at rest — no
   transform, no rotation — showing the current pair's caption and
   both `OptionPanel`s at rest with their labels, no highlight or
   accent applied yet.
2. **Casting a vote.** Triggered by dragging the card as a whole past
   the left/right threshold and releasing, or by clicking/tapping/
   activating either panel directly (a panel tap is a click/keydown
   handler on that panel, never a drag-release — the two inputs are
   independent and either alone is sufficient). Only one of these can
   register per pair: once a vote is mid-flight for the current pair,
   further input on that card — drag or panel — is ignored until the
   next pair renders (this is the "never do" for SwipeCard — it must
   never write two events for one pair).
3. **Immediately after a vote (visible sequence, in order):**
   a. The chosen panel highlights with the visitor's variant accent
      color (see A/B section) for a brief, fixed duration.
   b. A small, non-blocking confirmation appears (e.g. "Voted:
      Coffee") near the card, visible for about 1.5 seconds, then
      fades — it does not block interaction with whatever renders next.
   c. The event is appended to `poll.events`.
   d. The card animates fully off-screen in the direction voted,
      exactly like a completed swipe, regardless of whether a swipe or
      a tap triggered the vote.
   e. The next pair (per the derivation above) animates into view in
      the same position the previous card occupied. If none remains,
      the End state renders there instead.
4. **End state.** Once all 5 pairs have a matching event, the card
   area shows a static panel: a short message (e.g. "That's all the
   pairs for now — thanks for voting!"), a link to the dogfooding view
   (e.g. "See how everyone voted →"), and a **start-over control**
   beside it. No swipe or tap target remains — there is nothing left
   to vote on. A visitor who reloads after finishing lands directly
   back in this state, because it is re-derived from `poll.events`,
   not from a session flag; that is exactly why a reload cannot be the
   way back to pair 1, and why the control exists.

   **Revised (restart control).** This section originally said "this
   spec does not include a restart control," on the reasoning that a
   finished visitor has nothing left to do here. That left the demo
   with no way back to pair 1 short of clearing site data by hand,
   which is the state anyone testing it reaches after five taps.
   Pressing the control empties `poll.events` *and* clears
   `poll.variant`, so the browser is back to its first-visit state and
   the next render re-rolls an arm and logs a fresh `variant_seen` —
   see ADR 0004 for why both keys go together rather than the log
   alone. The same control appears at the foot of the DogfoodingView,
   which is where a visitor who followed the link above ends up.

**Must never:** write an event for a `pairId` that already has one;
show a pair whose `pairId` already has a matching event; hold vote
progress anywhere but `poll.events`; let a drag started on one panel
move only that panel rather than the whole card (the card is a single
rigid drag surface, not two independent ones); treat a page-level
vertical scroll as a card drag (a mostly-vertical drag stays a scroll,
per `drag-gesture.ts`'s existing rejection, and must not be blocked by
the card claiming the gesture too early — see Touch feedback in
`docs/design/46-phone-native.md` for the no-rubber-band requirement
this implies).

## Component: DogfoodingView

**Purpose:** show this site's own usage back to the visitor, built
from nothing but `poll.events`.

**Explicit statement of circularity:** the dogfooding view reads the
same `poll.events` array the SwipeCard writes to. It holds no counter
of its own — every number below is computed by filtering/reducing that
array at render time, so a vote cast in the SwipeCard is reflected here
the next time this view reads `poll.events` (including on a page the
visitor navigates to immediately after voting).

**Numbers shown, exactly:**

1. **Total votes cast** — the length of `poll.events`.
2. **Votes per option** — one row per option label listed in the
   Placeholder content section above (10 rows), each showing how many
   events have that label in `option`. An option not yet chosen shows
   `0`, it is not omitted.
3. **Votes per variant** — two numbers, the count of events where
   `variant` is `'a'` and where it is `'b'`.

**States:**

- **Has votes (happy path).** The three numbers/lists above render
  from the current `poll.events`.
- **Empty (no votes yet).** All three sections show zero values (a
  literal `0` and empty-but-labeled rows, not blank space), plus a
  short prompt linking back to the SwipeCard (e.g. "No votes yet — go
  vote on a pair").

**Must never:** maintain its own vote tally in any form (a variable, a
separate storage key, a cached total) that isn't recomputed from
`poll.events` on render — that is precisely the second hand-maintained
counter the parent objective calls out as the failure mode to avoid.

## The A/B variant

**What varies:** the accent color applied to (a) each `OptionPanel`'s
tap/hover/focus affordance and (b) the highlight shown on the chosen
panel immediately after a vote (SwipeCard state 3a above).

- Variant `a`: a cool-toned accent (blue family).
- Variant `b`: a warm-toned accent (orange family).

Nothing else about the SwipeCard or DogfoodingView structure differs
between arms — same labels, same layout, same states.

**Why this one, over copy or layout:**

- It's visible on first paint, before any interaction — unlike a copy
  difference, which only registers if the visitor reads the changed
  text.
- It can't influence *which* option wins a vote. A copy difference
  (e.g. a more persuasive button label) would confound the vote counts
  themselves; a color difference changes nothing about what's being
  compared.
- It doesn't change either component's structure, so both arms satisfy
  every SwipeCard and DogfoodingView state above identically — a
  layout difference would mean specifying and testing two shapes of
  the same four states.
- It's the cheapest to verify later: a check can assert the assigned
  variant is reflected in the rendered accent (e.g. a class or CSS
  custom property matching `poll.variant`), without diffing text.

**Assignment:** on first load in a browser, read `poll.variant`. If it
is absent (first visit), assign `'a'` or `'b'` with even odds and write
it back immediately, before the SwipeCard first renders. Every
subsequent page load and vote in that browser reuses the stored value
— the arm is stable for that visitor until they clear site storage or
use a different browser/device, which is the accepted boundary of
"per-visitor" for a client-only, no-account site (per the parent
objective).

**What confirms which arm a visitor is in:** the accent color itself is
the primary cue — a visitor voting consistently sees blue or orange
controls across their pairs and visits. In addition, the DogfoodingView
shows an explicit line (e.g. "Your variant: A") read from the same
`poll.variant` key, so a visitor curious about the mechanic (this being
a teaching site about analytics) can confirm it without having to infer
it from color alone.
