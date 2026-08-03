# Personal daily assistant

## Purpose

The personal daily assistant turns a staff member's English, Afrikaans, or mixed voice note into a reviewed daily record. It can suggest canonical Planner tasks, follow-ups, promises, decisions, retained notes, assignees, clients, due dates, and reminders.

Nothing is written to operational data until the signed-in user reviews the draft and selects **Confirm selected**. Audio is sent to the server-side transcription provider and discarded after transcription; the database stores the transcript and structured result, never the audio bytes.

## Access and privacy

- Active `admin`, `manager`, `staff`, and `team` profiles can capture and read only their own daily timeline.
- Client profiles have no table policy or function access.
- Admin and manager roles may assign a confirmed action to another active staff profile.
- Staff and team roles may assign only to themselves.
- Client and staff names are resolved against live directories. Ambiguous or unresolved spoken names start deselected and require a deliberate selection.
- Every confirmed write uses the existing Planner task, assignment, activity-log, notification, and audit paths.

## User flow

1. Open the persistent Assistant control or `/admin/assistant`.
2. Choose **Record my day**.
3. Record up to five minutes, or type a note.
4. Review the transcript summary and every suggested action.
5. Correct the title, client, assignee, due date, reminder, or action type; deselect anything that should stay out.
6. Confirm. Duplicate recent same-client tasks are linked or updated instead of silently recreated.
7. Use **Today / open loops** to review captured notes and complete open items.

The browser stores only an in-progress typed draft locally. If iOS backgrounds the page during recording, the recorder stops and submits the captured segment rather than losing it.

## Reminder policy

`refresh_my_assistant_day_notifications` creates restrained, deduplicated personal reminders during Africa/Johannesburg daytime only:

- morning: 07:00-10:59;
- midday: 11:00-14:59;
- end of day: 16:00-18:59;
- explicit reminders when due.

No reminder is created from 19:00 through 06:59. Users can mark related work done, snooze for 30 minutes, or dismiss the notification.

## Deployment

Apply only:

```text
supabase/migrations/20260803163045_personal_daily_assistant.sql
```

Then deploy both JWT-verified functions through the linked Supabase CLI workflow:

```text
npx supabase functions deploy daily-assistant-capture --project-ref ehtjfntukiwbgptqgbzy
npx supabase functions deploy cg-assistant-chat --project-ref ehtjfntukiwbgptqgbzy
```

Do not add `--no-verify-jwt`.

## Acceptance checklist

- Test one English, one Afrikaans, and one mixed-language recording.
- Test a note with multiple people, clients, promises, and dates.
- Test imperfect names such as `German parts`, `Germo part`, `Ger Marie`, `Jermarie`, and `Red oke`.
- Confirm no task exists before review and confirmation.
- Confirm an unknown or ambiguous client/staff name cannot be saved accidentally.
- Repeat a same-client task and confirm it links/updates rather than duplicates.
- Confirm a manager can assign another staff member and ordinary staff cannot.
- Confirm a client account cannot invoke the function or read either timeline table.
- Ask the Assistant what was done today and what remains; confirm only that user's timeline appears.
- Test Safari microphone denial, background interruption, retry, and 390px layout.

## iPhone and App Store path

This release is a responsive web/PWA workflow. Staff can use Safari and add CG Dynamics to the iPhone Home Screen after production acceptance. A native App Store release is a separate product step: define native-wrapper requirements, Apple Developer ownership, signing, privacy disclosures, microphone usage text, TestFlight acceptance, and App Review. Do not describe the web release as App Store-ready until those steps are completed on physical iPhones.
