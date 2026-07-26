# AI Workforce — Local Marketing and Reputation Source Pack

Last updated: 2026-07-26
Status: Research packet prepared; no production knowledge activated.

## Purpose

Build a trustworthy local-marketing layer for restaurants, venues, retailers, service businesses, dealerships and multi-location clients.

This layer should help the AI Workforce connect:

```text
Google Search/Maps visibility → Business Profile interaction → Website visit/call/directions → Lead or visit → Client outcome
```

## Official Google Business Profile sources

### Local ranking factors

- Publisher: Google Business Profile Help
- Canonical URL: https://support.google.com/business/answer/7091
- Official concepts:
  - relevance;
  - distance;
  - prominence/popularity;
  - complete and accurate business information;
  - verification;
  - reviews and replies;
  - photos and videos.
- Candidate knowledge:
  - No legitimate service can guarantee or pay Google for a better organic local ranking.
  - Local ranking is not a single keyword-placement formula.
  - Complete accurate profile information supports relevance but does not guarantee a position.
  - Distance is partly outside the marketer's control.
  - Prominence can be influenced by wider web signals and genuine reviews, but must not be manipulated.

### Business Profile performance metrics

- Canonical URL: https://support.google.com/business/answer/9918094
- Use for:
  - profile views;
  - searches;
  - calls;
  - website clicks;
  - direction requests;
  - messages;
  - bookings;
  - menus and other eligible interactions.
- Truth rules:
  - Not every metric is available for every business.
  - Profile views use Google-specific counting and are not the same as website page views.
  - Call metrics count call-button clicks, not necessarily answered or qualified calls.
  - Website clicks are clicks from the profile, not confirmed website sessions or conversions.
  - Direction requests are intent signals, not confirmed store visits.
  - Search-query data can have update delays.

### Google Business Profile to GA4 connection

- Analytics Help: https://support.google.com/analytics/answer/16930347
- Business Profile Help: https://support.google.com/business/answer/16987554
- Candidate knowledge:
  - Linking can bring interactions, website clicks, calls, directions, messages, bookings and menu clicks into GA4.
  - Current Google documentation states GBP metrics in GA4 have a limited historical window.
  - Multiple linked profiles can be aggregated, which can prevent location-level segmentation in the imported report.
- Product implication:
  - Store the connection and aggregation scope.
  - Do not present aggregated multi-location totals as one location's facts.
  - Preserve raw Business Profile and GA4 definitions separately.

### Business categories

- Canonical URL: https://support.google.com/business/answer/7249669
- Candidate knowledge:
  - Categories tell Google what the business does and affect matching/local visibility.
  - The primary category should accurately describe the core business.
  - Categories must not be selected only to chase unrelated traffic.

### Review and user-generated-content policies

1. Maps user-generated content policy
   - https://support.google.com/contributionpolicy/answer/7422880

2. Incentivised or biased reviews
   - https://support.google.com/contributionpolicy/answer/16597558

3. Rating manipulation
   - https://support.google.com/contributionpolicy/answer/16597280

4. General policy scope
   - https://support.google.com/contributionpolicy/answer/7400113

Candidate knowledge:

- Reviews should reflect genuine experiences.
- Do not buy, fabricate or coordinate fake reviews.
- Do not offer benefits in exchange for a positive rating or review.
- Do not pressure customers to leave a specific score.
- Staff and owners with conflicts of interest should not create deceptive reviews.
- Review-request systems should invite honest feedback, not filter only happy customers into public review channels.
- AI-generated review text should not be presented as a customer's genuine experience.

## Client dashboard opportunities

A future Local Presence module can show:

- verified profile status;
- profile completeness and freshness;
- views/searches/interactions;
- website clicks;
- calls;
- directions;
- bookings/messages when eligible;
- review count and rating trend;
- review response coverage;
- top public review themes with privacy-safe summarisation;
- website/GA4 follow-through;
- service state and setup requirements.

Do not combine these into one invented score unless the scoring method is transparent and reviewable.

## Candidate Skill Card themes

### Local presence basics

- accurate name, category, location/service area, hours and contact details;
- special-hours maintenance;
- consistent website and profile information;
- relevant products/services;
- current photos and videos;
- location-specific landing pages for multi-location businesses.

### Review strategy

- ask real customers at an appropriate moment;
- request honest feedback without incentives for positive sentiment;
- respond professionally;
- distinguish operational complaints from reputation attacks;
- escalate threats, private information and legal issues;
- do not reveal personal data in public replies;
- use recurring review themes as service-improvement evidence, not absolute truth.

### Measurement

- Business Profile interactions are upper/mid-funnel intent signals;
- website sessions and tracked key events provide downstream evidence;
- lead/call qualification provides business-quality evidence;
- store visits and sales require their own reliable data source;
- comparison periods must consider seasonality, closures and profile changes.

## South African application

Research/implementation should account for:

- South African addresses, suburbs, towns and service areas;
- public-holiday and special trading hours;
- multilingual customer responses where appropriate;
- POPIA when handling review authors, messages and lead details;
- CPA/ARB rules for offers, pricing and claims;
- sector-specific rules for health, finance, alcohol and regulated products.

## Review gate

Before activation:

- open and verify each official page;
- capture the exact metric or policy claim;
- date the verification;
- record limitations;
- keep policy and ranking knowledge current;
- promote only after human review.
