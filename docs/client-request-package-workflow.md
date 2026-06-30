# Client request package workflow

## Current workflow

1. Staff or Amonique adds a task in Daily Tasks.
2. Priority is set to `client_request` (or `urgent`) to surface it at the top.
3. The WhatsApp message or client message is pasted into Notes.
4. Admin later decides how this request fits against the client package.

## Existing fields (no migration needed for these)

### command_centre_tasks
| Field | Purpose |
|---|---|
| `priority: 'client_request'` | Marks the task as a client-originated request |
| `source: 'whatsapp_paste'` | Indicates message was pasted from WhatsApp |
| `notes` | Holds the raw client message |
| `client_id / client_name` | Links the task to a client |
| `deliverable_id` | FK to `monthly_deliverables` — links task to a package slot (added in phase-6, missing from TS interface) |

### monthly_deliverables
| Field | Purpose |
|---|---|
| `priority: 'client_request'` | Marks the deliverable as client-requested |
| `replaced_by_request_id` | FK to old `client_requests` table (not tasks) |
| `moved_from_deliverable_id` | Tracks when work was moved from another month |
| `package_id / template_id` | Links to the client package and template |

## Missing fields (need migration phase-7a)

On `command_centre_tasks`:

| Field | Type | Purpose |
|---|---|---|
| `package_action` | `'use_slot' \| 'addon' \| 'move_work' \| null` | How admin classified this request against the package |
| `quote_needed` | `boolean (default false)` | Flag add-ons that need a quote |
| `admin_package_note` | `text \| null` | Short admin reason or link note |

`deliverable_id` already exists in DB (phase-6) but needs to be added to the TypeScript interface.

## Proposed schema (phase-7a)

See `supabase/phase-7a-client-request-package-link.sql`.

**Not applied yet.** Review before running.

## UI flow for Amonique / CA

1. Client sends request (WhatsApp, call, email).
2. Staff adds task in Daily Tasks. Sets priority to `client_request`. Pastes message into notes.
3. Admin opens Monthly Planner. Finds the relevant client's deliverables.
4. On a deliverable card, opens **Package action** menu.
5. Chooses one of:
   - **Use package slot** — links this client request to an existing package deliverable (e.g. DP2 becomes the holiday poster)
   - **Mark as add-on** — request is over the package, flags `quote_needed`
   - **Move to another month** — defers a package slot to next month
6. Admin sets a short note in `admin_package_note`.
7. Monthly Planner package usage summary updates to reflect classification.

Step 4–7 UI is **reserved** in the current build (placeholder menu, saving not active yet).

## Staff permissions

Staff can:
- Add tasks with `priority: client_request`
- Paste client messages into notes
- Update production statuses (not_started, in_progress, ready_review, awaiting_client)

Staff cannot:
- Set `package_action`
- Set `quote_needed`
- Set `admin_package_note`
- Link `deliverable_id` on a task
- Change final scheduling statuses on deliverables

## Admin-only

- All package action classification
- Quote needed flags
- Linking tasks to deliverable slots
- Moving package work between months
