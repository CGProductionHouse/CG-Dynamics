# CG Dynamics — Chat Continuity

## Marketing Library milestone

- **Branch:** `feature/marketing-library-foundation-integration`
- **Latest commit:** `62e218e22d4af80125cac0ced4458dd1d7770d30`
- **Admin route:** `/admin/marketing-library` (RequireAdmin)
- **Tabs:** Skill Cards, Sources, Platforms (Platform Experts)

### Lifecycle

- Cards start `needs_review` (never `active`).
- The Review & activation panel (phase-18c) allows approve / request changes / reject / deprecate.
- Activate is offered only when: source linked, trust tier adequate, approved review exists, `last_reviewed` set.
- The DB trigger `enforce_skill_card_activation_gate` is the authoritative backstop.

### Seeded data

- Five Scientific Advertising cards exist, all `needs_review`, linked to the same `tier_1_primary` source.
- No approved reviews, no `last_reviewed` dates, no quoted chapters or page numbers.
- Cards remain `needs_review` until a human admin reviews and activates them.

### Database migrations (live)

All five Phase 18 migrations are applied to the linked Supabase project
(ehtjfntukiwbgptqgbzy):

1. `phase-18a-marketing-library-foundation.sql` — sources, cards, reviews, usage logs, RLS
2. `phase-18b-platform-expert-foundation.sql` — platform experts, surfaces, knowledge items, RLS, seed
3. `phase-18c-skill-card-review-gate.sql` — activation trigger
4. `phase-18d-initial-skill-card-batch.sql` — Scientific Advertising source + 5 cards
5. `phase-18e-marketing-library-function-hardening.sql` — search_path hardening

### Live schema state

- Seven tables exist with RLS: `marketing_library_sources`, `skill_cards`,
  `skill_card_reviews`, `skill_card_usage_logs`, `platform_experts`,
  `platform_surfaces`, `platform_knowledge_items`.
- Seven platform shells exist (Instagram, Facebook, LinkedIn, TikTok,
  Google Business Profile, YouTube, WhatsApp Business) — all empty.
- One Scientific Advertising source (`tier_1_primary`) exists.
- Five Skill Cards exist, all `needs_review`.
- No approved reviews, no `last_reviewed` dates, no active cards.
- The activation gate was tested live and rejected an invalid active card.
- Vercel production deployment is READY at `main` commit
  `2d61540bb5f6014cbb762df8a6de78be15c0b1af`.

### Deferred

- No Assistant retrieval, Industry Brain or Client Brain exists yet.
- No Domain 1 (universal principles) import beyond these five cards.
- No specialist agent (e.g. Copywriter, Strategist) is live yet.
- The next launch task is authenticated admin smoke testing.
