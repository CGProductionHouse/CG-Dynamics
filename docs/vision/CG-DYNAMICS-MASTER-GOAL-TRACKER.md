# CG Dynamics Master Goal Tracker

Last updated: 2026-08-13
Status: Source of truth for long-term product direction

## Purpose

CG Dynamics is the operating system for CG Production House and, later, a sellable AI-enhanced service business platform.

The app must not become a random collection of features. It must stay focused on three separate but connected divisions:

1. Client Intelligence
2. Operations Hub
3. AI Workforce

Each division must feel like its own product area with its own goals, workflows and mental model while sharing the same underlying environment, data model and design language.

## Product definition

CG Dynamics is not just a task manager, not just a dashboard and not just an AI tool.

It is an AI-assisted business operating system where operations, client reporting and specialist knowledge agents work together.

The app should help the company:

- deliver work more efficiently;
- show clients clear value;
- build a permanent verified knowledge base;
- reduce repetitive production pressure on staff;
- let staff move from mass production into vision, quality control and creative direction;
- use AI to retrieve, reason and apply verified expertise instead of inventing generic content.

## The three divisions

### 1. Client Intelligence

Goal: create the client-facing performance and value layer.

It should include over time:

- performance dashboards;
- monthly and quarterly reports;
- campaign results;
- Meta, Google, website and SEO insights;
- lead and enquiry tracking where available;
- recommendations;
- competitor and market notes;
- growth timelines;
- client-specific insights pulled only from active clients in the system.

Rules:

- Do not hardcode old or inactive client names into the long-term knowledge base.
- Client-specific content must come from active client records, approved client notes, interviews, campaign data or current system data.
- The client dashboard should feel premium enough to send directly to a client.
- Reports must explain what happened, why it matters and what to do next.
- Automated metrics must preserve source, definition, period, API version and completeness.
- Missing, unsupported, partial or failed metrics may never be converted into numeric zero.
- Month-on-month movement may render only when both periods use compatible metric definitions and source coverage.
- Cross-platform unique audiences must not be summed when the same person may appear on more than one platform.
- Connector failure is an integration incident, not a performance result.
- AI strategy must be withheld when evidence fails the data-quality or comparability gate.
- Client Portal visibility must be explicit/evidenced; internal workflow state alone must not publish client-facing information.

### 2. Operations Hub

Goal: replace scattered internal workflow tools only where CG Dynamics is genuinely easier and better.

It should include:

- tasks and buckets;
- Work / My Day / team workflow;
- Planner-style operational views;
- CG Calendar;
- Client Schedule;
- client requests;
- WhatsApp intake/status tracking;
- morning lists;
- staff assignments;
- production pipeline;
- internal notes and handovers.

Rules:

- Operations Hub is not Client Intelligence.
- It is not payroll; CG Hours remains separate.
- The hub must reduce daily friction. If a feature is more manual than the existing real workflow, it is not good enough.
- `planner_tasks` is operational task truth; do not merge it into `monthly_deliverables`.
- completed task authority must be shared across Work, notifications and Assistant rather than reimplemented per screen.

### 3. AI Workforce

Goal: create specialist AI agents powered by a verified knowledge base.

It includes over time:

- CG Assistant;
- Marketing / Knowledge workspace;
- Skill Cards / Playbooks;
- industry libraries;
- specialist agents;
- source management;
- internal campaign learnings;
- Brand Guardian;
- creative/copy/SEO/paid-ads/reporting specialists.

Rules:

- AI is not allowed to invent expertise.
- AI must retrieve, reason and apply knowledge from approved/current Library material, active-client context and verified sources.
- Draft, stale and retired knowledge must not ground production answers.
- Generic AI wording must be flagged and rewritten.
- AI-generated work should be explainable and source-aware.
- AI may not repair missing data through assumptions.
- Strategy agents must separate observed fact, interpretation, hypothesis, action, test and confidence.
- Client-facing AI strategy requires human review.
- AI output is never automatically promoted to trusted company knowledge.

## Separation principle

The three divisions must remain visually and mentally distinct.

- Client Intelligence = client value and performance.
- Operations Hub = internal delivery.
- AI Workforce = knowledge, skills and specialist agents.

Shared components and data models are allowed. Confused menus, mixed authorities and duplicate systems are not.

## Non-negotiable operational authorities

### Client Schedule

- `monthly_deliverables` is the canonical client content schedule source of truth.
- `/admin/client-schedule` is the editing surface.
- Client-ready schedule/calendar views are projections.
- Never create a second schedule table.

### CG Calendar

CG Calendar is the operational company calendar.

It is for meetings, shoots, content runs, client events, deadlines, internal events and intentionally enabled dated Planner tasks.

It is **not** the Client Schedule and must not become the posting calendar.

Do not:

- inject `monthly_deliverables` into CG Calendar;
- merge CG Calendar and Client Schedule;
- treat missing posting items in CG Calendar as a defect;
- deduplicate Outlook/native events by title alone;
- redesign the Calendar during unrelated UX, Marketing or navigation work.

### Content

- One Content Run has one canonical Content Guideline.
- Marketing/Knowledge and Content Guidelines are related but distinct data concepts.
- Do not merge reusable marketing knowledge with operational client content documents.

### Communications and media

- WhatsApp remains the actual client communication/approval channel for now.
- CG Dynamics tracks status honestly and must not fake a send.
- OneDrive raw media remains internal and must never be exposed to clients.

## CG Hours boundary

CG Hours remains separate because it contains payroll/time and sensitive staff data.

Hard rule: do not blend payroll or confidential staff financial information into CG Dynamics.

## Marketing / Knowledge philosophy

The Marketing/Knowledge system is the source of truth for future marketing skill agents.

The goal is to master human decision making, not to copy generic AI marketing fluff.

Prioritise:

- classic advertising and copywriting sources;
- behavioural psychology and consumer research;
- official platform documentation;
- reputable South African market evidence;
- internal campaign performance data;
- client interviews and approved client insights;
- staff observations clearly labelled as internal learning.

Avoid:

- unverified SEO blogs;
- generic AI-written marketing posts;
- unsupported trend chasing;
- invented case studies;
- vague AI phrases such as elevate, unlock, revolutionise, seamless and game-changing;
- treating AI output as source material.

## Knowledge-source rule

Source material is not automatically company knowledge.

Research-pack/goldmine files are containers. Distinct cited sources inside them must retain their own provenance, rights, date, strength, limitations and review state.

Only evidence-supported findings may become review-state knowledge or Skill Cards.

No automatic approval.

## Skill Card principle

A Skill Card should state:

- the principle;
- source/provenance;
- reliability/confidence;
- safe claim and prohibited overclaim where applicable;
- jurisdiction/freshness;
- how it should be applied;
- applicable industries/clients;
- intended agents;
- mistakes it prevents;
- review/expiry state.

Production AI may use only current approved cards.

## Client-specific knowledge rule

Client-specific knowledge must not be stored as permanent hardcoded noise in master documents.

Client knowledge belongs in active client records, client-linked knowledge cards or current client context.

Inactive clients must not pollute the default active workflow.

## Platform connector principle

Every automated connector must operate like a durable data product, not a one-off API script.

It must support:

- versioned contracts;
- provenance;
- safe token handling;
- idempotent sync/re-sync;
- delayed-data refresh windows;
- permission/token health;
- deprecation monitoring;
- data-quality/comparability states;
- safe failure without destroying the last verified dataset;
- representative cross-client validation before completion is claimed.

## Development process

Every major session starts by checking:

1. `AGENTS.md`;
2. `CONTINUE-HERE.md`;
3. `docs/vision/PROJECT-CONTINUITY-HANDOFF-2026-08-13.md`;
4. this master goal tracker;
5. `docs/vision/CURRENT-MILESTONE.md`;
6. relevant open PRs/issues;
7. current `main`.

Do not create duplicate broad work when an open PR already owns the same product area.

Large architecture should be handled as one substantial coherent mission. Claude Code is preferred for that style of work; bounded isolated implementation may be delegated separately when it does not overlap.

## Anti-drift rule

When implementation becomes technical, ask:

**Does this make CG Dynamics smarter, easier to use or more valuable to clients?**

Also ask:

- Does this preserve the canonical data authority?
- Is this already solved on `main`?
- Is an open PR already solving it?
- Is this creating a duplicate system?
- Is this accidentally mixing CG Calendar and Client Schedule?
- Is this weakening client isolation or publication truth?

If the answer exposes drift, stop and reconcile before coding.

## Current build order

As of 2026-08-13:

1. Finish the existing PR #195 Marketing/Knowledge freshness contract and merge only after verification.
2. Keep #183/#184 implementation on that same coherent branch/PR rather than creating parallel Library architecture.
3. Keep PR #175 invitation work isolated until real delivery/browser acceptance is proven.
4. Treat #177 remaining work as controlled production migration/acceptance of the already-merged #189 architecture, not another Calendar rewrite.
5. Finish authenticated device/role acceptance for #180/#181/#182 without restarting the shell/IA foundation merged in #194.
6. Resume active-client research from Human Auto only when CA explicitly says `go`.
7. Expand Website Intelligence / GA4 / Search Console / Google Ads attribution and leads only after the active foundations are stable.

## Long-term outcome

CG Dynamics should get smarter with every client, campaign, task, report and reviewed lesson.

The moat is not only code. It is the structured knowledge, applied workflow, trustworthy data and accumulated marketing intelligence inside the system.