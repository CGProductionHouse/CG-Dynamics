# Retail and Ecommerce Marketing Source Pack

Last updated: 2026-08-06
Status: Researched source pack; all derived knowledge remains review-gated.
Scope: Marketing, content, paid media, product discovery, conversion, reviews, retention and reporting.
Excludes: General bookkeeping, tax administration and operational material that does not directly affect marketing decisions or customer-facing claims.

## Purpose

This pack supports practical marketing work for retail and ecommerce clients. It focuses on the sources that help CG staff and agents:

- create stronger product and promotional content;
- run accurate Shopping and paid-social campaigns;
- improve product discovery and conversion;
- use reviews and social proof correctly;
- measure ecommerce funnels honestly;
- plan retention and remarketing;
- avoid stale prices, false scarcity and unsupported performance claims.

A source belongs in this pack only when it directly improves a marketing decision, message, campaign, customer journey or report.

## Source priority

1. Official advertising, analytics and commerce-platform documentation.
2. Official consumer and advertising rules where they directly affect marketing claims.
3. Primary research on advertising, persuasion, conversion or shopping behaviour.
4. Verified client evidence, kept client-specific.

## Source register

### RM1 — Google Merchant Center Promotions

Publisher: Google Merchant Center Help
Canonical sources:

- https://support.google.com/merchants/answer/13422697
- https://support.google.com/merchants/answer/2906014
- https://support.google.com/merchants/answer/13507032

Source type: Official commerce-platform marketing documentation
Review cadence: Quarterly or when Merchant Center changes
Rights treatment: Metadata, summary and link only

Verified marketing findings:

- Merchant Center promotions can surface offers across Google properties, including Shopping-related surfaces.
- Promotions require structured fields such as a promotion ID, eligible products, offer type, title, dates and redemption channel.
- Product-specific promotions must be mapped accurately to eligible products.
- Google reviews promotions against programme and editorial requirements.
- Promotion dates, product eligibility, coupon requirements and terms must match the live customer offer.

Marketing implications:

- A promotion is a structured campaign asset, not only a social caption.
- Every campaign should have one source of truth for offer name, eligible products, code, start date, end date, channel and conditions.
- Social posts, paid ads, website banners and Merchant Center promotion data should all use the same offer record.
- Expired promotions must be removed from active content and feeds.
- Product-specific offers should never be presented as storewide without evidence.

Candidate knowledge:

- Build promotions from a canonical offer record before producing creative.
- Validate the offer against website, feed and checkout before launch.
- Include only the conditions that materially affect eligibility, redemption or customer expectation.

Prohibited outputs:

- False “storewide” claims.
- Expired sale messaging.
- Coupon messaging where no working code exists.
- “Free delivery” without the actual eligibility conditions.

### RM2 — Google Merchant Center Product Ratings

Publisher: Google Merchant Center Help
Canonical source:

- https://support.google.com/merchants/answer/14620705

Source type: Official product-review marketing documentation
Review cadence: Quarterly
Rights treatment: Metadata, summary and link only

Verified marketing findings:

- Product Ratings can show aggregated product reviews in ads and free product listings.
- Ratings are matched primarily through reliable product identifiers such as GTINs, with brand and MPN consistency also important.
- Google filters reviews for accuracy and relevance.
- Meeting a minimum review threshold does not guarantee immediate or universal display.

Marketing implications:

- Review strategy and product-feed quality are connected.
- Product reviews should be attached to the correct product, not loosely reused across variants or unrelated items.
- A strong review count is useful social proof but does not prove universal product performance.
- Marketers should distinguish product ratings from store or business ratings.

Candidate knowledge:

- Use verified product identifiers consistently across product and review feeds.
- Report review coverage, review count and rating separately.
- Treat star visibility as platform-controlled, not guaranteed.

Prohibited outputs:

- Invented reviews.
- Reusing one product’s reviews for another product.
- “Five-star product” where the current verified rating does not support it.
- Claiming that ratings will definitely appear in ads.

### RM3 — Google Merchant Center Editorial and Landing-Page Quality

Publisher: Google Merchant Center Help
Canonical sources:

- https://support.google.com/merchants/answer/6150244
- https://support.google.com/merchants/answer/12079604

Source type: Official Shopping and free-listing quality requirements
Review cadence: Quarterly
Rights treatment: Metadata, summary and link only

Verified marketing findings:

- Shopping surfaces require clear, professional and useful product experiences.
- Product listings must lead to relevant landing pages.
- Incomplete, confusing or non-functional websites can prevent products from serving.
- Product data and landing-page content must meet technical and editorial standards.

Marketing implications:

- Creative cannot compensate for a weak product page.
- Product ads should land on the exact relevant product or offer page.
- Missing product information, broken checkout, confusing navigation and incomplete business information are marketing blockers.
- Destination quality should be checked before campaign launch.

Candidate knowledge:

- Add a landing-page readiness check to every retail campaign.
- Verify product relevance, mobile usability, price, stock, images, trust information and checkout path.
- Treat website quality as part of campaign quality, not a separate technical afterthought.

### RM4 — Google Merchant Center Structured Product Data

Publisher: Google Merchant Center Help
Canonical source:

- https://support.google.com/merchants/answer/6386198

Source type: Official product-data and structured-data documentation
Review cadence: Quarterly
Rights treatment: Metadata, summary and link only

Verified marketing findings:

- Structured data helps Google retrieve current product and offer information from landing pages.
- Merchant Center attributes should align with corresponding structured data values.
- Supported data includes price, availability, sale price, shipping, returns and other offer information.

Marketing implications:

- Product content, feed data and structured data should describe the same offer.
- Inconsistent prices or availability damage campaign reliability.
- Sale messaging should not be published until the live page and product data agree.

Candidate knowledge:

- Check feed, page and structured-data consistency before promotional launch.
- Treat price and stock mismatches as campaign-stopping errors.

### RM5 — GA4 Ecommerce Events and Funnel Measurement

Publisher: Google Analytics Help
Canonical sources:

- https://support.google.com/analytics/answer/12200568
- https://support.google.com/analytics/answer/12924131
- https://support.google.com/analytics/answer/14143583
- https://support.google.com/analytics/answer/13428834
- https://support.google.com/analytics/answer/12947610

Source type: Official analytics and ecommerce measurement documentation
Review cadence: Quarterly
Rights treatment: Metadata, summary and link only

Verified marketing findings:

- Ecommerce data is not collected automatically; recommended events must be implemented.
- Useful funnel events include product view, add to cart, checkout start, shipping information, payment information, purchase and refund.
- Required parameters matter; incomplete events may not populate ecommerce reports correctly.
- Event-scoped and item-scoped metrics answer different questions.
- Event firing does not by itself prove that the underlying business process completed correctly.

Marketing implications:

- Marketers need an explicit measurement plan before campaign launch.
- Product views, carts, checkout starts and purchases are separate outcomes.
- Funnel drop-off should be reported by stage.
- Purchase tracking must be checked for duplicate transaction IDs and missing refunds.
- Analytics revenue is tracking data, not automatically verified accounting revenue.

Candidate knowledge:

- Use a canonical ecommerce funnel: view item → add to cart → begin checkout → add shipping → add payment → purchase → refund.
- Report both event and item-level metrics where relevant.
- Flag missing or unreliable ecommerce implementation instead of pretending the report is complete.

Prohibited outputs:

- Calling add-to-cart a sale.
- Calling checkout starts purchases.
- Reporting tracked revenue as profit.
- Ignoring refunds when evaluating campaign quality.

### RM6 — Ecommerce Funnel Exploration

Publisher: Google Analytics Help
Canonical source:

- https://support.google.com/analytics/answer/12216232

Source type: Official analytics analysis guidance
Review cadence: Quarterly
Rights treatment: Metadata, summary and link only

Verified marketing finding:

- GA4 explorations can be used to inspect ecommerce journeys and identify points where users abandon checkout.

Marketing implications:

- Conversion optimisation should begin with the actual stage of loss.
- A low purchase rate may be caused by product-page, cart, shipping, payment or technical friction.
- Creative changes should not be prescribed when the main failure is later in checkout.

Candidate skill card:

**Retail Funnel Diagnosis**

Inputs:

- product views;
- add-to-cart;
- checkout starts;
- shipping step;
- payment step;
- purchases;
- refunds;
- device split;
- channel split;
- known tracking limitations.

Output:

- largest verified drop-off;
- likely marketing versus website problem;
- evidence gaps;
- next test;
- no unsupported causal claim.

### RM7 — Promotion Architecture for Organic and Paid Content

Derived from RM1, RM3 and RM4.
Status: Candidate knowledge; human review required.

Recommended campaign record:

- offer name;
- objective;
- eligible products or categories;
- audience;
- channel;
- live start and end time;
- code or automatic discount;
- minimum spend;
- exclusions;
- delivery conditions;
- landing page;
- feed mapping;
- creative variants;
- approval owner;
- tracking events;
- post-campaign result.

Marketing rule:

No post, ad, email or website banner should be written before the offer record is complete enough to prevent contradictory messaging.

### RM8 — Review and Social-Proof Content

Derived from RM2 and platform-review principles.
Status: Candidate knowledge; human review required.

Safe uses:

- verified customer quotes with permission;
- product-rating summaries with date and source;
- common review themes;
- creator demonstrations with disclosure and usage rights;
- customer questions converted into educational content.

Unsafe uses:

- fabricated reviews;
- staff presented as independent customers;
- edited testimonials that change meaning;
- one customer result presented as typical for everyone;
- ratings copied from another product or retailer;
- “best seller” without current sales evidence.

### RM9 — Retail Creative Planning Framework

Status: Candidate skill card; human review required.

Purpose:

Turn product truth and customer intent into practical content rather than generic catalogue posts.

Required inputs:

- product or category;
- verified features;
- primary use case;
- customer objection;
- differentiator;
- current price and stock state;
- target audience;
- platform;
- desired action;
- rights-cleared media available.

Content angles:

1. Demonstration — show the product solving a real problem.
2. Selection — help customers choose between variants or options.
3. Comparison — explain meaningful differences without unsupported competitor claims.
4. Proof — reviews, demonstrations, specifications or evidence.
5. Objection handling — answer price, quality, fit, delivery or use concerns.
6. Occasion — connect the product to a relevant moment or need.
7. Behind the product — sourcing, craftsmanship, packing or service.
8. Offer — communicate a truthful, time-bound promotion.
9. Retention — care, replenishment, accessories or next purchase.

Output standard:

- one clear hook;
- one product truth;
- one customer benefit;
- one useful proof point;
- one action;
- no unsupported urgency or hype.

### RM10 — Marketing Reporting Truth for Retail

Status: Candidate knowledge; human review required.

Report separately:

- reach and engagement;
- product-page sessions;
- product views;
- add-to-cart events;
- checkout starts;
- purchases;
- tracked revenue;
- refunds;
- product or category performance;
- new versus returning customer signals where reliable;
- campaign cost;
- cost per purchase;
- return on ad spend where revenue tracking is verified;
- measurement gaps.

Do not collapse these into one “sales” number.

## Marketing-only inclusion test

A future retail resource belongs in this Library pack only when it answers at least one of these questions:

- What should we create?
- Who should we target?
- What may we claim?
- How should the offer be structured?
- Which product or message should be prioritised?
- Where is the customer journey failing?
- What should we test next?
- How should marketing performance be reported?

Material that only explains bookkeeping, tax filing, internal finance or unrelated operations should remain outside the Marketing Library unless it directly changes an advertised price, promotion, customer-facing claim or measured marketing outcome.

## Review queue

Before activation:

- verify all canonical links;
- register each source as an individual Library resource;
- add access date and freshness state;
- convert RM7–RM10 into review-state knowledge or skill cards;
- test retrieval by platform, retail, ecommerce, promotions, reviews and conversion;
- confirm no broad operational or finance material is surfaced in ordinary marketing search results.
