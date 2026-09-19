# CG Commerce, Choice and Learning

Version 2026-09-19.2 | Research continuation of Marketing Intelligence #426

**Status: evidence-backed research plus testable CG proposals. Not approved production doctrine, an operating store, a deployed feature or permission to spend.**

## 1. Executive decision

CG should compete on the quality of the decision loop, not the number of assets produced or dashboards installed. The proposed commercial system is:

**Understand a real need → construct a useful offer → create relevant proof → distribute it → observe business outcomes → diagnose carefully → improve the next decision.**

The founder's new brief adds three priorities to the merged audience-lifecycle foundation: buying psychology, serious ecommerce economics and revenue that is less dependent on travelling to shoots. These are connected but different problems. A psychological effect does not establish product demand. A larger order does not establish better profit. An automated report does not establish that a recommendation is correct.

This continuation therefore makes four decisions explicit. First, use choice research to propose better comparisons, not to promise a winning middle option. Second, optimise contribution per eligible customer or visitor over a stated horizon, with customer-harm and service guardrails, rather than average order value alone. Third, automate data gathering and diagnosis before automating commercial actions. Fourth, validate one repeatable client problem and paid offer before building several new software businesses.

The practical product direction is a compact, reviewed recommendation in the existing client Plan, backed by an auditable internal record. Staff should receive a usable brief and the next action, not another research task.

## 2. Current CG foundation and scope

Read-only GitHub verification on 19 September 2026 found PR #427 merged to main at `20df803fe939e3ecd63da1dcfc46c6c83ed345c9`. Its six research/reference files remain under `docs/marketing-library/audience-lifecycle/`. The new founder input is recorded on #426, comment `5741638732`.

A different worker owns `feat/426-marketing-intelligence-library-bridge`, connecting the FIRST source pack to existing Registration/review functionality. This continuation does not change that source pack, source generator, app registration code, runtime, schema, integrations, client records, or deployment. Its additive home is this `commerce-psychology/` folder.

The existing `RETAIL-ECOMMERCE-HUMAN-MARKETING-GOLDMINE-2026-08.md` already discusses human product storytelling, feed quality, retail case studies and the distinction between attributed revenue and profit. The `CONVERSION-EXPERIMENTATION-SOURCE-PACK.md` already defines experiment hypotheses, outcomes, confidence and no-premature-winner rules. Preserve them. This chapter adds specific evidence on choice, an executable offer-economics model, a diagnosis acceptance gate, and a commercial validation sequence. It does not independently reverify the older packs' case-study results.

Current session limits: the Google Control Centre returned HTTP 403; the CG Dynamics runtime tool was not discoverable; the local environment could not resolve GitHub for a full clone. GitHub connector reads and isolated research writes are available. No current client audience, sales ledger, supplier quote, permission or profitability is inferred from those access gaps.

## 3. What the psychology supports

### The Coke/Pepsi anecdote

The reported vending-machine story has no verified original study in this research pass. Keep it as a founder-supplied discovery lead, not a case study or a known sales result. The influencer identified only as Crosson was not reliably matched to an exact supplied video. No original screenshots or clips from that example were independently inspected here.

There is relevant research without needing to validate the story. Daniel Mochon's 2013 paper describes **single-option aversion**: in laboratory studies, a sole option can increase desire to keep searching, and adding alternatives can make the original option more likely to be selected. The publisher abstract reports boundaries involving search; it is not evidence about those vending machines, South African retail or an expected conversion uplift. Only the abstract was inspected. [S01]

**CG application proposal:** test whether customers need a meaningful comparison to evaluate value. For an unfamiliar product, one clear alternative or comparison guide may be more useful than another sales slogan. Keep the real ability to decline, defer or choose the entry option. Measure the entire eligible population, not only buyers.

### Why a middle offer can work, and why two units are not a law

A 2016 meta-analysis of **142 experimental observations** found support for extremeness aversion, with substantial variation across design decisions and contexts. That supports investigating intermediate options. It does not identify two units, a 15% discount or a three-card layout as universally optimal. The available author-university abstract was inspected, not the complete underlying dataset. [S02]

A restaurant field study analysed more than **88,000 choices over seven years** in one German restaurant. It reported a compromise pattern in menu choices, with variation by category and a weaker result for solo diners. This is observational field evidence, not a randomised CG restaurant test or evidence that adding a dish creates more total diners. Selected full-text sections were inspected. [S03]

A quantity ladder is not identical to the original multi-attribute choice experiments. Buying more also changes total outlay, storage, consumption time, delivery cost and the chance of waste. A price-quality tier adds another kind of trade-off. The option in the middle of the screen, an intermediate quantity and an intermediate specification are three different constructs. Do not combine them under one unexplained 'psychology' tag.

**CG application proposal:** every tier must have a plausible customer job. A single item could be suitable for a first trial; a two-pack for a household with an actual use for two; a larger pack for replenishment or a group. Those meanings require product-specific evidence. Do not invent use cases to justify the pack we want to sell.

### More options versus too many options

Scheibehenne, Greifeneder and Todd's 2010 meta-analysis covered **63 conditions from 50 experiments, with 5,036 participants**. Its average overload effect was approximately zero, with meaningful variation. A later review by Chernev and colleagues covered **99 observations, 7,202 participants** and identified moderators including complexity, decision difficulty, preference uncertainty and the decision goal. These findings do not support a universal instruction to show fewer products. [S04, S05]

The later review has a published correction to statistical notation. Its correction was inspected and is linked in the ledger; no corrected coefficient is used as a CG benchmark. [S06]

**CG application proposal:** reduce irrelevant effort, not automatically the assortment. Use useful categories, size/compatibility guidance, honest comparisons and progressive detail. A knowledgeable customer looking for a specific specification may need breadth; an unfamiliar customer may need a clear starting point.

### Mechanisms that must remain distinct

| Concept | Useful research question | What must not be claimed |
|---|---|---|
| Single-option aversion | Does an appropriate alternative reduce further search? | Adding a competitor always raises everyone's sales. |
| Compromise / extremeness aversion | Does an intermediate option fit the decision better? | Buy 2 always wins, or the centre card is inherently superior. |
| Asymmetric dominance / decoy | Is an alternative dominated on relevant attributes, and does its presence affect choice? | Any expensive third option is a decoy, or an unavailable fake tier is acceptable. |
| Reference-price framing | What legitimate comparison makes total value understandable? | An invented 'was' price proves a saving. |
| Quantity discount | Does extra quantity create enough customer and contribution value? | Higher basket value means more profit. |
| Curation / bundle utility | Does a combination solve a complete job? | Unwanted extras make the customer better off. |
| Recommendation / popularity | Can a real, defined observed pattern help a decision? | 'Most Popular' is just a design label. |
| Defaults and urgency | Does the choice remain informed, reversible and unpressured by false information? | Hidden subscriptions or resetting deadlines are optimisation. |

The decoy and reference-price rows are mechanism definitions and research questions, not independently validated performance prescriptions in this checkpoint. Add original-source review before approving specialist claims about them. Avoid converting an entire table into one high-confidence Skill Card.

## 4. Offer economics: the R600 test

The model below is synthetic arithmetic, not a client result, market benchmark, recommended price or tax instruction. All figures use a consistent **excluding-VAT planning basis**. Consumer-facing tax-inclusive prices and payment-fee bases require the store's separate reviewed implementation.

Assume one product costs R260 per unit, has a normal unit selling price of R600, and incurs a 3% payment charge on the assumed charged amount. Packaging and delivery change by quantity. A R12-per-unit after-sale allowance represents expected additional net loss from returns, replacements and support not already counted elsewhere. It is an assumption, not an observed return rate.

| Offer | Goods revenue | Unit cost total | Packaging | Delivery | Payment fee | After-sale allowance | Contribution before advertising and fixed costs |
|---|---:|---:|---:|---:|---:|---:|---:|
| Buy 1, no discount | R600.00 | R260.00 | R20.00 | R70.00 | R18.00 | R12.00 | R220.00 |
| Buy 2, 15% off both | R1,020.00 | R520.00 | R25.00 | R80.00 | R30.60 | R24.00 | R340.40 |
| Buy 3, 20% off all | R1,440.00 | R780.00 | R30.00 | R100.00 | R43.20 | R36.00 | R450.80 |

The two-pack adds R120.40 contribution over one item, not R420 of profit. The three-pack adds R110.40 over the two-pack. Contribution per unit falls as the discount deepens. Whether that trade-off is useful depends on purchase probability, costs, stock constraints and future demand.

Now compare two deliberately simplified storefronts per **1,000 eligible visitors**. In the second, every buyer selects the two-pack purely to isolate the arithmetic; a real test must measure the entire offer mix.

| Measure | Single-item control | Two-pack variant |
|---|---:|---:|
| Purchase rate | 3.0% | 1.8% |
| Orders | 30 | 18 |
| Average goods order value | R600 | R1,020 |
| Goods revenue | R18,000 | R18,360 |
| Contribution before advertising | R6,600 | R6,127.20 |
| Advertising, assumed identical | R5,000 | R5,000 |
| Contribution after advertising | R1,600 | R1,127.20 |

The variant has **70% higher AOV and 2% higher revenue**, but lower contribution. Its implied revenue/ad-spend ratio also looks better. At these costs, the two-pack needs about **1.94% purchase conversion** to match the control's pre-ad contribution per visitor. That threshold changes whenever cost, traffic or offer mix changes.

This is why CG should not optimise the label that looks best on a dashboard. The proposed primary commercial measure for this test is **contribution per assigned eligible visitor**, with a stated return horizon. Track conversion, AOV, units, cash collected, cancellations, complaints, delivery failures and repeat buying as separate diagnostics. Attribution to ads is another question; this arithmetic does not establish causal ad lift.

### Definitions for the reference calculator

Offer contribution = charged goods after discount + shipping collected − unit costs − packaging − delivery − payment charges − the explicit additional after-sale loss allowance.

The allowance must not double-count refunds already deducted from net revenue or recovered stock already credited elsewhere. The reference uses receipts before future refund adjustments; a production accounting adapter should prefer actual item-level refunds, replacements, fee refunds and inventory recovery when known. It must retain the ledger version and mark estimated versus matured contribution. Fixed overhead, tax, working capital and the owner's desired surplus are not inside this small calculator.

For multiple offers, expected contribution per eligible visitor = sum of each offer's **unconditional** purchase probability multiplied by that offer's contribution, less media cost per eligible visitor. The probabilities need not sum to one; the remainder is no purchase. Conditional shares among buyers are not a substitute for these probabilities.

### Six traps to test

**Pull-forward:** a pack might bring the next two purchases forward rather than create incremental long-term demand. Compare an appropriate cohort horizon, not just checkout day.

**Cannibalisation:** a discount can be given to people who would have bought the same quantity at full price. An order-level discount report cannot identify that counterfactual.

**Shipping steps:** two items may fit the first parcel band; three may trigger another parcel, volumetric charge or special handling. Model each viable quantity rather than assuming delivery is fixed.

**Return asymmetry:** buying several sizes or variants can inflate the first order and subsequent returns. Assess the net outcome after a sufficient observation period.

**Stock bottlenecks:** a popular bundle can exhaust a scarce component or consume stock that earns more elsewhere. Model component quantities and allocation, not only a parent bundle SKU.

**Cash strain:** contribution can be positive while supplier deposits, inventory holding, payout delays and refunds create a funding gap. Add a separate cash-flow model before scaling.

## 5. Truthful merchandising contract

The FTC's 2022 report documents deceptive countdowns, unsupported low-stock messages, false activity claims, hidden subscriptions and obstacles to cancellation. It is a useful design-risk taxonomy, **not South African legal authority**. [S10]

CG's proposed rule is stricter than 'the number is technically somewhere on the page': the overall offer must be understandable and supported.

| UI claim | Required evidence and behaviour |
|---|---|
| Most Popular | Define what is counted: orders, units or another disclosed basis; exact comparable set and period; genuine data with a recorded snapshot. No badge when evidence is absent. |
| Best Value | State the basis, such as lowest unit price within this set. Check quantity, specifications, shipping and total cost; do not imply best for every customer. |
| Was / now price | Preserve genuine reference-price evidence and applicable review. Do not manufacture a high anchor. |
| Only a few left | Read verified sellable stock with reservations and channel scope. A supplier's unconfirmed stock is not owned stock. |
| Deadline / countdown | Use an actual approved deadline and enforce it consistently. Do not reset it per visitor to fabricate urgency. |
| Guarantee | Define the responsible seller, conditions, remedy, period and exclusions; show important terms before purchase. Do not invent statutory rights or remove them. |
| Recommended pack | Give a defensible use-case reason, not a false popularity claim. Keep one-item choice and quantity controls clear. |
| Subscribe and save | Clearly distinguish recurring from one-off price and commitment. Never silently switch purchase type or make cancellation intentionally difficult. |

Popularity can be changed by the badge itself. Preserve the observation period used for the label, do not update it mid-experiment without recording the intervention, and do not confuse current treatment-generated choice share with independent historical proof.

For South Africa, the Consumer Protection Act's official summary identifies unfair-marketing restrictions and consumer-information standards. Detailed ECTA/CPA returns, delivery, cancellation and tax implementation remain a **launch-specific legal review**, not certified by this chapter. [S12]

The Information Regulator's direct-marketing guidance distinguishes non-customer electronic outreach from the limited existing-customer route. The latter requires sale-context contact collection, similar goods/services and an opportunity to object; it is not permission to market anything to anyone who ever enquired. [S11]

Implementation implication: lawful use, purpose, channel, suppression and proof of eligibility are separate from customer stage. Hashing a contact value is not consent. CG's existing draft-only email policy remains unchanged.

## 6. Serious ecommerce operating model

A store is an operation, not a conversion page. Use the following gates before treating an opportunity as ready to launch.

### A. Demand and differentiation

Write down the actual buyer, job, purchase trigger, alternatives, inconvenient trade-offs and reason to buy from this seller. Collect dated evidence from customer questions, permissioned interviews, existing sales and current competitor offers. Distinguish a social trend from repeated demand and a cheap supplier from a defensible advantage.

A small catalogue is a proposed starting strategy, not a rule. Choose products where truthful information and fulfilment can be tested. For an existing physical retailer, validate stock visibility, who owns picking, price consistency, returns routing and whether online orders add demand or mainly shift existing purchases.

### B. Supply and fulfilment

Confirm product identity, variants, landed cost, minimum quantities, lead times, replenishment, damaged-stock terms and supplier reliability using actual evidence. Define available-to-sell stock, reservations, oversell policy and stale-inventory handling. Test packing and delivery before advertising a promise.

A bulky or live-goods opportunity should initially compare local collection, a bounded delivery zone, route batching and quotation-based delivery. Measure handling time, damage/mortality, failed delivery and care requirements. Do not assume a national parcel model works. Species, transport restrictions and permits require exact product and jurisdiction verification before selling; this chapter certifies none.

### C. Catalogue and truthful product pages

The product page should answer fit, size, material/specification, quantity, included items, compatibility, availability, delivery cost/timing, returns and support using current evidence. Photograph what the customer will actually receive. Show scale, detail, use and packaging when these resolve uncertainty. Record the photography rights and prevent generated images from becoming fictitious product proof.

Shopify's current documentation illustrates why the commerce adapter matters: bundle availability is calculated from component inventory and required quantities, and its documented bundle features have compatibility and returns limitations. Do not assume every storefront, subscription or bundle implementation behaves alike. [S09]

### D. Payment, order and fulfilment truth

The chosen commerce system, not an advertising report, owns order, payment, refund and fulfilment status. Handle payment retries, duplicated webhooks, cancelled orders, partial refunds, split shipments and replacement orders without counting another purchase incorrectly. Keep test orders and previews out of business metrics.

Do not build a second inventory or payment ledger in Dynamics. Reference the exact canonical store and transaction. Prefer mature, already-authorised commerce capability or a reviewed integration over writing payment/security primitives to avoid a subscription. Build-versus-buy must include operational risk and support costs, not only licence price. No platform purchase or technical migration is authorised here.

### E. Acquisition and measurement

Keep the roles of Meta, Google Search/Shopping and TikTok distinct as the parent pack specifies. Verify actual account and market eligibility before setting campaign structure. A public product page or platform brochure does not establish that a CG account can use a feature.

Google's ecommerce specification provides standard item, cart, checkout, purchase and refund events, including transaction and item identifiers. Preserve its value/currency definitions rather than inventing a revenue field. [S08]

Within Dynamics, join creative, offer version, experiment and landing version to canonical outcomes using exact IDs. Keep platform attribution, analytics observation and store accounting separate. A refund can change business contribution without rewriting the historical raw provider response.

### F. Retention and service

Choose repeat-purchase timing from product use and observed cohorts, not a compulsory seven-day upsell. Separate help/care, marketing, replenishment, complementary products, referral and service recovery. Stop promotional automation when suppression, complaint handling or another valid restriction applies.

Measure net repeat contribution by acquired cohort and observed horizon. Extrapolation beyond the observed period is a scenario. Do not hide an unprofitable first order behind an invented lifetime value. The client or seller remains responsible for fulfilment and service unless CG explicitly contracts to do it.

## 7. The automatic learning system

### Separate calculation, explanation and authority

A deterministic layer calculates metrics and tests data integrity. A reviewed analytical method evaluates evidence. AI can retrieve appropriate knowledge, summarise observations, propose explanations and draft the next brief. Human approval authorises significant changes. These are different responsibilities.

An AI narrative must never silently alter source numbers, turn a missing sale into zero, describe an observational difference as a causal result or promote its own text into approved Library knowledge.

### Minimum observation contract

For each outcome store exact client, site/account and environment; canonical deliverable and immutable asset/review version; provider post/ad/campaign IDs where available; intended audience and actual delivery mode; offer and landing versions; experiment assignment; dates/timezone/currency; spend basis; event/outcome definition; order/enquiry references; attribution model/window; data coverage/freshness; return or qualification maturity; source snapshot and revision.

Intended audience is not measured recipient identity. Multi-platform reach is not automatically deduplicated people. Historical asset tagging should be marked human-reviewed or inferred, not passed off as original experimental assignment. Never identify a person from engagement data that does not actually support the link.

### Diagnose in order

| Gate | Question | Safe output |
|---|---|---|
| Identity and permission | Is this the correct client, asset, period and permitted source? | Block mismatches; never fill from another client. |
| Data integrity | Is tracking complete, current, deduplicated and comparable? | Data repair requirement, not creative failure. |
| Outcome maturity | Has the defined sales/booking/return window completed? | Await outcome; show provisional status. |
| Experimental validity | Was allocation genuine, exposure logged and the analysis specified? | Invalid or observational classification if not. |
| Commercial result | What happened to the primary outcome and guardrails? | Effect with uncertainty; practical significance; downside. |
| Diagnosis | Which explanations are supported, possible or contradicted? | Ranked hypotheses with evidence, not invented causes. |
| Action | What is the smallest useful next decision? | Reviewed change proposal, next test, hold or stop. |

Microsoft's experimentation team describes sample-ratio mismatch as a data-quality signal requiring diagnosis before interpreting an A/B result. A seemingly negative effect can reflect biased data loss. Passing that check alone does not prove a test valid. [S07]

**Example, hypothetical:** a video has strong watch time but weak downstream qualified enquiries. Possible explanations include low purchase intent, an unclear CTA, destination friction, stock/service-area mismatch or unrecorded enquiries. The system should inspect available evidence for each, propose the best supported next test and preserve unresolved explanations. It should not declare 'the opening was too long' merely because sales were low.

### Low-volume and organic work

Many clients will not support frequent precise experiments. Use longer observation windows, pooled periods with explicit comparability checks, qualitative customer objections and well-scoped sequential learning. Keep low-volume evidence labelled. Never manufacture a statistically meaningful winner from a handful of events.

Organic reach is selected by the platform and audience response, not usually randomly assigned. Comparing two posts can guide a hypothesis but cannot isolate the creative's causal effect. Restaurant foot traffic also varies by capacity, weather, events and opening days. Record relevant known factors and avoid replacing unavailable business outcomes with likes.

### Experiment specification

Before launch record the decision, mechanism, eligible population and assignment unit, primary metric, commercially meaningful difference, allocation, analysis method, stopping rule, observation horizon, exclusions, guardrails, interference risks and approvals. Estimate feasibility from real baseline data; there is no universal click count.

Use visitor/customer-level assignment when appropriate and analyse at that unit, including non-purchasers. Orders from the same person are not necessarily independent observations. Handle multiple variants, repeated peeking and multiple metrics in the analysis plan. The included reference gate checks completeness and conservative decision conditions; it does not estimate statistical power, intervals or causal effects.

### Learning that survives correction

Store a learning as a versioned derived record referencing its source snapshot, experiment, client scope, limitations and reviewer. Link it to the next strategy proposal and the actual result of applying it. A provider correction, refund batch or identity correction should trigger reassessment; preserve the earlier version and its audit trail rather than silently rewrite it.

The proposed ladder is hypothesis → observation → experiment-supported finding → replicated evidence → reviewed reusable guidance. A finding may remain useful only for one client, product, audience or season. Do not anonymise private client data into shared learning by stripping a name alone; sharing/generalisation needs a deliberate privacy and relevance review.

### Staff experience

The system should perform routine joins, calculation, comparison and draft preparation. Staff see one short explanation, the evidence quality, the proposed next asset and any missing proof to capture. The account owner approves the monthly plan. A client contributes only outcomes unavailable elsewhere, such as good/poor enquiry or attended booking, through the canonical simple feedback action.

Measure the labour saved: analyst minutes per client-month, correction time, manual data-entry burden and the proportion of recommendations accepted and later supported. A dashboard that takes more staff time than the old process is not a success.

## 8. CG revenue that is less dependent on shoots

The following are commercial hypotheses derived from CG's current architecture and founder direction. No willingness-to-pay, addressable market, competitive superiority or growth rate has been established by this research. Validate through actual sales and renewals, not enthusiasm.

### First proposed offer: managed lead-quality and website improvement

Buyer problem: enquiries arrive but the business cannot tell whether they are useful or what to improve. Proposed service: verified capture, attribution coverage, a simple client-owned outcome inbox, health checks and a reviewed monthly improvement. Reuse the existing #405 and website-performance work. CG is not the sales desk by default.

This is the first candidate because it is adjacent to existing capability and can be delivered without a monthly shoot for every account. Dependencies are not optional: durable capture, correct recipient routing, outcome feedback, privacy and honest reporting must work before selling it as automated.

Validate with a small set of eligible existing relationships, explicit scope, one outcome and measured support time. A paid pilot with renewal is stronger commercial evidence than a free demo or verbal praise. Decide price after understanding value and delivery effort; this chapter does not set an approved price.

### Second proposed offer: commerce performance operations

Buyer problem: a shop has products but weak understanding of catalogue, conversion, margin, fulfilment and repeat buying. Proposed service: setup/readiness audit, product-data hygiene, measurement integrity, one useful offer experiment and a net-contribution review. The merchant owns products, stock, fulfilment and customer service unless separately contracted.

Support one proven commerce stack initially. Do not sell universal integration, guaranteed sales or fully automatic optimisation. Bespoke connectors, data cleanup and refunds can make the service labour-heavy; measure that before packaging it as a scalable product.

### Third proposed offer: evidence-led creative planning

Buyer problem: the business can publish but does not know what to make next or why. Proposed service: audience-aware monthly plan, practical briefs, reusable brand/industry knowledge and evidence-informed revisions. Production can remain an optional separate service, including remote client-shot content where suitable.

The output must outperform a generic generated content calendar on usefulness, accuracy, originality and staff effort. Test against the client's current workflow with reviewers who do not know which version is AI-assisted. Track adoption and outcomes rather than the number of generated ideas.

### Later: software or white-label access

Software access should follow repeatability, not precede it. Prove onboarding, tenant isolation, permissions, billing/support boundaries, service recovery, explainability and independent usage by a client before selling a broader subscription or white-label product. The app being useful to CG staff is not yet proof that another business will operate it successfully.

Keep the owned-system doctrine: reuse CG's authorised stack where it is economical, and compare genuine total cost before adding a service. Do not create several disconnected client portals or private knowledge stores.

### A measurable twelve-month ambition

Define the target: recognised revenue over twelve months, recurring revenue at the end, contribution, operating profit, cash and valuation are different quantities. A headline 'multi-million' cannot be used without specifying which.

Synthetic illustration at **R7,500 monthly recurring price**, full-month billing from the start of each acquisition month, no churn, discounts, tax or bad debt:

- Two new customers each month produces 24 active customers in month 12, R180,000 exit monthly recurring revenue and R2.16 million annualised run rate, but only **R1.17 million billed across the first twelve months**.
- Four new customers each month produces 48 active customers, R360,000 exit monthly recurring revenue and R4.32 million annualised run rate, with **R2.34 million billed in that year**.

These are equations, not forecasts or evidence that R7,500 is sellable. Add churn, onboarding timing, collection risk, customer acquisition cost, support labour, infrastructure, refunds and fixed expenses before calling either profitable. Exclude pass-through advertising spend from any claim about CG's own service revenue unless accounting treatment explicitly warrants otherwise.

The important operating test is whether support hours per retained client and marginal software cost stay controlled as the cohort grows. 'Software-assisted' is not the same as zero-human-work.

## 9. Implementation and validation sequence

**Checkpoint 1: source and claim quality.** Continue the already-owned Library bridge without overlap. Register the new chapter's sources separately after deduplication. An inspected abstract remains an abstract, not a full-text verified source. Approve narrow claims, not a universal buying-psychology card.

**Checkpoint 2: economics and measurement contracts.** Map the proposed offer model to canonical commerce and enquiry sources. Validate currency/tax basis, shipping, fee/refund treatment and missing-data states. Require business-outcome receipts before showing profitability. No new payment, inventory, order or CRM authority.

**Checkpoint 3: automated observation and draft diagnosis.** A read-only job assembles an exact-client packet, checks data quality, calculates deterministic outcomes and drafts at most the useful next decisions. No automatic publishing, pricing, audience uploads or budget changes. Idempotency and source revisions must be proven.

**Checkpoint 4: existing Plan and Guidelines.** Link approved diagnosis to the canonical month strategy and Content Guideline. Preserve staff edits, selected month, package provenance and immutable approved creative. Clients see the approved narrow explanation, not internal prompts or raw identifiers.

**Checkpoint 5: a controlled commercial pilot.** Choose one eligible use case with a willing client, a real business outcome, a known observation horizon and approved operational responsibility. Use a draft readiness study for ecommerce until a real store is ready. Validate customer value, operational burden and renewal before scaling.

**Checkpoint 6: repeatable service.** Record the onboarding checklist, support bounds, reliability evidence, economic model and contract. Expand only when another operator can deliver it without the original researcher manually rebuilding the work.

The planning windows of 30, 60 and 90 days may be used for reviews, but completion should depend on evidence, not the date. No scheduled job or rollout has been activated by this document.

## 10. Sources, reproducibility and remaining work

`evidence.json` holds the exact primary links, access levels, dates, limitations and review candidates. `commerce_reference.mjs` implements the synthetic economics and a fail-closed analysis-readiness gate. `commerce_reference.test.mjs` tests behaviour. `build_hub.py` generates the offline companion without external scripts or data calls. Local copies and the generated HTML are exports of this versioned folder, not a second maintained knowledge authority.

Unfinished research is explicit: original-source examination of decoy, anchoring and default effects beyond this bounded chapter; exact regional/account Meta, Google and TikTok capabilities; South African store-specific consumer-law/tax and product restrictions; real buyer interviews and willingness-to-pay; validated supplier/fulfilment costs; client-level experiment design and outcomes; current competitor feature/pricing comparison. Several attempted vendor pages were inaccessible, so no competitor ranking is claimed.

The key result is a better decision standard: **a persuasive offer must be truthful, operationally deliverable and commercially worthwhile across the whole decision population. A learning must survive data-quality checks and retain its uncertainty. A scalable service must save work in practice, not only in its sales description.**
