# Brand Hub private folder linking — 19 October 2026

CA answered **Approve private folder linking** for58 launch clients, explicitly
keeping all libraries disabled and every file unpublished. This is the exact
scope executed after OneDrive setup/owner consent (PR846/847/848). It does not
approve file publication, library activation, permissions, shares or Vercel.

## Actual production action

- Current reviewed runtime unchanged, main `686f6bb6` at start. Open843/842/775/
  662/618 retain their separate owners; no overlapping implementation.
- Fresh active roster61, launch58 after exact held/prospective exclusions:
  AV Event Life, Red Oak, Zooz Lifestyle WFF. Never guessed a client UUID; the
  actual admin selector/DB roster provided durable IDs. LHP's later meeting does
  not block private folder preparation and does not authorize any package change.
- Preflight found no library/category/asset records. Each of58 clients went
  through the existing signed-in admin page and **Link verified folders** once.
  Handler verifies durable exact client binding, a unique canonical portal root,
  and one each of Brand Identity, Graphic Design, Video before saving.
- Existing backend created58 disabled library rows and174 exact category rows,
  attributed to the actual authorized admin, with verification timestamps.
  All58 actual admin readbacks settled on **Ready · private**, **No files
  published**, with the exact expected client name. No repeated uncertain write.
- Graph operations were reads of existing folders only. No file/folder created,
  moved, copied, renamed or deleted; no file selection/publication/enable click.
  No direct SQL write, schema/migration/RLS, secret or Edge release.

## Independent final stored-state acceptance

Read-only DB check,19 October around14:34 SAST:

| Check | Result |
| --- | ---: |
| Expected / linked launch clients | 58 /58 |
| Category mappings | 174 |
| Missing libraries | 0 |
| Enabled libraries | 0 |
| Unverified libraries | 0 |
| Wrong number of categories | 0 |
| Category label/client/library/drive/verification errors | 0 |
| Library drive vs exact client binding mismatches | 0 |
| Cross-client root or category folder collisions | 0 /0 |
| Libraries for the three excluded clients | 0 |
| Asset rows, including published files | 0 |

RLS remains enabled for libraries, categories, assets and token store.
Anon/authenticated have no direct SELECT; authenticated has no INSERT/UPDATE/
DELETE on those service-only tables. No grants or policies changed. This checks
stored exact-client boundaries, not a completed live client-role media test.
One aggregate diagnostic initially used ambiguous `last_verified_at`, failed
read-only, then was corrected to explicit `l.last_verified_at`; no SQL mutation.

## Browser verification and recovery discipline

Actual desktop admin, not synthetic fixture data: all58 named libraries verified
after save; automatic Brand Identity listing stays admin-only. Braize's source
brand image is listed, not published. Graphic Design and Video read checks plus
disabled client preview are additional canaries, not fleet-wide media playback.
Three agent-created processing tabs closed after completion; original admin tab
retained. Screenshot evidence stays local, no private Graph IDs/tokens in Git.

Initial automation saw slow navigation/preparation and an AX diff rather than
full state; a nested-main locator was also ambiguous. Recovered using full current
AX observations and exact client/button guards, with staggered admin tabs. Writes
were never retried based solely on a timeout; saved state was re-read. No provider
transport failure, authentication bypass or copied browser tokens.

## Local verification / code review

No runtime or frontend code changed. Six focused library/OneDrive test files:
**45tests/45pass/0fail/0skip/cancelled/todo**, canonical `fixtureEnvironment` from
`local-launch-acceptance.mjs`, serial Node test execution. Initial direct invocation
failed on missing fixture Vite config and port contention; rerun used the existing
sanitized loopback harness, not production credentials or a weakened assertion.
Fresh `npm run build` passes: TypeScript + Vite7.3.6, actual application JS present.
Existing >500kB chunk advisory remains nonblocking; no bundling rewrite. Local
dist is NOT a production release artifact and must not be uploaded.
Previous unchanged-runtime whole receipt3971pass/17declared skips/19browser
journeys remains historical local evidence, not repeated/claimed hosted media.

Reviewer checklist verdict: **approve**, no blocking receipt/source-scope findings.
Only documentation will be committed. No ignored artifact, private mapping
inventory, credentials, client file or dependency change in the diff. Staff/Teams
checkout last observed clean `1c8183d2`, untouched. Zero Vercel operations;
`git.deploymentEnabled=false` preserved. Control Centre exact reference remains
unavailable, so no guessed tracker/replacement was written.

## Exact remaining gate

Folder preparation is complete for all58, not only Braize. Libraries deliberately
remain disabled and empty of published assets. Review cleared exact-client files,
obtain the separate publication/enablement scope, then prove genuine client-role
list/view/download/range/expiry/horizontal isolation and recipient safety before
rollout. No raw/internal folders, historical brand assets or source files may be
mass-published merely because a folder exists. No whole-app launch certification.
