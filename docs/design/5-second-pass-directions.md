# Second-pass directions: three alternatives to the shipped visual system

Spec for issue #23, serving parent objective #22. Three genuinely
distinct visual systems for `SwipeCard` and `DogfoodingView`, each a
full alternative to `docs/design/4-design-refresh.md` (issue #13) —
its own font stack, type scale, spacing scale, and base palette, none
of them reusing that document's values. Each direction still obeys
`docs/design/3-swipe-poll.md`'s fixed states and A/B mechanic
(variant `a` cool/blue-family, variant `b` warm/orange-family): the
three directions differ in look, never in what the components do or
how many states they have.

No code, no stylesheets, nothing here is buildable as anything but
plain CSS/custom properties — building a preview is the engineer
child that follows each direction, not this issue.

**How the three differ from each other:**

- **Ledger** is the only direction with a monospace type scale and
  the tightest spacing scale of the three (2px–32px tokens), against
  Field Notebook's generous serif spacing and Signal's dark condensed
  caps. Its base palette is the only light-neutral with a cool
  sage-paper cast, against Field Notebook's warm cream/sepia and
  Signal's near-black panel.
- **Field Notebook** is the only direction with a serif-only type
  scale and the only one using italics on its section-heading and
  muted roles, against Ledger's and Signal's uppercase/monospace
  treatments. Its spacing scale is the most generous of the three
  (6px–72px tokens) and its palette the only warm cream base, against
  Ledger's cool paper and Signal's dark panel.
- **Signal** is the only direction with a dark page background and
  uppercase type on four of its five roles, against Ledger's and
  Field Notebook's light, mixed-case pages. Its accent colors are the
  most saturated of the three, built to read as lit status indicators
  against black rather than as ink or pencil against paper.

## Ledger

A dense reading, built to feel like a research instrument logging
votes rather than a page inviting them — monospace numerals, hairline
rules, ink-on-graph-paper restraint. Must not look decorative or soft;
every value below answers to "instrument," not "friendly."

### Type scale

Font stack (system monospace, no web-font dependency):

```
ui-monospace, "SF Mono", "Cascadia Mono", "Roboto Mono", Consolas, "Liberation Mono", monospace
```

| Role                   | Size               | Weight | Line-height | Notes                        |
|-------------------------|--------------------|--------|-------------|-------------------------------|
| Page heading            | `1.75rem` (28px)   | 700    | 1.15        | letter-spacing `-0.01em`      |
| Section heading         | `1.125rem` (18px)  | 700    | 1.3         | uppercase, letter-spacing `0.04em` |
| Header/nav name         | `1rem` (16px)      | 700    | 1.2         |                               |
| Body text               | `0.9375rem` (15px) | 400    | 1.45        |                               |
| Muted/secondary text    | `0.8125rem` (13px) | 400    | 1.4         |                               |

### Spacing scale

A 2px base unit — the tightest of the three directions, matching a
dense-row, tabular reading:

| Token | Value             | Typical use                                  |
|-------|-------------------|------------------------------------------------|
| `xs`  | `0.125rem` (2px)  | space between an index label and its value     |
| `sm`  | `0.375rem` (6px)  | gap between stacked muted lines                |
| `md`  | `0.75rem` (12px)  | gap between the two `OptionPanel`s; row padding |
| `lg`  | `1rem` (16px)     | padding inside a panel or card                  |
| `xl`  | `1.5rem` (24px)   | vertical gap between major page sections        |
| `xxl` | `2rem` (32px)     | vertical margin above/below the header          |

### Color palette

| Role                 | Value      | Notes                                                       |
|----------------------|------------|---------------------------------------------------------------|
| Page background       | `#eef1ea`  | pale sage-paper, cool cast — not the shipped doc's pure white |
| Surface background     | `#ffffff`  | card and stat rows sit on this, distinct from page background |
| Primary text           | `#14201c`  | near-black with a green cast, "ink" rather than gray          |
| Muted/secondary text   | `#5b6b62`  | faded-ink green-gray                                          |
| Border                 | `#b9c4b6`  | graph-paper grid-line green-gray                               |

Contrast check: `#14201c` on `#ffffff` and `#eef1ea` both clear WCAG AA
for body text; `#5b6b62` on `#ffffff` clears AA at `0.9375rem` and
above, which covers every place it's used above.

### A/B accent

`#1d4e89` (variant `a`, ledger-ink blue) and `#b5540b` (variant `b`,
stamp-ink orange). Both distinct from every value in this direction's
own base palette (no blue or orange in it), and both still read as
cool-vs-warm exactly as `docs/design/3-swipe-poll.md` requires — a
deeper, less saturated pairing than the shipped doc's, in keeping with
an "ink on paper" rather than "screen UI" feel.

### Per-state: SwipeCard

Structural frame shared by all four states: a hairline-bordered
"ledger row" — two `OptionPanel` cells side by side, `1px` `Border`
hairlines like a table, no rounded corners, `sm` padding, a small
muted index caption (e.g. "01 / 05") in the card's top-left corner.

1. **Viewing a pair.** Both cells at rest: `Border` hairline, `Surface
   background` fill, `Primary text` label, no accent anywhere.
2. **Casting a vote.** Visually identical to viewing, except a thin
   tally-mark tick animates once along the card's top hairline —
   signals "reading input" without any color change, and both cells
   stop responding to hover/focus for the rest of this state.
3. **Post-vote confirmation.** The chosen cell's border and text
   switch to that visitor's accent color; a small right-aligned
   "ledger entry" line appears below the card (e.g. "→ Coffee
   logged"), `Muted text`, monospace; the card then exits by sliding
   fully off along the row's own horizontal axis, as if torn from a
   pad; the next row renders at rest in the same position.
4. **End state.** The card area becomes a single cell closed off by a
   double hairline top rule (a table footer double-rule), `Body text`
   message, then an outlined button in `Border`/`Primary text` —
   neutral, not accent-colored, for the same reason the base doc gives.

### Per-state: DogfoodingView

Both states share one structure: rows styled as an actual ledger
table — an index column (numeral), a label column (left, monospace),
and a count column (right-aligned, tabular numerals), each row a
`Border` hairline bottom rule.

- **Has votes.** Total votes renders as a "grand total" row set off
  by a double hairline top rule, `Primary text`, bold. The 10
  per-option rows follow, plain `Body text` label and count. The two
  per-variant rows' counts are tinted in that variant's accent color.
- **Empty.** Identical row structure, every count literally `0` in
  `Muted text`, plus one unposted-looking prompt row above the table
  (wider letter-spacing, `Muted text`) reading "No votes yet — go
  vote on a pair", linking to `/`. Per-variant counts stay `Muted
  text` here too, same reasoning as the base doc.

## Field Notebook

A hand-kept reading — warm paper tones, serif type throughout,
generous margins, like notes from actual fieldwork rather than a
web form. Must not look clinical or dense; every value below answers
to "kept by hand," not "generated."

### Type scale

Font stack (system serif, no web-font dependency):

```
Georgia, "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif
```

| Role                   | Size               | Weight | Line-height | Notes    |
|-------------------------|--------------------|--------|-------------|----------|
| Page heading            | `2.25rem` (36px)   | 400    | 1.25        |          |
| Section heading         | `1.375rem` (22px)  | 400    | 1.3         | italic   |
| Header/nav name         | `1.25rem` (20px)   | 400    | 1.2         | italic   |
| Body text               | `1.0625rem` (17px) | 400    | 1.6         |          |
| Muted/secondary text    | `0.9375rem` (15px) | 400    | 1.5         | italic   |

### Spacing scale

A 6px base unit — the most generous of the three directions:

| Token | Value              | Typical use                                    |
|-------|--------------------|--------------------------------------------------|
| `xs`  | `0.375rem` (6px)   | space between a label and its value                |
| `sm`  | `0.75rem` (12px)   | gap between stacked muted lines                    |
| `md`  | `1.25rem` (20px)   | gap between the two `OptionPanel`s; row padding    |
| `lg`  | `2rem` (32px)      | padding inside a panel or card                      |
| `xl`  | `3rem` (48px)      | vertical gap between major page sections            |
| `xxl` | `4.5rem` (72px)    | vertical margin above/below the header on desktop  |

### Color palette

| Role                 | Value      | Notes                                                    |
|----------------------|------------|-------------------------------------------------------------|
| Page background       | `#f7f1e3`  | cream paper, warm — not the shipped doc's pure white         |
| Surface background     | `#fffaf0`  | slightly lighter warm white, the card/rows sit on this        |
| Primary text           | `#3a2e1f`  | sepia-ink brown-black                                          |
| Muted/secondary text   | `#8a7860`  | faded-pencil brown                                              |
| Border                 | `#d8c9a8`  | aged-paper-edge tan                                             |

Contrast check: `#3a2e1f` on `#fffaf0` and `#f7f1e3` both clear WCAG
AA for body text; `#8a7860` on `#fffaf0` clears AA at `1rem` and
above, which covers every place it's used above.

### A/B accent

`#35608f` (variant `a`, fountain-pen blue) and `#c1601f` (variant `b`,
sealing-wax orange). Both distinct from this direction's cream/tan/
sepia base palette, and both still read as cool-vs-warm per
`docs/design/3-swipe-poll.md`.

### Per-state: SwipeCard

Structural frame shared by all four states: two "notebook page"
`OptionPanel`s side by side, a subtle drop shadow, a small rounded
top corner on each (a page-curl suggestion), `lg` padding, a dashed
rule (not a solid border) as the divider between them.

1. **Viewing a pair.** Dashed rule divider, `Primary text` serif
   italic labels at rest, no accent anywhere, a small muted-italic
   caption below the card (e.g. "Entry 1 of 5").
2. **Casting a vote.** Visually identical, except a soft 10%-opacity
   wash of `Border` tone crosses both panels briefly — reads as a
   pause "written in," not a color change — and both panels stop
   responding to hover/focus for the rest of this state.
3. **Post-vote confirmation.** The chosen panel's label switches to
   that visitor's accent color and gains a single hand-drawn-style
   rule beneath it (rather than a full accent border); a margin note
   appears beside the card (e.g. "Voted: Coffee") in muted italic; the
   card then exits by turning away/downward like a page turning,
   rather than sliding sideways; the next pair's page renders at rest
   in the same position.
4. **End state.** The card area becomes a single "closing entry"
   panel set off by a decorative double-thin top rule, `Body text`
   message, then a link styled as underlined text in `Primary text`
   (not a boxed button) — neutral, not accent-colored, keeping the
   notebook feel and the same "navigation, not a vote" reasoning as
   the base doc.

### Per-state: DogfoodingView

Both states share one structure: rows separated by dashed rules
(not solid), each row `lg` vertical padding, option label in serif
`Body text` left, count in a slightly larger serif numeral right —
built to feel hand-tallied rather than computed.

- **Has votes.** Total votes renders as a large serif numeral with a
  muted-italic caption beneath ("total votes cast"). The 10
  per-option rows follow the label/count layout above. The two
  per-variant counts are shown as small marginal tallies beside the
  main list (not inline rows), each tinted in that variant's accent —
  reads as a note in the margin rather than a table cell.
- **Empty.** Dashed rules still present, every count literally `0` in
  muted italic, plus a note-to-self-styled prompt line above the rows
  ("Nothing logged yet — go vote →"), muted italic, linking to `/`.
  Per-variant marginal tallies stay muted here too, same reasoning as
  the base doc.

## Signal

A dark instrument panel — condensed uppercase type, high contrast,
accent colors that read like status lights rather than ink. Must not
look soft or paper-like; every value below answers to "console," not
"document."

### Type scale

Font stack (system sans, condensed-leaning, no web-font dependency):

```
system-ui, "Segoe UI Semibold", "Helvetica Neue Condensed", "Arial Narrow", Arial, sans-serif
```

| Role                   | Size               | Weight | Line-height | Notes                          |
|-------------------------|--------------------|--------|-------------|----------------------------------|
| Page heading            | `1.875rem` (30px)  | 800    | 1.2         | uppercase, letter-spacing `0.03em` |
| Section heading         | `1rem` (16px)      | 700    | 1.3         | uppercase, letter-spacing `0.08em` |
| Header/nav name         | `0.9375rem` (15px) | 800    | 1.2         | uppercase, letter-spacing `0.06em` |
| Body text               | `0.9375rem` (15px) | 400    | 1.5         | normal case                      |
| Muted/secondary text    | `0.75rem` (12px)   | 500    | 1.4         | uppercase, letter-spacing `0.05em` |

### Spacing scale

A 2px base unit, tight like a control panel — distinct token values
from Ledger's despite the same base unit:

| Token | Value              | Typical use                                     |
|-------|--------------------|-----------------------------------------------------|
| `xs`  | `0.25rem` (4px)    | space between a status light and its numeral         |
| `sm`  | `0.5rem` (8px)     | gap between stacked muted lines                       |
| `md`  | `0.875rem` (14px)  | gap between the two `OptionPanel`s; row padding       |
| `lg`  | `1.25rem` (20px)   | padding inside a panel or card                         |
| `xl`  | `1.75rem` (28px)   | vertical gap between major page sections               |
| `xxl` | `2.5rem` (40px)    | vertical margin above/below the header                |

### Color palette

| Role                 | Value      | Notes                                                    |
|----------------------|------------|--------------------------------------------------------------|
| Page background       | `#0b0e11`  | near-black — the only dark page background of the three        |
| Surface background     | `#161a1f`  | dark panel, the card/rows sit on this                            |
| Primary text           | `#e8edf2`  | bright cool-white                                                 |
| Muted/secondary text   | `#7d8a97`  | steel gray                                                        |
| Border                 | `#2a3138`  | dark panel seam                                                    |

Contrast check: `#e8edf2` on `#161a1f` and `#0b0e11` both clear WCAG
AA for body text; `#7d8a97` on `#161a1f` clears AA at `0.9375rem` and
above, which covers every place it's used above.

### A/B accent

`#4da3ff` (variant `a`, electric blue) and `#ff9f40` (variant `b`,
amber orange). Both distinct from this direction's near-black/steel
base palette, more saturated than the other two directions' accents
so each reads as a lit indicator against a dark surface, and both
still read as cool-vs-warm per `docs/design/3-swipe-poll.md`.

### Per-state: SwipeCard

Structural frame shared by all four states: two `OptionPanel`s side
by side inside a dark, sharp-cornered console frame, `1px` `Border`
outline on each panel, `md` padding, a small uppercase muted index
readout above the card (e.g. "PAIR 01 / 05").

1. **Viewing a pair.** Both panels `Surface background`, `Border`
   outline, `Primary text` uppercase label, no accent lit.
2. **Casting a vote.** Visually identical, except both panels' borders
   pulse once to a dim neutral highlight — a console-cursor blink
   signalling "reading input," still no color change — and stop
   responding to hover/focus for the rest of this state.
3. **Post-vote confirmation.** The chosen panel's border and text
   switch to that visitor's accent color and gain a low-opacity glow
   (a small accent-colored box-shadow), as if a status light lit up;
   an uppercase readout line appears below the card (e.g. "VOTE
   LOGGED: COFFEE") in the accent color; the card then exits by
   dropping straight down and fading, rather than sliding sideways;
   the next pair renders at rest in the same position.
4. **End state.** The card area becomes a single dark panel with a
   centered uppercase message ("ALL PAIRS LOGGED"), then an outlined
   rectangular button, uppercase label, `Border`/`Primary text` —
   neutral, not accent-colored, same "navigation, not a vote"
   reasoning as the base doc.

### Per-state: DogfoodingView

Both states share one structure: rows as a dark readout panel, each
row a `Border` bottom seam, label in muted uppercase caps left, count
in bold `Primary text` numerals right, tabular-numeral alignment.

- **Has votes.** Total votes renders as a large bright numeral at the
  top, like a counter display, with an uppercase muted caption below
  ("TOTAL VOTES CAST"). The 10 per-option rows follow the label/count
  layout above. The two per-variant counts are shown as small
  "status light" chips — a colored dot plus numeral, each in that
  variant's accent — rather than a plain tinted number.
- **Empty.** Identical row structure, every count literally `0` in
  dim muted, the per-variant chips shown with unlit gray dots
  (`Border` color) rather than colored ones, plus an uppercase muted
  prompt line ("NO VOTES YET — GO VOTE") linking to `/`.
