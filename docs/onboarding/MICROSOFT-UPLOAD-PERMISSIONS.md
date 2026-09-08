# Microsoft Graph Upload Permission Model — Client Onboarding

This document is the canonical audit record for the narrowest valid Microsoft Graph permission model used by the client onboarding upload adapter.

## Current model: fail-closed, dedicated app, environment-gated

| Gate | Status | Notes |
|------|--------|-------|
| Dedicated Microsoft app | Required | Separate from the read-only transition sync connector |
| Environment credentials | Required | `ONBOARDING_MS_TENANT_ID`, `ONBOARDING_MS_CLIENT_ID`, `ONBOARDING_MS_CLIENT_SECRET` |
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

**Required application permission:** `Files.ReadWrite.All` (application, not delegated) — *current production assumption; see least-privilege analysis below*

### DriveItem verification

```
GET /drives/{driveId}/items/{itemId}
```

**Required application permission:** `Files.ReadWrite.All` (application, not delegated) — *current production assumption; see least-privilege analysis below*

### File download (server-mediated proxy)

```
GET /drives/{driveId}/items/{itemId}
GET /drives/{driveId}/items/{itemId}/content
```

**Required application permission:** `Files.ReadWrite.All` (application, not delegated) — *current production assumption; see least-privilege analysis below*

## Least-privilege analysis (independently verified 2026-09-08)

Microsoft Graph now supports **Selected-permissions scopes in application (app-only) mode** per the official documentation (updated 2024-11-07, confirmed 2026-02-26). The three relevant scopes are:

| Scope | Level | App-only support | Inheritance |
|-------|-------|------------------|-------------|
| `Sites.Selected` | Site collection | Yes | Site → child sites |
| `Lists.SelectedOperations.Selected` | List/library | Yes | List → items |
| `Files.SelectedOperations.Selected` | File or library folder | Yes | Folder → descendant files |
| `ListItems.SelectedOperations.Selected` | List item / folder | Yes | Item → children |

**Key official statement:** *"Now, lists, list items, folders, and files are also supported, and all Selected scopes now support delegated and application modes."* (Microsoft Graph docs, permissions-selected-overview)

### Option 1 — PREFERRED: `Files.SelectedOperations.Selected` (application) with `write` role on the `Clients` folder driveItem

- **GA in Graph v1.0**; supports application (app-only) mode.
- Grant via `POST /drives/{driveId}/items/{clientsFolderItemId}/permissions` with `roles:["write"]`, `grantedToIdentities:[{application:{id}}]`.
- The grant on the `Clients` folder **inherits to descendants** (all client subfolders, Videos, year, month, shoot folders).
- Meets every #225 requirement with no tenant-wide access:
  - App-only ✓
  - This exact personal site ✓
  - Read/write the `Clients` tree ✓
  - Durable drive/item ID resolution ✓
  - List folders/files ✓
  - Create future canonical folders on explicit request ✓
  - Create upload sessions (write operation on folder) ✓
- **Setup caveat (one-time admin action):** Creating the grant requires `Sites.FullControl.All` or `Sites.Selected`+`FullControl`/`Owner` on the parent site. The **runtime app only ever holds `Files.SelectedOperations.Selected`**.
- **Honest limitations to prove at grant time:**
  - MS docs are file-centric with an open Q&A on folder→descendant inheritance edges.
  - OneDrive-for-Business **personal-site** app-only folder grants + `createUploadSession` on descendants should be validated during setup.
  - Granting Selected **breaks inheritance** on that folder (unique-scope limits — negligible for one folder).
  - The `createUploadSession` API reference currently only documents `Sites.ReadWrite.All` for application permissions; `Files.SelectedOperations.Selected` is newer and the API docs may not yet reflect it. Runtime testing required.

### Option 2 — FALLBACK: `Sites.Selected` (application) on the personal OneDrive site only

- Well-trodden GA app-only path; definitely works on a personal site.
- Scopes to `info@cgproductionhouse.com`'s OneDrive only (`.../personal/a2ac9fe4b255f52f`).
- Grants access to the entire personal site (all libraries, not just `Clients`).
- Use if folder-level Selected proves insufficient on the personal site.

### Option 3 — LAST RESORT: `Files.ReadWrite.All` (application)

- Tenant-wide; what the current adapter/docs assume.
- Recommend **ONLY if neither Selected model supports the required app-only ops here**, and document the exact Graph limitation first.
- Current production reality for any daemon app accessing OneDrive for Business without Selected permissions.

**Code impact: none to token logic** — all three keep `client_credentials` + `.default`; only the consented permission (and, for Selected, the one-time per-resource grant) changes. `createUploadSession`/`verifyDriveItem`/`downloadFile` operate under whatever the token grants.

## Why the current model uses Files.ReadWrite.All (historical context)

When the onboarding adapter was implemented (2026-09-02), the Selected-permissions model for application mode was either not GA or not widely documented for OneDrive for Business personal sites. The documentation at that time stated: *"Microsoft Graph does not offer folder-scoped application permissions for OneDrive for Business."* This has since changed.

## Runtime safeguards (unchanged)

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

This document was re-audited on **2026-09-08** against the current Microsoft Graph API documentation (permissions-selected-overview, updated 2026-02-26). The least-privilege recommendation has been updated from `Sites.Selected` to `Files.SelectedOperations.Selected` as the preferred model. Next re-audit is recommended when the upload adapter changes, when CG Dynamics migrates to a dedicated SharePoint document library, or when the Selected-permissions GA status for personal-site app-only folder grants is confirmed in production.