# Microsoft Graph Upload Permission Model — Client Onboarding

> **SUPERSEDED (2026-09-09, #225).** The app-only / client-credentials model below was written
> for OneDrive **for Business** in an Entra tenant. The real CG Dynamics OneDrive is a **personal
> Microsoft account** (`onedrive.live.com`), for which app-only is **not supported**. The current
> model is **delegated OAuth (authorization-code + refresh token)** — see
> `docs/onboarding/ONEDRIVE-PRODUCTION-MAPPING-225.md`. Env is now `ONEDRIVE_MS_CLIENT_ID` /
> `ONEDRIVE_MS_CLIENT_SECRET` / `ONEDRIVE_MS_REDIRECT_URI` / `ONEDRIVE_TOKEN_ENC_KEY` (+ authority
> `.../consumers`), scopes `Files.ReadWrite offline_access openid profile`. The tenant-based rows
> below are retained only as historical context.

This document is the historical audit record for the (now superseded) app-only permission model.

## Historical model: fail-closed, dedicated app, environment-gated

| Gate | Status | Notes |
|------|--------|-------|
| Dedicated Microsoft app | Required | Separate from the read-only transition sync connector |
| Environment credentials | Historical | Delegated now: `ONEDRIVE_MS_CLIENT_ID`, `ONEDRIVE_MS_CLIENT_SECRET`, `ONEDRIVE_MS_REDIRECT_URI`, `ONEDRIVE_TOKEN_ENC_KEY` (was `ONBOARDING_MS_*`) |
| Uploads feature flag | Required | `CLIENT_ONBOARDING_UPLOADS_ENABLED=true` in Edge Function env |
| Drive mapping | Required | An active `client_onboarding_drive_mapping` row must exist for the exact client and upload category |
| Migration applied | Required | Phase 2 migration maps each client upload category to an exact existing drive folder |
| Runtime verification | Required | `verifyDriveItem` confirms file landed before marking received |

**All gates must be satisfied before any upload executes.** If any gate is missing, uploads return 503 and the client sees a clear error.

## Graph API permissions used

### Upload session creation

```
POST /drives/{driveId}/items/{folderItemId}:/{filename}:/createUploadSession
```

**Required application permission:** `Files.ReadWrite.All` (application, not delegated)

### DriveItem verification

```
GET /drives/{driveId}/items/{itemId}
```

**Required application permission:** `Files.ReadWrite.All` (application, not delegated)

### File download (server-mediated proxy)

```
GET /drives/{driveId}/items/{itemId}
GET /drives/{driveId}/items/{itemId}/content
```

**Required application permission:** `Files.ReadWrite.All` (application, not delegated)

## Why Files.ReadWrite.All and not a narrower scope

Microsoft Graph does not offer folder-scoped application permissions for OneDrive for Business. The available application permissions are:

- `Files.ReadWrite.All` — read/write all files in all OneDrive accounts in the organisation
- `Files.ReadWrite` — read/write files the app has access to (delegated only, not application)
- `Sites.Selected` — read/write sites explicitly granted via Sites.Selected permission grant

**`Files.ReadWrite.All` is not folder-scoped.** It grants access to every OneDrive file in the tenant. This is the current production reality for any daemon/Background app accessing OneDrive for Business.

### Narrowest valid alternative: Sites.Selected

The theoretically narrower model is `Sites.Selected` with an explicit grant to the specific SharePoint site that hosts the CG OneDrive library. However:

1. **OneDrive for Business sites are per-user.** Each user has their own SharePoint site (`{tenant}.sharepoint.com/personal/{user}`). To target a shared library, you must know the exact site URL.
2. **Sites.Selected grant requires an additional API call** (`POST /admin/permissions/{id}/resourceAccess`) to grant the app access to a specific site.
3. **Folder-level scoping is still not supported.** `Sites.Selected` grants access to an entire site, not a specific folder within it.
4. **The shared drive mapping** (`client_onboarding_drive_mapping`) resolves to a specific drive + folder at runtime, but the Graph permission itself covers the entire site.

**Recommendation for future:** When CG Dynamics migrates to a dedicated SharePoint document library (not personal OneDrive), adopt `Sites.Selected` scoped to that library site. Until then, `Files.ReadWrite.All` with the fail-closed runtime gates is the narrowest operationally valid model.

## Runtime safeguards

1. **Dedicated app credentials** — the onboarding upload app is separate from the transition sync connector. Compromise of one does not affect the other.
2. **Drive mapping table** — `client_onboarding_drive_mapping` must have an `active=true` row for the exact client and upload category before any upload session is created.
3. **File validation** — category-specific extension allowlists, blocked executable extensions, a 50 MB limit, and a MIME type allowlist.
4. **Verification after upload** — `verifyDriveItem` fetches the exact final DriveItem and confirms its parent drive/folder and byte size before marking the upload as `received`.
5. **No write-back to Outlook/Microsoft** — the onboarding adapter writes only to OneDrive. No other Microsoft APIs are modified.

## What this adapter does NOT do

- Does not read Outlook mail, calendar, or contacts
- Does not modify any file other than the specific uploaded brand asset
- Does not grant or modify permissions on the OneDrive drive
- Does not access any client's personal OneDrive — uploads target only the exact CG-managed client/category folders mapped via `client_onboarding_drive_mapping`

## Re-audit date

This document was re-audited on 2026-09-02 against the current Microsoft Graph API documentation. Next re-audit is recommended when the upload adapter changes or when CG Dynamics migrates to a dedicated SharePoint document library.
