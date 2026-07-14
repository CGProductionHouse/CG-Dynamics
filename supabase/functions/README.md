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
supabase secrets set OPENROUTER_API_KEY=<your-openrouter-api-key>
supabase secrets set OPENROUTER_MODEL=openrouter/free
supabase secrets set GEMINI_API_KEY=<your-gemini-api-key>
supabase secrets set GEMINI_MODEL=gemini-2.5-flash-lite
supabase secrets set GROQ_API_KEY=<your-groq-api-key>
supabase secrets set GROQ_MODEL=llama-3.1-8b-instant
supabase secrets set OPENAI_API_KEY=<your-openai-api-key>
supabase secrets set OPENAI_MODEL=gpt-4o-mini
supabase secrets set AI_PROVIDER_ORDER=openrouter,gemini,groq,openai
supabase secrets set AI_MAX_FALLBACKS=3
```

`META_REDIRECT_URI` must match exactly what is registered in the Meta App
settings, e.g.:
`https://<project>.supabase.co/functions/v1/meta-oauth-callback`

`APP_PUBLIC_URL` is where the browser is redirected after the OAuth callback
succeeds or fails.

AI provider keys are used only by the `cg-assistant-chat` Edge Function. They
must not be added as `VITE_` browser environment variables.

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

## Microsoft 365 import (no Edge Function — deliberate)

The Microsoft migration is a once-off, operator-assisted import (Option A in
`docs/microsoft-365-import-map.md`). There is NO Microsoft Edge Function, no
Entra app registration, no OAuth flow, and no token storage in this project —
the deployed app never talks to Microsoft Graph.

An operator with delegated organisational access exports a normalized JSON
snapshot; an admin uploads it at `/admin/microsoft-import` where preview and
apply run in the browser against Supabase. If a *recurring* Microsoft
connection is ever genuinely needed, that becomes a new reviewed design
(delegated OAuth, encrypted refresh-token storage, `Prefer:
IdType="ImmutableId"` on every Outlook request) — do not resurrect the old
stub endpoint without that review.

## Deploy note (cg-assistant-chat)

Before deploying the CG Assistant function, run the repo migration
`supabase/phase-4b-cg-assistant-audit.sql` in the Supabase SQL editor if audit
logging should be stored.

Set provider secrets server-side only. Recommended order is OpenRouter first,
then Gemini, then Groq, then OpenAI as paid fallback:

```bash
supabase secrets set OPENROUTER_API_KEY=<your-openrouter-api-key>
supabase secrets set OPENROUTER_MODEL=openrouter/free
supabase secrets set GEMINI_API_KEY=<your-gemini-api-key>
supabase secrets set GEMINI_MODEL=gemini-2.5-flash-lite
supabase secrets set GROQ_API_KEY=<your-groq-api-key>
supabase secrets set GROQ_MODEL=llama-3.1-8b-instant
supabase secrets set OPENAI_API_KEY=<your-openai-api-key>
supabase secrets set OPENAI_MODEL=gpt-4o-mini
supabase secrets set AI_PROVIDER_ORDER=openrouter,gemini,groq,openai
supabase secrets set AI_MAX_FALLBACKS=3
```

Provider variables:
- `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` route OpenRouter free/low-cost
  model calls through the OpenAI-compatible chat completions endpoint.
- `GEMINI_API_KEY` / `GEMINI_MODEL` route Gemini API calls.
- `GROQ_API_KEY` / `GROQ_MODEL` route Groq OpenAI-compatible calls.
- `OPENAI_API_KEY` / `OPENAI_MODEL` are paid OpenAI fallback only when
  configured and earlier providers fail.
- `AI_PROVIDER_ORDER` controls provider priority.
- `AI_MAX_FALLBACKS=3` allows the default four-provider chain to try the first
  provider plus three fallbacks.

ChatGPT Plus/Pro subscriptions do not power API usage. Each API provider needs
its own key, billing/quota setup, and rate-limit handling. Free models may be
useful for testing or low-cost staff help, but they are not guaranteed
production capacity.

```bash
npx supabase functions deploy cg-assistant-chat --project-ref ehtjfntukiwbgptqgbzy --no-verify-jwt
```

The function verifies the caller's JWT internally and enforces staff-level
access. It refuses confidential finance, payroll, salary, bank, Xero/accounting,
profit/loss, revenue, invoice totals, tax, ID numbers, owner-note, and private
HR/payroll requests before routing to any AI provider for staff and manager
roles. Owner and admin users may ask general future setup questions, but the
function still will not invent unavailable finance values. If no provider key is
set, the UI still loads and shows a setup message.

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
- Remove all provider keys and ask a normal operational question. The assistant
  should say no AI provider key is configured.
- Set the first provider key invalid while a later provider is valid. Server
  logs should show the first provider failing and the later provider/model used.
- Exhaust or rate-limit a free provider. The router should try the next
  configured provider, then return the clean unavailable message only if all
  configured providers fail.

Launch checklist:
- Merge the assistant branch after review.
- Set Supabase secrets for OpenRouter, Gemini, Groq, and OpenAI fallback as
  needed.
- Deploy `cg-assistant-chat`.
- Run `supabase/phase-4b-cg-assistant-audit.sql` in the Supabase SQL editor.
- Sign in as admin and confirm `/admin/assistant` shows the diagnostics panel.
- Run "Refresh diagnostics" and "Test AI Provider".
- Confirm staff/team users do not see diagnostics and cannot call diagnostics
  actions.
- Confirm staff restriction prompts refuse payroll, salary, Xero, bank,
  profit/loss, revenue, invoice totals, tax, ID numbers, and personal HR
  details.
- Test provider fallback with an invalid first provider key and a valid later
  provider key.
- Test missing provider keys in a safe non-production environment.
- Check the assistant mobile layout.
- Confirm the Vercel build passes.

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
