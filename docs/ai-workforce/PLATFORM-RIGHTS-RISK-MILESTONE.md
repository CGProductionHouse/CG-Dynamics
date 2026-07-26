# Platform Rights & Risk — Implementation Milestone

Last updated: 2026-07-26
Status: Delivered as review-gated candidate knowledge + practical assistant workflow.

Turns two reviewed research packs into the first genuinely useful, cited,
rights-aware staff capability inside CG Dynamics, integrated into the existing AI
Workforce / Marketing Library / assistant system (not a new silo).

Source packs:
- `MUSIC-COPYRIGHT-PLATFORM-RIGHTS-SYSTEM.md` → MCR-01..10
- `TIKTOK-HOSPITALITY-ENTERTAINMENT-RISK-PLAYBOOK.md` → TIK-HOSP-01..08

## What now works

1. **Knowledge is in the system, not just in docs.** 18 candidate Skill Cards
   (10 Music & Copyright Rights, 8 TikTok Platform Risk) + 7 source records
   (official TikTok/Envato pages + the two CG research packs as internal sources).
2. **Every card is governed and reviewable.** Each carries: the finding
   (`principle`/`summary`), what the AI **may safely say** (`safe_claim`), what it
   **must never claim** (`prohibited_overclaim`), `jurisdiction`, a freshness
   `review_expires_at`, its `evidence_label = platform_rule`, a citation to a
   source, and `reference_state`.
3. **Review workflow.** Cards appear in the Marketing Library (admin) with a
   "Rights & governance" panel (safe-to-say / never-claim / jurisdiction /
   re-verify-by, with an overdue flag). Reviewers approve / request changes /
   reject via the existing review section. **Nothing is auto-activated** — all 18
   are `needs_review`, 0 active.
4. **Assistant quick-answers.** The Assistant has "Rights & risk quick answers"
   that route through the Brand Guardian agent (claim safety), which retrieves the
   approved rights cards and answers with citations + limitations. The prohibited
   overclaim is encoded inline in each card's `summary`, so retrieval conveys the
   boundary with **no edge-function change**.

## Honest current behaviour

Because the 18 cards are `needs_review`, a **production** rights question returns
"insufficient approved evidence" (correct — unreviewed knowledge never reaches
production). Admins can preview immediately via **Admin research** mode. The
moment a reviewer approves cards, the same quick-answers work in production for
all staff, cited and rights-aware.

## Boundaries honoured

- Unreviewed research never becomes active production knowledge automatically.
- No copyrighted full books ingested: official pages are `metadata_and_link_only`;
  the CG packs are `user_owned` / `internal_notes_only`.
- Client isolation unchanged; Microsoft untouched; Supabase-only; no Convex.
- No invented rules — every card maps to a cited official finding, and the packs
  explicitly correct myths (e.g. "one minute is not a universal mute rule").

## Migrations / tests / build

- `phase-26a` (governance fields) + `phase-26b` (sources + cards) applied to prod.
- +6 rights/risk tests (review-gating proof, governance model, no-copyright-ingest,
  UI type). Full suite **532 pass**; build clean.

## Next (documented, not done here)

- A reviewer approves the safe subset so production answers go live.
- Remaining Phase-E tools (hook/script builder, creator brief, landing-page
  reviewer, industry campaign planner) using the same card model.
- Operational per-track music-licence + TikTok-incident record stores (the packs
  define the schemas; this milestone delivers the knowledge + quick-answer layer).
