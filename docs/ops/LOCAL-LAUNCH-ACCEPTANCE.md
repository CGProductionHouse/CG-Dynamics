# Integrated local launch acceptance — #668 / #679

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
contracts: seven exercise desktop/375/390/430, the two older service-management
fixtures exercise desktop/390. Do not claim every fixture checks all widths.

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
