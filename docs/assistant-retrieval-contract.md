# CG Dynamics Assistant Retrieval Contract

## Purpose

This contract turns the Master Knowledge Framework into a runtime design for CG Assistant and future specialist agents.

It defines what approved knowledge may enter an AI request, how that knowledge is filtered and ranked, what provenance must be returned, and how the Assistant behaves when approved knowledge is absent, expired or conflicting.

This is product architecture only. It does not activate Skill Cards, populate Platform Experts, deploy an Edge Function or change production data.

## Existing implementation boundary

The current `cg-assistant-chat` Edge Function already provides:

- authenticated server-side AI routing;
- role checks for staff access;
- restricted-data pattern handling;
- a small registry of available and planned capabilities;
- sanitized My Day context;
- best-effort audit logging;
- no direct access to Marketing Library knowledge.

The retrieval milestone must extend this implementation rather than create a second assistant runtime.

## Core retrieval rule

The Assistant may use governed organisational knowledge only when the database query and runtime checks agree that the item is usable.

A retrieved item must pass all applicable gates:

1. the requesting user is authenticated;
2. the user role is permitted to use the Assistant;
3. the requested client scope is visible to that user;
4. the knowledge item is active;
5. the item has passed its review gate;
6. the item is not deprecated, rejected or awaiting changes;
7. a linked source exists;
8. source trust is sufficient for the intended claim;
9. date-sensitive knowledge has not expired;
10. agent, discipline, industry, platform and client relevance match;
11. RLS permits the row to be read;
12. no client-specific item belongs to a different client.

The Assistant must never retrieve all rows with a service-role client and attempt to recreate RLS in prompt code.

## Runtime trust boundary

### User client

Use the authenticated user JWT for retrieval wherever the existing RLS policies can enforce the required access boundary.

This is the preferred path for:

- active shared Skill Cards visible to staff;
- current Platform Expert knowledge visible to staff;
- client-specific data already protected by client or staff RLS;
- work-item context already visible to the signed-in user.

### Server client

A server-side secret or service-role client may be used only for narrowly defined internal operations that cannot be performed under the user JWT, such as protected usage-log insertion when necessary.

A server client must not be used to broaden retrieval visibility.

### Model boundary

The AI provider receives only the final sanitized retrieval packet. It must never receive:

- Supabase access tokens;
- service-role keys;
- raw database error payloads;
- unrelated client records;
- rejected or inactive knowledge;
- full source documents when only a concise approved card is needed;
- private audit records;
- hidden system diagnostics.

## Supported retrieval modes

The first implementation should support three explicit modes.

### 1. General governed guidance

Used when the user asks for marketing, content, strategy or operational guidance without naming a client.

Permitted layers:

- approved CG operating knowledge when relevant;
- current platform knowledge;
- industry knowledge when an industry is explicitly supplied;
- discipline knowledge;
- universal principles.

Client knowledge must not be retrieved.

### 2. Client-scoped guidance

Used when an active client is selected or unambiguously resolved from a visible work item.

Permitted layers:

- current work-item context;
- approved knowledge for that exact client ID;
- approved CG operating knowledge;
- current platform knowledge;
- matching industry and discipline knowledge;
- universal principles.

The selected client ID must be explicit in the retrieval request and verified against the signed-in user's access.

### 3. Work-item assistance

Used for a specific task, campaign, report, deliverable or approval request.

The work item is the root scope. Client and platform context may be inferred only from trusted fields on that visible record.

The Assistant must not infer a client from free-text similarity when a trusted client ID is absent.

## Retrieval request contract

The frontend may send a bounded context request, but the server must normalize and verify it.

Suggested request shape:

```ts
interface KnowledgeRetrievalRequest {
  query: string
  agentKey: string
  discipline?: string | null
  industry?: string | null
  platform?: string | null
  surface?: string | null
  clientId?: string | null
  workItem?: {
    type: string
    id: string
  } | null
  maxItems?: number
}
```

Rules:

- `query` is required and length bounded;
- `agentKey` must be allow-listed;
- `maxItems` is server-capped;
- `clientId` is not trusted until access is checked;
- work-item IDs are not trusted until the row is fetched under the user's JWT;
- arbitrary table names, SQL fragments or column names are never accepted;
- the browser does not supply review state, source trust or activation flags.

## Retrieval packet contract

The retrieval layer should return structured context before any prose is generated.

Suggested response shape:

```ts
interface RetrievedKnowledgeItem {
  id: string
  kind: 'skill_card' | 'platform_knowledge' | 'cg_operating' | 'client_knowledge'
  title: string
  principle?: string | null
  summary: string
  instructions?: string | null
  knowledgeLayer: string
  confidence: 'low' | 'medium' | 'high'
  evidenceLabel: string
  source: {
    id: string
    title: string
    author?: string | null
    sourceType?: string | null
    trustTier: string
    sourceUrl?: string | null
    lastVerifiedAt?: string | null
  }
  platform?: string | null
  surface?: string | null
  industry?: string | null
  clientId?: string | null
  lastReviewedAt?: string | null
  expiresAt?: string | null
  limitations: string[]
  conflictKeys: string[]
  score: number
}

interface KnowledgeRetrievalResult {
  scope: {
    userId: string
    role: string
    agentKey: string
    clientId: string | null
    workItemType: string | null
    workItemId: string | null
  }
  items: RetrievedKnowledgeItem[]
  status: 'grounded' | 'partially_grounded' | 'no_approved_knowledge' | 'conflict_requires_review'
  warnings: string[]
  auditId?: string | null
}
```

The AI prompt should consume this packet rather than raw table rows.

## Eligibility rules by knowledge type

### Skill Cards

A Skill Card is eligible only when:

- status is `active`;
- the database activation gate has already passed;
- a source is linked;
- the source trust tier permits use;
- `last_reviewed` exists;
- the card is relevant to the active agent or is intentionally shared;
- industry filters match or are empty;
- the card is not client-specific unless the schema later supports an explicit client boundary.

The first retrieval release must exclude all five current Scientific Advertising cards because they remain `needs_review`.

### Platform knowledge

A Platform Expert item is eligible only when:

- the platform and surface match the request;
- the item is active/current under the existing schema;
- the item is not expired;
- the source is current enough for the claim;
- region or account limitations do not make it inapplicable;
- official rule, observed behaviour and internal hypothesis remain distinguishable.

An empty Platform Expert shell is not knowledge and contributes no prompt context.

### Client knowledge

Client knowledge is eligible only when:

- an active client ID is established;
- the signed-in user is allowed to see that client;
- the item belongs to that exact client ID;
- the client itself remains active;
- the item is approved/current under its governing lifecycle;
- approved claims and prohibited wording are treated as constraints, not optional suggestions.

No client knowledge should enter Milestone 1 unless an existing reviewed client-knowledge store already satisfies these rules.

### Work-item context

Work-item context is eligible only when fetched from a known allow-listed source and visible under the signed-in user's access.

The first implementation should use concise allow-listed fields rather than sending entire records.

## Query strategy

Milestone 1 should favour deterministic filtered retrieval over embeddings.

Recommended order:

1. normalize the query and context;
2. verify user and optional client/work item;
3. fetch eligible rows using explicit filters and RLS;
4. apply deterministic relevance scoring;
5. detect duplicates, expiry and conflicts;
6. return a small bounded packet;
7. build the model prompt from the packet;
8. log the IDs and outcome.

Embeddings may be added later when the active library is large enough to justify them. They must not become a shortcut around status, RLS or expiry filters.

## Deterministic relevance scoring

The exact numeric implementation may change, but the ranking intent should remain stable.

Suggested positive signals:

- exact agent relevance;
- exact client match;
- exact platform and surface match;
- exact discipline match;
- exact industry match;
- title or principle keyword match;
- high confidence;
- stronger source trust;
- recent review;
- measured internal result matching the context.

Suggested penalties:

- low confidence;
- weak practitioner evidence;
- broad generic relevance;
- nearing expiry;
- known limitations that materially reduce fit;
- duplicate principles;
- unresolved conflict.

Hard exclusion must happen before scoring. A high relevance score can never rescue an inactive or unauthorized item.

## Retrieval limits

The first release should keep context intentionally small.

Recommended defaults:

- maximum 6 reusable knowledge items;
- maximum 3 items from one source unless explicitly necessary;
- maximum 2 platform items for one surface;
- concise summaries rather than full source text;
- no more than one directly duplicative principle;
- server-side character cap for the final knowledge packet.

The goal is minimum sufficient evidence, not maximum prompt volume.

## Conflict handling

Before model generation, detect meaningful disagreement between eligible items.

A conflict exists when two active items recommend materially incompatible actions for the same scope.

Conflict precedence follows the Master Knowledge Framework:

1. binding law or contract;
2. current approved client instruction;
3. current official platform rule;
4. current verified CG operating policy;
5. matching measured result;
6. authoritative discipline or industry guidance;
7. universal principle;
8. practitioner observation;
9. hypothesis.

Runtime behaviour:

- benign nuance: include both with limitations;
- resolvable precedence: use the higher item and disclose the lower conflict when material;
- unresolved material conflict: set `conflict_requires_review` and avoid a final operational instruction;
- never silently merge contradictory claims into false certainty.

## No-approved-knowledge behaviour

`no_approved_knowledge` is a valid successful retrieval result.

The Assistant must then:

- state that no approved CG knowledge matched the request;
- distinguish general model assistance from governed CG guidance;
- avoid pretending the Marketing Library supported the answer;
- ask for missing task context when that would solve the gap;
- suggest human review or source import when the gap is organisational;
- never retrieve `needs_review` content to make the response appear more useful.

For Milestone 1, because no Skill Cards are active and Platform Experts are empty, most marketing-library requests should correctly return `no_approved_knowledge` until review is completed.

## Prompt construction contract

The model system/developer context should contain explicit sections:

1. role and access scope;
2. task and selected client/work item;
3. governed knowledge packet;
4. conflicts, limitations and expiry warnings;
5. response requirements;
6. prohibited behaviour.

The prompt must tell the model:

- governed items may be used only within their stated scope;
- confidence labels control wording;
- low-confidence items require qualification;
- source names must remain attached to material claims;
- the model must not invent missing client facts or platform rules;
- model memory is not an approved CG source;
- hidden chain of thought must not be logged or requested.

## User-visible provenance

The first UI does not need academic citation formatting, but material governed answers should show a compact source area.

Recommended display:

- `Based on 3 approved knowledge items`;
- source titles and trust labels;
- last reviewed or last verified date for date-sensitive items;
- a warning badge for low confidence, expiry risk or conflict;
- a clear `No approved CG knowledge used` state.

Do not expose internal database IDs in normal user-facing prose.

Admins may open a diagnostic panel showing IDs and retrieval scoring.

## Usage logging

Log retrieval provenance without storing hidden reasoning.

Minimum fields:

- requesting user ID;
- agent key;
- client ID when applicable;
- work-item type and ID when applicable;
- normalized prompt category, not necessarily full sensitive prompt text;
- retrieved Skill Card IDs;
- retrieved Platform Expert item IDs;
- source IDs;
- retrieval status;
- confidence/conflict flags;
- provider/model used;
- timestamp;
- response success or failure.

Restricted or sensitive prompts should preserve the current redaction behaviour.

Logging failure should not normally block a safe response, but it must be observable in diagnostics.

## Permissions

Initial access recommendation:

- owner/admin: governed retrieval plus diagnostics;
- manager: governed retrieval without provider/security diagnostics;
- staff/team: governed retrieval for their visible scope;
- client: excluded from the first release until client-facing retrieval is separately designed and tested.

The existing role vocabulary remains authoritative.

## First specialist boundary

Milestone 1 adds governed retrieval to the existing CG Assistant.

It should not simultaneously launch a catalogue of named agents.

After retrieval and review are proven, the first specialist should be narrow. Recommended first candidate:

- Marketing Strategist for internal staff;
- read-only knowledge use;
- no publishing, campaign mutation or client messaging actions;
- explicit selected client when client context is used;
- compact source provenance;
- human approval before client-facing output is treated as final.

## Failure modes and safe response

### Database unavailable

Return a safe Assistant error stating that governed knowledge could not be checked. Do not claim that no knowledge exists.

### RLS denial

Treat as inaccessible. Do not retry with broader credentials.

### Invalid client scope

Reject the client-scoped request and return to general guidance or request a valid visible client.

### Expired platform knowledge

Exclude it from current guidance. It may appear only in an explicitly historical answer.

### Model provider failure

Preserve the current provider fallback behaviour. The retrieval packet may be logged as unused when generation fails.

### Usage logging failure

Return the answer when retrieval and generation were safe, while recording a diagnostic warning where possible.

### Prompt injection inside stored content

Stored knowledge is data, not instruction hierarchy. Ignore any content that attempts to override system rules, request secrets, broaden access or disable citations.

## Implementation slices

### Slice A — Pure retrieval policy

- define TypeScript request and result types;
- implement eligibility and deterministic scoring as pure functions;
- add tests for status, expiry, role, agent, industry, platform and client filters;
- add no-knowledge and conflict tests.

### Slice B — RLS-backed database adapter

- retrieve active approved Skill Cards with linked source metadata;
- retrieve current non-expired Platform Expert items;
- keep all queries under the user JWT;
- cap rows and fields;
- return normalized packets.

### Slice C — Assistant integration

- extend `cg-assistant-chat` rather than creating another chat function;
- add a `knowledge` capability to the existing tool registry;
- construct the governed prompt section;
- preserve restricted-data filtering and My Day behaviour;
- add compact source provenance to the response payload;
- log retrieval usage.

### Slice D — Admin diagnostics

- show retrieval status and source count;
- show exact item IDs only to owner/admin;
- show excluded reason counts without exposing inaccessible rows;
- never show service-role secrets or raw tokens.

### Slice E — Production verification

- verify unauthenticated access is rejected;
- verify owner/admin, manager and staff behaviour;
- verify client role is excluded;
- verify `needs_review` cards never appear;
- verify empty Platform Experts contribute nothing;
- verify no-approved-knowledge is explicit;
- verify restricted prompts remain redacted;
- verify mobile source display;
- verify console and network behaviour.

## Tests required before merge

At minimum:

- inactive Skill Card excluded;
- `needs_review` Skill Card excluded;
- active card without valid source excluded;
- expired platform item excluded;
- platform/surface mismatch excluded;
- agent relevance match ranked higher;
- industry mismatch excluded where restriction is explicit;
- unauthorized client scope rejected;
- another client's knowledge never returned;
- no-approved-knowledge result works;
- material conflict produces conflict state;
- low confidence produces qualification flag;
- retrieval packet is bounded;
- service-role key never reaches browser bundle or model prompt;
- existing My Day response remains unchanged when no knowledge retrieval is requested;
- restricted-data handling remains unchanged.

## Definition of done for Milestone 1

Safe Assistant retrieval is complete only when:

- the existing Assistant retrieves through RLS under the signed-in user;
- only active approved knowledge can enter the model prompt;
- expired Platform Expert items are excluded;
- client scope is explicit and tested;
- the five current `needs_review` cards are proven absent from retrieval;
- the empty platform shells are proven absent from retrieval context;
- no-approved-knowledge is visible and useful;
- source provenance is returned to the UI;
- usage is auditable without hidden reasoning;
- owner/admin diagnostics exist;
- staff mobile and desktop flows are usable;
- production browser verification passes with authenticated test roles;
- no autonomous write action is introduced.

## Immediate decisions established by this contract

- Extend `cg-assistant-chat`; do not create a competing Assistant runtime.
- Use the signed-in user's JWT and existing RLS for knowledge retrieval.
- Use deterministic filtered retrieval before embeddings.
- Return a structured retrieval packet before model generation.
- Treat `no_approved_knowledge` as a correct result.
- Keep client users out of the first retrieval release.
- Keep Milestone 1 read-only.
- Do not approve current cards merely to make retrieval demonstrate results.
- Add one narrow specialist only after retrieval, onboarding and review are proven.