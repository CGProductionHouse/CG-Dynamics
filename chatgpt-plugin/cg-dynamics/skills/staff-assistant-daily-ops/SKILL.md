---
name: staff-assistant-daily-ops
description: Use to bootstrap a fresh CG Dynamics session, brief a staff member from their CG Assistant profile, and give the compact daily brief — today view, work queue, and calendar/task reconciliation for the exact signed-in staff identity.
---

# Staff Assistant — Daily Ops

Bootstrap and daily-brief workflow for a signed-in CG Production House staff member.
All live data comes from the registered **CG Dynamics MCP** connection. This skill
describes the workflow; it never holds live data itself.

## Trigger / user goal

- "Brief yourself from my CG Assistant profile."
- "What do I have today?"
- "Set me up for the day" / fresh Project or session bootstrap.
- Reconciling what is on the calendar vs the work queue vs Planner tasks.

## Required inputs

- An active CG Dynamics MCP connection (the shared communal company connection).
- **The exact staff Project context.** The single OAuth connection is the company admin
  account, so it does NOT identify the staff member. Establish context first — see
  `../../PROJECT-CONTEXT.md`:
  1. call `resolve_project_context` with `{ context_kind: "staff", staff_full_name: "<exact name>" }`
     (or the exact canonical `staff_profile_id`);
  2. carry the returned object as `context` on every later call in this Project.
  Never take the identity from the Project title, chat history, the connected account, or
  the user's typed claim alone.

## Tool sequence (workflow level)

1. Establish the staff Project context (above) if not already established in this chat,
   then read the assistant setup profile for that exact staff member. If the context cannot
   be resolved, stop and ask which exact staff member this Project is for — never fall back
   to the admin/connection account.
2. Retrieve the live **today view** (scheduled items, meetings, content runs, deadlines
   relevant to this staff member).
3. Retrieve the live **work queue** (Planner/Work tasks) for this staff member.
4. Reconcile: surface conflicts or gaps between calendar, content schedule and tasks —
   report them, do not silently resolve or edit them.
5. Assemble the compact daily brief (below).

Treat the tool names as an abstract contract exposed by the MCP connection; if a needed
tool is absent in the session, say so and continue with what is available.

## Output contract — compact daily brief

Keep it short and scannable (CG house style: minimal copy, obvious priorities):

1. **You** — exact name/role as resolved from the connection.
2. **Today** — dated items in time order (meetings, shoots, content runs, deadlines).
3. **Work queue** — open tasks needing attention, highest priority first.
4. **Needs a decision** — reconciliation gaps/conflicts to resolve.
5. **Suggested next action** — one concrete step, not a lecture.

## Facts the model must not infer

- Staff identity, role, or permissions (resolve from the connection).
- Which tasks/events exist, their status, dates, or ownership.
- That an item is "done" — completion authority is the live system, not the chat.
- Any client, contact, price, schedule date, or OneDrive ID.

## When to ask / stop

- No connection or no resolvable staff profile → stop, ask to confirm the connection.
- Ambiguous "me" (e.g. shared machine) → confirm identity before briefing.
- A request to change/complete/delete operational data → this skill is read/brief only;
  route write actions to the exact system that owns them and confirm before acting.

## Boundaries

- **Exact-staff scope only.** Never show another staff member's private queue. The admin
  OAuth connection must not make this Project omniscient.
- **Never reuse another Project's context.** If unsure which Project this is, re-run
  `resolve_project_context`.
- Planner/Work, CG Calendar and Client Schedule remain their own canonical authorities —
  read and reconcile them; never merge them or build a shadow task/calendar list.
- Live-source-first: prefer a fresh retrieval over anything remembered in the Project.
- No shadow CRM, task, calendar, or scheduling system is created here.
