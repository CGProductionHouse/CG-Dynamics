# CG Dynamics to CG Hours sync vision

This is a later-phase product brief. Do not implement this before the core CG Dynamics workflows are stable.

## Principle

CG Hours is the source of truth for time, payroll, finance, commissions, task templates, task groups and client naming.

CG Dynamics is the workflow and production app. CG Dynamics must adapt to CG Hours naming, not the other way around.

Do not change CG Hours to fit CG Dynamics unless the user explicitly asks. CG Hours is the locked-in truth app.

## Why this matters

Staff are expected to log hours daily, but the current workflow is too open-ended. People get busy, forget what they worked on, and then reconstruct the week later. That creates wrong time logs and can affect commission and payroll.

The goal is not toxic micromanagement. The goal is a tool that makes logging work easier while the work is actually happening.

CG Dynamics should help staff know what to do, track what they are doing, and later send clean recommendations into CG Hours.

## Future sync concept

Staff work inside CG Dynamics during the day.

They should be able to start a task quickly, pause it, resume it, stop it, add notes, and continue working.

At the end of the day, CG Dynamics should be able to send that day into CG Hours as editable recommendations.

CG Hours should receive suggested entries only. Staff must still review, adjust time, edit wrong matches, and accept the entries.

No silent payroll or finance changes.

No spreadsheet export/import.

The desired future workflow:

1. Staff opens CG Dynamics at the start of the day.
2. Their task list is already priority sorted.
3. They start work from the top of the list.
4. When they begin a poster, video, website update, client call, admin item or other task, they start a timer.
5. They can pause, resume and stop the timer.
6. They can add notes when the task is done or paused.
7. At the end of the day, CG Dynamics prepares CG Hours recommendations.
8. Staff reviews the suggestions in CG Hours, fills or adjusts hours where needed, and accepts.
9. CG Hours remains clean and final for payroll, commission and finance.

## Naming alignment

CG Dynamics should use CG Hours as the naming base for future compatibility.

The relevant CG Hours concepts already identified from the repo include:

- clients
- task_templates
- task_template_lists
- task_template_list_items
- client_task_template_lists

Known CG Hours task group / bucket direction mentioned by the user:

- Internal Leave
- Once-Off
- Social Media
- Website Tasks

Before implementing sync, audit CG Hours properly and confirm the live names from the database/code.

## CG Dynamics mapping direction

CG Dynamics should prepare for mappings like:

- CG Dynamics client to CG Hours client
- CG Dynamics task bucket/type to CG Hours task_template_list
- CG Dynamics work item to CG Hours task_template
- CG Dynamics staff user to CG Hours user/profile

CG Dynamics should not invent client names or task groups that conflict with CG Hours.

Client names in CG Dynamics must copy CG Hours naming as closely as possible.

The goal is that recommendations are accurate and predictable:

- Central Canvas must never accidentally become Cape Lumber.
- A design poster task must not map to the wrong task type.
- Payroll-impacting entries must never be accepted silently.

## Timer concept

A future CG Dynamics timer can help close the loop.

Simple timer requirements:

- Start task quickly without filling every detail upfront.
- Allow task title/type first, then details later.
- Allow client to be selected later if staff needs to start fast.
- Pause, resume and stop.
- Add notes after the task or call.
- Capture elapsed time against the CG Dynamics task.
- Use elapsed time as a suggested duration for CG Hours, still editable before acceptance.

Possible examples:

- Franco starts a Client Admin / Client Call timer before calling a client.
- After the call, he stops the timer and adds notes.
- CG Dynamics keeps the notes and time.
- At end of day, CG Hours gets a recommendation for that client admin task.

## Floating timer idea

Because CG Dynamics is a web app, not a desktop app, true desktop overlay behaviour may be limited.

Possible later options:

- In-app sticky timer at bottom left or bottom right.
- Browser tab title showing active timer.
- Browser notifications if supported.
- Progressive web app install mode later if needed.

The idea is that when staff are working in Canva, on calls or in other apps, the active timer must still be easy to remember and return to.

## Daily workflow vision

CG Dynamics should be the staff starting point.

Opening the app should immediately show:

- My tasks
- Today's priority order
- Client requests pushed to the top when urgent
- Current in-progress work
- Simple status updates
- Quick task start
- Minimal text
- Clear visual hierarchy

Staff should not need to read long explanations.

The interface should be clean, visual and obvious.

Important user preference:

- No long helper paragraphs everywhere.
- Clean titles first.
- Details hidden until needed.
- Notes and explanations can live lower down or behind details/help.
- The app must reduce work, not create admin noise.

## Daily Tasks direction

Daily Tasks should be built around staff work, not admin-heavy forms.

Core rules:

- My tasks first.
- All tasks / team view second.
- Default to the active logged-in staff member.
- Client requests and urgent work should visually rise to the top.
- Quick add should only need a title.
- Details should open later for client, assignee, helpers, bucket, notes, checklist and package link.
- Client requests are tasks, not a separate duplicated capture panel.
- WhatsApp/client messages can go into notes.

## Package and client request connection

Client requests must connect to package usage.

A request can be:

1. Use package slot
   Example: client asks for a public holiday poster and Amonique links it to DP2.

2. Add-on / extra
   Example: client has 4 DP in package but asks for 2 more. The app must show 4 package DPs plus 2 add-on DPs.

3. Move package work
   Example: client wants only 2 posters this month and 6 next month. Admin can move unused package slots forward.

The app must clearly show:

- planned package work
- client-requested package work
- add-ons / extras
- moved or deferred package work
- usage totals by client and month
- quote-needed extras

## Access and safety

Staff can update production statuses:

- Not started
- In progress
- Ready for review
- Awaiting client approval

Only CA and Amonique can control final scheduling states:

- Meta Drafts
- Scheduled / Posted

CG Hours integration must remain safe:

- CG Hours is separate.
- CG Dynamics sends suggestions only.
- CG Hours remains the final system for accepted time, payroll, finance and commission.

## Do not implement yet

This document is a product direction note.

Before implementation:

1. Stabilise CG Dynamics core workflows.
2. Import Teams data safely.
3. Clean Daily Tasks and Planner UX.
4. Audit CG Hours naming and task template structure properly.
5. Add CG Dynamics mapping tables or configuration only when ready.
6. Build recommendations safely, never direct payroll writes.
