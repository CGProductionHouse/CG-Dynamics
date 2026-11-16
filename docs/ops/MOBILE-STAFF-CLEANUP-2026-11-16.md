# Mobile staff interface cleanup — 16 November 2026

CA requested a practical cleanup of the phone admin/staff experience after the
Clients screen made even sharing a login difficult. Continue the same isolated
PR #993/worktree; do not create competing Clients changes. Source only.

## Findings and changes

- More previously rendered only the current workspace and hid all Administration
  tools in Performance. The mobile menu now searches both existing workspaces,
  groups Daily work / Clients & reporting / Administration, deduplicates routes
  and adds an admin-only Client logins shortcut. Existing desktop zones, primary
  bottom tabs, route guards and legacy links remain. Morning import remains in
  Team Work rather than repeating as a separate mobile destination.
- Removed the redundant top Menu button; the existing bottom More opens the one
  mobile menu. Notifications and menu close each other. The header identifies
  the current workspace and uses a simple bell icon.
- Client More actions no longer stretch each list card into a long stack. Native
  modal action sheets keep actions in one scrollable, dismissible layer with
  Escape/backdrop/Close, background scroll lock, focus containment and restoration.
- Mobile client cards show one readable, canonical package summary and two main
  actions. Repeated tier/Active/Confirmed/unknown pill clusters move out of the
  default row; package details and every former action remain in the sheet.
  Null quantities remain unconfirmed, explicit zero remains distinct, and nothing
  is inferred as a missing service. Login-copy notes appear once per list.
- Client Access defaults to saved username/status/copy/manage rather than a form
  plus save/reset/disable on every row. Setup/edit controls open only for the
  chosen client; unchanged usernames cannot be saved accidentally. Reset and
  disable require explicit confirmation. Save failures keep the sheet open.
- Staff text fields use 16px on small screens to avoid iPhone focus zoom. User
  zoom remains enabled, client surfaces untouched. Shared action/icon buttons
  retain at least 44px phone targets. Client Access columns shrink/wrap on tablet
  rather than using four fixed minimum widths beside the sidebar.

## Verification and limits

175 relevant tests pass, including executing the actual mobile navigation model
for admin/manager/staff, search and deduplication, package unknown/zero handling,
native-sheet lifecycle/cleanup/focus, existing role/navigation/mobile/assistant
regressions and login-copy isolation. Production TypeScript/Vite build, emitted
application chunk inspection, scoped ESLint and diff check pass. The old inline
More-actions source assertions were replaced with explicit modal action-sheet
contracts; route and archive-confirmation assertions remain.

Local generated QA fixture uses the actual layout/Clients/Client Access
components, synthetic local rows, a refusing Supabase adapter and CSP restricting
network to localhost. No production auth/session/credentials are used. Browser
acceptance is pending the available Computer Use surface; unit/modal lifecycle
evidence is not a physical-phone or rendered-layout claim.

No schema/backend/provider/package/task/calendar/data/access writes, production
deployment, Vercel action or new dependencies. Git deployment remains disabled.
The source candidate needs rendered mobile/desktop acceptance and the existing
#679 reviewed release gate before it is live. No all-app launch claim.
