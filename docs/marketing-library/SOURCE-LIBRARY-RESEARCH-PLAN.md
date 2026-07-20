# CG Dynamics Source Library Research Plan

**Status:** Active current plan  
**Last updated:** 2026-07-20  
**Branch:** `feature/ai-workforce-db-design`

## Purpose

Build the verified human-source foundation that powers CG Dynamics Industry Brains, Client Brains, specialist agents and Digital Content Guides.

The objective is not to collect the largest possible library. The objective is to create a small, high-trust body of knowledge that can be traced, reviewed, applied and improved through real campaign results.

## Core rule

AI may retrieve, organise, compare, translate and apply knowledge. AI-generated text is never accepted as the authority or original source.

Every recommendation should be grounded in one or more of:

- Human-authored primary or respected expert sources.
- Official platform documentation.
- Peer-reviewed research.
- Official South African legislation, calendars or public information.
- Verified client information.
- Measured internal campaign performance.
- Explicitly labelled staff observations and operational learning.

## Knowledge hierarchy

1. **Universal marketing principles**
   - Advertising fundamentals.
   - Copywriting.
   - Consumer psychology.
   - Behavioural economics.
   - Brand strategy.
   - Offer design.
   - Research and measurement.

2. **Platform intelligence**
   - Meta and Instagram.
   - TikTok.
   - Google Ads and Search.
   - YouTube.
   - LinkedIn.
   - Website, SEO and analytics.

3. **South African market intelligence**
   - Official public holidays.
   - School terms and seasonal cycles.
   - National and regional events.
   - Major sports calendars where commercially relevant.
   - Local audience language and trust signals.
   - Consumer and business context.
   - Applicable advertising and privacy requirements.

4. **Industry Brains**
   - Hospitality and entertainment.
   - Retail.
   - Architecture, construction and property.
   - Automotive.
   - Agriculture and fuel.
   - Professional services.
   - Health, beauty and lifestyle.
   - Other categories added only when active clients require them.

5. **Client Brains**
   - Brand voice.
   - Products and services.
   - Audience.
   - Approved and rejected language.
   - Previous campaigns.
   - Content pillars.
   - Staff, locations and recurring operational context.
   - Client approvals, amendments and feedback.
   - Measured performance learning.

## Source tiers

### Tier 1 — Primary and authoritative

- Official platform documentation.
- Government sources and legislation.
- Peer-reviewed research.
- First-party campaign data.
- Direct client interviews and approved records.
- Original books or publications from recognised practitioners.

### Tier 2 — Strong expert interpretation

- Respected practitioner books.
- Reputable industry bodies.
- High-quality research organisations.
- Expert interviews with clear authorship and context.

### Tier 3 — Discovery only

- Blogs, newsletters, social posts and trend articles.
- Useful for finding questions, examples or primary sources.
- Never activated as authoritative knowledge without verification.

## Initial universal source set

Already present:

- *Scientific Advertising* — Claude Hopkins.
- *Ogilvy on Advertising* — David Ogilvy.
- *Influence* — Robert Cialdini.
- *Made to Stick* — Chip Heath and Dan Heath.

Recommended next review set:

- *Breakthrough Advertising* — Eugene Schwartz.
- *The Copywriter's Handbook* — Robert Bly.
- *How Brands Grow* — Byron Sharp.
- *Thinking, Fast and Slow* — Daniel Kahneman, used carefully and checked against later research where relevant.
- *Nudge* — Richard Thaler and Cass Sunstein, with later editions and critiques considered.
- *The Choice Factory* — Richard Shotton.
- *Alchemy* — Rory Sutherland, treated as practitioner insight rather than universal scientific proof.
- *Building a StoryBrand* — Donald Miller, used as a framework source rather than objective law.
- *Contagious* — Jonah Berger.
- *Obviously Awesome* — April Dunford.

These are candidates, not automatically approved sources. Each requires a source note defining what it can and cannot support.

## Initial official platform source set

Research and maintain current official documentation for:

- Meta Business Help and official creative guidance.
- TikTok For Business Help and Creative Center.
- Google Ads Help, Search, Demand Gen, YouTube and Analytics documentation.
- LinkedIn Marketing Solutions documentation.
- YouTube Creator and Ads guidance.

Platform guidance changes. Every platform card must include:

- Source URL or canonical identifier.
- Last checked date.
- Platform product and format.
- Region or account limitation where relevant.
- Expiry/review date.
- Whether the rule is mandatory, recommended or observed.

## Initial South African intelligence sources

Start with official and stable sources:

- South African Government public holiday calendar.
- Relevant national legislation and official guidance.
- Provincial school calendars from official education authorities.
- Statistics South Africa for demographic and economic context.
- ICASA, POPIA/Information Regulator and advertising standards sources where relevant.

Public holidays are opportunities only when relevant to the client and industry. The system must never force generic holiday posts merely because a date exists.

## Research workflow

For every proposed source:

1. Record the source and why it matters.
2. Classify source tier and authority.
3. Record what the source can support.
4. Record what it cannot support.
5. Extract candidate principles without fabricating quotations or page references.
6. Separate direct source meaning from modern interpretation.
7. Create Skill Cards in `needs_review` only.
8. Verify manually before activation.
9. Assign applicable Industry Brains and specialist agents.
10. Set a review date for changing sources.

## Skill Card requirements

Each active card must include:

- Stable card ID.
- Clear principle.
- Source and author/organisation.
- Source type and tier.
- Exact chapter, section or official page where possible.
- Direct support versus interpretation.
- Confidence.
- Extrapolation risk.
- Applicable industries and platforms.
- Practical use.
- Misuse warnings.
- Review history.
- Last checked date.
- Expiry or revalidation date where relevant.

## Industry Brain rules

- Industry knowledge must be reusable and must not contain former-client noise.
- Industry agents inherit universal principles and relevant platform intelligence.
- They should know industry-specific commercial cycles, customer concerns, content patterns and compliance boundaries.
- Industry agents suggest opportunities; they do not force irrelevant trends, holidays or tactics.
- Claims about what works must distinguish research, platform guidance, internal observations and measured results.

## Client Brain rules

- A Client Brain inherits only relevant Industry Brain knowledge.
- It stores client-specific approved truth, not guesses.
- Client feedback, approvals, rejections and on-site changes become structured learning.
- Inactive clients do not influence default recommendations for active clients.
- Performance conclusions require enough evidence and must state uncertainty.

## Digital Content Guide connection

The client agent should use the library to suggest content ideas with a visible rationale:

- Why this idea suits the client.
- Which objective it supports.
- Which source, client learning or measured result informed it.
- Why a seasonal, public-holiday or event opportunity is relevant.
- When the idea expires or becomes inappropriate.

Staff and clients may approve, amend or reject suggestions. Their decisions update the Client Brain.

After a content run, one natural voice note should be enough. AI extracts and presents a short confirmation summary, including:

- Videos completed or shot.
- Videos amended on site.
- Videos rejected or no longer appropriate.
- Videos to move to the next content run.
- Time-sensitive ideas that must not be carried forward.
- New client feedback or useful observations.

## First research wave

### Wave 1 — Foundation

- Finish source-integrity review of the five existing Scientific Advertising cards.
- Create source notes for the next universal books only after source access is confirmed.
- Register official Meta, TikTok and Google documentation as living sources.
- Register the official South African public-holiday source.
- Finalise the Skill Card and Source Note schemas before volume extraction.

### Wave 2 — First Industry Brain

Use Hospitality and Entertainment as the first deep industry because multiple active clients can benefit.

Research areas:

- Local event and venue marketing.
- Food and beverage decision psychology.
- Reservations and attendance behaviour.
- Sports-viewing and event opportunities.
- Repeat visits and loyalty.
- User-generated content and social proof.
- Short-form video formats.
- Offers without obvious bill-padding or forced promotions.
- Seasonal and public-holiday relevance.

### Wave 3 — First Client Brains

Create client-specific knowledge only for active clients selected from the live client system. Do not embed client names into the reusable master library.

## Tomorrow-ready outcomes

Before handing work to a coding agent, aim to have:

- Agreed Source Note schema.
- Agreed Skill Card schema.
- Agreed source lifecycle and review statuses.
- Prioritised first 20–30 sources.
- First Industry Brain scope.
- Clear boundaries between universal, platform, industry and client knowledge.
- A research queue with owners and verification requirements.

## Efficiency rule

Do not generate hundreds of cards because it is technically possible. Build a small verified library, test whether agents apply it well, learn from real outputs and then expand deliberately.
