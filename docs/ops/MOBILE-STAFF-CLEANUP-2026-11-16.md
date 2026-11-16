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

Latest phone screenshot follow-up: verified actual production HTML/assets rather
than assuming the candidate was live. www.cgdynamics.co.za serves deployment
`dpl_DZ5RJ8F6gbRsSSvFtsHHhVXS3744`, source
`4af41304363b4f479febc8ba1c21278bf940b907`, JS `index-CpW7b9pM.js`, CSS
`index-5RIggIpq.css`, login `Login-Dou1OiHo.js`. The live viewport is already
device-width/initial-scale=1; the login still has 14px inputs and no auth-safe
scope. Therefore previous source-only work could not have changed the phone.
The screenshot alone does not establish whether every crop is zoom or intrinsic
overflow; do not claim a physical-browser root-cause reproduction.

Added defensive portal layout repairs: header client identity explicitly flexes
and truncates, main/shell and Overview grid can shrink, desktop grid tracks use
minmax(0,...), narrow-phone hero signals stack, long client names and values wrap.
Removed blanket root overflow hiding so a wide child is not silently clipped.
Client text inputs also inherit the phone-safe 16px rule. No scale transform or
disabled pinch zoom. Fresh local client/auth/preview/isolation set: 41 pass with
non-production fixture environment; build/scoped lint/diff pass. The preview suite
first exposed missing local fixture env, then passed with loopback test values;
existing Vite/esbuild shutdown diagnostics remain in its test log despite exit0.

Release target is project `prj_jHVsExoStNjI7ikqlJyXZx26Ahuu`, team
`team_SK5vvWv1AIXFkPNV8JFYL205`, www.cgdynamics.co.za. The above production
deployment is the read-only rollback baseline, not a newly created deployment.
No cloud build/upload/promotion or runtime/data mutation performed. #993 includes
the requested staff cleanup as well as this client viewport follow-up; do not
misrepresent its full diff as an auth-only hotfix. The earlier no-Vercel direction
and #679 explicit release/budget gate still apply. Fresh billing totals could not
be verified: the connector exceeded its response cap even with smaller windows,
and the same-endpoint installed CLI rejected the API's multi-record JSON output.
No partial total or claim of headroom is made. Rendered iPhone verification is
still blocked by the documented Computer Use URL-safety stop.

Follow-up: CA reported the client login zooming in on iPhone and staying zoomed
after entry. Both login inputs used 14px utility text while the existing viewport
already specified device width / initial scale 1. Added the same explicit mobile
16px form rule to the Login and shared recovery/setup auth shells, including
password reveal mode. No forced scale-reset script, pinch-zoom restriction,
desktop text-size change or authentication logic change. Three new regressions
render the actual login/recovery components, compile the real Tailwind stylesheet
and preserve the accessible viewport contract. Focused set: 19 pass; fresh
production build/scoped lint/diff pass. Real iPhone acceptance remains unverified.

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
