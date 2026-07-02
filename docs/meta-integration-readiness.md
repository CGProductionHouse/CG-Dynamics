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
- clients missing Instagram
- clients missing Ad Account
- last connected time
- OAuth state SQL warning
- token encryption warning

## Product Principle

CG Dynamics must not become a routine CSV/manual upload workflow.

CSV/manual data entry is fallback/internal support only. The product direction is secure direct platform connections, automatic sync, clear data freshness, honest diagnostics, and no fake zeroes.

## Next Fable 5 Task Brief

Next focused run:

1. Implement production-ready Meta token encryption and rotate existing raw tokens.
2. Add token/permission health checks per connected asset.
3. Store last successful sync timestamps per client/platform.
4. Surface freshness and missing-permission diagnostics on Client Dashboard Editor.
5. Add scheduled sync orchestration once token encryption and permission diagnostics are stable.
