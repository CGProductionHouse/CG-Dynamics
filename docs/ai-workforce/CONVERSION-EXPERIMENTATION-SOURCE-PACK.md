# AI Workforce — Conversion, Landing Pages and Experimentation Source Pack

Last updated: 2026-07-26
Status: Research pack; no production knowledge activated.

## Purpose

Teach the AI Workforce to connect advertising, website experience and lead generation without inventing causal claims.

The target decision chain is:

```text
Audience / keyword
→ ad promise
→ landing page
→ user interaction
→ form / call / message / purchase event
→ qualified outcome
→ experiment or optimisation decision
```

## Official source families

### Google Ads landing-page guidance

Official pages:

- Landing-page definition and Quality Score context:
  https://support.google.com/google-ads/answer/14086
- Ad and landing-page optimisation:
  https://support.google.com/google-ads/answer/6238826
- Landing-page performance report:
  https://support.google.com/google-ads/answer/7543502
- Destination experience policy:
  https://support.google.com/adspolicy/answer/16427615
- Final URL and tracking parameters:
  https://support.google.com/google-ads/answer/6080568

Candidate verified principles:

- Landing-page relevance, usefulness, navigation and expectation match affect landing-page experience.
- Ad promise, keyword intent and landing-page content should align.
- The page should make the intended action easy to find and complete.
- Mobile usability and speed matter to landing-page performance.
- A final URL and display URL must follow Google destination rules.
- Pop-ups, abusive experiences and misleading destinations can create policy problems.

Do not claim that one landing-page change caused performance improvement unless tested or otherwise supported.

### Core Web Vitals and site experience

Official source:
- https://developers.google.com/search/docs/appearance/core-web-vitals

Current official thresholds to store as time-sensitive knowledge only after exact-page review:

- LCP good target: within 2.5 seconds;
- INP good target: under 200 milliseconds;
- CLS good target: under 0.1.

Important limitations:

- Core Web Vitals measure loading, responsiveness and visual stability, not complete commercial effectiveness.
- Passing Core Web Vitals does not prove a page converts well.
- Poor scores do not establish the sole cause of poor campaign performance.
- Field data and lab data differ and must be labelled.

### GA4 events and experiments

Official sources:

- GA4 events:
  https://support.google.com/analytics/answer/9356037
- GA4 A/B test definition:
  https://support.google.com/analytics/answer/13468470
- GA4 experiment overview:
  https://support.google.com/analytics/answer/13470255
- GA4 explorations:
  https://support.google.com/analytics/answer/7579450

Candidate verified principles:

- An event records an interaction or occurrence; it is not automatically a business conversion.
- A/B tests randomise users across variants and compare a predefined goal.
- GA4 does not run the test itself; a third-party experimentation tool is required for web experiments.
- Experiment success metrics and decision rules should be chosen before inspecting results.

### Google Ads experiments and lift

Official sources:

- Experiments page:
  https://support.google.com/google-ads/answer/10682377
- Test with confidence:
  https://support.google.com/google-ads/answer/7281575
- Custom experiments:
  https://support.google.com/google-ads/answer/10683687
- Experiment monitoring:
  https://support.google.com/google-ads/answer/6318747
- Experiment Center and lift studies:
  https://support.google.com/google-ads/answer/16856494

Candidate verified principles:

- Start with a clear business-linked hypothesis.
- Test one meaningful variable at a time where practical.
- Select primary success metrics before the test begins.
- Avoid overlapping experiments that interfere with interpretation.
- Preserve control and treatment dates, budget split, traffic split and confidence information.
- An undecided or unavailable result is not a failed experiment.
- Platform experiments and lift studies answer different questions.
- Lift studies are designed to estimate incremental impact beyond ordinary clicks and reported conversions.

## Canonical experimentation model

Every experiment should retain:

- client_id;
- experiment_id;
- channel and property/account;
- business objective;
- hypothesis;
- control definition;
- treatment definition;
- single primary variable where possible;
- primary success metric;
- guardrail metrics;
- start and end dates;
- eligibility rules;
- traffic or budget allocation;
- sample / exposure information where available;
- confidence interval or platform result state;
- result;
- interpretation;
- limitations;
- decision;
- implementation status;
- post-implementation monitoring.

Result states:

- planned;
- running;
- insufficient_data;
- undecided;
- positive;
- negative;
- mixed;
- invalidated;
- applied;
- not_applied;
- superseded.

## Candidate knowledge packets

### Packet 1 — Message match

Principle:
The advertisement, keyword or audience promise should match the information and action presented on the landing page.

Evidence:
Official Google Ads landing-page guidance.

### Packet 2 — Action clarity

Principle:
A landing page should make the intended action easy to locate and complete, especially on mobile.

Limitation:
This is not a universal instruction to remove all navigation or all secondary information.

### Packet 3 — Speed and experience

Principle:
Measure real-user loading, interaction responsiveness and layout stability using their distinct metrics.

Limitation:
Technical performance is one part of user and conversion experience.

### Packet 4 — One test, one causal question

Principle:
A useful experiment begins with a specific hypothesis and a predefined success metric. Changing many unrelated variables weakens causal interpretation.

### Packet 5 — No premature winner

Principle:
Do not call a treatment the winner when the result is insufficient, undecided, unavailable or confounded.

### Packet 6 — Incrementality versus attribution

Principle:
Attributed conversions and incremental conversions are different concepts. Platform attribution reports observed credit under a model; controlled lift studies estimate additional outcomes caused by exposure under their methodology.

## Website and campaign diagnostics

The future Website Intelligence layer should separate:

- technical availability;
- mobile usability;
- Core Web Vitals;
- landing-page relevance;
- traffic-source quality;
- event instrumentation;
- form functionality;
- conversion rate;
- lead quality;
- page-level campaign performance;
- experiment history.

Suggested diagnostics:

- page returns valid response;
- SSL and domain valid;
- tracking tag detected;
- intended event firing;
- form submission confirmed;
- mobile page usable;
- LCP / INP / CLS status;
- ad final URL maps correctly;
- UTM or click identifiers retained where authorised;
- campaign promise visible;
- CTA and contact path present;
- client claims substantiated;
- privacy / consent notice appropriate;
- no misleading destination behaviour.

## AI workflows to support later

- landing-page audit;
- ad-to-page message-match review;
- conversion instrumentation plan;
- experiment backlog;
- test hypothesis and design;
- experiment result interpretation;
- website monthly insight;
- lead-funnel diagnosis;
- prioritised optimisation recommendation;
- pre-launch landing-page QA.

Outputs must distinguish:

- observed fact;
- source-backed principle;
- hypothesis;
- recommended test;
- causal result;
- limitation;
- business decision.

## Research questions still open

- Which third-party experimentation tool best fits CG-managed client websites?
- How will consent and cookie controls vary across client sites and jurisdictions?
- Which form platforms can expose safe webhook or API events?
- How should offline lead quality be returned to ad platforms?
- What minimum sample and duration rules are appropriate for low-volume SME clients?
- When should qualitative evidence override or complement weak quantitative tests?

These questions must remain unresolved until researched and reviewed.

## Safety

- Do not alter client websites from research mode.
- Do not start paid experiments without budget approval.
- Do not imply statistical certainty when the platform reports insufficient data.
- Do not collapse GA4 events, platform conversions, leads, qualified leads and sales.
- Do not generalise one client's experiment to all clients.
- Do not activate time-sensitive metric thresholds without exact-page review and freshness metadata.