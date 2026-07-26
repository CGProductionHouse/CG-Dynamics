# AI Workforce — Social Media Master

Last updated: 2026-07-25
Status: Foundation delivered; knowledge in review (nothing staff/agent-visible yet).

Extends the AI Workforce (`AI-WORKFORCE-MASTER-ROADMAP.md`) to make the skilled
agents genuinely platform-native for organic and paid social — source-backed,
current, South-African-aware, client-isolated and honest about uncertainty.

## Retrieval hierarchy (social)

```
Master Marketing Library → Social/Platform Knowledge → Exact Platform & Surface
  → Industry Library → Active Client Intelligence
```

Platform knowledge lives in the completed Platform Expert system
(`platform_experts` / `platform_surfaces` / `platform_knowledge_items`), separate
from Skill Cards, and is retrieved by social-aware agents alongside cards.

## What is delivered

- **Platform schema completed** (phase-25a): organic/paid distinction
  (`surface_type`, `channel`), `evidence_strength`, `is_metric_definition`, a
  `platform_knowledge_change_log` audit trail, and a
  `platform_knowledge_refresh_queue` view for re-verification. RLS admin-manage /
  staff-read; staff read only current, non-expired knowledge.
- **Official sources** (phase-25b): 14 official platform properties — Meta
  Business Help, Meta Ad Library, Instagram Help, TikTok Creative Center + Help +
  Ad Library + Support, YouTube Help (metrics) + Help Center + Creators, LinkedIn
  Marketing Help + Ad Library + Business. `official_reference` /
  `metadata_and_link_only` (cite + link; never mirrored).
- **Surfaces** (phase-25c): 25 factual surfaces across Instagram, Facebook,
  TikTok, YouTube, LinkedIn with user intent and organic/paid/shared type.
- **Knowledge** (phase-25d): 16 source-backed items — 3 **official YouTube metric
  definitions** restated with citation + platform-native creative facts. **All
  seeded `experimental`** (0 staff/agent-visible) with a change-log entry; an
  admin promotes to `verified_current` to make them production knowledge.
- **Social Media Strategist agent** (10th agent) + the seven existing agents are
  social-aware. `cg-assistant-chat` retrieves current platform knowledge for a
  chosen platform/surface/channel, cites it distinctly, and keeps organic/paid
  distinct. Currency is gated in code (service role bypasses RLS).
- **Assistant UI**: platform + surface + organic/paid selectors; renders
  "platform knowledge used" with state + freshness.
- **Historical references** (phase-25e): 3 widely-documented pre-AI campaigns as
  `needs_review` research references; interpretation clearly labelled.

## Honest current behaviour

Because every platform knowledge item is `experimental` and no Skill Card is
`active`, a production social answer will state it lacks approved evidence. That
is intentional — nothing unreviewed reaches production. Admins promote knowledge
(review gate) to switch the agents on for real work; **Admin research** mode can
preview experimental knowledge for that review.

## Freshness & review

- Every time-sensitive item carries `researched_at`, `last_verified_at`,
  `expires_at`, `knowledge_state`, `confidence`, `evidence_strength`, territory
  and limitations.
- `platform_knowledge_refresh_queue` surfaces items to re-verify (stale/retired/
  disputed/expired, or `verified_current` not re-checked in 120 days).
- `platform_knowledge_change_log` records every verification / state change.

## Guardrails honoured

No AI-generated article as source truth; no copyrighted book or restricted
campaign creative copied; no invented algorithm rule; no invented metric
definition (only official definitions restated with citation); no stale fact
presented as current; organic and paid distinct; social metrics keep their
platform definitions; client performance learning stays isolated; unreviewed
knowledge does not reach production.

## Remaining gaps (documented)

- **No knowledge promoted yet** — all 16 items await admin verification; until
  then agents return insufficient-evidence for social queries.
- **Metric-definition depth** — only 3 YouTube metrics seeded; Meta/TikTok/
  LinkedIn metric definitions need per-page capture from official docs.
- **Performance-learning loop** — controls are documented (isolation, comparable
  evidence, observation≠causation) but the automated learning pass is not built.
- **Ad-library captures** — specific competitor/creative references require
  reviewer work in the browser-gated ad libraries; not fabricated here.
- **Platforms tab UI** — new surface/knowledge columns (channel, evidence
  strength, freshness) are stored and queryable but not yet surfaced in the admin
  Platforms tab.
- **Pinterest / X** — assessed as lower priority; not built (no empty coverage).
