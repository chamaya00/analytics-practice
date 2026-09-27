# Decision this serves: how this static site signs a visitor in with Google and Apple, which client talks to Supabase, and how a play-money wallet is kept honest in Postgres - so that #145, #146 and #149 can build it dark, and the owner can switch it on.

Issue: #142 (child of objective #136). ADR: `docs/decisions/0008-play-money-wallet-and-sign-in.md`.
Checked: 2026-09-27. Every "checked" date below is this date unless it says otherwise.

**Recommendations, one line each:**

- **Auth provider:** Supabase Auth, OAuth **redirect** flow with **PKCE**, Google and Apple.
- **Client:** `@supabase/supabase-js` (pre-approved by the owner on #136), loaded by dynamic import only when the wallet is switched on. Plain `fetch` loses on one specific thing: the session's refresh lifecycle.
- **ADR 0001's static, no-adapter build survives: yes.** The redirect goes browser -> Supabase `/auth/v1/authorize` -> Google or Apple -> Supabase `/auth/v1/callback` -> back to `/checkout/?restaurant=<slug>&code=...`, where the browser exchanges the code. Money is moved only by `security definer` Postgres functions called over the Data API. No function, adapter or server of ours is involved.
- **Third sign-in method:** email and password, don't recommend. Magic link, don't recommend. GitHub, recommend it as the only third method worth having, and only if the driver wants one. Passkeys and anonymous sign-in, don't recommend. **Nothing beyond Google and Apple is built until the driver answers on #136.**

Legend used throughout: **V** = verified in the linked primary source this run. **S** = from a secondary source only, because the primary page was blocked by this run's egress proxy (named where it happened). **I** = inferred, and the basis is given. **A** = assumed: neither verified nor inferred, but the comparison leans on it.

## What in the issue is fixed, and what is a guess

**Constraints (checked, not assumed):**

- The build is static with no adapter: ADR 0001, `astro.config.mjs`.
- The store is Supabase Postgres on the free plan, written directly from the browser with the publishable key (ADR 0005). The existing `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` are already set in production for events (`src/lib/tracking-transport.ts:110-115`).
- Migrations are additive (ADR 0007) and tested against PGlite (ADR 0006).
- D1 (driver, #136, 17:31Z): the wallet ships dark. Checkout behaves exactly as today whenever auth or the wallet store is unconfigured or unreachable.
- D8 (driver, #136, 18:25Z): the browser-supplied debit amount is accepted as a named limitation, with a per-city floor.
- supabase-js is pre-approved (owner, #136, 17:35Z), but the ADR is still required and the pull request that adds it still goes to the owner.
- "Free, or within free-tier limits" (owner).
- The debit amount is #144's stored `totalMinor`, not `PlacedOrder.amountMinor`, which is the subtotal (`src/lib/order-store.ts:41-42`).

**Guesses in the brief, and what became of each:**

- *"An OAuth redirect flow plus Postgres functions."* It holds, but it is not the only way to get Google and Apple on a static site. A no-redirect flow (the providers' own JS buttons plus `signInWithIdToken`) exists, and it removes Apple's six-month chore. It is carried below as the option nobody asked for, and it loses on robustness, not on cost.
- *"supabase-js vs raw fetch."* This leaves out a third client: `@supabase/auth-js` alone (the auth half of supabase-js), with plain `fetch` for the wallet calls. It is carried below.
- *"Everything checkout needs must survive leaving and coming back."* Partly true today, and partly not (see "What the round trip loses").
- *"Start over (ADR 0004) clears local keys."* No start-over control is wired in the parody today. `clearOrder` says "Not currently wired to any control" (`src/lib/order-store.ts:414`), and the only `removeItem` calls are per-key (Grep over `src/`, this run). The ADR still decides what one must do if it comes back.

**Out of reach of reading:** the real bundle weight of each client on `/checkout/`, and whether Supabase keeps the `?restaurant=` query intact when it appends `code`. Both are one measurement away, and the ADR tells #146 and #149 to measure them rather than trusting this document (see "Assumptions").

## Auth approaches compared

### A. Supabase Auth, OAuth redirect with PKCE (recommended)

- **What it does.** The browser navigates to `https://<ref>.supabase.co/auth/v1/authorize?provider=google|apple&redirect_to=...&code_challenge=...`. Supabase sends the visitor to Google or Apple, and they come back to Supabase's callback, `https://<project-id>.supabase.co/auth/v1/callback` (V, [Apple guide](https://raw.githubusercontent.com/supabase/supabase/master/apps/docs/content/guides/auth/social-login/auth-apple.mdx)). Supabase then redirects to our `redirect_to` with `?code=...`. The code "has a validity of 5 minutes and can only be exchanged for an access token once" (V, [PKCE flow](https://raw.githubusercontent.com/supabase/supabase/master/apps/docs/content/guides/auth/sessions/pkce-flow.mdx)). The server side supports the `pkce` grant, reading `auth_code` and `code_verifier` (V, [supabase/auth token.go](https://raw.githubusercontent.com/supabase/auth/master/internal/api/token.go)).
- **Why PKCE and not implicit.** supabase-js defaults to `flowType: 'implicit'` (V, [GoTrueClient.ts](https://raw.githubusercontent.com/supabase/supabase-js/master/packages/core/auth-js/src/GoTrueClient.ts)). Implicit returns the tokens in the URL itself. PKCE returns a single-use, five-minute code that is useless without the verifier held in this browser's storage. So the client must set `flowType: 'pkce'` explicitly (I, from the two flows as documented).
- **Cost (free tier).** 50,000 MAU on the Free plan (V, [MAU docs](https://raw.githubusercontent.com/supabase/supabase/master/apps/docs/content/guides/platform/manage-your-usage/monthly-active-users.mdx), checked 2026-09-27). MAU is "distinct users who sign in or refresh their token during the billing cycle (including social login...)" (V, same page). The same page does not say what happens on the Free plan past 50,000 (V: absent). The Free plan pauses a project after a week without activity (V, carried from `docs/research/64-hosted-event-store.md`). A paused project means sign-in fails too, and D1 covers that. The owner pays nothing new: Google OAuth clients are free, and the Apple Developer membership is already paid (#136 body).
- **Recurring cost.** For the OAuth flow, "Apple requires you to generate a new secret key every 6 months using the signing key (`.p8` file)" (V, [Apple guide](https://raw.githubusercontent.com/supabase/supabase/master/apps/docs/content/guides/auth/social-login/auth-apple.mdx)). A lapse shows up as `invalid_client` on web Apple logins (S, [DEV write-up](https://dev.to/oskarmakarov/sign-in-with-apple-broke-with-invalidclient-after-6-months-heres-why-and-how-to-never-deal-2mhk); corroborated by [a second report](https://dev.to/toritic/supabase-sign-in-with-apple-keeps-throwing-invalidclient-the-checklist-that-actually-finds-it-5c7i)).
- **What it rules out later.** Nothing structural. The same Supabase project accepts `signInWithIdToken` (option C) and more providers later.
- **Right pick if** a full-page round trip at Place order is acceptable, provided checkout's state is persisted before leaving (see below), and the owner will do one calendar task every six months.

### B. A separate identity vendor via Supabase third-party auth (Clerk, Firebase Auth, Auth0)

- **What it does.** Supabase accepts JWTs from Clerk, Firebase Auth, Auth0, Cognito and WorkOS. The provider "must use asymmetrically signed JWTs", and "It is not possible to disable Supabase Auth at this time" (V, [third-party overview](https://raw.githubusercontent.com/supabase/supabase/master/apps/docs/content/guides/auth/third-party/overview.mdx)). RLS would then key on `auth.jwt()->>'sub'` (a text id) rather than `auth.uid()` (I).
- **Free-tier limits (checked 2026-09-27; the primary pricing pages for all three were blocked by this run's egress proxy):**
  - Clerk Hobby: 50,000 monthly *retained* users. It rose from 10,000 on 2026-02-05 (S, [Clerk pricing explained](https://clerk.com/articles/clerk-pricing-explained), [saasprices](https://saasprices.net/blog/clerk-free-plan-changes)).
  - Firebase Auth: 50,000 MAU free on the Identity Platform tiers. The Spark plan is capped at 3,000 daily active users once upgraded to Identity Platform (S, [Logto summary](https://blog.logto.io/firebase-authentication-pricing)).
  - Auth0 Free: 25,000 MAU (S, [IDSync](https://idsync.com/guides/auth0-pricing)).
- **Costs beyond money.**
  - A second vendor, and its SDK, in the browser.
  - A second dashboard for the owner.
  - The provider setup (Google client, Apple Services ID and key) is still needed, now inside that vendor. For Apple the same six-month secret applies wherever the OAuth flow runs (I, it is Apple's rule, not Supabase's).
- **What it rules out.** Nothing, but it adds a vendor that can change its free tier. Clerk's changed this year (S, above).
- **Right pick if** Supabase Auth could not do Google and Apple. It can, so this option buys nothing the project needs.

### C. Provider JS buttons plus `signInWithIdToken` (the option nobody asked for)

- **What it does.** Google's "Sign in with Google button or One Tap" and "Sign in with Apple JS" hand the page an ID token without leaving it (popup), and the page trades that token for a Supabase session with `signInWithIdToken` (V, [Google guide](https://raw.githubusercontent.com/supabase/supabase/master/apps/docs/content/guides/auth/social-login/auth-google.mdx), [Apple guide](https://raw.githubusercontent.com/supabase/supabase/master/apps/docs/content/guides/auth/social-login/auth-apple.mdx)).
- **Why it is interesting.**
  - "If you're using Sign in with Apple JS you do not need to configure the OAuth settings." Only the Services ID is needed, with no `.p8` secret (V, Apple guide). **So the six-month chore disappears.**
  - There is no page navigation, so checkout's in-memory choices survive by default (I).
- **Why it loses.**
  1. It puts two third-party scripts on our pages (Google's GIS and Apple's JS). Those are new *script* sources, and a heavier "outbound destination" item than a navigation (house rules, "What a revert does not undo" #3).
  2. Apple JS's popup mode has a public record of failing: an empty popup, Continue doing nothing, breakage inside WKWebView on iOS 17.1, and Safari on iPhone having no per-site popup exception (S, [Apple forum 128788](https://developer.apple.com/forums/thread/128788), [740376](https://developer.apple.com/forums/thread/740376), [713129](https://developer.apple.com/forums/thread/713129)).
  3. Google's GIS is mid-migration to FedCM, with changed One Tap behaviour and CSP adjustments for custom integrations (S, [Google developers blog](https://developers.googleblog.com/federated-credential-management-fedcm-migration-for-google-identity-services/)). That is churn that a redirect does not see.
  4. It needs nonce handling on both providers (V, both guides).
- **Right pick if** the Apple chore lapses in practice, or the owner refuses it up front. Apple alone can move to Apple JS then, with Google left on the redirect. This is the ADR's main flip condition.

### Also here: "what already exists" (keep the anonymous visitor id)

Keying a wallet to `parody.visitorId` (`src/lib/order-store.ts:70-76`) needs no sign-in at all. It fails #136 done-item 2 (the same balance on another device) and done-item 5 (clearing storage mints a fresh $20). It is listed so nobody has to ask.

### Discarded, one line each

- **Our own OAuth handling in a Vercel function.** It breaks ADR 0001's no-adapter build to do what Supabase's `/callback` already does.
- **Supabase anonymous sign-in as the identity.** Anonymous users can be upgraded with `linkIdentity` (V, [anonymous docs](https://raw.githubusercontent.com/supabase/supabase/master/apps/docs/content/guides/auth/auth-anonymous.mdx)), but every anonymous user would get a wallet, and the docs "strongly recommend" CAPTCHA against abuse (V, same page). That means minting play money by clearing cookies.

## Clients compared

The job: start the redirect, finish it (the code exchange), keep a session alive across tabs and hours, sign out, and call three wallet functions with the user's token.

| | Plain `fetch` | `@supabase/supabase-js` (recommended) | `@supabase/auth-js` + `fetch` for the wallet |
|---|---|---|---|
| New dependency | none | yes: 5 sub-packages (`auth-js`, `postgrest-js`, `realtime-js`, `storage-js`, `functions-js`), v2.117.2, MIT (V, [npm registry](https://registry.npmjs.org/@supabase/supabase-js/latest)) | yes: 1 package, depends only on `tslib` (V, [npm registry](https://registry.npmjs.org/@supabase/auth-js/latest)) |
| Covered by the owner's pre-approval | n/a | **yes, by name** | arguably (it is supabase-js's own auth package, same repo and same version), but not by name |
| PKCE verifier, code exchange | hand-written: SHA-256 challenge, base64url, `POST /auth/v1/token?grant_type=pkce` | built in (`flowType: 'pkce'`, `detectSessionInUrl`) | built in |
| Token refresh across tabs | hand-written (see below) | built in | built in |
| Wallet calls | `POST /rest/v1/rpc/<fn>`, like `tracking-transport.ts` | `supabase.rpc()` | `POST /rest/v1/rpc/<fn>`, like `tracking-transport.ts` |
| Stubbable in CI | `fetchImpl` injection (the existing pattern) | `createClient(..., { global: { fetch } })`, or wrap it behind our own interface | both |
| Bundle weight on `/checkout/` | ~0 | **not measured** (bundlephobia was blocked this run) | **not measured**, and smaller by construction (I) |

**Why plain `fetch` loses on the merits:** the refresh lifecycle. Supabase refresh tokens are single-use with a 10-second reuse window. A reuse outside it means "the whole session is regarded as terminated and all refresh tokens belonging to it are marked as revoked" (V, [sessions](https://raw.githubusercontent.com/supabase/supabase/master/apps/docs/content/guides/auth/sessions.mdx)). So two tabs refreshing at once can sign a user out everywhere. supabase-js carries dedicated machinery for exactly this: a "refresh single-flight + commit guard" and a cached refresh-failure cooldown (V, [GoTrueClient.ts](https://raw.githubusercontent.com/supabase/supabase-js/master/packages/core/auth-js/src/GoTrueClient.ts); constants `EXPIRY_MARGIN_MS` = 90 s and `REFRESH_FAILURE_COOLDOWN_MS` = 60 s, V, [constants.ts](https://raw.githubusercontent.com/supabase/supabase-js/master/packages/core/auth-js/src/lib/constants.ts)). Even so, "Invalid Refresh Token: Already Used" races are a recurring report against Supabase's own libraries (S, [supabase#18981](https://github.com/supabase/supabase/issues/18981), [ssr#68](https://github.com/supabase/ssr/issues/68)).

A hand-rolled client would re-solve a problem the vendor's library took several iterations to get right, in code whose failure mode is a silent sign-out mid-checkout. That meets the driver's earlier bar ("`fetch` can't do this safely") for the session half. It does not meet it for the three RPC calls, which are trivially safe as `fetch` (I).

**Why supabase-js over auth-js + fetch, narrowly:**

- It is the package the owner approved by name.
- Every Supabase guide the engineers will follow is written against it.
- One library attaches the token for both auth and the wallet calls, so there is one place to get that wrong rather than two.

auth-js + fetch would be smaller, and its wallet calls would read like `tracking-transport.ts`, which suits a teaching site. But its size advantage is **unmeasured**, and it is outside the literal approval. **Flip:** if #146 measures supabase-js adding more than about 40 KB gzip to `/checkout/` over auth-js alone, use auth-js + fetch. Nothing else in the ADR changes.

**Cost control either way:**

- The library is imported with a dynamic `import()` only when the build flag is on *and* the page needs it.
- A signed-out visitor's pages can tell "maybe signed in" from the presence of the `sb-<ref>-auth-token` key alone, because supabase-js stores sessions in `localStorage` by default (V, sessions page). So the header does not have to load the library for signed-out visitors (I; #146 decides).
- The events transport stays plain `fetch`, unchanged.

## Sign-in methods beyond Google and Apple

The owner's constraint is "free, or within free-tier limits". The first thing any email-based method runs into:

- **Supabase's built-in email sender allows 2 emails per hour, per project.** The docs' own value is `inbuilt_smtp_per_hour: { value: 2 }` (V, [supabase `packages/shared-data/config.ts`](https://raw.githubusercontent.com/supabase/supabase/master/packages/shared-data/config.ts), the file the docs table renders from, checked 2026-09-27). The production checklist says: "As of 3 Sep 2024, this has been updated to [that value] emails per hour" (V, [going-into-prod](https://raw.githubusercontent.com/supabase/supabase/master/apps/docs/content/guides/deployment/going-into-prod.mdx)).
- **It delivers only to the project's team.** It "will refuse to deliver messages to addresses that are not part of the project's team", and it is "intended for... toy projects, demos" (V, [custom SMTP](https://raw.githubusercontent.com/supabase/supabase/master/apps/docs/content/guides/auth/auth-smtp.mdx)).
- So any email method for real visitors needs custom SMTP. With custom SMTP, the Supabase default is "30 new users per hour" (V, going-into-prod). A free sender such as Resend allows 3,000 a month, capped at 100 a day, with one verified domain (S, [Resend free tier summary](https://wpmailsmtp.com/resend-review/); resend.com blocked this run). That needs a sending domain the owner controls, with DNS records.

| Method | Recommend? | Why |
|---|---|---|
| **Email + password** | **Don't recommend** | Confirmation and password-reset emails need custom SMTP (above): a new vendor, a domain and DNS. It is also a password store for play money. Leaked-password protection is a paid feature (S, [UI Bakery summary](https://uibakery.io/blog/supabase-pricing)). |
| **Magic link** | **Don't recommend** | The same SMTP problem. Also, it is specific to this flow (I): the sign-in happens *mid-checkout*. A link opened from a mail app often opens in that app's in-app browser, which has different storage. The cart and PKCE verifier are not there, so the visitor lands signed in with an empty checkout. Links are also rate-limited to one per 60 s per user (V, [config.ts](https://raw.githubusercontent.com/supabase/supabase/master/packages/shared-data/config.ts)). |
| **GitHub OAuth** | **Recommend, as the only third method worth having, if the driver wants one** | It is free, sends no email, and has a static client secret with no rotation. Setup is one OAuth app with the same Supabase callback (V, [GitHub guide](https://raw.githubusercontent.com/supabase/supabase/master/apps/docs/content/guides/auth/social-login/auth-github.mdx)). A learner audience for an analytics course plausibly has a GitHub account (A). It counts toward the same 50,000 MAU. The cost is one more button in #143's sign-in sheet and 10 minutes of owner setup. |
| **Passkeys** | **Don't recommend (now)** | Beta since 2026-05-28 (S, [changelog](https://supabase.com/changelog/46458-passkeys-for-supabase-auth-beta)). "Registering a passkey requires an existing, confirmed, non-anonymous user", so it cannot be the first sign-in (V, [passkeys](https://raw.githubusercontent.com/supabase/supabase/master/apps/docs/content/guides/auth/passkeys.mdx)). Worth revisiting as a *second* factor of convenience once it leaves beta. |
| **Anonymous sign-in** | **Don't recommend** | See "Discarded": every anonymous user is a free $20 wallet. |
| **Phone / SMS OTP** | **Don't recommend** | SMS is paid per message, which fails "free". |

**No third method is built until the driver answers on #136.** The orchestrator has said it would amend #143, #146 and #149 if the answer is yes.

## Wallet design: what the research settled for the ADR

These are findings the ADR relies on. The ADR carries the full specification.

1. **Supabase grants `anon` and `authenticated` execute on new functions in `public` by default.** The docs' remedy is to revoke from `public` *and* `anon` (V, [database functions](https://raw.githubusercontent.com/supabase/supabase/master/apps/docs/content/guides/database/functions.mdx)). `security definer` functions "must set the `search_path`" (V, same page). So every wallet function needs an explicit revoke and grant, and any helper that takes a time must live outside the exposed schema. That is how "no client-callable function accepts a caller-supplied time" is made true rather than hoped for.

2. **`auth.uid()` on Supabase is this, verbatim** (V, [supabase/auth migration](https://raw.githubusercontent.com/supabase/auth/master/migrations/20211202183645_update_auth_uid.up.sql)):
   `nullif(coalesce(current_setting('request.jwt.claim.sub', true), (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')), '')::uuid`.
   PGlite can run that exact body, so the test stub is the real definition, not an imitation. The stub must live in the test fixture and never in the migration. A `create or replace function auth.uid()` in a migration would overwrite Supabase's own function on the live project (I).

3. **PGlite and time zones.** Early PGlite had no zoneinfo (`SET TIME ZONE 'UTC'` failed; V, [pglite#62](https://github.com/electric-sql/pglite/issues/62)). That was fixed by the Postgres 16 rebuild merged 2024-07-23 (V, [pglite#112](https://github.com/electric-sql/pglite/pull/112)). The repo pins `@electric-sql/pglite` `^0.5.8` (`package.json:32`). That the current build resolves `America/Los_Angeles` is **inferred, not run**. So the DST tests must be watched failing first (house rules), and must compare `timestamptz` values with explicit offsets, not display strings. A separate open report of timestamp inconsistencies ([pglite#532](https://github.com/electric-sql/pglite/issues/532)) concerns `timestamp` without time zone, which is another reason to assert on `timestamptz` (I).

4. **DST arithmetic (I, from the US rule: second Sunday of March, first Sunday of November, 02:00 local):**
   - 2026-11-01 is a Sunday. The window opening 2026-10-31 23:00 PDT (2026-11-01 06:00Z) ends 2026-11-01 07:00 PST (15:00Z): **9 real hours**.
   - 2027-03-14 is the second Sunday of March. The window opening 2027-03-13 23:00 PST (2027-03-14 07:00Z) ends 2027-03-14 07:00 PDT (14:00Z): **7 real hours**.
   - The three boundaries (07:00, 15:00, 23:00) never fall inside the 01:00-03:00 hour that DST skips or repeats. So converting a local boundary back to `timestamptz` is never ambiguous (I).

5. **The per-city floor never refuses a legitimate order in today's catalogue** (I, computed from `src/lib/restaurants.ts`, `vouchers.ts`, `flash-deal.ts`, `money.ts` this run):
   - D8's floor: SF = cheapest item 300 + lowest delivery fee 99 = **399** cents. HCMC = 10,000 + 10,000 = **20,000** ₫.
   - The smallest real SF total is a $3.00 item at the $0.99-fee restaurant with flash-free delivery: 300 + 0 + 150 (service fee) = **450**. With the largest discount reachable at the lowest qualifying subtotal (flash voucher up to 600 at a 1,000 minimum): 1,000 - 600 + 0 + 150 = **550**.
   - HCMC: 10,000 + 0 + 20,000 = **30,000**. With a discount: 80,000 - 30,000 + 0 + 20,000 = **70,000**.
   - It holds because each city's service fee is at least its lowest delivery fee (150 >= 99; 20,000 >= 10,000). A catalogue change can break this silently, so #145 should have a test that reads the floor constants out of the migration and compares them with the catalogue.

6. **Identity linking.** "Supabase Auth automatically links identities with the same email address to a single user" (V, [identity linking](https://raw.githubusercontent.com/supabase/supabase/master/apps/docs/content/guides/auth/auth-identity-linking.mdx)). Google then Apple with the same real email is one account and one wallet. Apple with "Hide My Email" is a relay address, so it is a *second* account with its own preload (I). That is harmless for play money, and the ADR names it.

7. **Knowing "auth is configured" at run time.** `GET /auth/v1/settings` returns an `external` map with booleans for `google`, `apple`, `github`, `email` and others (V, [supabase/auth settings.go](https://raw.githubusercontent.com/supabase/auth/master/internal/api/settings.go)). The existing URL and key cannot be the signal: they are already set in production for events. So the ADR uses:
   - an explicit build flag, which the owner sets last;
   - `/settings` to see which buttons to show;
   - a tiny anonymous `wallet_ready()` call to prove the migration is applied.

## What the OAuth round trip loses (for #149)

This is from reading `src/lib/checkout-dom.ts` this run.

- **Survives** (it is in storage):
  - the cart (`parody.cart`, localStorage);
  - applied offers (`offersStateKey(slug)`, localStorage);
  - the flash draw (`flashDeal:<city>`, sessionStorage). This survives same-tab navigation away and back (A: standard sessionStorage lifetime; MDN and WHATWG were both blocked this run);
  - the restaurant, as long as `redirect_to` carries `?restaurant=<slug>`.
- **Lost:** the three checkout choices (drop-off, delivery instructions, utensils) live only in `choiceButtons`' closure (`checkout-dom.ts:63`). They reset to defaults after the round trip unless #149 persists them before leaving.
- **Recomputed, not trusted:** the total is rebuilt on every render from the stored state and the live flash window (`checkout-dom.ts:300-308`). An expired flash window raises the total on return, which is correct.
- **Events:** `checkout_viewed` fires again on the return load, so it fires twice for one checkout with a round trip. Fixing that is a contract change, so leave it (#79 rule).

## Assumptions the recommendation rests on

- **A1.** Supabase appends `code` to a `redirect_to` that already has a query (`/checkout/?restaurant=x`) without dropping it. Not verified. #149 must check it on a preview deploy. The fallback is to stash the slug in sessionStorage before leaving.
- **A2.** sessionStorage survives the same-tab round trip (above).
- **A3.** The owner will renew Apple's secret every six months. If not, see the flip.
- **A4.** Supabase MAU counting treats a user refreshing once an hour as one MAU for the month (I, from "distinct users"). There is no risk at this site's scale.

## Searches, including the ones that came back empty

- Supabase pricing, rate limits, SMTP, pausing on supabase.com: **blocked by the egress proxy**. The same documents were read from the docs' source in `supabase/supabase` on GitHub (raw), which is what the V citations point at.
- The built-in SMTP hourly number: the docs page renders it from data, so it is not in the prose. Traced backward to `packages/shared-data/config.ts` (value 2). Secondary posts quoting "2/hour" agree.
- Clerk, Auth0, Firebase and Google Cloud pricing pages: **all blocked**. Their numbers are secondary (S) and dated. Clerk's changed in February 2026, which is why the date matters.
- The bundle size of supabase-js vs auth-js: bundlephobia **blocked**. The npm registry gave dependencies and unpacked sizes, which say nothing about the gzip size shipped. Left as a measurement for #146.
- "PGlite America/Los_Angeles": no direct statement found for 0.5.x. The zoneinfo fix is from 2024 (pglite#112). Hence "inferred", and the watch-it-fail instruction.
- "People who chose Supabase Auth and regretted it", phrased as a critic would ("Apple sign in stopped working supabase", "refresh token already used multiple tabs"): found the Apple six-month lapse reports and the refresh-race reports cited above. **I found no report of Supabase Auth itself being the wrong choice for a static site with Google and Apple.** Every complaint I found was operational (Apple secret, refresh races, the 2/hour email limit), and each of those is handled or named here.
- MDN and WHATWG on sessionStorage lifetime: **blocked**. Left as an assumption (A2).

## Recommendation, the case against it, and what would flip it

**Recommendation.**

- Supabase Auth with the OAuth redirect flow and PKCE for Google and Apple, through `@supabase/supabase-js`, loaded only when the wallet is switched on.
- The wallet lives in Postgres behind three `security definer` functions, as ADR 0008 specifies.
- ADR 0001's static, no-adapter build survives.
- No third sign-in method now. If the driver wants one, it is GitHub.

**The strongest argument against it, found rather than imagined:**

- The redirect flow is what carries Apple's six-month client secret. Its failure is silent to the owner and specific to Apple: web logins start returning `invalid_client` about six months after setup (S, the DEV reports above). D1's fallback does not catch it, because auth is configured and the wallet answers. So a visitor who will only use Apple is blocked from ordering until the owner renews the secret (I).
- Option C (Apple JS plus `signInWithIdToken`) needs no secret at all (V).
- For an owner who does not read code, a recurring task with a silent failure is exactly the kind of thing that lapses.
- The reasons C still loses are its popup failures on Apple's own platforms and the third-party script it adds, both sourced above. But a reasonable reader could weigh the chore more heavily than I did.

**What would flip it:**

- **Apple's secret lapses once, or the owner declines the chore:** move Apple (only) to Apple JS plus `signInWithIdToken`, and keep Google on the redirect. The wallet, the functions and the ADR's money rules do not change.
- **supabase-js measures more than about 40 KB gzip heavier on `/checkout/` than auth-js alone:** use `@supabase/auth-js` for sessions and plain `fetch` for the wallet RPCs.
- **Supabase's Free plan drops below the site's MAU, or starts charging for auth:** Supabase third-party auth with a separate identity vendor (option B). The wallet's RLS moves from `auth.uid()` to `auth.jwt()->>'sub'`.
- **Visitors are seen abandoning at a Google/Apple-only prompt** (the analytics-readiness objective can measure this): add GitHub first. Email-based methods only once the owner has a sending domain.
