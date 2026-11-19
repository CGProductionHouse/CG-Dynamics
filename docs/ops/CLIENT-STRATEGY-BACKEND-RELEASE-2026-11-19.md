# Strategy connector release packet — 19 November 2026

**Review-ready; NOT DEPLOYED.** Same DRAFT PR #1003. This is a Supabase-only,
two-file strategy correction. No Vercel operation, migration or strategy write
is included in preparing this packet. Passing the local verifier grants no
deployment authority.

## Why the release must use the live source

The live `cg-dynamics-mcp` connector contains newer publishing, credential and
catalogue modules from the other agent's lane. A deploy from this Git worktree
would replace them with older or missing files. Do not deploy the repository
function directory wholesale.

Instead, the prepared runtime source starts with all **70 files retrieved from
live version 90**, replacing only:

| Source file | Reviewed candidate SHA-256 | Live rollback SHA-256 |
| --- | --- | --- |
| `src/lib/monthlyStrategySeed.ts` | `edc738789c19c9c67eda5a4b2a8a3637e8ecc5d329cc35e635c6c21c6d5f010a` | `e55fd27008ce09fba5932c42bbb6b2081a12416fdb691c34d65f0d83976eb606` |
| `supabase/functions/_shared/monthlyStrategyProposal.ts` | `e361028b549e9307662f12f7c4f0715fbf22a8c51df9300b2fcc62023ffba7bf` | `81a7623c16554db130449243068c531b5e31aabc72ad16bf337a8d3174a19355` |

The other **68 files are byte-for-byte live version 90**, including its entrypoint,
OAuth/authentication, Project context, tool catalogue, OneDrive and social
publishing modules. No keys, secrets or credentials are in this packet.

The heading correction admits bounded existing evidence for Hino Trucks, Jenkor,
Peyper Bonds, Supa Quick BFN, Toyota Bloemfontein and WiseRide. The merge correction
preserves readable paragraph breaks and the existing exact staff-ownership rules.
The [18 reviewed Nov–Jan candidates](client-readiness/2026-11-19-strategy-guide-heading-candidates.json)
remain **unapplied**. This release alone does not save, approve or publish them.

## Exact target and rollback

| Field | Value |
| --- | --- |
| Repository / PR | `CGProductionHouse/CG-Dynamics`, existing DRAFT #1003 |
| Reviewed overlay source commit | `98fded5a634341b112f48af2b064c486f4d912fd` |
| Refetched main | `b524a9f91d61a5727db355194db2a988594b8af1` |
| Supabase organisation | `cgwucfjufkuunddzmuyf` — CG's Pro Org |
| Production project | `ehtjfntukiwbgptqgbzy` — CG Dynamics' Project, eu-west-1 |
| Function | `cg-dynamics-mcp` |
| Function ID | `d09bd8ae-dc7d-47ca-b30e-7210c2e3f66d` |
| Required live preimage | Version **90**, ACTIVE; full source retrieved again at 19:37 UTC and unchanged |
| Existing gateway setting | `verify_jwt=false`, unchanged; body retains its custom OAuth gate |
| Entrypoint | `supabase/functions/cg-dynamics-mcp/index.ts` |
| Import map | None, unchanged |
| Live archive fingerprint | `5b7668d35da8caa13239dd7b656b37fb4448321ff2d15d09dd50dd65737cb6ca` |
| Source upload allowlist | [70-file manifest](client-readiness/2026-11-19-strategy-backend-release-manifest.json) |
| Release owner | Current PR #1003 strategy lane; coordinate the exact window with the live connector owner |

Private local storage:
`C:\Users\chris\.codex\artifacts\strategy-backend-release-2026-11-19\`.

- `cg-dynamics-mcp/rollback/` and `rollback-manifest.json`: exact live-90 source.
- `cg-dynamics-mcp/runtime-source/`: the exact 70 candidate files, no harness,
  test files, `package.json`, dependencies or extra configuration.
- `cg-dynamics-mcp/candidate/`: private test harness only; **never upload this directory**.
- `monthly-strategy-autopilot/rollback/`: separately archived live-51 source;
  **excluded from this release**.

Do not deploy `monthly-strategy-autopilot`, `meta-sync`, a background worker,
scheduler, frontend, logo, migration or another function. Keep all flags unchanged.
The canonical draft, review, approval and explicit-publication workflow is unchanged.

## Usage, budget and availability preflight

Read-only inspection used the existing company Chrome profile, signed in as
CG Production House. A separate tab was opened; the other agent's Search Console
and Dynamics tabs were preserved. No Vercel tab or tool was used.

The [Supabase organisation Usage page](https://supabase.com/dashboard/org/cgwucfjufkuunddzmuyf/usage)
was inspected this turn, before the 19:37:40 UTC receipt, for **14 Nov–14 Dec 2026**:

| Measure | Observed usage | Included allowance | Observed remaining |
| --- | ---: | ---: | ---: |
| Edge Function invocations | 44,975 | 2,000,000 | 1,955,025 |
| Egress | 2.367 GB | 250 GB | 247.633 GB |
| Storage | 0.005 GB | 100 GB | 99.995 GB |
| Monthly active users | 23 | 100,000 | 99,977 |

The dashboard said quota was not exceeded and overages were not currently billed.
It warns usage may take an hour to refresh. This is observed headroom, not a
promise of future cost or an organisation configuration change.

Proposed release budget: **$0 additional spend**, no paid add-on or new resource.
Reserve at least **1,000,000 invocations, 100 GB egress and 10 GB storage headroom**
for existing production; permit at most **100 explicit acceptance calls**, excluding
normal customer traffic. The release invokes no AI model or provider refresh.
Recheck live usage immediately before release. Stop if usage is unavailable,
delayed beyond the available evidence window, near the reserve, or if new spend
would be needed. No budget protection may be changed.

**Release/budget authority is pending.** The hosting policy in #679 requires
explicit authority for cloud deployment and a maximum extra spend. This packet
does not create that authority. The ordinary continuation/push is not a release.

Pre-release HTTP checks this turn: both portal login origins return **200**
(the apex redirects to `www`); public connector OAuth metadata returns **200**;
an unauthenticated MCP POST returns **401** with the correct resource-metadata
challenge. These are uptime/auth checks, not authenticated client acceptance.

## Verified locally

- **91/91** tests against the actual live-based candidate: proposal/workspace,
  OAuth discovery, exact Project/client context and existing release contracts.
  These include draft-only writes, source/version races, staff preservation,
  retry/idempotency and cross-client denial.
- **146/146** focused source-worktree strategy, package, guide, worker-contract,
  renderer and release-preflight tests in a serial run, followed by the final
  **8/8** preflight suite including one additional manifest/source binding
  regression (**147 distinct checks**). Counts overlap the candidate suites;
  do not add them as distinct tests.
- The local verifier passes on all 70 actual candidate files and the fresh
  live-source observation. Its eight regressions refuse newer/stale live state,
  provider/auth/catalogue changes, extra/missing/tampered files and wrong identity.
- `npm run build` (TypeScript + Vite) and scoped ESLint pass. Existing non-fatal
  bundle-size and Browserslist-age notices remain. The release receipt also
  records the final `git diff --check` result.
- Official **locally cached** Supabase Edge Runtime **v1.74.3** bundles both the
  strategy-workspace graph and the complete live-based connector entrypoint.
  No server was started, production credential supplied or cloud build invoked.

| Local runtime bundle | Bytes | SHA-256 |
| --- | ---: | --- |
| Strategy workspace | 676,107 | `0bf7a049a52a66c39c1367c2ecce70647207ab90448e7625e965e9e876416172` |
| Full connector | 2,475,457 | `d1ac4402830f466dad1103b74283984667764258c5318d92cfe1e2c33f7ed0c9` |

An initial offline whole-entry bundle could not fetch the existing public SDK;
a second harness attempt exposed its test-only `package.json` to Deno. The final
successful full bundle uses the exact runtime-only 70-file tree, fetching only
its existing public SDK dependencies. No dependency or production configuration
was added. Bundling is not a separate Deno type-check or hosted acceptance.

Fresh READ ONLY production readback at **19:41:26 UTC** confirms all **63 active
client/package hashes, 52 selected guide hashes and 141 Nov–Jan strategy hashes**
still match the previous accepted source-review snapshot. No changes or removals.
The 77 saved drafts and 16 earlier corrected live plans remain protected.

[Machine-readable verification receipt](client-readiness/2026-11-19-strategy-backend-release-verification.json)
records the manifest hash, exact readback counts, runtime bundle hashes, usage,
test results and pending release authority. It is an observation, not an apply file.

## Guarded release and acceptance — not executed

1. Require explicit CA authority for this exact Supabase-only change and proposed
   $0 extra spend. Confirm a non-overlapping connector release window. Re-read the
   owning PR/issues and current usage; capture portal and MCP uptime checks.
2. Retrieve `cg-dynamics-mcp` again through the official read tool. Require version
   90, ACTIVE, same JWT/import-map configuration and **all 70 rollback source hashes**.
   Record a real `observed_at` timestamp. Never refresh a timestamp without reading
   the live source. **Any drift stops this packet.** Rebase onto newer live source,
   get a newly reviewed manifest and repeat verification before another release.
3. Run the local, zero-write guard against that new observation:

   ```powershell
   node scripts/ops/verify-strategy-backend-release.mjs --manifest docs/ops/client-readiness/2026-11-19-strategy-backend-release-manifest.json --observed-live C:\Users\chris\.codex\artifacts\strategy-backend-release-2026-11-19\cg-dynamics-mcp\live-observation.json --candidate-root C:\Users\chris\.codex\artifacts\strategy-backend-release-2026-11-19\cg-dynamics-mcp\runtime-source
   ```

   The observation is valid for at most 15 minutes. Retain a verified rollback
   copy independent of the candidate. Upload **only** the 70 manifest paths.
4. One official `deploy_edge_function` request may replace only `cg-dynamics-mcp`,
   project `ehtjfntukiwbgptqgbzy`, entrypoint as above, `verify_jwt=false`, no import
   map. Read each upload body from `runtime-source/` after the guard passes.
   Do not send the harness, the whole checkout, extra files, a new configuration
   or another function. No repeated deployment on ambiguous response: read back first.
5. Immediately retrieve the new function. Require ACTIVE, original JWT/import-map
   settings, identical 70 paths and each candidate source hash; recheck OAuth 200,
   unauthenticated 401 and portal uptime. Verify one ordinary authenticated
   company-admin read and a genuine client-context denial. Never disclose tokens.
6. Re-read each of the six exact client/month briefs. Require real
   `ready_for_proposal`, exact active client, unchanged confirmed package,
   current guide and source fingerprint, and draft ownership. Published/reviewed
   rows remain untouched. A missing or changed source holds that exact row.
7. Only then, within the already-authorised editorial task, refresh and compare
   the 18 reviewed candidates. Use the existing canonical version-fenced draft
   tools: twelve exact amendments and up to six exact January creations, with
   stable per-client/month/action idempotency keys. Do not replay the JSON packet
   as an apply manifest. Preserve notes, seed history and WiseRide's private legacy
   context. Require the candidate quality/package checks again. No approval or
   publication is authorised by this packet.
8. Re-read saved rows, revisions and retry receipts. Recheck all unselected row,
   package and guide hashes, published projections and foreign-client denials.
   Record exact saved/held counts, final function version and source hashes.
   Report any incomplete acceptance truthfully; no physical phone check is claimed.

## Failure and rollback

Stop on identity/source/version drift, permission or auth regression, failed read,
quality or package conflict, data leak, unexpected write, budget reserve pressure
or failed uptime. Preserve the actual error and source/version evidence.

For a regression attributable to **this exact new connector version**, verify
that no intervening agent release has happened; then use the one exact live-90
rollback source set and original auth/entrypoint settings. Re-read its 70 source
hashes and health checks. If another version has appeared, stop and coordinate
instead of overwriting it. Never blindly restore the worktree or an older bundle.

Deployment rollback does not roll back strategy data. If a later exact draft
requires correction, compare its current revision and use the canonical staff
amendment contract with a new auditable idempotency key. Never SQL-overwrite saved
staff work, delete history or alter a published snapshot to hide a problem.

No migration, provider/OAuth/secret/config/mapping change, automatic strategy
publication, media publishing, package/calendar change or Vercel operation is
part of this release. The seven unstructured-guide and four missing-guide holds,
plus the fifteen scope holds, remain explicitly unresolved.
