# OneDrive Production Mapping — Issue #225 (Proposal Only)

**Status:** Proposal-only additive migration. **NOT applied to production.**
**Blocked on:** Dedicated Microsoft app registration + `Files.SelectedOperations.Selected` grant on `Clients` folder + CA approval.

---

## Context

CG Production House stores client production media in a personal OneDrive for Business library at:
```
/personal/a2ac9fe4b255f52f/Documents/Clients
```
(Drive path confirmed via Graph: `driveId` = `b!<...>`, `Clients` folder `itemId` = `01<...>`)

Canonical structure (CA-confirmed 2026-09-07):
```
Clients / <Client> / Videos / <YYYY> / <YYYY_MM_MON> / <YYYY_MM_CLIENT_VIDEO_XX>
```
Example: `Clients / ECONO / Videos / 2025 / 2025_08_AUG / 2025_08_ECONO_VIDEO_02`

**Problem:** Naming drift exists (e.g., `2026_03_MRT` Afrikaans, `2026_09_SEPT` 4-char, leaf folders like `VIDEO 1`/`VIDEO 4_30 YEARS` without canonical prefix). The resolver must **list actual `Videos` children via Graph and match by durable item ID**, never generate a name and assume it exists.

---

## Data Model (Additive, No Second File Store)

### 1. `clients.short_code`
- Nullable, unique-when-set, `^[A-Z0-9]{2,16}$`
- Manager-assigned (e.g., `ECONO`, `BLOEM`, `TOYOTA`)
- Used **only to derive expected future names** (e.g., `2026_08_ECONO_VIDEO_01`)
- **Never used for fuzzy-matching existing folders at runtime**

### 2. `client_onedrive_mappings` (one per active client)
| Column | Purpose |
|--------|---------|
| `client_id` (PK, FK→clients) | Exact client identity |
| `drive_id` | Durable Graph drive ID |
| `client_folder_item_id` | `Clients/<Client>` folder item ID |
| `videos_folder_item_id` | `Clients/<Client>/Videos` folder item ID |
| `web_url` | Deep link to `Videos` folder |
| `folder_name` | Display/audit only (the `<Client>` folder name as seen in OneDrive) |
| `mapped_by` / `mapped_at` | Audit trail |
| `last_verified_at` | Periodic re-verification timestamp |

**RLS:** Service-role/Edge Function only. Revoked from `anon`, `authenticated`.

### 3. `content_run_onedrive_folders` (per Content Run, refs #224/#225)
| Column | Purpose |
|--------|---------|
| `content_run_id` (FK→content_runs) | Links to the Content Run |
| `month_folder_item_id` | Durable item ID for `Videos/<YYYY_MM_MON>` |
| `month_folder_web_url` | Deep link to month folder |
| `shoot_folder_item_id` | Durable item ID for `Videos/<YYYY_MM_MON>/<YYYY_MM_CLIENT_VIDEO_XX>` (nullable) |
| `shoot_folder_web_url` | Deep link to shoot folder (nullable) |
| `resolved_at` / `resolved_by` | Audit trail |

---

## Behaviour When Built

1. **Map once per active client** (admin action):
   - Resolve `Clients/<Client>` folder by **listing** `Clients` children and matching exact folder name (case-insensitive) → get durable `itemId`.
   - Resolve `Videos` subfolder similarly.
   - Store both `itemId`s + `driveId` + `web_url` in `client_onedrive_mappings`.
   - No rename/move/delete. Historical exceptions left untouched.

2. **Content Run → month folder** (on run creation or first open):
   - List `Videos` children via Graph.
   - Match expected `YYYY_MM_MON` pattern against actual folder names.
   - If found: store durable `month_folder_item_id`.
   - If not found: **flag as missing** in UI; create only on explicit staff action (`Create production folder`).

3. **Open production folder** (staff action):
   - Uses stored `web_url` (deep link) → opens exact OneDrive folder in browser.
   - No path construction, no guessing.

4. **Naming drift flagging** (UI):
   - Compare actual folder names under `Videos` against canonical pattern.
   - Show `⚠ drift` badge; never auto-rename.

5. **Future folder creation** (explicit staff action only):
   - Derive canonical name from `client.short_code` + current year/month + sequence.
   - Create folder via Graph under the mapped `Videos` folder.
   - Store new durable `itemId` in `content_run_onedrive_folders`.
   - Never rename/move existing folders.

---

## Active Client Reconciliation (from read-only inventory, 2026-09-08)

| Category | Count | Examples |
|----------|-------|----------|
| Exact match | ~28 | `ECONO`, `Bloem Marble & Granite` (folder: `Bloem Marble`) |
| Name drift (high/medium confidence) | ~20 | `Bloem Vascular`→`BloemVascular`, `Daisy & Co`→`Daizy & Co`, `Ehrlich Park Butchery`→`Ehlrich Park Slaghuis`, `Econofoods`→`ECONO`, `Kundedienste`→`Kundendienst`, `RC-Polypipe`→`RC Polypipe` |
| Ambiguous | 1 | `Toyota Bloemfontein` ↔ `Toyota` + `Toyota Rondebosch` |
| Missing folder for active client | 7 | Agri-Secure, Ipopeng Office Supplies, Mimosa Mall, Rusoord Farmstay, Supa Quick BFN, Supa Quick Centurion, WiseRide |
| Inactive/former/template folders (no active client) | ~30 | `AA_CLIENT_TEMPLATE_FOLDER`, `Brocor` (85 items), `Dignitas`, `NCNA`, `RZ Plant Hire` |

**Full 86-row inventory + 55-row mapping table with confidence/reasons held locally.** Ready to populate `client_onedrive_mappings` once durable IDs are resolved via Graph.

---

## Auth / Permission Gate (Unchanged — Still Required)

To resolve durable Graph `driveId` + `itemId`s, an authenticated app token is required:

1. **Register** dedicated Entra app in tenant `7268f625-c8e9-42b9-b51e-60d4aa926f2d` (single-tenant, no redirect URI).
2. **Consent** chosen Selected permission (recommend Option 1: `Files.SelectedOperations.Selected` application).
3. **One-time folder grant** (admin action): `POST /drives/{driveId}/items/{clientsFolderItemId}/permissions` with `roles:["write"]`, `grantedToIdentities:[{application:{id}}]`.
4. **Create client secret** and write `ONBOARDING_MS_*` + `CLIENT_ONBOARDING_UPLOADS_ENABLED=true` to `client-onboarding` Edge Function env (production secrets).

**Nothing has been done yet:** no app, no consent, no grant, no secret, no production SQL, no OneDrive changes.

---

## Migration File

`supabase/migrations/20260908130000_client_onedrive_production_mapping.sql` — proposal-only, staged for review.

---

## Non-Goals (Explicitly Out of Scope)

- ❌ No automatic rename/move/delete of existing OneDrive content.
- ❌ No fuzzy runtime matching (exact `client_id` → exact `itemId` only).
- ❌ No duplicate media storage (Dynamics stores references only).
- ❌ No changes to `client_onboarding_drive_mapping` (that table is for onboarding uploads: logo/services/optional).
- ❌ No Meta #240, Google #270, TikTok #273, onboarding implementation, or client-intelligence work.
- ❌ No production SQL execution without explicit CA approval.

---

## Next Steps (Awaiting CA Decision)

1. **Confirm permission model:** Option 1 (`Files.SelectedOperations.Selected` on `Clients` folder) recommended.
2. **Decide app registration:** CA registers + hands over `tenantId`/`clientId`/`secret`, OR authorise agent to prepare registration up to secret/consent/grant step.
3. **On authorisation:** Resolve real `driveId` + `Clients` folder `itemId`, populate durable IDs for 55 active clients, confirm 7 missing + 1 ambiguous, produce proposal-only cleanup mapping.
4. **CA approves cleanup plan** → separate explicit approval for any rename/move operations.
5. **Apply migration** → build UI for mapping, drift flagging, folder creation, deep links.