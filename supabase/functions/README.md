# Supabase Edge Functions — Meta sync

## Status

- **Meta OAuth connection is active.** `meta-oauth-start` generates a real Meta
  OAuth URL. `meta-oauth-callback` exchanges the code for a token and stores it
  server-side.
- **Meta connection status is active.** `meta-connection-status` returns the
  saved connection state from the server, so the page shows Connected reliably
  after refresh.
- **Sync is active for previous completed months.** `meta-sync` pulls Facebook
  Page and Instagram organic data from the Meta Graph API, creates or updates
  internal draft reports, and never publishes automatically.
- **Current month sync is not active yet.** Only `previous_completed_month`
  mode is implemented.

## Security rules

- Tokens must **only** be handled server-side in Edge Functions.
- The frontend must never receive token values.
- Encrypted token storage goes into `meta_connection_tokens`, which has RLS
  enabled with no frontend-accessible policies — only the `service_role` key
  (used by these functions) can read or write it.
- `meta_connections` contains safe metadata only (status, business info). It is
  the only Meta table the frontend reads.

## Required Supabase secrets

Before deploying, set these secrets:

```bash
supabase secrets set META_APP_ID=<your-meta-app-id>
supabase secrets set META_APP_SECRET=<your-meta-app-secret>
supabase secrets set META_REDIRECT_URI=<full-edge-function-url>
supabase secrets set APP_PUBLIC_URL=https://cg-dynamics.vercel.app
supabase secrets set OPENAI_API_KEY=<your-openai-api-key>
```

`META_REDIRECT_URI` must match exactly what is registered in the Meta App
settings, e.g.:
`https://<project>.supabase.co/functions/v1/meta-oauth-callback`

`APP_PUBLIC_URL` is where the browser is redirected after the OAuth callback
succeeds or fails.

`OPENAI_API_KEY` is used only by the `cg-assistant-chat` Edge Function. It must
not be added as a `VITE_` browser environment variable.

## Deploy

```bash
supabase functions deploy meta-oauth-start --no-verify-jwt
supabase functions deploy meta-oauth-callback --no-verify-jwt
supabase functions deploy meta-connection-status --no-verify-jwt
supabase functions deploy meta-sync --no-verify-jwt
supabase functions deploy cg-assistant-chat --no-verify-jwt
```

> `--no-verify-jwt` is used because these functions handle their own auth
> validation internally (JWT verification, role checks, or OAuth redirects).

## Deploy note (cg-assistant-chat)

Before deploying the CG Assistant function, run the repo migration
`supabase/phase-4b-cg-assistant-audit.sql` in the Supabase SQL editor if audit
logging should be stored.

Set the OpenAI secret server-side only:

```bash
supabase secrets set OPENAI_API_KEY=<your-openai-api-key>
```

```bash
npx supabase functions deploy cg-assistant-chat --project-ref ehtjfntukiwbgptqgbzy --no-verify-jwt
```

The function verifies the caller's JWT internally and enforces staff-level
access. It refuses confidential finance, payroll, salary, bank, Xero/accounting,
profit/loss, revenue, invoice totals, tax, ID numbers, owner-note, and private
HR/payroll requests before calling OpenAI for staff and manager roles. Owner and
admin users may ask general future setup questions, but the function still will
not invent unavailable finance values. If `OPENAI_API_KEY` is not set, the UI
still loads and shows a setup message.

Role restriction smoke tests:
- Staff/manager asking for salary, payroll, Xero, bank, profit/loss, revenue,
  invoice totals, tax, ID numbers, or personal HR details should receive a
  refusal.
- Owner/admin asking how to safely configure a future finance integration should
  receive setup guidance without live values.
- "What can you help with?", "What is connected?", and "What is not connected
  yet?" should return the safe capabilities response.
- "Summarise my tasks." should return "Task module not connected yet" and must
  not fake task data.

## Deploy note (meta-list-assets)

This function must be deployed after the code is merged:

```bash
npx supabase functions deploy meta-list-assets --project-ref ehtjfntukiwbgptqgbzy --no-verify-jwt
```

It verifies the caller's JWT internally and enforces staff-level access, so
`--no-verify-jwt` is used (the function handles auth itself).

## Deploy note (meta-connection-status)

This function must be deployed after the code is merged:

```bash
npx supabase functions deploy meta-connection-status --project-ref ehtjfntukiwbgptqgbzy --no-verify-jwt
```

It verifies the caller's JWT internally and enforces staff-level access, so
`--no-verify-jwt` is used (the function handles auth itself).

## Deploy note (meta-sync)

This function must be deployed after the code is merged:

```bash
npx supabase functions deploy meta-sync --project-ref ehtjfntukiwbgptqgbzy --no-verify-jwt
```

It verifies the caller's JWT internally and enforces staff-level access, so
`--no-verify-jwt` is used (the function handles auth itself).

`meta-sync` supports one mode:
- `previous_completed_month` — syncs all linked clients (or a single client if
  `clientId` is provided) for the previous completed calendar month. Pulls
  Facebook Page posts and insights, Instagram media and insights, creates or
  updates internal draft reports, and upserts monthly platform totals into
  `manual_platform_metrics`.

It does **not**:
- Publish reports automatically
- Overwrite existing `strategy_data` or manual strategy notes
- Expose Meta tokens
- Fail the whole sync if one client or one metric fails

## Future phases

1. ✅ OAuth start — generate Meta login URL
2. ✅ OAuth callback — exchange code, store token server-side
3. ✅ Asset discovery — fetch connected pages/accounts from Meta
4. ✅ Asset linking — map Meta assets to CG Dynamics clients
5. ✅ Manual sync — pull monthly data and create/update report drafts
6. ⬜ Scheduled sync — automate monthly pull
