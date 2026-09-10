---
name: staff-assistant-daily-ops
description: Use to bootstrap a fresh CG Dynamics session, brief a staff member from their CG Assistant profile, and give the compact daily brief — today view, work queue, and calendar/task reconciliation for the exact signed-in staff identity.
---

# Staff Assistant — Daily Ops

Bootstrap and daily-brief workflow for a signed-in CG Production House staff member.
CG Dynamics supplies identity, Staff Assistant profile/context, client/package/content data and
the governed bridge into CG operational systems. During the Microsoft transition, live staff
work state must still be read from the current Microsoft sources rather than assuming imported
Dynamics task/calendar copies are fresher.

## Transition source precedence — effective 10 September 2026

Until CA explicitly confirms the Microsoft-to-Dynamics cutover is complete:

1. **Teams / Planner / connected Microsoft work sources are the primary operational truth for staff task state.**
   - Prefer the live Microsoft/Teams/Planner status for whether a task is still open, in progress,
     waiting, blocked or completed.
   - A Dynamics-imported copy must not override a newer Microsoft state.
2. **The connected Microsoft calendar is primary for staff meetings/calendar commitments.**
   - Dynamics calendar data is a fallback/cross-check during this transition, not the first authority.
3. **CG Dynamics remains canonical for CG-native operational context:** staff profile/context,
   clients, packages, monthly deliverables / Client Schedule, Content Runs, Content Guidelines,
   content-production status, OneDrive mappings, lead/CRM context and governed audit/history.
4. **Dynamics is a backup for staff task/calendar reads until cutover.** Use it when the live
   Microsoft source is unavailable, and label that fallback clearly.
5. **Do not double-count mirrored/imported work.** When the same Microsoft task exists in Dynamics,
   present one work item using the freshest authoritative Microsoft state.
6. **Completed work does not belong in the normal daily queue.** Preserve completion history, but
   the default brief should show only active work that still needs attention (for example To do,
   In progress, Waiting/Blocked, or another explicitly active state). Never treat an old due date as
   evidence that a completed task is still outstanding.

The transition goal is frequent Microsoft → Dynamics reconciliation so Dynamics increasingly
reflects Teams/Planner accurately without creating a second competing task system.

## Trigger / user goal

- "Brief yourself from my CG Assistant profile."
- "What do I have today?"
- "Set me up for the day" / fresh Project or session bootstrap.
- Reconciling what is on the Microsoft calendar vs Teams/Planner work vs Client Schedule / CG-native work.

## Required inputs

- An active CG Dynamics MCP connection (the shared communal company connection).
- Access to the authorised Microsoft/Teams/Planner and calendar sources needed for the staff member's live work view.
- **The exact staff Project context.** The single OAuth connection is the company admin
  account, so it does NOT identify the staff member. Establish context first — see
  `../../PROJECT-CONTEXT.md`:
  1. call `resolve_project_context` with `{ context_kind: "staff", staff_full_name: "<exact name>" }`
     (or the exact canonical `staff_profile_id`);
  2. carry the returned object as `context` on every later CG Dynamics call in this Project.
  Never take the identity from the Project title, chat history, the connected account, or
  the user's typed claim alone.

## Tool sequence (workflow level)

1. Establish the staff Project context (above) if not already established in this chat, then
   read the assistant setup profile for that exact staff member from CG Dynamics. If the context
   cannot be resolved, stop and ask which exact staff member this Project is for — never fall back
   to the admin/connection account.
2. Retrieve the staff member's **live Microsoft work state first**: Teams/Planner tasks and the
   connected Microsoft calendar sources available to this Project/account.
3. Retrieve the CG Dynamics today/work view as a **fallback and reconciliation layer**, plus the
   CG-native records it uniquely owns (Client Schedule, Content Runs, Content Guidelines, package
   deliverables and related production state).
4. Deduplicate Microsoft-linked items against Dynamics mirrors. For task/calendar status conflicts,
   prefer the live Microsoft source during the transition and surface the discrepancy rather than
   silently rewriting either system.
5. Exclude completed/done/cancelled historical work from the normal active queue unless the user
   explicitly asks for history/completed items.
6. Reconcile: surface conflicts or gaps between Microsoft work/calendar, Client Schedule,
   content schedule and Dynamics mirrors — report them, do not silently resolve or edit them.
7. Assemble the compact daily brief (below).

Treat CG Dynamics MCP tool names as an abstract contract exposed by the connection. A missing
CG Dynamics tool must not make the assistant invent data. Likewise, if a live Microsoft source is
unavailable, say that Dynamics fallback data is being used.

## Output contract — compact daily brief

Keep it short and scannable (CG house style: minimal copy, obvious priorities):

1. **You** — exact staff identity resolved through the CG Dynamics Project context.
2. **Today** — live Microsoft meetings/calendar commitments first, then CG-native scheduled content/client items.
3. **Work queue** — active Teams/Planner work needing attention, deduplicated against Dynamics mirrors; highest priority first.
4. **Needs a decision** — source conflicts, stale Dynamics mirrors, Client Schedule/content gaps or blockers.
5. **Suggested next action** — one concrete step, not a lecture.

## Facts the model must not infer

- Staff identity, role, or permissions (resolve from the connection).
- Which tasks/events exist, their status, dates, or ownership.
- That an item is "done" — completion authority is the live source, not the chat.
- Any client, contact, price, schedule date, package entitlement, Content Guideline item or OneDrive ID.

## When to ask / stop

- No connection or no resolvable staff profile → stop, ask to confirm the connection.
- Ambiguous "me" (e.g. shared machine) → confirm identity before briefing.
- Live Microsoft task/calendar source unavailable → continue only with clearly labelled Dynamics fallback data.
- A request to change/complete/delete operational data → this skill is read/brief only;
  route write actions to the exact system that owns them and confirm before acting.

## Boundaries

- **Exact-staff scope only.** Never show another staff member's private queue. The admin
  OAuth connection must not make this Project omniscient.
- **Never reuse another Project's context.** If unsure which Project this is, re-run
  `resolve_project_context`.
- During the transition, **Teams/Planner + Microsoft calendar own live staff task/calendar state**;
  Dynamics mirrors are fallback/reconciliation copies until CA explicitly declares cutover.
- **Client Schedule remains CG Dynamics truth** via `monthly_deliverables`; do not substitute Planner
  for package/monthly deliverable truth.
- **Content Runs, Content Guidelines, package entitlements and OneDrive mappings remain CG Dynamics truth.**
- Completed Microsoft/imported items are history, not default daily work. Do not hard-delete history
  merely to make the brief cleaner; hide/archive/filter safely unless CA explicitly approves deletion.
- Live-source-first: prefer a fresh retrieval over anything remembered in the Project.
- No shadow CRM, task, calendar, or scheduling system is created here.
