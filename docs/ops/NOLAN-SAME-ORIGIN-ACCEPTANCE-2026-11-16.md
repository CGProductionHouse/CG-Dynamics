# Nolan same-origin actual-app acceptance entry point

Continuation of draft #990 from `dc8f9ab6d1556d64ca1bacdd39436d52ed42e9f7`.
Remote branch and main (`f89fefea70108bfe417953d00330476530aa9c4d`) checked before
work. No production code, auth, schema, activation or deployment configuration
changed. The existing synthetic review artifact is untouched.

## Structured execution evidence investigation: bounded stop

The canonical task schemas/readers (`CommandCentreTask`, `PlannerTask`, ordered
`planner_task_assignees`, `planner_activity_log`) supply task/profile identity,
recorded workflow state and database audit activity. They do not supply a typed,
verified execution-agent/device receipt tied to those exact tasks. Marketing
agent keys describe marketing workflows/skills, not the coding/device task fleet.
The 27 October Nolan master handover describes hardware and proposed future
metadata, explicitly separating reported hardware from measured evidence.

Read-only GitHub #381 lookup on 16 November confirmed a coordination narrative:
its body mixes a 3 November repair with older control-plane snapshots. Issue
`updated_at` is not execution observation time. Its named worker/capacity authority
is the Google Sheet **CG AI Model and Agent Control Centre**. Connected Drive
search by name, a spreadsheet-only Control Centre search, and an exact spreadsheet
name filter did not resolve that sheet. The returned unrelated drive register was
not substituted or read. No tracker write, MSI resource access or guessed join.

Therefore no new product adapter was added. This is an unresolved accessible
source contract, not proof that no external tracker exists anywhere. Required
before a narrow read integration:

- Exact authorized source identity (for the sheet: spreadsheet ID, tab/range and
  field schema) and a supported server-side read path; no connector token in UI.
- Exact canonical task tuple (`data_origin`, native UUID), stable agent/device
  identities, and a distinction between human assignment and execution agent.
- Immutable receipt/source ID, observed action and observed-at timestamp,
  provenance/issuer, verification state, expiry/supersession/revocation semantics.
- Planned next action separate from independently observed completed action;
  permitted viewer scope and a fail-closed read/identity contract.

No new assignment database or free-text parser was invented. Product unknowns
remain honest until that contract exists.

## What is executable now

`node scripts/nolan-same-origin-acceptance.mjs --serve` starts a private isolated
fixture and builds the **actual application**, not a component mock. It binds
only an ephemeral `127.0.0.1` HTTP port and prints its origin plus private manifest
and canonical replay report paths. The manifest contains only newly generated
synthetic `example.invalid` accounts and fixture IDs; it is mode 0600 in a private
temporary directory. Never publish that manifest.

All DB/Auth/REST containers use the already-tested official pinned images from
`tests/nolanDecisionAuthApi.test.mjs`. `--pull=never` plus image inspection means
no downloads/installations. PostgreSQL has network `none`, tmpfs data and zero
host port bindings. GoTrue/PostgREST share only its isolated network namespace.
The host HTTP relay transports bytes via `docker exec` + existing `nc` to that
namespace's loopback. It preserves real statuses, headers and JSON error bodies;
it does not synthesize successful API responses, tokens or roles.

The actual application's Supabase URL is compiled to that same HTTP origin.
`/auth/v1/*` reaches real GoTrue and `/rest/v1/*` real PostgREST. Foreign Origin/Host
requests are rejected. CSP limits connections/resources to self. Unsupported
Functions/Storage/Realtime paths return 501; they are **not** mocked successes.
SPA routes, compiled assets and copied public assets are served locally. No
host-public binding, tunnel, external publication, Docker port exposure or host
security setting changes.

The existing canonical schema replay helper applies repository SQL and records
its known bounded gaps; draft decision SQL applies only inside this disposable
fixture. Genuine GoTrue signup creates accounts; fixture SQL assigns their four
synthetic profile roles and seeds one native decision task plus one Planner task,
canonical assignee and audit event. There are no imported real contacts/clients,
production secrets, copied sessions or direct auth-user/hash insertions.

Build uses `configFile:false`, `envDir:false` and explicit synthetic definitions.
Default UI keeps Needs You **off**. To exercise its real component/RPC path only
in the disposable acceptance bundle, opt in explicitly:

```sh
node scripts/nolan-same-origin-acceptance.mjs --serve --enable-decisions-for-isolated-acceptance
```

That build-only transform changes exactly the candidate's decision gate in memory;
it never changes the source file, production bundle/config or authentication.
Startup asserts production `NOLAN_DECISIONS_ACCEPTED=false` and
`git.deploymentEnabled=false`. Ctrl-C stops this run's containers/server and
removes its temporary manifest/build. No permanent service is installed.

## Approved same-host browser run

**Do not run the browser step on the currently blocked cloud browser runtime.**
Do not repeat the failed Firefox download, retry the known Chromium failure,
use `--no-sandbox`, alter namespaces/sysctls/firewall, use privileged containers,
copy cookies/tokens, or open/tunnel the port to another machine.

Smallest remaining environment requirement: an approved same-host POSIX runtime
with Node/Docker and the cached pinned images, installed Python Playwright, and a
matching/preinstalled official Chromium that successfully launches with its normal
sandbox under that user's existing security policy. The app/backend and browser
must share that host's loopback. Providing that supported environment is required;
setting the following guard variable does not override an existing denial.

In a second shell on that approved host, while `--serve` is running:

```sh
NOLAN_APPROVED_SANDBOX_HOST=1 \
NOLAN_APPROVED_CHROMIUM=/absolute/path/to/approved/chromium \
python3 scripts/nolan-same-origin-browser.py /exact/private-browser-manifest.json
```

Omit `NOLAN_APPROVED_CHROMIUM` only when the matching official Playwright browser
is already installed. The runner never installs/downloads a browser and passes
`chromium_sandbox=True` with no custom flags. No auth-state import/setSession or
CDP session attachment occurs. Every identity signs in using the actual form.

Authored assertions cover Master task/owner/unknown fields, exact-task activity,
search, 390/1440 emulated widths, failed local REST read/stale retention and
recovery, refresh/back navigation, Needs You off or explicit create/respond flow,
real sign-out/account switch, and staff/client exclusion. Only a successful run
can claim these browser checks passed. Width emulation is not physical-device QA.
Stale-revision UI, uncertain-create retry UI, immediate profile-revocation UI and
physical-device acceptance remain explicit follow-up matrix items, not covered
by that authored runner. Their existing real API tests remain separate.

## Verification performed here

No browser launched. No blocked download/runtime retry.

```sh
node scripts/nolan-same-origin-acceptance.mjs --smoke --enable-decisions-for-isolated-acceptance
RUN_NOLAN_SAME_ORIGIN_TESTS=1 node --test tests/nolanSameOriginAcceptance.test.mjs
```

Real smoke passed. Final affected test selection: **3 passed, 0 failed, 0 skipped**
in 37.69 seconds. Runtime: Node 24.19.0, Docker 28.4.0, Python 3.12.14. It checks actual app HTML/JS serving, private manifest, same-origin
rejection, explicit unsupported services, four genuine password grants and JWT
profile reads, actual Supabase SDK password sign-in/profile/sign-out, admin-only
decision preview, preserved real Auth error JSON and exact-task activity. It also
checks cancelled setup before service creation. Static assets are path-contained;
missing asset URLs return 404 rather than SPA HTML.
All owned containers were removed; `docker ps` was empty after completion.

Python AST parsing passed without executing/launching the runner. Scoped ESLint
passes for both Node scripts and the test. Full unchanged repository tests were
not rerun. Normal local production build passed (445 modules, Vite 7.21 seconds) using
the established synthetic port-1 environment; no production environment files are read. Replay limitations remain
those in NOLAN-CANONICAL-REPLAY-2026-11-16.md and the generated per-run report:
real owning policies, known unrelated legacy/data/extension gaps, no hosted
Storage/Vault/cron/net parity. Same-origin HTTP/API acceptance is now demonstrated;
authenticated browser interaction remains unexecuted until the approved host exists.
