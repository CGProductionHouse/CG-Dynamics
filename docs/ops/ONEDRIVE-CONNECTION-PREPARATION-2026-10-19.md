# Dynamics-owned OneDrive connection — 19 October 2026

CA explicitly approved **preparing a new Microsoft connection** for
info@cgproductionhouse.com with file read/write and background refresh, while
client access remains read-only. New credential entry and final consent remain
CA-owned. This is not authorization for arbitrary permission/publication changes.

## Evidence and owner-completed registration

- The authenticated Supabase CLI returned 66 secret metadata entries. Only
  names/presence were inspected; **zero `ONEDRIVE_*` names exist**. Do not fetch,
  print or copy values/digests. This refines the earlier missing-consent diagnosis:
  app configuration is absent too, not simply an expired connected account.
- Earlier read-only DB evidence found no `onedrive_personal` token row. Braize's
  exact folder mapping exists; library absent; live management returns503 safely.
  Fresh read-only recheck confirms zero account rows, token-table RLS enabled,
  and no SELECT/INSERT/UPDATE/DELETE grants for anon/authenticated. The deployed function
  inventory contains **neither `onedrive-oauth-start` nor `onedrive-oauth-callback`**.
  Source files exist; that did not prove deployed callback availability.
- Microsoft Entra is signed into the real company tenant as the company owner.
  The initial inventory listed only the Microsoft Transition Sync app and Claude for
  Outlook. Neither was changed/reused. Do not widen the staff connector.
- A new registration form was prepared, then **CA personally registered it**:
  `CG Dynamics OneDrive (Delegated)`, **Personal accounts only**, **Web** callback
  `https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/onedrive-oauth-callback`.
  Register accepts Microsoft's Platform Policies; the agent did not click it.
  Actual overview verified: personal-only audience, one exact Web callback, zero
  SPA/native URIs, implicit/hybrid grants OFF and public-client flows OFF.
- Configured requested delegated scopes are exactly `Files.ReadWrite`,
  `offline_access`, `openid`, `profile`. Removed unused default `User.Read`.
  No consent grant or `*.All`/tenant-wide/application permission. Configuration
  of requested permissions is not successful OneDrive authorization.
- Microsoft's **Add a client secret** dialog is prepared, description
  `CG Dynamics OneDrive server`, recommended180-day expiry. No secret created by
  agent. CA owns Add and the one-time value transfer to authenticated Supabase,
  where only name `ONEDRIVE_MS_CLIENT_SECRET` is filled; value blank, Save not
  clicked by agent. Use **Value**, not Secret ID; never send it in chat or
  screenshots. Record actual expiry/rotation responsibility before activation.
  Do not read the new value back with browser tools.

Use the existing delegated design in
`docs/onboarding/ONEDRIVE-DELEGATED-OAUTH-DESIGN-225.md`; no duplicate integration,
app-only grant, ChatGPT-token copying or public sharing workaround.

## Exact remaining operator sequence

1. Registration/account/redirect/security settings are verified as above. Continue
   this exact app, not another registration or the existing Teams application.
2. CA creates/enters the new app credential directly in trusted Microsoft and
   Supabase secret-management surfaces, never in chat/repo/browser frontend.
   Supabase target is **only `ehtjfntukiwbgptqgbzy`**. Needed names:
   `ONEDRIVE_MS_CLIENT_ID`, `ONEDRIVE_MS_CLIENT_SECRET`,
   `ONEDRIVE_MS_REDIRECT_URI`, `ONEDRIVE_TOKEN_ENC_KEY` (fresh base64 32-byte
   AES-GCM key), `ONEDRIVE_OAUTH_SETUP_TOKEN` (fresh high-entropy setup gate).
   Optional explicit defaults: `ONEDRIVE_MS_AUTHORITY` =
   `https://login.microsoftonline.com/consumers`; `ONEDRIVE_MS_SCOPE` =
   `Files.ReadWrite offline_access openid profile`. Do not rotate an existing key
   if the state has changed since this receipt. Never put any value in logs,
   screenshots, issue comments, Git, CLI arguments/history or client Vite env.
3. Obtain exact protected release approval for the two currently absent OAuth
   functions using their reviewed existing source/closure, setup gate and public
   callback; deploy/re-read only that closure before activating it. This branch
   hardens single-use pending-state consumption; it is not yet a hosted fix.
   The current preparation approval is not claimed as blanket production Edge
   release authority. Preserve token-table RLS/grants; old migration comments are
   not proof and no migration replay/new schema is needed or authorized here.
4. Start the existing setup-gated PKCE flow privately. Prefer the existing
   `x-setup-token` header over placing the setup credential in a browser URL or
   screenshot. Never share the setup URL/secret. CA signs into the **personal**
   info account and completes Microsoft's final delegated consent. Request only
   `Files.ReadWrite offline_access openid profile`; no `*.All`, `Sites.*`,
   application permissions or tenant-wide grant. Do not grant on CA's behalf.
5. Verify encrypted token presence/status without selecting/exporting ciphertext
   or tokens. Perform bounded read-only exact-drive/folder checks. Authorization
   alone is not proof that stored mappings/ancestry/media work.
6. Prepare a disabled pilot library; review/explicitly publish cleared assets,
   separately enable it, then prove genuine client-role list/view/download/range,
   expiry and horizontal isolation. Only then continue the reviewed client cohort.
   Existing 61 roots/183 categories are not to be recreated or publicly shared.

The app-side permission can read/write owner files; client users never receive
that permission or a Microsoft token. Existing opaque, exact-client media broker
and final-file publication gates remain mandatory. Onboarding uploads stay at
their existing gate; this preparation does not enable them.

## Local callback repair and verification

Reproduced on the original code using the actual encrypted token store, real
installed Supabase SDK and Web Crypto with isolated loopback transport:

- delayed callback clears a newer sign-in;
- both concurrent callbacks obtain the verifier;
- failed pending-state clear still authorizes code exchange;
- malformed expiry passes the old date comparison;
- invalid ciphertext clears state unnecessarily.

The bounded fix requires valid/unexpired state and successful decryption, then
conditionally consumes the exact account/state/ciphertext/expiry snapshot and
requires one confirmed returned row. Errors, zero rows or a losing callback do
not exchange a code. No schema, policy, dependency or client interface change.

`tests/onedrivePendingAuth.test.mjs` is deterministic local transport/crypto
acceptance, **not hosted PostgREST/RLS or successful Microsoft consent**.
The pending-state fix changes a different hunk from PR662's `importKey` typing
change; retain both when integrating. Staff/Teams checkout is untouched.
Latest observed peer is clean `dca6439e`, not a combined acceptance claim.

## Verified local receipt / code-only review

Frozen candidate `32ec8e80615ff2deeac71c36749bb196bf6989e1` passed the whole
canonical `local-launch-acceptance.mjs --run`:3988total/3971passed/17declared
skips/0failed/cancelled/todo; source stable; TypeScript/Vite7,121actual JS chunks,
all19browser journeys (desktop1440/mobile375/390/430 where applicable). Scoped
ESLint, Deno token-store/start/callback and diff checks pass. Local temp receipt
`cg-local-launch-32ec8e80615f.json`. Fixture dist must NEVER be uploaded.

Earlier run d72cbcd1 passed suite/build but caught an existing compiled-browser
fixture race: request-count assertion saw the old still-visible heading. Now it
awaits BOTH actual SDK503responses and retains the exact two-request assertion.
Four-width standalone and the entire frozen run then passed; first failed receipt
retained. Only Deno's own newly generated untracked lockfile was removed before
the clean run; no dependency/lockfile change committed.

Code-only review: **approve**, no blocking code findings. Unique account key plus
exact snapshot predicates and one confirmed returned row protect consumption;
bad expiry/decryption/persistence fail closed. Actual SDK/WebCrypto regressions,
not hosted SQL concurrency/Microsoft consent/genuine client-media acceptance.
No new client surface/schema/RLS/dependency or source of truth.

No Vercel, Supabase deploy/secret/data write, final provider consent, OneDrive
file/share change or library activation. CA registered the dedicated app; agent
configured only its requested permission list and prepared owner credential entry.
Previous live frontend/v44 unchanged. Control Centre exact reference still
unavailable; no guessed tracker or replacement.

## Exact backend release scope — prepared, NOT authorized/executed

Only project `ehtjfntukiwbgptqgbzy`, two absent functions `onedrive-oauth-start`
and `onedrive-oauth-callback`. Both need public platform invocation
(`verify_jwt=false`): start retains the private setup-token gate; callback requires
unexpired single-use random PKCE state/code. No staff/Teams/MCP/frontend release,
general client write action, auth reconfiguration, schema/RPC/dependency change
or upload activation. Canonical Git blobs (prefix `supabase/functions/`):

| File | Git blob |
| --- | --- |
| `onedrive-oauth-start/index.ts` | `662e1f6aacf9d52ba75024dca4705abacc1d9ace` |
| `onedrive-oauth-callback/index.ts` | `79020349ab5b7937fd4f1b3f826ad4ec8ab6600e` |
| `client-onboarding/onedrive-token-store.ts` | `1e015da0990fad8bac04f142f58f130d96f387f1` |
| `client-onboarding/onedrive-adapter.ts` | `bf2d6829a97067868a5a53e6ec082440594df80c` |
| `_shared/cors.ts` | `ed3241d7543dd482db088d42f03800f195df83a4` |
| `_shared/onedrive-canonical.ts` | `ac994c250c5793ef20d9d60e129c47dba15e1020` |
| `client-onboarding/library-asset-boundary.ts` | `9bc6f3c2059a632bb29cbfd171054d23223c0756` |

Before approved release, recheck exact source/config and preserve private receipt.
Re-read entire hosted closure; verify missing/wrong setup gate403 and absent/bad
callback state400 without token minting. Config must match this exact app/consumer
authority/callback/scopes and fresh encryption/setup keys. Never overwrite an
existing encryption key using stale evidence or log any secret. Stop on unknown
or mismatched state, wrong account/scopes, unexpected grants or write outcome.
Final consent is CA-owned. Libraries stay disabled/private until genuine media
checks pass. Existing production functions/sites are never removed or paused
for rollback: halt this isolated new setup and seek owner-directed recovery if
activation fails. This document does not authorize the protected release.

## Official protocol references

- [Microsoft application registration](https://learn.microsoft.com/en-us/graph/auth-register-app-v2)
- [Authorization code, PKCE, exact redirect and offline refresh](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)
- [Supabase update filters](https://supabase.com/docs/reference/javascript/using-filters)
- [Supabase zero-or-one returned row](https://supabase.com/docs/reference/javascript/using-modifiers-maybesingle)
