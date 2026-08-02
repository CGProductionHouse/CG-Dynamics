# CG Dynamics — canonical current state

Canonical snapshot of production as of **2 August 2026**. Update this file when
deployed capabilities, providers, debt or rules change. Descriptive only.

## 1. Production status

- Live URL: Vercel production, project `cg-dynamics-projects/cg-dynamics`
  (holds only `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_URL`).
- Current `main` SHA: `56d71dcc99a5e12f933bef85f99ca6978d9cfa96`.
- Supabase project `ehtjfntukiwbgptqgbzy`, CLI profile `supabase`.
- Migration ledger consistent with the repo through `20260802120000` (10
  SQL-editor-era migrations recorded as applied on 2 Aug 2026; the never-applied
  `20260726190000` was removed with its dead feature).
- AI provider health/usage fix live (`cg-assistant-chat` v1, `verify_jwt: true`).
- Tests: 938 passed; `npm run build` clean.

## 2. Capabilities live in production

- **Auth & routing** — login, logout, recovery, role guards
  (`RequireStaff` / `RequireAdmin` / `RequireManager` / `RequireClient`),
  `/dashboard` → `/client` redirect.
- **Client Intelligence** — Clients, Performance Dashboard, Reports + published
  Client Preview, Meta / Integrations, client-ready content calendar
  (`/admin/client-calendar`, read-only over `monthly_deliverables`).
- **Operations Hub** — CG Hub, Daily Tasks (Command Centre), Planner Board
  (`planner_tasks`, separate system), Client Schedule (`/admin/client-schedule`,
  operational master schedule), CG Calendar, package master.
- **Schedule domain** — `monthly_deliverables` is the single source of truth;
  Client Schedule edits, client calendar only reads.
- **Microsoft transition sync** — reconciliation engine + live apply RPCs
  (phase-21a/21b); five of five sources reconciled, 1,668 records processed,
  0 failed, 0 unsupported, 0 writes/removals applied without approval, 203
  conflicts remaining at checkpoint. Planner tasks imported: 109 (assigned 0);
  Client Schedule records: 234 (assigned 0). `User.Read.All` still required.
- **Content Guidelines** — `content_guidelines` canonical one-document-per-Run
  parent; ordered rows in `content_guide_ideas`; clients receive only the
  published projection. Published guidelines: 0 (client portal not GA-ready).
- **CG Assistant** — `cg-assistant-chat` Edge Function, role-aware guardrails,
  JWT-protected, metering enabled.
- **Live data** (verified 2 Aug 2026): 45 active clients, 4,259 planner tasks,
  3,418 monthly deliverables, 37 `skill_cards` (needs review, 0 active),
  `ai_usage_requests` 4 / `ai_usage_replays` 3.

## 3. AI providers and metering

- Canonical provider key: `GROQ_API_KEY`. Legacy alias `Grok` also exists and
  remains supported temporarily; **the next key rotation must use
  `GROQ_API_KEY` and remove `Grok`.**
- OpenRouter and Groq: healthy. Gemini and OpenAI: optional / missing in places.
- AI usage metering is live (`ai_usage_requests` / `ai_usage_replays`).
- Secrets live in Supabase Edge Function secrets and local `.env.local`, never
  in Vercel or committed files. `supabase/functions/` uses only env secrets.

## 4. Edge Functions deployed (all ACTIVE)

- `cg-assistant-chat` (v1, `verify_jwt: true`), `meeting-debrief`,
  `content-run-voice-debrief`, `suggest-content-videos`,
  `microsoft-transition-sync`, `marketing-library-ingest`.
- `marketing-library-ingest` source is in main via PR #136 (2 Aug 2026);
  phase-24a/24b SQL recorded alongside the other `phase-*.sql` files. Full-text
  ingestion remains blocked pending a lawful machine-readable edition (see
  `docs/ai-workforce/INGESTION-STATUS.md`).

## 5. Known debt / risks

- Published guidelines = 0; report coverage incomplete — client portal must stay
  out of general release until coverage is proven.
- 203 Microsoft reconciliation conflicts and 0 assigned staff remain from the
  transition checkpoint (staff identity resolution needs `User.Read.All`).
- Bundle is one large chunk (xlsx-heavy) — code-splitting outstanding.
- CG Hub daily-use pass, Performance/Reports cleanup, Meta diagnostics pass
  outstanding (see `docs/cg-dynamics-product-goals.md` /
  `docs/cg-dynamics-outstanding-audit.md`).
- Vite pinned to 7.x (vite 8/rolldown tree-shook `src/` out of the prod
  bundle). Verify built bundle contains app code before ever bumping.

## 6. Near-term roadmap

1. Resolve remaining Microsoft conflicts and approve staff assignments.
2. Content Guidelines → publish flow; link videos into guides; prove client
   report/guideline coverage before GA.
3. CG Hub daily-use pass; Planner Board recurring-task correctness.
4. Performance/Reports cleanup pass; Meta connector diagnostics.
5. Decide the fate of `fix/secure-admin-invites` /
   `security/ops-hub-production-hardening` (divergent unmerged work) and
   `docs/ai-workforce-governance` (preserved AI Workforce governance docs).

## 7. Future: WhatsApp Assistant

Not started. When built: connect CG Assistant to the client comms channel.
Requires the WhatsApp number/API credentials to be provisioned and stored as
Supabase Edge Function secrets (never client-side or in Vercel). Do not build
before core data/workflow is stable (see AI Workforce rule in `AGENTS.md`).

## 8. Future: installable / native app

Not started. Vite PWA or Tauri wrapper considered later; no mobile-specific
store accounts exist. Keep routing and RPCs client-agnostic so a shell can be
added without rework.

## 9. Rules (secrets / migrations / production verification)

- **Secrets:** only `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` on
  the client; everything privileged in Edge Function secrets. Never log/commit.
- **Migrations:** never broad `db push`; timestamped files in
  `supabase/migrations/`; review in SQL editor before applying; reconcile
  drift with `supabase migration repair --status applied <version>`; never
  re-run applied migrations. Full runbook:
  `docs/pending-supabase-migrations.md` (adopted 2 Aug 2026).
- **Source of truth:** GitHub `main`; `monthly_deliverables` for the schedule;
  no duplicate schedule tables; Planner Board stays separate.
- **Deploy:** only if the deployed bundles/functions actually changed. Doc-only
  and dead-code-only changes do not need a redeploy. Verify built bundle
  contains app code (vite 7 pin).
- **Prod verification:** never touch live data without approval; verify
  horizontal access and RLS policies before exposing new routes/RPCs.
