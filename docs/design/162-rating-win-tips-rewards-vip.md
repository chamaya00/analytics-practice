# #162: after delivery, the rating sheet, the win, a celebratory Delivered, history rate/tip/Order again, the thanks voucher and VIP levels

Parent: #135. This is the designer child. The engineer children build to it:
#163 (rating sheet, win, Delivered), #164 (`wallet_tip`), #165 (history Rate,
Tip, Order again, and the wallet-paid flag), and #166 (thanks voucher, VIP
levels, checkout perks).

This is a specification and a set of drawings. Nothing here is product code.
The mocks under `docs/design/162-*.html` are self-contained, nothing imports
them, and they never ship.

**File names.** #162's criteria name `docs/design/135-*`. The driver's brief
for this run said `162-*`, which is also the role's own convention
(`<issue-number>-<slug>`), so every file is `162-*`. Read `135-*` in the
criteria as `162-*`. Each check below is restated against the real names.

Contents: fixed vs guessed · today · references · direction · composition ·
named things · the rating sheet and the win · Delivered · history rows ·
tips · Order again · the thanks voucher · VIP levels · checkout · states ·
contrast · events · precedents superseded · critique · criteria map · the one
question.

## What is fixed, what is guessed

**The outcome (fixed).** The end of an order feels like a win and leads into
the next one. The visitor rates the driver, then the restaurant; something
visibly good happens; they can tip, reorder, and see progress toward a perk.

**The constraints (checked in code or decided by the owner):**

- **O2 (owner):** Gold after **3 delivered orders**, free delivery on every
  order. Platinum after spending **$60 or 1.500.000 ₫**, an extra **10% off**.
  Thresholds are per currency and never summed.
- **O1 (owner):** a small confetti library is pre-approved; the engineer adds
  its ADR. A `prefers-reduced-motion` still is required.
- **D1:** whenever the wallet gate is off, tip UI is **absent**, not disabled.
- **D14:** `wallet_tip` refuses any order with no wallet debit row for the
  caller.
- **No tracking change.** `rating_submitted` keeps its exact shape and fires at
  most once per `order_id`. `order_placed.applied_voucher_ids` accepts only the
  ten catalogue ids (`tracking.ts:88`, and the migration at
  `20260926000000_two_city_event_contract.sql:161-174`).
- **ADR 0009:** history holds 20 orders. `capOrders` (`order-store.ts:343`)
  drops the oldest order that is delivered *and* has fired `order_delivered`.
- **`wallet_debit`'s floor** is 399¢ / 20.000 ₫
  (`20260927000000_wallet.sql:91-92`).
- **The rating tags** are exactly `fast`, `great_packaging`,
  `order_was_correct` (`tracking.ts:47`).
- **`vouchers.ts` already uses `Tier`** for the spend ladder
  (`Tier = 1 | 2 | 3 | 'entry' | 'flash'`).

**The guesses (mine, open to disagreement), each marked "Guess" where it is
specified:** the thanks voucher's amounts, minimums and 7-day expiry; the tip
presets; the 24-hour auto-open window; Platinum's rounding; "Platinum requires
Gold"; the Delivered layout; the "stamp" motif and every copy line.

**Where I disagree with the issue text, and why:**

1. **Platinum spend is not "what the wallet actually paid".** Taken literally,
   nobody can reach Platinum while the wallet is dark, and after it is on, a
   visitor's level would depend on whether the network was up at Place order
   (D1's fallback places the order without a debit). See "VIP levels → Spend".
2. **The VIP concept is not called a tier.** It is a **VIP level**. `Tier`
   stays the voucher ladder's word.

## What is there today

`./scripts/app-render /tracker/` with three HCMC orders seeded (one delivered
6 minutes ago and unrated, two older). Committed as
`162-today-app-tracker-narrow.png` / `-wide.png`. Workarounds, as #147 found:
Chromium linked from `/opt/pw-browsers` onto `PATH`, and the build run from a
copy of the tree outside `.claude/worktrees/` (`astro build` there cannot find
`astro/tsconfigs/strict`).

Honestly: the moment the food arrives is the flattest state the tracker has.
"Delivered 6 min ago" is set big, but the five-step stepper still takes 400px
of the phone to say what that line already said, and the fifth dot differs
from the fourth only in being orange. Below it the driver card reads "Delivered
by", the demo disclosure, then "How was your order?" with five pale stars and
three chips. At 375 the Submit button is below the fold. The rating asks about
the order as a whole, so the driver, whose face is right there, is never
rated. Past orders are a quiet read-only list. Nothing says the visitor has
done anything, and nothing points at the next order.

## Looked at outside this repository

- **DoorDash's post-delivery rating** (DoorDash Help Center, "Dasher Ratings
  Explained"; "How we're collecting data on ratings"). Rating the Dasher is a
  separate prompt with stars and category feedback, and tips can be added after
  delivery. **Taking:** the driver as a separate, first question, and tipping
  from the finished order. **Refusing:** thumbs-up/thumbs-down category grids
  after the stars. The contract allows three tags, and a second grid on the
  driver step would ask for data nothing records.
- **Duolingo's lesson-complete screen** (60fps.design shots; Supademo's
  micro-interaction round-up). A short, loud burst, then stat cards sliding in
  one after another, then a single button. **Taking:** the order of events:
  the burst first, the reward card second, the one next action last, all under
  two seconds. **Refusing:** the mascot and the full-screen takeover. This
  page has other live orders on it, and the win must not hide them.
- **GrabRewards retiring its Member/Silver/Gold/Platinum tiers** (Grab, 19 Feb
  2026, replaced by GrabCoins; RinggitPlus coverage). A point-based ladder with
  earn multipliers was dropped for being hard to read. **Taking the lesson:**
  no points and no multipliers. Two levels, each named for exactly one perk
  you can see in a checkout line. **Refusing:** any currency of its own
  ("coins"). Progress is shown in orders and in money, the two things the
  visitor already understands.
- **canvas-confetti** (github.com/catdad/canvas-confetti, v1.9.4, ISC). Canvas
  bursts with `particleCount`, `spread`, `ticks`, `gravity`, `colors`,
  `disableForReducedMotion`, and `confetti.create(canvas)` for a canvas the
  page owns.

## Direction

**Warm, earned, brief.** The win is a stamp on something you did, not a
jackpot. It must **not** look like a casino or a slot machine (no flashing,
no coins, no counting-up numbers), and **not** like a loyalty card with points
and small print.

### Two directions, compared (`162-directions.html`)

- **A: stamp and sheet (recommended).** Delivered becomes a large stamped
  mark inside the order card. The rating is a bottom sheet over the tracker,
  driver then restaurant, and the win happens inside the sheet.
- **B: full-screen takeover.** Delivered floods the screen in violet with
  confetti, and both ratings sit on that screen with one "Submit both".

B is louder and one tap shorter. It is wrong here for three reasons, all
visible in its picture. It hides every other live order and the tab bar at
the moment #134 made several orders normal. Rating becomes a page mode, so
"at most one modal" becomes "at most one screen", which is harder to leave.
And one "Submit both" cannot keep the two steps separately skippable, which
the objective requires. **I recommend A.** Everything below describes A.

### The deliberate oddity: the stamp

A 28-point rubber-stamp edge, rotated −8°, with a dashed inner ring. The same
shape marks three moments: **Delivered** (a check), **the win** (a star), and
the **VIP level** badge (a star on gold or platinum). Every other shape on the
page is a rounded rectangle or a circle. Defence: the three moments are the
three things the visitor *earned*, and one mark for all three is what makes
them read as one idea. The tilt is the "by hand" part: a perfectly level seal
reads as a certificate, and a tilted one reads as someone pressing it for you.

## Composition

- **The eye lands first on** the word **Delivered** at 2.25rem/800
  (`letter-spacing: -0.035em`) beside a 76px stamp. In the sheet it lands on
  the question, "How was Minh T.?", at 1.625rem/800, under a 112px avatar that
  breaks the top of the sheet. In the win it lands on the 104px stamp, then
  "Thank you!" at 2rem/800.
- **Space.** The Delivered card gives its upper half to the stamp and the
  headline. The five-step stepper collapses to one thin completed rail (five
  12px dots, the last orange) with "Placed … Delivered" under it. That frees
  about 200px at 375, and the actions move up into it. The sheet is
  bottom-anchored on the phone and leaves the order card visible, dimmed,
  behind it. At the wide width it is a centred 26rem dialog.
- **What survives at 375:** every sheet step, including Skip, the primary
  button and ×, fits one 812px viewport with the tab bar hidden behind the
  scrim. The Delivered card, its actions and the disclosure fit above the tab
  bar.
- **Depth.** Fills, as in #147. The sheet is the one surface with a shadow,
  because it is the one thing that floats.
- **Accent, counted.** On the Delivered card: the stamp, the rail and the one
  primary button. In the sheet: the selected stars, the selected chips' border
  and the primary button. The gold and platinum fills appear only on VIP
  badges and pills, never as text colour.

## Named things (use these nouns in code)

| Noun | What it is | Suggested code name |
|---|---|---|
| **rating sheet** | The two-step modal: **driver step**, then **restaurant step** | `rating-sheet-dom.ts` |
| **win** | The sheet's last screen: stamp, "Thank you!", the thanks voucher, the VIP nudge | `renderWin` |
| **mini win** | The small star pop after the driver step's Next | - |
| **stamp** | The rubber-stamp mark (Delivered, win, VIP badge) | `stamp.ts` |
| **Delivered hero** | The stamp and headline block of a delivered open card | - |
| **done rail** | The collapsed five-dot stepper on a delivered card | - |
| **prompted** | An order the sheet has auto-opened for, or deliberately not opened for | `order.ratingPromptedAt` |
| **tip panel** | The inline preset picker under a history row | - |
| **tip presets** | The three fixed amounts per currency | `TIP_PRESETS_MINOR` |
| **thanks voucher** | The reward a rating unlocks | `ThanksVoucher`, `thanks-voucher.ts` |
| **VIP level** | `'none' \| 'gold' \| 'platinum'`. **Never "tier".** | `VipLevel`, `vip-level.ts` |
| **VIP card** | The progress card at the top of Past orders | - |
| **VIP ledger** | The persisted counters behind the level | `parody.vip` |
| **Order again** | Refills this order's items into that restaurant's cart | - |

The copy never says "tier", and new code never names anything `Tier`, so
`vouchers.ts`'s `Tier` keeps one meaning.

## The rating sheet and the win

Mocks: `162-rate-driver-*`, `162-rate-restaurant-*`, `162-win-*`,
`162-win-still-*`, each `{sf,hcmc}-{light,dark}`.

### Anatomy

- **Container.** It reuses `flash-sheet-dom.ts`'s pattern: scrim, bottom sheet,
  swipe-down to dismiss, × button (44px), Escape, focus trapped, focus
  returned to the control that opened it. `role="dialog"`, `aria-modal`,
  labelled by the step's heading. At ≥481px it is a centred 26rem dialog.
- **Driver step.** The vendored avatar (`/avatars/drivers/<id>.svg`, an
  `<img>`, `alt=""`) at 112px, pulled 84px above the sheet's top edge: the
  driver leans into the sheet (#147's head-out-of-frame idea, carried over).
  Then "1 of 2 · Driver" with two pips, **"How was Minh T.?"**, and "Delivered
  by Minh T. · ★ 4.9". Five stars, each a 44px radio target. Under them, a
  word for the choice: 1 Bad, 2 Not great, 3 OK, 4 Good, 5 Great, so meaning
  is not carried by fill alone. **No chips on this step.** Then **Skip** (text
  button) and **Next** (primary, `aria-disabled` until a star is picked).
- **Restaurant step.** The restaurant's photo at 72px (16px radius), "2 of 2 ·
  Restaurant", **"How was Bến Thành Bánh Mì?"**, "8 items · 160.000 ₫", five
  stars and the word, then exactly three optional chips: **Fast**, **Great
  packaging**, **Order was correct** (`RATING_TAGS`). Then **Skip** and
  **Submit**.
- **Win.** The 104px star stamp, **"Thank you!"**, a line with what was rated
  (each name with small stars; a skipped step is left out), then the **thanks
  voucher ticket** ("Unlocked · 30.000 ₫ off · Thanks voucher · For your next
  Ho Chi Minh City order over 150.000 ₫. Applies by itself at checkout. ·
  Expires 4 Oct · one per city"), then the **VIP nudge** (the three-segment
  meter and "1 more delivered order to Gold", or "$7.70 to Platinum", or
  nothing once Platinum), then **Order again** (secondary) and **Done**
  (primary). The ticket is `role="status"`, so a screen reader hears the
  unlock.

### Step flow

1. Driver step. **Next** stores the driver rating and plays the **mini win**,
   then the restaurant step slides in. **Skip** goes straight to the
   restaurant step and stores nothing.
2. Restaurant step. **Submit** stores the restaurant rating, fires
   `rating_submitted` (see "Events"), and shows the win. **Skip** shows the
   win if the driver step was submitted in this sheet, and otherwise closes
   the sheet.
3. Win. **Done**, ×, scrim, swipe or Escape closes. **Order again** closes and
   runs Order again (see below).
- **Dismissing mid-flow** keeps whatever step was already submitted and
  nothing else. It never shows the win.
- **Opening for a part-rated order** (from Rate) starts at the first unrated
  step and shows "1 of 1".

### The animation: form, duration, library

- **Mini win (driver Next).** The selected stars pop in sequence (scale 1 →
  1.25 → 1, 240ms each, 40ms stagger, `cubic-bezier(.2,1.4,.4,1)`), and one
  small canvas burst leaves the star row (18 particles, `spread: 60`,
  `ticks: 90`, about 0.6s). Then the restaurant step slides in from the right
  over 220ms `ease-out`. Total about 0.8s.
- **Win (the sheet's last screen).** Duration **1.6s**, then still:
  - 0ms: the stamp lands. Scale 1.6 → 1 and rotate −20° → −8° over 320ms
    `cubic-bezier(.2,1.4,.4,1)`.
  - 0ms and 150ms: two canvas bursts from the stamp's centre
    (`particleCount: 70`, `spread: 70`, `startVelocity: 38`, `ticks: 160`,
    `gravity: 1.1`, `colors`: the theme's accent, accent-b, gold and platinum
    fills).
  - 450ms: the ticket rises 12px and fades in over 240ms `ease-out`, and the
    VIP nudge follows 80ms later.
  - About 1.6s: the last particles fall out of the sheet. **The end frame** is
    `162-win-*`: everything in place, a few pieces still falling low in the
    sheet.
- **Where the confetti draws.** On a `<canvas>` the sheet owns, positioned
  behind the sheet's content (`confetti.create(canvas, { resize: true })`),
  never the library's default full-page canvas. The first render drew it
  over the ticket and the nudge text (see "Critique").
- **Library: canvas-confetti** (npm `canvas-confetti`, **ISC licence**, 1.9.4
  at the time of writing; github.com/catdad/canvas-confetti). It is loaded by
  dynamic `import()` the first time a win plays, and only when motion is
  allowed. The engineer's ADR records the licence, the pinned version and the
  measured gzipped size (I could not measure it here). Nothing is fetched from
  a CDN; it is bundled.
- **Reduced motion (`prefers-reduced-motion: reduce`).** The library is not
  imported and no canvas is created. `disableForReducedMotion: true` is set
  anyway as a second guard. The stamp, ticket and nudge appear in their final
  positions at once. The mini win becomes an instant fill change. The step
  change is instant. **The still is `162-win-still-*`:** the same frame with no
  particles. Nothing else is taken away, so a visitor who asked for less
  motion still gets the stamp and the reward.

### The multi-order rule: at most one sheet, and when it opens by itself

**Keyed on a new persisted field, `ratingPromptedAt: string | null`,** on
`PlacedOrder`. It is set the moment the sheet auto-opens for an order, *and*
the moment an order is deliberately passed over by the rules below. It is
never cleared. That is what "once per order, never nags" is keyed on: not on
whether a rating exists, and not on page state.

The sheet **auto-opens only on `/tracker/`**, at most **once per page load**,
for at most **one** order, and only when no sheet is already open. An order
qualifies when it is delivered, `ratingPromptedAt` is null, it is not fully
rated (both steps stored), and it was delivered **within the last 24 hours**
(Guess).

Which order, when several qualify:

1. The order in the open card, if it qualifies.
2. Otherwise, the most recently delivered qualifying order.

Every other qualifying order is marked prompted at the same moment. It waits
with **Rate** on its Delivered card and history row, and nothing opens for it
by itself, ever.

- **Two orders landing together** while the tracker is open: the first
  checked on that render tick gets the sheet. The tie goes to the open card.
  The other is marked prompted and shows Rate. If the second lands while the
  sheet is open for the first, it is marked prompted and nothing queues:
  **the sheet never chains into another order's sheet.**
- **Returning to three delivered, unrated orders:** the sheet opens once, for
  the open card's order if it qualifies, else the newest. The other two are
  marked prompted and wait in history with Rate. The next page load opens
  nothing.
- **Delivered more than 24 hours ago:** marked prompted on sight and never
  auto-opens (a sheet for yesterday's lunch is a nag).
- **Timing.** When the visitor watched the order land, the sheet rises 1.4s
  after Delivered first renders, so the stamp is seen first. On a return
  visit it rises 600ms after the first render.
- **Manual opening** (the Rate buttons) is not limited by any of this and
  does not touch `ratingPromptedAt`.
- **Injectable time.** Every rule above reads `now` from a parameter, the way
  `order-store.ts` already takes `random` and `now`, so the once-only and
  24-hour tests are deterministic.

### The driver's displayed average: not updated, locally or anywhere

The driver card keeps showing the stored `rating`/`ratingCount` from
`drivers.ts`. One rating moves "★ 4.9 (3k+)" by about 0.0003, which rounds
away. A local update would be a visible lie in the other direction: a single
1-star rating that "drops" a driver on this device only. The objective allows
either; none is honest and simpler.

### Storage

- `PlacedOrder.rating` (today's field) becomes the **restaurant** rating. Its
  shape is unchanged, so every existing rated order reads as "restaurant
  rated", which is what its old whole-order meaning was closest to.
- New `PlacedOrder.driverRating: { stars: number } | null`.
- New `PlacedOrder.ratingPromptedAt: string | null`. Legacy orders without it
  count as null. The 24-hour rule then marks old ones prompted on first sight,
  so shipping this does not open a sheet for last week's order.
- `submitRating` keeps its "null if already rated" guard for the restaurant
  step, and a sibling `submitDriverRating` gets the same guard.

## Delivered

Mocks: `162-delivered-live-*` (as it lands while watched) and
`162-delivered-later-*` (opened afterwards), each `{sf,hcmc}-{light,dark}`.

It replaces #147's delivered card content (the "Delivered N min ago" line,
full stepper and inline rating prompt), in this order:

1. The head row, unchanged (photo, name, "8 items · 160.000 ₫").
2. **Delivered hero:** the 76px check stamp; **Delivered** (2.25rem/800);
   **"Arrived 7 min early"** (15px/700); and the time line (12px muted).
   - *Early* is `etaMinutes − deliveryMs / 60 000`, floored. At 0 it reads
     "Arrived on time". It never says late, because #121 always delivers early.
   - *Time line:* "Just now · 12:41" in the first minute, "Delivered 12 min
     ago" under an hour, then #147's history date format ("Delivered today,
     10:12 AM" / "Delivered today, 10:12").
3. **Done rail:** five 12px dots joined by a 2px accent line, the last orange
   and 14px, with "Placed" and "Delivered" under the ends.
   `aria-label="All five steps done"`. The stepper's per-step labels are gone
   from this state only; every live state keeps #147's stepper.
4. The driver card, "Delivered by", unchanged.
5. **Actions:** **Rate this order** (primary) while either step is unrated,
   else the rated summary ("Minh T. ★★★★★ · Food ★★★★☆"); and **Order again**
   (secondary). Order again is absent when the restaurant slug no longer
   resolves.
6. The demo disclosure, unchanged.

**As it lands while watched:** on the tick that first renders Delivered for
the open order, the stamp lands (scale 1.4 → 1, rotate −20° → −8°, 360ms
`cubic-bezier(.2,1.4,.4,1)`), a ring expands behind it (scale 1 → 1.6,
opacity 0.35 → 0, 500ms `ease-out`), and one small burst of 26 particles
(`ticks: 80`) leaves the stamp. The sheet follows at 1.4s under the rules
above. **Reduced motion:** the stamp is simply there, with no ring and no
burst.

**Opened afterwards:** the same layout, static, with no ring or burst. If the
sheet already opened for this order, nothing opens.

**Where it applies.** The open card of a delivered order, which per #147 is
the order that landed while watched, or the most recent order when nothing is
live. History rows do not use the hero.

## History rows

Mocks: `162-history-a-*` (unrated, rated, tipped), `162-history-b-*` (tip
available with the panel open, short balance), `162-history-c-*` (signed out,
wallet dark, wallet on but not paid from it, and the Order again toast). Each
is `{sf,hcmc}-{light,dark}`. The dashed state tags in the mocks are
scaffolding.

Each delivered history row keeps #147's content (photo, name, date · items,
driver, total, "✓ Delivered") and gains one **action strip** under it,
indented to the text column:

- **Rate** (primary, small) while either step is unrated. It opens the rating
  sheet at the first unrated step. When both are rated, the **rated summary**
  shows instead: "Minh T. ★★★★★ · Food ★★★★☆", with small stars and the words
  in text. A skipped step never shows as rated.
- **The tip slot**, exactly one of:
  - **Tip** (secondary): tippable (see "Tips"), not yet tipped, signed in.
    Tapping opens the **tip panel** inline under the row. There is no modal,
    because the rating sheet is the one modal.
  - **Tipped $2.00** with a check, once `tipMinor` is stored.
  - **Sign in to tip**: tippable, but signed out while the wallet is on. It
    opens the existing sign-in sheet, titled "Sign in to tip". Returning from
    OAuth lands on `/tracker/` with that row's tip panel open.
  - **Nothing at all:** wallet gate off (D1). No button, no note, no
    disabled control.
  - **The note "Placed without the wallet, so it can't take a tip."** (12px
    muted, under the strip): the wallet is on but this order has no wallet
    payment (D14). It is shown once per row, so a visitor who sees Tip on one
    row and not another knows why.
- **Order again** (secondary), right-aligned, on every row whose restaurant
  still resolves.

Row controls are 36px drawn with a 44px hit area (the #143 pattern), and they
get a 2px accent focus ring with a 2px offset.

## Tips

**Presets, fixed, as integer minor units. `wallet_tip` accepts exactly these
values and nothing else** (Guess on the amounts):

| Currency | Presets (minor units) | Shown as |
|---|---|---|
| USD | `100`, `200`, `300` | $1, $2, $3 |
| VND | `10000`, `20000`, `30000` | 10.000 ₫, 20.000 ₫, 30.000 ₫ |

The currency is the **order's** (`order.currency`), never the city picker's.
The presets sit well under `wallet_debit`'s floor, which is why #164 is its
own function.

**Which orders can be tipped:** all of these must hold.

1. The wallet gate is on (`probeWalletGate` ready).
2. The order was paid from the wallet. #165 stores `walletPaid: true` on the
   order when `wallet_debit` answered `debited` or `already_debited`.
   Everything else is false, including legacy orders, dark-path orders and D1
   fallback orders. That matches D14: the server would refuse them anyway.
3. It is delivered and has no stored tip.
4. The visitor is signed in, or sees "Sign in to tip".

**The tip panel.** "Tip Minh T." and "From your wallet · 310.000 ₫" (that
currency's balance), three equal preset buttons (44px, tabular figures,
`role="radiogroup"`), then **Cancel** and **Send 20.000 ₫ tip**. The middle
preset is pre-selected, or the largest affordable one if the middle is over
the balance.

- **Send:** the button reads "Sending…" and is disabled while the call is in
  flight. `wallet_tip` is idempotent per `order_id`.
  - `tipped` or `already_tipped`: store `tipMinor` on the order, collapse to
    "Tipped 20.000 ₫", and update the header balance.
  - `insufficient`: show the short-balance block.
  - Unreachable (network, timeout, 5xx after one retry): "Couldn't send the
    tip. Nothing was taken. Try again." as `role="status"`, and the panel
    stays open.
  - Refused (no debit row for this account, for example a different account
    is signed in): collapse to the D14 note.
- **Short balance** (`162-history-b-*`, second row). Presets above the
  balance are drawn dashed and muted with `aria-disabled="true"`, so they
  differ by more than colour. Selecting one shows #143's block: the shortfall
  as the lead ("16.000 ₫ short"), then the drip sentence ("Next drip at 15:00
  adds 100.000 ₫." or, with a drip ready, the Collect button), then "Or pick a
  smaller tip." Send is `aria-disabled`.
- **A tip is not spend.** It never counts toward Platinum (see "VIP levels").

## Order again

- **What it does:** refills this order's items (same `itemId`s and quantities)
  into **that restaurant's cart** at **today's menu prices**. The stored
  `amountMinor` is a record of what was paid, not a price to reuse.
  - An item no longer on the menu is skipped. The toast then says "2 of 3
    items are still on the menu".
  - If none is left, it opens the restaurant page instead.
- **Another restaurant's items already in the cart:** untouched. Carts are
  already per restaurant (`cartsByRestaurant`, `order-store.ts`), so this is
  not a conflict and needs no question.
- **The same restaurant's items already in the cart:** the existing confirm
  dialog (`confirm-dialog-dom.ts`): "Replace your Bến Thành Bánh Mì cart? It
  has 2 items. Order again puts in the 8 from this order instead." **Replace**
  (primary) or **Keep my cart**. Keep goes to that cart unchanged.
- **Where it goes:**
  - From the Delivered card or the win: straight to
    `/cart/?restaurant=<slug>`.
  - From a history row: it stays on the tracker and shows a toast above the
    tab bar, "Order again: 2 items from Sài Gòn Phở Quán are in your cart.
    View cart". A visitor working through history may reorder more than one.
  - The toast is `role="status"`, lasts 6s, and pauses while focused or
    hovered.
- Vouchers and VIP perks are recomputed by checkout as usual. Nothing is
  carried over from the old order.

## The thanks voucher

Mock: the unlock is in `162-win-*`. Applied at checkout: `162-checkout-*`.

| | San Francisco | Ho Chi Minh City |
|---|---|---|
| Amount | **$3 off** (`300`) | **30.000 ₫ off** (`30000`) |
| Minimum subtotal | $15 (`1500`) | 150.000 ₫ (`150000`) |
| City | The rated order's restaurant's city, never the picker | same |
| Expiry | **7 days** after unlock (device clock), shown as a date | same |

All four figures are Guesses. They are sized at about half a `t1`/`t2`
catalogue voucher, so a rating is worth doing and never beats spending.

- **Unlock:** the first step submitted for an order unlocks one. That is once
  per order, and a second step or a later history rating unlocks nothing
  more.
- **Holding:** at most **one per city**. Unlocking while one is already held
  in that city refreshes its expiry to 7 days from now, and the ticket then
  reads "Topped up · Expires …". Stored under `parody.thanksVoucher`, keyed by
  city: `{ amountMinor, minimumSpendMinor, expiresAt, sourceOrderId }`.
- **Stack group: its own, outside the catalogue.** It is **not** a `VoucherId`
  and not in `CatalogueEntry[]`. It never enters `syncOffersState`,
  `pickLargest`, `manualSelect` or `OffersState`, so the catalogue's
  auto-select on unlock, its tie-break and every existing voucher test are
  untouched. It stacks with one `discount` voucher and one `delivery` voucher.
  This is a third stack layer, which #87 refused for *general-purpose*
  stacking. This one is a single account-level item with its own line, and
  the refusal is superseded for it (see "Precedents").
- **Applying:** it applies **by itself** at checkout when the city matches,
  the subtotal is at or above the minimum and it has not expired. There is no
  checkbox. The Offers screen lists it under a "Rewards" heading as a
  read-only row ("Applies by itself at checkout"). It has its own breakdown
  line, "Thanks voucher · for rating −$3.00".
- **Consumed** when the order is written, recorded on the order as
  `thanksVoucherMinor`. If placing fails or the debit is refused, it is not
  consumed.
- **Expired:** removed silently on the next read. It is never shown greyed.

## VIP levels

Mocks: `162-vip-sf-light` and `162-vip-hcmc-dark` show all five states of the
**VIP card**, stacked and numbered. Checkout lines: `162-checkout-*`.

### The rule (O2, with two named refinements)

- **Gold:** **3 delivered orders**, counted across both cities (a count has no
  currency). Perk: **free delivery on every order**.
- **Platinum:** Gold, **and** spend of at least **$60.00 (`6000`) in USD or
  1.500.000 ₫ (`1500000`) in VND**. Each currency is checked on its own and
  never added or converted. Perk: Gold's free delivery **plus 10% off**.
- **Refinement 1: Platinum requires Gold.** O2 says Platinum *adds* 10% off,
  which reads as a ladder. A visitor who spends $70 in two orders sees "1 order
  to Gold", and the third delivery makes them Gold and Platinum at once.
- **Refinement 2: a level, once reached, is kept.** There is no expiry and no
  decay. The ledger only ever increases.
- **Both cities.** The level belongs to the visitor, not the city. Platinum
  earned on USD spend gives 10% off in HCMC too.

### Spend: the definition, and why

**Spend is the stored checkout total of each delivered order**
(`totalMinor`, or `amountMinor` for a legacy order whose total is null), in
that order's currency, **whether or not the wallet paid for it. Tips are not
spend.**

Why this and not "what the wallet actually paid":

- **Taken literally, Platinum cannot be reached today.** The wallet is dark
  until the owner finishes #136's setup (D1), and until #165 no stored order
  even records whether the wallet paid. A level nobody can reach is a mock of
  a feature, not a feature.
- **Even with the wallet on, "wallet paid" is luck, not behaviour.** D1's
  fallback places an order without a debit whenever the store is unreachable.
  Counting only debits would make the level depend on the network at the
  moment of Place order.
- **The level is device-local anyway** (ADR 0009, below). Its count comes
  from local history, and its spend should come from the same place, so the
  two halves of one rule never disagree.
- **Nothing is at stake that the wallet protects.** It is play money, and the
  totals are browser-computed already (D8). Counting the wallet would not make
  the number more true, only rarer.
- **Tips excluded:** a tip is money to the driver, not an order, and tips only
  exist with the wallet on, so counting them would bring back the dependency
  this definition removes.

**What the tracker shows before the wallet is on:** exactly the same thing.
The VIP card counts every delivered order and its total from day one. Nothing
on it mentions the wallet.

**If the owner prefers the literal reading**, the change is one predicate in
the ledger (`order.walletPaid === true`), and the card needs one extra line
while the wallet is dark: "Platinum counts wallet spend. The wallet isn't on
yet." That is this document's one question (end).

### The ledger: progress never goes backwards

Re-summing the 20 stored orders would lower progress whenever `capOrders`
drops an old one. So progress is **counted once per order into a persisted
ledger**, and history is never re-summed:

- `parody.vip` (localStorage):
  `{ v: 1, deliveredCount: number, spendMinor: { USD: number, VND: number }, level: 'none' | 'gold' | 'platinum' }`.
- New `PlacedOrder.vipCounted: boolean`.
- **`sweepVipLedger(storage, now)`**: for every stored order that is delivered
  (`isDelivered`) and not `vipCounted`, add 1 to `deliveredCount`, add its
  spend to its currency, set `vipCounted: true`, then set `level` to the
  higher of the stored level and the computed one. It fires nothing. It runs
  on the tracker's render, on checkout mount, and inside `placeOrder` before
  `capOrders`.
- **`capOrders` must never drop an order with `vipCounted` false.** Add it to
  the `droppable` predicate, beside `deliveredEventFired`. That is the line
  that makes eviction unable to lose progress.
- **Backfill:** the first sweep after this ships counts every delivered order
  already stored, once, because none has `vipCounted` yet.
- **The level is a high-water mark:** it never goes down, even if storage
  were edited by hand.

### The VIP card: where and what

The VIP card sits at the **top of Past orders** on `/tracker/`, above the
history list. It is hidden when there are no orders at all (the empty state is
unchanged). The five states, numbered as in the mock:

1. **No level.** An empty dashed stamp, "Not VIP yet", "3 delivered orders make
   you Gold: free delivery on every order.", and a three-segment meter at 0.
2. **Progress to Gold.** "1 order to Gold", the meter at 2 of 3, and "2 of 3
   delivered orders".
3. **Gold.** A gold stamp, "Gold" with a "Free delivery" pill, and a spend bar
   in **the current city's currency**: "$18.40 of $60.00 · $41.60 to
   Platinum".
4. **Progress to Platinum.** The same, near the line: "$52.30 of $60.00 ·
   $7.70 to go". When the *other* currency has spend, one muted line follows:
   "Plus 420.000 ₫ of 1.500.000 ₫ in HCMC, counted apart."
5. **Platinum.** A platinum stamp, "Platinum", "Free delivery and 10% off
   every order, both cities." No bar.

Under the card, always: "Counted from orders on this device. A level, once
reached, is kept."

- **Crossing a level** plays nothing new. The next win's nudge and the card
  simply read the new level. (This is Guess: a level-up ceremony was
  considered, and cut as a second celebration competing with the rating win.)
- **The win's VIP nudge** shows the next step in one line: the Gold meter,
  or "$7.70 to Platinum", or nothing at Platinum.

### A second device

**It starts at "Not VIP yet".** Order history, the ledger and the thanks
voucher are all in this browser's storage. Signing in with the same account
does not carry them over; the wallet balance does, because it lives on the
server. The card's footer says this plainly on every device. Counting per
account would need a server-side ledger and a migration, which the owner's
default (ADR 0009, device-local) did not ask for. If that ever changes, the
ledger shape above maps one to one onto a table.

## Checkout: the perks and the voucher as lines

Mocks: `162-checkout-sf-light` (Platinum, a catalogue discount and the thanks
voucher) and `162-checkout-hcmc-dark` (Gold, a catalogue discount and the
thanks voucher). Everything above the breakdown is unchanged and elided.

- **The VIP line above the breakdown:** a small stamp and "**Platinum** · free
  delivery and 10% off are on this order." At Gold: "**Gold** · free delivery
  is on this order. 190.000 ₫ more spend to Platinum." It is absent at no
  level.
- **The breakdown order:**
  1. Subtotal
  2. **Delivery fee [Gold]/[Platinum] ~~$1.99~~ Free**
  3. Service fee
  4. Discount (catalogue)
  5. **Thanks voucher · for rating −$3.00**
  6. **Platinum 10% off · of $23.75 −$2.37**
  7. You saved
  8. Total
- **Worked SF (Platinum):** subtotal $23.75; delivery ~~$1.99~~ Free; service
  $1.50; Discount `sf-discount-t1` −$2.00; Thanks voucher −$3.00; Platinum 10%
  −$2.37. You saved $9.36. **Total $17.88.**
- **Worked HCMC (Gold):** subtotal 180.000 ₫; delivery ~~10.000 ₫~~ Free;
  service 20.000 ₫; Discount `hcmc-discount-t1` −10.000 ₫; Thanks voucher
  −30.000 ₫. You saved 50.000 ₫. **Total 160.000 ₫.**

**Gold's free delivery and the `delivery`-group vouchers.** At Gold or above,
the delivery fee is 0 before vouchers, whatever the flash fee. So the
`delivery` group is **suppressed**: `deliveryId` is forced to null, and the
Offers screen shows the delivery rows as "Covered by Gold" (read-only,
unchecked). Otherwise a catalogue delivery voucher would "apply" with a saving
of 0 and be sent in `applied_voucher_ids` beside `saved_amount_minor: 0`,
breaking the contract's "0 iff empty" invariant. The saving line uses
`otherwiseDeliveryFeeMinor` (the flash fee if live, else the normal fee), so
"You saved" counts what Gold actually saved.

**Platinum's 10%: base and rounding.**

- **Base:** the **subtotal**, before any voucher. It is predictable, and it is
  what the line says ("of $23.75").
- **USD:** floor to the whole cent. $23.75 gives 237.5¢, so **$2.37**.
- **VND:** floor to the whole **1.000 ₫**, matching how every menu price is
  written. 180.000 ₫ gives 18.000 ₫, and 95.000 ₫ gives 9.500 → **9.000 ₫**.
- Flooring means the perk never gives more than 10%.

**The debit floor, checked.** The lowest totals that the perks can produce
are still above `wallet_debit`'s floor:

- **SF, cheapest item** ($3.00) with Platinum: 3.00 + 0 + 1.50 − 0.30 =
  **$4.20** ≥ $3.99.
- **HCMC, cheapest item** (10.000 ₫) with Platinum: 10.000 + 0 + 20.000 − 1.000
  = **29.000 ₫** ≥ 20.000 ₫.
- **The thanks voucher's minimums** keep any order it applies to far above
  either floor ($15 − $3 − $1.50 + $1.50 = $12.00 in the worst SF case).
- **#166 must still test the floor**, because a future flash fee or catalogue
  change could move these.

**What never changes:** the stack groups' own rules, `pickLargest`, the
catalogue's auto-select on unlock, and flash-deal expiry.

## States

| State | What shows | Mock |
|---|---|---|
| **Empty** (no orders) | Unchanged: "Nothing to track yet." No VIP card, no sheet. | #147's `147-state-empty` |
| **Loading** | Nothing to design for local data. The tip panel's Send shows "Sending…". Checkout shows no VIP line until the ledger is read, which is synchronous. | - |
| **Sheet: driver step / restaurant step / win / still** | As specified. | `162-rate-*`, `162-win-*` |
| **Delivered: landing / later** | As specified. | `162-delivered-*` |
| **Partial: one step rated** | Rate stays. The sheet opens at the missing step, "1 of 1". The win's line lists only what is rated. | described |
| **Partial: restaurant gone** | The row keeps #147's placeholder square. Order again is absent. Rate and Tip still work. | described |
| **Error: tip unreachable / refused / insufficient** | See "Tips". | `162-history-b-*` (insufficient) |
| **Offline** | Rating, Delivered, VIP, the voucher and Order again all work: they are local. Tip is unreachable, with the message. | - |
| **Wallet dark** | No tip control anywhere. Everything else unchanged. | `162-history-c-*` |
| **After a destructive action** | Order again → Replace swaps a cart's lines. That is the only destructive action here, and it asks first. Old orders dropped by the history cap take nothing from the VIP ledger. | described |

## Contrast

Every text/background pair these mocks introduce or rely on, run through
`./scripts/contrast <fg> <bg>`. Outputs are quoted as printed. The bar is
4.5:1.

| Pair | Where | Light | Dark |
|---|---|---|---|
| text on bg | the sheet's heading and body (the sheet is `--color-bg`), step word, "Thank you!" | `#241b33` on `#fbf7ff` → **15.51** | `#f1e9ff` on `#16101f` → **15.82** |
| muted on bg | "1 of 2 · Driver", "Delivered by … · ★ 4.9", the rated line | `#6b5d85` on `#fbf7ff` → **5.62** | `#b7a6d9` on `#16101f` → **8.40** |
| on-accent on accent | Next, Submit, Done, Rate, Send, Place order | `#fbf7ff` on `#6c3ce0` → **5.91** | `#16101f` on `#b79cff` → **8.17** |
| text on surface | Delivered, "Arrived 7 min early", row names, breakdown, VIP card | `#241b33` on `#f7f1ff` → **14.83** | `#f1e9ff` on `#1e1730` → **14.62** |
| muted on surface | time line, done-rail labels, rated summary, D14 note, VIP rows, "for rating" | `#6b5d85` on `#f7f1ff` → **5.38** | `#b7a6d9` on `#1e1730` → **7.76** |
| text on tint | ticket body, secondary buttons (Order again, Tip) | `#241b33` on `#ede1ff` → **13.14** | `#f1e9ff` on `#2e2444` → **12.29** |
| muted on tint | ticket "Unlocked", "Expires 4 Oct · one per city" | `#6b5d85` on `#ede1ff` → **4.76** | `#b7a6d9` on `#2e2444` → **6.52** |
| accent on surface | "You saved" | `#6c3ce0` on `#f7f1ff` → **5.65** | `#b79cff` on `#1e1730` → **7.55** |
| gold ink on gold | "Free delivery" / "Gold" pills | `#241b33` on `#f3d27a` → **11.18** | `#16101f` on `#e0b95a` → **9.98** |
| platinum ink on platinum | "Platinum" pill | `#241b33` on `#d9d3ea` → **11.30** | `#16101f` on `#cbc3e3` → **11.04** |
| bg on text | the Order again toast | `#fbf7ff` on `#241b33` → **15.51** | `#16101f` on `#f1e9ff` → **15.82** |

**One failure, designed out:** muted text on the gold fill is
`#6b5d85` on `#f3d27a` → **4.05**. So the gold and platinum fills carry only
full ink, in pills and stamps, and never muted text.

**Non-text:**

- Filled stars are `--color-accent-a` on `--color-bg`: `#6c3ce0` on `#fbf7ff`
  → **5.91**, and `#b79cff` on `#16101f` → **8.17**.
- Unfilled stars are a muted outline: `#6b5d85` on `#fbf7ff` → **5.62**.
- The star count is also given in words (the step word), and on rows by an
  `aria-label` ("4 of 5 stars").

New tokens for #163/#166 to add to `global.css`, with both themes (dark
values in brackets): `--color-vip-gold` `#f3d27a` [`#e0b95a`],
`--color-vip-gold-ink` `#241b33` [`#16101f`], `--color-vip-platinum` `#d9d3ea`
[`#cbc3e3`], `--color-vip-platinum-ink` `#241b33` [`#16101f`]. Add the four
pairs to `contrast.test.ts`.

## Events

No event, prop or contract is added (CLAUDE.md, "Event tracking comes last";
#135's "For the orchestrator").

- **`rating_submitted` now represents the restaurant step.** It fires once,
  on the restaurant step's **Submit**, with today's exact shape:
  `{ order_id: <uuid>, stars: 1–5, tags: subset of ["fast", "great_packaging", "order_was_correct"] }`.
  It fires **at most once per `order_id`**, guarded by `submitRating`
  returning null when `order.rating` is already set, exactly as today. That
  guard covers a second Submit, a history re-rate attempt and a reload.
  **It goes quiet when the visitor skips the restaurant step**, or dismisses
  before it. Those orders simply never send one, so the rating metric's
  numerator becomes "restaurant ratings". The restaurant step shows only the
  three enum tags, so nothing outside the enum can be sent.
- **Fires nothing:** the driver rating, the mini win and the win, Skip and
  dismiss, the sheet auto-opening, tips, Order again, the thanks voucher's
  unlock and consumption, VIP level changes and the ledger sweep.
- **`order_placed.applied_voucher_ids` sends only catalogue ids, always.** When
  the thanks voucher or a VIP perk applies, the array holds exactly the
  catalogue vouchers applied (0–2 of the ten ids), as today. The thanks
  voucher and the perks are never in it: they are not `VoucherId`s, and they
  live outside `OffersState`, so `appliedVoucherIds(sync.state)` cannot return
  them.
  - `saved_amount_minor` stays the **catalogue** vouchers' saving only, so
    "0 iff the array is empty" still holds.
  - `amount_minor` stays the subtotal.
  - **Worked SF:** `applied_voucher_ids: ["sf-discount-t1"]`,
    `saved_amount_minor: 200`, while the screen's "You saved" reads $9.36.
  - **Worked HCMC:** `["hcmc-discount-t1"]`, `10000`.
  - **Gold alone, nothing else:** `[]`, `0`.
  - This is a known, deliberate gap between the screen's "You saved" and the
    event, for the readiness objective to close.
- **Must pin the allow-list.** `tracking.ts` imports `VOUCHER_IDS` from
  `vouchers.ts`. #166 must not add the thanks voucher to that list, and must
  add a test that pins `VOUCHER_IDS` to the literal ten ids. (That is the
  orchestrator's finding on #135, and it is correct.)
- **What goes quiet:** `rating_submitted` for any order whose restaurant step
  is skipped. Nothing else changes cadence.

## Precedents superseded

Both notes are added, dated, in the documents themselves:

- **`87-promo-offers-and-flash.md`** refused "loyalty-program framing (points,
  tiers named Bronze/Silver/Gold)" because promos there were a single
  basket's live subtotal. The owner has now chosen account-level levels (O2).
  This document supersedes that refusal *for VIP levels only*. There are
  still no points and no coins, the catalogue's spend ladder is unchanged and
  keeps the word Tier, and "no third general-purpose stack layer" still holds.
  The thanks voucher is one named exception with its own line.
- **`147-tracker-multi-order-driver-history.md`** put the rating prompt
  "inside the open card … never in history" and made history read-only. This
  document reverses both halves:
  - the rating moves into the **rating sheet**;
  - history rows gain Rate, Tip and Order again;
  - a delivered open card gets the Delivered hero and done rail in place of
    the "Delivered N min ago" line and the full stepper.

  #147's order-stack rules, driver slot, live states and avatars are
  unchanged.

## Critique of the rendered mocks, and what changed

- **The driver's head covered the step label.** In the first render the 112px
  avatar breaking the sheet's top edge sat on top of "1 of 2 · Dr…". I moved
  the × to an absolute corner and put the step label under the avatar,
  centred. The oddity now reads as intended: the driver leaning into the sheet.
- **The confetti covered the reward.** canvas-confetti's default canvas sits
  over the page, and the end frame showed pieces over the ticket and over "1
  more delivered order to Gold". I specified a canvas owned by the sheet,
  behind its content, and the mock now layers it that way. The first end frame
  also had so few, faint pieces that it was indistinguishable from the still.
  I made them denser; the difference between `win` and `win-still` is now
  visible at a glance.
- **VND broke the controls.** "10.000 ₫" wrapped to two lines inside a preset,
  and "30.000 ₫ off" split across the ticket stub. Presets are now `nowrap`
  with less padding, and the ticket sets the amount on one line with "off"
  below it.
- **Too much per picture.** The history mocks first tried four states each
  and lost the fourth under the tab bar (the viewport lesson). There are now
  three files of two or three rows each. The VIP card's fifth state fell off
  too; the state labels moved into a corner number, and the card lost a line.
- **A numbered tag collided with the Gold pill.** Its dashed label sat on
  "Free delivery" in state 4. It is now a single digit.
- **Live vs later Delivered looked alike.** They differ only in the ring,
  the burst and the time line. I kept it that way on purpose: Delivered is one
  state that *arrives* with motion, not two designs. The landing picture is
  captured mid-burst so the difference can be seen.
- **Eye test:** first the stamp and **Delivered**, then the face, then one
  violet button. With the accent covered, the stamp's shape and the 2.25rem
  word still carry it.
- **What I'd remove if forced:** the done rail. It stayed because it keeps
  "this went through five stages" on the card while giving back the height.
- **Checked by script, not by eye:** at 375, every one of the 41 mocks has
  `scrollWidth` 375, with no element past the right edge (confetti excluded,
  since it is decoration by design). The check was run with the pages'
  `overflow-x: hidden` removed first, so it could not hide anything.

## Acceptance-criteria map

The issue's criteria name `docs/design/135-*`; read them as `162-*` (see the
top of this document).

1. **Rating sheet, win and Delivered.** In the 375px renders
   `162-{rate-driver,rate-restaurant,win,win-still,delivered-live,delivered-later}-{sf,hcmc}-{light,dark}-narrow.png`:
   - step 1 shows the vendored avatar (`../../public/avatars/drivers/*.svg`),
     the name and stars;
   - step 2 shows the restaurant, stars and only the chips Fast, Great
     packaging and Order was correct;
   - each step has Skip, and the sheet has ×;
   - the end frame and the still both show;
   - Delivered shows landing and later;
   - there is no horizontal overflow (script-checked).

   These headings exist: "The animation: form, duration, library", "The
   multi-order rule: at most one sheet, and when it opens by itself", and "The
   driver's displayed average". `grep -n '^### The animation\|^### The multi-order\|^### The driver' docs/design/162-*.md`.
2. **History row states.**
   - `162-history-a-*` shows unrated, rated and tipped.
   - `162-history-b-*` shows tip available (presets in the order's currency)
     and short balance.
   - `162-history-c-*` shows signed out, wallet dark with no tip control, and
     Order again (the toast), plus the D14 row.
   - Presets, tippable orders and Order again's behaviour are under "Tips" and
     "Order again".
3. **Thanks voucher and VIP levels.**
   - The unlock is in `162-win-*`, and the voucher applied is in
     `162-checkout-{sf-light,hcmc-dark}`.
   - The five states are in `162-vip-sf-light` and `162-vip-hcmc-dark`.
   - The Gold and Platinum lines are in the checkout mocks.
   - Amount, city, expiry, stack group, pickLargest and auto-select are
     covered, along with Gold vs `delivery` vouchers, rounding, both cities,
     a second device, the ledger (finding 1) and spend (finding 2).
4. **Precedents.** `grep -n '135' docs/design/87-promo-offers-and-flash.md docs/design/147-tracker-multi-order-driver-history.md`
   finds a dated note in each.
5. **Contrast.** See the table: every pair is at least 4.5:1, and the one pair
   that failed (4.05) is designed out.
6. **Events.** `grep -n 'rating_submitted\|applied_voucher_ids' docs/design/162-*.md`.

## For the engineers

- **#163:**
  - rating sheet, mini win, win, Delivered hero, done rail;
  - `driverRating`, `ratingPromptedAt`;
  - the canvas-confetti ADR (ISC, pinned, measured size, dynamic import,
    reduced-motion bypass);
  - `now` injectable for the once-only and 24-hour rules.
- **#164:** `wallet_tip(order_id, currency, amount_minor)`:
  - accepts only the six preset values above;
  - idempotent per `order_id`;
  - refuses without the caller's own debit row (D14).
- **#165:**
  - the history action strip;
  - the tip panel and its states;
  - Order again;
  - `walletPaid` and `tipMinor` on `PlacedOrder`;
  - the D1 rule: no tip UI when the gate is off.
- **#166:**
  - the thanks voucher (outside the catalogue);
  - `parody.vip`, `sweepVipLedger`, and `vipCounted` in `capOrders`'s
    droppable predicate;
  - Gold/Platinum in `computeCheckoutBreakdown` as new fields (a Gold flag
    that zeroes the fee and suppresses the delivery group, and a Platinum
    amount), not as vouchers;
  - the VIP card and the checkout line;
  - the literal ten-id pin test;
  - the four new colour tokens and their contrast tests.

## The one question for the owner

**Should Platinum's spend count every delivered order's total (my
recommendation, and what this document specifies), or only orders the wallet
actually paid for (the objective's original wording)?** With the wallet dark,
the second means nobody can reach Platinum until the owner finishes #136's
setup, and even then an order placed during a network blip would not count.
If nobody answers, #166 builds "every delivered order's total, tips excluded".
Switching later is one predicate plus one line of copy.
