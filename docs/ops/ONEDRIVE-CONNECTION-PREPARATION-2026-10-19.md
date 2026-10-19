# Dynamics-owned OneDrive connection — 19 October 2026

CA explicitly approved **preparing a new Microsoft connection** for
info@cgproductionhouse.com with file read/write and background refresh, while
client access remains read-only. New credential entry and final consent remain
CA-owned. This is not authorization for arbitrary permission/publication changes.

## Evidence and prepared provider form

- The authenticated Supabase CLI returned 66 secret metadata entries. Only
  names/presence were inspected; **zero `ONEDRIVE_*` names exist**. Do not fetch,
  print or copy values/digests. This refines the earlier missing-consent diagnosis:
  app configuration is absent too, not simply an expired connected account.
- Earlier read-only DB evidence found no `onedrive_personal` token row. Braize's
  exact folder mapping exists; library absent; live management returns503 safely.
  Fresh read-only recheck confirms zero account rows, token-table RLS enabled,
  and no SELECT/INSERT/UPDATE grants for anon/authenticated. The deployed function
  inventory contains **neither `onedrive-oauth-start` nor `onedrive-oauth-callback`**.
  Source files exist; that did not prove deployed callback availability.
- Microsoft Entra is signed into the real company tenant as the company owner.
  All registrations list only the Microsoft Transition Sync app and Claude for
  Outlook. Neither was changed/reused. Do not widen the staff connector.
- A **new registration form is filled, NOT submitted**:
  `CG Dynamics OneDrive (Delegated)`, **Personal accounts only**, **Web** callback
  `https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/onedrive-oauth-callback`.
  Register explicitly accepts Microsoft's Platform Policies, so CA must complete
  it or give action-time approval. No app ID, new secret or access grant exists
  from this preparation. The browser form is a handoff, not durable registration.

Use the existing delegated design in
`docs/onboarding/ONEDRIVE-DELEGATED-OAUTH-DESIGN-225.md`; no duplicate integration,
app-only grant, ChatGPT-token copying or public sharing workaround.

## Exact remaining operator sequence

1. CA completes the prepared registration / Microsoft Platform Policies. Inspect
   the resulting app ID, **personal-only audience**, exact Web redirect and
   disabled implicit/public-client flows. Do not accidentally choose a SPA
   callback or change the existing Teams application.
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

Verification receipt will be appended after the frozen local run. No Vercel
operation, Supabase deploy/secret/data write, provider registration/grant,
OneDrive file/share change or library activation occurred in this preparation.

## Official protocol references

- [Microsoft application registration](https://learn.microsoft.com/en-us/graph/auth-register-app-v2)
- [Authorization code, PKCE, exact redirect and offline refresh](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)
- [Supabase update filters](https://supabase.com/docs/reference/javascript/using-filters)
- [Supabase zero-or-one returned row](https://supabase.com/docs/reference/javascript/using-modifiers-maybesingle)
