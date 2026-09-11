# OneDrive Production Mapping — Graph Auth Model (Issue #225)

**Status:** Proposal (not applied to production). No Microsoft app/consent/secret/grant. No secrets written.
**Date:** 2026-09-09 (supersedes the 2026-09-08 app-only revision)
**Related:** Issue #225, #224 (Content Run), #219 (Content workflow)

> **CORRECTION (2026-09-09): the source-of-truth OneDrive is a PERSONAL Microsoft account, not an Entra tenant.**
> An earlier revision of this doc (and the `client-onboarding` upload adapter) assumed OneDrive **for Business** in the
> `cgproductionhouse.com` Entra tenant, reachable **app-only / client-credentials** with `Files.ReadWrite.All` or
> `Files.SelectedOperations.Selected`. That is WRONG for this storage. The email `info@cgproductionhouse.com` is used
> across **two** Microsoft identity contexts; the CG Dynamics file authority is the **personal Microsoft account** at
> `onedrive.live.com`. Public domain discovery showing that `cgproductionhouse.com` has a managed Entra tenant does
> **not** mean the personal OneDrive lives there — it does not.

## 1. Account type (proven 2026-09-09, read-only)
- Owner: **personal Microsoft account (consumer MSA)**, display name "CG Production House", email `info@cgproductionhouse.com`.
- Endpoint `onedrive.live.com`; CID **`a2ac9fe4b255f52f`** (16-hex consumer CID); path `/personal/a2ac9fe4b255f52f/Documents/Clients`; Microsoft 365 personal (~11 TB). Account-manager flyout shows the consumer "Microsoft account / View account" chrome.
- Unrelated same-email contexts (NOT the OneDrive owner): work tenant **CG Production House** `7268f625-…` (initial domain `cgproductionhouse365.onmicrosoft.com`); separate **Econofoods** tenant `7fc5acca-…` (`econofoods.co.za`).

## 2. Supported Microsoft Graph auth model (official docs, verified)
- **App-only / client-credentials is NOT supported.** `GET /me/drive` permissions: **Application = "Not supported."** Personal Microsoft accounts have no Entra tenant, admin consent, or application permissions.
- **`Files.SelectedOperations.Selected` and `Sites.Selected` are SharePoint/OneDrive-for-Business (Entra Sites-model, admin-consent) permissions — NOT applicable to a personal Microsoft account.**
- **Correct route: delegated OAuth 2.0 authorization-code flow** with the personal Microsoft identity, plus a **refresh token** for unattended server-side operation (CG Dynamics has no interactive user at runtime).
  - Authority: `https://login.microsoftonline.com/consumers`.
  - App registration **Supported account types: Personal Microsoft accounts** (personal-only, or "any org directory + personal"). **Redirect URI required** (web/server auth-code flow). Confidential server web app ⇒ client secret/certificate; **no admin consent** — `info@` (personal) self-consents once.

## 3. Exact delegated scopes (least privilege) — list / read / create folders
- **`Files.ReadWrite`** — read + create/modify the user's own OneDrive items. Covers list children (`GET /me/drive/items/{id}/children`), read metadata/content, **create folders** (`POST /me/drive/items/{id}/children`), upload. Verified: create-folder Delegated (personal Microsoft account) least-privileged = `Files.ReadWrite`.
- **`offline_access`** — required for the refresh token (unattended server-side use).
- `openid`, `profile` (optionally `User.Read`) — sign-in / identity.
- NOT `Files.ReadWrite.All` (broader; includes items shared with the user). `Files.Read` alone cannot create folders.

## 4. Impact on existing code (flagged; not changed in this PR)
- `supabase/functions/client-onboarding/onedrive-adapter.ts` (client-credentials, `.default`, tenant GUID) **cannot work against this personal OneDrive** and must be re-architected to delegated auth-code + stored/refreshed refresh token. Code change, onboarding/#216 scope — a required follow-up, not done here.
- `docs/onboarding/MICROSOFT-UPLOAD-PERMISSIONS.md` and `docs/client-onboarding-foundation.md` describe the wrong model for this storage and need the same correction.
- Env/secret shape changes: instead of an app-only `ONBOARDING_MS_CLIENT_SECRET` used with `.default`, the model needs app client id + secret + redirect URI + a securely stored (encrypted) **refresh token** minted by a one-time interactive `info@` (personal) sign-in.

## 5. Schema (proposal) — `20260908130000_client_onedrive_production_mapping.sql`
**Unaffected by the auth correction** — durable Graph `driveId` + `itemId` exist for personal OneDrive too (via `/me/drive/items/{id}`), so the mapping model holds as written in this branch: `clients.short_code`; `client_onedrive_mappings` (durable IDs, one per client); `content_run_onedrive_folders` (durable month/shoot folder id); RLS on, revoked from anon/authenticated, service-role read helpers + admin-only write helpers. No fuzzy runtime matching; no rename/move/delete. (Note: `videos_folder_item_id`/`month_folder_item_id` are currently `NOT NULL` — consider nullable-until-verified if a client folder has no `Videos` yet.)

## 6. Gate (nothing performed)
No app registered, no consent, no secret, no grant, no SQL, no OneDrive change. Next step once approved: register a **personal-account** app (redirect URI), have `info@` (personal) interactively consent `Files.ReadWrite offline_access`, store the refresh token server-side, then resolve durable IDs via `/me/drive` and populate `client_onedrive_mappings` for the 55 active clients.
