# Nolan isolated Auth/API acceptance — 16 November 2026

Continuation of draft PR #990 from verified remote/local `e64587803cfd3f1cd8a5f7da7814822c78df8771`.
This is real backend sign-in/JWT/REST acceptance, not browser, same-origin gateway,
physical-device or production acceptance. Needs You and Git deployment remain false.

## Runtime and isolation

Debian 13 x86_64, Node 24.19.0, Docker 28.4.0. Pinned official images:

| Service | Version | Immutable image |
| --- | --- | --- |
| PostgreSQL | 17.12 | `postgres@sha256:a77aa70e641402a21411b92b721c58d10f23b50ae5fdd2333efd22d166e1e5f7` |
| Supabase Auth / GoTrue | v2.197.0 | `supabase/gotrue@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b` |
| PostgREST | v14.18 | `postgrest/postgrest@sha256:c7cd7e265a85b05248abf53f4473fcec7e327c282d0bd0cf60f1551996d09fcf` |

Auth and REST versions were selected from the [official Supabase compose file](https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml), downloaded once from their official Docker Hub repositories, then pinned by verified image digest. [GoTrue version documentation](https://github.com/supabase/auth/blob/v2.197.0/README.md).
This did not retry the unavailable ECR PostgreSQL image or any denied operation.

The test creates three uniquely named disposable containers. PostgreSQL uses
`--network none` and tmpfs data. Auth and REST share only that container's network
namespace, bind its loopback interface, and have no host port bindings or host
mounts. The test asserts these properties and that the REST authenticator is
neither a superuser nor BYPASSRLS. HTTP requests execute inside the container.
The client's inherited HTTP proxy is disabled only for its fixed loopback URL;
no external network, firewall, security policy or sandbox setting is changed.
Exact generated containers are removed in reverse order even on failure.

GoTrue owns and migrates its actual auth schema, including auth.uid()/auth.role().
No synthetic auth.users table, fake bearer, signed-in state injection or custom
user-token signer is used in this mode. JWT signing secrets, DB passwords and
user passwords are randomly generated for the disposable runtime; tokens remain
in process memory and are never printed or committed. No production credentials
or env files are read.

Five `example.invalid` accounts sign up through GoTrue and obtain access/refresh
tokens through the password grant. Local email auto-confirm is enabled so the
isolated test does not send email; real email delivery/confirmation is NOT tested.
The repository's real signup trigger creates each profile as client despite
caller metadata requesting admin. Only fixture provisioning SQL subsequently
assigns explicit synthetic roles; actual tested requests use the GoTrue-issued
JWT, verified by PostgREST and evaluated by canonical RLS/RPC logic.

## Verified behavior

`tests/nolanDecisionAuthApi.test.mjs` passes ten tests including its parent:

- Genuine password sign-in, automatic canonical profile creation, metadata cannot promote role.
- Own-profile RLS and administrator-only producer; actor comes from the verified JWT.
- Same-key create retry returns one receipt; named-recipient isolation and unrelated-user denial.
- Staff/client RPC denial and direct private-table denial for every tested role.
- Missing bearer, tampered signature and wrong password are rejected.
- Already issued JWTs cannot bypass current profile deactivation or role revocation.
- Requester deactivation immediately denies preview/create with the existing token.
- Changed canonical source revisions reject create and response; pending/version state survives.
- Response changes only the decision record; repeated stale CAS fails and source task stays unchanged.
- GoTrue logout revokes the refresh session. The already-issued stateless access JWT remains valid until expiry; this is explicitly observed, not misreported as immediate access-token revocation. Current profile/RPC checks provide immediate authorization denial.

The combined affected selection passes **42 tests**, zero failures/skips:
12 minimal PostgreSQL, 20 canonical replay PostgreSQL, 10 genuine Auth/API.
The real-auth replay has the same 202/213 fully applied repository files and
same eleven disclosed gaps as the SQL-only replay. No decision SQL or application
behavior was changed to obtain these results.

Initial harness-only startup issues were corrected: platform auth helpers must
be owned/installed by GoTrue's migrations rather than precreated by postgres;
loopback health requests must not be routed through the inherited HTTP proxy.
Neither correction bypasses authentication, RLS, sandboxing or network isolation.

## Eleven replay gaps and native-path relevance

All `profiles` and `command_centre_tasks` schema/policy dependencies and the draft
decision SQL apply. None of the eleven gaps changes these relations, their role
helpers or the four decision RPCs. This establishes the narrow path, not full
application/platform/data parity. Failed files can have applied preceding
statements. See [full ordered manifest and policy catalogue](NOLAN-CANONICAL-REPLAY-2026-11-16.md).

| Failed file (under supabase/) | Classification | Relevance |
| --- | --- | --- |
| `phase-22a-content-guide-publication-gate.sql` | Legacy SQL type defect: date compared with text | No native task/profile/decision dependency. Frontend guide reader uses the later `client_portal_published_content_guidelines` RPC, not this legacy `client_portal_published_guides`. |
| `phase-24b-ingestion-support.sql` | Missing platform `storage.buckets` | Knowledge ingestion/storage acceptance remains open; no native decision dependency. |
| `phase-24f-client-candidate-cards.sql` | Seed references an absent real client UUID | Marketing skill-card data, not native decision authority. No client identity fabricated. |
| `phase-28a-marketing-library-repo-source-registration.sql` | Legacy seed/uniqueness conflict | Library source registration, not native decision authority. Both seed orders cannot satisfy the existing uniqueness rule without reviewed reconciliation. |
| `migrations/20260907150843_content_review_foundation.sql` | Missing platform `storage.buckets` after public review objects | Creative-review upload/storage remains unaccepted. No missing native task/profile/decision object; not proof of complete publication/review workflow. |
| `migrations/20260909110000_client_contact_pilot_backfill.sql` | Requires exact existing Cape client | Historical contact data, not decision/source/profile schema. |
| `migrations/20260909120000_client_contact_piek_backfill.sql` | Requires exact existing Piek client | Historical contact data, not decision/source/profile schema. |
| `migrations/20260909130000_client_contact_wiseride_backfill.sql` | Requires exact existing WiseRide client | Historical contact data, not decision/source/profile schema. |
| `migrations/20260910100000_client_runtime_projection_backfill.sql` | Requires 52 exact existing client identities | Client guide/context data completeness remains unverified; package evidence reads these sources, but none is decision-recipient authority. Missing data must remain missing. |
| `migrations/20260910120000_client_contact_securiforce_backfill.sql` | Requires exact existing SecuriForce client | Historical contact data, not decision/source/profile schema. |
| `migrations/20260921143900_peyper_bonds_alissa_contact.sql` | FK to absent exact client | Historical contact data, not decision/source/profile schema. |

No real clients/contacts were imported or identities fabricated to satisfy these
historical backfills. No failed replay was promoted into success.

## Bounded reproduction of two legacy defects

Two real PostgreSQL subtests were added to the canonical fixture:

1. After all available dependencies exist, information_schema still reports
   `content_guide_ideas.month` as date. Running the unchanged phase-22a SQL inside
   a rollback-only transaction fails on `g.month = to_char(p_month, 'YYYY-MM')`.
   The field was already date in its defining phase-19d file. This is a legacy
   fresh-install SQL incompatibility, not a missing table or harness ordering error.
2. Running unchanged phase-28a again inside a rollback-only transaction conflicts
   with `marketing_library_sources_title_year_edition_uidx` on TikTok Creative
   Center. Phase-25b supplies an official-URL source; phase-28a supplies a distinct
   repo identifier for the same normalized title and absent year/edition. Its
   ON CONFLICT handles source_identifier only. A temporary PostgreSQL table with
   the exact expression index rejects the two identifiers in either seed order.
   Swapping order changes which insert fails; it does not resolve the identity
   conflict. The canonical index and source rows are never weakened or deleted.

These are retained as explicit unrelated fresh-install gaps; no historical
migration/generator or production Library architecture was rewritten in #990.

## Reproduction and remaining gates

Preload the official pinned images, then from this repository:

```sh
RUN_NOLAN_AUTH_API_TESTS=1 node --test tests/nolanDecisionAuthApi.test.mjs
RUN_NOLAN_DECISION_DB_TESTS=1 RUN_NOLAN_AUTH_API_TESTS=1 node --test tests/nolanDecisionDatabase.test.mjs tests/nolanDecisionAuthApi.test.mjs
VITE_SUPABASE_URL=http://127.0.0.1:1 VITE_SUPABASE_PUBLISHABLE_KEY=synthetic-test-key RUN_NOLAN_DECISION_DB_TESTS=1 RUN_NOLAN_AUTH_API_TESTS=1 npm test
VITE_SUPABASE_URL=http://127.0.0.1:1 VITE_SUPABASE_PUBLISHABLE_KEY=synthetic-test-key npm run build
npx eslint tests/nolanDecisionAuthApi.test.mjs tests/nolanDecisionDatabase.test.mjs tests/helpers/nolanCanonicalSchema.mjs
git diff --check
```

No Chromium launch was retried. Browser acceptance still needs a supported
sandbox-enabled browser and same-origin local app/Auth/API routing; this test
calls the two service ports only inside their isolated namespace. No production
or physical-device acceptance is claimed. Full Supabase platform parity and the
classified legacy/data gaps remain open. Activation, automatic migration
promotion, merge and release require their existing separate gates.

The denied PR-description action was not retried or rephrased elsewhere. No MSI,
social lane, production service, paid service or Vercel resource was touched.

## Final aggregate verification

Full suite with both opt-in fixtures enabled and the established synthetic port-1
origin: **4,444 tests, 4,414 passed, 30 optional skips, zero failures/cancellations**,
exit 0 in 247.76 seconds. The 42 affected real database/Auth tests also passed
separately in 48.82 seconds. TypeScript/Vite build passed (Vite phase 11.13s),
emitted `MyWorkPage-Bqki3EFh.js` contains the actual disabled Needs You application
copy, scoped ESLint and diff checks pass. All generated Nolan containers were
absent after completion. Draft SQL, application code and both off guards are
unchanged from e645878.

## Browser-runtime investigation after a4a8212

Remote and local head were verified as `a4a8212fcc72a1f039149cf5bc27d1e2c7a5de55`
before this documentation-only continuation. No browser UI acceptance was obtained.

Read-only Chromium diagnosis:

- `/usr/lib/chromium/chrome-sandbox`: owner UID/GID **65534:65534**, mode **4755**,
  not the root-owned setuid helper required for that sandbox route.
- Current shell: effective capabilities **0**, `NoNewPrivs=1`, `Seccomp=2`.
  The user namespace maps only inside UID 1000 to outside UID 0, one ID; root
  ownership is not available inside this process namespace.
- Earlier launch with `chromium_sandbox=True` reported crashpad database-path
  errors and terminated at setuid-sandbox initialization. The ownership and
  no-new-privileges evidence explains why the installed setuid-helper route
  cannot work here. This does not prove every user-namespace browser route is
  inherently impossible; none is demonstrated as supported in this runtime.
- Chromium was NOT relaunched. No helper ownership/permissions, capabilities,
  sysctls, firewall, sandbox flags or host settings were changed.

Python Playwright **1.62.0** is installed, but its matching Chromium, Firefox and
WebKit binaries are absent. There is no callable native browser/computer tool in
this task's available tool catalogue. One official local-cache-only Firefox
installation was attempted:

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/nolan-playwright python3 -m playwright install firefox
```

The installer selected **Firefox 153.0 / Playwright build 1538** for Debian 13.
Its official endpoints returned **HTTP 403 `Domain forbidden`**:

- `https://cdn.playwright.dev/dbazure/download/playwright/builds/firefox/1538/firefox-debian-13.zip`
- `https://playwright.download.prss.microsoft.com/dbazure/download/playwright/builds/firefox/1538/firefox-debian-13.zip`
- `https://cdn.playwright.dev/builds/firefox/1538/firefox-debian-13.zip`

The installer performed its own fallback/retries within that one invocation,
then exited 1. No manual retry, mirror, alternate transport, proxy change,
privileged container, system-wide install or security bypass followed. Firefox
was not installed or launched. Available user history provided no new evidence
changing that network restriction. This was a download-network rejection, not
an automatic approval-review rejection.

**Smallest remaining supported-runtime requirement:** provision an approved
browser-capable runtime with a preinstalled official browser matching its
automation driver and a functioning normal sandbox, able to reach the isolated
local app/Auth/PostgREST through approved loopback/same-origin routing. For this
installed driver, Firefox build 1538 is the exact untested candidate. Provisioning
should preserve the runtime's security policy rather than disabling its sandbox
or changing this machine's host security settings.

Until that runtime exists, signed-in rendered UI, account switching, create/retry/
resolve interactions, interruption/refresh/back navigation, error/empty states,
and desktop/narrow-width checks remain OPEN. Physical-device checks are separate.
No acceptance-only feature build or app/API server was started, no session was
injected, and no production gate was changed just to display the feature.

Only this receipt and the decision contract changed. The unchanged application/
test baseline remains the a4a8212 result: 42 affected real DB/Auth tests, full
4,414 pass/30 skip/0 fail, build/bundle/lint pass. No redundant helper tests or full
suite were rerun for this documentation-only blocker receipt; diff check passed.
