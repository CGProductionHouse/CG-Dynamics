---
name: cg-dynamics-microsoft-transition-sync
description: Use when Christie-Ann says "Update Teams into CG Dynamics" or asks for a Microsoft transition sync from Outlook, Teams or Planner into CG Dynamics.
---

# Microsoft Transition Sync

Run the temporary one-way coexistence bridge. Microsoft is upstream during the
transition; never write back to Microsoft.

## Preconditions

1. Read `docs/microsoft-365-import-map.md` and `AGENTS.md`.
2. Confirm the transition status is `active`.
3. Confirm Phase 15a and Phase 17a are live before any apply. Never run a
   migration without explicit approval.
4. Confirm the connected Microsoft identity has read-only access only.
5. Use a temporary file outside the repository for normalized snapshots. Never
   commit Graph payloads, credentials, exports or generated import artifacts.

## Fetch

Fetch every configured source with exact IDs and complete pagination:

- operational Outlook calendar, using immutable event IDs and an explicit
  reviewed date range;
- Planner `To Do`;
- `MASTER CLIENT TO DO`;
- `CG Socials`;
- every allowlisted active `Client Socials - <Month Year>` plan;
- any other plan only when it appears in the reviewed allowlist.

Resolve plan and bucket names, task details, completion state, assignments and
source modification timestamps. For Outlook preserve SAST offsets, all-day
state, cancellation, location and source modification time.

Do not mark a source complete after any pagination, permission, connector,
timeout, details or range failure. A missing item from an incomplete source is
not a deletion.

## Normalize And Preview

Produce the version 2 `cg-dynamics-microsoft-snapshot` contract. Each source
must declare `complete`, range, record count and a safe error. Set
`triggerType` to `agent`.

Use `/admin/microsoft-import` (Microsoft Sync) and its advanced connected-agent
transport. The page and in-app Graph trigger share the same reconciliation
engine.

Before apply, report:

- complete/incomplete sources;
- create, update, complete, reopen, move, cancel, archive/source-removed,
  unchanged, conflict, skipped and failed counts;
- every conflict and every proposed source removal.

## Apply

Apply only after the dry preview is reviewed. Source removals require separate
explicit approval and are archived/cancelled, never hard-deleted. Never guess a
client UUID. Never map Client Socials cards into CG Calendar.

Microsoft-owned fields may reconcile. Preserve CG-only notes, approvals, audit
metadata, unrelated workflow fields and CG-created records.

## Verify

Verify the resulting records in:

- `/admin/cg-calendar`;
- `/admin/planner` and completed/history states;
- `/admin/my-work`;
- `/admin/cg-hub`;
- `/admin/client-schedule` for Client Socials only.

Check exact Microsoft source identities, duplicate counts, SAST event times,
completed/reopened/moved tasks, removed items leaving active views and retained
CG-only notes. Inspect browser console and failed network calls.

Final report must include all action counts, source completeness, conflicts,
failures, destination verification, migration state and this exact statement:
`No Microsoft writes occurred.`
