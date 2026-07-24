# Microsoft 365 Import Map

Architecture contract for the temporary one-way Microsoft transition sync into
CG Dynamics. During the coexistence window Microsoft is the upstream source for
configured Outlook and Planner sources; CG Dynamics is where staff see and
execute the reconciled work. Microsoft is never modified.

## Architecture decision (ratified)

**Temporary one-way transition sync.** For roughly one to two months the app
supports repeat preview-first reconciliation. It is not permanent two-way
integration and can be paused or completed cleanly. Consequences:

- The normal admin flow calls the `microsoft-transition-sync` Edge Function.
  App-only Microsoft credentials stay in Supabase secrets and never reach the
  browser, database business rows, logs or snapshots.
- Configured sources are allowlisted in `MICROSOFT_SYNC_SOURCES_JSON`. The
  function fetches every Planner source with pagination and a bounded Outlook
  range with immutable event IDs.
- Connected agents may provide the same normalized version 2 snapshot through
  the advanced transport. Both triggers use the same reconciliation engine.
- `active`, `paused` and `complete` lifecycle states ensure Microsoft does not
  become a hidden dependency after transition.

## Snapshot file contract

The upload accepted by `/admin/microsoft-import` (parsed and strictly
validated by `src/lib/microsoftSnapshot.ts`):

```json
{
  "format": "cg-dynamics-microsoft-snapshot",
  "version": 2,
  "exportedAt": "2026-07-14T09:00:00Z",
  "exportedBy": "CG Dynamics Microsoft transition sync",
  "triggerType": "admin",
  "plannerCompletedCutoff": "2026-07-01",
  "sources": [{
    "sourceType": "planner_plan", "sourceId": "...", "sourceName": "To Do",
    "complete": true, "rangeStart": null, "rangeEnd": null,
    "recordCount": 1, "safeError": null
  }],
  "records": [
    {
      "sourceType": "outlook_event",
      "sourceCalendarId": "...", "sourceEventId": "...",
      "title": "...", "safeSummary": null,
      "startDate": "2026-07-15T09:00:00+02:00", "endDate": null,
      "allDay": false, "location": null, "cancelled": false,
      "assigneeMicrosoftIds": []
    },
    {
      "sourceType": "planner_task",
      "sourcePlanId": "...", "sourcePlanName": "To Do",
      "sourceBucketId": "...", "sourceBucketName": "ADMIN / TO DO",
      "sourceTaskId": "...", "title": "...", "description": null,
      "startDate": null, "dueDate": "2026-07-20",
      "completedDate": null, "assigneeMicrosoftIds": [], "percentComplete": 0
    }
  ]
}
```

Rules: Outlook event IDs must be fetched with `Prefer: IdType="ImmutableId"`;
Outlook dates keep their timezone offsets; Planner dates are plain
`YYYY-MM-DD`; `exportedAt` becomes `microsoft_last_synced_at` on applied rows.
Version 2 snapshots may include a valid `plannerCompletedCutoff` (`YYYY-MM-DD`)
to exclude unlinked operational tasks completed before that date. Existing
version 2 connected-agent snapshots without it remain valid and do not apply a
historical completion filter.
The snapshot carries titles, dates, IDs and notes only — never tokens or
credentials. Every source declares completeness and record count. Version 1
snapshots remain readable but are always incomplete and can never prove source
removal. Structural errors reject the whole file; content problems (blank
IDs, unknown plans, unmatched clients) become preview conflicts instead.

## Product boundaries

| Microsoft source | CG Dynamics destination | Source of truth |
|---|---|---|
| Outlook operational calendar | CG Calendar | `company_calendar_events` |
| Planner operational plans | Planner / My Day | `planner_tasks` |
| Planner monthly client socials plans | Client Schedule | `monthly_deliverables` |

CG Calendar remains the company calendar for meetings, shoots, content runs,
client events, deadlines and internal events. Client Schedule posts and package
items never import into CG Calendar.

Planner and Client Schedule remain separate systems. An imported Planner task
must never create a parallel copy of a monthly deliverable unless the preview
explicitly classifies the source plan as a Client Schedule plan.

## Planner plan mapping

| Planner plan | Destination | Mapping rule |
|---|---|---|
| `To Do` | Planner board `operations-todo` | Operational tasks and recurring admin work. Appears in Planner, Daily Tasks and My Day when dated/assigned. |
| `MASTER CLIENT TO DO` | Planner | Client work backlog. Preserve real client bucket names, but require review before linking a `client_id`. |
| `CG Socials` | Planner board `cg-socials` | Internal CG content work. It is not a client package schedule and is not a CG Calendar event. |
| `Client Socials - <Month Year>` | Client Schedule | Monthly client content cards map to `monthly_deliverables` for the month in the plan name. |
| Unknown plan | Review only | No destination is assumed and no row may be pre-approved. |

Historical exports such as `2025 CLIENTS SCHEDULE` use the same Client Schedule
path. Existing import hashes and current package/template logic remain valid;
the new architecture must not create a second schedule table.

## Planner bucket mapping

The `To Do` plan uses these canonical operational buckets:

| Microsoft bucket | CG Planner bucket |
|---|---|
| `ONCE-OFF` | `Once-off` |
| `CONTENT GUIDES` | `Content Guides` |
| `WEBSITES` | `Websites` |
| `ADMIN / TO DO` | `Admin / To Do` |
| `GRAPHIC DESIGN` | `Graphic Design` |
| `CLIENT REQUESTS` | `Client Requests` |
| `CG ADMIN - RECURRING` | `Recurring` |

For `MASTER CLIENT TO DO` and monthly Client Socials plans, buckets are expected
to be human client names. The importer may propose a normalized exact match to
an active `clients.name`, but it must show that match in preview and only save
the `client_id` after explicit approval. It must never guess a UUID or use a raw
Planner bucket ID as a client/bucket name.

Planner titles and descriptions that appear to contain confidential finance,
payroll, banking, identity-number or private HR information are never proposed
for a staff-visible destination. They remain in the admin preview as a
`restricted_content` conflict for private review.

Unknown readable bucket names may be proposed as new Planner buckets. Raw IDs,
blank values and unresolved lookup values are conflicts and cannot be
pre-approved.

## Planner task mapping

| Microsoft field | Planner field |
|---|---|
| task `id` | `microsoft_task_id` and existing `original_task_id` where applicable |
| plan `id` | `microsoft_plan_id` |
| bucket `id` | `microsoft_bucket_id` |
| plan title | `original_plan_name` |
| bucket name | `original_bucket_name` and resolved `bucket_id` |
| title | `title` |
| start date | `start_date` |
| due date | `due_date` |
| progress | `status` |
| priority/categories | `priority` after preview |
| description | `microsoft_source_description` (local `notes` remain CG-owned) |
| assignments | resolved profile/name fields after review |

Assignment keys from Microsoft are user IDs, not staff names. A future fetcher
must resolve IDs against Microsoft member/user data before preview. Unresolved
IDs remain unassigned with a warning; they must not be stored as display names.

Recurring templates map to the existing recurrence model. Template rows remain
hidden from active work and materialized instances remain protected by the
existing recurrence idempotency rules.

## Client Schedule mapping

Plans matching `Client Socials - <Month Year>` map only to
`monthly_deliverables` through a dedicated preview. The importer must:

1. Parse the month from the plan name and show it prominently.
2. Resolve each client bucket against active clients and flag unmatched or
   ambiguous names.
3. Map readable card codes/types such as DP, F, Video and Reel using existing
   package/template rules.
4. Show creates, unchanged rows and conflicts before any write.
5. Use `microsoft_plan_id`, `microsoft_bucket_id` and `microsoft_task_id` for
   source identity.
6. Never write to CG Calendar.

No client, package or UUID is auto-created from a guessed name. Missing package
or client setup is a preview warning requiring an admin decision.

## Outlook event mapping

Outlook operational events import to `company_calendar_events`:

| Outlook field | CG Calendar field |
|---|---|
| immutable event `id` | `microsoft_event_id` |
| source calendar ID | `microsoft_calendar_id` |
| subject | `title` |
| start date/time/time zone | `start_at` as ISO/timestamptz |
| end date/time/time zone | `end_at` as ISO/timestamptz |
| all-day flag | `all_day` |
| location display name | `location` |
| cancellation state | `status = cancelled` |
| non-private body preview | `microsoft_source_description` (local `notes` remain CG-owned) |

Event type is inferred conservatively from the subject:

- `CONTENT RUN` -> `content_run`
- `SHOOT` -> `shoot`
- `MEETING` -> `meeting`
- `DEADLINE` / `DUE` -> `deadline`
- `CLIENT EVENT` -> `client_event`
- otherwise -> `internal`

Examples such as `CONTENT RUN - WE AR FUELS`, `MEETING - CHENIQUE` and
`CONTENT RUN - TOYOTA` therefore appear as operational CG Calendar events.

The future Microsoft Graph fetcher must request Outlook immutable IDs with
`Prefer: IdType="ImmutableId"` on every relevant request. Calendar timestamps
must preserve the supplied time zone and be converted to ISO before saving so
South African local display remains correct. Attendees, private event bodies
and sensitivity metadata are not imported by default.

## Preview and apply flow

Every importer follows the same sequence:

1. Fetch or read an export without writing to Supabase.
2. Resolve plans, buckets, members, clients and dates.
3. Build a preview classified as `create`, `update`, `unchanged`, `conflict` or
   `skip`.
4. Classify create, update, unchanged, complete, reopen, move, cancel,
   archive/source-removed, conflict, skipped and failed actions.
5. Require an admin to approve writes and separately approve source removals.
6. Apply approved rows idempotently and record a run plus per-item results.
7. Refresh source pages so the new work is visible.

The transition implementation is repeatable and one-way. It does not write
back to Microsoft or make Microsoft a permanent Planner/Calendar dependency.

## Dedupe and conflict rules

- Planner: primary source key is `(microsoft_plan_id, microsoft_task_id)`.
- Outlook: primary source key is `(microsoft_calendar_id, microsoft_event_id)`.
- Client Schedule: primary source key is
  `(microsoft_plan_id, microsoft_task_id)` on `monthly_deliverables`.
- Existing Excel/CLI imports continue to use `import_hash`; source IDs augment
  that protection and do not invalidate old hashes.
- A repeated source key with identical mapped values is `unchanged`.
- A repeated source key with Microsoft changes and no newer CG edit is an
  explicit `update` preview.
- A row edited in CG Dynamics after `microsoft_last_synced_at` is a `conflict`.
- Title/date similarity without a source ID is only a warning, never proof of
  identity.
- Missing source IDs cannot be auto-updated; use the existing import hash when
  available or require manual review.
- A missing item becomes source-removed only when the matching source reports a
  complete successful fetch and, for Outlook, the existing event is inside the
  explicit fetch range. Removal requires separate approval and never hard-deletes.

## Source tracking requirements

The additive Phase 15a migration prepares nullable source fields on the three
destination tables. Existing rows remain valid. `microsoft_last_synced_at` is
set only when an approved import writes a row, never during preview.

No access token, refresh token, tenant secret, delta link or raw API response is
stored in these business tables. Future connector credentials belong in
server-side Supabase secrets only. Delta cursors, if introduced later, require a
separate admin-only design and security review.

## Roles and security

- Admin: configure mappings, review previews and apply imports.
- Manager: operational read/review only until explicit apply permission exists.
- Staff/team: consume imported work through Planner, My Day and CG Calendar;
  no connector setup or import apply.
- Client: no Microsoft import access and no internal Planner/Calendar data.
- All Microsoft API calls must be server-side. Client code never receives a
  Microsoft client secret, access token or refresh token.
- Finance, payroll, private HR content and confidential Outlook event content
  are excluded from this import architecture.

## Known risks

- Planner exports can expose internal IDs instead of names; all lookup sheets
  or Graph lookups must be processed before preview.
- Planner assignments require directory/member resolution and may not match CG
  profile names exactly.
- Outlook event IDs are mutable unless immutable IDs are requested consistently.
- Recurring Outlook events need occurrence-level identities and explicit
  cancellation handling.
- Time-zone conversion can shift events if the source zone is discarded.
- Client names can be ambiguous; normalized text matching must remain a
  proposal, not an automatic foreign-key write.
- Old rows may have only `import_hash` and no Microsoft source IDs; backfilling
  them is a separate reviewed operation.

## Implementation status

- Phase 15a exact source identities are live and remain canonical.
- Version 2 snapshot completeness, reusable reconciliation, server Graph fetch,
  transition lifecycle, progress and history UI are implemented on
  `feature/microsoft-transition-sync`.
- Phase 17a is live. Its tables, tracking fields, RLS, metadata triggers and
  admin-only apply RPC were verified on 2026-07-18; anonymous RPC execution was
  explicitly revoked by a tracked hardening migration.
- The `monthly_deliverables` natural key remains guarded and Client Socials
  never enter CG Calendar.
- The production Edge Function is deployed and rejects anonymous requests. The
  default operational Calendar and approved Planner plans (`To Do`, `MASTER
  CLIENT TO DO`, `CG Socials`, and `Client Socials - July 2026`) are verified
  readable through the connected Microsoft account. The read-only Entra app,
  Supabase secrets, authenticated fetch, first dry preview and reviewed apply
  remain outstanding. No Microsoft writes are part of this architecture.

## Deliverable reconciliation actions (phase-21a)

- **link_existing** — a source card links to a single unlinked legacy `monthly_deliverables` row on its exact slot (client/month/canonical type + instance); attaches `microsoft_plan_id/bucket_id/task_id` + source-owned fields; never overwrites CG-owned notes/assignments/helpers. Requires phase-21a (apply version 3).
- **package_template_create** — a unique unnumbered VIDEO/REEL against a single active package with no compatible template proposes a canonical `Video 1`/`Reel 1` template (only from a real source task; never inferred from totals).
- Unnumbered `VIDEO`/`REEL` are recognised by type; `DP/F/PHOTO` must be numbered. Ambiguity (multiple unnumbered tasks or templates) always stays a visible conflict.
