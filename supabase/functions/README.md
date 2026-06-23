# Supabase Edge Functions — Meta sync skeleton

These functions are **placeholder skeletons** for the future Meta Business sync flow.

## Status

- **No Meta OAuth is active yet.**
- **No Meta APIs are called yet.**
- **No tokens are stored or exchanged.**
- All functions return `{ ok: false, status: "not_implemented" }`.

## Security rule

Tokens must **only** be handled server-side in Edge Functions. The frontend must never receive token values. Encrypted token storage goes into the `meta_connection_tokens` table, which has RLS enabled with no frontend-accessible policies — only the service_role key (used by these functions) can read or write it.

## Future phases

1. Deploy skeleton to Supabase
2. Add Meta App secrets to Supabase
3. Build `meta-oauth-start` — generate the Meta OAuth login URL
4. Build `meta-oauth-callback` — exchange code for tokens, write encrypted tokens to `meta_connection_tokens`, update `meta_connections.status`
5. Build asset-linking logic — map Facebook Pages / Instagram accounts to CG clients
6. Build `meta-sync` — pull monthly data, create/update report drafts

## Deploy

```bash
supabase functions deploy meta-oauth-start --no-verify-jwt
supabase functions deploy meta-oauth-callback --no-verify-jwt
supabase functions deploy meta-sync --no-verify-jwt
```

> `--no-verify-jwt` is used because these functions need to handle their own auth validation (OAuth callback receives a Meta redirect, not a Supabase JWT). Auth verification for sync will be added in a later phase.
