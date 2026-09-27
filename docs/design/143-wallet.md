# Wallet: the header chip, the wallet sheet, and sign-in and short balance at Place order

Parent: #136. Issue: #143. This builds on #133's merged header row
(`docs/design/137-carousel-header-tiles.md`, "Composition → Header row", and
`docs/design/137-home-feed-*.html`). It does not build on `main`'s current
`Header.astro`, and it does not build on #150, the open pull request that
implements #137.

**In one line:** the home header's top-right slot shows **one number: the
current city's balance**. A small `+` badge on it means a cash drip is waiting.
Tapping it opens a **wallet sheet** that holds both balances, the drip and
sign-out. Checkout changes only when a signed-out visitor taps Place order, or
when a signed-in wallet can't cover the total. While the wallet is **dark**
(D1), nothing anywhere changes.

## Outcome, constraints, guesses (design-craft)

**Outcome (fixed).** A signed-in person can see their money and the drip from
the home screen. A signed-out person meets sign-in once, at Place order. A
person who can't afford an order is told by how much and when more arrives.

**Constraints (checked, not assumed).**
- The row is #137's `grid-template-columns: 1fr auto 1fr` row, with the pill
  centred on the full row. At 375px with `Ho Chi Minh City ▾` in the centre,
  each side column is about 96px: (335 − 135 − 2×4) ÷ 2. The tightest case
  measured (see "Critique") is a chip that is too wide to fit.
- The pill text is `--font-size-muted` (0.75rem/12px, 700). Criterion 1 sets
  that as the floor, and the chip text is set at exactly 12px/700.
- Money goes only through `Intl.NumberFormat` (`src/lib/money.ts`).
- The drip windows are 07:00, 15:00 and 23:00 America/Los_Angeles. There is
  one claim per window and no carry-over. The server owns this arithmetic
  (#136 "For the orchestrator").
- D1: whenever auth or the wallet store is unconfigured or unreachable,
  everything behaves exactly as it does today.
- The sign-in prompt appears only after a signed-out visitor taps Place order.

**Guesses in the issue, and what I did with them.**
- "Put the balance in the slot": kept, but as **one** currency. The slot is
  ~96px wide. `600.000 ₫` alone is ~92px as a chip, so two currencies can't
  both fit.
- "The drip entry point": the issue implies a separate control. **There isn't
  one.** The chip *is* the entry point, and a badge on it carries the drip
  state. See "Two directions" for the alternative I rejected.
- "Sign-in failed or cancelled" as one state: kept as one. The OAuth return
  can't reliably tell a cancel from a failure, and the fix is the same either
  way: try again.

## What is there today (step 7)

Rendered with `./scripts/app-render` from a build of `origin/main` at
`8feaaad`. The pictures are `143-today-home-narrow.png`,
`143-today-checkout-sf-narrow.png` and `143-today-checkout-sf-wide.png`.

Home at 375px is the city chooser under a one-line wordmark. #137's row isn't
built yet (#150 is open). Checkout reads as a long, tidy form that ends in the
Total, the demo disclosure and a full-width violet Place order, directly above
the tab bar. Nothing on either screen suggests money belongs to anyone. That is
the gap #136 closes. It is also why the D1 state needs no drawing: **the dark
checkout is identical to today's**, and `143-today-checkout-sf-narrow.png` is
its picture.

The seeded SF cart in that render totals **$21.00**. A new account holds
**$20.00**. So the very first order this repository photographs is a short
balance, and that is the case the short-balance mock uses.

## Looked at outside (step 8)

- **Duolingo's top bar.** A currency count sits in the header as a bare
  number, and tapping it opens a sheet or shop with the detail. Its hearts show
  a refill time rather than a count. *Taking:* the number-as-a-button, with
  detail one tap away. *Refusing:* the emoji icons, the celebratory
  animation, and ticking timers. This wallet is play money, and pressuring
  people over it teaches nothing.
  ([Duolingo gamification write-up](https://blakecrosley.com/guides/design/duolingo),
  [top bar icons](https://techwiser.com/all-duolingo-icons-and-symbols-meaning-including-status-icons/))
- **Grab's home.** The wallet balance lives at the top of the home screen,
  because a super-app's money is part of its identity
  ([Grab redesign case study](https://medium.com/@fairullahv/case-study-grab-app-redesign-to-streamlined-grab-food-user-experience-8ea786305b8c)).
  *Taking:* the balance belongs on home, not buried in a profile. *Refusing:*
  the full-width wallet card that pushes the feed down. #137 just spent its
  budget getting the feed above the fold.
- **The provider guidelines themselves**, as design references rather than
  only compliance:
  - [Sign in with Google branding guidelines](https://developers.google.com/identity/branding-guidelines).
    The egress proxy blocked this page from this run (`developers.google.com`
    returned 403 on CONNECT). I took the values below from a verbatim quote of
    that page in [an issue citing it](https://github.com/Geoffe-Ga/adepthood/issues/2203).
    **The engineer must re-check them against the live page.**
  - [Apple HIG, Sign in with Apple](https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple),
    read in full through its JSON source.

  *Taking:* both allow a capsule shape, and both demand equal prominence.
  *Refusing:* each provider's JS-rendered button. Both would add a script host
  the site doesn't use today. Custom buttons are permitted by both and keep
  the outbound destinations to the OAuth redirect.

## Direction (step 9)

**Quiet, legible, trustworthy.** The wallet is the one un-urgent thing in an
app that parodies urgency. It must not look like a flash deal: no countdown
tiles, no orange, no pulsing, no confetti. It also must not look like a
banking app bolted on: no card, no chart, no second header row.

### Two directions (carried to a picture, `143-wallet-directions-*.png`)

- **A: chip + wallet sheet (recommended).** The slot holds the current city's
  balance. A `+` badge marks a waiting drip. One tap opens a sheet with both
  balances, the drip and sign-out.
- **B: collect in the header.** When a drip is waiting, the slot swaps the
  balance for a filled `Collect` button. One tap credits, a toast says what
  arrived, and the balance returns.

B is faster by one tap and wrong in four ways, all visible in its picture:
- It hides the balance exactly when the balance matters.
- It can't name two amounts in ~96px.
- It credits before the person has seen what they are getting.
- It still needs a second surface for the other currency and for sign-out.

A keeps one noun in the header and puts the rest where there is room.

### The deliberate oddity

**The drip is announced as a clock time, never a countdown.** "Next drip at
3:00 PM", not `04:59:12`. In this codebase the flash sheet (#119) uses
countdown tiles on purpose, as the parody. The wallet is the counterpoint.
A time also lets someone plan to come back. As a bonus it needs no running
timer, so nothing leaks when `renderFeed()` re-runs on a city switch.

## Composition (step 10)

### Header row: `.balance-slot` (criterion 1)

- **What the eye lands on first:** still the city pill, centred. The chip is
  the second read, and it must not outrank the pill.
- **The chip (`wallet-chip`).** It uses the pill's own anatomy, not a new
  shape:
  - 12px, weight 700, tabular numerals;
  - `--color-text` on `--color-surface`, with a 1px `--color-border` outline;
  - pill radius, `min-height: 32px`, padding `0.25rem 0.75rem`;
  - a 44px hit area from a transparent `::after` extending 6px vertically.
  - It replaces #137's dashed placeholder: solid outline, and real text
    colour rather than muted, because it is now live data.
- **What the chip shows:** the **current city's balance only**, formatted by
  `formatMoneyForCity`. It follows the city pill: switching city switches
  the currency.
- **The compact rule for long balances:** if the formatted string is longer
  than **9 characters**, the chip shows `Intl.NumberFormat`'s own
  `notation: 'compact'`, still through `money.ts`: `$12,480.00` → `$12K`,
  `2.700.000 ₫` → `2,7 Tr ₫`. The full value stays in the chip's accessible
  name and in the sheet. Nine is the length of `600.000 ₫`, the widest value
  measured to fit. I checked that VND values of 1,000,000 ₫ and more use
  compact, and `600 N ₫` never appears, because nothing under 1,000,000 ₫ is
  over 9 characters.
- **Drip available:** the outline turns `--color-accent-a`, and a 14px `+`
  badge sits on the chip's top-right corner. The badge is absolutely
  positioned and adds no width, with a 2px `--color-bg` ring to separate it
  from the border. The badge is a shape, not only a colour, so the state
  survives colour blindness. The accessible name also says it: "Wallet,
  $20.00. Cash drip ready to collect."
- **Where the other currency and the drip state live:** in the **wallet
  sheet**, opened by tapping the chip.
- **Every other route:** no chip. #137 renders the slot on home only, and
  this issue doesn't widen that.

### Wallet sheet (`wallet-sheet`) (criterion 2)

A modal bottom sheet in #119's language:
- drag handle, 12px top corners, scrim, and a 44px close button;
- `role="dialog"`, labelled "Wallet";
- max-width 26rem, centred at wide widths.

From top to bottom:

1. **"Wallet"**, with the kicker "Play money. San Francisco orders spend
   dollars."
2. **The current city's balance, set large:** 2.5rem, weight 800,
   letter-spacing −0.03em, tabular numerals. This is the page's one piece of
   real typographic contrast, about 3.3× the chip's size.
3. **The other city's balance** on one quiet row: city name muted on the
   left, amount in text colour on the right, a hairline above.
4. **The drip card**, on `--color-surface` with 12px radius. It takes one of
   three named states (below).
5. **The account line:** "Signed in with Google · email", muted 12px, plus a
   **Sign out** text button (44px target, `nowrap`).

#### The drip's three states

| Criterion 2 name | Engineer noun | What the card shows |
|---|---|---|
| **available now** | `drip available` | Eyebrow "CASH DRIP · READY NOW" in accent. "$5.00 and 100.000 ₫, both in one tap." **One** full-width button, "Collect $5.00 + 100.000 ₫" (48px, accent fill). Fine print: the three window times and "A missed drip doesn't carry over." |
| **just collected** | `drip just collected` | The button is replaced (not disabled) by an eyebrow with a check icon, "COLLECTED". Then "$5.00 and 100.000 ₫ added to your wallet." and "Next drip at 3:00 PM, in about 5 hours." Both balances above show the new values with an accent `+$5.00` / `+100.000 ₫` delta beside them. The card is `role="status"`, so the credit is announced. The deltas last until the sheet closes. |
| **next window** | `drip claimed` | Eyebrow "CASH DRIP" (muted). "Next drip at 3:00 PM" at 1.375rem/800. Fine print: "In about 5 hours. You've collected this window's drip; drips open at …". No button of any kind. |

While a claim is in flight (`claiming`), the Collect button shows "Collecting…"
and ignores further taps. If the claim fails (`claim failed`), the card stays in
**available now** with one muted line under the button: "Couldn't collect just
now. Try again." If the server says the window was already claimed (another
device), the card goes straight to **next window**.

**Which time zone the time is shown in, and why.** The time is shown in the
**device's own time zone**, formatted with the current city's locale
(`Intl.DateTimeFormat(cityLocale, { hour: 'numeric', minute: '2-digit' })`,
no `timeZone` option). The fine print says so: "your device's time".
- The point of showing a time is to answer "when can I come back?", and only
  the person's own clock answers that. Showing Los Angeles time would make
  everyone outside California do arithmetic, and the HCMC half of the
  audience is the most likely to be elsewhere.
- The *rule* still lives in Los Angeles time. The server returns the next
  window's opening instant (UTC), and the browser only formats it. So a DST
  change moves the displayed local time correctly, without the client doing
  window arithmetic.
- If that instant falls on a different local calendar day, prefix
  "tomorrow" ("Next drip tomorrow at 7:00 AM").
- The relative phrase ("in about 5 hours") is coarse, rounded to the hour
  (or "in under an hour"). It is computed when the sheet opens and never
  ticks.
- The mocks show both cases: the SF mock on a device in Los Angeles (7:00 AM,
  3:00 PM, 11:00 PM), and the HCMC mock on a device in Vietnam, where the same
  windows read 05:00, 13:00, 21:00 during US daylight time.

### Checkout at Place order (criterion 3)

Only the part below the totals changes. Everything above (arrival, drop-off,
instructions, utensils, Offers) is untouched, and the mocks elide it in a
dashed note so the changing part fits one 375px viewport (see
`docs/memory/designer.md` on viewport-sized renders).

- **Sign-in prompt (`sign-in prompt`).** This appears only after a signed-out
  visitor taps Place order, as a modal bottom sheet over checkout.
  - Title: "Sign in to place your order", 1.25rem/800.
  - Body: "Orders spend play money from a wallet. New accounts start with
    $20.00 and 600.000 ₫. Your cart and offers stay as they are."
  - Then **Continue with Google** and **Continue with Apple**. These are
    equal width, equal 40px drawn height, a 46px hit area, capsule shape,
    stacked, and both above the fold at 375px.
  - Then "We keep the email Google or Apple shares with us, to hold your
    wallet. No payment is taken." and a **Not now** text button.
  - Not now, ×, scrim tap and Escape all close the sheet and leave checkout
    exactly as it was, with no note.
- **The Google button** (per the Google branding guidelines):
  - light theme: `#FFFFFF` fill, `#747775` 1px stroke, `#1F1F1F` text;
  - dark theme: `#131314` fill, `#8E918F` stroke, `#E3E3E3` text;
  - 14/20 medium weight, 12px before the logo, 10px between logo and text;
  - the standard four-colour "G" at 18px from Google's own `signin-assets`;
  - "Continue with Google", one of the three approved phrases.
- **The Apple button** (per Apple HIG):
  - black on the light theme, white on the dark theme (HIG: "don't use it on
    black or dark backgrounds");
  - "Continue with Apple", one of the three allowed titles;
  - logo and title the same colour;
  - title at 43% of button height, so 17px on 40px;
  - logo only from Apple Design Resources, with the logo file's height
    matching the button.
  - The mocks' "G" and Apple logo are drawn approximations and must not ship.
- **Why 40px drawn, not 44.** Apple fixes the title at 43% of height. Google
  fixes its title at 14px. At 44px the Apple title is 19px and visibly
  shouted over Google's (first render; see "Critique"). At 40px the gap is
  17 vs 14, which reads as the same weight class. The 44px touch floor
  (`docs/design/46-phone-native.md`) is met by the invisible 3px hit
  extension on each edge.
- **Returned from sign-in (`returned from sign-in`).** After the OAuth round
  trip:
  - the same cart and offers are restored, and the **total is recomputed on
    arrival, never carried over**;
  - a **Pays from wallet** row appears under Total: "$32.00 → $10.56", the
    balance now and after this order;
  - Place order is **not** auto-tapped. The person is one tap away, as #136
    says.
  - If the recompute changed the total (the flash deal lapsed during sign-in,
    the SF mock), a `role="status"` notice sits directly under Total: "Welcome
    back. The flash delivery deal ended while you were signing in, so the total
    is now $21.44 (was $18.95)."
  - If nothing changed (the HCMC mock), the notice is simply "Signed in. Your
    cart and offers are as you left them."
  - If the recomputed total is short, the page arrives in **short balance**
    instead.
- **Short balance (`short balance`).** This applies when signed in and the
  current city's balance is below the total. It is detected on render when
  the balance is known, and also returned by the debit as "insufficient" (for
  example after spending on another device). Both paths draw the same block:
  - `role="alert"`, a 1px `--color-text` outline (the one strong outline on
    the page), 12px radius.
  - The lead is **the shortfall as a number**: "$1.00 short" at 1.75rem/800,
    deliberately larger than the page title.
  - Then "Your wallet has $20.00; this order is $21.00."
  - Then the fix. **With a drip claimed:** "Next drip at 3:00 PM adds $5.00.
    Your cart will wait here." **With a drip available** (the HCMC mock):
    "Today's drip is ready and adds 100.000 ₫, which covers it." plus the
    same Collect button as the sheet. Collecting recomputes the block, which
    disappears if the balance now covers the total.
  - If one drip wouldn't cover it, the sentence says "which isn't enough on
    its own" instead of "which covers it".
  - Place order stays in place, drawn muted with `aria-disabled="true"`.
    Tapping it moves focus to the block, and nothing is deducted.
  - The demo disclosure is hidden in this state only. The block is the
    message at that spot.
- **Sign-in failed or cancelled (`sign-in failed or cancelled`).** This
  covers returning from the provider with an error or cancel, or pressing
  Back out of it. Checkout shows today's form plus one neutral notice above
  the disclosure (surface fill, info icon, not red): "Sign-in didn't finish,
  so nothing was ordered. Your cart is still here; tap Place order to try
  again." Place order is enabled, and the notice clears on the next tap.

### What survives at the narrow width

The narrow width *is* the design. At wide widths every surface keeps the same
26rem column (as #137's mocks do), and sheets centre at that width. Nothing
reflows into columns.

## Named states (criterion 5)

These are the nouns for the engineers (#146, #149). They are named once here
and used verbatim in the mocks' captions. Watch the word "dark": it is **the
wallet being off** (D1). The colour scheme is always called "dark theme".

| State | When | Header `.balance-slot` | Checkout |
|---|---|---|---|
| `dark` | Auth config absent, **or** the wallet RPC unreachable or erroring | **Empty and invisible**: no chip, no placeholder, no border, no error | **Identical to today's**: no prompt, no wallet row, no block (`143-today-checkout-sf-narrow.png`) |
| `signed out` | Wallet on, no session | **Empty and invisible** | Identical to today's until Place order is tapped, then the `sign-in prompt` |
| `loading` | Session exists, wallet RPC in flight | Reserved (#137's 32px min-height), **nothing painted**: no skeleton, no spinner. If it resolves to `dark`, nothing ever appeared. | Place order behaves as `signed in` once resolved. While in flight, a tap waits on it with the existing disabled-on-tap guard. |
| `signed in` | Wallet loaded | Chip with the current city's balance | `Pays from wallet` row under Total |
| `drip available` | Signed in, current window unclaimed | Chip + `+` badge + accent outline | Only inside `short balance` (Collect offered) |
| `drip claimed` | Signed in, current window claimed | Plain chip | Next drip time inside `short balance` |
| `drip just collected` | The moment after a successful claim, until the sheet closes | Plain chip with the new balance | The block recomputes |
| `short balance` | Signed in, balance < total | (unchanged) | The block, with Place order muted |
| `sign-in prompt` | Signed out, Place order tapped | (not on this page) | The sign-in sheet |
| `returned from sign-in` | Back from OAuth with a session | (not on this page) | The recomputed total + wallet row (+ notice) |
| `sign-in failed or cancelled` | Back from OAuth without a session | (not on this page) | The neutral notice, Place order enabled |

**Signed out and dark look the same on purpose.** Neither shows any sign-in
prompt, balance placeholder or error anywhere except in response to a Place
order tap. `dark` doesn't even show that: its Place order is today's.

**Sign-out.** It lives **only in the wallet sheet**, as the last line. There is
no confirmation, because nothing is lost: the wallet stays on the server, and
the cart stays in `localStorage`. After it:
- the sheet closes;
- the header goes to **`signed out`**, meaning an empty, invisible slot;
- focus moves to the city pill;
- a polite live region says "Signed out. Your wallet is saved to your
  account."

On any page other than home, a signed-in person reaches sign-out by going
home. That is acceptable for a demo, and a separate account page would be new
scope.

## Contrast checked (every value from `./scripts/contrast`)

Balance text on the header, as criterion 1 asks. The chip text sits on the
chip's own fill, and that fill sits on the header background, so both pairs
are quoted:

```
$ ./scripts/contrast '#241b33' '#f7f1ff' 4.5     # chip text on chip fill, light theme
14.83
$ ./scripts/contrast '#241b33' '#fbf7ff' 4.5     # chip text on header background, light theme
15.51
$ ./scripts/contrast '#f1e9ff' '#1e1730' 4.5     # chip text on chip fill, dark theme
14.62
$ ./scripts/contrast '#f1e9ff' '#16101f' 4.5     # chip text on header background, dark theme
15.82
```

| Pair | Where | Ratio | Command |
|---|---|---|---|
| Accent outline / badge vs header bg, light | drip chip (non-text, 3:1) | 5.91 | `./scripts/contrast '#6c3ce0' '#fbf7ff' 3` |
| Accent outline / badge vs header bg, dark | drip chip (non-text) | 8.17 | `./scripts/contrast '#b79cff' '#16101f' 3` |
| Badge `+` on badge fill, light | `+` glyph | 6.25 | `./scripts/contrast '#ffffff' '#6c3ce0' 4.5` |
| Badge `+` on badge fill, dark | `+` glyph; also Collect button text | 8.17 | `./scripts/contrast '#16101f' '#b79cff' 4.5` |
| Collect / Place order text, light | white on accent | 6.25 | `./scripts/contrast '#ffffff' '#6c3ce0' 4.5` |
| Eyebrow "READY NOW" / deltas, light | accent text on surface | 5.65 | `./scripts/contrast '#6c3ce0' '#f7f1ff' 4.5` |
| Eyebrow / deltas, dark | accent text on surface | 7.55 | `./scripts/contrast '#b79cff' '#1e1730' 4.5` |
| Muted copy on sheet bg, light / dark | kickers, fine print | 5.62 / 8.40 | `./scripts/contrast '#6b5d85' '#fbf7ff' 4.5` / `'#b7a6d9' '#16101f' 4.5` |
| Muted copy on surface, light / dark | card fine print, muted Place order | 5.38 / 7.76 | `./scripts/contrast '#6b5d85' '#f7f1ff' 4.5` / `'#b7a6d9' '#1e1730' 4.5` |
| Short-balance outline vs bg, light / dark | `--color-text` rule | 15.51 / 15.82 | as the chip rows above |
| Google, light theme | `#1F1F1F` on `#FFFFFF` | 16.48 | `./scripts/contrast '#1f1f1f' '#ffffff' 4.5` |
| Google stroke vs its fill, light | button boundary | 4.53 | `./scripts/contrast '#747775' '#ffffff' 3` |
| Google, dark theme | `#E3E3E3` on `#131314` | 14.47 | `./scripts/contrast '#e3e3e3' '#131314' 4.5` |
| Google stroke vs sheet bg, dark | the button's boundary against `#16101f` (fill vs bg is ~1:1, so the stroke carries it) | 5.85 | `./scripts/contrast '#8e918f' '#16101f' 3` |
| Apple black, light theme | title / button vs sheet bg | 21.00 / 19.85 | `./scripts/contrast '#ffffff' '#000000' 4.5` / `'#000000' '#fbf7ff' 3` |
| Apple white, dark theme | title / button vs sheet bg | 21.00 / 18.62 | `./scripts/contrast '#000000' '#ffffff' 4.5` / `'#ffffff' '#16101f' 3` |

**A pair I rejected on the numbers.** The short-balance block was first going
to carry a `--color-accent-b` (orange) warning rule. That failed:

```
$ ./scripts/contrast '#ff7a45' '#f7f1ff' 3
2.34
contrast: #ff7a45 on #f7f1ff is 2.34, below the 3 required.
```

So the block is text-led: the shortfall number is the signal, and the outline
is `--color-text`. Orange stays the flash deal's colour, which is also what
the direction asked for.

## Motion, focus, accessibility floor

- **Motion:**
  - The sheets rise in 200ms `cubic-bezier(0.2, 0, 0, 1)`, and the scrim
    fades in 150ms linear. This says "on top of, not instead of".
  - The chip's value change on a claim or a debit is an instant repaint, with
    no count-up.
  - Under `prefers-reduced-motion: reduce`, the sheets appear without
    travel, using a 100ms opacity fade only.
- **Focus:**
  - Every focusable element (chip, Collect, Sign out, ×, provider buttons,
    Not now) gets a 2px `--color-accent-a` outline at 2px offset.
  - Opening a sheet focuses its heading, and focus is trapped inside.
  - Closing a sheet returns focus to what opened it: the chip, or Place
    order.
- **Targets:** the chip, close buttons, provider buttons and text buttons are
  all ≥44px hit areas (padding or `::after`, not paint).
- **No colour-only meaning:** drip available = badge shape + accessible name.
  Short balance = the word "short" + a number. Collected = a check icon +
  the word.

## Critique of my own pictures (step 12)

These are what I found by opening the renders, and what changed:

1. **The HCMC drip chip overlapped the city pill.** In the first render of
   `143-wallet-header-hcmc-light-narrow.png`, an inline `+` glyph (14px + 4px
   gap) widened the chip to ~105px against a ~96px column. The pill's right
   edge and the chip's left edge overlapped by ~4px. **Changed:** the glyph
   became an absolutely positioned corner badge that adds no width. The
   re-render shows ~8px clear between pill and chip. This is the single most
   important measurement in the document.
2. **"Sign out" wrapped to two lines** in the sheet, next to a long email.
   **Changed:** `nowrap`, and the email wraps instead.
3. **The sign-in title ran under the × close button.** **Changed:** right
   padding. It then left "order" alone on a line at 1.375rem, so it is now
   1.25rem and fits one line at 375px.
4. **Apple's button shouted over Google's** (19px vs 14px titles at 44px
   tall). **Changed:** 40px drawn height with a hit-area extension (see
   "Why 40px").
5. **The "total changed" notice sat below the wallet row**, so it explained
   the total after the reader had moved on. **Changed:** it now sits directly
   under Total.

Checks I made on the finished renders:
- **Blur test:** the sheet reduces to one big number and one violet bar. That
  is the composition, and it survives.
- **Accent covered:** the header still reads the same (the pill leads), and
  the drip badge still reads as a shape.
- **The element I'd remove:** the relative "in about 5 hours". It stayed
  because people misread a bare time across midnight, and it costs one
  muted clause.

## Mocks and pictures

Every file is self-contained. Nothing imports it, and it never ships. Each is
rendered with `./scripts/design-render` to `-narrow.png` (375×812) and
`-wide.png` (1280×900) beside it.

| Mock | Shows | Criterion |
|---|---|---|
| `143-wallet-header-sf-light.html`, `-sf-dark`, `-hcmc-light`, `-hcmc-dark` | The live row with `drip available`, then `signed in` (drip claimed), `drip available`, a long balance (compact), `loading`, `signed out` / `dark`, at true size | 1, 4, 5 |
| `143-wallet-sheet-available-{sf-light,hcmc-dark}.html` | **available now** | 2 |
| `143-wallet-sheet-collected-{sf-light,hcmc-dark}.html` | **just collected** | 2 |
| `143-wallet-sheet-next-{sf-light,hcmc-dark}.html` | **next window** | 2 |
| `143-wallet-checkout-prompt-{sf-light,hcmc-dark}.html` | `sign-in prompt` | 3 |
| `143-wallet-checkout-short-{sf-light,hcmc-dark}.html` | `short balance`: next drip time (SF), drip available (HCMC) | 3 |
| `143-wallet-checkout-returned-{sf-light,hcmc-dark}.html` | `returned from sign-in`: total changed (SF), unchanged (HCMC) | 3 |
| `143-wallet-checkout-failed-{sf-light,hcmc-dark}.html` | `sign-in failed or cancelled` | 3, 5 |
| `143-wallet-directions.html` | Directions A and B side by side (HCMC, the tightest row) | step 9 |
| `143-today-*.png` | `main` today (`app-render`): what `dark` looks like | 4 |

The sheet and checkout states are drawn in SF on the light theme and HCMC on
the dark theme, not all four combinations. Each other combination is the same
markup with the other token set, and every token pair it would use is in the
contrast table above.

**How these were rendered locally.** `design-render` found no browser on
`PATH`, so a preinstalled Playwright Chromium (`/opt/pw-browsers/…/chrome`)
was symlinked onto `PATH` from outside the repository. `app-render`'s build
also fails inside this worktree ("Tsconfig not found astro/tsconfigs/strict",
because the worktree is nested under a checkout with its own `tsconfig.json`
and no `node_modules`), so it ran from a copy of the tree outside it. Neither
workaround touched the repository.

## For the engineers (not decided here, but named)

- The wallet RPC should return the **next window's opening instant** along
  with the balances and the claimed flag, so the browser only formats time
  (#145).
- Treat any RPC failure or timeout during `loading` as `dark`. It looks the
  same, which is the point of D1.
- `order_placed`, `checkout_viewed` and every other event are unchanged here
  (the #79 rule). This document adds no tracking.
- **Start over (ADR 0004)** is the ADR's call. Nothing in these surfaces
  depends on the answer.
