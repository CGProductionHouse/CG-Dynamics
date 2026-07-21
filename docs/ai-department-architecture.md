# CG Dynamics AI Department Architecture

## Purpose

CG Dynamics should not become a collection of isolated chatbot personalities.

The product should operate as an AI workforce organised into departments. Each department contains narrow specialists that share the same governed knowledge, client context, campaign context, permissions, provenance and escalation rules.

A specialist changes how work is performed. It does not receive a private competing version of organisational truth.

## Core principle

One governed intelligence system, many specialist capabilities.

The shared intelligence system owns:

- identity and access;
- knowledge retrieval;
- source provenance;
- client and campaign context;
- conflict detection;
- confidence handling;
- tool permissions;
- usage logging;
- human escalation.

A specialist owns:

- a narrow professional responsibility;
- capability-specific instructions;
- a defined input contract;
- a defined output contract;
- limited tools;
- quality checks relevant to its role.

## Product structure

CG Dynamics has three primary intelligence systems:

### Client Intelligence

The governed record of an active client:

- identity;
- brand;
- audiences;
- products and services;
- approved claims and restrictions;
- contacts and locations;
- campaigns;
- approvals;
- measured performance;
- client-specific learning.

### Operational Intelligence

The governed state of work:

- tasks and work items;
- schedules;
- capacity;
- ownership;
- dependencies;
- approvals;
- hours;
- production stages;
- escalation and delivery status.

### Knowledge Intelligence

The governed reusable brain:

- universal principles;
- discipline knowledge;
- industry packs;
- platform knowledge;
- CG operating knowledge;
- review history;
- confidence and evidence;
- source provenance;
- retrieval and conflict rules.

AI Workforce is the execution layer that safely combines these three systems.

## Department model

A department is a coordinated set of specialist capabilities serving one business function.

Initial departments may include:

- Marketing Department;
- Creative Production Department;
- Client Service Department;
- Operations Department;
- Reporting and Intelligence Department;
- Website and Conversion Department.

Departments are product groupings, not separate knowledge silos.

## Recommended first department

The first department should be the Marketing Department because:

- the Marketing Library already exists;
- the first approved Skill Cards are marketing principles;
- platform knowledge has a defined home;
- campaign context has immediate value;
- real CG workflows can provide frequent feedback;
- quality can be measured against existing staff output.

Recommended initial specialists:

1. Marketing Strategist;
2. Copywriter;
3. QA Reviewer.

Do not launch Designer, Ads Specialist, Analyst and Publisher simultaneously. Prove the shared brain and handoff model first.

## Shared department context

Every specialist invocation receives the same governed context envelope, filtered for the task and role.

Recommended envelope:

```ts
interface DepartmentContextEnvelope {
  requestId: string
  user: {
    id: string
    role: string
  }
  capability: {
    department: string
    specialist: string
    action: string
  }
  scope: {
    clientId: string | null
    campaignId: string | null
    workItemId: string | null
  }
  clientContext: Record<string, unknown> | null
  campaignContext: Record<string, unknown> | null
  workItemContext: Record<string, unknown> | null
  knowledge: Array<Record<string, unknown>>
  conflicts: Array<Record<string, unknown>>
  missingRequiredFields: string[]
  accessWarnings: string[]
}
```

The envelope is assembled by shared runtime services. Specialists may not independently query unrestricted tables or construct their own hidden client context.

## Specialist contract

Every specialist must define:

- department;
- capability name;
- purpose;
- permitted users;
- required scope;
- required inputs;
- optional inputs;
- allowed knowledge layers;
- allowed tools;
- prohibited actions;
- output schema;
- quality checks;
- escalation triggers;
- usage events;
- success measures.

A specialist is not ready merely because it has a system prompt.

## Orchestration model

The first release should use explicit orchestration rather than open-ended agent autonomy.

Recommended sequence:

1. classify the requested capability;
2. authenticate and authorise;
3. resolve client, campaign and work-item scope;
4. retrieve approved context;
5. detect missing facts and conflicts;
6. select one specialist;
7. generate a structured draft;
8. run deterministic validation;
9. optionally pass the draft to a defined reviewer;
10. return the result with provenance and required human actions;
11. log the invocation and approved knowledge used.

The runtime should not allow specialists to create additional specialists dynamically or hold unrestricted conversations with one another.

## Specialist handoffs

Handoffs should be structured work transitions, not simulated office chatter.

Example Marketing Department flow:

```text
Marketing Strategist
  -> approved strategy brief
Copywriter
  -> draft copy variants
QA Reviewer
  -> issues, pass/fail, corrected recommendation
Human
  -> approve, request changes or reject
```

Each handoff should include:

- source capability;
- destination capability;
- structured artifact;
- client and campaign scope;
- version;
- unresolved questions;
- provenance IDs;
- human approval state.

A handoff must not rely only on conversation history.

## Artifact-first collaboration

Departments should collaborate through persistent artifacts.

Examples:

- strategy brief;
- campaign brief;
- copy deck;
- shot list;
- creative brief;
- report commentary;
- QA checklist;
- client update draft.

Artifacts are more reliable than letting agents remember what another agent supposedly said.

Each material artifact should support:

- ownership;
- version history;
- status;
- client and campaign link;
- source specialist;
- knowledge provenance;
- review comments;
- human approval.

## Human authority

AI Departments assist and prepare work. Human authority remains explicit.

Unless a future capability is separately approved, AI may not autonomously:

- publish content;
- spend advertising budget;
- approve claims;
- accept contracts;
- alter payroll or financial records;
- issue disciplinary decisions;
- send reputation-sensitive client communication;
- activate knowledge;
- change access permissions;
- close material work as approved.

The interface must distinguish:

- AI draft;
- AI-reviewed draft;
- human-approved artifact;
- published or executed result.

## Shared confidence and disagreement

Specialists must not manufacture consensus.

When specialists disagree:

- preserve both structured findings;
- identify the conflicting assumptions or evidence;
- apply the shared precedence rules;
- request a human decision when the conflict is material.

The QA Reviewer may reject a draft. It may not silently rewrite commercial strategy unless that correction is within its defined authority.

## Marketing Department v1

### Marketing Strategist

Purpose:

Transform a valid request, client context and campaign objective into a structured strategy brief.

Required inputs:

- active client;
- campaign or explicit one-off objective;
- audience;
- desired action;
- known offer or explicit absence of offer.

Outputs:

- objective;
- audience insight;
- message hierarchy;
- proposed angle;
- platform role;
- CTA;
- measurement recommendation;
- risks and missing information;
- knowledge provenance.

Must not:

- invent client facts;
- invent commercial results;
- claim current platform mechanics without current platform knowledge;
- approve its own strategy.

### Copywriter

Purpose:

Create channel-appropriate copy from an approved or clearly labelled draft brief.

Required inputs:

- client voice context;
- campaign or work-item brief;
- audience;
- message;
- CTA;
- platform and surface where applicable.

Outputs:

- requested copy variants;
- character or format warnings;
- claim and approval flags;
- provenance.

Must not:

- create a new offer;
- change the approved objective;
- introduce unsupported facts;
- describe a draft as client approved.

### QA Reviewer

Purpose:

Check a structured strategy or copy artifact against approved context and capability rules.

Checks:

- objective alignment;
- audience alignment;
- client voice;
- campaign consistency;
- approved and prohibited claims;
- CTA consistency;
- platform constraints where current knowledge exists;
- unsupported statements;
- expiry and date conflicts;
- missing approvals.

Outputs:

- `pass`, `pass_with_warnings` or `fail`;
- issue list;
- evidence and source references;
- recommended correction;
- required human decision.

The reviewer must fail safely when required knowledge is absent.

## Permission model

Permissions should be capability-based as well as data-based.

Examples:

- a staff member may draft copy for an assigned client but not view hidden commercial fields;
- a manager may review and approve internal artifacts but not activate Marketing Library knowledge unless separately authorised;
- an owner or admin may configure departments and approved integrations;
- a client user may eventually review only artifacts and client data explicitly exposed to them.

Database RLS remains required. Capability checks do not replace it.

## Department registry

The product should eventually maintain a governed department registry.

Each registry entry should contain:

- department key;
- display name;
- purpose;
- status;
- enabled specialists;
- allowed roles;
- required knowledge domains;
- supported artifact types;
- available tools;
- owner;
- last reviewed date;
- version.

Recommended statuses:

- `planned`;
- `internal_alpha`;
- `internal_beta`;
- `available`;
- `paused`;
- `retired`.

A department should not appear as available merely because placeholder UI exists.

## Measurement

Every specialist and department must be measured against real work.

Useful measures:

- acceptance rate without material edits;
- average human correction size;
- unsupported-claim rate;
- client-context error rate;
- campaign-consistency failure rate;
- time saved;
- repeated retrieval failures;
- escalation rate;
- staff reuse;
- client approval outcome where measurable.

High output volume is not evidence of quality.

## Failure modes to prevent

- isolated specialists receiving different client truth;
- large prompts that dump every document into every request;
- agents using conversation history as approval;
- role-play discussions without persistent artifacts;
- a reviewer approving unsupported claims because the prose sounds good;
- autonomous loops that consume providers without useful work;
- hidden cross-client retrieval;
- platform advice based on stale model memory;
- creating many impressive agent names before one workflow works reliably.

## Build sequence

### Phase 1 — Shared runtime

- safe Assistant retrieval;
- context envelope;
- provenance;
- no-approved-knowledge handling;
- conflict and missing-field output.

### Phase 2 — Marketing Strategist

- one narrow structured capability;
- internal staff only;
- no autonomous actions;
- real workflow evaluation.

### Phase 3 — Copywriter

- consume a strategy or work-item brief;
- return structured variants;
- preserve campaign and client constraints.

### Phase 4 — QA Reviewer

- deterministic and model-assisted checks;
- structured pass or fail;
- human approval remains required.

### Phase 5 — Department workspace

- artifact history;
- handoffs;
- approvals;
- measured outcomes;
- clear visibility into which intelligence was used.

### Phase 6 — Additional departments

Expand only after the shared architecture is reliable and the first department demonstrates measurable value.

## Definition of done

An AI Department is not complete until:

- all specialists use the same governed context services;
- specialist permissions are explicit;
- inputs and outputs are structured;
- handoffs use persistent artifacts;
- client and campaign scope is preserved;
- provenance is visible;
- conflicts and missing knowledge are surfaced;
- human approval boundaries are enforced;
- quality is measured on real work;
- the department is more useful than opening a generic chatbot.
