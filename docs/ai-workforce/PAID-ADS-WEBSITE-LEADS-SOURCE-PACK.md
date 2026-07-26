# AI Workforce — Paid Ads, Website Intelligence and Leads Source Pack

Last updated: 2026-07-26
Status: Research packet prepared; no production knowledge activated.

## Purpose

Prepare the next evidence-backed AI Workforce knowledge layer for the full marketing journey:

```text
Campaign → Click or lead form → Website session → Key event → Lead → Qualified lead → Conversion
```

This packet is designed for the Paid Ads Agent, Marketing Strategist, Client Report Agent, Social Media Strategist and future Website/Lead Intelligence workflows.

## Permanent truth rules

- Platform conversions are not automatically customers, sales or revenue.
- Submitted leads, qualified leads and converted leads are separate states.
- Google Ads, GA4, Search Console and CRM/lead records use different scopes and counting rules.
- Website traffic growth during an ad campaign is not proof that ads caused all growth.
- Attribution is model-dependent and may allocate fractional credit.
- Missing tracking must be reported as a measurement gap, not interpreted as zero.
- User acquisition and traffic acquisition are different scopes and must not be compared as if equivalent.
- Search Console table rows can exclude anonymised or truncated query data while totals still include it.
- Direct traffic can include genuinely direct visits and visits whose attribution information was lost.
- Client-specific website, ad and lead evidence remains isolated to that client.

## Priority official sources

### Google Ads

1. Lead form assets
   - Publisher: Google Ads Help
   - Canonical URL: https://support.google.com/google-ads/answer/9423234
   - Use for: direct-in-ad lead capture, delivery/export options, retention windows, privacy-policy requirement, eligibility and lead-form limitations.
   - Candidate knowledge:
     - Google Ads lead forms can deliver leads through CSV, email, API, webhook or supported partners.
     - Export and storage windows are limited; automated ingestion should not rely on indefinite platform retention.
     - A submitted Google lead form is a lead submission, not a verified customer.

2. Lead form best practices
   - Canonical URL: https://support.google.com/google-ads/answer/17051443
   - Use for: form quality, question design, CTA, campaign eligibility and conversion-focused setup.
   - Candidate knowledge:
     - Form friction and lead quality must be balanced.
     - Lead-form reporting should include quality feedback, not only volume.

3. Attribution models
   - Canonical URL: https://support.google.com/google-ads/answer/6259715
   - Use for: conversion-credit interpretation and model changes.
   - Candidate knowledge:
     - Attribution changes how credit is distributed across ad interactions.
     - Historical comparisons require awareness of attribution-model changes.
     - Google Ads currently supports data-driven and last-click models for relevant conversion actions; deprecated models must not be presented as current.

4. Google Ads assets
   - Canonical URL: https://support.google.com/google-ads/answer/7331111
   - Use for: ad asset roles, goal alignment and lead-form assets.

5. Google Ads conversion definitions and setup
   - Research target: exact current Google Ads Help pages for website conversions, enhanced conversions, offline conversion imports and conversion action settings.
   - Required capture fields:
     - conversion source;
     - primary/secondary status;
     - counting method;
     - attribution model;
     - conversion window;
     - value/currency;
     - imported versus native;
     - last verified date.

### Google Analytics 4

1. Conversion and key-event relationship
   - Publisher: Google Analytics Help
   - Canonical URL: https://support.google.com/analytics/answer/9356034
   - Use for: Event → Key event → Google Ads conversion relationship.
   - Candidate knowledge:
     - Important business actions originate as events.
     - Marking an event as a key event and importing/creating a conversion are distinct steps.
     - Cross-channel key events can include organic, email and social sources.

2. Traffic acquisition report
   - Canonical URL: https://support.google.com/analytics/answer/12923437
   - Use for: session-scoped source, medium, campaign and channel analysis.
   - Candidate knowledge:
     - Traffic acquisition is session-scoped.
     - Default channel groups include paid and organic channels but depend on correct tagging/integration.

3. User acquisition versus traffic acquisition
   - Canonical URL: https://support.google.com/analytics/answer/14731736
   - Use for: first-user versus session scope.
   - Candidate knowledge:
     - User acquisition focuses on how new users were first acquired.
     - Traffic acquisition focuses on how sessions were acquired.
     - Values from the two reports should not be directly compared without respecting scope.

4. Traffic-source dimensions
   - Canonical URL: https://support.google.com/analytics/answer/15612152
   - Supporting scope page: https://support.google.com/analytics/answer/11080067
   - Use for: source, medium, campaign, platform and attribution scope.

5. Manual campaign/UTM reporting
   - Canonical URL: https://support.google.com/analytics/answer/14264492
   - Use for: UTM governance and manually tagged campaign measurement.
   - Candidate knowledge:
     - Social, email and non-Google campaign attribution depends on consistent tagging.
     - UTM loss or inconsistency can shift traffic into direct/none or fragmented campaign rows.

6. Direct / none traffic
   - Canonical URL: https://support.google.com/analytics/answer/15258820
   - Use for: attribution-loss explanations.
   - Candidate knowledge:
     - Direct traffic is not always typed/bookmarked traffic.
     - Missing UTMs, redirects, shorteners, ad blockers and technical loss can contribute.

7. Realtime limitations
   - Canonical URL: https://support.google.com/analytics/answer/9271392
   - Use for: realtime verification and processing caveats.

### Google Search Console

1. Clicks, impressions and position
   - Canonical URL: https://support.google.com/webmasters/answer/7042828
   - Use for: exact Search Console metric semantics.

2. Performance report overview
   - Canonical URL: https://support.google.com/webmasters/answer/7576553
   - Use for: query, page, country, date and search-appearance analysis.

3. Performance report data and aggregation
   - Canonical URL: https://support.google.com/webmasters/answer/17011364
   - Use for: property-versus-page aggregation, preliminary data and export caveats.
   - Candidate knowledge:
     - Property totals and page rows can differ because aggregation differs.
     - Preliminary data may change.
     - Exported unavailable values can appear as zero, so ingestion must preserve availability state rather than trusting export zeros blindly.

4. Dimensions and hidden query limitations
   - Canonical URL: https://support.google.com/webmasters/answer/17011259
   - Use for: anonymised queries and table truncation.

5. Search performance use cases
   - Canonical URL: https://support.google.com/webmasters/answer/17010961
   - Use for: branded/non-branded analysis, query and page interpretation.

## Lead-source research targets

### Meta lead ads

- Official landing page: https://www.facebook.com/business/ads/ad-objectives/lead-generation/lead-ads-with-forms
- Required deeper capture from current Meta Business Help:
  - lead retrieval and retention;
  - Leads Access Manager permissions;
  - webhook/CRM delivery;
  - instant-form versus website-form distinction;
  - custom questions and consent;
  - higher-intent form options;
  - lead quality and conversion feedback.
- Candidate knowledge:
  - An instant-form submission is a lead submission, not a qualified or converted lead.
  - Website-form and instant-form leads must preserve source and form identity separately.

### Website forms

Research and model common delivery methods without tying the architecture to one CMS:

- native website database/API;
- email notification parsing only as a fallback;
- webhook;
- CRM integration;
- form-provider API;
- CSV/Excel import;
- Google Sheets sync.

Required canonical lead fields:

- client_id;
- source_platform;
- source_account;
- campaign/ad/form identifiers;
- landing page;
- submitted_at;
- name;
- phone;
- email;
- message/enquiry;
- consent source;
- lead status;
- qualification outcome;
- conversion outcome;
- assigned person;
- follow-up date;
- deduplication evidence;
- original raw payload reference.

## Candidate knowledge packets for review

### Packet A — Measurement hierarchy

- impressions/clicks;
- sessions/users;
- engaged sessions;
- key events;
- platform conversions;
- lead submissions;
- qualified leads;
- converted leads;
- revenue.

Rule: never skip stages or rename a higher-funnel event as a lower-funnel business result.

### Packet B — Ads to website impact

An honest monthly report should separate:

- Google Ads clicks;
- GA4 sessions attributed to Google Ads;
- landing-page engagement;
- website key events;
- imported Google Ads conversions;
- direct Google lead forms;
- lead records in the Leads Hub;
- qualified and converted lead feedback.

Discrepancies are expected because products use different definitions, processing, consent and attribution.

### Packet C — Lead quality

A low cost per submitted lead can still be poor performance if:

- contact details are invalid;
- the person is outside the service area;
- the enquiry does not match the offer;
- the lead is duplicated;
- the client never follows up;
- the lead does not qualify or convert.

Recommendation quality should use cost per qualified lead and cost per converted lead when reliable downstream statuses exist.

### Packet D — Website traffic truth

- Website-platform differences do not require separate analytics architecture if GA4/Search Console are implemented correctly.
- CMS/hosting-specific connectors are optional operational layers, not the measurement foundation.
- A client without valid analytics should display Setup required, not zero traffic.
- Traffic changes must be segmented by channel before attributing impact to ads or social.

## Product implementation handoff

The next implementation agent should:

1. Register these official sources in the Marketing Library as metadata/link-only.
2. Create candidate Skill Cards and platform/measurement knowledge in review state only.
3. Add client website connection records for domain, GA4 property, Search Console property and Google Ads account.
4. Build canonical monthly website facts with metric availability and definition metadata.
5. Build a Leads Hub with source identity, deduplication evidence and status history.
6. Add service states: active, setup_in_progress, connection_required, service_available, not_in_package.
7. Keep all client website and lead records isolated by RLS.
8. Make the Client Report Agent cite metric definitions and state attribution limitations.
9. Add tests proving submitted leads are never reported as customers or revenue.
10. Add tests proving unavailable tracking is not rendered as zero.

## Review gate

Nothing in this packet is production knowledge until:

- the exact official page is opened and verified;
- the source record is captured;
- the claim is restated accurately;
- limitations are recorded;
- a human reviewer promotes it.
