# Mission status — operational completion

Live status for the "CG Dynamics operational completion" mission. Updated as
work lands. Format per goal: problem found → chosen solution → verification →
blockers → state.

_Last updated: 2026-07-14_

## Goal 1 — Microsoft migration

- **Problem:** PR #25 shipped good preview/classification logic behind a
  dead-end transport: an Edge Function that always returned `setup_required`
  and could only ever work after building a full Entra OAuth + encrypted
  refresh-token platform — over-engineering for a once-off migration.
- **Decision:** **Option A — once-off, operator-assisted migration** (ratified
  in `docs/microsoft-365-import-map.md`). No Microsoft OAuth in the deployed
  app, ever, unless a recurring connection is genuinely needed later. The
  operator exports a normalized JSON snapshot via the coding-agent Microsoft
  connector; an admin uploads it at `/admin/microsoft-import`; preview +
  insert-only apply run in the browser under the admin's RLS session.
- **Done in this pass:** snapshot parser, live mapping-context and
  existing-target loaders (graceful `migrationNeeded` before phase-15a),
  natural-key slot guard for `monthly_deliverables`, insert-only apply with
  three idempotency layers, page rewrite, stub Edge Function removed, PR #25
  month-key bug fix retained.
- **Verification:** build + targeted lint pass; pure preview/parse logic
  exercised by a scripted test run (see PR #25 description for the scenario
  list). Authenticated end-to-end browser testing is **not possible from this
  environment** (no Supabase credentials here) — first live run must be
  watched by an admin.
- **Blockers (human):**
  1. Apply `supabase/phase-15a-microsoft-source-tracking.sql` in the Supabase
     SQL editor (UI blocks Apply until then).
  2. Reconnect the Microsoft 365 connector for the export session — it
     disconnected mid-mission; real plan/calendar snapshots are not yet
     exported.
- **State:** architecture resolved; import tooling ready; real data migration
  pending the two blockers above.

## Goal 2 — daily operating system (Hub, My Day, Planner, Command Centre, CG Calendar)

- Month-key dates leaking into My Day/Hub date logic fixed (part of PR #25).
- Remaining audit not started this pass.

## Goals 3–8

Not started this pass. Order of attack: client content operations (Goal 3),
client dashboard/portal (Goal 4), roles/nav/access audit (Goal 5), reports &
Meta stabilisation (Goal 6), UX/mobile pass (Goal 7), full regression +
release (Goal 8), then the OpenClaw handoff doc.

## Standing environment constraints

- No Supabase credentials and no live DB access from this working environment;
  schema state (which phase-N migrations are applied) cannot be verified from
  here. Code must degrade gracefully when a prepared migration is missing.
- Supabase and Microsoft 365 MCP connectors disconnected mid-mission; both are
  needed again for live verification and snapshot export.
- `docs/pending-supabase-migrations.md` is stale (2026-06-30): it predates
  phases 10a–15a. Treat every phase-≥10 migration as unverified until checked
  live.
