# Domain 01 Data Model

Last updated: 2026-07-20
Status: Implementation design

## Purpose

Define the minimum records CG Dynamics must eventually store so customer understanding remains traceable, reusable and separate from AI inference.

## Core entities

### Research evidence

Fields:
- id
- client_id nullable
- industry_id nullable
- source_type
- source_reference
- captured_at
- captured_by
- evidence_state: observed | reported | measured | inferred | assumed
- raw_content
- redacted_content nullable
- consent_status
- privacy_classification
- territory
- recurrence_count
- confidence_score
- confidence_reason
- contradictions
- review_at
- active

### Customer language phrase

Fields:
- id
- evidence_id
- exact_phrase
- adapted_phrase nullable
- speaker_role
- situation
- sentiment
- trigger_id nullable
- objection_id nullable
- progress_id nullable
- quote_permission
- anonymised
- tags

### Trigger

Fields:
- id
- client_id nullable
- industry_id nullable
- label
- situation
- practical_state
- emotional_state
- urgency
- location_context
- time_context
- people_involved
- current_workaround
- evidence_ids
- recurrence
- confidence
- last_verified_at
- active

### Decision role

Fields:
- id
- client_id nullable
- industry_id nullable
- role_type: initiator | buyer | payer | user | influencer | recommender | approver | blocker
- description
- segment_context
- decision_power
- concerns
- evidence_ids
- confidence

### Current alternative

Fields:
- id
- client_id nullable
- industry_id nullable
- alternative_type
- description
- why_it_is_used
- advantage
- frustration
- switching_barrier
- switching_trigger
- evidence_ids
- confidence

### Progress statement

Fields:
- id
- client_id nullable
- industry_id nullable
- progress_type: functional | emotional | social | identity
- before_state
- desired_after_state
- situation
- evidence_ids
- confidence
- misuse_warning nullable

### Objection

Fields:
- id
- client_id nullable
- industry_id nullable
- objection_type
- exact_wording nullable
- description
- decision_role_id nullable
- decision_stage
- stated_or_inferred
- proof_needed
- current_response
- evidence_ids
- recurrence
- confidence

### Insight

Fields:
- id
- scope_type: universal | platform | industry | client
- scope_id nullable
- statement
- evidence_ids
- commercial_implication
- confidence
- contradictions
- activation_status: draft | review | active | rejected | stale
- activated_by
- activated_at
- review_at

## Traceability rule

An active insight must link to evidence. A strategy or creative recommendation should link to one or more active insights. A performance result should link back to the recommendation it evaluated.

Required chain:

Evidence
→ Insight
→ Recommendation
→ Execution
→ Result
→ Learning

## Separation rules

- Raw evidence and interpretation must be stored separately.
- Exact customer wording and rewritten marketing wording must be stored separately.
- Client evidence may inform an Industry Expert only after anonymisation and multi-client validation.
- Industry assumptions may guide client research but may not overwrite client evidence.
- Platform data must carry verification and expiry metadata.
- Deleted or withdrawn private evidence must not remain accessible through derived quotes.

## Confidence guidance

Suggested scale:
- 0–20: assumption or weak lead
- 21–40: limited evidence
- 41–60: emerging pattern
- 61–80: strong repeated pattern
- 81–100: strong measured or repeatedly observed evidence

The number is never sufficient alone. A written confidence reason and contradictions are required.

## Implementation caution

This document defines knowledge objects, not final database migrations. Before implementation, map these entities against the existing client, source-note, skill-card and AI-workforce schema in the repository and avoid duplicate tables where existing structures can be extended safely.
