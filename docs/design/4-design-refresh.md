# Visual system: typography, spacing, color, header/nav, and per-state styling

> **Superseded.** The neutral system this document specifies is no longer
> the live design. The shipped design is the Signal × Field Notebook
> hybrid — Signal's type scale, spacing, and structure with Field
> Notebook's palette and accent pair — specified in the
> [Signal](5-second-pass-directions.md#signal) and
> [Field Notebook](5-second-pass-directions.md#field-notebook) sections of
> `docs/design/5-second-pass-directions.md`. Everything below this notice
> describes the retired neutral system and is kept for history, not as a
> build reference.

Spec for issue #13, serving parent objective #12. Covers the shared
visual system for the swipe-poll page (`/`) and the dogfooding page
(`/results/`), which today share no typography, spacing, or color
system beyond the inline styles in `src/pages/index.astro`. Builds on
the behavioral states already defined in `docs/design/3-swipe-poll.md`
— this document adds look, not behavior, and changes nothing about
that spec's states, data model, or A/B mechanic.

No component implementation, no stylesheets, no code. Everything below
is a naming and a set of values for the engineer to build against.

## Typography scale

Font stack (system fonts, no web-font dependency):

```
-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif
```

Justification for no web font: both pages are short-lived reads (a
card and a stat list), not brand surfaces, and this is a static site
with no build-time font pipeline today — adding one would be a new
dependency with nothing behavioral to justify it.

| Role                                   | Size              | Weight | Line-height |
|-----------------------------------------|-------------------|--------|-------------|
| Page heading (`<h1>`)                   | `2rem` (32px)     | 700    | 1.2         |
| Section heading (e.g. a stat group label) | `1.25rem` (20px) | 600    | 1.3         |
| Header/nav site name                    | `1.125rem` (18px) | 600    | 1.2         |
| Body text                               | `1rem` (16px)     | 400    | 1.5         |
| Muted/secondary text                    | `0.875rem` (14px) | 400    | 1.4         |

Only these five roles are needed across both pages; nothing in either
page's content calls for a heading level below `<h2>` or a size not
listed here.

## Spacing scale

A 4px base unit, six values, reused for padding, gaps, and margins on
both pages — no other spacing value is introduced:

| Token  | Value            | Typical use                                      |
|--------|------------------|---------------------------------------------------|
| `xs`   | `0.25rem` (4px)  | space between a label and its value               |
| `sm`   | `0.5rem` (8px)   | gap between stacked muted lines                   |
| `md`   | `1rem` (16px)    | gap between the two `OptionPanel`s; row padding    |
| `lg`   | `1.5rem` (24px)  | padding inside a panel or card                    |
| `xl`   | `2rem` (32px)    | vertical gap between major page sections          |
| `xxl`  | `3rem` (48px)    | vertical margin above/below the header on desktop |

## Base color palette

Neutral grays only — no blue or orange anywhere in this palette — so
the existing A/B accent colors (see "A/B accent mechanic" below) read
as the only colored elements on either page, not as one option among
several similarly-saturated colors.

| Role                | Value      | Notes                                                        |
|---------------------|------------|---------------------------------------------------------------|
| Page background      | `#ffffff`  | both pages                                                    |
| Surface background    | `#f7f7f8`  | the swipe card and stat rows sit on this, distinct from page background |
| Primary text          | `#1a1a1a`  | headings and body copy                                        |
| Muted/secondary text  | `#6b6b6b`  | labels, timestamps, the "0 votes" empty-state copy            |
| Border                | `#d9d9d9`  | panel borders, header bottom rule, stat-row dividers          |

Contrast check: `#1a1a1a` on `#ffffff` and on `#f7f7f8` both clear
WCAG AA for body text; `#6b6b6b` on `#ffffff` clears AA for text at
`1rem` and above, which covers every place it's used above.

No CSS framework or dependency decision is made here. If the engineer
building the layout child wants one (e.g. Tailwind, for utility-class
speed at the cost of a new build-time dependency and an ADR), that
trade-off is named here but decided there, per this issue's scope.

## Shared header/nav

**Contains**, left to right on desktop: the site name/title ("Analytics
practice"), then the two nav links — "Swipe poll" (`/`) and "Results"
(`/results/`) — right-aligned. The link matching the current page is
visually marked as current (e.g. underlined, non-clickable-looking)
rather than repeated as a plain link.

**Layout, desktop:** a single horizontal row, `xxl` (48px) tall
including `lg` (24px) vertical padding, site name and nav links on one
line, a `1px` `#d9d9d9` border along the bottom separating it from
page content. Site name uses the header/nav type role from the scale
above; nav links use body text size.

**Layout, mobile-narrow (viewport ≤480px, matching the
`width=device-width` viewport meta already set on both pages):** the
row wraps to two lines rather than shrinking text or truncating the
site name — site name on its own line, the two nav links below it on
a second line, left-aligned, separated by `md` (16px) horizontal gap.
Each nav link keeps a minimum 44px tap-target height, per the "voting
is never touch-only" precedent this repo already sets for the
`OptionPanel` control.

Both pages currently duplicate a "go to the other page" link inline
(`index.astro`'s "See how everyone voted →", `results.astro`'s "← Back
to the swipe poll"). The header/nav replaces both — those inline links
are removed once the header ships, since the nav now covers that
navigation on every page, not just the one each link was hand-added to.

## Per-state visual treatment: SwipeCard

All four states below share the same structural frame: the card is a
`Surface background` rectangle, `lg` padding, containing two
`OptionPanel`s side by side with `md` gap between them, each panel
`Border`-outlined at `1px`.

1. **Viewing a pair.** Both panels at rest: `Border` outline,
   `Surface background` fill, `Primary text` label, no accent color
   anywhere on the card. This is the only state where neither panel
   shows any variant color.
2. **Casting a vote (mid-flight).** Visually identical to "viewing" —
   the behavioral spec requires this state to be near-instantaneous
   and to make further input a no-op, not to look different. The only
   change is that both panels stop responding to hover/focus styling
   for the remainder of this state, so a visitor mid-vote gets no
   visual invitation to interact again before the next state renders.
3. **Post-vote confirmation.** In the order the behavioral spec fixes:
   a. The chosen panel's border and text switch to the visitor's
      variant accent color (see below), replacing `Border`/`Primary
      text` on that panel only — the un-chosen panel stays at rest.
   b. A small confirmation surface (e.g. "Voted: Coffee") appears
      near the card: `Surface background`, `Primary text`, `sm`
      padding, positioned so it doesn't overlap either panel's label.
   c. (data write — no visual change.)
   d. The whole card translates fully off-screen toward the voted
      side; no color change during this motion beyond what's already
      set in (a).
   e. The next pair's card renders at rest (state 1 above) in the
      same position, or the End state (below) if none remains.
4. **End state.** The card area is replaced by a single `Surface
   background` panel, `lg` padding: a short `Body text` message, then
   one link/button ("See how everyone voted →") styled as an outlined
   button using `Border`/`Primary text` — neutral, not accent-colored,
   since it's a navigation control rather than a vote, and using
   either variant's accent here would read as favoring that variant.

## Per-state visual treatment: DogfoodingView

Both states share one structure: a page-width column of stat rows,
each row `md` vertical padding and a `Border` bottom divider, laid out
top to bottom as: total votes, then the 10 per-option rows, then the
two per-variant counts.

- **Has votes.** Total votes renders as one large number (section
  heading size, `Primary text`) with a `Muted text` label below it
  ("total votes cast"). Each of the 10 per-option rows shows the
  option label (`Body text`) left-aligned and its count
  (`Body text`, right-aligned) on the same row. The two per-variant
  rows follow the same label/count layout, each count shown in that
  variant's accent color (blue for `a`, orange for `b`) so the split
  is visible at a glance without reading the labels — this is the one
  place outside the SwipeCard where an accent color appears, and it's
  additive: the neutral layout is unchanged, only the two numbers are
  tinted.
- **Empty (no votes yet).** Identical row structure, every count
  literally `0` in `Muted text` rather than `Primary text` (not
  omitted, not blank), plus one `Body text` prompt line above the
  rows ("No votes yet — go vote on a pair") linking to `/`. The
  per-variant row counts stay `Muted text` here too, not accent
  colored — there's nothing to tint yet, and coloring a `0` would
  suggest a result before one exists.

## A/B accent mechanic — explicit confirmation

Unchanged from `docs/design/3-swipe-poll.md`: **variant `a` stays a
cool/blue-family accent, variant `b` stays a warm/orange-family
accent.** This spec reuses the exact values already live in
`src/pages/index.astro` rather than introducing new ones:

- Variant `a`: `#2b6cb0` (blue).
- Variant `b`: `#c05621` (orange).

Both are visibly distinct from each other (blue vs. orange, not two
shades of one hue) and from every color in the base palette above,
which is built entirely from neutral grays with no blue or orange in
it. Nothing in this spec — the header/nav, the base palette, or either
component's neutral states — introduces a third accent color or a
near-blue or near-orange gray that could be confused with either
variant's accent. The accent mechanic's only two appearances stay
exactly where the behavioral spec put them: the chosen `OptionPanel`
after a vote, and (newly named here, additively) the per-variant
counts on the dogfooding view.
