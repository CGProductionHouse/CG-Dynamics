# AI Workforce V2 — Launch Notes (for staff & admins)

Last updated: 2026-07-25
Status: Ready for controlled staff use.

## What staff can do now (CG Assistant)

1. Open **CG Assistant**.
2. Pick a **Mode**: *General Assistant* (as before) or one of the nine skilled
   agents (Marketing Strategist, Copywriting, Creative Director, Brand Guardian,
   Paid Ads, Content Planner, Client Report, Research Librarian, Historical
   Advertising Analyst).
3. For client-scoped agents, pick an **active client**.
4. Ask your question.

Skilled agents answer **only from approved source material** and always show
**Sources used** and **Citations**. Every skilled draft carries a **human-review
warning** — review before any client-facing use.

### Honest current behaviour (important)

Right now **no Skill Cards are approved/active yet**, so in normal (production)
mode a skilled agent will say:

> "I do not have enough approved source material to answer this as a skilled
> agent yet."

That is correct and intentional — the agent holds back rather than guessing.
Agents become useful as admins review and activate cards (below).

Admins can tick **"Admin research (see needs-review)"** to preview answers built
from candidate cards for the purpose of reviewing them — clearly non-production.

## What admins do (Marketing Library review)

Open **Marketing Library** (admin-only):

- **Skill Cards** tab — 19 candidate cards are waiting in `needs_review`
  (5 Hopkins universal, 6 agriculture industry, 4 RC Polypipe, 4 CASE
  Bloemfontein). Open a card, check its source and evidence label, and use the
  review section to approve/activate or request changes. Only **active** cards
  reach production agents.
- **Sources** tab — rights-classified sources (public-domain books, LoC
  free-to-use, agriculture bodies). Nothing is treated as trusted until reviewed.

## What is deliberately NOT live yet

- **Book full-text ingestion** — the pipeline + admin function exist, but no book
  text is ingested (no verifiably-open machine-readable public-domain edition was
  obtainable this session; see `INGESTION-STATUS.md`). Hopkins card page/chapter
  references stay `pending_source_ingestion`.
- **Historical-ad library population** (≥30 candidates) — deferred.
- Deeper Marketing Library tabs (Documents/Chunks/Coverage dashboards) — the data
  model and docs exist; richer UI is a follow-up.

## Safety posture (unchanged)

- Financial/PII restrictions still apply to all modes.
- Client-specific knowledge is isolated to the exact active client.
- AI-generated text is never an authoritative source.
- Marketing Library + client intelligence are admin/staff-gated; no client access.
