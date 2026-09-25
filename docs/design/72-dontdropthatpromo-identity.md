# Dontdropthatpromo: replacing Phantom Fork's identity

Spec for issue #72, serving parent objective #63. The owner picked
**Dontdropthatpromo** on #63 — neither of #65's two directions — and asked
for a voice built around the name itself, not a reskin of Phantom Fork's
ghost theme or The Waitlist's deadpan register. This document replaces every
Phantom-Fork-branded string in `docs/design/65-parody-flow.md`. It does not
touch flow, screen states, the checkout constraints, the privacy-note
placement, or the tracker mechanics — that document says those hold under
any name, and nothing here disagrees.

## What's fixed, checked rather than assumed

- `src/styles/global.css`'s tokens (type scale, spacing scale, light/dark
  color pairs) are unchanged — reusing them exactly as 65 did. No new hex
  value appears anywhere in this document, so there is nothing new for
  `./scripts/contrast` to check; the pairs in play are the same ones
  `contrast.test.ts` already covers.
- `Header.astro`'s reshape-at-480px pattern, the three nav destinations
  (Restaurants, Cart, Tracker), the cart badge, and every non-branded string
  (CTA copy, "Start over," the order-in-progress banner, drop-off spot
  chips, utensils toggle, tip selector) are unchanged. None of them names or
  implies Phantom Fork.
- The four checkout fields' *types* and the flow's seven screens are
  unchanged per #65. What changes below is named explicitly (see "Checkout
  field set," below) rather than assumed to be everything.

## Look at what's there now

`./scripts/app-render` still refuses — `BUILD_CMD` and `SERVE_DIR` are empty
in `scripts/app-render`, unchanged since #65 found the same thing, so no
role can compare a built page against anything yet. Read rather than
rendered: the merged Phantom Fork mocks
(`docs/design/65-parody-checkout-wide.png`, `65-parody-tracker-wide.png`),
opened directly. The checkout mock reads top-to-bottom exactly as 65's
critique described — wordmark, four preset groups, "Place order" last — with
"PHANTOM FORK" and a small fork glyph (tines fading into three dots) as the
site-name mark, and "Instructions for the ghost rider" as the second group's
heading. The tracker mock stacks labeled states with the same wordmark and
glyph, the glyph reappearing fully faded in state 7d. Those two — the
wordmark/glyph and the "ghost rider" heading — are the only strings the
actual committed mocks contain; "Ghost Kitchen," "Sisyphus Sushi," "The Long
Wait Diner," and the tracker line the parent issue quotes ("Your rider has
been seen. Once.") exist only as prose examples in `65-parody-flow.md`, not
in any built or rendered artifact — confirmed by grepping both mock HTML
files for every ghost/fork/phantom string. The replacement table below still
covers all of them, prose or mock, so nothing Phantom-Fork-branded is left
standing regardless of where it lived.

## Look outside this repository

- **Fragile-shipping-label convention** (current stock-label and packaging-
  supplier catalogs, 2026): bold outline, high contrast, a stamped/rotated
  treatment rather than a rendered illustration — the visual grammar of "this
  was physically applied to a thing in transit." I'm taking the *stamped,
  applied-once* quality as the visual counter-argument for Direction 2 below,
  and refusing the literal red-and-white hazard-label palette — this site's
  existing accent tokens already carry the warm/cool contrast job, and a
  third color system fighting them would be the kind of thing nobody asked
  for. [Fragile Label Images](https://stock.adobe.com/search?k=fragile+label),
  [Fragile Shipping Label with Icon](https://www.jjkeller.com/shop/fragile-shipping-label-with-icon)
- **"6 Brand Mascot Design Trends for 2026"** (svgapp.ai): the piece's
  strongest point is a *motion-first character system* — Duolingo's mascot
  playing a distinct animation per outcome (correct answer, a streak)
  rather than sitting static as a logo. I'm taking that directly for
  Direction 1's mark below — a small figure with life-cycle states tied to
  what's actually happening (held → caught → dropped) rather than one static
  glyph reused unchanged everywhere, which is what both #65 directions did
  even though Phantom Fork's own critique already identified "gives the
  tracker something to hold onto" as the reason it beat The Waitlist. I'm
  refusing the article's "young but not childish" mascot-character framing
  wholesale — a fully rendered character is a bigger asset than this static
  HTML mock needs or than the existing token system supports without a new
  illustration language. [6 Brand Mascot Design Trends for 2026](https://svgapp.ai/blog/mascot-design-trends-2026/)
- **`docs/design/65-parody-flow.md`'s own FoodNeverComes reference** carries
  forward unchanged — this document isn't re-deciding the tracker's stepped
  (not live-map) mechanic, only its brand skin, so I'm not re-researching a
  constraint #65 already settled and cited correctly.

## Two directions, one name

The name itself isn't a guess — the owner fixed it. What's still open is how
literally to take it: a mark and voice can play "don't drop that promo" as a
physical-object anxiety, or as a deadpan logistics/paperwork bit. Both stay
inside the fixed layout and unchanged tokens; the difference is structural —
what the mark *does* over the course of the flow, not which two colors it
uses.

### Direction 1: Precious Cargo (recommended)

The promo code is treated as fragile physical cargo the app is obsessively
responsible for — more anxiously protected than the food itself, which is
the whole joke: nobody worries whether the meal arrives, everybody worries
whether the promo survives the trip. Tagline: **"The food's not the point.
The promo is."**

- **Wordmark:** "DONTDROPTHATPROMO" in the existing `h1` treatment (uppercase,
  800 weight, `0.03em` tracking), run together with no spaces — the one
  deliberate oddity (design-craft item 8): it reads like something typed in
  one breath without stopping for punctuation, which is defensible here
  specifically because the whole identity is about a thing being handled
  too urgently to pause.
- **Mark:** a small drop glyph before the wordmark, with three life-cycle
  states instead of one static glyph (see "The mark," below) — held, caught,
  dropped. This is what Duolingo's motion-first mascot pattern (above)
  argues for and what Phantom Fork's own post-mortem already found worked:
  giving the tracker screen something visual the joke can resolve into,
  rather than a progress bar that just stops.
- **Voice:** over-invested courier energy — every line reads like someone
  narrating a delivery under far too much self-imposed pressure, about the
  promo specifically. Restaurant names lean absurd-clumsy ("Fumble & Sons,"
  "One Job Pizza," "Try Not To Wok"), and the tracker's stalled-state copy
  reports on the promo's custody, not the food's location.
- **Why recommended:** same reasoning 65 used to pick Phantom Fork over The
  Waitlist — an evolving mark gives the tracker, the screen the whole joke
  has to land on, something to visually resolve, and it's the stronger
  direction to actually render, so the mock below builds this one. Direction
  2 renders on the identical structure with its own mark and copy swapped in
  if the owner prefers it — nothing about layout, fields, or components
  changes between them.

### Direction 2: Chain of Custody

A deadpan logistics/paperwork register — the promo code comes with an
absurd amount of imaginary liability, tracked like a bonded shipment.
Tagline: **"Custody never transfers. Ownership: pending."**

- **Mark:** a small stamped "FRAGILE" badge, rotated a few degrees, styled
  after the shipping-label convention above (bold outline, no fill) — static
  throughout, since a stamp doesn't move once applied. Reused unchanged on
  every screen it appears.
- **Voice:** flat, form-language register applied to a joke object
  ("Promo code accepted. Custody transferred. Signed for by: nobody yet.").
- **Trade-off against Direction 1:** funnier the more a visitor already
  recognizes shipping/legal-paperwork clichés — a narrower audience than
  "something you might drop" needs — and, like The Waitlist before it, it
  gives the tracker screen a mark that never changes, so the joke lives
  almost entirely in copy rather than in copy *and* a mark that visibly
  resolves.

**This is the owner's call to override, not mine** — presenting both per
design-craft; the rest of this document (flow, fields, components) is
identical either way, and the mock renders Direction 1.

## The direction, stated

**Over-invested, deadpan-anxious, tactile.** It must not look reverent or
supernatural (Phantom Fork's register) and it must not go flat corporate-
onboarding (The Waitlist's register) — and, pointedly, it must not look like
an actual marketing promo banner, which the name invites and the joke
depends on refusing: nothing on this site is discounted, and the identity
should never read as a real coupon push.

## The mark

One glyph, three states, replacing the fork glyph's single "trailing dots"
treatment with something that changes across the flow the way the tracker
itself does:

- **Held (default — header, checkout, tracker states 7a–7c):** a small
  teardrop shape gripped from above by a short curved hook, both solid in
  `--color-accent-a`. Reads as "still being carried, carefully."
- **Caught (order-placed, replacing Phantom Fork's "mark resolves" moment):**
  the same glyph, animated from a slightly offset/falling position into the
  held position — 320ms, `cubic-bezier(0.22, 1, 0.36, 1)`, the same named
  motion 46-phone-native.md and 65 already use elsewhere on this site, not a
  new system. Removed entirely (no fallback fade) under
  `prefers-reduced-motion: reduce`, matching 65's existing rule for the same
  screen. This is the one moment the mark visibly succeeds, which is why
  it's worth keeping as its own screen instead of folding into a toast — 65
  already made that argument for Phantom Fork's version of this moment and
  it holds here unchanged.
- **Dropped (tracker state 7d only, replacing the fork glyph's full fade):**
  the hook opens, the teardrop falls out of the grip, fully rendered in
  `--color-text-muted` at reduced opacity — the one moment the mark actually
  fails, which is the payoff the whole identity has been setting up. Static,
  no motion (a stamp-still moment is correct here — nothing is "happening"
  anymore, which state 7d's copy says outright). Accompanying line: **"Well.
  We dropped it."**

## Replacement table — every Phantom-Fork-branded string

| Where | Phantom Fork (old) | Dontdropthatpromo (new) |
|---|---|---|
| Wordmark | "PHANTOM FORK" | "DONTDROPTHATPROMO" |
| Header/mark glyph | Fork glyph, tines fading to three dots | Drop glyph, held/caught/dropped states (above) |
| Tagline | "Order. Wait. Wonder." | "The food's not the point. The promo is." |
| Landing honest-pitch line | "Order real food. Watch it not arrive. That's the whole app." | "Order real food. Guard a promo code the whole time. Neither one shows up." |
| Restaurant name (example) | "Ghost Kitchen" | "Fumble & Sons" |
| Restaurant name (example) | "Sisyphus Sushi" | "One Job Pizza" |
| Restaurant name (example) | "The Long Wait Diner" | "Try Not To Wok" |
| Checkout group heading | "Instructions for the ghost rider" | "Handling instructions (for the promo, mostly)" |
| Checkout group option | "Leave it & run" | "Guard it with your life" |
| Checkout group option | "Knock loudly" | "Eh, wing it" |
| Checkout group option | "Don't knock" | "Two hands, at all times" |
| Checkout group option | "Surprise me" | "Surprise me" (unchanged — not ghost-specific, already fits the new voice) |
| Tracker 7a flavor text | "Your rider is nearby (allegedly)." | "Your promo is still in your hand. Don't jinx it." |
| Tracker 7b flavor text (the never-delivers state) | "Still on the way. Any minute now." | "Still holding it. Still not dropped. That's something." |
| Tracker 7c flavor text | "42 minutes and counting" / "New personal record" | Unchanged — elapsed-time copy, not ghost-branded |
| Tracker 7d screen | Fork glyph fully faded; "Look — we don't think it's coming either." | Drop glyph in its dropped state; "Well. We dropped it." |
| Order-placed confirmation moment | Fork glyph "completing rather than trailing off" | Drop glyph animating from falling to caught (above) |
| Mock page titles | "Phantom Fork — checkout mock" / "— tracker mock, all states" | "Dontdropthatpromo — checkout mock" / "— tracker mock, all states" |

Nothing Phantom-Fork-branded is left off this table — every string named in
#72's issue body, plus every one this run found by re-reading 65's document
and grepping both committed mock files, has a replacement above.

## Checkout field set: one field added, four unchanged

`docs/design/65-parody-flow.md`'s four fields keep their type and allowed
values exactly. Only the **Instructions** group's heading and option labels
change (voice only, table above) — its structure (single-select chip group,
always one selected) and its role in the flow are identical.

**One field is added, as a preset choice, never free text**, matching the
constraint that carried over from #63:

- **Promo code (guard this)** — single-select chip/radio group,
  `PresetChoiceGroup` (existing component, reused as-is). Placed last, right
  before the "What we log, and why →" link — the final "precious cargo" beat
  before the order submits. Defaults to the first option, so checkout stays
  reachable in one tap with zero required input, same guarantee 65 already
  established for the other four fields.
  - **DONTDROPTHIS10** (default)
  - **STILLHOLDINGIT**
  - **BUTTERFINGERS**
  - **CAUGHTYA**

  Flavor only — nothing is charged anywhere in this flow, the same as the
  tip selector 65 already specifies and defends on identical grounds.

## What this changes in the event contract — named for #67/#72's successor, not edited here

`docs/measurement/66-parody-event-contract.md` is analyst-owned; editing it
is out of scope here (single-role rule). Naming exactly what needs to change,
so the next child can act without re-deriving it:

1. **§8, disclosure text.** The bullet "instructions for the ghost rider"
   must follow the new label: "your handling instructions (mostly about the
   promo) and your promo code choice." The rider-instructions *enum keys*
   (`leave_and_run`, `knock_loudly`, `dont_knock`, `surprise_me`) do not
   change — only checkout's on-screen labels change, and the contract's
   props table already stores keys, not labels, so no schema line for that
   field needs to move. One new bullet is needed for the added field: "the
   promo code you pick" (no other property, since it carries no personal
   data any more than the existing four already don't).
2. **`order_placed.props`, §4.** Needs one new key:
   `promo_code: enum [dont_drop_this10, still_holding_it, butterfingers,
   caught_ya]`. Every other event's props (`landing_viewed`,
   `restaurants_viewed`, `restaurant_opened`, `cart_viewed`,
   `checkout_viewed`, `tracker_viewed`, `order_abandoned`) are unaffected —
   none of them ever carried a checkout-field value.
3. **`event_is_valid(event_name, props)`, ADR 0005 §2.** Its `order_placed`
   branch must accept the new `promo_code` key against the four-value enum
   above, the same way it already validates `rider_instructions`; without
   this, #67 would ship an `order_placed` event the store's own check
   refuses silently, which is exactly the failure the driver flagged on #63.
4. **Nothing else.** §1 (not logged), §2 (IDs), §3 (no experiment), §5
   (metrics), §6 (readability), and §7 (failure cases) are all about
   mechanics this document doesn't touch — checked against each section
   directly, none of them cites a Phantom-Fork string or a checkout field
   count.

## The mock

`docs/design/72-dontdropthatpromo-checkout.html` and
`docs/design/72-dontdropthatpromo-tracker.html`, built from #65's own mock
files with the tokens and layout untouched — every edit is the wordmark, the
mark glyph, the Instructions group, the new Promo code group, and the
tracker flavor text/7d screen from the table above. Same convention 65 used:
self-contained, dark theme only, hardcoded rather than relying on
`prefers-color-scheme`. Rendered at both widths with `scripts/design-render`,
committed alongside as four PNGs.

## Critique, after opening the four rendered pictures

(Filled in after rendering — see below.)

## No ADR

Nothing here changes a schema, a dependency, or a service. The one schema
line this identity touches (`order_placed.props` gaining `promo_code`) is
named above for the analyst's contract to carry, not made here — this
document is copy and a mark, same category as 65's own "No ADR" entry.
