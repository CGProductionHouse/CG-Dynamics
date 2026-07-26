# CG Dynamics Parking Lot

Last updated: 2026-07-26
Purpose: Capture valuable ideas without derailing the current milestone.

## How to use this file

When a new idea comes up during development, place it here unless it directly belongs in the active milestone.

Each item should include:

- Date added.
- Idea.
- Division affected.
- Why it matters.
- When to revisit.
- Status.

## Status options

- Parked.
- Needs research.
- Ready for milestone planning.
- Rejected.
- Completed.

## Parking lot items

### 2026-07-26 - Client Website Intelligence and ads-to-website attribution

Division: Client Intelligence, AI Workforce
Status: Ready for milestone planning

Idea:
Add a dedicated Website area to every client dashboard. The core reporting layer should be website-platform independent and connect through Google Analytics 4, Google Search Console and the correct Google Ads account rather than building separate analytics logic for WordPress, Wix, custom Next.js and every other CMS. Optional CMS, hosting and website-management integrations can follow later.

Required direction:

- Register each active client's website/domain and connection state.
- Connect the correct GA4 property, Search Console property and Google Ads account.
- Show monthly users, new users, sessions, page views, engaged sessions, engagement rate, average engagement time, conversions, top pages, device mix, location and traffic-source breakdown.
- Show paid, organic search, social, direct, referral, email and other campaign traffic separately.
- Connect Google Ads to website outcomes using verified campaign identifiers, UTMs and conversion events.
- Show paid website visits, landing pages, engagement quality, conversions, cost per website visit and cost per verified lead/conversion where available.
- Never claim that ads caused traffic growth merely because both happened in the same month.
- Add Search Console visibility: impressions, clicks, click-through rate, average position, queries and landing pages.
- Later add website health: page speed, uptime, SSL/domain state, broken pages, mobile usability, tracking health and form-submission monitoring.
- Clients without valid connections must see Setup required or Service available, not fake zero graphs.
- AI Workforce may read only verified website facts when generating strategy and recommendations.

Why it matters:
CG manages many client websites. Connecting ads, search, website behaviour and conversions turns isolated channel reports into a credible marketing journey and makes the client dashboard more valuable.

Revisit:
After the current client-production release is stable. Build this as the next dedicated Client Intelligence integration milestone.

### 2026-07-26 - Unified Leads Hub and lead-quality reporting

Division: Client Intelligence, Operations Hub, AI Workforce
Status: Ready for milestone planning

Idea:
Create one client-isolated Leads Hub that combines lead submissions from all authorised sources instead of requiring staff to export separate platform reports into Excel or Google Sheets and send them manually.

Initial sources:

- Meta instant lead forms.
- Google Ads lead form assets.
- Website forms.
- Manual CSV/Excel imports.

Later sources:

- WhatsApp enquiries.
- Google Business Profile interactions.
- TikTok lead generation.
- LinkedIn lead forms.
- CRM integrations.

Required direction:

- One canonical lead record per client with source identity, campaign, ad/form, landing page and received date.
- Store name, phone, email, company, enquiry, consent/source details, status, notes, assignee and follow-up date where supplied.
- Support New, Contacted, Qualified, Converted, Lost and Invalid states.
- Deduplicate exact source identities and strong phone/email matches; never auto-merge uncertain people.
- Show total leads, source mix, status mix, trend, cost per submitted lead, cost per qualified lead and conversion rate only when the required spend and status data exist.
- Keep submitted leads, qualified leads, customers and revenue as separate concepts.
- Do not label leads as customers or conversions without client feedback or verified downstream data.
- Allow filtered CSV/Excel export and optional Google Sheets sync.
- Let authorised client users update lead status and notes while keeping staff-only diagnostics internal.
- Feed verified lead quality back into campaign reporting and AI recommendations without crossing client boundaries.

Why it matters:
The business needs to prove lead quality and business outcomes, not only clicks and reach. A live Leads Hub reduces manual reporting and creates a much stronger paid CG Dynamics service.

Revisit:
Plan together with Website Intelligence so the complete journey can be measured as Campaign → Click → Website visit or lead form → Lead → Qualified lead → Conversion.

### 2026-07-26 - Client dashboard service catalogue and module upsells

Division: Client Intelligence, Commercial
Status: Ready for milestone planning

Idea:
Use disconnected or unavailable client-dashboard modules as clean service-discovery opportunities rather than dead empty states. Each client should see what is active, what is being configured and which additional CG Dynamics services can be requested.

Module states:

- Active.
- Setup in progress.
- Connection required.
- Service available.
- Not included in current package.

Candidate paid modules:

- Website Analytics.
- Google Ads.
- Meta Reporting.
- Leads Hub.
- Search Performance.
- Website Health.
- Advanced Reporting.
- AI Strategy.
- Competitor Intelligence.

Required direction:

- Keep the experience useful and premium rather than aggressively sales-driven.
- Show a clear explanation of the service, its outcomes and a Request this CG Dynamics service action.
- Keep actual data hidden when the service is not active; never fill unavailable modules with fake demo values.
- Connect requests into the existing Operations Hub/client-request workflow instead of creating a separate task truth.
- Allow package and service entitlement to control client navigation and module state.

Target client-dashboard structure:

- Overview.
- Performance.
- Campaigns.
- Website.
- Leads.
- Content Calendar.
- Content Guidelines.
- Strategy.
- Services.

Why it matters:
The dashboard can become both the client's working intelligence layer and a natural expansion channel for higher-value recurring CG Dynamics services.

Revisit:
Design during the Website Intelligence and Leads Hub milestone, after the current production release is stable.

### 2026-07-23 - Unified client portal landing page and strategy journey

Division: Client Intelligence, Operations Hub, AI Workforce
Status: Completed

Delivered: Client portal home (`/client`) with strategy preview, performance/campaigns/calendar/guides cards, strategy page, forward-looking reviewed strategy. (PRs #48–#53)

### 2026-07-23 - Microsoft client package and schedule parity audit

Division: Operations Hub
Status: Ready for milestone planning

Current finding:
The current Client Schedule and client-facing Content Calendar do not reliably match the existing Microsoft Planner client schedules. Some client package counts, deliverable types, task identities and dates were imported incorrectly or incompletely during the legacy Teams shadow import. Action Sport is one confirmed example: Microsoft Planner clearly contains a `VIDEO - ACTION` item together with `F1` to `F4` and `DP1` to `DP4`, while the CG Dynamics July client calendar currently presents only four designed posters and four photos and does not reflect the video correctly. This is one faulty client among multiple suspected mismatches.

Product direction:
Treat Microsoft Planner as the transition source of truth and run a proper preview-first parity reconciliation across every active client before retiring Teams. Do not patch Action Sport alone. The import must determine the real monthly package and deliverables from source tasks, preserve exact Microsoft identities, and reconcile CG Dynamics safely without duplicating or silently deleting work.

Required behaviour:

- Audit every active client bucket in the approved monthly Client Socials plan against the corresponding CG Dynamics client package, monthly deliverables and client-facing calendar.
- Parse source task labels and readable variations consistently, including `VIDEO`, `REEL`, `DP`, `F`, numbered forms such as `DP1`, `DP 1`, `F1`, `F 1`, and client-name suffixes.
- Preserve `microsoft_plan_id`, `microsoft_bucket_id` and `microsoft_task_id` as the canonical source identity so repeat imports update the same deliverable instead of creating duplicates.
- Compare source task type, number, title, due date, completion state and client bucket with the stored CG Dynamics row.
- Distinguish true package composition from scheduled post dates. Package counts must reflect the actual source deliverables, while each task keeps its own scheduled date.
- Surface creates, updates, unchanged rows, missing-source candidates, duplicates, type conflicts, date conflicts, unmatched clients and ambiguous task labels in the preview before any write.
- Never infer a missing video, reel, poster or photo from package totals alone when the source task is available.
- Do not silently omit unsupported or unfamiliar task names. Keep them as visible review conflicts.
- Do not auto-create clients or packages from guessed names.
- Do not hard-delete existing CG work when a source task is absent. Source-removal requires a complete successful fetch and explicit approval.
- After applying the reviewed reconciliation, verify Client Schedule, client Content Calendar, Content Workflow deliverable selectors and package badges against Microsoft for every active client.
- Use Action Sport as an acceptance case: the source video plus all four `F` and four `DP` items must be represented with the correct identities and dates.
- Add additional representative acceptance clients with videos, reels, mixed packages, completed tasks, changed dates and imperfect naming.
- Produce a parity report showing source count, created, updated, unchanged, conflict, skipped and missing-source totals per client.

Why it matters:
The client calendar and downstream content workflow depend on accurate monthly deliverables. Missing videos, incorrect package counts or wrong dates make the production system untrustworthy and force staff to keep checking Teams manually, which defeats the transition to CG Dynamics.

Revisit:
Immediately after the Meta reporting-truth and three-client parity milestone. Complete this before treating the Microsoft transition sync as ready for normal operational use or retiring the Teams client schedule.

### 2026-07-23 - Full content guide workspace instead of fragmented video forms

Division: Operations Hub
Status: Completed

Delivered: FullContentGuidePage (`/admin/full-content-guide`) with client/month selection,
publication gating, client read-only view. (PR #52)

### 2026-07-23 - Forward-looking report calendar suggestions

Division: Client Intelligence
Status: Completed

Delivered: Strategy page (`/client/strategy`) and `buildClientStrategyPreview` reads all strategyData fields. Report calendar suggestions use report-month + 1 for action planning.

### 2026-07-01 - AI generated poster workflow

Division: AI Workforce, Operations Hub
Status: Parked

Idea:
Create a skilled AI poster workflow that produces first draft social posters using brand knowledge, source assets, product details and marketing principles.

Why it matters:
This can reduce repetitive graphic design production pressure and let staff act more like creative directors and quality controllers.

Revisit:
After the Marketing Library and Skill Card storage exists.

### 2026-07-01 - Brand Guardian review agent

Division: AI Workforce
Status: Parked

Idea:
Create an agent that reviews outputs for brand consistency, generic AI wording, layout issues, CTA clarity and evidence based marketing quality.

Why it matters:
This prevents AI output from becoming low quality generic content and helps staff improve faster.

Revisit:
After first AI Workforce agents can read the Marketing Library.

### 2026-07-01 - Client report as premium storefront

Division: Client Intelligence
Status: Parked

Idea:
Rebuild client reports so they feel like a premium dashboard that clearly proves value, explains results and recommends next actions.

Why it matters:
This can become a separate subscription layer and make clients feel the service is difficult to replace.

Revisit:
After the Marketing Library can support report insights.

### 2026-07-01 - Paid ads strategy agent

Division: AI Workforce, Client Intelligence
Status: Parked

Idea:
Create a specialist agent for Meta and Google campaign planning, audience logic, campaign settings, lead generation strategy and result interpretation.

Why it matters:
The business needs stronger lead generation value, not only better looking content.

Revisit:
After official platform documentation and paid ads Skill Cards exist.

### 2026-07-01 - South African market intelligence layer

Division: AI Workforce
Status: Parked

Idea:
Create a specific knowledge layer for South African audience behaviour, language, platform usage, provincial differences, buying behaviour, trust signals and cultural context.

Why it matters:
Generic American marketing advice often misses local context.

Revisit:
After the core Marketing Library structure exists.

## Future notes

Add new ideas here instead of expanding the current milestone unless the idea is directly required to complete the current milestone.

## Deferred at 2026-07-25 (carry-over blockers)

- **Microsoft live dated fetch → apply → verify** — **confirmed blocked.** Requires
  authenticated admin session or service-role key to invoke `microsoft-transition-sync`
  v12. Engine + apply paths live; only the live Graph fetch step needs a human admin.
  Microsoft Planner remains the source of truth until parity is verified.
- **Authenticated client portal visual QA** — needs a drivable browser + client login.
  335 quality gate tests verify isolation; live visual pass is the remaining check.
- Broad AI Workforce agent rollout.
- CG Hours integration.
- Timer and time tracking.
