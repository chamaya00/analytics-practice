# ADR 0008: Google and Apple sign-in, and a play-money wallet guarded in Postgres

Date: 2026-09-27
Status: proposed

Research: `docs/research/142-sign-in-and-wallet.md` (#142). Objective: #136.

**Numbering.** #144 also writes an ADR "at the next free number". 0008 was the next free number on `main` when this was written. Whichever of the two merges second takes 0009 and updates its own references. The number is not load-bearing anywhere else.

## Context

Objective #136 gives visitors a play-money wallet in USD and VND:

- sign-in with Google or Apple, asked for only at **Place order**;
- a one-time preload of $20.00 and 600.000 ₫;
- a drip of $5.00 and 100.000 ₫, once per window, in three daily windows on Los Angeles time;
- orders that spend the wallet exactly once.

Until now the site has had **no user identity**. The only "who" is an anonymous `parody.visitorId` in `localStorage` (`src/lib/order-store.ts:70`). It has had **no per-user server data**: ADR 0005's `events` table is insert-only, anonymous and unreadable from outside. This ADR adds the first of both.

That changes a category in three places:

1. **ADR 0001** says per-visitor state lives "entirely in `localStorage`". It will not.
2. **ADR 0005** describes the Supabase project as one anonymous, insert-only table. It gains Supabase Auth, the `authenticated` role, and tables a user can read their own row of.
3. **A first client library from a new ecosystem** (`@supabase/supabase-js`) and **new outbound destinations**: Google's and Apple's sign-in pages (reached by navigation) and the project's `/auth/v1/*` endpoints.

Decisions already made on #136, which this ADR records rather than revisits:

- **D1** (driver, 17:31Z): the wallet ships dark. Checkout behaves exactly as today whenever auth or the wallet store is unconfigured or unreachable.
- **supabase-js is pre-approved** (owner, 17:35Z). This ADR is still required, and the pull request that adds it still goes to the owner.
- **D8** (driver, 18:25Z): the browser-supplied debit amount is a named limitation. The debit is idempotent per `orderId` and refuses amounts ≤ 0, amounts over the balance, and amounts under a per-city floor.

## Decision

### Identity and the build

- **Supabase Auth**, in the same Supabase project as ADR 0005.
- Providers: **Google and Apple**, through the **OAuth redirect flow with PKCE** (`flowType: 'pkce'`; the library default is implicit, so it must be set).
- The round trip:
  1. Place order navigates the browser to `https://<ref>.supabase.co/auth/v1/authorize?provider=google|apple&redirect_to=<site>/checkout/?restaurant=<slug>`.
  2. Supabase sends the visitor to the provider.
  3. The provider returns to `https://<ref>.supabase.co/auth/v1/callback`.
  4. Supabase redirects to our `redirect_to` with a single-use, five-minute `code`.
  5. The browser exchanges the code with the verifier it kept in `localStorage`.
- **ADR 0001's static output with no adapter is unchanged.** No function, adapter or server of ours takes part.
- **The site's first user identity** is the Supabase `auth.users.id` (a uuid). Events stay keyed to the anonymous `visitor_id`. No user id, email or wallet field is added to any event (the #79 rule). Linking the two is the analytics-readiness objective's call.
- Nothing depends on the email Apple returns (it may be a private-relay address), or on the name Apple returns only on first sign-in. Neither is stored by us. Supabase keeps whatever email the provider gives in `auth.users`.
- **Accounts can split.** Supabase links identities with the same verified email automatically. So Google then Apple with the same real email is one account and one wallet. Apple with "Hide My Email" is a separate account with its own preload. That is accepted for play money.

### Client

- **`@supabase/supabase-js`**, pre-approved by the owner on #136 (comment of 2026-09-27 17:35Z).
- The pull request that adds it **still goes to the owner as this project's first client library from a new ecosystem**, whatever the merge policy says. Its body names the dependency and the new outbound destinations (house rules, "What a revert does not undo" #3 and #5).
- It is loaded by **dynamic `import()`**, only when the build flag below is on and a page needs it. With the flag off, the bundle a visitor downloads is unchanged.
- It is wrapped behind one small module of our own, with an injectable client or `fetch`, the way `tracking-transport.ts` takes `fetchImpl`. CI tests stub it and need no secrets. The build succeeds with every new variable absent.
- The events transport stays plain `fetch` and is not touched.
- Sign-out uses `signOut({ scope: 'local' })`. The library's default is global, which would end the user's sessions on their other devices too.

### D1, as a rule: when the wallet is on, and what "unreachable" does

**The wallet is on for a page view only when all three hold:**

1. **The build flag is on:** `PUBLIC_WALLET_ENABLED` is `true`. The owner sets it last, after the setup below. The existing Supabase URL and key cannot be this signal, because they are already set in production for events.
2. **At least one of Google and Apple is enabled:** `GET /auth/v1/settings` shows `external.google` or `external.apple` as `true`, and only those buttons are shown.
3. **The migration is applied:** `public.wallet_ready()` (anonymous, no arguments, returns `true`) answers.

Checks 2 and 3 run in parallel when checkout loads, with a 3-second timeout. If they have not both answered when Place order is tapped, that tap is treated as **off**.

**When the wallet is off, Place order does exactly what it does today:** no sign-in prompt, no balance check, no block, no debit, and `order_placed` fires as today.

**When the wallet is on:**

- **Signed out:** Place order persists the checkout choices (see Consequences) and opens the sign-in prompt. After sign-in the visitor is back on `/checkout/?restaurant=<slug>`, and the total is recomputed, not trusted.
- **Signed in:** Place order calls `wallet_debit`. What happens next depends on the answer:

| The debit's answer | What happens |
|---|---|
| `debited` or `already_debited` | The order is written locally, `order_placed` fires, and the visitor goes to `/order-placed/`. |
| `insufficient` | Blocked. Nothing is deducted, and no order or event is written. The visitor sees the shortfall and when the next drip opens. |
| Refused for a definitive reason (below the floor, conflicting `order_id`, not authenticated) | Blocked, with a message. No order is written. |
| **Unreachable**: network error, timeout (8 s), HTTP 5xx, or a session that cannot be refreshed | **D1 fallback: place the order as today, without a debit.** |

- **Only a definitive answer from the database blocks an order. An unreachable store never does.**

### Source of truth when the local order and the server debit disagree

- **The server's debit ledger is the truth about money. The local order is the truth about the order.** They are allowed to disagree in exactly two ways:
  - **A local order with no debit.** The order was placed while the wallet was off or unreachable (D1). It stands, and it is never charged afterwards.
  - **A debit with no local order.** The debit committed but the response was lost, or the tab closed. The `orderId` is created *before* the debit, at the first tap, and kept in `sessionStorage` under a per-restaurant pending key until the local order is written.
    - A retry reuses it and gets `already_debited`, and only then is the order written.
    - If the visitor never comes back, the money is spent with no order. That is accepted as play money.
- This means `orderId` generation moves out of `placeOrder` (`order-store.ts:391`): #149 passes the pre-made id into #144's `placeOrder`.

### "Start over" (ADR 0004)

- There is no start-over control wired in the parody today (`clearOrder` is unwired; `order-store.ts:414`).
- If one returns, it clears only the `parody.*` keys it names. It **does not sign the user out**, because signing out is its own control (#136 done-item 6). It must never call `localStorage.clear()`, which would also delete the `sb-<ref>-auth-token` session.
- **Nothing a browser can call resets a wallet.** No client-callable function lowers a balance except `wallet_debit`, and none resets one.

### Data: tables and RLS

All amounts are integer minor units: cents for USD, whole đồng for VND (`src/lib/money.ts`).

- **`public.wallets`**
  - Columns:
    - `user_id uuid primary key references auth.users(id) on delete cascade`;
    - `usd_minor bigint not null check (usd_minor >= 0)`;
    - `vnd_minor bigint not null check (vnd_minor >= 0)`;
    - `created_at timestamptz not null default now()`.
  - `enable row level security`.
  - One policy: `for select to authenticated using (user_id = (select auth.uid()))`. **A user reads only their own row.**
  - `revoke all on public.wallets from anon, authenticated`, then `grant select on public.wallets to authenticated`. **No client role can insert, update or delete a wallet directly.** Only the functions below change it.
  - RLS is enabled but not `force`d, so the `security definer` functions (owned by the table owner) can write it. That is deliberate, and it differs from `events`.
- **`private.wallet_claims`**: `user_id uuid not null references auth.users(id) on delete cascade`, `window_start timestamptz not null`, `claimed_at timestamptz not null default now()`, `primary key (user_id, window_start)`. The key is what makes "one claim per window" a database fact.
- **`private.wallet_debits`**: `order_id uuid primary key`, `user_id uuid not null references auth.users(id) on delete cascade`, `currency text not null check (currency in ('USD','VND'))`, `amount_minor bigint not null check (amount_minor > 0)`, `debited_at timestamptz not null default now()`. The key is the idempotency key.
- `private` is the schema ADR 0005's migration already created. The Data API does not expose it, and `anon` and `authenticated` have no usage on it.

### Functions

Every public wallet function is:

- `security definer`, `set search_path = ''`, with every relation schema-qualified;
- stripped of the default grants: `revoke execute ... from public, anon` (Supabase grants new `public` functions to `anon` and `authenticated` by default);
- granted back only to the role named below;
- run as one transaction per call (one PostgREST request).

Each one checks these itself:

- `auth.uid()` is not null, otherwise it raises `not_authenticated`.
- The caller is not an anonymous-auth user: `coalesce((current_setting('request.jwt.claims', true)::jsonb ->> 'is_anonymous')::boolean, false)` is false. Anonymous sign-ins stay disabled in the dashboard; this is the belt to that brace.
- It first calls `private.ensure_wallet(uid)`, which does `insert ... values (uid, 2000, 600000) on conflict (user_id) do nothing`. **The preload happens exactly once per account, on whichever wallet call comes first.** There is no trigger on `auth.users`.

| Function | Arguments | Granted to | Checks, in the function itself | Returns (`jsonb`) |
|---|---|---|---|---|
| `public.wallet_ready()` | none | `anon`, `authenticated` | none: security invoker, reads nothing | `true` |
| `public.wallet_get()` | none | `authenticated` | `auth.uid()`; not anonymous; ensures the wallet | `usd_minor`, `vnd_minor`, `window_start`, `next_window_start`, `claimed_this_window` |
| `public.wallet_claim_drip()` | none | `authenticated` | `auth.uid()`; not anonymous; ensures the wallet; **the window**, from `now()` only; one claim per window through `insert ... on conflict do nothing` on `(user_id, window_start)`; credits 500 and 100000 only if that insert happened | `claimed` (bool), balances, `next_window_start` |
| `public.wallet_debit(p_order_id uuid, p_currency text, p_amount_minor bigint)` | order id, `'USD'`/`'VND'`, amount | `authenticated` | See the debit steps below | `status` (`debited` / `already_debited` / `insufficient`), balances, `next_window_start` |

`wallet_debit` checks, in this order:

1. `auth.uid()` is not null, and the caller is not anonymous.
2. `p_currency` is `USD` or `VND`.
3. `p_amount_minor > 0`.
4. `p_amount_minor >= private.debit_floor_minor(p_currency)`.
5. **`order_id` idempotency.** If a row for `p_order_id` exists:
   - it belongs to the caller: return `already_debited` with the recorded amount, and change nothing (a new amount on a retry is ignored);
   - it belongs to someone else: raise `order_id_conflict`.
6. Ensure the wallet, then lock it with `select ... for update`.
7. **The balance.** If the currency's balance is less than the amount: return `insufficient`, and change nothing.
8. Otherwise subtract and insert the debit row, in the same transaction.

The checks in steps 1-4 and the `order_id_conflict` case raise errors. The two outcomes a user can act on (`already_debited` and `insufficient`) are return values, so the client can tell "short of money" from "broken".

Private helpers are in `private`, have no grant to `anon` or `authenticated`, and are called only by the functions above or by tests running as the owner:

- `private.ensure_wallet(uuid)`.
- `private.debit_floor_minor(text)`: `USD` → **399**, `VND` → **20000**. This is D8's floor, hard-coded. SF's cheapest item is 300 and its lowest delivery fee is 99. HCMC's are 10,000 and 10,000 (`src/lib/restaurants.ts`).
- `private.drip_window_start(p_at timestamptz)`.
- `private.drip_next_window_start(p_at timestamptz)`.

**No client-callable function accepts a caller-supplied time.** The only functions with a time argument are the two `private.drip_*` helpers, which no client role can execute. `wallet_claim_drip` and `wallet_get` pass them `now()`. #145's tests assert this from the catalog rather than by reading the SQL: any function `anon` or `authenticated` can execute must have no argument of a date or time type.

### Drip windows

- The windows are local `America/Los_Angeles` time: **[07:00, 15:00), [15:00, 23:00) and [23:00, 07:00)**, each half-open.
- `drip_window_start(t)`:
  1. Take `l = t at time zone 'America/Los_Angeles'`.
  2. Pick the latest boundary at or before `l`: today's 23:00, 15:00 or 07:00, or yesterday's 23:00 if `l` is before 07:00.
  3. Convert it back with `at time zone 'America/Los_Angeles'`.
- None of the three boundaries falls in the hour DST skips or repeats, so the conversion is never ambiguous.
- Functions using a named zone are `stable`, not `immutable`.

**Expected values the engineer's tests must assert.** These are stated here as expected values, not as run results:

| Instant passed in (UTC) | `window_start` | `next_window_start` | Real length |
|---|---|---|---|
| 2026-11-01 06:30Z (Sat 2026-10-31 23:30 PDT) | **2026-11-01 06:00Z** (Oct 31 23:00 PDT) | **2026-11-01 15:00Z** (Nov 1 07:00 PST) | **9 hours** |
| 2027-03-14 08:00Z (Sun 2027-03-14 00:00 PST) | **2027-03-14 07:00Z** (Mar 13 23:00 PST) | **2027-03-14 14:00Z** (Mar 14 07:00 PDT) | **7 hours** |
| 2026-10-01 14:00Z (07:00 PDT exactly) | 2026-10-01 14:00Z (the boundary starts its own window) | 2026-10-01 22:00Z | 8 hours |

Tests compare `timestamptz` values and `interval`s, never formatted strings. They must be seen failing once (house rules), because PGlite's zoneinfo for `America/Los_Angeles` is inferred, not yet run (research, finding 3).

### How ADR 0006's PGlite tests stub `auth`

PGlite has no `auth` schema and no `authenticated` role. The wallet test applies a **test-only fixture** first, then both existing migrations unchanged, then the wallet migration. The fixture:

- `create schema auth;`
- `create table auth.users (id uuid primary key);`
- `create function auth.uid() returns uuid language sql stable as $$ select nullif(coalesce(current_setting('request.jwt.claim.sub', true), (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')), '')::uuid $$;`

  This is Supabase's own definition, verbatim (`supabase/auth` migration `20211202183645_update_auth_uid.up.sql`).
- `create role authenticated nologin;` (`anon` already comes from the events migration).

A test acts as a user by:

1. inserting that user's id into `auth.users`;
2. running `select set_config('request.jwt.claims', '{"sub":"<uuid>"}', false)`;
3. running `set role authenticated`.

**The stub never goes in the migration.** A `create or replace function auth.uid()` there would overwrite Supabase's own function on the live project. The wallet migration assumes `auth.users`, `auth.uid()` and `authenticated` exist, as they do on Supabase.

The `events` migrations are not edited (ADR 0007's additive rule).

### D8: the debit amount comes from the browser

**The server does not check the amount against the order.** It has no catalogue and no cart. It checks only that the amount is > 0, is at least the per-city floor (399 cents, 20,000 ₫), and is not more than the balance.

**So a user editing requests can pay less than the checkout total**, down to the floor: for example $3.99 for a $40 order. This is a limitation against #136's done-looks-like item 5 ("can't... skip a debit"). The driver has accepted it as D8.

A debit cannot be skipped outright by lying about the amount (the floor), but it can be skipped by making the store unreachable. See Consequences, D1's price.

Fully guarded, whatever the browser sends:

- minting money;
- claiming a drip twice in one window;
- a second debit for one `orderId`;
- reading or changing another user's wallet.

The floor is safe for legitimate orders today: the smallest real totals are 450 cents in SF and 30,000 ₫ in HCMC (research, finding 5).

## Consequences

**Easy:**

- Money rules live in one place a request cannot skip.
- The static build, CI and preview deploys are unchanged and need no secret.
- Signed-out visitors and every visitor before the owner flips the flag see today's site, byte for byte, and make no new requests.
- Supabase Auth's 50,000 MAU on the Free plan is far above this site's scale.

**Hard:**

- **D1's price.** A signed-in user who blocks the Supabase host can place orders without a debit, because unreachable means "as today". That is a second route past done-item 5, alongside D8's amount. It is accepted because the money is play money and D1 is the driver's rule, but it is stated here so nobody mistakes it for an oversight.
- **Ordering now waits on Supabase for signed-in users.** The pause after a week of inactivity turns into the D1 fallback, not an outage.
- **The OAuth round trip is a full-page navigation.**
  - The three checkout choices (drop-off, instructions, utensils) are in memory only (`checkout-dom.ts:63`). #149 must persist them to `sessionStorage` before leaving.
  - The cart, applied offers (localStorage) and flash draw (sessionStorage) survive.
  - The flash window can expire meanwhile. The total is recomputed on return, as every render already does.
- **The floor is a copy of the catalogue.** A cheaper item or a lower service fee can make it refuse a real order. #145 adds a test comparing the migration's floor constants with `restaurants.ts` and `money.ts`.
- **Existing events, stated and not fixed** (the #79 rule):
  - While the wallet is on, `order_placed` goes quiet for signed-out visitors. It fires only after a successful debit, never for an `insufficient` block. It still fires in the D1 fallback.
  - `checkout_viewed` fires **twice** for a checkout that includes a sign-in round trip, because the return is a fresh page load.
  - Checkout-to-order conversion drops by whoever abandons at sign-in or a short balance. That is real, not a bug.

**Changes to earlier ADRs:**

- **ADR 0001.** Its static output with no adapter **stands**. Its Decision's "per-visitor state... lives entirely in `localStorage`" **no longer holds**: the wallet balance and drip and debit history are per-user server state in Supabase Postgres. Cart, orders, city and offers stay in `localStorage` (#144 keeps order history device-local).
- **ADR 0005.** The `events` table, its grants, its RLS and its bounds are **unchanged**. The project is no longer anonymous-only and insert-only:
  - it runs **Supabase Auth**;
  - the Data API now also receives requests carrying a user JWT (the `authenticated` role);
  - `authenticated` can read exactly one row of one table (its own wallet) and execute three functions;
  - `anon` gains exactly one executable function, `wallet_ready()`.
  - The "only the publishable key in the client" rule is unchanged.

**New outbound destinations** (named for the owner on the pull requests that add them):

- `https://<ref>.supabase.co/auth/v1/*` (same host as today, new paths);
- `accounts.google.com` and `appleid.apple.com`, reached by page navigation, not by script from our pages.

**Needs a person:** the owner setup below. No agent can do it.

**Recurring owner task: Apple's client secret.**

- For the web OAuth flow, Apple's client secret is a signed token that **expires after at most six months**.
- When it lapses, Apple sign-in starts failing: the visitor taps "Continue with Apple", goes to Apple, and comes back to checkout with a sign-in error instead of being signed in.
- Google sign-in keeps working, and nothing else on the site changes.
- D1's fallback does **not** cover this, because auth is configured and the wallet answers. A signed-out visitor who will only use Apple cannot place an order until the secret is renewed. #146 or #149 should say so on the error ("Apple sign-in isn't working right now; try Google"), not fail silently.
- The owner renews it (setup step 13) and puts a reminder five months after each renewal.

**Flips if:**

- **Apple's secret lapses in practice, or the owner declines the chore:** move Apple alone to Sign in with Apple JS plus `signInWithIdToken`, which needs no secret. Google stays on the redirect. Nothing about the wallet changes.
- **supabase-js measures more than about 40 KB gzip heavier on `/checkout/` than `@supabase/auth-js` alone:** use auth-js for sessions and plain `fetch` for the three RPCs.
- **Supabase's Free plan stops covering auth at this scale:** Supabase third-party auth with another identity vendor. RLS moves from `auth.uid()` to `auth.jwt()->>'sub'`.

## Alternatives rejected

- **Plain `fetch` against the Auth and Data APIs, with no library.** The three wallet calls would be safe as `fetch`. The session would not be: refresh tokens are single-use, and a reuse outside a 10-second window revokes the whole session. So cross-tab refresh needs the single-flight coordination supabase-js already carries, and getting it wrong signs a user out mid-checkout.
- **`@supabase/auth-js` plus `fetch` for the wallet.** Smaller, and its wallet calls would read like `tracking-transport.ts`. It lost narrowly: its size advantage is unmeasured, and it is not the package the owner approved by name. It is the first flip condition above.
- **Implicit flow (the library default).** It returns tokens in the URL. PKCE returns a single-use code that is useless without this browser's verifier.
- **Provider JS buttons plus `signInWithIdToken` for both providers.** It removes Apple's secret chore and the page navigation, but it adds two third-party scripts to our pages. Apple JS's popup mode also has a public record of failing on Safari and in iOS web views, and Google's button is mid-migration to FedCM.
- **A separate identity vendor (Clerk, Firebase Auth, Auth0) via Supabase third-party auth.** A second vendor, SDK and dashboard, for sign-in Supabase Auth already does. Their free tiers are 50,000 retained users, 50,000 MAU and 25,000 MAU respectively (secondary sources, research doc).
- **A wallet keyed to the anonymous `visitor_id`.** It fails cross-device balances (done-item 2), and clearing storage mints $20 (done-item 5).
- **Creating the wallet in a trigger on `auth.users`.** A failing trigger fails the sign-up itself, and PGlite would need a fuller `auth` stub to test it. Lazy creation in `ensure_wallet` is idempotent by primary key.
- **Checking the debit amount on the server.** It would need the catalogue, vouchers, flash draw and cart on the server: server-side pricing. D8 rules it out.
- **Email and password, magic link, passkeys, anonymous sign-in, phone, as a third method.** See the research doc's conclusion. Only GitHub is recommended, and only if the driver says yes on #136.

## Owner setup

For the owner, in order. Each step is done once unless it says otherwise. You need three things to hand:

- your **site address** (Vercel → your project → Domains, for example `https://your-site.vercel.app`), called SITE below;
- your **Supabase project reference** (Supabase → Project Settings → General → Reference ID), called REF below;
- your Apple Developer **Team ID** (developer.apple.com → Account → Membership details).

**Google (about 10 minutes)**

1. Go to console.cloud.google.com and create a project (or pick one).
2. Open **Google Auth Platform**. Under **Branding**, enter an app name and your support email. Under **Authorized domains**, add `supabase.co` and your SITE's domain. Under **Audience**, choose **External** and **publish** the app. Only the basic scopes (`openid`, email, profile) are used, which Supabase requires.
3. Under **Clients**, choose **Create client** → **Web application**.
   - **Authorized JavaScript origins:** add SITE, and `http://localhost:4321` if you want sign-in to work in local development.
   - **Authorized redirect URIs:** add `https://REF.supabase.co/auth/v1/callback`.
   - Click **Create**.
4. Copy the **Client ID** and **Client secret**. Keep the secret out of the repository; it goes only into Supabase.

**Apple (about 20 minutes; your membership already covers it)**

5. developer.apple.com → Certificates, Identifiers & Profiles → **Identifiers**. If you have no App ID with **Sign in with Apple** enabled, create one: **+** → App IDs → App, with any bundle id such as `com.yourname.parody`, and tick **Sign in with Apple**.
6. **Identifiers → + → Services IDs.** Give it a description and an identifier such as `com.yourname.parody.web`. **This identifier is your Services ID.** Register it.
7. Open that Services ID, tick **Sign in with Apple**, and click **Configure**.
   - Primary App ID: the one from step 5.
   - **Domains and Subdomains:** `REF.supabase.co`.
   - **Return URLs:** `https://REF.supabase.co/auth/v1/callback`.
   - Save, then Continue and Save again.
8. **Keys → +.** Name it, tick **Sign in with Apple**, click **Configure**, pick the App ID from step 5, and register. **Download the `.p8` file now.** Apple lets you download it once. Note the **Key ID**. Keep the `.p8` somewhere safe outside the repository.
9. Generate the client secret. Use the generator on Supabase's "Login with Apple" guide, or any Apple client-secret tool, with your Team ID, Key ID, Services ID and the `.p8`. The result is a long token. **It expires in at most six months** (see step 13).

**Supabase (about 5 minutes)**

10. Supabase → your project → **Authentication → Sign In / Providers.**
    - **Google:** enable it, and paste the Client ID and Client secret from step 4.
    - **Apple:** enable it. Put the **Services ID** from step 6 in **Client IDs**, and the token from step 9 in **Secret Key (for OAuth)**.
    - Leave **anonymous sign-ins** off. Leave **email** sign-in as it is; no email method is used.
11. **Authentication → URL Configuration.**
    - **Site URL:** SITE.
    - **Redirect URLs:** add `SITE/**`. Add `http://localhost:4321/**` for local development. For preview deploys, optionally add `https://*-<your-vercel-team>.vercel.app/**`.
12. **Apply the migration.** Once #145 has merged: Supabase → **SQL Editor** → New query → paste the whole of the new wallet file from `supabase/migrations/` (its name is in #145's pull request) → **Run**. It should finish with no error. Do not re-run the two older `events` migrations.

**Switch it on (last)**

- Only after steps 1-12, and after #146 and #149 have merged: Vercel → your project → Settings → **Environment Variables**. Add `PUBLIC_WALLET_ENABLED` = `true` for Production (and Preview if you want it there), then **redeploy**.
- To switch the wallet off at any time, delete that variable and redeploy. Checkout goes back to today's behaviour, and balances are kept.

**Every six months (recurring)**

13. Repeat step 9 with the same `.p8`, and paste the new token into Supabase's Apple **Secret Key (for OAuth)** (step 10). Set a reminder for five months from each renewal.
    - If you miss it, visitors who choose Apple come back to checkout with a sign-in error and cannot place an order that way. Google keeps working.
    - If the `.p8` is lost, create a new key (step 8) first.
