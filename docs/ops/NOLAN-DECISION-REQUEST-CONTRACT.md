# Explicit decision requests: implementation contract (draft, not activated)

16 November 2026. Existing PR #990. This is preparation for a distinct Needs You
queue, not a rename of Assigned to you and not a live or deployed decision store.

## Implemented now

`src/lib/nolanDecisionRequests.ts` defines explicit source namespace, source ID,
expected revision, named recipient, question and idempotency key. The pure draft
producer strips caller-supplied actor/role/lifecycle fields. Receipt selection
requires a complete authorized snapshot, exact viewer and current source revision.
Invalid receipts, duplicate request IDs or missing current revisions are unavailable,
not a successful zero-work answer. Changed revisions do not show old questions as
current. No source task status is rewritten. No browser cache is authority.

The pure generic proposal module is not a permission boundary. A separate narrow native-task RPC adapter and gated Needs You component are now implemented in this draft (see next-slice receipt below). No migration has been executed and no pending requests have been invented or created.

## Architecture evidence and rejected shortcuts

The daily-assistant capture producer records decision entries already completed.
Its private questions belong to the capture owner, not an explicitly selected
decision recipient. Schedule change requests have a requester and historical
reviewer; their pending manager pool is not a personal request. Task assignment,
administrator role, imported names and free-form notes are not substitutes.

## Next server producer slice

Use the existing authenticated Supabase/RPC pattern, but first settle the canonical
decision-request relation and its source-specific adapters in a reviewed migration.
Do not repurpose private assistant captures or duplicate task lifecycle records.

A server create RPC must:
1. Derive actor exclusively from auth.uid(), check active profile and exact
   authorized source access. Each namespace must have a fixed, reviewed relation
   and revision strategy; do not resolve arbitrary table names or URLs.
2. Require deliberate explicit recipient selection. Check active recipient and
   source visibility plus source-specific eligibility on the server. Manager role
   alone does not prove the recipient or actor is authorized to decide a matter.
3. Lock/re-read the source and compare expected revision atomically; stale UI
   drafts must fail without creating a request. A timestamp revision may be used
   only after validating that every relevant source edit reliably changes it.
4. Scope idempotency to authenticated actor. Repeating the same key/payload returns
   the original receipt; key/payload mismatch rejects. Do not invent duplicate
   pending requests on retry. Unique request IDs remain separate from source IDs:
   one source can legitimately carry several different questions.
5. Store server actor/time, explicit recipient, question, revision and audit trail.
   A request is a question only, not approval, publication or permission to apply.
6. Enforce recipient-scoped reads and narrowly authorized actor/source visibility
   with RLS. No browser-supplied role flags, service key or broad shared read.
7. Resolve/withdraw via separate checked RPCs with optimistic request revision.
   Only eligible recipient may resolve; requester withdrawal is distinct. Source
   changes invalidate pending revision eligibility without changing project state.
   Resolving a request must not automatically apply production changes.
8. Return paginated receipt AND current-source revision evidence under the same
   authorized contract. Any late-page/permission error fails the entire personal
   queue; never silently present partial reads as complete.

## Required acceptance before UI activation

Synthetic proposal/selection tests are not database or role acceptance. Require:
- Anonymous, inactive, staff, manager, administrator and unrelated-user read/write
  isolation, including actors who can see a source but not decide for recipient.
- Arbitrary source/recipient substitution, disabled profiles, revoked visibility.
- Concurrent source edits, response versus withdrawal races, current revision CAS.
- Idempotent retry, conflicting key reuse, duplicate/late-page failure.
- Complete-empty versus unavailable; account switches and delayed response races.
- Same-origin authenticated UI with explicit recipient/question preview and
  canonical source link; no credential forwarding or bypass.
- No production migrations or deployment under this draft preparation.

Current blocker is missing server-enforced canonical recipient/source authority
contract and disposable DB acceptance capability. Parent/owner may authorize
further draft migration implementation, but live rollout remains separately gated.


## Next-slice implementation receipt: explicit native-task workflow

Draft implementation now includes SQL at
docs/ops/sql/nolan_explicit_decision_requests.draft.sql (deliberately outside
automatic migration discovery), a native-task adapter and
NolanNeedsYou UI. The distinct lane does not replace Assigned to you.

Scope is deliberately limited to native command_centre_tasks. Existing
phase-security-admin-isolation.sql grants manager/admin source visibility; schema.sql
reserves profile updates to administrators. No external, Planner, video or monthly
deliverable record is guessed into this producer. Active administrators explicitly
choose an active manager/admin recipient; that makes a question addressed to the
person, not authority for them to approve publishing, money or production changes.

Persistence uses RLS plus no direct authenticated/anonymous table grants. Fixed
pg_catalog search_path SECURITY DEFINER RPCs derive auth.uid(), check active roles,
lock profiles and source rows on mutation, compare full-row JSON revision hashes,
and serialize actor-scoped idempotency keys. Key replay with changed material
payload rejects. Same valid retry returns the original receipt. Questions retain
server actor/time; closure records responder/time, response and incremented CAS
version. Repeated or concurrent closure must fail the stale-version/state check;
integer overflow rolls back rather than reusing a revision. Responses never mutate
the source task. Only requester may withdraw; only named recipient may answer a
still-current source question.

Reads return only own pending incoming/outgoing questions. More than 500 produces
an explicit coverage error rather than a truncated complete result. Source changes
and inactive recipients are disclosed; they cannot be resolved as current.
Closed requests remain persisted but this first UI shows pending only, not a full
history browser. A failed queue read is unavailable, not empty. Source deletion
is restricted while a decision record references it; retention behavior requires
review before rollout.

The UI gate NOLAN_DECISIONS_ACCEPTED is hardcoded false. Its disabled state is
rollout control, NOT backend security. Account/month-key remounting preserves
scope isolation. Admin draft form reads exact source/revision and eligible profiles,
requires explicit recipient/question and freezes edits after a create attempt so
an uncertain response is retried using the same idempotency key. Source links and
response actions are distinct; no task action is implicitly applied.

Validation: five source/synthetic tests passed using in-memory source, including
receipt validation and role/revision/idempotency code contracts. These are NOT
proof of SQL syntax, authorization or concurrency behavior. An opt-in disposable
PostgreSQL test is supplied with minimal synthetic canonical dependency tables;
it uses --pull=never, --network none, tmpfs, no host ports, no production credentials
and cleans only its exact generated container. It has NOT been executed because
no permitted working disposable DB is available. The real-schema full role matrix,
concurrent transactions and authenticated browser acceptance remain mandatory.
Do not activate the UI gate or apply migration until those checks are verified.

Independent review correction: draft SQL is stored outside supabase/migrations so ordinary deployment tooling cannot apply it merely because it exists in the PR. Promoting it to an executable migration requires reviewed acceptance and separate release authorization. Native command-centre links use the existing daily-tasks workspace, with the exact UUID shown separately; the Planner board-ID route is not reused or claimed as an exact task deep link.

Further source-review corrections: every RPC fixes timezone UTC for consistent JSON timestamp revision serialization; known SQL rejection codes release the draft for correction, while network/timeout/missing receipt errors retain the retry key and locked fields. These behaviors still require rendered and real-DB acceptance.


## Deeper review and acceptance gate correction

Source review after 2495491 found an actual SQL syntax defect: replacement-string
expansion reduced the five opening dollar quotes to a single dollar. This has
been corrected using literal-safe replacement and a five-pair delimiter regression.
This illustrates why TypeScript/source tests are not SQL execution acceptance.

Create retries now preserve an earlier uncertain outcome even if a later retry
returns a confirmed SQL rejection. A later rollback does not disprove an earlier
successful commit. Empty/non-UUID creation receipts, mismatched preview source,
blank revisions/titles and invalid/duplicate recipient records are rejected.
The close locking query includes actor membership before taking the row lock.
Seven source/synthetic checks pass; real SQL parsing and transaction tests remain
unverified. Activation remains disabled.

Read-only acceptance discovery: connected Supabase inventory contains CG Hours and
CG Dynamics production projects; CG Dynamics development-branch list is empty.
No production SQL was executed and no paid branch was created. Cloud has no
PostgreSQL/Docker or installed PostgreSQL parser. Prior denied Docker/Windows
sandbox routes were not retried.

Concrete next step: supply a permitted writable isolated checkout/runtime with
an already available postgres:17-alpine image and authorized Docker daemon, then run:
RUN_NOLAN_DECISION_DB_TESTS=1 node --test tests/nolanDecisionDatabase.test.mjs
This test deliberately refuses image pulls and has no networking/host ports.
A passing minimal-dependency fixture is only the first gate: repeat with canonical
schema/profile policies, real concurrent sessions and legitimate same-origin
test identities before enabling UI. Alternatively an explicitly authorized,
isolated non-production database could host the synthetic fixture; production
and new billable branches are not substitutes without separate authorization.

## 16 November recovery regression receipt

Recovered published head a6190cb into an isolated checkout. The complete Nolan
source/synthetic test selection exposed two stale assertions from before the
identity/month scope isolation change. Updated them to require the scope-aware
read dependency and website remount key; added an explicit snapshot scope check.
No application guard, source behavior, database SQL or activation flag changed.
All 79 executable Nolan tests pass; the disposable PostgreSQL test remains
skipped because no permitted runtime is available. TypeScript/Vite build and diff
check pass. Full-suite verification is not claimed: a run with synthetic port
54321 hit an unrelated portal fixture that hardcodes port 1; that fixture passes
all six cases with matching port 1. Real database/concurrent-session and signed-in
browser acceptance remain open. No migration, merge or deployment.


## 16 November cloud PostgreSQL acceptance (supersedes runtime blocker above)

The fresh saved CG-Dynamics cloud runtime provides Debian 13 x86_64, Node
24.19.0, npm 11.9.0 and an independently accessible Docker 28.4.0 daemon.
No PostgreSQL binary/image was preinstalled. The official Docker Library image
`postgres:17-alpine` was downloaded from the recognized Docker Hub source:
`postgres@sha256:a77aa70e641402a21411b92b721c58d10f23b50ae5fdd2333efd22d166e1e5f7`.
It reports PostgreSQL 17.12. This is the fresh cloud runtime, not a retry of the
previous denied Windows/Dot route. No sandbox/security setting was changed.

The unchanged draft SQL executed successfully on the synthetic dependency tables.
The expanded real PostgreSQL fixture passes 12 tests, zero failures/skips. Seven
subtests use separate psql sessions and verify `pg_stat_activity.wait_event_type`
is `Lock` before releasing the first transaction: identical retry deduplication,
conflicting key reuse, response/withdrawal in both orders, source edit versus
create, source edit versus response, and recipient revocation versus response.
Additional checks cover client/team/staff/inactive/unknown/anonymous RPC denial,
direct table/helper denial, integer-overflow rollback, and explicit >500 coverage
failure. Original role/revision/idempotency/non-mutating-response checks remain.

An actual fixture startup race was reproduced and fixed: `pg_isready` could accept
the image entrypoint's temporary bootstrap server before its restart. Readiness
now also requires container PID 1 to be postgres. No application/SQL defect was
found by these cases; no application, SQL, dependency or activation change.

Reproduce from the repository root with the image already present:

```sh
RUN_NOLAN_DECISION_DB_TESTS=1 node --test tests/nolanDecisionDatabase.test.mjs
```

Every database fixture uses `--pull=never --network none`, tmpfs data, no host
ports or mounts, synthetic identities and exact generated-container cleanup.
No production credentials/env files, hosted database, paid branch, MSI/social
checkout, migration, merge or Vercel operation was used. `NOLAN_DECISIONS_ACCEPTED`
and `git.deploymentEnabled` remain false.

This closes only isolated PostgreSQL execution and the listed synthetic-schema
transaction cases. Full canonical schema/profile-policy migration replay,
same-origin authenticated UI/test-identity and desktop/mobile acceptance remain
open. Synthetic auth.uid() is a fixture identity, not real authentication proof.
Promotion to an automatic migration, UI activation and release remain separately
gated; the SQL stays under docs/ops/sql.


Local dependency setup used the unchanged lockfile:
`npm ci --ignore-scripts --no-audit --no-fund --cache /tmp/nolan-npm-cache`.
The initial default-cache attempt failed because `/home/agent/.npm/_cacache` was
not writable/available; using the permitted /tmp cache required no permission or
sandbox change. No dependency versions or package manifests changed.

Local `npm run build` passed with `VITE_SUPABASE_URL=http://127.0.0.1:1` and
`VITE_SUPABASE_PUBLISHABLE_KEY=synthetic-test-key`. The emitted
`dist/assets/MyWorkPage-Bqki3EFh.js` contains the real Needs You disabled-state
application text. Scoped `npx eslint tests/nolanDecisionDatabase.test.mjs` and
`git diff --check` pass. No production env file was read.


Final full suite: **4,414 tests, 4,384 pass, 30 optional skips, zero failures or
cancellations**, exit 0 in 222.99 seconds, including all 12 real PostgreSQL checks.
Command: `VITE_SUPABASE_URL=http://127.0.0.1:1 VITE_SUPABASE_PUBLISHABLE_KEY=synthetic-test-key RUN_NOLAN_DECISION_DB_TESTS=1 npm test`.
All generated Nolan database containers were absent after completion.

## 16 November canonical policy replay continuation

Continued from verified remote head `2d2fc2a66d01aeadac38489d0a4ccfdb9b1d72b9`.
The same opt-in database test now runs both the original minimal fixture and a
repository-wide replay fixture. The latter applies unmodified repository SQL,
including the real profiles/native-task tables, triggers and policies. The
helper `tests/helpers/nolanCanonicalSchema.mjs` records every attempted file,
SHA256, result and error plus the resulting policy catalogue and installed
extensions. Unknown replay failures fail acceptance; eleven explicit non-Nolan
replay gaps are documented, never silently treated as successful application.

The natural legacy phase order must put bare foundation phases before lettered
additions: `phase-6-cg-planner-core.sql` before `phase-6e-teams-planner-import.sql`.
The older generic replay script's `sort -V` does the opposite. The new harness
corrects that order and explicitly defers four legacy additions until their
metric-registry/content-guideline foundations exist. No historical migration or
shared replay script was rewritten, and no production migration was run.

Real PostgreSQL checks now cover canonical admin/manager/staff/client source
visibility, own-profile reads, denied staff role escalation/manager profile
mutation, named-recipient versus source-reader authority, timestamp-trigger and
full-row non-title revision invalidation, timezone-invariant previews, concurrent
requester deactivation, recipient role revocation and authenticated source
mutation, plus source/auth-user deletion restriction. Original role, idempotency,
CAS, response/withdrawal races and overflow/coverage cases run against both schemas.
The affected database selection passes 30 tests (12 minimal, 18 repository replay).
No defect in the draft decision SQL was demonstrated; activation remains false.

Scope is deliberately precise: 202 of 213 repository SQL files fully apply.
Eleven remaining failures include two missing Storage-schema dependencies, seven
real-client-dependent backfills/seeds, a legacy date/text SQL mismatch and a
legacy duplicate source seed. Failed nontransactional files may have applied
preceding statements. This is NOT complete whole-database/Supabase parity.
The exact manifest and current policy catalogue are recorded in
`NOLAN-CANONICAL-REPLAY-2026-11-16.md`.

Platform boundary: PostgreSQL 17.12 with pgcrypto, synthetic auth.users columns
and auth.uid()/auth.role() plus explicitly emulated Supabase API default grants.
No public application policy is mocked. The auth scaffold is NOT GoTrue sign-in,
JWT verification, PostgREST or hosted Supabase proof. Storage, vault, cron and net
services/schemas are not approximated. The repository-referenced Supabase image
`public.ecr.aws/supabase/postgres:17.6.1.159` could not be fetched: the registry
returned `Forbidden`; the existing official PostgreSQL image remained the runtime.

Browser feasibility: Chromium and Python Playwright are installed, but no local
GoTrue/PostgREST/Supabase CLI backend is installed. A clean headless Chromium
launch with `chromium_sandbox=True` terminated during startup with crashpad and
setuid-sandbox initialization errors. No retry disabling the sandbox, copied
production session, injected authenticated state, server/port exposure or mock
login was used. No signed-in, responsive visual or physical-device acceptance is
claimed. The smallest next environment requirement is a working sandbox-enabled
browser and a genuine isolated local Auth/PostgREST stack with synthetic accounts
and same-origin routing. Full replay additionally requires real Supabase platform
schemas and reviewed handling of the explicit legacy/data-dependent failures.

The prior PR-description publication denial remains in force: no retry, rewrite
through another tool, comment, merge or release. Source/test evidence stays on
existing draft #990; the MSI/social lane and production resources remain untouched.


Final continuation verification: **4,432 tests, 4,402 passed, 30 optional skips,
zero failures/cancellations**, exit 0 in 227.81 seconds. Includes all 30 real
PostgreSQL tests. Local TypeScript/Vite build passed (10.29s Vite phase); emitted
`MyWorkPage-Bqki3EFh.js` retains actual application code and disabled Needs You
copy. Scoped ESLint and diff checks pass. No generated database container remains.

```sh
RUN_NOLAN_DECISION_DB_TESTS=1 node --test tests/nolanDecisionDatabase.test.mjs
VITE_SUPABASE_URL=http://127.0.0.1:1 VITE_SUPABASE_PUBLISHABLE_KEY=synthetic-test-key RUN_NOLAN_DECISION_DB_TESTS=1 npm test
VITE_SUPABASE_URL=http://127.0.0.1:1 VITE_SUPABASE_PUBLISHABLE_KEY=synthetic-test-key npm run build
npx eslint tests/nolanDecisionDatabase.test.mjs tests/helpers/nolanCanonicalSchema.mjs
git diff --check
```


## 16 November genuine Auth/API acceptance continuation

The missing local Auth/API capability is now resolved for backend tests. Official
pinned GoTrue v2.197.0 and PostgREST v14.18 run with PostgreSQL in one isolated
network namespace, no external network or host ports. GoTrue owns its real auth
schema/functions; five synthetic accounts sign up and password-sign-in normally.
PostgREST verifies the actual issued JWTs before canonical RLS/RPC checks.
Ten Auth/API tests pass; the combined real-DB/Auth selection passes 42 tests.
This includes existing-token deactivation/role revocation, signature/password
rejection, source revision, recipient isolation and refresh-session logout.
Already-issued access tokens remain valid until expiry; no instant logout-token
revocation is claimed. Application activation remains false.

All eleven replay gaps are now classified by dependency impact. The date/text
and duplicate-source conflicts reproduce in real PostgreSQL after dependencies
exist; the latter also fails under either insertion order. They do not block the
narrow decision/profile/task path, but remain unrelated fresh-install gaps.
No real client/contacts were fabricated/imported to make backfills pass.

Read [runtime, exact tests, gap classification and remaining gates](NOLAN-AUTH-API-ACCEPTANCE-2026-11-16.md).
The old missing-Auth/PostgREST blocker is superseded by this backend receipt;
working sandboxed-browser, same-origin UI and physical-device acceptance remain
open. Chromium was not retried and the prior PR-description denial was respected.

Final aggregate for the Auth/API continuation: 4,444 tests, 4,414 passed, 30
optional skips, zero failures/cancellations, exit 0 in 247.76 seconds with both
RUN_NOLAN_DECISION_DB_TESTS=1 and RUN_NOLAN_AUTH_API_TESTS=1. Separate affected
selection: 42/42 pass. Build/emitted application bundle, scoped lint and diff
checks pass. All generated containers cleaned up; source and activation unchanged.
