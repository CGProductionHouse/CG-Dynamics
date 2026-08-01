# CG Dynamics Campaign Intelligence Model

## Purpose

Campaign Intelligence is the governed context layer between durable client knowledge and individual work items.

Without this layer, every post, design, advert, video and report must repeatedly reconstruct the same campaign facts. That creates inconsistency, duplicated briefing, lost approvals and avoidable hallucination risk.

Campaign Intelligence provides one approved source of truth for a defined commercial effort and allows all work items inside that campaign to inherit the same objective, audience, offer, message, constraints and measurement plan.

## Position in the knowledge hierarchy

The CG Dynamics knowledge hierarchy is:

1. universal principles;
2. discipline knowledge;
3. industry knowledge;
4. platform knowledge;
5. CG operating knowledge;
6. client knowledge;
7. campaign intelligence;
8. work-item context.

Campaign Intelligence may refine client knowledge for a specific period or initiative. It may not silently overwrite durable client truth.

Example:

- client knowledge: the approved brand voice is warm, direct and community-focused;
- campaign intelligence: the winter promotion may use stronger urgency and price-led messaging;
- work-item context: create Instagram Story 2 for the final weekend reminder.

## Campaign definition

A campaign is a bounded commercial or communication initiative with:

- one active client;
- a clear purpose;
- an owner;
- a defined status;
- a start and end period where applicable;
- one or more audiences;
- approved messaging and creative direction;
- linked deliverables or work items;
- measurable outcomes or explicit learning goals.

A campaign does not have to involve paid media. It may represent:

- a monthly organic content plan;
- a product launch;
- a seasonal promotion;
- an event;
- a lead-generation initiative;
- a recruitment drive;
- a website conversion project;
- a reputation or awareness campaign;
- an internal CG initiative.

## Required campaign context

A campaign should not become operationally active until the minimum required context is present.

### Identity

- campaign ID;
- client ID;
- campaign name;
- campaign owner;
- status;
- start date;
- end date or explicit ongoing status;
- created by and last updated by.

### Commercial purpose

- business objective;
- campaign objective;
- desired customer action;
- commercial priority;
- known margin, stock, capacity or fulfilment constraints where relevant.

### Audience

- primary audience;
- secondary audience where applicable;
- relevant location or service area;
- audience need, problem, motivation or occasion;
- exclusions or audiences that must not be targeted.

### Offer and message

- approved offer;
- approved value proposition;
- key message;
- supporting messages;
- approved claims;
- prohibited claims or wording;
- call to action;
- urgency or validity period;
- terms, conditions or disclaimers.

### Creative direction

- creative concept;
- visual direction;
- tone for this campaign;
- mandatory assets;
- prohibited imagery or treatments;
- example references;
- platform-specific adaptations where already approved.

### Distribution

- channels;
- platform surfaces;
- organic, paid or mixed distribution;
- geographic scope;
- publishing period;
- media budget where the role is allowed to see it.

### Measurement

- primary KPI;
- secondary KPIs;
- conversion definition;
- measurement source;
- baseline where available;
- reporting frequency;
- success threshold or learning question.

### Governance

- approval owner;
- approval state;
- approval history;
- linked client instruction or source;
- confidence flags;
- unresolved risks;
- last reviewed date;
- archival reason when closed.

## Campaign status model

Recommended statuses:

- `draft` — incomplete and not available for operational inheritance;
- `needs_review` — sufficiently captured but awaiting substantive approval;
- `approved` — approved for planning but not yet live;
- `active` — may be used by linked work items and AI capabilities;
- `paused` — temporarily excluded from active generation and publishing;
- `completed` — closed for execution but retained for reporting and learning;
- `cancelled` — not to be used for new work;
- `archived` — retained as historical context only.

Only `approved` and `active` campaigns may supply current operational context. A completed campaign may supply historical learning but must not be mistaken for a current offer.

## Inheritance rules

Every linked work item inherits approved campaign context by default.

Inheritance order:

1. active work-item facts;
2. approved campaign facts;
3. approved client facts;
4. approved CG operating requirements;
5. current platform knowledge;
6. industry, discipline and universal knowledge.

A work item may override a campaign field only when:

- the field is explicitly overridable;
- the override is visible;
- the person has permission;
- the reason is recorded;
- required approval is obtained.

Examples of legitimate work-item overrides:

- a shorter CTA for a specific format;
- a platform-specific aspect ratio;
- a revised due date;
- a once-off approved caption variation.

Examples that should normally require campaign-level correction:

- changing the offer;
- changing the primary audience;
- changing the campaign objective;
- introducing an unapproved claim;
- changing the measurement definition.

## AI retrieval contract

When a request is linked to a campaign, the Assistant must:

1. verify the user can access the client and campaign;
2. verify the campaign is usable for the requested purpose;
3. retrieve the current work item;
4. retrieve the approved campaign packet;
5. retrieve the active client packet;
6. detect conflicts and missing fields;
7. retrieve only the additional approved knowledge needed;
8. generate after the context packet is assembled;
9. retain provenance for the campaign and knowledge used.

The Assistant must not:

- infer a campaign from an old conversation when no campaign is selected;
- reuse a completed offer as current;
- create campaign facts merely to complete a draft;
- leak another campaign's messaging into the current campaign;
- silently resolve conflicting campaign and client instructions;
- publish or mark approved content without an authorised human action.

## Campaign context packet

The runtime should use a compact structured packet rather than dumping an entire campaign record into the model.

Recommended shape:

```ts
interface CampaignContextPacket {
  campaignId: string
  clientId: string
  name: string
  status: 'approved' | 'active'
  objective: string
  desiredAction: string | null
  audiences: string[]
  offer: string | null
  keyMessage: string | null
  supportingMessages: string[]
  approvedClaims: string[]
  prohibitedClaims: string[]
  callToAction: string | null
  terms: string[]
  creativeDirection: string | null
  channels: string[]
  platformSurfaces: string[]
  primaryKpi: string | null
  secondaryKpis: string[]
  startsAt: string | null
  endsAt: string | null
  approvalState: string
  lastReviewedAt: string | null
  sourceIds: string[]
  warnings: string[]
}
```

The database remains authoritative. The runtime packet should expose only fields needed for the current capability and role.

## Campaign conflicts

Material conflicts must block confident generation until they are resolved or clearly qualified.

Examples:

- campaign CTA differs from the approved client CTA;
- offer dates have expired;
- campaign claim conflicts with approved client restrictions;
- the campaign targets a region the client does not serve;
- two active campaign records compete for the same work item;
- budget or conversion definitions are inconsistent.

The system should return structured conflict flags rather than forcing the model to discover every conflict from prose.

## Campaign learning

Completed campaigns should produce structured learning, not vague memory.

Useful learning includes:

- objective and result;
- target audience;
- offer;
- channel and platform surface;
- creative pattern;
- measured performance;
- operational problems;
- client feedback;
- what should be repeated;
- what should be avoided;
- confidence and sample-size limitations.

Measured campaign learning must remain separate from subjective preference.

A strong result from one campaign may become:

- client-specific measured learning;
- a hypothesis for the relevant industry;
- a reusable CG operating improvement.

It must not automatically become a universal principle.

## Relationship to Operations Hub

Campaign Intelligence connects strategy to delivery.

Operations Hub should eventually use campaign context to:

- create and group work items;
- inherit client and campaign fields;
- show missing approvals;
- surface due dates and dependencies;
- prevent publishing after offer expiry;
- connect deliverables to reporting;
- preserve the approved brief through production.

The campaign record should not become a second task manager. It defines shared intent and constraints; work items define execution.

## Relationship to Client Intelligence

Client Intelligence owns durable client truth.

Campaign Intelligence owns temporary approved campaign truth.

Client Intelligence should show:

- active campaigns;
- completed campaigns;
- campaign performance;
- approval history;
- recurring lessons;
- unresolved campaign risks.

A campaign may not exist without a valid active client ID.

## First implementation scope

The first campaign implementation should remain narrow.

Build only:

- campaign identity;
- active client relationship;
- objective;
- audience;
- offer;
- key message;
- CTA;
- status;
- date range;
- approval state;
- linked work items;
- compact read-only retrieval packet.

Do not begin with:

- complex attribution modelling;
- automated budget optimisation;
- autonomous publishing;
- multi-touch customer journeys;
- unrestricted free-form campaign memory;
- AI-created approvals.

## Definition of done

Campaign Intelligence is not complete until:

- every campaign belongs to exactly one active client;
- status and approval are distinct;
- expired campaigns cannot supply current offers;
- work-item inheritance is visible;
- overrides are controlled and auditable;
- client isolation is tested;
- campaign conflicts are surfaced;
- campaign packets are role-filtered;
- completed campaigns are separated from active execution;
- learning is evidence-labelled;
- the workflow reduces repeated briefing for real CG work.
