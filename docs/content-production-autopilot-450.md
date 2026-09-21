# Content Production Autopilot (#450)

CG Dynamics should already hold a prepared content plan before staff ask for one. Staff review and
adjust; they do not discover missing runs, create blank guidelines, or guess whether footage is in.

This extends the existing content chain. There is no second Content Guideline system, no second
file tracker, no second portal and no second schedule authority.

## Phase 1 — the canonical chain as it stands

| Step | Authority that already implements it | State |
|---|---|---|
| client → package → `monthly_deliverables` | Client Schedule (`/admin/client-schedule`), `src/lib/planner.ts` | complete — read-only here |
| Outlook/CG Calendar event → Content Run | `sync_microsoft_content_run_event()` trigger (`20260725211500`) mirrors `company_calendar_events` rows typed `content_run` into `content_runs`, keyed on `calendar_event_id` | complete for events already reviewed into Dynamics; **gap:** nothing ensures the guideline, and nothing reports a client with no future run |
| Content Run → one Content Guideline | `get_or_create_content_guideline(p_run_id)`, `content_guidelines` unique per run | complete, but **only runs when a human opens the editor** — the Econofoods 23 Sep gap |
| Guideline → ordered videos | `content_guide_ideas` + `reorder_content_guideline_videos` (rewrites `position` and `video_number` 1…n) | complete |
| Video ↔ real deliverable | `content_guide_ideas.deliverable_id`, `validate_content_guideline_deliverable_link()`, unique active index | complete; **gap:** nothing expresses *unallocated* as a first-class truthful state |
| Draft ideas / scripts | `suggest-content-videos` (`ideas` / `develop`), `src/lib/contentWorkflow.ts` (`planGuidelineVideoIdeas`, `developGuidelineVideos`) | complete, but **staff-triggered only**; never prepared ahead |
| Run → OneDrive month folder | `content_run_onedrive_folders` + `content-run-onedrive-folder` Edge Function | complete (admin-gated, create-only) |
| Video → canonical production folder | `buildVideoFolderName()` exists in `src/lib/onedriveCanonical.ts` | **missing** — no durable per-video mapping is stored anywhere |
| Raw upload verification | `content_run_closeouts.upload_status` (`verified`/`missing`/`partial`/`unverified`) + `update_closeout_upload_status` | complete **at run level**; nothing derives a per-video answer |
| Edit readiness | `src/lib/videoPipelineRules.ts` production statuses | partial — status is staff-set; nothing combines mapping + upload evidence into one answer |
| Client-portal final output | `client_portal_libraries` → `client_portal_library_categories` (`video`) → `client_portal_assets` | complete; **gap:** a guideline video has no link to its published final asset |
| Assistant (ChatGPT) content actions | `cg-dynamics-mcp` exposes `find_content_runs`, `link_content_run_deliverables`, `get_content_run_plan`, closeout tools | **gap:** no ensure-guideline, no video add/update/reorder, no generation, no readiness — this is why live Econofoods work fell back to the backend |

### Naming drift, named

`src/lib/videoPipelineRules.ts` exposes `deriveClientCode(clientName)`, which infers a code from the
client **display name**. That is the source of the legacy folder drift. `docs/onedrive-naming-authority.md`
is the authority: the code is **configured data** (`clients.short_code`), never inferred.

The autopilot therefore uses `clients.short_code` only and blocks with `BLOCKED_MISSING_SHORT_CODE`
rather than guessing. The legacy helper is left in place for the existing Video Pipeline surface; it
is not used by anything in this lane.

## Derived truth (Phase 6)

Two deterministic derivations, both pure and unit-tested in `src/lib/contentAutopilot.ts`.

**Raw evidence** — `UNVERIFIED | MISSING | PARTIAL | VERIFIED`.
Missing provider access, an unmapped folder or no closeout is **`UNVERIFIED`**, never `MISSING`.
`MISSING` is only ever asserted from readable, mapped, verified-negative evidence.

**Edit readiness** — `BLOCKED_NO_MAPPING | BLOCKED_RAW_MISSING | RAW_UNVERIFIED | RAW_PARTIAL |
READY_TO_EDIT | IN_EDIT | IN_REVIEW | FINAL_READY`.
`RAW_UNVERIFIED` is added to the issue's minimum list deliberately: without it, unverified evidence
would have to be reported as `BLOCKED_RAW_MISSING`, which would state as fact something nobody has
checked. Once real work has started, the staff-set production status wins (`IN_EDIT`, `IN_REVIEW`,
`FINAL_READY`) — the autopilot never drags a video backwards out of a state a human put it in.

Every readiness answer carries a `reason` and a `nextAction` so the UI and the Assistant say the
same sentence.

## Canonical destinations (Phase 5)

Internal production folder, one per saved guideline video:

```
Clients/<Client>/Videos/<YYYY>/<YYYY_MM_MON>/<YYYY_MM_<SHORT_CODE>_VIDEO_<XX>>
```

- built only by `buildVideoFolderName()` from configured `short_code` + the run's canonical month +
  the video's 1-based position;
- `BLOCKED_MISSING_SHORT_CODE` when the client has no configured code;
- `BLOCKED_MISSING_ONEDRIVE_MAPPING` when the client or run folder is not mapped;
- creation is create-only (`conflictBehavior: fail`), idempotent, and durable `driveId`/`itemId`
  become the identity immediately afterwards;
- a legacy folder is **mapped by durable id**, never renamed, moved or deleted.

Client-facing final output reuses the existing Client Portal Library authority
(`A_ClientPortal_<ClientSlug>/Video` → `client_portal_assets`). A video resolves its final output
through the portal `video` category and, where present, its own deliverable link. Internal raw
folders are never exposed to a client, and no raw Graph id or URL appears in staff or client text.

## Autopilot cycle (Phase 8)

One idempotent job type, `content_autopilot`, on the **existing** `background_jobs` /
`background-worker` engine — not a new scheduler and not a hard-coded clock time.

Per active client with an upcoming real Content Run: ensure the run mirror → ensure the canonical
guideline → prepare draft-only AI content where safe → resolve real deliverable links → resolve
canonical production/final destinations where mapping exists → verify raw/final evidence → derive
edit readiness → record the last successful pass and its blockers.

Never: create a run, rewrite `monthly_deliverables`, overwrite a human field, publish, rename, move
or delete a file, or expose raw media to a client. A client with no upcoming run reports
`NO_FUTURE_CONTENT_RUN` — it never gets an invented shoot date.

**What the background pass deliberately does not do yet.** It ensures the guideline and computes
what should be generated, but it does not itself call the AI Content Director. Generation stays
explicitly triggered — by staff in the editor, or by the Assistant's
`generate_content_guideline_drafts` — until CA approves automatic AI writes on the cycle. That is a
separate gate below, not an oversight: the pass would otherwise write AI drafts across every active
client the first time it ran.

## What must never happen here

- writing `monthly_deliverables` from this flow;
- a second guideline, portal, scheduler or file tracker;
- overwriting a human-edited field, or touching an `approved`/`published` guideline;
- inferring a client short code from a display name or folder name;
- reporting unreadable or unmapped evidence as "no files";
- automatic publication or client-visible approval.

## Gates (Phase 10)

| Capability | Gate |
|---|---|
| Per-video folder mapping, autopilot state | Apply `20260921090000_content_production_autopilot.sql` (CA approval) |
| Per-video folder creation in OneDrive | #225 rollout: app registration, secrets, `onedrive-oauth-*` deploy, one-time consent — production currently stores 0 tokens |
| Assistant content actions live | Deploy `cg-dynamics-mcp` (CA approval), then refresh the ChatGPT connector action list |
| Prepared draft generation live | Deploy `suggest-content-videos`; a web-grounded provider key for real research |
| Autopilot running on the cycle | Deploy `background-worker` and enqueue `content_autopilot` on the existing cycle |
| Automatic AI draft generation on the cycle | CA decision: today the pass prepares and reports; it never calls the AI Content Director by itself |
| Econofoods live acceptance | Configure the Econofoods `short_code`, map its client folder and the 23 Sep run month folder — all CA/admin actions |
