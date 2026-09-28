# Which affiliate partner fills the carousel's static ad slot (#204)

**Decision this serves:** which program the owner should sign up for first, so the direct-sold static slot recommended in `docs/research/204-ad-source.md` (#207, PR #208) carries a real, paying creative at soft launch. The answer also says whether that creative changes anything the designer and engineer children have to build.

Checked 2026-09-28. This fills the gap PR #208 left open: "A: I did not survey which ones exist."

**Status.** The ranking stopped moving over the last several sources, so the comparison is stable. The evidence under it is thinner than usual, though. The egress proxy blocked direct reads of nearly every program's own pages (listed under "Searches that came back empty"). Where a program's own page is quoted, the text came through a search restricted to that program's domain, not from reading the full page. If the run had continued, I would have read these next:
- Coursera's campaign terms inside Impact (they need a login).
- The creatives clause of DataCamp's affiliate terms, in full.
- Amazon's Operating Policies on images.

## Evidence legend

Same as `204-ad-source.md`, with one addition that the blocked egress made necessary:

- **V**: verified. Read in full in a primary source this review. Here that is only the repository's own files.
- **P**: primary source, seen through a search restricted to that source's own domain. It is the program's own wording, but a search summary, not a full read. Treat it as one step below V.
- **S**: secondary sources only (affiliate directories, reviews, press).
- **I**: inferred. The basis is given.
- **A**: assumed. Neither verified nor inferred, and something rests on it.

## What is fixed, and what was a guess

**Constraints**, checked:
- The slot is one self-hosted image plus one link with `rel="sponsored noopener"`, labelled "Ad", with no script and no cookie set by this site. This is PR #208's pick, not yet merged.
- The carousel has 7 slides per city, San Francisco and Ho Chi Minh City. It auto-advances every 5s, and the first-order slide sits 4th (`src/lib/home-dom.ts:76-130`, V).
- The About page promises "no cross-site tracking cookie" (`src/pages/about.astro:56-58`, V).
- The #79 rule: no affiliate tag or identifier ever goes into an event.

**Guesses in the brief:**
- Food-delivery, meal-kit and network sign-ups sit on the same list as on-topic programs. That treats them as equally plausible, and they are not. The audience is learners doing SQL and funnel exercises, not people ordering dinner (I, from CLAUDE.md, "What this is").
- The brief also implies the question is "which program pays most". At soft-launch traffic, the ranking turns on something else: **which program survives low volume**, and **which one lets you use a self-made, self-hosted creative**. Commission rate barely matters when the expected number of sales is close to zero (worked through below).

## The arithmetic that decides the ranking

This section is I on A. It is the load-bearing inference in the whole document, so the working is shown.

- **Traffic.** Soft-launch traffic is unknown (A). Use V home-feed views a month.
- **Impressions.** The paid slide is seen on roughly every home view if it sits in the first position, and less often further along the 35s cycle (I, from the 5s timer in `home-dom.ts`).
- **Click-through rate.** Display banners average about **0.46%** CTR ([WordStream, Google Ads benchmarks](https://www.wordstream.com/blog/ws/2016/02/29/google-adwords-industry-benchmarks), S). That figure comes from advertiser-side Google Display data from 2016, and I could not trace a newer primary figure. Affiliate-banner writers put static banners at 0.1-0.5% ([AutoAffiliateLinks](https://autoaffiliatelinks.com/contextual-links-vs-banner-ads-what-the-data-says-about-affiliate-conversion-rates/), S).
- **Result.** At V = 1,000, that is 1-5 clicks a month. At an assumed 1-3% purchase rate on click (A), it is **0.01-0.15 sales a month**.

Consequences:
1. **Any rule that closes an account for low volume is disqualifying.** Amazon's 3 sales in 180 days would almost certainly close the account (see Discarded).
2. **Bounty size matters more than commission rate, but only a little.** A $500 bounty times a near-zero bootcamp conversion rate is still a lottery ticket.
3. **What the slot is realistically worth at soft launch** is being real, cheap and on-topic. The money shows up only if traffic grows (I). That is also why the pick should cost the owner the least effort to keep alive.

## Candidates compared

Each candidate records:
- what it pays
- approval and volume rules
- whether a plain self-hosted image and link work
- carousel suitability
- disclosure
- which city it serves
- payout

"Static-compatible" means it works with no script, no pixel and no image served from the partner's CDN.

### Coursera (via Impact): on-topic, both cities

- **Pays:** 15-45% on eligible purchases (courses, Specializations, Professional Certificates, Coursera Plus). Bonuses for strong performance. 30-day window, last click ([about.coursera.org/affiliates](https://about.coursera.org/affiliates), P; [Lasso](https://getlasso.co/affiliate/coursera/), S).
  - Anchor product: the Google Data Analytics certificate, about $49 a month, or Coursera Plus at $59 a month or $399 a year ([GDACertPrep](https://gdacertprep.com/blog/google-data-analytics-certificate-cost.html), S). So one sale earns roughly $7-27 (I).
- **Approval:** free to join on Impact ([about.coursera.org/affiliates](https://about.coursera.org/affiliates), P). Each brand reviews its applicants. I found no published traffic minimum, and I found no minimum-sales or inactivity rule (see empty searches).
- **Static-compatible: yes, and this is the deciding line.** Coursera says partners can promote "using either Coursera's custom banners and text links **or your own unique format**" ([about.coursera.org/affiliates](https://about.coursera.org/affiliates), P). A self-made, self-hosted creative sized to the carousel slide is therefore within terms.
  - Impact's own JavaScript "Publisher Tag" only automates link conversion and impression capture. It is optional, and a plain tracking link works without it ([Impact help, Publisher Tag](https://help.impact.com/partner/what-would-you-like-to-learn-about/platform-features/tracking/tracking-links/create-and-manage-links/publisher-tag-implementation-for-partners), P; "optional" is I, because the tag is described as a converter of links that the partner could equally generate by hand).
- **Carousel:** no rotating-placement restriction found (empty search).
- **Cities:** both. Coursera sells worldwide (I). Whether Vietnamese regional prices are lower, which would shrink the commission per sale, is unverified (empty search).
- **Payout:** Impact pays from a $10 balance ([Impact help](https://help.impact.com/en/support/solutions/articles/48001233415-how-do-partners-get-paid-), S). A maintenance fee applies only if Impact has been *unable to pay you* for 6 months, for example because payment details are missing. It is not triggered by having no sales ([same](https://help.impact.com/en/support/solutions/articles/48001237476-partner-payments-explained-from-action-to-payout), S; both are Impact's own help pages, seen through an unrestricted search summary).
- **Costs:** an Impact account, a tax form and one brand approval. Rules out nothing later: the link can be swapped at any time.
- **Right pick if:** the audience converts at all on analytics learning. It is also the only candidate that serves both cities with one creative *and* explicitly permits a self-made creative.
- **Against:**
  - Coursera lets people audit courses free, and financial aid waives the fee for about 15% of applicants ([GDACertPrep](https://gdacertprep.com/blog/google-data-analytics-certificate-cost.html), S, citing Coursera's 2024 Impact Report). Many clicks will never pay.
  - Impact's brand review of a low-traffic parody site is unknown (A).

### DataCamp (via Impact): on-topic, both cities

- **Pays:** 7.5-25% of a yearly Individual plan's first year, or 15-80% of a monthly plan's first month. The window is "up to 30 days (depending on the affiliate category)" ([DataCamp affiliate terms](https://www.datacamp.com/affiliates/terms-and-conditions), P). Secondary sources disagree on the window (7, 30 or 45 days) ([Lasso](https://getlasso.co/affiliate/datacamp/), S), which fits "depending on category".
- **Approval:** through Impact, free ([datacamp.com/affiliates](https://www.datacamp.com/affiliates), P). No traffic minimum found.
- **Static-compatible: probably, but narrower than Coursera.** The terms license only material "expressly permitted by DataCamp in writing" ([terms](https://www.datacamp.com/affiliates/terms-and-conditions), P).
  - So the owner can download an approved banner and self-host it (I). The file is unchanged; only Impact's impression pixel is dropped.
  - A *self-designed* creative in the carousel's shape would need DataCamp's written OK (I).
- **Cities:** both (I).
- **Right pick if:** Coursera declines the application. DataCamp's SQL-in-the-browser product is arguably closer to what this site teaches than Coursera is (I).
- **Against:** the creative clause is the tighter one. If no approved size fits the slide, the owner needs a written exception.

### "Sponsor this slot" house creative: both cities, no approval

- **What:** a self-made slide reading, for example, "Your analytics tool here - reach people learning product analytics", linking to a `mailto:` or the owner's contact page. This is PR #208's direct-sold path, advertised on the slot itself.
- **Pays:** nothing until someone buys, then whatever the owner negotiates.
- **Approval, disclosure, script:** none. Nothing to verify.
- **Right pick if:** the owner would rather hold out for a direct sponsor than carry an affiliate link, or while the Impact application is pending.
- **Against:** nobody buys a slot on a site with no traffic figures to show (I). It works best *after* the readiness objective can report impressions.

### Outsider nobody asked for: data-analytics bootcamp bounties (US-leaning)

- **Pays:** Springboard "up to $500 per transaction" ([springboard.com/landing/affiliates](https://www.springboard.com/landing/affiliates/), P). TripleTen $800 a sale with a 30-day cookie through FlexOffers ([FlexOffers](https://www.flexoffers.com/affiliate-programs/tripleten-affiliate-program/), S).
  - **Contradiction, not resolved:** Cuelinks lists the same TripleTen programme at ₹3,449.79 (about $41) a sale ([Cuelinks](https://www.cuelinks.com/campaigns/tripleten-affiliate-program), S). That is probably a different market or event, but I could not reach a primary.
  - CareerFoundry offers only a $250 *referral* (alumni) programme, not an affiliate one ([CareerFoundry](https://careerfoundry.com/en/faqs/referral-program-terms-and-conditions/), S).
- **Why it was carried this far:** at near-zero sales, one bootcamp sale would out-earn years of Coursera commissions. It is the one family where the arithmetic above does not rule the money out.
- **Why it loses:** a banner on a practice site is a poor route to a $5-10k purchase decision (I), so the expected value is a lottery. It also leans on US buyers (A). And recommending a bootcamp is an *endorsement* of career outcomes, which is an editorial call about the product and is the owner's to make, not mine. Springboard's cookie window was not found (empty search).

### ShopeeFood Affiliate: on-theme, HCMC only

- **What:** ShopeeFood (roughly 48% of Vietnam's delivery market, level with GrabFood; Baemin left in December 2023 and Gojek in September 2024 ([VnExpress](https://e.vnexpress.net/news/business/data-speaks/shopeefood-and-grabfood-dominate-vietnam-s-food-delivery-market-with-90-share-4911896.html), S; [VietnamNet](https://vietnamnet.vn/en/vietnam-s-food-delivery-market-heads-for-usd-9b-in-fierce-price-war-2438894.html), S)) has an affiliate section inside Shopee Affiliate ([help.shopee.vn 174169](https://help.shopee.vn/portal/10/article/174169-H%C6%B0%E1%BB%9Bng-d%E1%BA%ABn-s%E1%BB%AD-d%E1%BB%A5ng-h%E1%BB%87-th%E1%BB%91ng-ShopeeFood-Affiliate), P).
- **Pays:** a percentage per dish. Orders count only if the restaurant takes part, the click is the last one, and the order comes within **7 days**. The total is **capped at 10,000 VND per order**, about US$0.38 ([help.shopee.vn 174171](https://help.shopee.vn/portal/10/article/174171-C%C3%A1ch-t%C3%ADnh-hoa-h%E1%BB%93ng-ShopeeFood-Affiliate), P).
- **Approval and payout:**
  - Name, CCCD or passport, and a tax code must all belong to one person.
  - The bank account must match that identity and be chosen from Shopee's list of banks ([help.shopee.vn 180808](https://help.shopee.vn/portal/10/article/180808), P).
  - Foreigners use a passport ([Riomedia guide](https://academy.riomedia.vn/meo-dien-thong-tin-thanh-toan-va-thue-duoc-duyet-100-tren-shopee-affiliate/59), S).
  - A Vietnamese bank account is effectively required (I, from the bank-list rule).
- **Static-compatible:** yes. Links are plain redirects through `s.shopee.vn/an_redir?...` ([help.shopee.vn 172955](https://help.shopee.vn/portal/10/article/172955-H%C6%B0%E1%BB%9Bng-d%E1%BA%ABn-t%E1%BA%A1o-link-Ti%E1%BA%BFp-th%E1%BB%8B-li%C3%AAn-k%E1%BA%BFt-r%C3%BAt-g%E1%BB%8Dn), P).
- **Right pick if:** the owner has a Vietnamese bank account and wants the HCMC slide on-theme. Even then, the 10,000 VND cap makes it the lowest-earning candidate here (I).
- **Against:**
  - It needs a per-city creative, so SF needs something else.
  - Pointing a parody delivery app at a real one invites the obvious joke: why not order there?

### Also compared, briefly

| Candidate | Pays | Blocker at soft launch | Cities |
|---|---|---|---|
| Udemy (Impact) | 10% baseline, 7-day cookie, commission on any course bought in that window ([partnersupport.udemy.com](https://partnersupport.udemy.com/hc/en-us/articles/360049412573-What-is-a-Cookie-How-Long-do-Cookies-Last), P) | Short window and low rate; its catalogue is less analytics-focused than Coursera's or DataCamp's (I) | both |
| O'Reilly (Impact) | ~8% a subscription, 45-day cookie ([Lasso](https://getlasso.co/affiliate/oreilly/), S) | Membership is priced for professionals; weaker fit for beginners (I) | both |
| Maven | Up to 30% plus up to $100 off, **curated partners only**, for courses above $250 ([help.maven.com](https://help.maven.com/en/articles/11888621-instructor-guide-to-the-student-growth-program), P) | Not an open sign-up | both |
| Vercel (Dub) | 20% recurring, 90-day window ([startupaffiliateprograms](https://startupaffiliateprograms.com/programs/vercel-affiliate-program), S); terms on [vercel.com/legal/affiliate-marketing-terms](https://vercel.com/legal/affiliate-marketing-terms) (P) | Audience mismatch (learners are analysts, not deployers) (I) | both |
| Amplitude | Referral partner agreement; the partner notifies Amplitude of prospects by email ([amplitude.com](https://amplitude.com/partner-agreement/referral), P) | A B2B lead programme, not click attribution | - |
| Hex | Referral commission inside a *consulting* partner tier ([hex.tech/partners](https://hex.tech/partners/), P) | Built for consultancies | - |
| PostHog | "Register interest" form; no published commission ([posthog.com/partnerships](https://posthog.com/partnerships), P) | No open programme | - |
| Supabase | No affiliate programme on supabase.com; only integration and solution partners ([supabase.com/partners](https://supabase.com/partners), P) | A secondary site claims 20% recurring but says the "official affiliate page is temporarily unavailable" ([AffiliPilot](https://affilipilot.io/blog/supabase-affiliate-program-review-commission-approval-tips-2026), S). I treat it as nonexistent | - |
| Bookshop.org | 10% for non-bookstore affiliates, **48-hour** window ([support.bookshop.org](https://support.bookshop.org/en/support/solutions/articles/65000191390-can-you-explain-bookshop-org-s-affiliate-program-), P). A secondary's "30-day" claim ([Lasso](https://getlasso.co/affiliate/bookshop/), S) is contradicted by the primary | Needs a book sale within 48h; US only (A) | SF |
| HelloFresh / Instacart / DoorDash | About $10-20 a first box, 14-day cookie ([FlexOffers](https://www.flexoffers.com/affiliate-programs/hellofresh-us-affiliate-program/), S); Instacart $5-10 a new customer on Impact ([Instacart](https://company.instacart.ca/affiliate), P/S); DoorDash $3 a first order ([APDB](https://www.affiliateprogramdb.com/brands/doordash-affiliate-program/), S) | Off-audience; a real delivery brand's approval of a parody delivery app is doubtful (A) | SF |
| Donations: GitHub Sponsors / Buy Me a Coffee / Ko-fi | GitHub 0% fee from personal sponsors ([GitHub Docs](https://docs.github.com/en/sponsors/sponsoring-open-source-contributors/about-sponsorships-fees-and-taxes), S: search summary, host blocked); BMAC 5% ([BMAC help](https://help.buymeacoffee.com/en/articles/8105744-how-to-calculate-charges-on-your-payment), S); Ko-fi 0% on tips ([ko-fi.com/pricing](https://ko-fi.com/pricing), S) | Not an ad, so labelling it "Ad" would be wrong. It belongs in a footer, not the ad slot (I) | both |

### Networks and aggregators

These are routes to merchants, not candidates in their own right.

- **Impact:** free, $10 payout minimum, no dormancy closure found (sources above). It hosts Coursera, DataCamp, Udemy, O'Reilly and Instacart, so **one owner account covers the top two picks.**
- **PartnerStack:** SaaS-focused, open to everyone, $5 payout minimum, PayPal, Stripe or Airwallex ([PartnerStack support](https://support.partnerstack.com/hc/en-us/articles/360009501113-How-do-I-get-paid), S). I found no analytics tool in this survey that is exclusive to it.
- **Awin (absorbed ShareASale):** ShareASale closed on 6 October 2025. There is a refundable $1-5 sign-up deposit, and payouts start at $20 minimum, defaulting to $50 ([Awin](https://www.awin.com/us/news-and-events/awin-news/shareasale-to-awin-upgrade), S; [Favly](https://favly.com/awin-affiliate-program), S).
- **CJ:** deactivates accounts with no commission in 6 months ("dormant deactivation") ([CJ Junction](https://junction.cj.com/article/how-reactivate-your-cj-affiliate-account), S; [AffiliateTip](https://affiliatetip.com/cj-dead-weight-cancellation-angers-an-affiliate/), S). Disqualifying at this volume, by the arithmetic above.
- **AccessTrade VN:** pays from 200,000 VND, needs CCCD identification and a Vietnamese bank account ([help.accesstrade.vn](https://help.accesstrade.vn/knowledgebase/chinh-sach-doi-soat-va-thanh-toan/), P). The same identity barrier as Shopee.
- **Skimlinks:** rejects sites with "insufficient traffic" and new sites without an audience ([Skimlinks support](https://support.skimlinks.com/hc/en-us/articles/223835548-Why-was-my-Publisher-application-denied), S). Its core product is a JavaScript link rewriter, which would be a category change.
- **Sovrn Commerce:** no traffic minimum, and links can be made by hand ([Sovrn KB](https://knowledge.sovrn.com/kb/getting-started-with-sovrn-commerce), S). For a single slot it adds a middleman to a link Impact gives directly (I).

### Discarded

**Amazon Associates.** Three reasons, any one enough:
1. **3 qualifying sales within 180 days** or the account is closed, with no reinstatement. The April 2026 agreement tightened this ([Amazon Associates agreement, compare page](https://affiliate-program.amazon.com/help/operating/compare), P; [AAWP](https://getaawp.com/blog/amazon-affiliate-program-requirements/), S). At 0.01-0.15 sales a month, that fails.
2. **Product images** come through Amazon's servers or API. The PA-API was retired on 15 May 2026, and the Creators API needs 10 sales in 30 days ([Amazon, Creators API](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/migrating-to-creatorsapi-from-paapi), P; [Velantio](https://velantio.com/blog/how-to-get-amazon-creators-api-access), S). So a book-cover creative means an embedded resource from Amazon (a category change) or a creative with no product image.
3. **Other costs:** books pay 4.5% on a 24-hour cookie ([Lasso](https://getlasso.co/amazon-affiliate-commission-rate/), S). Amazon requires the exact sentence "As an Amazon Associate I earn from qualifying purchases" on the site ([Amazon policies](https://affiliate-program.amazon.com/help/operating/policies), P). And it does nothing for HCMC visitors (I).

## Ranked shortlist

1. **Coursera via Impact.** First pick for both cities, with one creative.
2. **DataCamp via Impact.** Fallback if Coursera declines, from the same Impact account.
3. **"Sponsor this slot" house creative.** Runs while the application is pending and costs nothing.
4. **ShopeeFood Affiliate, HCMC only.** Only if the owner already has Vietnamese identity and banking, and wants the HCMC slide on-theme. It earns the least.
5. **A bootcamp bounty (Springboard).** Only if the owner wants to make that endorsement.

There is **no separate per-city first pick**: Coursera serves both cities, and the only HCMC-specific option earns less and needs a Vietnamese bank.

## Recommendation

Put **a self-made Coursera creative** in the static slot, in both cities.
- Link it to the Google Data Analytics certificate page through an Impact tracking link.
- Run the "sponsor this slot" house creative until Impact approves the application.

It is the only candidate that meets all four conditions:
- It explicitly allows a self-made creative, so it fits the self-hosted slot exactly.
- It carries no minimum-volume rule that would close the account.
- It serves both cities with one image.
- It is the closest in subject to what a visitor here is already doing.

**Strongest argument against, which I went looking for.** At this traffic Coursera will very likely earn **nothing**. Its free audit and financial aid mean the learners most likely to click are the ones least likely to pay (source above). So "Coursera" is really a way to keep a real, compliant, on-topic ad in the slot at zero cost, not a revenue decision. If the owner wants a chance of real money, the only candidate with that shape is the bootcamp bounty.

I searched for affiliates who regretted Coursera specifically (rejections, commission cuts) and found nothing. That makes it either a genuinely uneventful programme or an unexamined one, and a search cannot tell which.

**What would flip it:**
- **Coursera declines the application.** Then DataCamp: same account, but ask in writing about a custom-sized creative.
- **The owner has Vietnamese banking and wants per-city slides.** Then ShopeeFood for HCMC alongside Coursera for SF.
- **Measured traffic reaches thousands of home views a month and the readiness objective shows real CTR.** Then the direct "sponsor this slot" sale, priced on those numbers, beats any affiliate.
- **The owner is willing to endorse a bootcamp.** Then Springboard, as the lottery ticket.

## Category change (house-rules)

- **Coursera, DataCamp, ShopeeFood and the house creative: not a category change.**
  - The site gains an `<a href>` to a new host and a self-hosted image.
  - House-rules' "new outbound destination" names "a request, form action, script source, or embedded resource", and a link a person clicks is none of those (I, reading `.claude/skills/house-rules/SKILL.md:95`).
  - The driver should still say it in the owner's language: "the ad links to an Impact tracking address."
  - The Impact account is an owner business relationship. It is not a service the site calls.
- **It becomes a category change** (ADR plus owner question) if anyone:
  - installs Impact's Publisher Tag or Skimlinks (a script),
  - hotlinks a banner or Amazon image from a partner CDN (an embedded resource),
  - or keeps a partner's impression pixel in the markup.

## Consent and the About page

The site sets no cookie for the ad, and the image is self-hosted, so viewing the slide tells no third party anything (I, following PR #208).

**Clicking** is different. The tracking link redirects through Impact (or Shopee), and the redirect sets that network's attribution cookie, which is how the commission is credited. That is the mechanism the programme terms describe ([DataCamp terms on "commission tracking cookies"](https://www.datacamp.com/affiliates/terms-and-conditions), P; [Udemy, "What is a cookie"](https://partnersupport.udemy.com/hc/en-us/articles/360049412573-What-is-a-Cookie-How-Long-do-Cookies-Last), P).

The About page's "no cross-site tracking cookie" stays literally true of *this site*. A careful reader might still feel misled. **I recommend one added line on the About page**, for example: "The ad slide links through an affiliate network, which sets its own cookie on your browser if you click it." That wording is a product call for the designer and owner.

## Disclosure

- **FTC.** Disclosure must be "clear and conspicuous", and closer to the link is better. The FTC's FAQ says "Paid link" next to an affiliate link "should be an adequate disclosure" ([FTC, Endorsement Guides: What People Are Asking](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking), P).
- **Is the "Ad" label enough?** The label PR #208 already requires on the slide is the same kind of disclosure (I). No extra line is strictly needed for Coursera or DataCamp.
- **Amazon would have required its exact sentence**, which is one more reason it is discarded.
- **Vietnam.** I did not research Vietnamese advertising-disclosure law. The "Ad" label is assumed sufficient there (A).

## #79 and identifiers

- No affiliate ID, tracking URL or sub-ID ever goes into an event. The carousel sends no events today, so nothing goes quiet (PR #208).
- **The tempting mistake is the other direction.** Impact and Shopee links accept sub-ID parameters, and putting this site's random browser ID into one would hand a per-visitor identifier to a third party.
- **The rule for the children:** the tracking URL is used exactly as the owner supplies it, and code never adds query parameters to it. A static placement label the owner types into the URL (such as `carousel-sf`) is fine, because it identifies a slot, not a person.

## Owner steps

1. **Create an Impact partner account** (free). Complete the tax form (W-9 if a US person, W-8BEN otherwise; the form choice is I) and a payout method. Payouts start from $10.
2. **Apply to Coursera's B2C Affiliate Program on Impact.** In the same sitting, apply to DataCamp as the fallback.
3. When approved, **generate one tracking link** to the chosen landing page, for example the Google Data Analytics certificate. Optionally add a static sub-ID such as `carousel`, never a per-visitor value.
4. **Supply the creative:**
   - a self-made image in the carousel slide's dimensions (Coursera permits your own format)
   - alt text
   - the advertiser name ("Coursera")
   - the tracking URL
   - For DataCamp, use a banner they supply, unmodified, or get written permission for a custom one.
5. **Decide the About-page line** (above).
6. *(Only if choosing ShopeeFood for HCMC:)* a Shopee Affiliate account with passport or CCCD, a tax code and a Vietnamese bank account in the same name.
7. *(Only if choosing a bootcamp:)* decide whether the site should endorse one. That decision is the owner's.

## Buildable now

**Nothing beyond PR #208's static slot.** The designer and engineer children do not need a script, a CSP change, a consent banner or an ADR for any shortlisted candidate. Three things to carry into their criteria:

- **One creative for both cities.** Per-city creatives are not required by the first pick. The slide config is already per city (`CAROUSEL_RESTAURANT_SLIDES`, V), so allowing it costs nothing, but no criterion should demand two creatives.
- **Use the URL verbatim.** The link keeps `rel="sponsored noopener"` and no `noreferrer`, because networks may review traffic sources (I). Code never appends parameters to the URL (#79, above).
- **Two copy items:**
  - The existing "Ad" label on the slide. No extra disclosure line is needed for Coursera or DataCamp.
  - The optional About-page line above, if the owner agrees.
- **Position (designer's call).** The first slide is the only one every visitor sees, because a later slide needs the visitor to stay 5s times its index (I). If the owner wants the slot to earn, it should replace a restaurant ad slide early in the sequence, not late.

## Searches that came back empty

- **Blocked by the egress proxy (policy denials, not retried):**
  - `affiliate-program.amazon.com`, `bookshop.org`, `support.bookshop.org`
  - `datacamp.com`, `coursera.org`, `partnersupport.udemy.com`
  - `vercel.com`, `posthog.com`, `amplitude.com`, `help.maven.com`, `docs.github.com`
  - `affiliyo.com` failed DNS.
  - Every P above is therefore a domain-restricted search summary, not a full read.
- **Coursera, the case against:** "Coursera affiliate application declined Impact" and "Coursera affiliate commission cut 2025 2026 complaints" found no experience reports either way.
- **Carousels:** no programme term found that addresses rotating carousel or slider placement, for or against.
- **Amazon self-hosted images:** no primary line found that explicitly forbids downloading and self-hosting Amazon images. The summaries say only that images come "from its own servers" or "official channels".
- **Supabase:** no affiliate programme on supabase.com. The only claim is one secondary that says the official page is unavailable.
- **PostHog:** no published commission. The partnerships page is a register-interest form.
- **Springboard:** cookie window not found.
- **TripleTen:** no primary page for the programme; $800 (FlexOffers) versus ₹3,449.79 (Cuelinks) is unresolved.
- **Coursera regional pricing for Vietnam:** not found.
- **Impact inactivity closure:** none found. Only the maintenance fee for balances Impact cannot pay out.
- **GrabFood affiliate:** only a May 2021 ADPIA launch announcement ([ADPIA](https://adpia.vn/khoi-song-chuong-trinh-tiep-thi-lien-ket-grab-c491857.html), S). No current terms found.
- **"88% of clicks come from text links":** the claim ([AutoAffiliateLinks](https://autoaffiliatelinks.com/contextual-links-vs-banner-ads-what-the-data-says-about-affiliate-conversion-rates/), S) names "an affiliate network report" without citing it. Not traced, and not used.

## Assumptions the ranking rests on

These are A, unverified, and load-bearing:
- Soft-launch traffic is in the hundreds to low thousands of home views a month.
- Purchase rate on click is 1-3%.
- Impact brands will approve a low-traffic parody-app site. If they will not, the house creative is the only option that is certain to be accepted.
- The owner is a US tax resident with no Vietnamese bank account.
