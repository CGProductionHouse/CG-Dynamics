# CG Marketing Intelligence: audience, creative and growth

**Version:** 2026-09-19.1  
**Owning issue:** CGProductionHouse/CG-Dynamics#426  
**Status:** Research and reference implementation. NOT live Library ingestion, production UI, campaign configuration or approved marketing doctrine.  
**Boundary:** Outside Milestone 1. No ad spend, external publishing, production writes, provider changes or client-folder changes.

## 1. The commercial goal

Make every creative decision answer a business question. A video is not complete because it looks good; its brief should explain whose decision it is intended to influence, what prevents that decision, what evidence the creative supplies, what action is appropriate and how the result will be assessed.

The proposed CG operating loop is:

**Business constraint → objective → relationship and intent → message and proof → creative brief → distribution and landing experience → observed business outcome → reviewed learning → next monthly plan.**

This is a design proposal derived from CA's brief, not a claim that a three-stage funnel guarantees better advertising results. Use it for organic production now through staff-reviewed briefs; connect it to paid execution only after the separate measurement and provider gates pass.

The advantage should be accumulated client understanding and better decisions, not an ever-growing pile of research. Deliver a small number of useful, reviewed choices each month. Record the reason behind each choice so staff and clients can understand it.

## 2. What already exists, and what this adds

Repository inspection was anchored to main `ba53baf9f224684171c686d674725d7b1efcd795` on 19 September 2026. This is a scoped inspection, not a claim that every file, client or production record has been audited.

| Existing authority | Evidence inspected | Treatment |
|---|---|---|
| Marketing Library principles | `docs/marketing-library/README.md` | Keep the existing Library and source hierarchy. |
| Industry research inventory | `docs/ai-workforce/HUMAN-MARKETING-GOLDMINE-MASTER-INVENTORY-2026-08.md` | Reuse its 18 industry/expansion packs. The inventory is not proof of live registration. |
| Current Marketing workspace | `src/pages/admin/MarketingWorkspacePage.tsx` | Existing Library, Sources, Review, Registration, AI and Client Guides are the product home. |
| Distinct-source registration | `src/lib/marketing-library/sourceRegistry.ts` | Deduplicate by stable source identifier; preserve source/container distinction. |
| Canonical card types | `src/types/skillCards.ts` | Reuse draft / needs_review / reviewed / active / deprecated. |
| Lifecycle messaging foundation | `docs/ai-workforce/LIFECYCLE-MESSAGING-CRM-SOURCE-PACK.md` | Reuse consent, suppression, lead-stage and delivery-truth distinctions. |
| Monthly strategy | #391 and operational handover | Extend exact-client/month strategy, not a second strategy store. |
| Schedule and production | `monthly_deliverables`, existing Content Guidelines / Content Runs | Link the same work; do not create another calendar or shot-list authority. |
| Enquiries and business outcomes | #405 | A contact action, enquiry, qualified lead and won sale remain separate. |
| Provider reporting | Existing Meta, Google and TikTok lanes | Consume their outputs; do not replace sync, account mapping or metric definitions. |

**Current gap this checkpoint addresses:** a clear contract connecting audience reasoning, asset production, source evidence and monthly strategy. Current code already implements parts of registration and approved-only retrieval; it would be inaccurate to describe those as wholly missing based on the older inventory.

**Not verified here:** production Library row counts or approval coverage; every client's current audiences, permissions and commercial results; all prior research artefacts; production retrieval acceptance. Google Control Centre access returned HTTP 403. This work therefore does not reserve or alter active application files.

## 3. Keep the simple language, improve the underlying model

Use **cold, warm and customer** in client-facing explanations, but store the following dimensions separately.

| Dimension | Values / evidence | Why it matters |
|---|---|---|
| Relationship | Cold planning label, warm, customer, unknown | Unknown is not proof of no previous exposure. |
| Current intent | Discovery, consideration, ready to act, unknown | A first-time Search visitor can have high intent; a follower can have low intent. |
| Lifecycle | Prospect, lead, first purchase, repeat, lapsed, service recovery, unknown | A customer is not automatically satisfied or currently ready to buy. |
| Recency | Observed event date and explicit lookback definition | Define lapsed against the business's purchase cycle, not an arbitrary universal number. |
| Evidence basis | Verified fact, client input, research inference, needs confirmation | A proposed audience is not a measured audience. |
| Reachability | Permitted first-party use, suppression state, provider eligibility | Having a customer list does not itself establish permission or usable matched reach. |
| Delivery mode | Strict intended selection, expanded, signal, organic mixed, unknown | Creative intention must not be presented as exclusive delivered reach. |

Do not implement three compulsory campaigns or fixed budget percentages. Campaign structure should follow usable scale, objective, cost, provider controls and a testable reason to separate delivery. A broad campaign can use several stage-aware creative angles. An organic post can be written to reassure familiar followers without claiming only those followers saw it.

Google explicitly describes Performance Max audience signals as suggestions, with possible delivery beyond the signal [G1]. TikTok documents a minimum of 1,000 matched users for Custom Audience use in an ad group [T1]. These are different contracts, not interchangeable implementations of a universal warm bucket.

### The messaging jobs

**Cold / unknown familiarity:** make the offer relevant and understandable; show the product, problem or experience; establish enough credibility to justify the next step. Do not force a long introduction when intent is already high.

**Warm / considering:** identify the unresolved decision. Show fit, process, demonstration, a specific answer to an objection, credible proof or a clear next step. Do not assume every warm person needs a discount.

**Customer / return:** offer a genuine reason to return, replenish, try a complementary product or refer. Verify the previous conversion when making a customer-status claim. An unresolved complaint or refund belongs in service recovery, not automatic upsell.

These are CG creative hypotheses to test, not universal behavioural laws.

## 4. Creative production contract

The minimum useful brief contains: objective; relationship and intent; basis and evidence; audience obstacle; message; proof; offer conditions; format and distribution; shot/design requirements; CTA; landing path; outcome definition; measurement limitation; experiment; reviewer.

### Video

Choose the opening from the decision problem, not from a stock hook bank. A discovery concept may show the product or occasion immediately. A consideration concept can open with a genuine question customers ask. A repeat-purchase concept can introduce what is newly relevant, without pretending everyone watching is a previous buyer.

The script should specify opening, development, proof and action. The shot list must contain the proof required by the script. Capture clean sound, recognisable real products, accurate signage and usable end frames. Prepare alternate openings and CTA endings only when they serve a planned comparison. Decide pacing and duration from the idea and placement, not a universal winning length.

### Posters and graphic design

Write one primary message with a readable hierarchy. Decide whether the reader needs basic context, a product detail, an objection answered or a current offer. Product names, prices, dates, quantities, exclusions and booking conditions require current approval. The designer should know which fact must be noticed first and which detail must remain legible on a phone.

A warm-audience poster need not become a loud sale poster. A simple explanation of how a booking or fitting works might address the real obstacle. Urgency must come from genuine availability or a verified deadline.

### Photography

Plan a reusable evidence set, not just attractive hero images: product detail, scale or fit, product in use, real people delivering the service, the environment, location cues and the customer's experience where consent permits. Capture crops with room for copy. A product-detail question needs a detail image; trust in service delivery may need real process imagery.

Before/after images, testimonials, customers and creator footage require rights and claims review. Do not generate a fictional outcome, client or venue and present it as evidence. Working photography remains internal production material; it is not a new client-portal category.

### Copy

Use the exact client's language and exclusions. A caption should complement the supplied artwork, not transcribe it. Distinguish the benefit being proposed from an outcome that has actually been proved. Keep the CTA proportional to intent. Explain friction honestly rather than promising that every enquiry becomes a booking.

### Landing experience

The destination must continue the same promise, product and conditions. Verify the next step works on a phone. A WhatsApp click is an action, not a conversation; a submitted form is not a qualified lead; a booking request is not an attended booking. Record these as separate events, with unknown outcomes left unknown.

## 5. Platform playbooks: bounded current findings and next gates

### Meta: Facebook and Instagram

**Working design:** distinguish discovery, consideration and customer creative; assess the actual account's available objectives, optimisation event, audience controls, exclusions, catalogue, placements and reporting before campaign design. Compare broad stage-flexible creative with separately addressable cohorts only when the latter are actually eligible and useful.

**Important evidence boundary:** Meta advertising objective/audience help pages returned login/temporary-block responses; the Conversions API deduplication page returned a rate-limit response. This checkpoint does not certify those current technical settings. Do not replace unavailable first-party verification with guru claims or hardcoded rules.

**Required completion mission:** verify the exact campaign/objective and conversion-location combinations, Advantage+ control versus suggestion behaviour, website/engagement/customer-list eligibility, customer acquisition and exclusion options, account region, Pixel/CAPI event matching and deduplication, attribution settings, creative rights, catalogue readiness and actual measurement coverage. Record exact sources, access dates and account observations privately. Reuse the existing Meta engineering lane rather than implementing a second connector.

**Retention channel distinction:** Meta's WhatsApp publication describes user control over business messages and pre-approved templates for API-initiated messages [M1]. That supports a separate consent/suppression gate; it does not prove permission to upload a list or launch ads.

### Google: treat the products separately

Google documents distinct text, image, video and Shopping formats rather than one creative specification [G5]. The following product roles are CG planning proposals; live availability, eligibility and configuration must be checked for the exact account.

| Product | Planning role | Creative / destination | Main evaluation question |
|---|---|---|---|
| Search | Capture an expressed problem, product or service need | Intent-specific copy and a matching page; separate brand and non-brand analysis | Did the query produce a qualified or profitable action? |
| Shopping | Product-led discovery and purchase consideration | Accurate product imagery, title, current price/availability and product page | Did the order contribute after product and fulfilment costs? |
| Performance Max | Automated cross-placement acquisition where measurement and assets are suitable | Coherent asset groups, product/feed inputs where relevant, accurate conversion values | What is attributable, what is incremental, and how much is existing demand? |
| YouTube / Video | Demonstration, education, trust and demand development | A video concept made for its viewing context, not a stretched poster | Did exposure affect a meaningful downstream outcome? |
| Demand Gen | Visual discovery and consideration | Product/experience creative with an intentional next step | Is it adding valuable demand rather than duplicating existing demand? |
| Display | Visual reach or revisiting an eligible audience | Focused visual message and matching destination | Is observed lift credible after audience and placement differences? |
| Local intent / Maps surfaces | Help a nearby customer act | Verified business information, availability and directions/booking path | Is a direction/call action being mistaken for a verified visit? |

Performance Max signals are suggestions, not a strict warm-only audience [G1]. Enhanced conversions support first-party matching, including offline lead outcomes in the lead variant; they are not a promise of perfect attribution [G2]. Google customer-lifecycle setup is a distinct capability with product-specific eligibility, not a blanket rule for every list or campaign [G3].

Google lifecycle reporting is limited to purchase conversions with the relevant goal enabled. Its customer classification has measurement limitations, and value adjustments must be distinguished from unadjusted conversion value [G4]. CG should never label a bidding value adjustment as verified store revenue.

### TikTok

Treat the creative as native to the viewing experience: a clear opening, an understandable product or human demonstration, believable delivery and an appropriate action. Test these as creative hypotheses, not claims that amateur-looking content always beats polished production.

Spark Ads use organic posts, including authorised creator posts [T2]. Secure the exact reuse permission before planning paid distribution. The Custom Audience threshold is specific to ad-group use [T1]. Smart+ documentation updated in August 2026 describes an upgraded experience that may not be available to every account [T3]; store capability checks rather than assuming universal rollout.

**Required completion mission:** verify South African account/product availability, campaign objectives, optimisation events, targeting/expansion controls, Pixel/Events API contracts, measurement, creator/music rights and any Shop relevance. Do not assume TikTok Shop is available to a given South African business. Publishing access and advertising access are separate.

### Other channels

Consider LinkedIn only when professional audience fit, sales value and capacity justify it. Consider consented email/WhatsApp retention where first-party permission and a useful message exist. Investigate another platform only after articulating the customer behaviour and business problem it would address. No new subscription or integration is justified by a long feature list alone.

## 6. Industry specialisation

Start with six decision systems. All examples below are hypothetical creative directions, not approved offers or claims about a real client.

| Industry | Cold / discovery | Warm / decision | Customer / return | Business result and main caveat |
|---|---|---|---|---|
| Restaurant / hospitality | Real food plus the occasion and location | Answer a booking, menu or experience question with real evidence | A genuinely new menu item, occasion or event worth returning for | Attended bookings, covers and contribution where observed; directions are only a proxy. |
| Physical retail | Product in use and why visiting is worthwhile | Fit, finish, variants, demonstration or store assistance | Complementary products or verified new arrivals | Verified transactions/visits where available; stock, price and availability must be current. |
| Ecommerce | Product problem, demonstration and differentiation | Product detail, fit, delivery, returns and credible reviews | Replenishment, compatible add-ons or a useful bundle | Net orders and contribution after returns; platform ROAS is not profit. |
| Local services | Recognisable problem, service area and competent process | Qualification, what the quote includes, real work and objections | Maintenance or another appropriate service at a sensible interval | Qualified enquiries, booked jobs and won contribution; a click is not a lead. |
| Professional / B2B | A relevant business problem and specific expertise | A permissioned case, process or purchasing-risk answer | Further work with a real business need | Qualified opportunities and won value over the sales cycle, not cheapest lead. |
| High-risk / regulated sectors | Accurate, supported explanation | Carefully reviewed proof and clear limitations | Appropriate service communication | Claims, targeting and privacy need sector-specific review; no sensitive-trait inference. |

Next expand using the existing agriculture, automotive, construction, legal, healthcare, finance, security, tourism, education and community/event packs. Do not convert an industry hypothesis into a client fact.

For each exact client, assemble a private relevance record: canonical client ID; verified business model; objective; constraints; audience evidence and gaps; permissions; candidate channels; production opportunities; outcome source; review owner. Use VERIFIED FACT / CLIENT INPUT / RESEARCH INFERENCE / NEEDS CONFIRMATION labels. Do not copy client lists, identities or private results into this public repository.

## 7. Ecommerce economics and agency economics

Before scaling, understand what an incremental sale can afford. The following is accounting arithmetic for planning, not a forecast or professional financial opinion.

**Pre-ad order contribution = net revenue − product cost − variable fulfilment − payment fees − other variable costs.** Returns and discounts must already be reflected appropriately in net revenue or the cost assumptions, without double counting. New-customer paid acquisition cost must be compared with that contribution and the business's desired surplus. Future repeat value may justify a different ceiling only with a defensible cohort model and cash-payback constraint.

Synthetic illustration: net revenue R1,000; product cost R450; fulfilment R80; fees R30; other variable costs R40. Contribution before media is R400. Paying R400 to acquire this single order leaves zero contribution toward fixed costs or profit. On those assumptions, first-order break-even revenue ROAS is 2.5. This is not a recommended target or client result.

For CG, show agency fees, production effort, revision effort, reporting effort and software cost separately from client media spend. Protect creative quality and account-management capacity in package pricing. A performance fee needs explicit outcome definitions, attribution limitations, refunds, baseline and responsibility boundaries; do not base it on an ambiguous platform number.

## 8. Learning loop that does not manufacture certainty

Tag the strategy and creative before delivery. The minimum observation links exact client and period, immutable creative version, canonical deliverable, platform/account/campaign/ad identifiers where permitted, intended stage, delivery mode, optimisation event, spend and currency, attribution definition, outcome source, observation window and limitations.

Keep three views distinct: **provider-reported results; first-party business outcomes; experiment-based incremental estimates.** Never sum each platform's attributed revenue into total business revenue. Never infer audience-specific performance if the provider does not expose that breakdown. Never replace unavailable or untracked metrics with zero.

Pre-register the comparison: question, mechanism, primary outcome, smallest useful effect, allocation unit, observation window, stopping rule, exclusions, cost/quality guardrails and confounders. Randomised comparisons are preferable when feasible; non-randomised observations must retain that label. Creative tests should control other material differences where possible. An uneven provider delivery pattern is not automatically a clean A/B test.

A learning record should say: what was compared; population; measured outcome; estimate and uncertainty where available; evidence type; limitations; practical decision; expiry/retest condition; reviewer. Sample adequacy depends on baseline, effect size and design, not a universal minimum number of clicks. Noisy results should produce a narrower next test, not a triumphant winner badge.

Use a learning ladder: **hypothesis → observation → replicated observation → experiment-supported finding → reviewed reusable guidance**. A single client's observation remains client-specific unless a reviewer justifies generalisation.

## 9. The monthly client experience

The client should see a clear decision, not the full internal research archive:

> **This month's focus:** help people who already know the business take the next step, while continuing to introduce it to new people.  
> **Why:** the current evidence or client input suggests an unresolved decision. Where evidence is missing, we will test rather than claim certainty.  
> **What we will create:** one answer-led video, one real demonstration, supporting product/detail photographs and one clear action-led design.  
> **How it reaches people:** organic content first; paid audience delivery only if separately approved and eligible.  
> **Success:** the relevant qualified enquiry, attended booking or net purchase, with tracked actions shown separately.  
> **Next decision:** continue, revise or stop the tested angle after the agreed observation window.

This is a synthetic model, not a saved or published plan. The actual plan must use exact client context, exact selected month and the existing review/approve/publish workflow. Link deliverables already in Client Schedule. Never auto-publish a strategy from a research import or change an approved plan silently.

## 10. Research authority and files

This folder extends the existing Marketing Library. `sources.json` contains bounded paraphrases, access states and review candidates; it is not a second live database. `IMPLEMENTATION.md` defines integration missions. `reference.mjs` and its tests are side-effect-free reference code, not production access controls. The generated HTML is a reading and brief-exploration view of these files, not a replacement application.

Keep public generic intelligence and implementation contracts in GitHub. Keep exact-client facts, commercial evidence, consent, customer lists and permitted media in their existing private authorities. Store source links and metadata rather than duplicating large media or copyrighted pages. Do not create new OneDrive client-portal categories or a second research archive by default.

All source-derived platform findings below remain **needs_review** for CG activation. Full-page retrieval is not human approval, legal clearance or evidence that a feature is enabled for a client.

### Official source ledger

Access date for the following: **19 September 2026**. Page dates are recorded separately when available. Findings are deliberately narrow.

- **G1:** Google, About audience signals for Performance Max. https://support.google.com/google-ads/answer/14530785?hl=en
- **G2:** Google, About enhanced conversions. https://support.google.com/google-ads/answer/9888656?hl=en
- **G3:** Google, customer lifecycle audience setup. https://support.google.com/google-ads/answer/14007601?hl=en
- **G4:** Google, Measure your lifecycle goals campaigns. https://support.google.com/google-ads/answer/15597581?hl=en
- **G5:** Google, About ad formats available in different campaign types. https://support.google.com/google-ads/answer/1722124?hl=en
- **T1:** TikTok, About Custom Audiences (updated November 2025). https://ads.tiktok.com/resources/help/article/custom-audiences
- **T2:** TikTok, Spark Ads (updated June 2026). https://ads.tiktok.com/resources/help/article/spark-ads
- **T3:** TikTok, Smart+ upgraded experience (updated August 2026). https://ads.tiktok.com/resources/help/article/about-updates-to-smart-plus?lang=en
- **M1:** Meta, Ways to manage your business chats on WhatsApp (3 April 2025). https://about.fb.com/news/2025/04/ways-to-manage-your-businesses-chats-on-whatsapp/

Blocked verification leads, not evidence for substantive product claims:

- **M2:** Meta Advantage+ audience. https://www.facebook.com/business/ads/meta-advantage-plus/audience
- **M3:** Meta advertising objectives. https://www.facebook.com/business/ads/ad-objectives
- **M4:** Meta Pixel / Conversions API event deduplication. https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events/

### Research completion boundary

This is a substantial first implementation foundation, not the completed world-class platform academy or a full audit of all client accounts. Meta technical verification, detailed Google/TikTok operating procedures, regional product eligibility, sector compliance, client-by-client readiness, live Library acceptance and actual campaign experiments remain explicit missions. They must be completed with evidence rather than hidden behind a polished interface.
