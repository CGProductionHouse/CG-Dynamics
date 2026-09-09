# OneDrive Delegated OAuth — App Registration & Implementation Plan (#225)

Status: **implementation-ready design.** Code for everything not needing live credentials is in PR #307.
Nothing gated has been done (no app, no secret, no consent, no production secrets/SQL, no OneDrive change).

Account: **personal Microsoft account** `info@cgproductionhouse.com` (`onedrive.live.com`, CID `a2ac9fe4b255f52f`).
Auth: **delegated OAuth 2.0 authorization-code + PKCE + refresh token**. App-only is not supported for personal accounts.

---

## 1. Exact Microsoft app registration values  `CA GATE (register)`
Register once (Azure Portal → App registrations → New registration; a personal MS account can register at
`portal.azure.com`, or a work-tenant admin can register a multi-audience app):

| Setting | Value |
|---|---|
| Name | `CG Dynamics OneDrive (Delegated)` |
| Supported account types | **Personal Microsoft accounts only** (or "Accounts in any org directory + personal Microsoft accounts"). We authenticate via `/consumers`, so only the personal account is used. |
| Redirect URI (Web) | see §2 |
| Implicit/hybrid grants | none |
| Allow public client flows | **No** (confidential web app; uses a client secret) |
| API permissions (delegated, Microsoft Graph) | `Files.ReadWrite`, `offline_access`, `openid`, `profile` |
| Admin consent | **not required** — the personal user self-consents once |
| Client secret | created at consent time — `CA GATE (secret)` |

## 2. Exact redirect URI
```
https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/onedrive-oauth-callback
```
(The deployed `onedrive-oauth-callback` Edge Function. Register this exact string as a **Web** redirect URI.)

## 3. Exact scopes (least privilege)
```
Files.ReadWrite offline_access openid profile
```
`Files.ReadWrite` = list/read/**create** folders in the user's own OneDrive; `offline_access` = refresh token;
`openid profile` = sign-in. **Not** `Files.ReadWrite.All`, **not** any `*.Selected` / `Sites.*` (those are ODB/SharePoint only).

## 4. Exact secret / env values needed  `CA GATE (write secrets)`
Set on the `client-onboarding`, `onedrive-oauth-start`, `onedrive-oauth-callback` Edge Functions
(Supabase project `ehtjfntukiwbgptqgbzy`):

| Env | Value / how to get it |
|---|---|
| `ONEDRIVE_MS_CLIENT_ID` | Application (client) ID from §1 |
| `ONEDRIVE_MS_CLIENT_SECRET` | client secret value from §1 (shown once) |
| `ONEDRIVE_MS_REDIRECT_URI` | the §2 URL, verbatim |
| `ONEDRIVE_MS_AUTHORITY` | `https://login.microsoftonline.com/consumers` (default; can omit) |
| `ONEDRIVE_MS_SCOPE` | `Files.ReadWrite offline_access openid profile` (default; can omit) |
| `ONEDRIVE_TOKEN_ENC_KEY` | base64 of 32 random bytes, e.g. `openssl rand -base64 32` (AES-256-GCM key for the token store) |
| `ONEDRIVE_OAUTH_SETUP_TOKEN` | a random high-entropy string; required to start the one-time consent |

Retire the app-only `ONBOARDING_MS_TENANT_ID/CLIENT_ID/CLIENT_SECRET` (non-functional for a personal account).
`MICROSOFT_*` (read-only transition connector) is untouched. `CLIENT_ONBOARDING_UPLOADS_ENABLED=true` still gates uploads.

## 5. One-time consent flow CA completes  `CA GATE (consent/login)`
1. Ensure §1 app + §4 env are in place and the `20260909090000_microsoft_oauth_tokens.sql` migration is applied.
2. In the browser signed into the **personal** `info@cgproductionhouse.com`, open:
   `https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/onedrive-oauth-start?setup_token=<ONEDRIVE_OAUTH_SETUP_TOKEN>`
3. Microsoft shows the consent screen for `Files.ReadWrite offline_access` → **Accept**.
4. The `onedrive-oauth-callback` exchanges the code (PKCE) and stores the encrypted refresh token. It displays only
   "OneDrive connected" — never a token.
5. Unattended calls now work: the adapter refreshes access tokens automatically and persists each rotated refresh token.
   If the refresh token is ever revoked, calls fail closed and CA re-runs step 2.

## 6. Code changes required before connecting the real OneDrive
Already in PR #307 (no live creds needed to compile/test):
- `supabase/functions/client-onboarding/onedrive-adapter.ts` — **redesigned** from client-credentials to delegated
  refresh-token; adds `resolveClientsFolder`, `listChildren`, `getItem`, `ensureCanonicalChildFolder` (create-only),
  plus `newPkce`/`buildAuthorizeUrl`/`exchangeAuthorizationCode`. Keeps the four exports `index.ts` uses.
- `supabase/functions/client-onboarding/onedrive-token-store.ts` — AES-256-GCM encrypted token store + PKCE pending.
- `supabase/functions/onedrive-oauth-start` + `onedrive-oauth-callback` — one-time consent.
- `supabase/migrations/20260909090000_microsoft_oauth_tokens.sql` — encrypted token table (proposal-only).
- `supabase/migrations/20260908130000_client_onedrive_production_mapping.sql` — durable mapping (proposal-only;
  `videos_folder_item_id` now nullable).
- `src/lib/onedriveCanonical.ts` (+ Deno `_shared/onedrive-canonical.ts`) — pure canonical/name/token-state helpers.
- Tests: `tests/onedriveCanonical.test.mjs`, `tests/onedriveDelegatedAdapter.test.mjs`; onboarding tests updated.

Remaining wiring (safe to do now, but functionally gated on §5 tokens):
- A staff UI action + `client-onboarding` endpoints to call the new `#225` helpers (list/resolve/create/open) and
  populate `client_onedrive_mappings` via the migration's admin-only RPCs. Deferred to the follow-up implementation
  PR once consent exists, to avoid shipping UI that can only 503.

### Durable-ID mapping preserved
`client_onedrive_mappings` / `content_run_onedrive_folders` store durable `driveId` + `itemId` (from `/me/drive`), so
runtime resolves by ID (never by name). Create-on-request uses `ensureCanonicalChildFolder` (conflictBehavior `fail`,
no rename/move/delete). Raw Graph IDs/tokens are never returned to clients; staff get `webUrl` deep links only.

---

## Genuine remaining gates (need CA)
- `CA GATE (register)` register the app · `CA GATE (secret)` create client secret · `CA GATE (consent/login)`
  one-time personal consent · `CA GATE (write secrets)` set `ONEDRIVE_MS_*` env · `CA GATE (apply SQL)` apply the two
  migrations · `CA GATE (deploy)` deploy functions · `CA GATE (merge)` merge PR #307. No OneDrive content is ever
  renamed/moved/deleted by this design.
