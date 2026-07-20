# Marketing Library Implementation Readiness Manifest

Last updated: 2026-07-20
Branch: feature/ai-workforce-db-design
Status: Active build manifest

## Purpose

This document tells coding agents what may be implemented now, what is structurally ready but still requires research depth, and what must not yet be represented as complete.

## Ready for implementation now

### Universal governance

- Universal Marketing Brain hierarchy
- source quality tiers
- activation rules
- confidence and verification metadata
- platform-versus-universal knowledge boundary
- active-client industry priority policy

### Domain 1 — Market and customer understanding

Ready structures:

- Business Understanding Engine
- research evidence hierarchy
- decision-role mapping
- trigger and occasion library
- current alternatives
- functional, emotional, social and identity progress
- customer-language bank
- objection library
- observation and interview discipline
- contradiction handling
- confidence calibration
- data model
- evaluation checklist

The application may implement Domain 1 records, retrieval, review states and traceability now.

### Phase 2 shared Platform Expert system

Ready structures:

- living platform knowledge model
- source and expiry handling
- surface records
- format records
- Skill Cards
- experiments
- change log
- stale-knowledge exclusion
- territory and eligibility limits
- performance-learning boundaries

### Initial Platform Experts ready for first implementation

- Instagram
- Facebook
- LinkedIn
- TikTok
- Google Business Profile
- YouTube
- WhatsApp Business

These are foundation experts. Their current mechanics must be populated from exact official source records and refreshed at runtime or through the research workflow.

## Universal domains structurally defined but not yet complete

- Domain 2: Positioning and differentiation
- Domain 3: Offer and commercial strategy
- Domain 4: Consumer psychology and behaviour
- Domain 5: Human copy and language
- Domain 6: Ideas, creativity and cultural observation
- Domain 7: Storytelling and message architecture
- Domain 8: Visual communication and art direction
- Domain 9: Trust, proof and persuasion
- Domain 10: Campaign planning and channel roles
- Domain 11: Measurement, testing and learning
- Domain 12: Ethics, legality and brand safety

Existing source notes and draft cards may support these domains, but the coding agent must not label them fully complete until each has a domain blueprint, source inventory, atomic Skill Cards, evaluation checklist and limitations.

## Minimum product implementation sequence

1. Create knowledge-source and source-link tables.
2. Create universal domains and Skill Card records.
3. Implement evidence state, confidence, verification and expiry.
4. Implement Domain 1 research records and activation workflow.
5. Implement Platform Expert, surface, format, source and change-log records.
6. Implement stale-knowledge blocking and reviewer override.
7. Implement inheritance and conflict rules.
8. Implement traceability from evidence to recommendation to execution to result.
9. Add evaluation checklist execution and pass/fail records.
10. Add research refresh queues.

## Required agent behaviour

The marketing agent must:

- retrieve knowledge by hierarchy;
- expose source, confidence and freshness for material recommendations;
- refuse to treat assumptions as facts;
- avoid stale platform mechanics;
- keep client evidence private to the correct scope;
- distinguish universal, platform, industry and client learning;
- explain why a recommendation follows from evidence;
- log the knowledge and rules used for each generated deliverable.

## Acceptance tests

- An expired Instagram rule is not used without an explicit stale override.
- A customer quote remains verbatim and separate from adapted copy.
- A client-specific objection does not automatically become an industry rule.
- A platform experiment does not overwrite a universal principle.
- A generated campaign can be traced to customer evidence, activated insights, Skill Cards and current platform rules.
- A coding agent can add further domains and platforms without schema redesign.

## Current build conclusion

The repository now contains enough architecture for coding agents to begin the foundational database and knowledge-governance implementation while research and Skill Card expansion continues in parallel.

It is not yet accurate to mark the entire Universal Marketing Brain as complete. Domain 1 and the Platform Expert foundation are the strongest implementation-ready areas.