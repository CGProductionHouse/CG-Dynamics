# #598 Instagram config / Meta save preflight

Read-only inspection: 1 October 2026. Repository baseline:
`0be26fbdf8790dab9dd18a7782ea31e7988b300e`.
This document is a protected execution plan, not authorization to execute it.

## Verified private production / dashboard state

Authenticated Meta Developers: parent CG Dynamics app `976168728361566`,
Development mode; Instagram product CG Dynamics-IG `1383360116973315`.
Production `INSTAGRAM_APP_ID` matches that exact Instagram product ID.

Config inspection used Supabase CLI secret-list **digest metadata**, not secret
values. The CLI JSON property named `value` is the digest shown under DIGEST by
the [official formatter](https://github.com/supabase/cli/blob/v2.115.0/apps/cli/src/legacy/commands/secrets/secrets.format.ts).
SHA-256 comparisons used only known reviewed public candidates; no secret/key
retrieval, digest publication or guessing of opaque values occurred.

| Config name | Verified result / remaining hold |
| --- | --- |
| `INSTAGRAM_APP_ID` | Present; exact Meta Instagram product identity matches. |
| `INSTAGRAM_APP_SECRET` | Absent. Do not substitute the parent Facebook app secret. |
| `APP_PUBLIC_URL` | Present; matches old `https://cg-dynamics.vercel.app`, not required `https://www.cgdynamics.co.za`. |
| `INSTAGRAM_REDIRECT_URI` | Present; matches the saved exact callback below. |
| `INSTAGRAM_GRAPH_VERSION` | Present; matches the reviewed explicit version candidate, not a blank/default. |
| `INSTAGRAM_TOKEN_ENCRYPTION_KEY_B64` | Present; canonical base64 / exactly 32 decoded bytes **not proven** from digest metadata. Private CA validation required. |
| `INSTAGRAM_TOKEN_ENCRYPTION_KEY_VERSION` | Present; actual `^v[1-9]\d{0,8}$` structure **not proven** from digest metadata. A non-match against one known version is not evidence of invalidity. |
| `INSTAGRAM_STANDALONE_LIVE_ACTIVATION_ENABLED` | Present; matches literal `false`; activation OFF. |

Do not rotate or replace the existing encryption key/version to resolve the
verification hold. `APP_PUBLIC_URL` also serves admin invitations and Meta/TikTok
OAuth callbacks; its canonical-origin correction needs explicit bounded approval
with those shared effects understood.

## Exact Meta paths and values

Instagram secret path: Meta Developers → CG Dynamics → Instagram → API setup
with Instagram login (page heading **API setup with Instagram business login**)
→ Instagram app secret → **Show**.
URL: `https://developers.facebook.com/apps/976168728361566/instagram-business/`.
The secret remained masked; **Show was not clicked**. Whether Meta requests
password/2FA re-authentication or immediately reveals it depends on the session
and is unverified. CA must take private control before Show; never capture the
revealed value in chat, screenshots, terminal history or logs. App settings →
Basic → Show is the wrong parent-app secret.

| Field and exact UI location | Current saved state | Proposed exact public value |
| --- | --- | --- |
| App settings → Basic → Privacy policy URL | Blank | `https://www.cgdynamics.co.za/privacy-policy` |
| App settings → Basic → Terms of Service URL | Facebook homepage | `https://www.cgdynamics.co.za/terms-of-service` |
| App settings → Basic → User data deletion, **Data deletion instructions URL** mode | Facebook homepage | `https://www.cgdynamics.co.za/privacy-policy` |
| Instagram → API setup → 3. Set up Instagram business login → Business login settings → Deauthorize callback URL | Blank | `https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/instagram-deauthorize` |
| Same dialog → Data deletion request URL | Blank | `https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/instagram-data-deletion` |

Both canonical legal pages rendered with real privacy/terms/contact content.
Human deletion instructions and the signed machine callback are distinct.
Preserve the existing saved OAuth redirect exactly:
`https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/instagram-oauth-callback`.
Preserve only `instagram_business_basic` + `instagram_business_manage_insights`.
Do **not** use Meta's generated Embed URL: it includes additional scopes.
Do not configure the separate **2. Configure webhooks** section or a verify token.

## Callback health with activation OFF

All three functions remain ACTIVE, JWT verification false per the approved
external-callback contract, with #595 bundle parity unchanged:

| Function | Version | Bundle SHA-256 |
| --- | --- | --- |
| `instagram-oauth-callback` | 6 | `f2ee94b5a260a5fe907197057fcfe7caa96cb3b0365d945f7395e808b468c3d2` |
| `instagram-deauthorize` | 1 | `824259d3d0d75ea998ab0a35a6187dd95a09d309af5e345d7aee4e44bbd8e451` |
| `instagram-data-deletion` | 1 | `391917292d95cd5fc8500048a0fb258b6983363d026275d750ac2d61d29131ba` |

OAuth GET without code/state returned 302 `activation_blocked` to the old origin,
as current config predicts. Invalid unsigned callback requests returned expected
503 (missing app secret), not success. Unknown deletion receipt returned 404.
Standalone connections, tokens, bindings and callback receipts each remain zero.
No real signed callbacks, provider requests or mutation RPCs were invoked.

## Bounded next-session sequence — requires separate CA authorization

1. Recheck exact app identities, Development mode, activation false, zero receipt/
   standalone counts and #595 function parity. Privately validate existing key
   canonical base64/32 bytes and version regex without displaying either value.
   Stop if validation is unavailable or fails; no key replacement is authorized.
2. CA privately opens the **Instagram product** Show control and completes any
   provider re-authentication. Transfer directly through the approved private
   secret-entry path; no chat/log/screenshot capture; remask and clear clipboard.
3. Only if explicitly approved: add `INSTAGRAM_APP_SECRET` and correct only
   `APP_PUBLIC_URL` to `https://www.cgdynamics.co.za`. Preserve redirect, Graph,
   encryption key/version, all other config and activation OFF. No Edge deploy.
4. Read back names/digest comparisons without values. OAuth no-code/state must
   still redirect `activation_blocked`, now to the canonical origin. Invalid
   signatures must return the handler's 400/401 rejection rather than missing-
   secret 503; unknown receipt stays 404, counts remain zero, bundles unchanged.
5. If explicitly approved: App settings → Basic, save the three public values
   above, keeping **instructions URL** mode. Navigate away/reopen and read back.
6. If explicitly approved: Instagram business login settings, save only the two
   signed callback URLs; preserve redirect. Reopen/read back all three URLs.
7. Reconfirm Development, activation OFF and the exact two-scope runtime flow.
   Stop: verification, testers, review/access requests, Live, OAuth and activation
   are separate gates. No owner-authorized standalone review fixture is established.

Stop on app/namespace/scope mismatch, invalid key/version, changed bundle/JWT
contract, unexpected callback success/receipt, wrong redirect origin, or any UI
request requiring unapproved permissions/config. Do not broaden scope to fix it.

Before a save, cancel the draft on mismatch. After an authorized save fails
acceptance, keep activation OFF and request bounded CA rollback authority: restore
only the previously recorded public origin / remove only the newly added secret,
or restore only the changed public Meta fields as directed. Do not automatically
rotate keys, reset unrelated config, reverse schema, downgrade functions or expose
rollback credentials. Old Meta placeholders are not a readiness pass.

## Verification and boundary

Focused login/encryption/provider-callback suites: **52 passed, 0 failed**.
`npm run build` passed (existing chunk-size advisory only); scoped ESLint on the
three callback entry points and `git diff --check` passed.
This lane changed documentation only. No Meta saves, Show/re-authentication,
secret/config writes, deployment, migrations, activation, OAuth, valid signed
callbacks, connection/revocation/deletion or other production mutations occurred.
