# Roadmap: what to build next, and how the data should decide

**Status:** draft for the soft launch (2026-09-29). Nothing below is committed.
The point of this page is that the order is **not decided yet**. Learners are
invited to read the site's data and argue for one.

## Why this page exists

Dontdropthatpromo is a parody food-delivery app. Every screen fires a real
event at a hosted Postgres store (ADR 0005, `docs/decisions/0005-hosted-event-store.md`),
so there is a real aggregate to read, not a simulated one. This roadmap uses
that data the way a product team does:

1. **Discover.** Read the funnel, retention and feature numbers. Find where
   people drop off, and what brings them back.
2. **Ideate and prioritise.** Weigh the candidate directions below against
   that evidence, and recommend an order.
3. **Design.** The chosen direction gets a spec and mocks (see `docs/design/`
   for every earlier one) before any code.
4. **Ship and measure.** Once it launches, read the same metrics again. Did the
   feature move the metric it was chosen to move, and did it break anything
   else?

Every step leaves a public trail in this repository: issues, specs, pull
requests, and decision records. You can follow any feature from "someone had
an idea" to "here is what the numbers did".

## The product today

The whole loop, in three cities (San Francisco, Los Angeles, Ho Chi Minh City):

- **Home feed:** a promo carousel, restaurant tiles, and a timed flash-deal
  sheet with 5-6 random restaurants.
- **Menu → cart → checkout:** checkout has vouchers and offers, and asks you to
  sign in (Google or Apple) only when you press Place order.
- **Play-money wallet:** every account gets a starting balance plus a drip of
  coins three times a day. No real payment is ever taken.
- **Tracker:** a simulated delivery with a driver, then rating the restaurant
  and the driver, tipping, VIP levels (Gold, Platinum), and a thanks voucher
  for the next order.

## What we can measure

The event contract is `docs/measurement/219-analytics-readiness-contract.md`.
The queries are `docs/measurement/219-launch-queries.sql`, one per metric:

| Area | Metric | What it tells you |
|---|---|---|
| Traffic | M1 visitors per day, M2 sessions per day | Volume. Never compare cities or sources on raw counts. |
| Retention | M3 returning visitors | Does anyone come back? |
| Conversion | **M4 home-to-order funnel** (the primary metric is checkout conversion), M5 the same funnel by city | Where people drop off. |
| Acquisition | M6 by source (e.g. LinkedIn), including first-touch conversion | Which channel brings people who order. |
| Fulfilment | M7 completion, M8 rating rates | Do orders reach the end of the loop? |
| Sign-in and wallet | M9 sign-in wall, M10 wallet-paid share, M11 short-balance recovery | What the sign-in step and the wallet cost in orders. |
| Engagement features | M12 tips, M13 VIP mix, M14 thanks voucher, M15 vouchers, M16 flash deal, M17 city switching | Whether each feature gets used. |

**Not measured, on purpose.** The contract's §10 lists these: carousel slides,
scrolling, add-to-cart taps, opening the wallet sheet, and more. For each one
it says why. Part of the exercise is deciding whether a direction below needs
one of them.

**No A/B tests yet.** Every event has `variant = null`. Until an experiment
ships, a launched feature is judged **before against after**, with the
guardrails in the contract's §12. See "How we will judge a launch" below.

## North star and target metrics

- **North star: weekly visitors who complete an order.** It combines the three
  things a direction can move: reach (M1, M6), conversion (M4), and coming back
  (M3).
- **Input metrics a direction can target:**
  - checkout conversion (M4);
  - returning share (M3);
  - first-touch conversion by source (M6c);
  - orders per returning visitor.
- **Business metric**, for the directions that earn money: revenue per 1,000
  visitors. This is new, and needs its own events (see each direction).
- **Guardrails**, which must not get worse: checkout conversion, completion
  (M7), and the privacy rule that no email, account or wallet field ever
  enters an event (ADR 0008, the #79 rule).

## Candidate directions

Five candidates. The first three are the owner's own ideas, already written up
as issues. The last two were added in drafting because the existing data speaks
to them directly. Each one says what it would target and what the current data
can and cannot tell you about it.

### A. Pro mode: a paid monthly subscription (#200)

- **What:** real money buys double coin drips plus a monthly coin bonus, worth
  4-5x a free account's coins.
- **Targets:** revenue, and retention among committed users.
- **What the data can show now:**
  - How many visitors come back often enough to want more coins (M3).
  - How often a short balance blocks an order, and whether people recover (M11).
  - Whether VIP levels show a group of heavy users (M13).
- **What it can't show:** willingness to pay. Nothing on the site asks for
  money today.
- **Cost:** high. It needs a payment provider, a server-side webhook, a new
  decision record (the site has no server of its own today), and new copy,
  because "no payment is ever taken" stops being true.
- **Question for learners:** if M11's short-balance rate is near zero, is
  anyone short of coins? What would that mean for Pro's demand?

### B. Social: referrals, a friends list, and sending an order to a friend (#201)

- **What:** give-X-get-X coins when a referred friend orders. Friend
  requests. An order sent to a friend, who gets an email.
- **Targets:** acquisition (new visitors from referrals) and retention.
- **What the data can show now:**
  - The size of the pool that could refer: visitors who completed an order.
  - The share of traffic that is already word of mouth (M6, sources other than
    LinkedIn).
  - How much of the traffic comes back at all (M3). A referral loop needs
    people who return.
- **What it can't show:** whether anyone would share. No share action exists.
- **Cost:** high. Email needs a sender and a server, Apple's private relay
  needs extra setup, and a referral payout needs a server-side record of a
  first order.
- **Question for learners:** how many completed orders a week does a referral
  loop need before it adds visitors you would notice in M1?

### C. Real ads in the promo carousel (#204)

- **What:** one carousel slide becomes a real, labelled affiliate ad (for
  example, an analytics course), in place of an in-house mock ad.
- **Targets:** revenue. Guardrail: the home feed's click-through into a
  restaurant must not drop.
- **What the data can show now:** home-page reach (M4 step 1) and the drop
  from home to a restaurant, which is the ad's audience and what it competes
  with.
- **What it can't show:** carousel impressions or taps. Neither is logged (§10).
  The research in `docs/research/204-affiliate-partners.md` expects about
  0.01-0.15 sales a month at soft-launch traffic.
- **Cost:** low. One static image slot, no script and no cookie. Research and a
  design spec are done.
- **Question for learners:** with that expected revenue, is the carousel slot
  worth more as an ad or as a promo that drives orders? What would you need to
  log to answer that?

### D. A lighter sign-in step (added in drafting)

- **What:** let people place their first order before signing in, for example
  with a guest wallet, and ask for an account at a later moment such as tipping
  or the second order.
- **Targets:** checkout conversion (M4), the primary metric.
- **What the data can show now:** almost everything. M9 measures, for each
  session that saw the sign-in sheet, the share that started signing in, the
  share that finished, and the share that then ordered. M4 shows how big the
  checkout-to-order drop is next to every other step.
- **Cost:** medium. It touches the wallet's rules (ADR 0008), but needs no new
  server.
- **Question for learners:** if M9 shows most people who see the sign-in sheet
  never order, how many extra orders a week would removing it be worth, and
  what does it put at risk?

### E. More content: a fourth city or bigger menus (added in drafting)

- **What:** use the existing content procedure (`docs/content-run.md`) to add
  another city, or more restaurants in the current three.
- **Targets:** reach (M1, M6) and conversion in the new market (M5).
- **What the data can show now:** conversion by city (M5), and how often
  visitors switch city (M17). Los Angeles, added last, is a before-and-after
  case study already.
- **Cost:** low. The procedure is written down and has been run once.
- **Question for learners:** did adding Los Angeles move anything other than
  LA's own row in M5?

## The learner exercise

Recommend an order for A-E, and defend it with the data.

1. **Pull the numbers.** Start with M4 (the funnel), M3 (retention), M6
   (sources), M9 (sign-in) and M11 (short balance).
2. **Size each direction.** Use a simple score such as RICE: Reach × Impact ×
   Confidence ÷ Effort. Take Reach from the data, not from a guess. Say which
   metric each direction would move, and by roughly how much.
3. **State your confidence honestly.** The launch is small. Say how many
   visitors or orders your conclusion rests on, and what result next month
   would change your mind.
4. **Name what's missing.** If a direction can't be judged without a new event,
   name the event and the decision it would serve. That is how this project
   adds tracking (the contract's §10 is the model).
5. **Pick one to go first,** with the metric it should move and the guardrail
   it must not break.

Post your recommendation as a comment on the LinkedIn post, or open a GitHub
issue in this repository. The direction that goes first gets built in public,
and its results are published against your predictions.

## How we will judge a launch

- **Before it ships:** write down the target metric, the expected change, the
  guardrails, and the date the "after" window closes.
- **Measure before against after**, over windows of equal length, with the
  owner's own traffic excluded (`events_clean`). Split by city and source, so a
  change in who is visiting isn't mistaken for the feature working.
- **Report the counts behind every rate.** 3 orders out of 20 visitors is not
  a 15% conversion rate anyone should act on.
- **Tracking comes after the feature (the #79 rule).** A direction ships the
  product first. Its events arrive in a follow-up readiness pass, so some
  numbers for a new feature start a little after launch.
- **Later:** once traffic can support it, the first A/B test adds an exposure
  event and its own contract revision (see the contract's §1).

## Before learners can do this

- **Data access.** The store is write-only for browsers: the public key can
  insert events and cannot read them (ADR 0005). Learners need a published
  extract: a regular anonymised export of `events_clean`, or a read-only
  dataset, plus the schema. This is the first thing to build for the
  exercise.
- **A data cut-off date,** so everyone analyses the same snapshot.
- **A starter notebook or query pack,** probably
  `docs/measurement/219-launch-queries.sql`, adapted to run on the extract.
