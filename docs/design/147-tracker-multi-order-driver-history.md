# #147: the Tracker tab with several live orders, a driver card, and past orders below

Parent: #134. Builds on #105's tracker (`105-tracker.html`) and #80's "Tracker"
section. It feeds #148, the engineer child that builds this on #144's order store.

This is a specification and a set of drawings. Nothing here is product code.
The mocks under `docs/design/147-*.html` are self-contained, nothing imports
them, and they never ship.

## What is fixed, what is guessed

**The outcome (fixed).** A visitor can see every order they have in flight, move
between them, and see who is bringing each one once it is picked up. Below that
they can look back at what they ordered before. A visitor with one order sees
nothing worse than today.

**The constraints (checked, not assumed):**

- History lives inside the Tracker tab: live orders on top, past orders below.
  The tab bar stays Home / Cart / Tracker, and nothing goes in the home header's
  top row. (Owner, #134 comment of 17:35; #140 O4.)
- Avatars are illustrated Bitmoji/Mii-style headshots, not photographs. They come
  from a build-time or vendored generator, or are hand-drawn SVG. The page
  fetches nothing from a new host. (Owner, O1.)
- The five `STEPS` and their per-order timing (`tracker-state.ts`) are
  unchanged. The countdown still counts to `etaMinutes`, so orders still arrive
  early (#121).
- The rating uses #129's format, `★ 4.8 (3k+)`, built from `rating.toFixed(1)`
  and `formatReviewCount(count)` (`reviews.ts`; `home-dom.ts:158` is an existing
  example).
- The driver's city, and so the vehicle icon, comes from the order's restaurant,
  not the city picker (#129/#130 precedent; #144 AC4).
- History is read-only. Rating, tipping and reorder from it belong to #135.
- #144 is not merged yet. This document designs against the fields its issue
  names, using these names: driver `id`, driver `name` ("Minh T."), driver
  `rating`, driver `ratingCount`, and order `totalMinor` (nullable for legacy
  orders). **If #144 merges different names, #148 uses #144's names.** The
  meaning of each field is what this document depends on, not the spelling.

**The guesses (mine, open to disagreement):**

- Which order is open by default (the one arriving soonest, see "Order stack").
- That a delivered order watched live stays in "Live now" until the visitor
  leaves the page.
- Date formats per city, and the "subtotal" label on legacy rows.
- The avatar style (avataaars), the constrained option set, and the 12 sample
  names and seeds.

## Look at what's there now

`./scripts/app-render /tracker/ <dir> <seed>` with one HCMC order seeded 4
minutes into a 10-minute delivery. The pictures are committed as
`147-today-app-tracker-narrow.png` / `-wide.png`. The script ran, but only after
two workarounds that are this sandbox's problem, not the repository's:

1. No browser is on `PATH`. I put the Playwright Chromium already on the image
   (`/opt/pw-browsers/chromium-1194`) on `PATH` via a scratch symlink.
2. Inside this nested worktree, `astro build` fails with `Tsconfig not found
   astro/tsconfigs/strict`. I ran the script from a plain copy of the tree outside
   `.claude/worktrees/`.

Today, honestly: the built tracker is a clean, quiet column. It has a muted
restaurant line, a bold 15px countdown line with a scooter icon, and a
five-step rail with an orange current dot. Everything sits at one of two type
sizes, so nothing leads. The countdown is the only number a waiting person cares
about, and it is set like a sentence. Below the stepper, more than half the 812px
phone viewport is empty. At the wide width the same column floats on the left
third of a 1280px page with nothing beside it. Nobody is attached to the order
at any stage. There is no trace of any order but the latest. The page has plenty
of room for the new content; what it lacks is a hierarchy.

## Looked at outside this repository

- **Uber Eats' tracker** (its five-section tracking bar with animated
  illustrations, plus the courier's name on the tracking screen; Marketing Dive,
  "Uber Eats boosts delivery tracker transparency with colorful animations").
  **Taking:** the courier is named on the tracking screen, as part of the
  progress rather than on a separate page. **Refusing:** the animated
  illustrations. This page redraws every second (`tracker-dom.ts:273`), and our
  stepper already names the stage. Motion here would decorate a number that is
  already changing.
- **Grab's Activity tab** (Grab help centre, "How to check my order history"; the
  Vietnam guides describe the Activity tab listing ongoing items above past ones).
  **Taking:** its structure, which the owner already chose: ongoing on top, history
  below, in one place, with the driver on a finished order. **Refusing:** Grab's
  dense, all-equal list, where an ongoing order is a row like any other. The
  ongoing order is the one thing a person on this tab is waiting for, so it gets
  the big type.
- **DoorDash's Orders screen** (Active / History / Scheduled tabs, per DoorDash's
  own help pages). **Refusing** the segmented tabs inside the page: they hide
  history behind a tap, and the owner put history below the live orders on
  purpose. **Taking:** "Active" as a counted group. Our label reads "Live now · 2".
- **Bitmoji and Mii** (the owner's reference for the avatars). **Taking:** a
  friendly, front-facing, flat-colour headshot with a skin-tone range. **Refusing:**
  full-body poses and outfits. At 20-68px only a head and shoulders read.

The pages were read through search results, because this sandbox's egress proxy
blocks `dicebear.com` and `avataaars.com` (see "Avatar style" for what that means
for the licence quote).

## Direction

**Calm, legible, human.** The page should read as "your food, and the person
bringing it". It must **not** look like a logistics dashboard: no table of
statuses, no grid of equal cards, no map, no colour-coded badges.

### Two directions, compared

- **A: Order stack (recommended).** "Live now" is a vertical accordion. One open
  order card holds the restaurant, a large countdown, the stepper and the driver
  slot. Every other live order is a collapsed row underneath, and each row shows
  its own stage, driver state and minutes. Tapping a row opens it and closes the
  current card. Past orders follow as one grouped list.
  Mocks: `147-tracker-live-*.html`, `147-state-three-live.html`.
- **B: Order chips.** A horizontally scrolling strip of pill chips across the
  top, one per live order. The selected chip is filled dark, and the detail
  appears below it. Mock: `147-direction-b-chips.html`.

B is tidier at two orders. At 375px it shows about one and a half chips: the
second restaurant name is already cut off, and a third chip is off screen
entirely (`147-direction-b-chips-narrow.png`). So B fails the most important
job of a switcher at the width that matters, which is showing that the other
orders exist and how they're doing. A shows every live order's stage and
minutes without a tap, grows downward (the one direction a phone scrolls
willingly), and needs no new control: the row is the control. **I recommend A.**
Every requirement below describes A.

## Composition

**Where the eye lands first:** the countdown in the open card, `14:05`, at
2.25rem/800 with `letter-spacing: -0.03em` and tabular figures. It is the one
number a waiting person wants, and it is now 2.4× the body size rather than set
as a sentence. Second is the driver's name at 1rem/800 beside a 68px headshot.
Everything else is 15px body or 12px muted text.

**What the page does with its space.** At 375 the open card takes the upper
two-thirds of the viewport. Collapsed rows are deliberately small (60px), and
"Past orders" starts just above the tab bar, so it announces itself before
anyone scrolls. At the wide width the page becomes two columns: "Live now" on
the left (max 25rem) and "Past orders" on the right, filling the space that
today's column leaves empty.

**What survives at 375px:** in all four live renders (both cities, light and
dark), without scrolling, you can see the open card with its countdown, the
stepper and the driver, the second order's row, the "Past orders" label and the
first history row, plus the tab bar.

**One language of depth: fills.** The open card, the rows and the history group
are `--color-surface` fills on `--color-bg`, with 14-16px radii and no outlines.
The driver slot is one step deeper (`--color-tab-active-bg`). Hairlines appear
only between rows inside the history group.

**One accent, counted.** `--color-accent-a` appears only on the done steps of
the one open stepper, and `--color-accent-b` only on its current dot, exactly as
today. History check icons are muted rather than accented. That is a change made
after the first render: five violet ticks in the list competed with the stepper.

**The deliberate oddity:** the driver's head breaks out of its circle. The
avataaars "circle" style clips the shoulders to a disc and lets the hair and
head rise above it, and the 68px avatar is pulled 20px above the driver slot's
baseline. Every other image on the page is a clean rounded rectangle. This one
thing is a person, and it is the only element allowed to break its frame.
Defence: the whole reason for #134 is that "nobody is bringing the food". The
single shape that isn't a box is the one that says someone is.

**Motion.** Opening a row: the outgoing card collapses and the incoming one
expands, animating height over 200ms `ease-out`. Nothing else moves; the
per-second countdown tick is not animated. Under `prefers-reduced-motion:
reduce`, the swap is instant.

## The happy path

1. The visitor has placed two orders and taps **Tracker**. They see "Tracker",
   then **Live now · 2**. The order arriving soonest is open: restaurant photo
   (44px) and name, "2 items · 95.000 ₫", the large countdown with the city
   vehicle, "until estimated arrival", the five-step stepper, and the driver
   slot. Below that is the other order's row, and "Past orders" below that.
   *Next:* tap the row, or scroll to history.
2. The open order passes **Picked up**. Its driver slot changes in place from
   "Finding your driver" to the driver card: headshot, "Your driver", **Minh
   T.**, "★ 4.8 (3k+)", and the vehicle icon. The slot's height does not change,
   so nothing below it jumps.
3. The visitor taps the other order's row. That order opens in its own position.
   The first order collapses to a row showing "On the way · *avatar* Minh T." and
   its minutes. `aria-expanded` flips on both.
4. The open order reaches **Delivered** while the visitor watches. The countdown
   is replaced by **Delivered 2 min ago** at 1.5rem/800. The driver card's
   kicker becomes "Delivered by". The demo disclosure and today's rating prompt
   appear inside the card, below the driver (`147-state-delivered-open.html`).
   *Next:* rate (as today), or scroll.
5. On the next visit, that delivered order is a row in **Past orders**,
   newest first: photo, name, date · item count, *avatar* driver, total, and
   "✓ Delivered".

## Named things (use these nouns in code)

| Noun | What it is |
|---|---|
| **Live now** | The section of orders not yet delivered (plus the exceptions in "Order stack" rules). Its label carries the count. |
| **open order card** | The one expanded live order. |
| **order row** | A collapsed live order. It is also the switcher. |
| **driver slot** | The fixed-height area in the open card. It holds either the **pending driver** state or the **driver card**. |
| **Past orders** | The history section, one grouped list of **history rows**. |
| **device note** | "Kept on this device only." under the history list. |

## Components

### Open order card
- **Purpose:** everything about the one order the visitor is looking at.
- **Inputs:** order (restaurant slug → photo, name and city; `itemCount`;
  `totalMinor` or subtotal; `placedAt`/`etaMinutes`/`deliveryMs` via
  `computeTrackerView`; driver; rating).
- **States:** active before Picked up (countdown, stepper, pending driver);
  active from Picked up onward (countdown, stepper, driver card); delivered
  unrated (Delivered line, stepper complete, "Delivered by" card, disclosure,
  rating prompt); delivered rated ("Thanks for rating this order" plus static
  stars, as today).
- **Never:** show a countdown after Delivered; hold `aria-live` on anything but
  its stepper; show a second card open at once.

### Driver slot
- **Pending driver:** a 48px dashed circle (`--color-text-muted`, 2px dashed)
  with the order's city vehicle icon inside, then **"Finding your driver"** (700)
  and "Assigned when your order is picked up" (12px muted). **Chosen over "no
  driver at all"** because it keeps the slot's height constant (no layout jump
  at pickup), it tells the visitor a driver is coming, and it is honest: #144
  assigns the driver at placement but reveals them only at Picked up, so the copy
  says when they will appear, not that the app is searching. It does not animate.
- **Driver card:** a 68px avataaars headshot (the `<img>` has `alt=""`, because
  the name beside it carries the meaning), then the kicker "Your driver" or
  "Delivered by" (12px muted), the name (1rem/800), and `★ 4.8` (12px/700
  `--color-text`) followed by `(3k+)` (12px `--color-text-muted`). The vehicle
  icon (22px, muted) sits on the right edge.
- **Never:** show a driver before Picked up; use the city picker to choose the
  vehicle or pool; re-roll the driver on render.

### Order row (the switcher)
- **Purpose:** show a live order that is not open, and open it on tap.
- **Content:** 40px photo; the name (700, one line with an ellipsis, because the
  open card shows it in full); a status line reading "Preparing · Finding your
  driver" before pickup, or "*20px avatar* Picked up · **Marcus L.**" from pickup
  onward; whole minutes to the estimate on the right ("19 / min", tabular); a
  chevron.
- **Behaviour:** a `<button aria-expanded="false" aria-controls="…">`, 60px tall,
  the full width as the target. Minutes update each tick but are **not**
  `aria-live` (a per-second announcement for every row would be noise). It needs
  a visible focus ring: 2px `--color-accent-a` outline, 2px offset.
- **Never:** carry the rating count (the open card does); reorder itself while
  ticking.

### History row
- **Content:** 40px photo (8px radius); the restaurant name (700, wraps to at
  most 2 lines with `overflow-wrap: anywhere`, then an ellipsis); "date · N
  items" (12px muted); a 20px avatar and the driver's name (12px muted); on the
  right, the total (700, tabular) above "✓ Delivered" (12px muted, muted check).
- **Total:** `formatMoney(totalMinor, order.currency)`. It is the order's own
  currency, not the picker's, so an SF visitor sees `245.000 ₫` on an old HCMC
  row.
- **No stored total (legacy, pre-#144):** show the subtotal the order has always
  carried (`amountMinor`), with the word **"subtotal"** in 12px muted under it
  (`$12.50 / subtotal`, `40.000 ₫ / subtotal`). I rejected "—": the subtotal is
  true, useful and already stored, and the label keeps it from passing for the
  total.
- **Status:** every row today reads "Delivered", because an order only reaches
  Past orders once delivered. It is still a slot, not a hard-coded word, so #135
  can add states. **Never:** show the rating prompt, stars, tip or reorder.
- **Date:** today → "Today, 12:18 PM" (SF) / "Today, 11:52" (HCMC); yesterday →
  "Yesterday"; older → "Tue, Sep 22" (SF) / "Tue, 22 Sep" (HCMC). The locale is
  per the order's city, with 24-hour time for HCMC. **Guess**, called out above.
- **Not a link.** A history row is read-only here and has no tap target.

## Order stack rules (for #148)

- **Which orders are in Live now:** every order not yet at Delivered.
  **Exceptions:**
  - An order that reaches Delivered while it is open stays open, rating prompt
    included, until the page is left.
  - When no order is live, Live now shows the most recently placed order in
    whatever state it is in. This is exactly today's screen, so a single-order
    visitor keeps today's Delivered-plus-rating-prompt state indefinitely.
- **Past orders** lists every stored order not shown in Live now, newest
  `placedAt` first. An order never appears in both sections. The section is
  hidden entirely when it would be empty.
- **Order of rows in Live now:** ascending estimated arrival (`placedAt +
  etaMinutes`). This key is fixed per order, so the stack never reshuffles
  while ticking. The open card stays in its own sorted position (an accordion),
  and it does not jump to the top.
- **Which order is open by default:** the one with the earliest estimated
  arrival, because that is the one a person has to act on first. **Override:**
  arriving from `/order-placed/`, open the order just placed. Its track link
  (`order-placed-dom.ts:65`, today a bare `/tracker/`) becomes
  `/tracker/#order-<orderId>`, and the tracker reads that once on load. The open choice is page state
  only: a reload returns to the default.
- **3 or more live orders at 375px:** the open card, then one 60px order row per
  other live order, stacked, then Past orders. Three live orders still fit the
  first viewport with the first history row peeking
  (`147-state-three-live-narrow.png`). At four or more the rows continue down
  the page and the visitor scrolls. There is no horizontal scroller, no "+2
  more" overflow and no cap on how many rows show. Every live order is always
  one tap away.
- **Tracking.** CLAUDE.md "Event tracking comes last" applies; this is not a
  new event, but #148 must say which order `tracker_viewed` fires for. **My
  recommendation:** once per page load, for the order open by default, exactly
  as today, and not again when a row is opened. That keeps its shape and its
  cadence.
- > **Superseded, 2026-09-27 (#135, specified in
  > `162-rating-win-tips-rewards-vip.md`):** both halves of the rule below
  > are reversed. The rating moves out of the open card into a two-step
  > rating sheet (driver, then restaurant). History rows gain Rate, Tip and
  > Order again, so history is no longer read-only, and the history row's
  > "Never: show the rating prompt, stars, tip or reorder" no longer holds.
  > A delivered open card shows #135's Delivered hero and done rail in place
  > of the "Delivered N min ago" line and full stepper. The order-stack
  > rules, the driver slot, the live states and the avatars are unchanged.
- **Rating prompt.** It sits where it does today relative to the stepper:
  stepper → (new) driver card → demo disclosure → "How was your order?". It is
  inside the open card and appears only for an order that is open and delivered.
  It **never** appears in a history row or an order row. `rating_submitted`
  writes to the open order's id.
- **The driver's city comes from the order**, not the city picker. An HCMC order
  viewed with the picker on SF still shows its HCMC driver, a Vietnamese name and
  the motorbike.

## States

| State | What shows | Mock |
|---|---|---|
| **Empty** (no orders at all) | Today's copy: "Nothing to track yet." and **Browse restaurants**. No Live now label and no Past orders section. | `147-state-empty` |
| **Loading** | None to design. Orders come from `localStorage` synchronously on the first render, as today. | - |
| **One live order** | The open card alone: no "Live now" label, no rows, no Past orders if nothing else is stored. It keeps today's restaurant line, stepper and countdown (the countdown is now larger). The pending-driver slot is the one addition. Shown beside `105-tracker-narrow.png` and today's built page. | `147-state-one-order` (wide = side by side) |
| **Two live orders** | As in the happy path, in both cities, light and dark. | `147-tracker-live-{sf,hcmc}-{light,dark}` |
| **Three or more live orders** | See "Order stack rules". | `147-state-three-live` |
| **Delivered while open** | Delivered line, "Delivered by", disclosure, rating prompt. The next order row is pushed below the fold at 375. That is accepted: the visitor is rating, and the row is one scroll away. | `147-state-delivered-open` |
| **History** | Five rows, newest first, including a long HCMC name that wraps to 2 lines (Bò Bít Tết Chú Tám Gò Vấp, Hủ Tiếu Nam Vang Hòa Phát) and a legacy row with "subtotal". | `147-tracker-history-{sf,hcmc}-{light,dark}` |
| **Partial / error** | A stored order that fails to parse is dropped by the store's existing try/catch, as today. A row whose restaurant slug no longer resolves shows the stored `restaurantName` with a `--color-surface` square in place of the photo. A driver id with no avatar file shows a 20/68px `--color-tab-active-bg` disc with the driver's initial. That last case shouldn't happen, but it must not show a broken image. | described only |
| **Offline** | No difference. The page makes no network call to render. | - |
| **After a destructive action** | None exists. History is read-only, and there is no clear-history control in this objective. #144's storage cap drops the oldest *finished* orders silently. The device note says "Kept on this device only." and does not promise "all". | - |

The history mocks are separate files because `design-render` photographs one
812px viewport. At 375 they simulate a scrolled page by hiding the header, title
and open card, and a dashed scaffold note at the top says so. It is the only
scaffolding in any live-page mock.

## Avatar style

**Generator:** DiceBear (`@dicebear/core` 9.4.3), style **Avataaars**
(`@dicebear/avataaars` 9.4.2), with the **circle** style option. I ran it in
this environment from a scratch `npm install`. Every headshot in the mocks is
that output, embedded as a `data:` URI, not a stand-in.

**Why this style:** in a contact sheet of eight DiceBear styles (personas,
avataaars, toon-head, big-smile, micah, adventurer, notionists, lorelei),
avataaars was the one that read as "Bitmoji": flat colour, front-facing, a real
skin-tone range and shoulders. Personas and micah read smaller and blander at
20px. Notionists and lorelei are black line art. Adventurer and big-smile are
more cartoon than person. It is also the only one of those whose artwork needs
no attribution (below).

**Licences:**
- **Code:** MIT (the DiceBear packages' `LICENSE`, "Copyright (c) 2024 Florian
  Körner").
- **Artwork:** the style's own documentation says: *"The avatar style is based on
  Avataaars by Pablo Stanley, licensed under Free for personal and commercial use.
  / Remix of the original."* That sentence is quoted from the style package's own
  README (`@dicebear/avataaars/README.md`), the same text as its DiceBear style
  page, which search shows reads "based on Avataaars by Pablo Stanley, licensed
  under Free for personal and commercial use". The package `LICENSE` says
  `License: Free for personal and commercial use (https://avataaars.com/)`.
- **I could not open `dicebear.com/styles/avataaars` or `avataaars.com`
  directly.** This sandbox's egress proxy blocks both (`EGRESS_BLOCKED`), so the
  quote comes from the style's shipped README and LICENSE, not a live page. A
  reviewer with a browser should confirm the live page reads the same.
- **Attribution is not required** by that licence. **I recommend giving it
  anyway**, as one line on `/about/`: "Driver avatars: Avataaars by Pablo Stanley,
  via DiceBear (MIT)." It costs nothing, and it keeps the provenance findable next
  to the photo credits.
- For comparison, several alternatives are **CC BY 4.0 and would require
  attribution**: personas, micah, adventurer, big-smile and toon-head.

**Option set (the engineer copies this; it is what produced the mocks):**

```
style: ['circle'], backgroundColor: ['d9c8ff'],
eyes: ['default','happy','wink','squint'],
eyebrows: ['default','defaultNatural','raisedExcited','raisedExcitedNatural','flatNatural'],
mouth: ['smile','default','twinkle'],
accessoriesProbability: 15, accessories: ['prescription01','prescription02','round','wayfarers'],
facialHairProbability: 15, facialHair: ['beardLight','beardMedium','moustacheFancy'],
clothing: ['collarAndSweater','hoodie','shirtCrewNeck','shirtScoopNeck','shirtVNeck','overall'],
clothesColor: ['262e33','5199e4','25557c','929598','3c4f5c','ff5c5c','a7ffc4','ffffb1'],
top: every hair option except hat/winterHat*/turban/frida/miaWallace/shaggyMullet/dreads02
     (hijab kept),
SF   skinColor: ['614335','ae5d29','d08b5b','edb98a','ffdbb4']
     hairColor: ['2c1b18','4a312c','724133','a55728','b58143','d6b370','e8e1e1']
HCMC skinColor: ['d08b5b','edb98a','ffdbb4']; hairColor: ['2c1b18','4a312c','724133']
seed: the driver's stable id (e.g. 'sf-04', 'hcmc-01')
```

The defaults include crying, vomiting, heart-eyes and yellow or orange skin,
and they are excluded on purpose. The per-city ranges are a judgement call: an
HCMC pool with blonde or pink hair would read as a mistake next to Vietnamese
names. The SF pool uses the full natural range. The engineer should render all
50 to one contact sheet (as `147-avatars.html` does for 12) and re-seed any that
read badly before committing.

**How all 50 are produced with no runtime fetch:** vendored at build time,
once, by a script. `@dicebear/core` and `@dicebear/avataaars` become pinned
`devDependencies` (npm, the ecosystem already in use, so this is not a new
category; the ADR the owner asked for records it). A script beside
`scripts/fetch-photos.mjs`, e.g. `scripts/generate-driver-avatars.mjs`, reads the
50 driver ids from #144's driver module and writes one SVG per driver. The
files are committed. The page loads them with `<img src="/avatars/drivers/<id>.svg">`.
Nothing is generated in the browser, and nothing leaves the origin. A test
asserts that the files and the pool match one to one.

- **Use `<img>`, not inline SVG.** DiceBear output reuses internal ids for its
  masks. When I first put eight inline avatars on one page, only the first
  style drew; the rest came out as empty circles. `<img>` isolates each file.
  (`randomizeIds: true` also fixes it, but `<img>` is simpler and cacheable.)

**Measured size:** one sample (`sf-04`, Sarah K.) is **3,829 bytes** (1,652
gzipped). The twelve samples range from 3,798 to 11,309 bytes (`hcmc-06`, the
long hair and beard) and total 69,907 bytes, so all 50 should come to roughly
250-300KB on disk. A page loads only the avatars it shows: one per live order
plus one per history row.

**Where they live: not under `public/images/`.** `image-budget.test.ts:56-76`
requires every file under `public/images/` to have a credits row reading
"Unsplash License". Avatars there would either fail CI or need a false credit.
So:
- Put them under **`public/avatars/drivers/`**.
- Add a sibling test with a per-file cap. I propose **12KB**, which rejects
  outlier seeds like a 20KB one and leaves room for `hcmc-06`.
- Put the provenance in the ADR and on `/about/`. **Do not** add it to
  `docs/design/80-photo-credits.md`: that test also asserts the file contains no
  `.svg` at all (`image-budget.test.ts:67`), so a line naming an avatar file
  would fail it.
- The existing "no hotlinked image" test already covers the no-runtime-fetch
  rule for the built site.

## Contrast

Every new text/background pair, computed with `./scripts/contrast <fg> <bg>`
(output quoted as printed). The bar is 4.5:1.

| Pair | Where | Light | Dark |
|---|---|---|---|
| `--color-text` on `--color-surface` | order name, countdown, totals, history names | `#241b33` on `#f7f1ff` → **14.83** | `#f1e9ff` on `#1e1730` → **14.62** |
| `--color-text-muted` on `--color-surface` | "until estimated arrival", row status, history date/items/driver, "Delivered", "subtotal" | `#6b5d85` on `#f7f1ff` → **5.38** | `#b7a6d9` on `#1e1730` → **7.76** |
| `--color-text` on `--color-tab-active-bg` | driver name, `★ 4.8` | `#241b33` on `#ede1ff` → **13.14** | `#f1e9ff` on `#2e2444` → **12.29** |
| `--color-text-muted` on `--color-tab-active-bg` | "Your driver", rating count `(3k+)`, "Finding your driver" sub-line | `#6b5d85` on `#ede1ff` → **4.76** | `#b7a6d9` on `#2e2444` → **6.52** |
| `--color-text` on `--color-bg` | "Tracker", empty state | `#241b33` on `#fbf7ff` → **15.51** | `#f1e9ff` on `#16101f` → **15.82** |
| `--color-text-muted` on `--color-bg` | section labels, device note | `#6b5d85` on `#fbf7ff` → **5.62** | `#b7a6d9` on `#16101f` → **8.40** |
| `--color-accent-a` on `--color-bg` | disclosure link (unchanged, delivered state) | `#6c3ce0` on `#fbf7ff` → **5.91** | `#b79cff` on `#16101f` → **8.17** |
| `--color-bg` on `--color-accent-a` | Submit (unchanged) | `#fbf7ff` on `#6c3ce0` → **5.91** | `#16101f` on `#b79cff` → **8.17** |

Everything passes. The tightest pair is muted text on the driver slot in light
mode (4.76), so no smaller or lighter text goes on that fill. Nothing failed, so
nothing had to change. The star `★` is text in `--color-text`, not an accent,
so no meaning is carried by colour.

## Critique of the rendered mocks, and what changed

- **The first render of the avatar contact sheet drew only the first style.**
  Seven rows were empty circles, because of DiceBear's shared internal ids.
  Fixed in the mocks by embedding each as an `<img>` `data:` URI, and written
  into the engineer notes above.
- **The oddity was invisible at first.** The 56px avatar sat fully inside the
  driver slot, and the head-out-of-circle effect read as an ordinary round
  avatar. I enlarged it to 68px, pulled it 20px above the slot, and added
  1.25rem above the slot so the head has room. At 375 the head now meets the
  slot's top edge in both cities. Honestly, it reads as "a little bigger than
  its box" rather than a dramatic break. That is the right amount for a
  delivery screen.
- **Accent count.** The first history list had five violet ticks, and my eye went
  to them before the totals. I muted them. Now accent appears only in the open
  stepper.
- **A collapsed row with a driver wrapped to two lines** ("Picked up · Marcus L.
  ★ 4.8 (612)"), which made one row taller than the others. I dropped the rating
  from the row; the open card carries it.
- **The one-order comparison's third frame broke** the first time: the
  comparison's image rule stretched the restaurant thumbnail to 300px, and the
  wide header leaked into the phone frame. It now frames the narrow mock in an
  iframe of itself.
- **What I'd remove if forced:** the "Live now · 2" label. It stayed because at
  two or more orders it is the only thing saying the rows below the card are
  orders too, not suggestions. At one order it is already hidden.
- **Blur test:** a large dark number top-left, one pale lavender band with a face
  in it, a stack of smaller rounded rectangles, then a long list. The hierarchy
  survives.

## Acceptance-criteria map

1. **Live orders and the driver.** The four narrow PNGs
   `147-tracker-live-{sf,hcmc}-{light,dark}-narrow.png` each show, without
   scrolling:
   - both orders, with the open one showing its stepper and countdown;
   - the other order's row, which is the switch control;
   - a driver card: headshot, "Sarah K." / "Minh T.", and `★ 4.9 (1k+)` /
     `★ 4.8 (3k+)`;
   - "Finding your driver" on the pre-pickup order;
   - the tab bar reading exactly Home, Cart, Tracker.

   The names are checkable: `grep -c 'Sarah K\.' 147-tracker-live-sf-*.html`
   returns 1 for each file, `grep -c 'Minh T\.' 147-tracker-live-hcmc-*.html`
   returns 1 for each, and `grep -c 'Minh T\.' 147-tracker-live-sf-*.html`
   returns 0.
2. **History and edge states.**
   - `147-tracker-history-{sf,hcmc}-{light,dark}-narrow.png` list five rows newest
     first. Each shows the restaurant, date, item count, total in that city's
     currency, status and driver.
   - Long HCMC names wrap to two lines and do not overflow.
   - The other edge states each have a mock: empty (`147-state-empty`), one order
     beside 105 and today's build (`147-state-one-order-wide.png`), and a legacy
     row showing "subtotal" (the last row in each history render).
3. **The avatar style is chosen and real.**
   - `147-avatars-{narrow,wide}.png` show six real generator headshots per city,
     in light and dark. The live and history mocks show four or more distinct
     ones per city.
   - Generator, style, licences, quote, the no-runtime-fetch path, the 3,829-byte
     sample and the `public/images/` answer are all in "Avatar style" above.
   - `grep -E 'src="https?:|url\(https?:' docs/design/147-*.html` returns
     nothing.
4. **Contrast:** see the table above; every pair passes 4.5:1.
5. **Notes for the engineer:** "Order stack rules" covers three or more live
   orders at 375px, where the rating prompt sits and that it never appears in
   history, and that the driver's city comes from the order.

## One question for the owner

Should the tracker open the **soonest-arriving** order by default (my
recommendation, and what the mocks show), or the **most recently placed** one?
The most recent is what #144's interim tracker shows, but on a screen with two
orders the soonest is the one someone has to get up for. Either way, arriving
from Order placed opens the order just placed. If nobody answers, #148 builds
the soonest-arriving default.
