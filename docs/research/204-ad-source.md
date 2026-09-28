# Decision this serves: which source fills the "ad" slide in the home page promo carousel with a real, paid ad, so that the designer and engineer children of #204 build against one concrete source instead of a guess.

Issue: #207 (child of objective #204). No ADR accompanies this document, because the recommended pick does not change a category (see "Category change").
Checked: 2026-09-28. Every "checked" date below is this date.

Legend: **V** = verified in the linked primary source this run. **S** = from a secondary source only. **I** = inferred, and the basis is given. **A** = assumed: neither verified nor inferred, but the comparison leans on it.

**Recommendation in one line:** a **direct-sold static slot** - one image, one link, an "Ad" label, no script - filled by a creative the owner supplies. Google AdSense is the fallback if the owner wants programmatic money now and accepts a consent banner. EthicalAds and Carbon will not take this site at its current traffic and topic.

## What in the issue is fixed, and what is a guess

**Constraints (checked):**

- Static Astro, no adapter (ADR 0001). A client-side script fits, and so does a static image.
- The carousel has 7 slides per city: 6 from `CAROUSEL_RESTAURANT_SLIDES` plus the first-order promo at position 4 (`src/lib/home-dom.ts:76-127`). It auto-advances every 5 s (`CAROUSEL_ADVANCE_MS`, `:130`), resumes 5 s after interaction (`:131`), and treats a 40 px drag as a swipe (`:135`).
- The carousel sends **no events today**. The only `track()` calls in `home-dom.ts` are `location_selected`, `flash_sheet_shown` and `home_viewed` (`:488`, `:743`, `:769`, `:775`). So nothing goes quiet if a slide changes, and ad impression and click events are new work for the follow-up readiness objective (#79 rule).
- `vercel.json` sets no headers and no CSP (checked).
- **The About page makes a promise an ad network could break.** `src/pages/about.astro:56-57` says: "What we don't log: ... No card, no address, **no cross-site tracking cookie** ...". This was not in the brief. Any pick that sets or reads third-party cookies makes that sentence false the day it ships.
- The site has a Ho Chi Minh City mode as well as San Francisco, so some visitors are in Vietnam (I, from the two-city product). That puts Vietnam's privacy law alongside the EU/UK in the consent question.

**Guesses in the brief, and what became of each:**

- *"AdSense, Carbon/EthicalAds, direct-sold."* All three are covered below. Carbon and EthicalAds get separate sections, because they differ on the thing that decides fit: EthicalAds publishes a traffic floor and Carbon does not.
- *"A client-side ad script fits the static build."* This is true, and it is not the binding constraint. Consent, approval and the About page's promise are.
- *"A direct-sold slot needs no script."* This is true (I, it is an `<img>` and an `<a>`). What the brief leaves out is that a direct slot with no buyer is the house slide we already have. The real question for that option is **who pays**, and only the owner can answer it.
- **Left out of the brief:** an **affiliate creative** (a static banner that pays per sale) as the thing that fills a direct slot. It is carried below as the option nobody asked for.

**Out of reach of reading:** whether AdSense would approve this particular site. Only an application answers that, and only the owner can submit one.

## Google AdSense

- **What it does.** Google's programmatic network. You put a script (`adsbygoogle.js`) and an `<ins>` ad unit on the page, and Google fills it with an auction-won ad inside an iframe (I, standard integration. The ad-unit docs were not fetched this run).
- **Approval requirements.** The applicant must be 18 or over, have "high-quality, original" content that attracts an audience, follow the program policies, and be able to edit the site's HTML (V, [AdSense eligibility](https://support.google.com/adsense/answer/9724)). Site verification and an `ads.txt` line are part of the site-review step (I, standard onboarding. The owner will see this in the AdSense UI).
- **Minimum traffic.** None published (V, same page: it "does not specify a minimum traffic requirement"). **The practical risk is rejection for thin content, not traffic.** "Low value content" is the most common rejection, and new sites are often refused regardless of quality (S, [adstimate](https://adstimate.com/blog/low-value-content-fix.html), [Medium/Illumination](https://medium.com/illumination/google-adsense-rejection-fixes-2026-get-approved-after-multiple-rejections-aab43931f654); both are practitioner write-ups, not Google). This site is mostly app screens about fictional restaurants, with little original prose (I). **A**: it has a real chance of being refused.
- **Consent obligations.** Personalised ads to EEA and UK users need "a consent management platform (CMP) that has been certified by Google and integrates with the IAB's Transparency and Consent Framework (TCF)". This has applied since 16 January 2024, and for Switzerland since 31 July 2024. Without one, traffic "may be eligible for non-personalized ads or limited ads" (V, [Google CMP requirement](https://support.google.com/adsense/answer/13554116)). Vietnam's PDPL (Law 91/2025/QH15) took effect on 2026-01-01 and requires consent before tracking or marketing cookies (S, [CookieYes](https://www.cookieyes.com/blog/vietnam-personal-data-protection-law/), [DFDL](https://www.dfdl.com/insights/legal-and-tax-updates/vietnam-personal-data-protection-2026-what-foreign-organizations-need-to-know/). Two of these sources sell CMPs, so treat them as interested). Serving AdSense with cookies at all also breaks the About page's "no cross-site tracking cookie" sentence (I, from the constraint above).
- **Payout.** The publisher gets 80% of revenue for AdSense for Content (V, [revenue share](https://support.google.com/adsense/answer/180195)). Payment is made once earnings reach **$100**, and a postal PIN is sent at $10 (V, [thresholds](https://support.google.com/adsense/answer/1709871)). **I**: at a soft launch's traffic this threshold is the binding fact. With 7 slides the ad slide is on screen about 1/7 of the time, and at a few thousand home views a month and an RPM of a few dollars (**A**, no published figure for this niche), reaching $100 takes years, not months.
- **Fit for one fixed-size carousel slide.** Poor.
  - "Publishers are not permitted to refresh a page or an element of a page without the user requesting a refresh" (V, [placement policies](https://support.google.com/adsense/answer/1346295)). Rotating the slide does not reload the ad, so this is not itself a breach (I). But forum reports and secondary guides say Google ads may not be hidden, even if a timed event later reveals them (S, [WebmasterWorld thread](https://www.webmasterworld.com/google_adsense/4937079.htm), [SitePoint](https://www.sitepoint.com/community/t/adsense-in-a-carousel/354013)). An auto-advancing carousel hides the ad 6/7 of the time.
  - **Empty search:** I looked for that "hidden" wording in Google's own policy pages ([placement policies](https://support.google.com/adsense/answer/1346295), [policy FAQs](https://support.google.com/adsense/answer/3394713), [ad-behaviour policy](https://support.google.com/adsense/answer/9335564)) and did not find it. So carousel placement is **unresolved in primary sources**, not known to be banned.
  - The slide is also a tappable, swipeable surface. That brushes against "implementing the ads in a way that they might be mistaken for other site content" (V, placement policies) and the accidental-click rules (I).
- **What it rules out later.** Nothing structural. But once a CMP is in, it is on every page, and the About page has to be rewritten.
- **Right pick if** the owner wants programmatic revenue with no sales effort, accepts a consent banner and a third-party script, and AdSense approves the site.

## EthicalAds

- **What it does.** A privacy-first, contextually targeted network for developer audiences. It is a script plus a `<div data-ea-publisher=... data-ea-type="image|text">` (V, [client docs](https://ethical-ad-client.readthedocs.io/en/latest/)).
- **Approval requirements.** Developer-focused sites (frontend, backend, data science, AI, DevOps, security) (V, [publishers page](https://www.ethicalads.io/publishers/)). You integrate the client first, then they review the placement (V, same page). Their ad "should be the only ad on the page" and sit "above the fold, on both desktop and mobile". The placement must reach "at least a 0.1% CTR" (V, [publisher policy](https://www.ethicalads.io/publisher-policy/)).
- **Minimum traffic.** "developer-focused sites doing 50k+ pageviews per month" (V, [publishers page](https://www.ethicalads.io/publishers/)). **This site fails that twice over.** It is a soft launch with little traffic (#204), and its subject is product analytics wrapped in a parody food-delivery app. That is "data science"-adjacent at best (I).
- **Consent obligations.** None in practice. Targeting is by page content, with "no tracking required" (V, publishers page). No identifying cookie is set unless you log in to EthicalAds, and IP logs are deleted within 10 days (V, [privacy policy](https://www.ethicalads.io/privacy-policy/)). **I**: no cookie banner is needed, and the About page stays true.
- **Payout.** 70% revenue share, paid monthly with a **$50** minimum (V, [publisher policy](https://www.ethicalads.io/publisher-policy/)). Payout methods are PayPal, Open Collective, GitHub Sponsors or Stripe bank transfer. They quote about $2.50 CPM for EU and North America traffic (V, publishers page).
- **Fit for one fixed-size carousel slide.** Mechanically good, but the placement policy fights it.
  - There is `data-ea-manual` with `ethicalads.load()`, and an `ethicalads.wait` promise that resolves to an empty list when no ad fills. That is exactly the hook a fallback-to-house-slide path needs. `data-ea-force-ad` exists for unbilled testing (V, client docs).
  - But "above the fold" and "the only ad" are both met, while a slide that is hidden 6/7 of the time will struggle to reach their 0.1% CTR floor (I).
- **What it rules out later.** Other ad networks on the same page (V, "only ad on the page").
- **Right pick if** the site grows to tens of thousands of monthly pageviews from a developer or data audience. It is the natural next step if traffic ever gets there.

## Carbon Ads

- **What it does.** A curated developer and design network run by BuySellAds. Its ad unit is script-based (V, [FAQ](https://www.carbonads.net/faq) mentions the ad tag and JavaScript dependencies).
- **Approval requirements.** "by invitation only" (V, [FAQ](https://www.carbonads.net/faq)). They weigh audience relevance, monthly page views, whether the site is maintained, and network capacity (V, same page).
- **Minimum traffic.** No figure published by Carbon (V: absent from the FAQ). One secondary review cites 10,000 pageviews a month (S, [monetizes.net](https://monetizes.net/networks/carbon-ads)). I could not trace that number back to Carbon (an empty search).
- **Consent obligations.** The FAQ does not say (V: absent). **Empty search:** I did not find a Carbon statement on cookies. So Carbon's consent position is **unknown**, not "none".
- **Payout.** CPM is typically $1.20-2.30, depending on geography. Earnings reach the BuySellAds account within 30 days and can be withdrawn within 60. The minimum payout is $1 (V, [FAQ](https://www.carbonads.net/faq)).
- **Fit for one fixed-size carousel slide.** It is a small fixed unit, so it would fit physically (I). But Carbon is **exclusive**: "you agree to display only Carbon ads on your site" (V, FAQ). That rules out AdSense or anything else later on the same site.
- **Right pick if** the owner were invited. There is no route in without that.

## Direct-sold static slot (recommended)

- **What it does.** The carousel's `ad` slide renders an image, an alt text, an advertiser name and a destination URL, labelled "Ad". The data comes from a small config the owner edits. There is no network, script or iframe, so the browser loads one image and follows one link (I, from the carousel's existing slide shape in `home-dom.ts:103-127`).
- **Approval requirements.** None from a third party. The owner decides who to sell to.
- **Minimum traffic.** None. **But the price is whatever a buyer will pay for a soft launch's traffic, which may be nothing.** This option has no revenue at all until the owner finds a buyer or picks an affiliate creative (see the next section).
- **Consent obligations.** None. No cookie is set on our origin by a plain image and link (I). The About page stays true. Two points still apply:
  - The image must be **self-hosted** (in `public/`). Hot-linking it from the advertiser's server would be a new outbound destination, house-rules item 3, and could let them log views (I).
  - The link needs `rel="sponsored noopener"`. The "Ad" label is also required as a disclosure (I, from the objective's "clearly labelled as an ad" and general advertising-disclosure practice).
- **Payout.** Whatever the owner agrees with the advertiser: an invoice, a Stripe payment link or a flat monthly fee. No network takes a cut or sets a threshold (I).
- **Fit for one fixed-size carousel slide.** The best of the four. The creative is sized to the slide rather than the slide to a network's unit. It cannot be blocked by a network outage, and a single house-slide fallback covers "no creative configured" and "image failed to load". The timer is never waiting on a third party (I). Ad blockers may still hide it if the markup or path looks like an ad (for example `/ads/` or class `ad`) (I). The engineer should name things neutrally and still test the blocked path.
- **What it rules out later.** Nothing. Moving to AdSense or EthicalAds later replaces the slide's content source and keeps the fallback.
- **Right pick if** the owner has, or will find, one paying advertiser or affiliate creative, and prefers keeping the "no cross-site tracking" promise to automated fill.

## The option nobody asked for: an affiliate creative in the direct slot

- **What it is.** A real product banner whose link carries the owner's affiliate ID. It pays per sale, not per view. It is the same static slot as above, so it has the same consent position and no script. The program's cookie is set on the merchant's site after the click, not on ours (I).
- **Worked example: Amazon Associates.** An account that does not refer **three qualifying sales within 180 days** is closed (S, [Amazon Associates help](https://affiliate-program.amazon.com/help/node/topic/G7MJTPEP9NC3YKMG); the practitioner guides say the same, e.g. [Velantio](https://velantio.com/blog/amazon-associates-approval-guide)). That is a real hurdle at a soft launch's traffic (I).
- **Why it is here.** It is the only way to put a *real, paying* ad in the slot next week without an approval gate that traffic can fail. The owner can choose a program closer to the audience than Amazon, such as an analytics tool or course with a referral scheme (**A**: I did not survey which ones exist).
- **Why it is not the headline pick.** It is a creative for the recommended slot, not a separate source. The slot is the same either way.

**Discarded:** Media.net, Ezoic and similar header-bidding stacks. They carry every consent cost of AdSense plus a heavier script, and they add nothing at this traffic (I, not researched further). Google Ad Manager is a superset of AdSense that also needs an AdSense-linked account, so it adds setup and no demand at this scale (I).

## Recommendation

**Direct-sold static slot.** One `ad` slide per city draws an owner-configured creative: a self-hosted image, alt text, advertiser name and destination URL. It is visibly labelled "Ad" and linked with `rel="sponsored noopener"`. The first creative is either a directly sold advertiser or an affiliate banner, and the owner picks which.

- **(a) Script or static?** **Static image, no client-side script and no iframe.** The only new network requests are to our own origin for the image, and the outbound navigation is the one the visitor chose by tapping.
- **Why this over the others.** It is the only candidate that can serve a real ad at soft-launch traffic without an approval gate this site is likely to fail. EthicalAds is shut by its 50k floor and topic. Carbon is shut by its invitation. AdSense is at best uncertain and pays nothing reachable before the $100 threshold. It is also the only candidate that keeps the About page true without a CMP.

### Category change

**Not a category change, so no ADR.** The house-rules triggers are a schema or data shape, a first dependency from a new ecosystem, or a new service or platform ([house-rules, "Decisions"](../../.claude/skills/house-rules/SKILL.md)). The direct slot adds none of these:

- no external script
- no new host, because the image is self-hosted
- no CSP
- no CMP
- no stored data

The only outbound thing is the advertiser's link. Clicking it is an ordinary navigation, like the site's existing outbound links. But house-rules "What a revert does not undo" item 3 still means **the pull request that adds the first real advertiser URL must say so in the owner's language** ("this adds a link to <advertiser>").

For contrast: **AdSense would be a category change** (a new service, an external script, and in practice a certified CMP and probably a CSP), needing an ADR and the item-3 question. **EthicalAds would be one too** (a new service and an external script), but not a CMP.

### Consent

**The recommended pick does not legally require a consent mechanism** (I). It sets no cookie, reads nothing from the device beyond what any image load does, and shares no personal data with a third party before the visitor chooses to click. The EU ePrivacy consent rule is about storing or reading information on the device, and the UK and Vietnam consent duties are about processing personal data for tracking or ads. None of these is triggered by a static self-hosted image (I, from the three regimes' stated scope. I am not a lawyer, and this is a reading, not advice).

**What it would be if the owner picks AdSense:** a Google-certified, IAB-TCF CMP for EEA, UK and Swiss visitors (V, [Google](https://support.google.com/adsense/answer/13554116)). In practice it would be shown in Vietnam too under the PDPL (S, above). It must load before `adsbygoogle.js` and gate personalised ads, and the About page's cookie sentence would have to be rewritten. **A** CMP is a third-party script in its own right, with its own ADR.

### The strongest argument against, and what would flip it

- **Against:** it may not earn anything. "Real ads" in #204 was about revenue, and a direct slot without a buyer is a house ad with a new label. AdSense at least fills every impression with *something* that pays, however little. I went looking for small-site AdSense experience reports to check whether the thin-content risk is overstated. The reports I found were rejection-fix guides, which only select for failures. **I found no neutral data on approval rates.**
- **Flips to AdSense if** the owner has no advertiser or affiliate in mind and wants automated fill, accepts a consent banner and rewriting the About page's promise, and AdSense approves the site.
- **Flips to EthicalAds if** home-page traffic passes about 50k pageviews a month and the About and analytics content positions the site as data or developer material.

## Owner steps vs Buildable now

### Owner steps (only the owner can do these)

- **Choose the first creative:** a direct advertiser (agree a price and take payment through your own invoice or payment link) or an affiliate program (sign up for it and receive the affiliate-tagged URL).
- **Supply the creative:** the image file, alt text, advertiser name and destination URL. For a slide that differs per city, supply one per city or say that one serves both.
- **No `ads.txt` is needed** for a direct slot. It lists authorised programmatic sellers, and there are none here (I).
- **No publisher ID or Vercel env var is needed.** The creative is content in the repository, not a secret.
- *If the owner picks AdSense instead:* create the AdSense account, submit the site and pass review, add the `ads.txt` line Google gives, choose and configure a certified CMP, and put the publisher ID (`ca-pub-...`) in Vercel env as a `PUBLIC_` variable.
- *If the owner picks EthicalAds instead:* apply, and the owner gets a publisher ID. This is not expected to pass today (see above).

### Buildable now (design and engineer children, no credentials needed)

- **The slot's shape and label.** How an "Ad" label reads on a carousel slide in both themes and both cities, and how it differs from the existing `ad` (catalogue restaurant) and `promo` slides.
- **A placeholder creative.** Use a self-hosted image clearly marked as a test ad, plus a config entry. The config lives in the repository, next to `CAROUSEL_RESTAURANT_SLIDES`.
- **The fallback path.** With no creative configured, or when the image fails (`onerror`), the slide shows the existing house slide. It keeps the 7-slide count, never pauses the 5 s timer, and causes no layout shift, because the slide's box is fixed before the image loads.
- **Blocked-path tests.** Simulate a blocked or 404 image in happy-dom and assert the fallback, the slide count and the timer. A real ad blocker cannot be run in the test suite, so the engineer should also name the path and classes neutrally and say so in the pull request.
- **Link attributes.** Use `rel="sponsored noopener"` and open in a new tab or not, as the designer decides.
- If the owner later picks AdSense or EthicalAds, the same fallback wraps their unit. EthicalAds' `ethicalads.wait` gives the empty signal directly, and `data-ea-force-ad` gives an unbilled test unit (V, client docs).

## Constraints for the downstream children

- **No ad-network identifier, advertiser ID, affiliate tag or user data goes into any event, ever** (#204, #79). That covers the engineer child and the later readiness objective alike.
- **No event work now.** The carousel sends no events today, so nothing goes quiet. **Note for the follow-up analytics-readiness objective:** measuring ad impressions and clicks will need a new event, or a new slide `type` value (e.g. `sponsored`) distinct from today's catalogue `ad`. The store rejects unknown shapes silently (ADR 0005), so that is a contract revision and a migration, and it belongs to that objective, not this one.
- **If the engineer child reuses `type: 'ad'`** for the paid slide, the slide `type` will not distinguish a paid ad from a catalogue restaurant. That is harmless now, because nothing logs it, but the readiness objective should know.

## Searches that came back empty

- Google's own wording on ads in carousels or hidden slides: not found in the placement policies, the policy FAQs, the ad-behaviour policy or the AdSense-for-Platforms policy page. The "hidden" rule is known only from secondary sources.
- Carbon's minimum traffic figure and its cookie or consent position: neither is published in the FAQ.
- Neutral (not rejection-fix) data on AdSense approval rates for small or new sites: none found.
- Publisher experience reports for EthicalAds at low traffic: a search returned only generic fill-rate articles.
