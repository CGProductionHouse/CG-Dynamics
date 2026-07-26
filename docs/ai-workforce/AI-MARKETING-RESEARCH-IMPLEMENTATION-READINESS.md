# AI Marketing Research Implementation Readiness

Last updated: 2026-07-26
Status: Implementation handoff ready

## Purpose

Provide one authoritative handoff for the next implementation agent.

The research phase has produced a broad, source-backed marketing knowledge base. The next milestone is not more uncontrolled research. It is to turn the reviewed source packs into usable, rights-aware, review-gated product capability inside CG Dynamics.

## Research completed

### Core marketing evidence and source governance

- Advertising Evidence Library
- Verified Open Source Ingestion Manifest
- Social Source Expansion Pack
- Paid Ads, Website and Leads Source Pack
- Lifecycle Messaging and CRM Source Pack
- Conversion Experimentation Source Pack
- Music Copyright Platform Rights System
- TikTok Hospitality and Entertainment Risk Playbook

### Industry libraries

- Agriculture
- Automotive, dealerships, workshops, tyres and parts
- Legal and professional services
- Building materials and home improvement
- Hospitality, restaurants, bars and events
- Property, architecture and construction services
- Healthcare, wellness and personal care
- Retail and ecommerce
- Education and training
- Financial, insurance and credit services
- Security and risk services
- Tourism, accommodation and destination businesses
- B2B manufacturing, engineering and industrial supply
- Community, sport and entertainment

### Platform and commerce layers

- Shopify Commerce Platform Source Pack
- Social-native platform source systems
- Meta, TikTok, YouTube and LinkedIn source families
- Website analytics and leads planning

### Creative and strategy specialisations

- Brand Strategy and Creative Effectiveness
- Video, Photography, Sound and Editing Craft
- Social-Native Short-Form Storytelling
- Storytelling and Scriptwriting Craft
- Hooks and Trend-Led Creative
- Creator and Influencer Partnerships
- Landing Page, Offer and Conversion Writing

## Research status meaning

The presence of a source pack does not mean every statement is approved production knowledge.

Required states:

- research_only
- needs_review
- approved
- active
- expired
- rejected
- superseded

Only approved and active knowledge may reach normal staff or client-facing AI retrieval.

## Source record requirements

Every source record should preserve:

- Source title
- Publisher
- Canonical URL or stored-file identity
- Publication or update date
- Research date
- Rights status
- Jurisdiction
- Source type
- Evidence strength
- Exact finding
- Safe candidate claim
- Prohibited overclaim
- Limitations
- Expiry or review date
- Reviewer
- Approval state

## Rights states

- public_domain_verified
- open_licence_verified
- official_public_document
- link_and_notes_only
- human_notes_only
- client_owned
- licensed_internal_use
- permission_required
- rejected_for_ingestion

Do not ingest copyrighted modern books, paid courses or protected standards without explicit rights.

## Required implementation outcomes

### 1. Research library can be navigated

Staff should be able to find research by:

- Industry
- Platform
- Marketing discipline
- Source
- Evidence strength
- Rights status
- Review state
- Freshness

### 2. Source detail is visible

The UI should show:

- What the source says
- What the AI may safely learn
- What the AI may not claim
- Limitations
- Rights status
- Review status
- Last checked date

### 3. Review workflow exists

Authorised reviewers should be able to:

- Approve
- Reject
- Request changes
- Expire
- Supersede
- Add notes

Approval must not occur automatically.

### 4. Skill Cards are generated as candidates

Candidate Skill Cards may be created from research, but should default to needs_review.

A Skill Card should preserve links to its supporting sources and limitations.

### 5. AI retrieval is review-gated

Normal production AI may retrieve only:

- approved
- active
- client-authorised
- non-expired
- rights-compliant
- audience-appropriate

research or Skill Cards.

### 6. Industry and specialist knowledge combine

A content or campaign request should combine:

- Active client facts
- Relevant industry library
- Relevant platform rules
- Relevant creative craft
- Relevant rights and compliance
- Relevant performance history

No client should be classified only from its name.

### 7. Quick-answer mode exists

Staff should be able to ask practical questions such as:

- Can this song be used on a boosted Instagram Reel?
- Why might this TikTok be restricted?
- Give me three hook routes for this one-minute venue story.
- Build a creator brief for this campaign.
- Review this landing page offer.
- What proof do we need before making this claim?

Answers must cite the internal source records and state uncertainty.

## Industry retrofit requirement

Earlier industry packs must receive the stronger marketing-activation layer introduced later.

Add to each applicable industry:

- Buyer pains
- Buying triggers
- Audience roles
- Ad angles
- Hook directions
- Proof assets
- Offers
- Lead magnets
- Video and content formats
- Landing-page structure
- Objection handling
- Retargeting stages
- Meaningful performance metrics

This requirement is also recorded in `docs/vision/PARKING-LOT.md`.

## Priority implementation sequence

### Phase A — data and governance

- Audit current AI Workforce research schema and migrations.
- Reuse existing tables and patterns where suitable.
- Add only the minimum schema required for the readiness model.
- Create source, finding, rights, review and freshness relationships.
- Preserve existing knowledge and source records.

### Phase B — staff research UI

- Improve the Source Library and Marketing Library navigation.
- Add filters and source detail.
- Add review actions.
- Surface stale and incomplete records.
- Show why content is not active.

### Phase C — Skill Card candidate workflow

- Convert selected findings into reviewable candidate Skill Cards.
- Link every card to supporting sources.
- Preserve limitations and forbidden claims.
- Never bulk activate cards.

### Phase D — assistant retrieval

- Make the CG Assistant retrieve approved knowledge by client, industry, platform and task.
- Include source citations in staff responses.
- Return “insufficient approved evidence” where appropriate.
- Keep client isolation strict.

### Phase E — practical specialist tools

Prioritise:

1. Hook and short-form story builder
2. Script and beat-sheet builder
3. Music rights checker
4. TikTok risk checker
5. Creator brief builder
6. Landing-page and offer reviewer
7. Industry campaign planner
8. Creative review agent

### Phase F — retrofit and QA

- Add the marketing activation layer to earlier industry packs.
- Run representative client scenarios without hard-coding clients.
- Test rights, review, freshness and citation failures.
- Confirm no experimental or needs_review item leaks into production.

## Product safety boundaries

- Supabase remains permanent.
- Do not introduce Convex.
- Microsoft remains one-way, upstream and read-only.
- Do not modify Planner, Outlook or Microsoft 365.
- Do not expose raw footage or internal OneDrive working folders to clients.
- Do not auto-activate knowledge.
- Do not ingest copyrighted material without rights.
- Do not infer client facts.
- Do not rename platform signals as revenue.
- Do not make legal, health, financial or regulated claims without current approved sources.

## Implementation acceptance criteria

The milestone is not complete merely because pages render or tests pass.

It is complete when an authorised staff user can:

1. Open the research library.
2. Find a source by industry or discipline.
3. Understand its finding, limitation and rights status.
4. Review a candidate knowledge item.
5. Approve or reject it.
6. Ask the assistant a practical marketing question.
7. Receive an answer grounded only in approved sources.
8. See source citations and uncertainty.
9. Confirm that client-isolated facts remain isolated.
10. Confirm that needs_review knowledge does not appear as active truth.

## Agent operating loop

Inspect
→ reproduce current behaviour
→ implement one coherent milestone
→ migrate safely
→ build and test
→ deploy
→ use the production UI
→ fix failures
→ repeat until the acceptance criteria work

Do not stop at documentation, schema creation or a green build.

## Deferred work after this implementation milestone

- Full industry marketing-activation retrofit
- Automated source-refresh checks
- Platform API ingestion beyond approved integrations
- Client-facing AI strategy modules
- Advanced creative experimentation engine
- Creator marketplace or contracting workflow
- Full Website Intelligence and Leads Hub implementation

These remain future milestones unless directly required by the core research-library implementation.
