# Platform Expert Data Model

Status: Implementation specification
Last updated: 2026-07-20

## Core entities

### platform_experts

- id
- platform_key
- name
- purpose
- active
- default_review_days
- last_full_review_at
- next_review_at
- current_version
- owner

### platform_surfaces

Examples: Instagram Feed, Reels, Stories, Search, Profile; Facebook Feed, Groups, Events, Reels; YouTube Browse, Search, Shorts.

Fields:

- id
- platform_expert_id
- surface_key
- name
- user_intent
- supported_objectives
- eligibility_notes
- active

### platform_knowledge_items

- id
- platform_expert_id
- surface_id nullable
- title
- principle
- application
- limitations
- misuse_warning
- knowledge_state
- confidence
- territory
- researched_at
- last_verified_at
- review_interval_days
- expires_at
- stale_action
- policy_sensitive
- current_version
- supersedes_id nullable

### platform_sources

- id
- platform_expert_id
- publisher
- source_type
- title
- url
- territory
- published_at nullable
- accessed_at
- official
- source_tier
- archived_snapshot_ref nullable
- notes

### platform_knowledge_sources

Join table linking knowledge items to sources with:

- support_type: supports, limits, contradicts, historical;
- quoted_excerpt nullable;
- interpretation;
- reviewer.

### platform_formats

- platform_expert_id
- surface_id
- format_key
- name
- technical_spec_json
- safe_zone_json
- duration_or_length_rules_json
- accessibility_requirements
- current_as_of
- expires_at

### platform_skill_cards

- id
- platform_expert_id
- title
- trigger_conditions
- required_inputs
- decision_steps
- output_contract
- metrics
- misuse_warnings
- status
- version
- last_verified_at
- expires_at

### platform_experiments

- id
- client_id
- platform_expert_id
- surface_id
- hypothesis
- variable_changed
- constants
- objective
- primary_metric
- guardrail_metrics
- start_at
- end_at
- sample_notes
- result
- conclusion
- confidence
- reusable_scope

### platform_change_log

- platform_expert_id
- detected_at
- effective_at nullable
- change_type
- description
- affected_surfaces
- source_id
- action_taken
- knowledge_items_updated

## Retrieval rules

The agent must retrieve only:

- active knowledge;
- territory-compatible knowledge;
- surface-compatible knowledge;
- knowledge not expired, unless explicitly shown as historical;
- the latest non-superseded version.

When current knowledge is unavailable, the agent must say so, request refresh or use an explicitly labelled experiment. It may not silently substitute stale advice.

## Learning boundaries

- client result may update Client Brain immediately after review;
- repeated cross-client result may create an observed platform hypothesis;
- only authoritative platform evidence or robust repeated first-party evidence may activate a platform-wide rule;
- platform learning may never become a Universal Brain rule without separate durable evidence.

## Coding-agent acceptance tests

- expired knowledge is excluded from ordinary generation;
- every platform recommendation returns source, confidence and last-verified metadata;
- contradictory sources can coexist;
- superseded versions remain auditable;
- account or territory limitations block invalid recommendations;
- performance results link to the exact knowledge and creative decisions used.