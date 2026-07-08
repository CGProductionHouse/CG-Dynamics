# Workforce Mobile QA Checklist

Use this after deploying the workforce branches to Vercel. Test at phone width, tablet width and desktop.

## Access

- Admin can open `/admin/cg-hub`, `/admin/my-day`, `/admin/assistant`, `/admin/users` and `/admin/invites`.
- Manager can open Hub, My Day and Assistant, but cannot open Users or Invites.
- Staff/team can open Hub, My Day and Assistant, but cannot open Users or Invites.
- Client users are redirected away from internal admin routes and can only use the client dashboard.

## Hub

- Hub loads real Planner, CG Calendar and Client Schedule signals without fake rows.
- Quick Add creates a normal task for today.
- Mobile cards do not overflow sideways.

## My Day

- Empty assigned-work state is clear and does not invent work.
- A user with only CG Calendar events still sees those events.
- A user with only Planner tasks still sees those tasks.
- Overdue, due today and upcoming work are separated clearly.
- Tasks assigned by direct user id, assigned name or helper name appear for the right person.
- CG Calendar event times stay correct in South Africa local time.

## Assistant

- `/admin/assistant` loads for admin, manager, staff and team roles.
- Starter prompts submit correctly.
- "What should I focus on today?" uses only the sanitized My Day context.
- Salary, payroll, Xero, bank, profit/loss, revenue, invoice total, tax, ID number and private HR prompts are refused for staff and managers.
- Admin diagnostics are visible only to admin users.
- Missing provider keys show a setup message instead of breaking the page.

## CG Calendar Contract

- `/admin/cg-calendar` shows company events and optional dated Planner tasks only.
- Planner task layer is off by default.
- Client Schedule posts, DP/F/Video/Reel package items and `monthly_deliverables` floods do not appear in CG Calendar.
- Event create/edit keeps local SAST times stable.

## Users And Invites

- Users list works on mobile and desktop.
- User edit modal fits on a phone.
- Invites page creates client, staff and manager invites.
- Invite delete requires confirmation.

## Deployment Notes

- Supabase SQL is not applied by the frontend deployment. Review and run `supabase/phase-14a-workforce-roles.sql`, then `supabase/phase-14b-staff-role-alias.sql` manually in the Supabase SQL editor.
- Supabase Edge Functions are not deployed by Vercel. Deploy the Assistant function separately with `npx supabase functions deploy cg-assistant-chat --no-verify-jwt`.
- Do not expose service-role keys, AI provider keys or other secrets in client-side environment variables.
