# Client Intelligence — audit, architecture and roadmap

Audit of the client-facing dashboard, the V1 shipped on
`feature/client-intelligence-dashboard-v1`, and the roadmap to the full
client marketing command centre.

## A. Product audit (what exists, what was missing)

**Already strong (keep):**

- The truthful metric model (`lib/metaMetrics.ts` `METRIC_DEFINITIONS`) with
  per-metric source types, `safeForClient` and `sumAcrossPlatforms` flags.
- Null-vs-zero discipline: `sumOrNull`, `compareNullable`, `unavailableMetric`
  — missing metrics are omitted, never faked as 0.
- Meta sync (`supabase/functions/meta-sync`) redacts tokens everywhere, stores
  account totals as marked manual metrics ("Meta sync account totals") and
  post-level truth in `posts.raw` (null = Meta did not return it).
- Growth only renders when the previous month genuinely exists
  (`hasComparison`); follower count is snapshot-only, never shown as growth.
- Rules-driven recommendations/next steps grounded in real metric directions.
- The premium visual language of the report.

**Was missing / misleading (V1 addressed):**

1. **No forward-looking value.** The dashboard was 100% retrospective — no
   schedule, no shoots, no "what's happening this month". → Month-ahead module.
2. **No combined "wow" moment.** Metrics rendered as an even grid; nothing
   answered "how did all my pages do together?" → Combined hero.
3. **Combined reach is summed across platforms** in `buildMasterReport`
   despite `reach.sumAcrossPlatforms: false` (audiences overlap). The new hero
   never headlines a combined reach figure; the overview card remains and
   should be relabelled in V2 (see below).
4. **Admin diagnostics computed but never rendered** — `adminMissingMetrics`,
   `cardSources`, `toneReason`, `followerGrowthSkippedReason` existed in the
   model with no UI. → Data-health panel in Client Preview.
5. **Clients cannot read schedule data** (staff-only RLS) — no portal calendar
   was possible. → Prepared `phase-11a-client-portal-read-access.sql`.

## B. Client dashboard information architecture (target)

1. Combined executive hero — "all channels together" (safe sums only) ✅ V1
2. Performance overview cards + growth trend ✅ existing
3. Channel performance (per platform) ✅ existing
4. Content that worked (honest tone: top / learning / baseline) ✅ existing
5. **Your month ahead** — scheduled posts + shoots/events ✅ V1
6. Recommendations / CG action plan ✅ existing (rules-driven)
7. What CG needs from you (strategy `clientActionsRequired`) ✅ existing card;
   promote to its own checklist section in V2
8. Data transparency footnote (client-safe wording) — V2
9. Admin-only data health ✅ V1 (Client Preview)

## C. What V1 shipped

- `src/lib/clientPortalCalendar.ts` — client-safe month-ahead data layer over
  `monthly_deliverables` + `company_calendar_events` (shoot / content_run /
  client_event only, cancelled excluded). Read-only; presentation layer.
- `src/components/client/ClientMonthAhead.tsx` — "Your {month} plan with CG":
  content going live (type badges DP/Photo/Video/Reel + client-safe statuses)
  and shoots & events. Renders nothing when there is nothing to show, so
  client logins never see an empty promise pre-migration.
- Client `Dashboard.tsx` + `PublishedPreview.tsx` render the module (staff
  preview sees real data today).
- `CombinedHero` in `ClientReportView` — headlines views (summable) →
  interactions (summable) → strongest single-platform reach. Never sums reach.
- `AdminDataHealth` panel (Client Preview only): per-platform metric sources,
  metrics not synced, content-tone reasoning.
- `supabase/phase-11a-client-portal-read-access.sql` — PREPARED, not applied.

## D. Strategy Intelligence architecture (future AI specialists)

Layered design — each layer only consumes real data:

1. **Signals (exists):** metric directions, content tones, platform strengths
   from `reportPerformance.ts`.
2. **Rules (exists):** deterministic next-steps/recommendations from signals.
3. **Client context (partial):** package settings, strategy_data, campaign
   history in `reports`.
4. **Marketing library (placeholder):** `docs/marketing-library/` +
   `skillCards` exist as seeds. Needs a curated, sourced knowledge base —
   never fabricate citations; a recommendation may only cite a library entry
   that exists.
5. **Industry specialists (future):** per-industry prompt+knowledge bundles
   (restaurants, real estate, retail, events, automotive, professional
   services) that combine layers 1–4 via an Edge Function (server-side keys),
   returning recommendations tagged with which signals and library entries
   produced them. UI state for "specialist not yet available" — no fake AI.

## E. Roadmap

- **V1 (this branch):** month-ahead module, combined hero, data-health panel,
  client read-access migration prepared, this doc.
- **V2 — Meta accuracy & diagnostics:** relabel/fix combined reach ("combined
  reach" → per-platform or "up to X"), client-safe data footnote, sync-freshness
  stamp on the dashboard, admin sync-health page consolidating
  `adminMissingMetrics` across clients/months, apply phase-11a after review.
- **V3 — Platform connectors:** TikTok first (type already exists through the
  pipeline), then LinkedIn: extend `Platform` union + `PLATFORM_LABELS` +
  manual-metrics CHECK constraint migration; per-platform sync adapters in
  Edge Functions; no UI changes needed thanks to the PlatformView abstraction.
- **V4 — Marketing library & industry specialists:** curated library schema
  (sourced entries), specialist bundles, Edge Function orchestration, admin
  review flow before anything reaches a client.
- **V5 — Client command centre:** approvals in the portal (client approves
  content from the month-ahead list), request intake, campaign planning view,
  notification digest.
