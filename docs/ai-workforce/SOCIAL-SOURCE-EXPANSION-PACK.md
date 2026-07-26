# AI Workforce — Social Source Expansion Pack

Last updated: 2026-07-26
Status: Research packet ready for review and structured ingestion
Owner: AI Workforce

## Purpose

This packet expands the Social Media Master foundation with authoritative, current source targets and review-ready knowledge claims. It is designed for the existing `platform_experts`, `platform_surfaces`, `platform_knowledge_items`, Marketing Library source registry and human-review workflow.

Nothing in this document becomes production knowledge automatically. Every claim must be entered as `experimental` or `needs_review`, linked to its exact source, checked by a human reviewer and promoted only when the source page and metric definition are confirmed.

## Source hierarchy

1. Official platform help, analytics and policy documentation.
2. Official creative centres, ad libraries and transparency tools.
3. Official government, regulator and industry-code sources.
4. Public-domain human-authored marketing and psychology books with explicit rights evidence.
5. Peer-reviewed or reputable open-access research.
6. Verified CG campaign evidence, isolated by client and labelled observational.

AI-written summaries, generic marketing blogs and unsupported creator advice are never source truth.

## Priority official platform sources

### Meta / Instagram / Facebook

| Source | Canonical URL | Use | Candidate review claims |
|---|---|---|---|
| Instagram Insights | https://www.facebook.com/help/instagram/788388387972460 | Organic metric definitions | Views are plays/displays; accounts reached is unique and estimated/in development; views and reach are not interchangeable. |
| Instagram Reels Insights | https://www.facebook.com/help/instagram/202865988324236 | Reel metric definitions | Reel views include starts/replays; watch time includes replay time; average watch time uses initial views; follows can be attributed to a reel. |
| Instagram Reel technical requirements | https://www.facebook.com/help/1038071743007909/ | Production constraints | Reels support 1.91:1–9:16; minimum 30 FPS and 720 px; highest-quality upload is a user setting. |
| Boost Instagram Reels | https://www.facebook.com/help/instagram/570215404599013 | Organic-to-paid eligibility | Boost eligibility has specific duration, aspect, music and effect restrictions; organic suitability does not guarantee paid eligibility. |
| Meta Ad Library | https://www.facebook.com/ads/library/ | Historical/current ad research | Store metadata and canonical links only; do not mirror restricted creative. |

Review rule: Facebook and Instagram metrics stay platform-specific. Never sum unique audiences across platforms and never convert unavailable metrics to zero.

### TikTok

| Source | Canonical URL | Use | Candidate review claims |
|---|---|---|---|
| Creative Center overview | https://ads.tiktok.com/help/article/creative-center | Trends, Top Ads, keyword insights, creative education | Creative Center is an official research tool for trends, high-performing ad examples and creative resources; examples inspire hypotheses, not universal rules. |
| Trends | https://ads.tiktok.com/help/article/how-to-use-trends | Regional/industry trend research | Trends can be filtered by industry/time and provides trendline, related videos, audience and regional data. Trends expire and require date/territory capture. |
| Reporting metrics | https://ads.tiktok.com/help/article/all-metrics | Paid measurement taxonomy | TikTok separates attribution, in-app, page-event, video-play and onsite-event metrics. |
| Basic metric definitions | https://ads.tiktok.com/help/article/basic-data | Core paid metrics | Destination clicks differ from all clicks; reach is unique users; conversions depend on the selected event/attribution setup. |
| Video play metrics | https://ads.tiktok.com/help/article/video-play | Video metric definitions | 2-second, 6-second, quartile and completion metrics use explicit platform definitions; replays and impression sessions must be handled according to the metric. |
| Estimated metrics | https://ads.tiktok.com/help/article/what-are-estimated-metrics | Truth-state handling | Reach, frequency and other metrics may be modelled/estimated and should retain that status in reporting. |
| Attribution metrics | https://ads.tiktok.com/help/article/attribution | Attribution limitations | Website attribution requires TikTok Pixel or equivalent event setup; attributed conversions are not automatically proven revenue. |
| Video Insights | https://ads.tiktok.com/help/article/video-insights | Creative analysis workflow | Compare creatives using consistent date ranges and metrics; industry benchmarks are contextual, not causal proof. |
| TikTok Ad Library / Commercial Content Library | https://library.tiktok.com/ads | Ad transparency research | Store metadata, advertiser, territory, date, objective and canonical link only. |

Review rule: TikTok trend data must include research date, territory and expiry. Do not turn a trending hashtag or one Top Ad into a guaranteed recommendation.

### YouTube

| Source | Canonical URL | Use | Candidate review claims |
|---|---|---|---|
| Content performance | https://support.google.com/youtube/answer/12220281 | Organic analytics definitions | Content analytics differ across Videos, Shorts, Live and Posts; traffic source, retention and viewer metrics must remain format-specific. |
| Shorts creation and view-count change | https://support.google.com/youtube/answer/10059070 | Current Shorts definition | Since 31 March 2025, Shorts views count starts/replays with no minimum watch time; Engaged views remains the meaningful continue-watching metric. |
| Audience retention | https://support.google.com/youtube/answer/9314415 | Creative diagnosis | Spikes, dips and gradual declines are diagnostic signals; they require interpretation and do not prove causation. |
| Engagement analytics | https://support.google.com/youtube/answer/9313698 | Watch-time metrics | Average view duration and watch time have explicit format-sensitive definitions. |
| Audience analytics | https://support.google.com/youtube/answer/9314416 | Audience development | Monthly audience is a rolling 28-day estimate; new/casual/regular viewer groups have platform-defined thresholds. |
| Engagement counting | https://support.google.com/youtube/answer/2991785 | Data quality | Views and engagement can be delayed or adjusted while YouTube validates legitimate activity. |

Review rule: historic Shorts view counts and post-31-March-2025 views are not automatically comparable. Retain Engaged views where meaningful.

### LinkedIn

| Source | Canonical URL | Use | Candidate review claims |
|---|---|---|---|
| LinkedIn Page analytics | https://www.linkedin.com/help/linkedin/answer/a547077 | Organic reporting structure | Page analytics separates Content, Followers, Visitors, Search appearances, Competitors, Employer brand and Newsletter analytics. |
| Page content analytics | https://www.linkedin.com/help/linkedin/answer/a564051 | Organic/boosted distinction | Page analytics and Campaign Manager can differ; organic, boosted and paid reporting must not be merged blindly. |
| Campaign Manager performance metrics | https://www.linkedin.com/help/lms/answer/a445476 | Paid metric definitions | Metrics depend on objective/format; methodology changes affect comparability; reach/frequency can be delayed and modelled. |
| Video metrics | https://www.linkedin.com/help/linkedin/answer/a426666 | Video definitions | A LinkedIn video view is at least two continuous seconds with at least 50% on screen; completion and watch-time metrics have dated methodology changes. |
| LinkedIn Ad Library | https://www.linkedin.com/ad-library/home | Ad transparency research | Store metadata and canonical links only; do not mirror creative. |

Review rule: LinkedIn organic Page analytics and Campaign Manager are separate truth domains. Methodology-change dates must gate comparisons.

## South African compliance and market context

| Source | Canonical URL | Use | Candidate review claims |
|---|---|---|---|
| SARS social-influencer clarification | https://www.sars.gov.za/latest-news/media-release-sars-clarifies-issues-around-social-influencers/ | Influencer commercial context | Cash, products, services and travel received for collaborations may constitute income and should not be treated as consequence-free gifting. |
| South African Government — MAC sector transformation | https://www.gov.za/Embracing-transformation-the-imperative-for-the-marketing-and-advertising-sector | Responsible/local marketing context | South African marketing should consider transformation, representation and responsible-marketing commitments. |
| POPIA / Information Regulator official guidance | https://inforegulator.org.za/popia/ | Leads, audience and personal data | Lead handling, custom audiences and client exports require lawful processing, purpose limitation and appropriate access controls. Exact operational rules need legal review before activation. |
| Consumer Protection Act resources | https://www.gov.za/documents/consumer-protection-act | Claims and promotions | Marketing claims, prices, promotions and testimonials must not be misleading. Exact claim cards require legal-review status. |

Compliance knowledge must remain guidance, not legal advice. Mark it for periodic review and professional escalation where material.

## Public-domain human marketing and psychology sources

### Ready for lawful source registration

1. **Scientific Advertising — Claude C. Hopkins (1923)**
   - Library of Congress: https://www.loc.gov/item/23009362/
   - Rights evidence: the Library of Congress states that books in the collection are public domain and free to use/reuse.
   - Format: page images / IIIF; OCR and page verification required before quoting.
   - Use: testing, specificity, samples, salesmanship-in-print, measurement.

2. **My Life in Advertising — Claude C. Hopkins (1927)**
   - Library of Congress: https://www.loc.gov/item/27024090/
   - Rights evidence: the Library of Congress states that books in the collection are public domain and free to use/reuse.
   - Format: page images / IIIF; OCR and page verification required before quoting.
   - Use: case history, offer development, distribution, advertising operations.

3. **Increasing Human Efficiency in Business — Walter Dill Scott**
   - Project Gutenberg: https://www.gutenberg.org/ebooks/1319
   - Rights evidence: Project Gutenberg marks the work public domain in the USA and provides machine-readable text.
   - Use: applied business psychology, attention, habit, incentives and human behaviour.
   - Limitation: historical psychology language and assumptions require modern review; do not convert historical assertions into current scientific proof.

### Rights rule

Register source metadata and rights evidence first. Ingest text only through the existing rights-gated pipeline. Preserve page/section references where available. Never generate missing text or fabricate page citations.

## Candidate knowledge packets for admin review

All items below should enter as `experimental`, never `verified_current` automatically.

### Metric truth

- Instagram views and accounts reached are distinct; reached is unique and estimated/in development.
- Instagram Reel watch time includes replay time; average watch time uses initial views.
- YouTube Shorts views changed on 31 March 2025; Engaged views remains a separate metric.
- TikTok destination clicks differ from all clicks.
- TikTok reach/frequency and related metrics may be estimated.
- TikTok 2-second, 6-second and completion metrics are not interchangeable.
- LinkedIn organic Page analytics and Campaign Manager can report different scopes.
- LinkedIn video view and completion methodology changed over time; comparison gates are required.

### Creative workflow

- Use retention curves, dips and spikes to diagnose candidate improvements, not to claim causation.
- Treat official Creative Center/Ad Library examples as research references and hypotheses.
- Keep platform-native adaptations separate instead of copying one caption/creative unchanged.
- Separate organic creative suitability from paid-ad eligibility and policy compliance.
- Attach objective, surface, audience, offer, hook, proof, CTA and measurement plan to social recommendations.

### Reporting language

- Use “submitted lead” until qualification or sale is verified.
- Use “attributed conversion” rather than “customer” or “revenue” unless downstream evidence exists.
- Mark estimated/modelled metrics visibly.
- Do not compare metrics across a platform methodology change without an explicit gate.
- Do not merge unique audience metrics from separate platforms.

## Review sequence

1. Verify each official page still resolves and capture its latest-update date.
2. Register missing sources in the Marketing Library with `official_reference` and `metadata_and_link_only` where applicable.
3. Create candidate knowledge items as `experimental` with exact source links, territory and expiry.
4. Review metric definitions first because reporting and agents depend on them.
5. Promote only narrowly verified items to `verified_current`.
6. Confirm production Assistant retrieves only promoted, non-expired items.
7. Re-verify platform facts every 90–120 days or earlier when the platform announces a change.

## Next implementation batch for Claude

- Surface `channel`, `surface_type`, `evidence_strength`, metric-definition flag, freshness and refresh queue in the Platforms admin tab.
- Add a source-review packet view that shows exact claim, exact source, limitations and affected agents before promotion.
- Seed the reviewed official metric definitions above as `experimental` through an additive idempotent migration.
- Add tests proving methodology-change dates suppress false comparisons.
- Add tests proving estimated metrics retain their estimated state.
- Register and ingest the three lawful public-domain sources only after rights metadata and source identity checks pass.
- Keep every new card/knowledge item out of production until human activation.

## Completion standard for this packet

This packet is complete as research preparation. It does not claim the AI is fully trained or that any item is production-active. The next safe step is structured ingestion, admin review, selective promotion and retrieval verification.