# Integrated local launch acceptance — #668 / #679

**Live update, 7 October:** after explicit CA approval, both backend migrations and
six dependent Edge releases below were applied and verified. Their prior pending
statements are historical. See `LAUNCH-BACKEND-ACTIVATION-2026-10-07.md` for exact
deployment-time ledger versions, preserved data/access fingerprints and auth/source
readback. Frontend/Vercel and human/content publication gates are still incomplete.

Run against a clean committed candidate, not production. No Vercel command,
provider handler, copied session, migration application or production data write.
The fixed runner reuses the nine existing actual-component browser fixtures;
it does not build another application, reporting store or acceptance authority.

```powershell
$env:CG_PLAYWRIGHT_MODULE = '<existing approved local Playwright index.mjs>'
# Keep the existing Git OpenSSL directory available on PATH for its tests.
node scripts/local-launch-acceptance.mjs --plan
node scripts/local-launch-acceptance.mjs --run
```

`--plan` does not execute anything. `--run` refuses a dirty candidate, enabled
automatic Git deployment or changed build contract. Its subprocess environment
does not inherit service-role/provider/worker/Vercel credentials or production
configuration. Public Supabase values are forced to loopback synthetic fixtures.
Existing SQL tests use disposable local containers, not production databases.
No package-script lifecycle hooks or cloud commands are invoked.

Ordered proof: serial supported Node suite, TypeScript, Vite local build, full
client preview, populated Plan/Calendar/Guideline, Brand Hub/file isolation,
reporting cutoff, saved guideline context, exact CTA correction, both knowledge
review screens, service entitlement states and management resolution queue.
The last two existing fixtures include explicit *synthetic* writes to their
in-memory mock handlers, never production saves. All other production actions
remain forbidden. The actual-component checks retain their own width/assertion
contracts. All nine now exercise desktop/375/390/430; the two older service-
management fixtures have been expanded from desktop/390 for this integrated pass.

Receipts/logs are generated in the local TEMP directory and pin exact source SHA,
tree, lockfile hash, executed step exit codes, honest test totals/skips and emitted
application chunk hashes. A failed/missing test total, missing app bundle,
interrupted command or changed tree cannot earn PASS. The Windows Bash-only SES
fixture is excluded explicitly; skipped tests are never counted as passed.

**The emitted `dist` uses fixture configuration and is NOT a production artifact.**
Never upload it. The separately authorized release must build with the verified
production public configuration and use the single-artifact release procedure in
`LOCAL-FIRST-LAUNCH-FINISH-2026-10-05.md`. A local PASS is neither human strategy
acceptance, authenticated production acceptance nor authorization to publish.

## Exact remaining gates after local source closure

### Reproduced owned-site presentation defect

Actual JFJ Electrical render failed before the fix: its reviewed exact-ID CG
maintenance receipt was present, but its separately held reporting mapping sent
Website Performance to the new-site upsell. The report now reuses the existing
maintenance authority to show unavailable reporting without selling the owned
site again. No host, mapping, metric or connection is invented. Both client-row
and exact report-identity entry paths are covered; names/foreign IDs do not match.
The original four reporting identities/hosts are unchanged. Existing published
snapshot rendering is unchanged. A browser fixture exercises the held Website
tab at all four widths, with network limited to localhost GET requests.

The earlier pinned runner candidate `275d90a5e2c3a7cae963c6be21763ab6e16b7341`
passed all twelve steps: 3,705 total /3,688 PASS /17 skips /0 failures, build and
nine browsers. That receipt predates this reproduced edge-case correction and
is not a certificate for the final changed candidate; the final run is separate.

The subsequent `8b661b83` full run stopped truthfully: 3,707 total /3,689 PASS /
17 skips /1 failure. The failure was an old source-text assertion requiring the
Website component's exact previous prop list; it did not admit the new maintenance
prop. The contract assertion is updated, not removed; actual rendering/isolation
regressions remain. The runner issued INCOMPLETE_OR_FAILED, never a green receipt.

### Historical strategy manifest is not semantic approval

The older `audit-monthly-strategy-approval-manifest.mjs` independently reproduced
two misleading outputs: a formal hash/package screen labelled a row ready for
human approval, and even a blocked/empty strategy received executable transition
payloads. The pure builder now labels only historical v2 contract screening,
explicitly records semantic review not performed and emits no approval/publication
payloads, for either screened or blocked rows. V3 drift remains blocked by its
existing historical-version fence. Hash/package/source/isolation checks and
zero-write behavior are preserved. Frozen historical artifacts are NOT rewritten;
the old 94-ready manifest remains a historical receipt, not current authority.
The production-read CLI is not invoked during this local correction.

- Apply/verify the separately approved portal post-assets migration and deploy
  the narrow `client-onboarding` read scope before live full-preview file proof.
  Actual client-published files must exist; no fabricated file publication.
- Preflight/authorize the current-content review migration and coordinated
  frontend/Edge release in `SKILL-CARD-REVIEW-REVISION-433.md`. Historical null
  approvals cannot be backfilled. Individual human card review is still needed.
- The 94 strategy rows are not an approval manifest: last SELECT receipt has
  72 v3 drafts and 22 held v2 drafts, zero approved/published. Resolve genuine
  evidence gaps and perform exact-client/month semantic review. Guardrails,
  compiler output and amendment receipts do not certify marketing excellence.
  Strategy amendments/approval/publication remain separately protected.
- Review actual service agreements where entitlement remains unknown; preserve
  fixed package quantities and nulls. Existing mappings/history do not authorize
  a paid service or infer a new contractual scope.
- Use legitimate staff/client sessions for changed-runtime acceptance after its
  authorized release; local fixtures are not role impersonation or live proof.
- #505 owner/provider linking/access/consent, Website owner/DNS/measurement and
  hosting budget/uptime isolation retain their existing owners/protected gates.
  No deployment or finite shared budget can guarantee client-site uptime.

No blanket “only push left”, “94 ready” or “all data accurate” certification may
replace these named gates. Onboarding is not being resurrected as launch focus.

## Final local closure receipt — 7 October 2026

Tested code: `c8c26739b8f61ec91efe58df564b9ee0d93c0155` (PR #688).
The fixed runner completed all twelve steps between 11:41:50 and 11:52:02 UTC:
**3,707 total /3,690 PASS /17 intentional skips /0 failures /0 cancelled /0 todo**.
Windows Bash-only SES was excluded explicitly, not claimed passed. TypeScript,
local Vite build and all nine actual-component browser fixtures passed at desktop,
375px, 390px and 430px. Tree remained unchanged. Nearest 51 focused regressions,
scoped lint and diff check passed; six affected Edge import closures passed Deno
checking on the unchanged #687 Edge source. Browser fixtures use synthetic local
evidence, not authenticated production roles. No production mutation occurred.

Receipt: `%TEMP%/cg-local-launch-c8c26739b8f6.json`;
SHA256 `137fe9e5e616c5e8a5889c7d60aab0bfc1fd61aa9510dd08a91f3a0693321cdb`.
Pinned tree: `0f66fd313066e0c70bbb16cc20295eac5588fe26`.
Docs-only receipt commits do not change the tested application/tool/test source.
Fixture-configured `dist` is NOT a production artifact and MUST NOT be uploaded.

Fresh read-only production evidence on 7 October:

- 61 active clients; 57 confirmed packages; four unconfirmed: Elcheck, JFJ
  Electrical, LHP Student Village & Block, VCS Cleaning Solutions. Null stays null.
- Target September/October strategies: 72 v3 drafts plus 22 held v2 drafts;
  no frozen published strategy snapshots. Historical v1 drafts are separate.
  This is not semantic approval or permission to publish any of the 94 rows.
- Zero active published portal assets. Source code cannot substitute for genuine
  reviewed final files and explicitly authorized publication.
- Both `20261007100000_client_portal_post_assets.sql` and
  `20261007102349_skill_card_review_revision_binding.sql` absent from the live
  ledger; their new RPCs and review-binding columns also absent. **UNAPPLIED**.
- Public HEAD checks returned HTTP 200 for CG Dynamics, Piek Group, Emmanuel
  Funerals, All Around PVC and Red Oak. This proves sampled reachability only,
  not authenticated behavior, all sites, future uptime or budget sustainability.

### Bounded protected release order (not executed)

1. Obtain specific approval, recheck schema/grants/RLS and apply only the two
   separately reviewed migrations above; verify each before proceeding.
2. Coordinate their dependent frontend and affected Edge release using the
   existing runbooks. Preserve auth, credentials, activation flags and scheduler
   contracts; do not release a frontend requiring absent RPCs/columns.
3. Resolve the four exact package confirmations, individually review knowledge,
   provide genuine published assets, and resolve/review the 94 exact-client/month
   strategies. Each confirmation/amendment/approval/publication requires its own
   canonical authorized flow; no bulk inferred scope or automatic reapproval.
4. When the hosting gate is authorized, build one production-configured release
   artifact under #679's budget/rollback controls, perform legitimate authenticated
   staff/client acceptance on the changed runtime and promote once. No Vercel
   operation was performed in this local closure. Provider/owner consent and
   hosting sustainability remain separately owned gates.
