# OneDrive Production Mapping — Least-Privilege Permission Decision (Issue #225)

**Status:** Proposal (not applied to production)
**Date:** 2026-09-08
**Related:** Issue #225, #224 (Content Run), #219 (Content workflow)

---

## Goal

Establish the narrowest valid Microsoft Graph application permission model that covers the **exact CG Production House OneDrive for Business "Clients" tree** and the required CG Dynamics operations:

- Durable Graph drive/item ID resolution for `Clients` root + per-client `Videos` folders
- Read/list folder contents (inventory, naming drift detection)
- Explicit future canonical folder creation (year/month/video folders) **on explicit staff action only**
- No tenant-wide access; no delegated OAuth; no rename/move/delete without explicit approval

---

## Environment Context (Verified)

- **Account:** `info@cgproductionhouse.com` (personal OneDrive for Business)
- **Tenant:** `cgproductionhouse.com` → **Managed Microsoft Entra ID tenant** (not consumer MSA)
- **Tenant ID:** `7268f625-c8e9-42b9-b51e-60d4aa926f2d` (region AF; `NameSpaceType: Managed`)
- **OneDrive Path:** `/personal/a2ac9fe4b255f52f/Documents/Clients` (drive path)
- **Current App Model:** Client credentials (application-only), `scope=.default`, **no redirect URI**, no interactive login
- **Existing Connector:** `microsoft-transition-sync` (read-only, separate `MICROSOFT_*` env vars) — **must not be modified**

---

## Required Operations (App-Only)

| Operation | Graph Endpoint | Purpose |
|-----------|----------------|---------|
| Resolve `Clients` root folder | `GET /drives/{driveId}/root:/Clients` | Get durable `driveId` + `client_folder_item_id` |
| List client folders under `Clients` | `GET /drives/{driveId}/items/{clientFolderId}/children` | Inventory 86 folders, match to 55 active clients |
| Resolve per-client `Videos` folder | `GET /drives/{driveId}/items/{clientFolderId}/children` (filter `name='Videos'`) | Get `videos_folder_item_id` |
| List year/month folders | `GET /drives/{driveId}/items/{videosFolderId}/children` | Naming drift detection, inventory |
| Create future year/month/video folder | `POST /drives/{driveId}/items/{parentId}/children` (folder facet) | Explicit staff action only |
| Deep link (`webUrl`) | Returned by above calls | `Open production folder` button |

---

## Permission Models Evaluated (Least-Privilege First)

### 1. PREFERRED — `Files.SelectedOperations.Selected` (Application) + `write` role on `Clients` folder

**Verification against Microsoft Graph v1.0 docs (2026-09-08):**

- ✅ **GA in Graph v1.0** — `Files.SelectedOperations.Selected` is Generally Available
- ✅ **Supports application (app-only) mode** — `POST /drives/{driveId}/items/{itemId}/permissions` with `grantedToIdentities:[{application:{id}}]`
- ✅ **Granted per resource** — One grant on the `Clients` folder `driveItem`; **inherits to descendants** (folder grant covers entire production tree)
- ✅ **Meets every #225 need** with no tenant-wide access:
  - App-only ✓
  - This exact personal site ✓
  - Read/write the `Clients` tree ✓
  - Durable drive/item ID resolution ✓
  - List folders/files ✓
  - Create future canonical folders on explicit request ✓

**Setup Note (one-time admin action):**
Creating the grant requires a high permission on the parent (`Sites.FullControl.All`, or `Sites.Selected` + `FullControl`/`Owner` on the site). The **runtime app only ever holds `Files.SelectedOperations.Selected`**.

**Honest Caveats (to prove at grant time):**
- MS docs are file-centric with an open Q&A on folder→descendant inheritance edges
- OneDrive-for-Business **personal-site** app-only folder grants + `createUploadSession` on descendants should be validated during setup
- Granting `Selected` **breaks inheritance** on that folder (unique-scope limits — negligible for one folder)

**Grant API:**
```http
POST /drives/{driveId}/items/{clientsFolderItemId}/permissions
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "roles": ["write"],
  "grantedToIdentities": [{ "application": { "id": "<onboarding_app_client_id>" } }]
}
```

---

### 2. FALLBACK — `Sites.Selected` (Application) on this personal OneDrive site only

- **Site:** `.../personal/a2ac9fe4b255f52f` (the exact personal OneDrive site)
- ✅ Well-trodden GA app-only path; definitely works on a personal site
- ✅ Scopes to `info@`'s OneDrive only
- ⚠️ Grants entire site access (not folder-scoped), but still narrower than tenant-wide
- Use if **folder-level Selected proves insufficient on the personal site**

---

### 3. LAST RESORT — `Files.ReadWrite.All` (Application)

- ❌ Tenant-wide; what the current onboarding upload adapter/docs assume
- Recommend **ONLY if neither Selected model supports the required app-only ops here**
- **Must document the exact Graph limitation first**

---

## Code Impact: **None to Token Logic**

All three models keep:
- `client_credentials` flow
- `scope=https://graph.microsoft.com/.default`
- `ONBOARDING_MS_TENANT_ID`, `ONBOARDING_MS_CLIENT_ID`, `ONBOARDING_MS_CLIENT_SECRET`

Only the **consented permission** (and for Selected, the one-time per-resource grant) changes.
`createUploadSession` / `verifyDriveItem` / `downloadFile` / `createFolder` operate under whatever the token grants.

---

## Additive Schema (Proposal-Only — Branch `feat/225-onedrive-mapping`)

**File:** `supabase/migrations/20260908130000_client_onedrive_production_mapping.sql`

| Table / Column | Purpose |
|----------------|---------|
| `clients.short_code` | Nullable, unique-when-set, manager-assigned (e.g., `ECONO`). Used **only to derive expected future names**, never to fuzzy-match existing folders. |
| `client_onedrive_mappings` | One per active client: `drive_id`, `client_folder_item_id`, `videos_folder_item_id`, `web_url`, `folder_name` (display/audit only), `mapped_by/at`, `last_verified_at`. `unique(client_id)`. |
| `content_run_onedrive_folders` | Per Content Run durable month/shoot folder itemId (#224/#225). |

**Security:**
- RLS enabled on both tables
- `revoke all from anon, authenticated`
- Service-role/Edge Function access via security-definer helpers (`get_client_onedrive_mapping`, `get_content_run_onedrive_folder`)
- Admin-only write helpers (`upsert_client_onedrive_mapping`, `upsert_content_run_onedrive_folder`)

**No fuzzy runtime matching. No rename/move/delete logic. No duplicate file store.**

---

## ⛔ Unchanged Gate (Now Narrower in Scope)

Resolving the real durable Graph IDs still needs an authenticated app token → requires:

1. **Register** the dedicated single-tenant Entra app in tenant `7268f625-…` (no redirect URI)
2. **Consent** the chosen **Selected** permission (`Files.SelectedOperations.Selected` recommended)
3. **Perform the one-time folder grant** on the `Clients` folder `driveItem` (admin action)
4. **Create one client secret** and write `ONBOARDING_MS_*` + `CLIENT_ONBOARDING_UPLOADS_ENABLED=true` into the `client-onboarding` Edge Function env (production secrets)

**Not yet done:**
- No app registered
- No consent granted
- No folder grant performed
- No secret created
- No production SQL applied
- No OneDrive content changed
- Meta #240 / Google #270 / TikTok #273 / client-intelligence worktrees untouched

---

## To Proceed

**Confirm which permission model** (recommend **Option 1: `Files.SelectedOperations.Selected` (write) on `Clients`**) **and** whether you'll:

- Register the app + secret yourself (hand me the three env values), **or**
- Authorise me to prepare the registration up to the secret/consent/grant step

On authorisation, I will:
1. Resolve the real `driveId` + `Clients` folder `itemId`
2. Populate durable IDs for the 55 active clients
3. Confirm the 7 missing + 1 ambiguous client folders
4. Produce the proposal-only cleanup mapping
5. **Still no rename/move/delete without a further explicit approval**

---

## References

- Microsoft Graph `Files.SelectedOperations.Selected` docs: `https://learn.microsoft.com/en-us/graph/permissions-reference#files-selectedoperations-selected`
- Microsoft Graph `driveItem` permissions API: `https://learn.microsoft.com/en-us/graph/api/driveitem-post-permissions`
- OneDrive for Business personal site structure: `https://learn.microsoft.com/en-us/onedrive/developer/rest-api/concepts/special-folders-app`