# CG Dynamics Master Knowledge Framework

## Purpose

CG Dynamics must not behave like a generic chatbot with access to company data. It must operate as a governed AI workforce that can explain what it knows, where that knowledge came from, how current it is, how confident it is, and when a human must decide.

This framework defines the knowledge system shared by Client Intelligence, Operations Hub and AI Workforce.

The framework is product architecture. It does not activate any knowledge, create specialist agents or replace the existing Skill Card review gate.

The runtime implementation contract for the first retrieval milestone is defined in [`docs/assistant-retrieval-contract.md`](./assistant-retrieval-contract.md).

## Core rule

Knowledge is not usable merely because it exists in the database.

A knowledge item may guide an AI response only when all applicable gates pass:

1. the source is identifiable;
2. the item has a clear knowledge layer;
3. confidence and evidence are explicit;
4. review state permits use;
5. date-sensitive knowledge is still current;
6. the requesting user and agent are allowed to access it;
7. conflicts and limitations are disclosed;
8. client-specific knowledge does not leak across clients.

When these gates do not pass, the AI must either use a safer lower layer, qualify the response, request review or escalate to a human.

## Knowledge layers

Knowledge must be stored and retrieved in layers. Higher layers add context; they do not silently overwrite lower layers.

### Layer 1 — Universal principles

Stable principles that apply across industries and platforms.

Examples:

- advertising should serve a commercial objective;
- specificity is usually more credible than unsupported superlatives;
- measurement should exist before scaling spend;
- an offer must create a reason to act.

Typical sources:

- foundational books;
- peer-reviewed research;
- established behavioural science;
- durable internal operating principles.

Universal principles must not be presented as proof of current platform mechanics.

### Layer 2 — Discipline knowledge

Knowledge tied to a professional discipline rather than one platform or client.

Initial disciplines include:

- strategy;
- copywriting;
- paid media;
- organic social media;
- photography;
- video production;
- design;
- website and conversion optimisation;
- reporting and analytics;
- sales and client service;
- operations and project delivery.

This layer translates universal principles into repeatable professional methods.

### Layer 3 — Industry knowledge

Knowledge that changes meaningfully by industry.

Examples:

- restaurants depend on location, occasions, menu appeal and repeat visits;
- professional services depend more heavily on trust, authority and lead quality;
- retail campaigns depend on stock, price, margin, urgency and fulfilment;
- hospitality depends on experience, availability, seasonality and booking friction.

Industry knowledge must remain reusable and must not name former or inactive clients.

### Layer 4 — Platform knowledge

Current rules, capabilities, formats and constraints for a named platform and surface.

Examples:

- Instagram Reels;
- Facebook Lead Ads;
- Google Business Profile posts;
- LinkedIn company-page content;
- YouTube Shorts;
- WhatsApp Business messaging.

Platform knowledge is date-sensitive by default. It must include:

- platform;
- surface;
- effective date or last verified date;
- source URL or official source identity;
- expiry or review date where appropriate;
- region or account limitations;
- whether it describes an official rule, observed behaviour or internal hypothesis.

No foundational book may be used to claim how a modern algorithm currently works.

### Layer 5 — CG operating knowledge

How CG Production House and related CG businesses actually work.

Examples:

- approval flow;
- deliverable definitions;
- naming conventions;
- task ownership;
- standard production stages;
- reporting standards;
- escalation rules;
- quality-control requirements.

This layer is internal and should be linked to active workflows rather than duplicated into vague prose wherever possible.

### Layer 6 — Client knowledge

Knowledge belonging to one active client.

Examples:

- brand voice;
- products and services;
- audiences;
- approved claims;
- prohibited wording;
- locations;
- campaign history;
- commercial priorities;
- known operational constraints.

Client knowledge must always include a client identifier and access boundary. It must never be returned in another client context.

Inactive clients must be excluded from active retrieval by default. Historical work may remain in an archive only when the product explicitly supports archival learning and access control.

### Layer 7 — Work-item context

The immediate facts of a specific task, campaign, conversation, report or deliverable.

Examples:

- the brief for this post;
- the due date for this video;
- the selected campaign objective;
- the latest client feedback;
- the approved offer for this month.

This is the most specific layer and usually has the shortest useful life.

## Source and evidence model

Every reusable item must identify its source class.

### Source classes

- `tier_1_primary` — official documentation, original research, legislation, platform documentation, direct approved client information or original source material;
- `tier_2_authoritative` — respected expert synthesis, professional standards or strong secondary research;
- `tier_3_practitioner` — credible practitioner experience that may be useful but is not independently established;
- `internal_verified` — confirmed CG process, approved client fact or measured internal result;
- `hypothesis` — plausible but unverified idea requiring testing;
- `needs_review` — incomplete, conflicting, outdated or insufficiently sourced material.

The current database vocabulary remains authoritative where it differs. Future schema work should map rather than silently introduce competing labels.

### Evidence labels

Knowledge should distinguish at least:

- documented fact;
- measured result;
- expert interpretation;
- observed pattern;
- hypothesis;
- opinion or preference.

The AI must not upgrade one label into another in its wording.

## Confidence model

Confidence describes how strongly the system may rely on an item, not how confidently the prose should sound.

### Low confidence

Use only as a qualified possibility. Never present as settled guidance. Prefer testing or human review.

### Medium confidence

Use as practical guidance with limitations. Identify material uncertainty or context dependence.

### High confidence

Use directly when the user, client, platform and date context all match. High confidence still does not override access boundaries or newer contradictory evidence.

Confidence must consider:

- source quality;
- directness of evidence;
- recency;
- consistency across sources;
- relevance to the current context;
- whether the claim has been tested internally;
- known exceptions.

## Review lifecycle

The existing Skill Card lifecycle remains the governing implementation:

- draft or `needs_review`;
- reviewed with an explicit decision and notes;
- active only after the activation gate passes;
- deprecated when superseded, unsafe or no longer useful.

Review is a substantive decision, not a button press.

A reviewer must check:

- source accuracy;
- wording accuracy;
- scope and limitations;
- duplicate or conflicting cards;
- modern applicability;
- agent instructions;
- client and industry boundaries;
- review or expiry date.

The system must retain review history rather than overwrite the reasoning behind a decision.

## Retrieval order

An AI agent should retrieve knowledge in this order:

1. establish user identity, role and permitted scope;
2. establish the task and active client, when applicable;
3. retrieve work-item context;
4. retrieve approved active client knowledge;
5. retrieve approved CG operating knowledge;
6. retrieve relevant current platform knowledge;
7. retrieve industry and discipline knowledge;
8. retrieve universal principles;
9. detect conflicts, expiry and missing evidence;
10. construct an answer with the minimum sufficient sources.

Specific knowledge should refine general knowledge. It must not secretly erase a conflict. When two active sources disagree, the AI should explain the disagreement or escalate it.

## Agent behaviour contract

Every CG AI specialist must follow the same minimum contract.

The agent must:

- use only knowledge available to its role and scope;
- distinguish fact from recommendation;
- cite or name important sources when the answer depends on them;
- disclose outdated, weak or conflicting evidence;
- refuse to invent client facts, results, policies, quotes or platform rules;
- ask for missing business-critical information when proceeding would create material risk;
- escalate legal, financial, HR, safety, contractual and reputation-sensitive decisions;
- log which approved knowledge influenced material work when usage logging is available.

The agent must not:

- treat model memory as an approved CG source;
- use inactive Skill Cards as operational instructions;
- leak one client's information into another client's work;
- describe hypotheses as proven results;
- claim a platform rule is current without a current source;
- create final client-facing claims from unapproved facts.

## Conflict resolution

When knowledge conflicts, apply the following precedence only after access and review gates pass:

1. current law, regulation or binding contractual requirement;
2. current approved client instruction for that client;
3. current official platform rule for that platform and surface;
4. current verified CG operating policy;
5. measured client or CG result that matches the context;
6. authoritative discipline or industry guidance;
7. universal principle;
8. practitioner observation;
9. hypothesis.

Precedence does not mean lower layers are deleted. The conflict and rationale should remain reviewable.

## Freshness and expiry

Knowledge is either stable or date-sensitive.

Stable knowledge still requires periodic review but normally has no short expiry.

Date-sensitive knowledge requires a last-verified date and review trigger. This includes:

- platform formats and limits;
- advertising policies;
- pricing;
- legislation and regulation;
- product specifications;
- active client offers;
- staff, roles and contact details;
- operational schedules;
- performance benchmarks.

Expired knowledge must not be silently used as current. It may be shown as historical context when clearly labelled.

## Memory boundaries

Memory must be separated into:

- durable reviewed knowledge;
- user preferences;
- active operational state;
- conversation context;
- temporary working notes.

Conversation history is not automatically durable knowledge.

A statement becomes reusable organisational knowledge only through the appropriate source, ownership and review process.

## Minimum response provenance

For material answers, the runtime should be able to retain:

- requesting user;
- agent or capability;
- active client, if any;
- retrieved Skill Card IDs;
- retrieved platform knowledge IDs;
- source identities;
- confidence and conflict flags;
- timestamp;
- whether human escalation was required.

This supports quality review without storing unnecessary private reasoning.

## Launch sequence

### Milestone 1 — Safe retrieval

Build read-only Assistant retrieval that returns only active, approved knowledge permitted by RLS.

It must:

- retrieve by task, discipline, industry, platform and agent relevance;
- return source metadata with the retrieved context;
- exclude `needs_review`, rejected, deprecated and expired items;
- log usage without logging hidden reasoning;
- produce a clear no-approved-knowledge result rather than filling gaps from ungoverned content.

The detailed runtime and implementation rules for this milestone are defined in [`docs/assistant-retrieval-contract.md`](./assistant-retrieval-contract.md).

### Milestone 2 — Admin review completion

Complete authenticated admin onboarding and live browser QA, then review the initial Scientific Advertising cards. No card should be approved merely to make retrieval return something.

### Milestone 3 — One useful specialist

Launch one narrow specialist before creating a large agent catalogue.

Recommended first specialist: Marketing Strategist or Copywriter, using only approved universal principles and clearly supplied task context.

Success means it improves one real CG workflow reliably, not that it has an impressive title.

### Milestone 4 — Industry packs

Add reusable industry knowledge for active client categories. Keep these packs client-neutral.

### Milestone 5 — Client intelligence

Add structured active-client knowledge, approval history and measured learning with strict client isolation.

### Milestone 6 — Platform experts

Populate platform surfaces from current primary documentation, add expiry review and connect only verified current items to specialists.

## Definition of done for a knowledge capability

A knowledge-backed capability is not done until:

- its permitted users are defined;
- its sources are visible;
- inactive and expired knowledge is excluded;
- client isolation is tested;
- conflicts are handled;
- no-knowledge behaviour is safe;
- usage can be audited;
- desktop and mobile workflows are usable;
- a human can review and correct the knowledge;
- the capability solves a real CG task better than the existing manual process.

## Immediate product decisions established by this framework

- Keep public signup disabled; secure staff and client onboarding is an admin-controlled function.
- Keep the Marketing Library as the governed reusable knowledge store.
- Keep Platform Experts separate from timeless marketing principles.
- Keep industry knowledge client-neutral.
- Keep client knowledge limited to active clients and isolated by client ID.
- Do not activate imported knowledge without substantive review.
- Build retrieval before building a broad catalogue of specialist agents.
- Launch one useful specialist, measure it and expand from evidence.