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

- An active CG Dynamics MCP connection (staff-authenticated session).
- The exact signed-in staff identity, resolved **from the connection**, never guessed
  or taken from the Project name, chat history, or the user's typed claim alone.

## Tool sequence (workflow level)

1. Resolve the current staff profile from the MCP connection (identity + role +
   assistant setup profile). If no profile resolves, stop and ask the user to confirm
   the connection — do not invent a profile.
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

- **Exact-staff scope only.** Never show another staff member's private queue.
- Planner/Work, CG Calendar and Client Schedule remain their own canonical authorities —
  read and reconcile them; never merge them or build a shadow task/calendar list.
- Live-source-first: prefer a fresh retrieval over anything remembered in the Project.
- No shadow CRM, task, calendar, or scheduling system is created here.
