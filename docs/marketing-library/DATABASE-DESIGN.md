# Marketing Library Database Design

Status: draft storage design  
Scope: isolated AI Workforce tables only

## Purpose

This design creates the first storage foundation for the AI Workforce Marketing Library and Skill Card system.

It does not wire anything into the app UI, routing, CG Hub, planner, task system, client dashboard or CG Hours.

## Tables

### `marketing_library_sources`

Stores source records used by Skill Cards.

Accepted source categories include books, research papers, official documentation, market reports, internal campaign data, client interviews, staff observations and professional sources.

Low-trust source types such as AI-generated output or unsourced blogs may be recorded for review or exclusion, but they must not be treated as trusted evidence.

### `skill_cards`

Stores structured knowledge cards for future AI Workforce agents.

Each card contains the principle, summary, source type, confidence level, evidence label, application rules, examples, mistakes to avoid, relevant industries and relevant agents.

Cards remain draft or needs review until a human review process approves them.

### `skill_card_reviews`

Tracks human review events before a card becomes active.

This supports the rule that AI must retrieve and apply verified knowledge, not invent expertise.

### `skill_card_usage_logs`

Future audit trail for agent usage.

This will make it possible to see which Skill Cards influenced an AI-generated recommendation, brief, report note or creative review.

## Source Hierarchy

The storage design follows the Marketing Library source standards:

1. Tier 1 primary sources: foundational books, research, official docs, official statistics and verified data.
2. Tier 2 trusted professional sources: reputable practitioners, industry publications and transparent case studies.
3. Tier 3 internal learning: campaign observations, staff notes and repeated client feedback, clearly labelled.
4. Tier 4 low trust: AI-generated posts, unsourced blogs, engagement bait and weak claims.

AI-generated output is not a trusted source.

## Client Boundary

The default Marketing Library should stay principle, market and industry focused.

Client-specific cards are supported by `client_specific` and `active_client_id`, but should only be used later with active client records and approved client context.

This design does not create duplicate client lists.

## Future Integration Plan

The tables will later support:

- AI Workforce library screens and Skill Card CRUD.
- Source management and human review workflow.
- Specialist agents such as Copywriting, Brand Guardian, SEO, Paid Ads and Client Report agents.
- Client Intelligence recommendations and report reasoning.
- Operations Hub creative briefs and quality checks.

Future integrations must keep CG Hours and payroll data separate.
