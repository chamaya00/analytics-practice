# Promo mechanics: Offers screen, stacking and tiers, voucher catalogue, flash-deal sheet

Spec for issue #87, serving parent objective #79, split out of #80 (see #80's
["Promos: owned by #87"](80-two-city-brand-and-flow.md) section, and the
owner's [promo direction on #80](https://github.com/chamaya00/analytics-practice/issues/80#issuecomment-5844570967)).
This document is reviewed against that comment and against
[section 3 (items a–g) of the round-1 review on PR #84](https://github.com/chamaya00/analytics-practice/pull/84#pullrequestreview-5325193344),
which the round-2 review narrowed onto this issue verbatim. It builds on
#80's merged brand (Dontdropthatpromo, violet `#6C3CE0`/`#B79CFF`, lowercase
weight-split wordmark), sentence-case app styling, the icon tab bar, and the
English-with-`vi-VN`-prices HCMC interface — none of that is restated or
changed here, only reused.

## The outcome, the constraints, the guesses

**Outcome (fixed, from the owner's comment):** vouchers are chosen from an
Offers list and never typed; vouchers stack; progressive tiers unlock as the
basket grows; a concrete voucher catalogue covers both cities; a flash-deal
bottom sheet appears on the home feed. The "delight" beat is the tier unlock
— the owner's own words, relayed on #80: "the small hit of excitement...
getting a surprisingly good deal."

**Constraints (checked against #80's merged doc and the code, not assumed):**

- `--color-accent` is the discount/success color (#80), `--color-accent-
  secondary` is badge-fill only, dark ink on top, never white (#80's Contrast
  section, checked again below for this document's own new pairings rather
  than assumed reused).
- No typed code field anywhere, no A/B arm, no exposure event, no payment/
  card/email/phone/name field — all fixed by the parent issue's scope line
  and repeated in this issue's own "Out of scope."
- `docs/design/46-phone-native.md`'s motion durations/easings (320ms
  `cubic-bezier(0.22, 1, 0.36, 1)`) and `prefers-reduced-motion` rule are
  reused for the tier-unlock animation and the flash sheet's entrance/exit,
  rather than inventing a second motion vocabulary for one feature.
- `docs/memory/designer.md`'s lessons are applied directly: the mock's most
  important state is placed first for the viewport-sized render, the tab bar
  is included wherever the real page has one, CSS override order is checked
  where two rules touch one selector, icons are inline SVG never a unicode
  glyph, and no text run needed for `<wbr>` word-breaking gets `display:
  flex` for no reason of its own.

**Guesses this document is making, called out as such:**

- The exact voucher amounts and minimum spends (plausible, checked against
  the ₫5.000–₫50.000 range and the cross-city ratio bound below — not a
  number anyone measured).
- The flash-deal cadence (24-hour cooldown) and countdown length (45
  minutes) — plausible shapes, not measured values, same caveat #80 attached
  to its own tracker-timing guesses.
- Whether the better tier auto-selects on unlock — the owner's comment asks
  this be designed deliberately and doesn't settle it; this document decides
  yes, and says why, below.

## Look outside this repository

- **Voucherify's gamified-unlock loyalty pattern** (2026): a locked reward
  in a catalogue unlocks once a visitor crosses a stated threshold, and the
  catalogue itself states the threshold next to the still-locked reward
  rather than hiding it until earned. I'm taking the structure directly —
  the greyed voucher's "Spend X more" nudge *is* that stated threshold,
  computed live rather than fixed copy — and refusing the loyalty-program
  framing (points, tiers named "Bronze/Silver/Gold") since the owner's model
  is a single basket's live subtotal, not an account that accrues over time.
- **Voucherify's own coupon-UI guidance** (also cited in #80): state the
  savings number, don't make the visitor subtract it themselves, and show a
  progress indicator toward the next threshold rather than a flat "not
  eligible." I'm taking "show the gap, not just the lock" directly — every
  greyed row's nudge names the exact remaining amount — and refusing the
  instinct to add a numeric progress bar under each greyed row on top of the
  nudge text, which the owner's reference doesn't show and which would
  compete with the tier-unlock highlight for the same attention.
- **General 2026 discount-stacking coverage** (retailer roundups of which
  chains allow combining a percentage-off code with free shipping): the
  common shape that survives across write-ups is exactly two layers — one
  "discount" layer and one "shipping/delivery" layer — rather than open-
  ended stacking of arbitrary codes. I'm taking that shape directly: this
  catalogue's two stack groups mirror it, and I'm refusing to add a third
  general-purpose stacking layer, since the owner's own example ("one
  discount plus one delivery voucher") already names exactly two.

## Stack groups

Two groups, deliberately not more — see "Look outside," above.

- **`discount`** — money-off vouchers, including the flash-deal voucher
  (below). At most one voucher from this group is applied at a time: the
  flash voucher and a standing tier voucher would both be answering "which
  single amount-off applies right now," so they compete rather than combine.
- **`delivery`** — the one delivery-fee voucher per city. Always independent
  of whichever `discount` voucher is applied, because it answers a different
  question ("is delivery free") and the owner's own example pairs it with a
  discount rather than substituting for one.

**Which combine:** one `discount` voucher plus the one `delivery` voucher, at
most, applied simultaneously — the owner's example exactly. Within a single
group, checking a voucher unchecks whichever other voucher in that same
group was previously checked; groups never compete with each other.

## Tier ladder

Three rungs by basket size, applied within the `discount` group. `tier`
below is the catalogue's own column; "entry" marks the `delivery` voucher,
which isn't part of the size ladder — it has its own single always-available
threshold — and "flash" marks the time-boxed voucher, which substitutes into
the `discount` group only while its own window is live (see Flash deal,
below) rather than sitting on the size ladder permanently.

## Voucher catalogue — Ho Chi Minh City (₫, `vi-VN` formatting)

| id | Display label | Amount | Minimum spend | Expiry label | Stack group | Tier |
|---|---|---|---|---|---|---|
| `hcmc-delivery-entry` | Free delivery | ₫15.000 off delivery | ₫50.000 | Today | `delivery` | entry |
| `hcmc-discount-t1` | ₫10.000 off | ₫10.000 | ₫100.000 | 3 days | `discount` | 1 |
| `hcmc-discount-t2` | ₫25.000 off | ₫25.000 | ₫200.000 | 3 days | `discount` | 2 |
| `hcmc-discount-t3` | ₫45.000 off | ₫45.000 | ₫350.000 | 1 day | `discount` | 3 |
| `hcmc-flash` | ₫15.000 off flash deals | ₫15.000 | ₫80.000 | live countdown (see Flash deal) | `discount` | flash |

Every HCMC amount (₫10.000–₫45.000) sits inside the owner's ₫5.000–₫50.000
range.

## Voucher catalogue — San Francisco ($, `en-US` formatting)

| id | Display label | Amount | Minimum spend | Expiry label | Stack group | Tier |
|---|---|---|---|---|---|---|
| `sf-delivery-entry` | Free delivery | $2.99 off delivery | $10.00 | Today | `delivery` | entry |
| `sf-discount-t1` | $2 off | $2.00 | $20.00 | 3 days | `discount` | 1 |
| `sf-discount-t2` | $5 off | $5.00 | $40.00 | 3 days | `discount` | 2 |
| `sf-discount-t3` | $8 off | $8.00 | $60.00 | 1 day | `discount` | 3 |
| `sf-flash` | $2 off flash deals | $2.00 | $10.00 | live countdown (see Flash deal) | `discount` | flash |

The SF delivery amount ($2.99) is #80's own SF checkout mock's actual
delivery fee, not a rounded stand-in — the voucher waives what the fee
already is, exactly as the HCMC one waives ₫15.000 against a ₫15.000 fee.

**Cross-city ratio check** (discount ÷ minimum-spend, each SF tier against
the HCMC tier of the same label — the owner's factor-of-two bound):

| Tier | HCMC ratio | SF ratio | Ratio of ratios | Within factor of 2? |
|---|---|---|---|---|
| entry (delivery) | 15.000/50.000 = 0.300 | 2.99/10.00 = 0.299 | 1.00 | yes |
| 1 | 10.000/100.000 = 0.100 | 2/20 = 0.100 | 1.00 | yes |
| 2 | 25.000/200.000 = 0.125 | 5/40 = 0.125 | 1.00 | yes |
| 3 | 45.000/350.000 = 0.129 | 8/60 = 0.133 | 1.04 | yes |
| flash | 15.000/80.000 = 0.188 | 2/10 = 0.200 | 1.07 | yes |

## The Offers screen

Reached from checkout's **Offers row** (below), a full screen: back arrow,
title "Offers," a one-line live subtotal for context ("Your subtotal:
₫250.000"), then two sections.

**Qualifying section**, one row per voucher whose minimum spend the live
subtotal already clears, `discount`-group rows first, `delivery` second:

- a small square badge (`--color-accent-secondary` fill, dark ink icon —
  see Contrast, below)
- the amount, large and bold ("₫25.000 off")
- "Minimum spend ₫200.000"
- an expiry label with a small inline-SVG clock icon (never a unicode glyph
  — the memory lesson above), reading a day count ("3 days") or, for the
  flash voucher while its window is live, the same live mm:ss the sheet
  shows
- a checkbox: checked for whichever voucher is currently applied per group,
  unchecked but still full-color (not greyed) for a qualifying voucher in a
  group that already has a different one checked

**Greyed section**, beneath a divider, one row per voucher whose minimum
spend the live subtotal does **not** clear: the same anatomy, styled with
`--color-text-muted` for the label and amount (not lowered opacity — see
Contrast, below, for why that distinction matters) and a disabled checkbox,
each carrying its own nudge line: **"Spend ₫X more to enjoy this offer,"**
where X is that voucher's minimum spend minus the live subtotal, recomputed
on every cart change rather than fixed at screen-open.

**Sticky footer:** "You saved ₫X" (sum of every currently applied voucher's
amount) and an "Apply" button returning to checkout.

**Empty state (nothing qualifies):** both sections collapse to one block —
"Nothing qualifies yet. Add ₫50.000 more to unlock your first offer." (HCMC;
"$10.00" for SF) — naming the cheapest threshold in the catalogue, since
that is the concrete, checkable number a visitor closest to qualifying needs.
No footer in this state (nothing to save yet).

**Error state (an applied voucher stops qualifying):** triggered by removing
a cart item. The voucher that no longer clears its own minimum spend
unchecks itself immediately, its row moves from the qualifying section back
into the greyed section with a freshly computed nudge, and the checkout
breakdown's matching discount line disappears in the same update — never a
blocking state, per #80's own checkout-error guarantee ("checkout never
becomes unsubmittable because an offer stopped qualifying"). A small inline
notice appears once, at the top of the Offers screen if it's open, or as a
line under the checkout Offers row if it isn't: "Discount removed — didn't
meet ₫200.000 minimum anymore."

**What happens to a stacked partner:** independently, nothing. Each
voucher's eligibility is checked against the live subtotal on every cart
change, never against whether its partner is still applied — a `delivery`
voucher and a `discount` voucher answer different questions, and dropping
one only drops the other if the same cart change also crosses the partner's
own threshold. Worked in the HCMC example below.

## Checkout: the Offers row

Replaces the old chip row entirely. One line, opening the Offers screen on
tap, reading one of three ways depending on what's applied:

- **None applied:** "Offers  ›  Select an offer"
- **One applied:** "Offers  ›  1 applied · You saved ₫15.000"
- **Several applied:** "Offers  ›  2 applied · You saved ₫40.000"

## Checkout: the price breakdown

In order: Subtotal, Delivery fee, Service fee, then zero or one Discount
line (only the `discount`-group voucher gets its own line; the `delivery`
voucher's savings show by striking the Delivery fee row itself and replacing
it with "Free," per #80's existing `PriceBreakdown` component — a second,
redundant "Discount −₫15.000 (delivery)" line would double-represent the
same saving), then, whenever at least one voucher is applied, one bold
**"You saved ₫X"** sub-line (sum of every applied voucher's amount, matching
the Offers screen footer), then Total.

This reads as "one discount line per applied voucher" the way the owner's
review item asks: the delivery voucher's line *is* the struck-through
Delivery-fee row, the discount voucher's line *is* the Discount row — each
applied voucher owns exactly one line, none owns two.

## The tier-unlock moment

The delight beat the owner cares about most. Triggered the instant a cart
change (adding an item, increasing a quantity) brings the live subtotal
across a `discount`-tier threshold while the Offers screen is open, or is
carried into the next Offers-screen open otherwise (an animation nobody
sees isn't a delight beat, so it never plays against a closed screen):

1. **What lights up:** the newly-qualifying row transitions from the greyed
   treatment to the full-color one — muted text and disabled checkbox to
   `--color-text` label, `--color-accent`-bordered badge, and an enabled
   checkbox — over 320ms, `cubic-bezier(0.22, 1, 0.36, 1)` (#80's own
   reused easing, not a new one).
2. **Auto-select:** yes. The newly-qualifying row auto-checks itself,
   replacing whichever other `discount`-group row was checked (that row's
   own checkbox fades out over 160ms as it un-checks). The owner's comment
   asks this be deliberate rather than a side effect: a visitor who just
   crossed into a better tier should feel the upgrade happen, not have to
   go find it, and it remains a starting point rather than a lock-in — they
   can uncheck it and pick differently afterward.
3. **What animates and for how long:** a single highlight sweep — an inset
   glow in `--color-accent` at low opacity — crosses the newly-qualified row
   once, over 480ms, then fully fades; it does not loop or repeat. The "You
   saved" figures (Offers-screen footer and checkout's own sub-line) update
   in the same 320ms transition as the row's color change, a plain color/
   weight change rather than a counting-up animation — a demo checkout
   doesn't need an odometer effect the owner's reference doesn't show
   either.
4. **Reduced motion:** every transition above collapses to an instant state
   change — greyed→qualified styling and the auto-select both apply with no
   transition, sweep, or fade — per `docs/design/46-phone-native.md`'s
   existing `prefers-reduced-motion` rule, reused rather than reinvented.

## Worked example — Ho Chi Minh City

Basket subtotal **₫250.000**, delivery fee ₫15.000, service fee ₫20.000
(#80's own checkout mock's existing fee figures, unchanged).

Against the catalogue at ₫250.000:

| Voucher | Minimum spend | Qualifies? |
|---|---|---|
| `hcmc-delivery-entry` | ₫50.000 | yes |
| `hcmc-discount-t1` | ₫100.000 | yes |
| `hcmc-discount-t2` | ₫200.000 | yes |
| `hcmc-discount-t3` | ₫350.000 | **no** — greyed, "Spend ₫100.000 more to enjoy this offer" (₫350.000 − ₫250.000) |

Two `discount`-group vouchers qualify (`t1`, `t2`); the higher tier
auto-selects (`t2`), leaving `t1` qualifying-but-unchecked in the Offers
screen. Applied: `hcmc-discount-t2` (₫25.000 off) and
`hcmc-delivery-entry` (delivery waived).

**Breakdown:**

| Line | Amount |
|---|---|
| Subtotal | ₫250.000 |
| Delivery fee (struck through) | ~~₫15.000~~ Free |
| Service fee | ₫20.000 |
| Discount | −₫25.000 |
| **You saved** | **₫40.000** |
| **Total** | **₫245.000** |

Arithmetic: 250.000 + 0 (delivery waived) + 20.000 − 25.000 = **245.000**.
You saved = 15.000 (delivery) + 25.000 (discount) = **40.000**. ✓

**Error scenario from this basket:** removing a ₫60.000 item drops the
subtotal to ₫190.000. `hcmc-discount-t2`'s ₫200.000 minimum is no longer
met: it unchecks, its row moves back to greyed with "Spend ₫10.000 more,"
and the Discount line disappears (Total becomes 190.000 + 0 + 20.000 =
210.000, no discount line, "You saved ₫15.000" from delivery alone).
`hcmc-delivery-entry`'s ₫50.000 minimum is still comfortably met at
₫190.000, so it stays applied throughout — the independent-partner rule
above, worked through a real number.

## Worked example — San Francisco

Basket subtotal **$21.50**, delivery fee $2.99, service fee $1.50 (#80's own
SF checkout mock's existing figures, unchanged).

| Voucher | Minimum spend | Qualifies? |
|---|---|---|
| `sf-delivery-entry` | $10.00 | yes |
| `sf-discount-t1` | $20.00 | yes |
| `sf-discount-t2` | $40.00 | **no** — greyed, "Spend $18.50 more to enjoy this offer" ($40.00 − $21.50) |
| `sf-discount-t3` | $60.00 | **no** — greyed, "Spend $38.50 more to enjoy this offer" ($60.00 − $21.50) |

Applied: `sf-discount-t1` ($2 off) and `sf-delivery-entry` (delivery
waived).

**Breakdown:**

| Line | Amount |
|---|---|
| Subtotal | $21.50 |
| Delivery fee (struck through) | ~~$2.99~~ Free |
| Service fee | $1.50 |
| Discount | −$2.00 |
| **You saved** | **$4.99** |
| **Total** | **$21.00** |

Arithmetic: 21.50 + 0 + 1.50 − 2.00 = **21.00**. You saved = 2.99 + 2.00 =
**$4.99**. ✓ This basket also demonstrates the tier ladder directly: it
clears the entry rung and tier 1, and sits short of tiers 2 and 3 by two
different, correctly-computed amounts — the same subtotal, two live nudges.

## The flash-deal sheet

A bottom sheet over the home feed, matching the owner's reference anatomy
exactly:

- a **drag handle** at the top
- a header: **"₫15.000 off flash deals"** (HCMC) / **"$2 off flash deals"**
  (SF)
- an **mm:ss countdown** in two dark tiles (minutes, seconds), fixed dark
  colors in both app themes — see Contrast, below, for why fixed rather than
  theme-following
- a line beneath: **"Order now with min. spend ₫80.000"** (HCMC) /
  **"Order now with min. spend $10.00"** (SF) — the same figures as
  `hcmc-flash`/`sf-flash`'s minimum spend in the catalogue, not a second
  invented number
- a list of participating restaurants, each row: a square photo carrying a
  small deal sticker (badge-fill treatment, reused from #80's `RestaurantCard`
  deal badge), name, star rating with review count ("★4.7 (312)"), price
  level ("$$"), cuisine, ETA range, and the delivery fee as a deal price
  beside the struck-through original ("Free ~~₫15.000~~", "₫5.000
  ~~₫15.000~~") — this fee is per-restaurant and independent of the
  citywide `hcmc-delivery-entry` voucher; a visitor can have both a
  restaurant-specific flash delivery discount and, separately, the standing
  delivery voucher available at checkout, though only one delivery-fee
  reduction actually applies once an order is placed (whichever the
  restaurant's own listing already reflects at open-cart time — the
  flash-window fee, since it's already the lower of the two by design).

**When it appears:** on landing at the home feed, only while a flash-deal
window is currently live (the sheet is never shown with a dead countdown).

**How often:** not every load. A 24-hour cooldown, enforced by one
`localStorage` key, `flashSheetLastShown`, holding a single ISO-8601
timestamp — no restaurant ids, no voucher ids, no personal data, matching
`order-store.ts`'s existing pattern of storing only what a pure function
needs to recompute state. The sheet opens when a flash window is live and
either no timestamp is stored or the stored one is more than 24 hours old;
opening it (not merely closing it) writes the current timestamp.

**Dismissal:** dragging the handle down past a threshold, tapping the scrim
behind the sheet, a small "×" at the sheet's top-right, or tapping any
restaurant row (which navigates into that restaurant's menu, dismissing the
sheet as a side effect of leaving the feed).

**At 00:00:** the sheet auto-closes if still open, using the same 320ms
ease-out-expo exit #80 already uses elsewhere (removed under reduced
motion), the home feed's flash badges and per-restaurant deal fees disappear
immediately, and the flash voucher's Offers-screen entry — if it was
qualifying or applied — is removed outright rather than ever shown greyed:
unlike a basket voucher, no future amount of spending brings a lapsed flash
window back, so a "spend more" nudge on it would be a nudge with no honest
answer.

**How it then shows up in Offers at checkout:** while the window is live,
`hcmc-flash`/`sf-flash` appears at the top of the `discount` group's list
(qualifying or greyed exactly like any other voucher, by the live subtotal
against its own minimum spend), marked with a small "Flash" tag beside its
badge, and its expiry label shows the same live mm:ss the sheet's tiles
show — the one voucher whose expiry label ticks rather than reading a
static day count.

## The points/coins toggle — skipped, and why

The owner's reference includes a points/coins toggle ("60 coins (₫2.000
off)") and left it explicitly optional. This document skips it: it would be
a second, parallel savings ledger competing with the tier ladder for the
same "surprisingly good deal" moment the owner named as the actual goal, and
reconciling two ledgers (points earned from where, spent against what) is
exactly the kind of scope the parent issue's "no more fields than the
transaction needs" line already argues against for this demo. The voucher
system alone already delivers stacking, tiers, and the unlock delight; a
second mechanic split the attention rather than adding to it.

## Contrast — every pairing this document introduces, computed not estimated

Run with `./scripts/contrast <fg> <bg> 4.5`:

| Pair | Context | Ratio | Passes 4.5:1? |
|---|---|---|---|
| `--color-text-muted` (`#6B5D85`) on `--color-surface` (`#F7F1FF`) | greyed voucher label/amount, light | 5.38 | yes |
| `--color-text-muted` (`#B7A6D9`) on `--color-surface` (`#1E1730`) | greyed voucher label/amount, dark | 7.76 | yes |
| `--color-text-muted` (`#6B5D85`) on `--color-bg` (`#FBF7FF`) | "Spend X more" nudge / struck-through fee, light | 5.62 | yes |
| `--color-text-muted` (`#B7A6D9`) on `--color-bg` (`#16101F`) | "Spend X more" nudge / struck-through fee, dark | 8.40 | yes |
| `#FFFFFF` on `#1A1230` (new, fixed tile color) | countdown tiles, both app themes | 17.90 | yes |
| `--color-text` (`#241B33`) on `--color-accent-secondary` (`#FF7A45`) | deal sticker / Offers badge, light | 6.35 | yes |
| `--color-bg` (`#16101F`) on `--color-accent-secondary` (`#FFA36B`) | deal sticker / Offers badge, dark | 9.49 | yes |
| `--color-accent` (`#6C3CE0`) on `--color-bg` (`#FBF7FF`) | savings/success text, light | 5.91 | yes |
| `--color-accent` (`#B79CFF`) on `--color-bg` (`#16101F`) | savings/success text, dark | 8.17 | yes |
| `--color-accent` (`#6C3CE0`) on `--color-surface` (`#F7F1FF`) | savings/success text on a card, light | 5.65 | yes |
| `--color-accent` (`#B79CFF`) on `--color-surface` (`#1E1730`) | savings/success text on a card, dark | 7.55 | yes |

**The greyed rows are not shown by lowered contrast alone.** `--color-
text-muted` on `--color-surface`/`--color-bg` clears 4.5:1 in both themes
(5.38–8.40 above) — the same margin #80 already established for this token
— so "not yet qualifying" reads from the disabled checkbox, the missing
badge border color, and the nudge copy itself, never from a greyed row being
harder to read than a qualifying one.

The countdown-tile color (`#1A1230`/`#FFFFFF`) is fixed rather than
theme-following, deliberately: the owner's reference tiles are dark
regardless of the surrounding app, the same way a physical countdown clock
doesn't invert for a dark room, and fixing it means one pairing to check
rather than a second one for a dark-app-theme variant that would look
identical to a user anyway (a dark tile in a dark app and a dark tile in a
light app are the same tile).

## The mocks

Rendered at both widths with `./scripts/design-render`, per this repository's
own mock-writing convention (#80): one screen per self-contained file, light
theme only (dark is a token swap, not re-proven here). **All new and updated
mocks below are for Ho Chi Minh City** (₫, `vi-VN`), except the checkout
update, which covers both cities since #80's existing checkout mocks for
both were showing the now-retired chip-row mechanic and leaving either one
un-updated would leave a stale, incorrect mechanic committed as if it were
current.

- `docs/design/87-offers-hcmc.html` — the Offers screen, at the worked
  example's basket (₫250.000): `hcmc-discount-t2` and `hcmc-delivery-entry`
  checked (two stack groups), `hcmc-discount-t1` qualifying-but-unchecked,
  `hcmc-discount-t3` greyed with its exact nudge.
- `docs/design/87-flash-sheet-hcmc.html` — the flash-deal sheet over a
  dimmed home feed, at 375×812: drag handle, header, countdown tiles,
  min-spend line, two restaurant rows with struck-through original fees.
- `docs/design/80-checkout-hcmc.html` (updated) — the Offers row and the
  worked example's breakdown (discount line, struck-through delivery,
  "You saved," total), replacing the old promo chip-group entirely.
- `docs/design/80-checkout-sf.html` (updated) — the same, for the SF worked
  example.

Eight PNGs total (four files × two widths), committed alongside.

## Critique, after opening the rendered pictures

- **Real finding: a broken closing tag scrambled the entire Offers screen.**
  Every voucher row's expiry `<p>` was written closing with `</span>`
  instead of `</p>` (a copy-paste artifact). The markup read as correct on
  inspection, but the mismatched tag sent the browser into HTML's
  tag-soup recovery: the rendered picture showed each row's badge bleeding
  into the *previous* row's box, badges appearing at the wrong vertical
  position, and the qualifying section reading as one merged shape instead
  of three distinct cards — exactly the kind of thing design-craft's "argue
  with your own mock" step exists to catch, since the text-only markup gave
  no hint anything was wrong. Isolated with a minimal reproduction (a
  two-item version of the same structure, which rendered correctly and
  proved the flex/label approach itself was sound), then found the actual
  mismatched tag by re-reading the real file's markup line by line. Fixed
  all four occurrences and re-rendered; the qualifying section now shows
  three distinct, correctly bordered rows.
- **Round 1 finding: the delivery voucher's badge icon read as an ambiguous
  arrow/undo glyph, not as delivery.** The first hand-drawn car silhouette
  didn't survive rendering at 18px legibly. Replaced with a simpler package/
  box icon, which reads clearly at the same size in the re-render.
- **Round 1 finding: the checkout mocks repeated "Offers" as both a section
  heading and the new row's own label**, reading as "Offers / Offers 2
  applied..." — redundant once the row carries the section's identity
  itself. Removed the now-unneeded `<h2>Offers</h2>` heading from both
  checkout mocks; the row alone is enough, matching how the row already
  behaves as this section's only visible label.
- **Checked, both checkout renders, both widths:** "Place order" clears the
  fixed tab bar at 375px with no scrolling in either city, the tab bar is
  hidden at desktop width in favor of the top nav (the existing CSS-order
  fix from #80 held with no new change needed here), and the six-figure
  HCMC total ("245.000 ₫") does not wrap next to the shorter SF total
  ("$21.00") — no fix needed, consistent with #80's own earlier finding
  that the total's own line sizes to its content.
- **Checked, Offers screen, both widths:** the two checked rows (different
  stack groups) sit above the qualifying-but-unchecked row, which sits above
  the divider and the one greyed row, in that order, at both widths — the
  hierarchy the acceptance criteria asks for reads correctly rather than
  needing the eye to hunt for it.
- **Checked, flash sheet, narrow:** the drag handle, header, both countdown
  tiles, the min-spend line, and both restaurant rows (each with its
  struck-through original fee) are all visible with no clipping inside
  375×812 — nothing below the sheet's own restaurant rows was added, on
  purpose, per this repository's own render-viewport lesson: this mock's
  most important content is what's on screen without scrolling.
- **Covering `--color-accent` with my hand** on the Offers screen and both
  checkout renders: the discount line and the qualifying rows' borders both
  still read as distinct from an ordinary row, from the bold weight and the
  border alone — the accent isn't doing structural work alone.
- What I'd remove if forced to cut one thing: the flash sheet's second
  restaurant row. It stayed because a single row risks reading as a one-off
  promotion on one restaurant rather than a citywide event across several,
  which is what the owner's reference actually shows.

## No ADR

This document names a new data shape (the voucher catalogue: id, amount,
minimum spend, stack group, tier) but does not add it to `src/` — this role
has no write access there, and the parent issue's own "For the orchestrator"
section already names the event-contract and schema work as #81/#82's, not
this document's. Whichever of those pull requests first turns this
catalogue into a real type or table is where the "would somebody reversing
this need to know why" test applies, and where the ADR (if the shape counts
as a category change at that point) belongs — not here, where nothing yet
ships.

## Who reads this

- **#81** (event contract): voucher ids, stack groups, and tiers are the
  catalogue tables above, verbatim — an event naming a voucher should use
  its `id` column, never its display label.
- **#82** (the build): the Offers screen, the stacking/tier arithmetic, the
  "spend X more" nudge, and the flash sheet are specified above in full,
  including both worked examples' exact numbers to test against.

## Out of scope, unchanged

No A/B test or exposure event on any of this, no typed promo-code field, no
payment/card/email/phone/name field, no real brand's marks — the reference's
"Hot Deal" badges, bank logos, and coin branding are layout reference only,
per the parent issue's scope line.
