# Nolan interactive review preview — 16 November 2026

This is a bounded offline review of PR #990 candidate
`df7699a15f8935a52da41c7e97dd47a9a23579ba`, not production integration or authenticated
UI acceptance. The file prominently says:
**Interactive review preview · sample data · not connected to live Dynamics**.

## Deliverable

Saved to ChatGPT Library as `nolan-workbook-review.html` (298300 bytes).
Local output: `/workspace/scratch/nolan-review/nolan-workbook-review.html`.
SHA256: `771fc91fdab094c03783b87c155884024d4a26b9fd9bc560fd7d6072a4082208`.
Download from Library and open locally; no server or installation required.

Rebuild with `node scripts/build-nolan-review-preview.mjs [absolute-output.html]`.
The build also emits a JSON receipt with bundled module paths and CSS hash.
42 modules include the actual NolanOverview, NeedsYou, MasterScope, ownership,
record identity, schedule/video evidence, website and package components and
`nolanOverview.css`. The harness is under `tests/fixtures/nolan-review/`.
Production components/CSS have not been replaced or modified.

Review: navigate lanes; search/filter; expand Details & source; open package
reconciliation evidence; switch sample source to unavailable after rows load;
restore it or select empty. Needs You includes current and stale questions,
resolve/withdraw, sample account switching and a lost-creation-receipt retry.
The banner provides the exact sample task UUID and interaction instructions.
Reload resets all sample mutations. Resize the browser for narrow-width review.
Source links are intercepted with an explicit offline notice. Website reporting
and app-repository inventory are not populated.

The standalone build aliases data/auth boundaries to synthetic in-memory adapters.
Only that adapter has the decision flag true; the production hardcoded flag stays
false. No Supabase/auth client, production client registry, real contact,
credential, external script/font or service is included. CSP denies connections
and all unspecified resources. All actions are local memory operations. The
normal app build contains none of the review banner/sample task/adapter strings.
This does not verify RLS, sign-in, browser execution, refresh persistence or real
physical devices. Prior real Auth/API receipts remain separate.

## Verification

Runtime: existing cloud Debian 13, Node 24.19/npm 11.9, installed esbuild/React/Vite.
No new dependencies, browser launch, external hosting or ports.

- `node --test tests/nolanReviewPreview.test.mjs`: 4 pass. Executable sample
  reader/mutation contracts, uncertainty idempotency, actor/source checks;
  server rendering of all 12 real lanes and evidence components; bundle inputs,
  executable JavaScript syntax, CSP and unchanged production guard checks.
- `VITE_SUPABASE_URL=http://127.0.0.1:1 VITE_SUPABASE_PUBLISHABLE_KEY=synthetic-test-key node --test tests/nolan*.test.mjs`:
  86 total, 83 pass, 3 skip, 0 fail (11.69 sec). The three skips are the opt-in
  real DB/Auth suites; they were not rerun or counted as PostgreSQL acceptance.
- Same synthetic environment `npm run build`: pass, 442 modules; Vite 6.81 sec.
- Scoped eslint on the build script, test and two test-harness files: pass.
  These standalone harness files explicitly exclude Vite fast-refresh lint,
  because no HMR server is involved. No production lint setting changed.
- `git diff --check`: pass. Vite tests emit existing dependency-scan/server-close
  diagnostics while shutting down; final test counters report zero failures.

## Integration rehearsal

Common ancestor: `4af41304363b4f479febc8ba1c21278bf940b907`.
A separate detached worktree combined exact main
`4ee7d503aefea9a6206baff345195d04d9d77845` (#993) with candidate `df7699a`.
Only `docs/ops/CG-DYNAMICS-OPS-HANDOVER.md` conflicted (both lanes prepend updates).
Preserving both blocks produced local tree
`72dd0f720c2741260f4b2f72e157dc3630f4aa64`; build passed (Vite 9.40 sec).

Main advanced during the run to
`f89fefea70108bfe417953d00330476530aa9c4d` (#994). A second detached worktree
repeated the combination and same bounded documentation resolution, yielding
`95495187c9cd972cf51c5c491d74f77fc98bc7bb`. Build passed (Vite 10.94 sec).
The affected selection passed: 108 total, 105 pass, 3 opt-in DB/Auth skips,
0 fail (8.28 sec):

```sh
VITE_SUPABASE_URL=http://127.0.0.1:1 VITE_SUPABASE_PUBLISHABLE_KEY=synthetic-test-key \
node --test tests/nolan*.test.mjs tests/appShellMobileNavigation.test.mjs \
 tests/authMobileViewport.test.mjs tests/clientOpeningViewport.test.mjs \
 tests/mobileAdminCleanup.test.mjs tests/workNavigationConsolidation.test.mjs
```

New mobile navigation reuses the canonical `/admin/work` route and role filters.
Nolan remains under MyWorkPage's manager/admin gate. Newer main changed mobile
shell/client/login viewport behavior, not AuthContext, MyWorkPage, commandCentre,
planner or contentWorkflow source readers. No executable source conflict or
production regression was demonstrated. The first full rehearsal found two stale
`commandCentreNavigation` assertions requiring the removed old mobile renderer
(4420 total, 4385 pass, 33 skip, 2 fail; 235.58 sec). They now execute the
actual navigation policy for admin/manager/team, assert Work/Team Work reachability
and role isolation, and preserve the manager Work-to-Morning-Import route rather
than requiring the deliberately removed duplicate mobile shortcut. The corrected
test plus preview tests pass on the existing candidate: 17/17.

The corrected latest integration tree is
`caddf088ff62874330817472abb9c4a7a4e2adef`. Full aggregate command:

```sh
VITE_SUPABASE_URL=http://127.0.0.1:1 VITE_SUPABASE_PUBLISHABLE_KEY=synthetic-test-key \
node --test tests/*.test.mjs
```

Result: **4424 total, 4391 pass, 33 skip, 0 fail**, 221.54 sec. The offline
preview's four new tests are separate and passed on the draft; they are not
included in that integration aggregate. Production source at the corrected tree
is identical to the successfully built latest integration tree. Skipped real
DB/Auth tests are not counted as fresh backend acceptance.

Shared handover additions from exact main are
preserved in this draft to resolve that demonstrated conflict; release statements
in those copied entries are main's existing records, not new deployments here.

No merge commit, rebase, deployment, production SQL/auth change, external
publication, feature activation, browser sandbox change, PR-description edit or
MSI/social resource access occurred. Both integration worktrees are disposable
local rehearsals. Authenticated same-origin browser and physical-device gates
remain open; the artifact enables owner interaction review without claiming them.
