# Meta Integration Readiness

## Current Security Status

Meta OAuth now has server-side state handling in the Edge Functions:

- `meta-oauth-start` requires an authenticated `admin` or `team` user.
- OAuth state is generated server-side and only the SHA-256 hash is stored.
- OAuth state expires after one hour.
- `meta-oauth-callback` verifies state before exchanging the Meta code.
- Used, expired, missing or invalid state is rejected.
- State is one-time use.
- Tokens are never returned to the browser.
- Token-like values are redacted from callback logs and frontend diagnostics.
- `META_APP_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` remain Edge Function-only.
- The callback uses the configured `META_REDIRECT_URI`; there is no user-controlled redirect target.

Required prepared SQL:

- `supabase/phase-4b-meta-oauth-security.sql` creates `meta_oauth_states`.
- This SQL is prepared only and must be reviewed/applied in the Supabase SQL editor before the hardened OAuth flow works live.

## Meta Scopes

- `pages_show_list`: list Facebook Pages the connected Meta user manages.
- `pages_read_engagement`: read Page posts, engagement and follower fields for reporting.
- `instagram_basic`: discover Instagram Business accounts linked to Pages.
- `instagram_manage_insights`: read Instagram media and account insights for reports.
- `business_management`: discover Business Manager-owned Pages and ad accounts.

## Remaining Security Risks

Token encryption is still not production-ready.

Current protection:

- Meta tokens are stored only in `meta_connection_tokens`.
- RLS is enabled with no frontend policies.
- Frontend code never reads this table.
- Edge Functions access it only with the server-only service-role key.

Remaining risk:

- `encrypted_access_token` is a legacy column name; the current callback still stores the raw Meta access token there.
- This is acceptable for internal testing only, not production app review.

Required next hardening:

- Add a reviewed SQL migration using `pgcrypto` or Supabase Vault/pgsodium.
- Store ciphertext only, with encryption/decryption performed inside Edge Functions or protected database functions.
- Rotate existing raw stored tokens by forcing reconnect after encryption is live.
- Add a token storage version marker so old raw rows cannot be mistaken for encrypted rows.

## Current Asset Matching Flow

Manual one-by-one asset linking is no longer the primary workflow.

The Meta page now loads:

- all active CG clients
- available Facebook Pages
- available Instagram Business accounts
- available ad accounts
- current active client asset links

It generates a review table with:

- active CG client
- suggested Facebook Page
- suggested Instagram account
- suggested ad account
- confidence level
- match reason
- current linked status
- warning when the existing active link differs

Only active CG clients are considered. Meta assets without a matching active CG client are ignored.

## How Bulk Linking Works

Name matching normalizes both CG client names and Meta asset names:

- lowercase
- punctuation removed
- common suffixes removed, including `pty`, `ltd`, `restaurant`, `bar`, `the`, `official`
- whitespace collapsed

High confidence requires an exact normalized match, a strong contained match, or very high similarity. Medium and low confidence rows are shown for review only.

The `Link high-confidence matches` action:

- links only high-confidence suggestions
- never links inactive clients
- never overwrites a different existing active link
- uses the staff-only `meta-link-assets` Edge Function
- leaves medium/low/ambiguous matches for manual override

Manual override remains available for edge cases and asks for explicit overwrite approval when a different active link already exists.

## Connection Health

The Meta page now summarizes:

- connected / not connected
- active clients count
- clients linked to any Meta asset
- clients missing Facebook Page
- clients missing Instagram (excludes clients marked as "no Instagram account")
- clients with no Instagram account
- clients missing Ad Account
- last connected time
- OAuth state SQL warning
- token encryption warning

## Instagram Not Applicable Status

Staff can mark any client as "No Instagram account" when a business does not have one:

- Stored as `instagram_not_applicable boolean` on `meta_client_assets`.
- Prepared SQL: `supabase/phase-11b-meta-instagram-not-applicable.sql`.
- When set: the client no longer appears under "Needs Instagram" or "Missing Instagram".
- The client counts as "Linked" if a Facebook Page is also linked.
- The Instagram picker is disabled and cleared when the flag is checked.
- Available under the "No IG account" filter tab and readiness health tile.
- The client is visible under the "No Instagram account" filter tab.
- Flags are stored durably in `meta_client_assets` and included in all Edge Function payloads.

## Filters

The linking workspace now provides 9 filter tabs:

- Needs linking — any client not fully linked (missing FB or IG, excluding no-IG)
- Missing FB — clients without a Facebook Page
- Missing IG — clients without an Instagram account (excluding no-IG)
- FB only — has Facebook, missing Instagram, not marked no-IG
- IG only — has Instagram, missing Facebook
- FB + IG — both linked
- No IG account — clients intentionally marked as no-Instagram
- Already linked — has Facebook + (Instagram or no-IG)
- All active clients

## Sync Engine

Two sync modes:

### Legacy (blocking) sync

The old approach: `handleSyncLegacy` iterates months × clients sequentially in the browser, calling `meta-sync` via HTTP for each cell. The page stays blocked until all calls complete. Used as fallback when queue tables do not exist.

### Background queue sync (recommended)

Three components replace the blocking loop:

1. **`meta-sync-enqueue`** Edge Function — creates a `meta_sync_batches` parent row and `meta_sync_batch_items` child rows for each client × month combination. Returns `batchId`.

2. **`meta-sync-worker`** Edge Function — polls queued `meta_sync_batch_items` rows (status `queued`), marks them `running`, calls the Meta API directly to fetch Facebook posts and Instagram media for that client × month pair, upserts posts and mappings, records the per-client run in `meta_sync_runs`, then marks the item `completed`/`failed`/`skipped`. Processes up to 5 concurrent items per invocation.

3. **Frontend polling** — `MetaIntegrationPage.tsx` calls `meta-sync-enqueue` on sync start, then polls `meta_sync_batches` every 2.5s. Shows a progress card with a status bar (completed/total, failed count, percentage). When the batch reaches `completed` status, the page queries `meta_sync_batch_items` for final results and displays the standard result card.

Prepared SQL: `supabase/phase-12a-meta-sync-queue.sql` creates `meta_sync_batches` and `meta_sync_batch_items` with RLS. Must be reviewed and applied in the Supabase SQL editor before background queue sync works.

### Per-client sync run recording

Both paths record an entry in `meta_sync_runs` for each client × month processed.

## How Filter Details Are Stored

Filter / highlight detail values are stored as raw JSON in `meta_content_mappings.raw` under the `meta_payload` key. The frontend parses these when a user expands a post detail panel. This avoids schema changes each time Meta adds a new field.

## Sync Statuses

| Status | Meaning |
|--------|---------|
| `queued` | Waiting for worker to pick up |
| `running` | Worker is processing this item |
| `completed` | Sync succeeded |
| `failed` | Sync failed (error saved) |
| `skipped` | Not synced (future month, or no FB/IG linked) |
| `warning` | Completed but with warnings |

## Product Principle

CG Dynamics must not become a routine CSV/manual upload workflow.

CSV/manual data entry is fallback/internal support only. The product direction is secure direct platform connections, automatic sync, clear data freshness, honest diagnostics, and no fake zeroes.

## Remaining Gaps

1. **Token encryption** — Implement `pgcrypto` or Supabase Vault. Rotate existing raw tokens.
2. **Scheduled sync** — Use `meta-sync-worker` on a cron trigger (Supabase Schedule or pg_cron) rather than the frontend button. This is the natural next step.
3. **Sync freshness** — Store last-successful-sync timestamp per client/platform. Surface on Client Dashboard.
4. **Permission diagnostics** — Check each asset's token still has the required Meta scopes.
5. **Cancellation** — Allow staff to cancel a running batch (set batch status to `cancelled`, worker skips those items).
6. **Retry logic** — Exponential back-off per item after N attempts.
7. **Notifications** — Push notification or in-app alert when a background batch completes.
