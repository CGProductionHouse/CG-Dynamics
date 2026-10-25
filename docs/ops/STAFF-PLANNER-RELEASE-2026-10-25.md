# Staff Planner / Calendar controlled release — 25 October 2026

This source-only release excludes private local audit history, source snapshots,
client package decisions and operational evidence packets. It changes no client
portal route/component, package quantity, provider configuration or dependency.
The source branch was reconciled with main; the parallel client checkout stayed
clean and unchanged. Git automatic deployment remains disabled.

## Release scope

Existing Planner views and guarded core/checklist/assignment saves; business-date
and recurrence correctness; operational Calendar source/staff field preservation,
revision guards, non-destructive cancellation, pending/dirty-close protection and
retry-safe creation; exact-source conflict review and Microsoft connector
completeness/identity guards. No second schedule/task/calendar store or scheduler.
Client Schedule and CG Calendar remain separate. Missing source data is not zero
or a deletion. No automatic resolution of held conflicts/packages is authorised.

## Separately approved production prerequisites

CA explicitly approved these two changes after read-only dependency preflight:

1. `20261025091300_planner_guarded_staff_edits.sql`, source SHA256
   `6654ea115df913c2498852e2ecca723355fe0f9c01be6eef09c768d08c71f534`.
   Applied as migration version `20261025135614`. Exact body MD5
   `5371f8ae8b1a9d4aa34d7e9971d81eed` matches local source. Original core and
   assignment definitions unchanged. Authenticated EXECUTE only; anon/service
   denied. Active-manager, exact revision, board and history checks retained.
2. `20261025135859_calendar_creation_attempt_identity.sql`, source SHA256
   `98159e550abf1be40a1173326dacedff1e4283fa7dfc3c4a84fd20ede775bacc`.
   Applied as migration version `20261025140015`. Only authenticated INSERT(id)
   added. UPDATE(id), Microsoft identity and client-visibility columns remain
   denied to authenticated; existing RLS stays enabled. A pre-existing anonymous
   table ACL was not changed. Anonymous policy evaluation is blocked by existing
   is_staff execution ACL (confirmed with a read-only role probe); no anonymous
   business read/write was performed. The fixture also proves RLS denial with an
   anonymous table ACL present. No widening grant or policy alteration was made.

Production readback uses catalog/function metadata only, not business mutations.
No fake live tasks/events, source recovery, package changes, reminders/invitations,
Microsoft writes or manual source refresh are part of this release. Other SQL
files in the source diff must NOT be blindly applied or replayed.

## Verification and protected limitations

All changed-file tests passed (522), with the subsequent two narrow permission
tests and creation/replay tests passing. The wider initial Windows run produced
4230 tests: 4206 pass, 19 declared skips and five missing-OpenSSL failures in
unchanged SES suites. Existing Git-bundled OpenSSL resolves those failures:
18/18 SES tests pass without code/assertion changes. A fresh clean-checkout serial
rerun is required for the final receipt; unsupported Windows SES Bash setup is
explicitly excluded, not passed. Disposable SQL tests are not full production
RLS/multi-session/recipient delivery certification.

Local production TS/Vite build matches the existing public Supabase browser
configuration, verifies public auth settings200 and excludes fixture sentinels.
No privileged key/environment transfer. Exact prebuilt static output contains
the new Calendar and guarded Planner code. All changed-path lint/diff pass.
Actual local Planner/Calendar/conflict-review browser fixtures cover desktop and
mobile with synthetic adapters. Runtime Edge bundle is independently verified;
compatibility type checks are not substituted for hosted packaging proof.

Before hosting: confirm the existing CG Dynamics project/team/domain and prior
serving rollback, fresh billing headroom, unchanged peer and exact candidate SHA.
Observed billing: 18 Oct–18 Nov cycle, included6.30/20USD, on-demand0/15USD,
Pause ON. Preserve at least5USD reserve; stop at1USD incremental release spend.
Use one local prebuilt production-target upload, verify, then promote that same
deployment. Never upload fixture dist, private artifacts/history or use a cloud
build/retry fallback. No hosting budget/DNS/add-on changes.

## Not a Teams-retirement certificate

Held source identities/collisions and three package decisions stay held. Full
Graph checklist details/revisions, actual invitation/reminder recipient delivery,
private-finance recurrence/source-cycle proof and genuine staff/client device
acceptance remain separate gates. Do not label these complete because a release
or local suite is green. Preserve useful staff content and exact source identity.
