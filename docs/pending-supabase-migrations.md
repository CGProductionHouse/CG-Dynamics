# Supabase migration procedure — targeted production changes

Status: adopted 2 August 2026. Replaces the earlier `pending-supabase-migrations`
runbook (which predated the `supabase/migrations/` timestamped convention and
listed migrations that have since been applied).

## 1. Where migrations live

- **New and current migrations:** `supabase/migrations/<YYYYMMDDHHmmss>_<slug>.sql`
  (timestamped version = the file's leading 14 digits).
- **Legacy migrations (historical, do not re-run):** `supabase/phase-*.sql`
  files at the repo root of `supabase/`. These were applied via the SQL editor
  before the timestamped convention started. Their schema is already live; treat
  them as historical artifacts, not pending work.
- **Verify your understanding of a version's state before acting:** run
  `npx supabase migration list --linked` and compare `local` vs `remote` columns.

## 2. Ground rules (from `AGENTS.md`, unchanged)

- Never run a broad `db push`. It applies every unapplied local migration in
  timestamp order and can surprise production.
- Never rewrite or re-run an already-applied production migration.
- Never touch live Supabase data or run SQL against production without explicit
  approval. Review new SQL in the Supabase SQL editor first.
- Client-side code uses only `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY`. Anything privileged (service-role, Meta,
  Microsoft, provider keys) belongs in an Edge Function.
- Never expose, log, commit or return secrets.

## 3. Adding a new production migration

1. Create a timestamped file:
   `supabase/migrations/<YYYYMMDDHHmmss>_<slug>.sql`.
2. Keep it additive, idempotent where practical (`if not exists` /
   `drop policy if exists` guards), and single-purpose.
3. Review the SQL in the Supabase SQL editor before applying.
4. Apply with the SQL editor (or `supabase db push` **only** after confirming
   every migration already recorded in the ledger has a local file and the only
   pending ones are the intended new file).
5. After applying, record it in the ledger automatically (the editor applies it
   and the CLI `migration list` then shows `remote` = version). If applied
   manually without a ledger row, see section 4.
6. Update `docs/cg-dynamics-current-state.md` (canonical current state) if the
   migration changes deployed capabilities, and the relevant feature doc.

## 4. Reconcile drift (applied-but-unrecorded migrations)

When a migration was applied via the SQL editor but never recorded in
`supabase_migrations.schema_migrations`, `supabase migration list --linked`
shows `local: <version>` with `remote: ""`. The safe repair records it without
re-running any SQL:

```
npx supabase migration repair --status applied <version> --linked
```

Repeat for each version (or pass several versions in one command). Verify with
`npx supabase migration list --linked`. This mutates only the ledger table
(metadata), never schema or data. Do **not** re-run the migration SQL.

> The 11 local-only migrations from the SQL-editor era were reconciled this way
> on 2 August 2026 (`20260726075342`, `20260731090000`, `20260731100000`,
> `20260801090000`, `20260801120000`, `20260801150000`, `20260801160000`,
> `20260801170000`, `20260801180000`, `20260801190000`).
> `20260726190000_microsoft_background_safe_apply.sql` was **never applied** and
> was removed with its dead feature (see current-state technical debt).

## 5. Removing a never-applied migration

A migration file that was never applied to any environment (no ledger row, no
schema objects) is a dead artifact. It can be deleted from the repo with its
feature. Confirm absence first: `npx supabase migration list --linked` must show
`remote: ""` for it, and the schema objects it creates must not exist in
production. Never delete an applied migration's file after it is live.

## 6. Verification through the latest version

`npx supabase migration list --linked` must end with the latest expected
version. As of 2 August 2026 the ledger is consistent through
`20260802120000`. For each reconciled version, spot-check that the objects the
migration creates exist in production (e.g. via `npx supabase db query --linked`).

## 7. Rollback

There is no automatic rollback. Prefer forward additive migrations. If a
migration must be reversed, write a new timestamped migration that drops only
what it added, review it, and apply it through the same procedure.
