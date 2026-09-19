# Competitive Creative Intelligence

Version 2026-09-19.1 · CG Dynamics / #426 · Research and reference implementation, not production activation.

## 1. The decision this research should improve

CG needs a repeatable way to discover useful creative references, understand their limitations, and produce original work that addresses a client's actual business problem. The target is not a warehouse of downloaded ads or an AI that calls everything a winner.

**Business question → relevant references → observed mechanism → alternative explanations → original creative hypothesis → approved brief → own outcome evidence → reviewed learning.**

This chapter extends the audience-lifecycle and commerce-psychology work already on main. It adds a reference-research method and evidence contract; it does not repeat the previous platform playbooks or create another Library. Founder input is the reason for the investigation, not validation of the influencer's claims. No new screenshots or exact influencer demonstration were supplied for this chapter; their individual claims cannot be audited from unseen material.

The commercial recommendation is native-first discovery, followed by a measured assessment of any paid tool's extra workflow value. Do not assume native tools cover 70–80% of CG's needs: that percentage is a hypothesis to measure against defined research tasks, not a finding of this study.

### Existing authority and scoped audit

Checked GitHub main: `73a90a1213678b79a2fd0ae8c8de3043ca7da019`, incorporating research PRs #427 and #428. The July Advertising Evidence Library already separates evidence, study design, limitations and prohibited overclaims. The Marketing workspace already uses canonical sources, skill cards, review and registration. The first-pack Library bridge remains owned by `feat/426-marketing-intelligence-library-bridge`.

This work owns only a new `competitive-creative/` research folder. No parent manifests, generated source files, app routes, provider sync, strategy persistence, media folders or active implementation branches are changed. CG Dynamics runtime tools were not discoverable; the Google Control Centre returned 403. Therefore no live Library counts, client audience facts or tracker update are claimed.

## 2. What the native tools can actually establish

The following are documentation findings, not proof that CG's accounts have API access. Source IDs resolve in `evidence.json`; access date is 19 September 2026. Publication dates and read coverage are recorded separately.

### Meta Ad Library

Use it to investigate advertiser identity, creative, offer, placement and disclosed activity. Meta's 2023 announcement describes an expanded EU archive with targeting and delivery information retained for a year [M1]. That historical announcement is useful context, not the complete current API contract.

Indexed text of Meta's current API page describes broader ordinary-ad coverage for EU/UK delivery and separate worldwide issue/political-ad coverage [M2]. Its field descriptions restrict the `spend` field to the latter category. Direct API documentation access was blocked in this session, so these are **indexed-reference findings requiring re-verification**, not tested endpoint capabilities. A country code existing in an API enum does not prove ordinary commercial coverage for that country.

Consequently, never promise a worldwide competitor-spend feed for South African clients. In particular, public reach, advertiser activity and a vendor's derived spending estimate must not be collapsed into a verified exact spend field. The public Library page returned no readable ad records here [M0]; this is an access limitation, not evidence that a market has no active ads.

### TikTok Creative Center / Top Ads

TikTok describes Top Ads as a selected collection of high-performing, advertiser-authorised creative [T1]. It is not a census of every ad, and it cannot provide a complete failure denominator. Official instructions document search/filter options, metric-based sorting, collections and relative second-by-second creative analytics; logged-out users see only five ads [T2].

Preserve the metric's original unit and scope. A percentile is not a percentage click-through rate, and a relative retention curve is not an order count. A high rank for one objective does not demonstrate profitable purchases. Save the specific region, objective, date window and sort order alongside a reference. An empty parsed shell during this research was not interpreted as an empty category.

### TikTok Commercial Content API

This is separate from Top Ads. The public product overview still describes an EU-first scope [T3], while the supported-country documentation includes the EEA, UK and Switzerland [T4]. The newer indexed documentation is dated 1 September 2026. The current country table does not list South Africa.

Endpoint scope matters: indexed documentation for the **non-paid commercial-content** query excludes UK/Switzerland even though the broader country table includes them [T5]. Do not create one universal country list for every TikTok endpoint. Engineering must recheck the selected endpoint, approval, authentication, fields, retention and purpose before connecting it. None was called here.

### Google Ads Transparency Center

Google's current help describes advertiser/website search with location/date filtering and coverage across several Google properties. It includes verified and unverified advertisers, not just the verified advertisers described in older launch material. Google also documents API access for **EEA-served ads**, with separate access provisions for specified regulatory organisations outside the EEA [G1].

The useful distinction is not “Google has no API”; it is “this does not establish a general worldwide commercial API entitlement for CG.” The documentation concerns advertiser/ad disclosures, not a competitor's margin or a causal explanation of sales. Keep advertiser, payer, location and verification status distinct. A verified advertiser badge does not certify the quality or effectiveness of an offer.

### Native-source operating recommendation

Start with the exact advertiser or brand domain, then category/problem/offer terms. Set the intended market before comparing creative. Expand geography deliberately when local supply is sparse, but keep foreign-market references labelled as transfer hypotheses. Verify the matching landing page separately and record when it was observed; today's destination may not be the page used during a historical campaign.

Use documented interfaces or approved APIs. Do not bypass a login, captcha or geographic restriction; do not substitute an undocumented internal endpoint or broad scraper because an official query fails. Record the bounded gap and proceed with accessible evidence.

## 3. Paid tools: what is worth evaluating

These are **vendor-documented capabilities**, not a hands-on accuracy benchmark. No account, free trial, subscription or paid API was enabled. We checked public product/help pages, not actual client coverage or export completeness.

| Tool | Potential CG job | Important evidence boundary | Proposed decision |
|---|---|---|---|
| Brandsearch | Brand/store discovery, creative and landing-page research, saving/export | Revenue and traffic are explicitly directional estimates. Exact source and transformation of any spend field need confirmation. | Candidate when store/brand research is a repeatable bottleneck. |
| WinningHunter | Ecommerce discovery, advertiser/store tracking and creative filtering | Its own tracker help describes sales as a ballpark with weaker coverage for newer/smaller stores. | Candidate for an established-store research task, not a default local-client intelligence feed. |
| Kalodata | TikTok commerce/product/creator research | Public-channel data refined with AI; transaction and ad-spend figures can vary. Shop-market fit is a separate gate. | Relevant only when the business actually needs supported TikTok commerce research. |
| Foreplay | Reference organisation, tracking, briefs, collaboration and export/API | Search/archive convenience is not competitor profit evidence; some features remain marked coming soon. | Useful alternative to test for research workflow efficiency. |
| Motion | Own-account creative analysis alongside inspiration | Its MCP explicitly separates competitor creative metadata from own connected-ad performance. | Study its product boundary; do not replace CG's canonical reporting merely for a tool demo. |

Brandsearch's About page explains that revenue/traffic estimates use public signals, third-party panels and modelling rather than accounting data [B1]. Its public materials also advertise EU/UK spending intelligence. Because the accessible Meta field evidence does not establish ordinary commercial exact spend, a claim of official spend requires a field-level provenance demonstration. This is an unresolved verification requirement, not a conclusion that the vendor is dishonest. Product coverage also differs across marketing pages/indexed text; confirm a known Google ad can actually be found before buying for Google coverage [B2].

WinningHunter's public sales-tracker help says its figures are not exact and are strongest for established stores, generally around $100,000+ monthly turnover; smaller/newer stores can lack estimates [W1]. That is the vendor's stated suitability boundary, not a validated accuracy threshold. The returned page also mixed an unavailable store state with illustrative feature panels: no displayed sample numbers were accepted as real advertiser observations.

Kalodata's own FAQ says its public data is refined with AI and should not be used for high-precision settlement or performance evaluation. It also states that it is independent of TikTok [K1]. A vendor-estimated shop total cannot be assigned to one ad, and a shop estimate does not prove net revenue after returns or contribution after costs.

Foreplay documents Discovery, tracking and saved-reference API surfaces [F1]. Its pricing table separately marks Google Transparency Center support as coming soon. The same page has conflicting trial wording, including both no-card messaging and a card/automatic-subscription explanation. Trial billing and cancellation must be confirmed before any account action [F2]. Its archive and organisation may be valuable even when no new outcome truth is added.

Motion's documentation is especially useful as an architectural reference: competitor inspiration returns creative metadata, while performance calls concern one's own connected ads. The documented MCP is read-only and Meta-only at the reviewed scope [O1]. This is not proof that the full product supports only Meta, nor a reason to connect CG credentials. A paid tool's AI-generated audience or explanation remains an inference.

### Pricing and procurement evidence

Verified public monthly price displays: WinningHunter Basic $49 and Standard $79 [W2]; Foreplay Basic $59, Workflow $175, Agency $459 [F2]. Foreplay's Basic plan should not be assumed to include paid brand tracking just because the product names appear in its heading list; the detailed table distinguishes access. Prices are USD displays, not South African landed costs or approved spend. Recheck tax, seats, quotas, renewal, exports and billing period at approval time.

Brandsearch's rendered pricing page exposed plan labels but not a stable price in the retrieved text [B3]. Kalodata pricing returned an interface shell [K2]. Motion pricing is scope/spend-dependent and was not reduced to a reliable comparable agency quote [O2]. Do not fill these gaps from affiliate comparison sites or an annual-equivalent headline. No tool is recommended for purchase yet.

## 4. Reference evidence is not performance evidence

Use field-level provenance, not a single green confidence badge on an entire ad.

| Basis | Safe interpretation | Unsafe upgrade |
|---|---|---|
| Platform disclosure | The platform disclosed this value/range, for this region and period. Preserve any modelling qualification. | Official source means exact, complete or profitable. |
| Direct observation | The reviewer saw this text, frame, sequence or destination at this time. | The observer knows the actual audience, spend or conversion rate. |
| Vendor estimate | The named vendor estimates a value using its stated or unknown method. | Treat as verified sales, settlement or ad-attributed revenue. |
| Publisher/advertiser case report | The publisher reports a result for a described campaign. | The result is independently audited, causal, net profit or transferable. |
| CG verified outcome | An authorised first-party record exists, with defined coverage and costs. | Any good result proves the creative alone caused it. |
| Inference | A plausible explanation or audience-stage hypothesis. | Treat as observed intent or proven mechanism. |
| Sample/synthetic | A demonstration used to test the system or explain an idea. | Ingest as a real market observation. |

A long-running ad can justify inspection, but cannot establish profitability. It may have small spend, intermittent delivery, a brand objective or a different commercial goal. An ad disappearing can reflect a promotion ending, stock, seasonality, review or incomplete monitoring. Therefore **active is not winner; missing is not loser**. These are limits of inference, not claims about any particular advertiser.

Variant counts also need care. Ten creative IDs from one advertiser may represent one underlying family. A scrape appearing in three tools is not three independent examples. Count unique native records, creative families and advertisers separately. A platform-selected gallery is selection-biased for discovery; it does not tell us how often the pattern fails.

Reported observations and experiments remain different. To learn what did not work for CG, use the exact intended objective, comparable delivery window and own qualified outcomes, respecting the earlier commerce chapter's validity gates. Where outcome data is absent, the correct statement is “business effect unknown,” not “unsuccessful creative.”

## 5. A research method that produces a usable brief

The following is a **proposed operating protocol**, not a statistically validated sampling prescription.

### Define the question before searching

Start from an exact client's approved objective and a decision obstacle: for example, making the booking process understandable, demonstrating product fit or reducing uncertainty around a quote. Record geography, language, audience/intent hypothesis, price point, format, offer restrictions, available production and destination. Do not mine the internet for fashionable hooks and then invent a customer problem to justify them.

### Sample deliberately

For a first working exercise, use a time-boxed sample across direct competitors, category leaders and a small number of adjacent-category references. A practical starting budget could be five direct competitors, three leaders and two analogues, with about 24 candidate ads and no more than four from one advertiser. These numbers control effort; they do not confer statistical confidence or prove category prevalence.

Record search terms, filters, sort order, country, session/login limits, scan time, exclusions and empty/inaccessible searches. Include ordinary references as well as highly ranked selections where access permits. Keep the denominator “records inspected in this search,” never “all market ads.” Stop collecting when additional examples no longer change the useful hypotheses; record the stopping reason.

### Deconstruct without pretending to watch unseen media

A full-video review can analyse opening, development, proof, pacing, audio and CTA. A still or thumbnail can support only visible elements. A transcript supports spoken wording but not exact lighting, motion or timing. A case report supports the publisher's description, not a frame-by-frame reconstruction.

Capture the observed hook, promised benefit, offer/conditions, proof form, visual order, action and landing match. Keep a separate box for the hypothesised mechanism, audience stage and alternative explanation. For example: “The format may reduce uncertainty through demonstration; it may also benefit from existing brand familiarity.” The next test should distinguish the explanations where feasible.

### Form patterns, then challenge them

A useful pattern packet contains the common mechanism, independent advertisers/families, market differences, contradictory examples, source gaps, why it might transfer, why it might not, and the required original proof. Do not promote a pattern because an AI found similar words.

The operational target is a small result: approximately three worthwhile hypotheses and two genuinely different creative concepts, not a report containing 100 screenshots. Store rejected references with concise reason codes such as irrelevant market, unsupported offer, rights unresolved, unshootable or duplicate. Those are suitability decisions, not performance labels.

## 6. Two real reference cases, correctly bounded

### Food-process explanation: Friends & Brgrs

TikTok's published case describes educational restaurant videos, including showing how fries are made, followed by paid promotion of selected organic videos. The reported objective was awareness; the visible results concern views, impressions and media cost, not net restaurant profit [C1]. This source was available as an indexed case excerpt; full-page retrieval failed and the actual videos were not watched.

**CG hypothesis, not a copied campaign:** a restaurant with a verified preparation distinction could film one real process detail answering “what makes this worth ordering?” Required evidence is the client's own food, process and approved claim. Test against an appropriate existing concept using the chosen business objective. Do not copy the case's wording, imply every restaurant prepares food that way, or promote organic selection as a clean causal experiment.

### Local launch explanation: The Botanist

TikTok's case describes Scottish creators, staff-led tours and localised Spark Ads for an Edinburgh launch. It reports bookings and ROAS [C2]. The inspected article is a publisher case narrative, not an independent audit or a complete margin/attribution dataset. The campaign's calendar year is not established from the inspected text, so do not label it a 2026 campaign merely because the page was accessed now.

**CG hypothesis:** answer a local guest's first-visit uncertainty through the venue's real staff and a useful arrival/booking walkthrough. Capture entrance, actual seating experience, service and approved action. Do not import the other venue's aesthetic, menu, actors or numerical promise. This could support consideration, but actual delivery and customer status require separate evidence.

### Transfer to other categories

For physical retail, the equivalent mechanism may be a real fit/detail demonstration rather than a generic “new arrivals” montage. For ecommerce, it may be showing scale, compatible use and delivery conditions. For services, it may be walking through what happens after a quote request. These are original proposed applications, not findings that those formats outperform alternatives.

## 7. The canonical reference packet

Resolve exact-client context privately. A reusable shared pattern can omit client identity; a client application must be exact-client scoped. Do not put a client's competitor list, private performance, account IDs, contact information or confidential strategy in the public repository.

A proposed packet retains:

- Existing canonical source ID plus native provider/ad identity when verified; vendor record IDs as aliases, not replacements.
- Observation timestamps and source access state; first/last observed separately from claimed delivery dates; no inferred continuous runtime.
- Query provenance: search, region, window, filters, sorting and account visibility.
- Creative review coverage: full video, transcript, frames, still, case text, indexed excerpt or unknown.
- Offer and proof as observations; client applicability and audience stage as explicitly labelled hypotheses.
- Each metric's value/range, unit, denominator, objective, period, geography, model status and provider/vendor origin. Unavailable remains null.
- Rights for link reference, internal storage, model processing, client display and reuse as separate decisions. A public link does not grant every right.
- Pattern/family linkage, alternative explanations, original adaptation, required client proof, reviewer, expiry and links to the existing strategy/guideline/experiment.

Do not turn the new reference JSON into a second performance database. It is preparation material for a reviewed adapter into the existing sources/review system. Exported templates contain no guessed UUIDs and cannot authorise actions.

## 8. How this becomes part of Dynamics

### Stage A: reviewable research packets

Extend the existing Marketing Library source detail/review flow with a creative-reference type or typed metadata only after inspecting its current schema. Reuse exact source identifiers, versions and permissions. First build an import preview which reports duplicates, unsupported fields, unreadable sources, sample data and review state. Repeat runs must not duplicate records.

Do not coerce indexed-only or case-report material into a full-video review. An API link alone is not an approved integration. Keep potential future adapters disabled until access, scope and terms are validated. This chapter does not modify the first-pack Library bridge.

### Stage B: pattern-to-brief drafting

Use approved current Library guidance and privately resolved exact-client context to draft one pattern packet and two original concepts. Join the current monthly strategy, package and `monthly_deliverables` by IDs. Save only through the existing Content Guideline/Run/version mechanisms. A refresh proposes changes; it must not overwrite staff edits or preserve an old approval on changed creative.

The staff-facing output should answer: what to make, why it is worth testing, what evidence to capture, the CTA, what must be confirmed and how the result will be judged. Internal source and uncertainty detail remain expandable. Clients see only the approved, client-safe monthly explanation, not competitor raw data or private staff notes.

### Stage C: own-result feedback

Tie the approved creative version to provider receipts and canonical first-party outcome records. Keep provider attribution, client-confirmed sales/bookings and experiment-based incremental estimates distinct. Route enquiry quality through #405; monthly strategy through #391. Feed a reviewed learning into the next brief, retaining the original hypothesis and any negative/uncertain result.

Routine joining, deduplication, calculations and draft summaries should be automated once the data path is proven. Changes to spend, offers, publishing or client-visible strategy still use their specific approval paths. Reference research does not create authority to run an ad.

### Stage D: low-maintenance operation

Proposed freshness policy: verify reference availability and mutable offer facts at use time; recheck platform/API capability before enabling an adapter; re-review vendor pricing at procurement. A 30-day recheck date in this pack is a CG planning default, not a provider retention promise. Record stale, inaccessible and retired records instead of silently deleting history.

A later scheduled research refresh can check known references and produce a bounded review queue. No new recurring automation was created here. Keep research work additive to the existing operating system, not a separate CRM, calendar or unattended content publisher.

### Security and permissions

Production adapters must derive client/month/role server-side, enforce RLS and return durable receipts. External ad text, landing pages and vendor notes are untrusted data, never tool instructions. Sanitize rendered content; constrain allowed fetch destinations and redirects; defend against internal-network requests; preserve licensing and personal-data controls. No scraping bypass, credential sharing, competitor-media republication or automatic store import belongs in this lane.

The included reference checks have no network, authentication, persistence or production authority. They illustrate evidence failures; they are not a substitute for access-control tests or human judgment.

## 9. When a paid tool would actually earn its cost

Run the same bounded tasks first with native sources, then with one candidate only if a trial is explicitly approved. Use an identical brief, market and time budget; alternate task order where practical. Measure unique relevant references, exact-identity/source completeness, duplicate rate, missing coverage, time to two usable concepts and reviewer editing time. Check export fields, deletion, retention, user access, quotas and cancellation. Keep all costs in one declared currency with a dated exchange rate only if conversion is actually required.

A useful coverage measure is **native relevant unique references / union of relevant unique references found across this benchmark**. It is a benchmark-specific ratio, not the proportion of all ads in the market. More references can still be less useful if they add duplication or weak evidence.

The reference calculator uses:

**Monthly capacity value = tasks × net minutes saved per task / 60 × internal hourly value.**

**Net planning value = capacity value − recurring fees − monthly QA cost − setup cost / amortisation months.**

This is a planning calculation, not guaranteed cash savings. Saved time creates financial benefit only when capacity is actually redeployed or cost avoided. Do not justify a tool with a vendor's claimed revenue uplift. A tool may be worth paying for archive/export convenience without providing more accurate revenue data; label that benefit honestly.

## 10. Acceptance and next bounded mission

The reference deliverable is complete when another agent can retrieve the research, source coverage, evidence checks, tests and reproducible offline viewer. That is not live Library activation.

The first implementation acceptance should prove: one authorised exact-client research request; one source-preserving packet; two original staff-reviewed concepts; correct canonical guideline/month linkage; no draft leakage to clients; unknown outcomes remain unknown; no sample data becomes evidence; no duplicate reference across vendors; no guessed client IDs; no spending or publishing.

Remaining research gaps are material and explicit: no authenticated native-library category benchmark, no competitor video watch-through, no paid-tool accuracy/export trial, no licensed-media storage validation, no current CG production source counts, and no complete Meta API access. The two restaurant cases illustrate disciplined interpretation, not an empirical ranking of category creative.

**The next useful step is a native-first reference pilot for one approved exact-client brief, followed by staff judgment of the two resulting concepts.** Validate the workflow before buying more data or building a broad integration. The value is accumulated useful decisions, not a larger pile of saved ads.
