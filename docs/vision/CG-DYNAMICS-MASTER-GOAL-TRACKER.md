# CG Dynamics Master Goal Tracker

Last updated: 2026-07-01
Status: Source of truth for product direction

## Purpose

CG Dynamics is the operating system for CG Production House and, later, a sellable AI enhanced service business platform.

The app must not become a random collection of features. It must stay focused on three separate but connected divisions:

1. Client Intelligence
2. Operations Hub
3. AI Workforce

Each division must feel like its own product area with its own menu, goals, workflows and mental model, while still sharing the same underlying environment, data model and design language.

## Product definition

CG Dynamics is not just a task manager, not just a dashboard and not just an AI tool.

CG Dynamics is an AI assisted business operating system where operations, client reporting and specialist knowledge agents work together.

The app should help the company:

- Deliver work more efficiently.
- Show clients clear value.
- Build a permanent knowledge base.
- Reduce repetitive production pressure on staff.
- Let staff move from mass production into vision, quality control and creative direction.
- Use AI to retrieve, reason and apply verified expertise instead of inventing generic content.

## The three divisions

### 1. Client Intelligence

Goal: create the client facing performance and value layer.

This section is the storefront for clients. It must show that the work is making a difference and that the service is worth continuing.

It should include, over time:

- Performance dashboards.
- Monthly and quarterly reports.
- Campaign results.
- Meta, Google, website and SEO insights.
- Lead and enquiry tracking where available.
- Recommendations.
- Competitor and market notes.
- Growth timelines.
- Client specific insights pulled only from active clients in the system.

Rules:

- Do not hardcode old or inactive client names into the long term knowledge base.
- Client specific content must come from active client records, approved client notes, interviews, campaign data or current system data.
- The client dashboard should feel premium enough to send directly to a client.
- Reports must not be generic AI summaries. They must explain what happened, why it matters and what to do next.

### 2. Operations Hub

Goal: replace day to day scattered internal workflow tools.

This section is for staff workflow, planning and production management.

It should include, over time:

- Tasks.
- Buckets.
- Planner style views.
- Calendar and content schedule.
- Client requests.
- WhatsApp intake and approvals where technically possible.
- Morning lists.
- Staff assignments.
- Production pipeline.
- Internal notes and handovers.

Rules:

- This is not the client reporting area.
- This is not the payroll system.
- CG Hours remains a separate controlled payroll and time environment.
- CG Dynamics may integrate high level operational signals from other systems later, but must not expose payroll or confidential staff financial data.
- The hub must reduce daily friction. If the app is more manual than existing tools, the feature is not good enough.

### 3. AI Workforce

Goal: create specialist AI agents powered by a verified knowledge base.

This section contains the skill agents, marketing library, skill cards, prompt patterns, source notes and internal AI workflows.

It should include, over time:

- Marketing Library.
- Skill Cards.
- Industry libraries.
- Specialist agents.
- Source management.
- Prompt templates.
- Internal campaign learnings.
- Brand guardians.
- Creative review agents.
- Copywriting agents.
- SEO agents.
- Paid ads agents.
- Reporting agents.

Rules:

- AI is not allowed to invent expertise.
- AI must retrieve, reason and apply knowledge from the library, active client context and verified sources.
- Generic AI wording must be flagged and rewritten.
- AI generated work should be explainable. The system should be able to answer why a recommendation, headline, campaign or report was suggested.

## Separation principle

The three divisions must be visually and mentally separated.

A user should feel like they are working inside a focused product area:

- Client Intelligence is for client value and performance.
- Operations Hub is for internal delivery.
- AI Workforce is for knowledge, skills and specialist agents.

Shared components, design tokens and data models are allowed. Confused menus, mixed workflows and random cross linking are not allowed.

## CG Hours boundary

CG Hours must remain separate.

Reasons:

- It is payroll related.
- It contains sensitive staff and time data.
- It should stay stable and controlled.
- CG Dynamics is the experimental and expandable business operating environment.

Hard rule: do not blend payroll data or confidential staff financial data into CG Dynamics.

## Marketing Library philosophy

The Marketing Library is the source of truth for future skill agents.

The goal is to master human decision making, not to copy modern AI marketing fluff.

The library must prioritise:

- Classic advertising and copywriting books.
- Behavioural psychology.
- Consumer behaviour research.
- Platform documentation from official sources.
- South African market data from reputable sources.
- Internal campaign performance data.
- Client interviews and approved client insights.
- Staff observations clearly labelled as internal learning.

The library must avoid:

- Unverified SEO blogs.
- Generic AI written marketing posts.
- Trend chasing without evidence.
- Repeating vague phrases like elevate, unlock, revolutionise, seamless, game changing and similar generic wording.
- Treating AI output as source material.

## Skill Card principle

Every serious piece of knowledge should become a Skill Card.

A Skill Card should clearly state:

- What the principle is.
- Where it comes from.
- How reliable it is.
- How it should be applied.
- Which industries it applies to.
- Which agents may use it.
- What mistakes it helps prevent.

Skill Cards can be created from:

- Books.
- Research papers.
- Official platform documentation.
- Reputable market reports.
- Internal campaign data.
- Client approved notes.
- Staff experience, clearly labelled as internal learning.

## Client specific knowledge rule

Client specific knowledge must not be stored as permanent hardcoded noise in the master goal documents.

Client knowledge belongs in active client records, active client knowledge cards or client dashboard context.

If a client is inactive, their knowledge should not pollute the default active workflow unless intentionally archived and searched.

## Development process

Every major development session should start by checking:

1. This master goal tracker.
2. The current milestone file.
3. The parking lot file.
4. The relevant roadmap file.

Every coding prompt should be focused on one task.

Every new idea should be handled in one of three ways:

1. Add it to the current milestone if it directly supports the milestone.
2. Add it to the parking lot if it is valuable but distracting.
3. Reject it if it does not support the product vision.

## Anti drift rule

When implementation becomes technical, return to this question:

Does this make CG Dynamics smarter, easier to use or more valuable to clients?

If not, stop and reassess.

## Build order

Recommended order from this point:

1. Stabilise the vision and roadmap documents.
2. Build the Knowledge Engine data model.
3. Build the Marketing Library and Skill Card storage.
4. Populate the first trusted Skill Cards.
5. Build the AI Workforce interfaces.
6. Plug AI agents into Client Intelligence.
7. Plug AI agents into Operations Hub.
8. Improve the client facing dashboard until it is sendable.
9. Improve the operations workflow until staff can realistically use it daily.

## Long term outcome

CG Dynamics should become a system that gets smarter with every client, campaign, task, report and lesson learned.

The long term moat is not only the code. The moat is the structured knowledge, applied workflow and accumulated marketing intelligence inside the system.
