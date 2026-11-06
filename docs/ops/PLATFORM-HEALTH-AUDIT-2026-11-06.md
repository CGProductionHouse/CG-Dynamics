# CG platform health audit â€” 6 November 2026

Owner: CA. Existing hosting/uptime control: #679; supervisor: #381.
Scope: read-only current inventory, public HTTPS/asset/route checks, billing,
Supabase database capacity/advisors/logs and Dynamics integration health.
Observation window: approximately 06:15â€“06:45 UTC (08:15â€“08:45 SAST).
This is an operational audit, not a full authenticated acceptance certificate.

## Outcome

No shared Vercel suspension is occurring. All 22 discovered Vercel projects have
READY latest deployments, their standard deployment aliases respond, and the team
is active/unblocked. The 24-hour production metrics query returned 9,024 requests,
79 project/status groups and no 5xx group. This does not cover errors on other
hosting providers, Supabase, authenticated business journeys or browser rendering.

There are real issues: GitHub included Actions storage is exhausted; JFJ's custom
host serves a parked page; Imbewu has split apex/www routing; attached Dynamics
.com aliases go to a domain-sale service; some Dynamics provider/Microsoft state
is partial. Do not describe the whole estate as flawless or uncapped.

No cloud builds, uploads, promotions, deployments, DNS, budget, permission,
credential, production-data/schema or provider changes were performed. No user
or staff messages, test submissions, timesheet writes or campaign operations.

## 1. GitHub alert and exact storage remedy

The actual email is **[GitHub] You have used 100% of the Actions storage included
for the CGProductionHouse account**, delivered 6 November. It states 0.5 GB
included and reset on **1 December 2026**. The earlier 90% alert was 5 November.
This concerns CI artifacts, not hosting capacity or application media.

Read-only enumeration of all 25 visible repositories found:

- 95 unexpired artifacts, all `wiseman-responsive-screenshots` in
  `CGProductionHouse/wisemangroup-website`.
- Total **3,299,886,060 bytes** (3.30 decimal GB / 3.073 GiB).
- Latest two: artifact IDs **12109726091** and **12109585261**,
  **176,683,708 bytes** together (168.50 MiB), created 17 October.
- Exact older candidate set: **93 artifacts / 3,123,202,352 bytes**.
- No artifacts in the other 24 repositories. Separate cache inventory totals
  152,211,125 bytes across Dynamics and Red Oak; caches are a separate allowance.
- These old artifacts have 90-day expiry dates into January 2027. Billing can
  keep accumulating even when no new workflow runs. Current Wiseman main has no
  `.github/workflows` directory; do not invent an ongoing uploader on main.

**Pending CA confirmation:** permanently delete only those 93 old screenshot
artifacts, preserving the latest two, code, releases, workflow logs and sites.
No deletion is claimed performed. The exact ID/size/timestamp manifest is private
`%TEMP%/cg-github-artifact-cleanup-20261106.json`.

Deleting artifacts stops further accumulation for those files; it does not erase
storage usage already accrued this month. Do not promise an immediate quota reset
or a recovered paid pipeline. Billing API reads were denied by the existing GitHub
credential scopes; no new permission was requested or bypassed. No package storage
or billing-budget total was independently established.

For any future screenshot uploader, require a small evidence set, short retention
(e.g. seven days), explicit size bounds and latest-success preservation before
merging it. This is a recommendation, not a claim settings were changed.

Source: [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

## 2. Vercel capacity, cost and suspension risk

Exact team: `cg-dynamics-projects` / `team_SK5vvWv1AIXFkPNV8JFYL205`.
Current read-only team API: Pro, billing active, blocked/softBlock null,
limited false, no featureBlocks. Billing period **18 October 07:00 UTC to
18 November 08:00 UTC** (18 November 10:00 SAST).

Exact budget API: active **$15 USD** team on-demand budget; notifications at
50/75/100%; **pauseUsage=true at 100%**. Spend gauge `currentSpend=0` cents.
Thus current observed on-demand headroom is $15, subject to reporting delay.
The included Pro allowance and subscription fee are distinct from that budget.
No budget or pause setting was changed. A finite shared auto-pause budget cannot
guarantee uninterrupted production when future usage reaches it.

Read-only daily FOCUS billing succeeded after splitting oversized requests into
one-day windows. The latest returned charge period was 5 November 08:00 UTC to
6 November 08:00 UTC: total billed $1.124736, including $0.645161 Pro allocation;
non-subscription items were about **$0.479575**. Function Storage $0.166609 plus
Deployment Storage $0.156979 were approximately **$0.323588** of that day, before
build CPU $0.14 and other services. Holding that storage rate flat would be about
$9.71 over 30 days; this is an illustration, not an invoice/forecast or new spend.

Twenty daily responses were collected; API charge windows shift from the requested
UTC midnight to provider charge-period boundaries (including a DST shift). Do not
label a naive sum as exact current-cycle spend or remaining included credit.
The connected tool truncates its service-group/sample breakdown, while its summary
covers all rows. The CLI JSONL route failed parsing; no empty export was treated
as zero. The exact included-credit gauge was not independently obtained today.

Current team default deployment expiration is 30 days for production/cancelled/
errored, with ten deployments to keep. Retention cost optimization needs a per-
project rollback manifest and separate deletion approval; no old deployment was
deleted or current rollback sacrificed.

Repository default-branch inspection positively found Git deployments OFF in
Dynamics, Website Editor and the separate `bouwer-coetzee-website` repo. Other
repos did not positively prove that guard. A missing flag/file is **not proof of
an active Git integration**, because dashboard state may differ. Do not promise
fleet-wide enforcement. Dynamics still has `git.deploymentEnabled=false`.

Sources: [Spend management](https://vercel.com/docs/spend-management),
[Vercel budget API implementation](https://github.com/vercel/vercel/blob/main/packages/cli/src/util/budget/api.ts).

## 3. Public applications and websites

55 initial root/alias requests covered every configured domain returned for the
22 Vercel projects plus CG Production House. 51 returned HTTP 200; two Imbewu
.co.za names did not resolve; two Dynamics .com names failed Python's certificate
chain validation. Independent Windows curl without a security bypass established
that .com actually returns a HugeDomains sale redirect. Vercel's own domain
configuration confirms it is misconfigured and resolves to that external service.
The production **.co.za** Dynamics hosts work normally.

All 36 bounded same-origin JavaScript asset fetches succeeded with JavaScript
content types. All 41 additional source-discovered route checks returned 200,
including Cape Lumber's existing WordPress website, login/portal entry routes and
Website Editor's admin route. SPA entry-route 200 is not proof of route-specific
client rendering or authentication. No forms were submitted.

Nine critical host certificate handshakes verified, with expirations from
2 December 2026 through January 2027; no sampled certificate is already expired.
Vercel-managed renewal was not forced or reconfigured.

| Project | Checked endpoint | Result / limitation |
|---|---|---|
| allaroundpvc-website | https://www.allaroundpvc.co.za | 200; sampled JavaScript and available navigation routes responded. No forms/authenticated write test. |
| bouwercoetzee-website | https://bouwercoetzee-website.vercel.app | 200 + about/services/contact; no custom domain attached in this team. |
| braize-website | https://www.braize.co.za | 200; sampled JavaScript and available navigation routes responded. No forms/authenticated write test. |
| cg-arcc | https://cg-arcc.vercel.app | 200, but intentional setup scaffold with CONFIRM placeholders; not a finished client launch. |
| cg-dynamics | https://www.cgdynamics.co.za | 200 + entry JavaScript; company connector read works. Integration caveats below. |
| cg-hours | https://cg-hours.vercel.app | 200 + entry JavaScript; database healthy. No new timesheet writes. |
| cg-navigation-content | https://cg-navigation-content.vercel.app | 200 + JavaScript; prototype, not authenticated Dynamics acceptance. |
| cg-pay | https://cgpayza.app | 200; dashboard/customers/money/more HTTP entries and sampled JavaScript. Authenticated invoicing not tested. |
| cg-website-editor | https://cg-website-editor.vercel.app/admin | 200 admin; /api/health returns ok=true, production. Health handler itself does not query the database; template root is not the product UI. |
| cgpay-website | https://www.cgpay.co.za | 200; sampled JavaScript and available navigation routes responded. No forms/authenticated write test. |
| ehpbutchery-website | https://ehpbutchery-website.vercel.app | 200 + counter/about/contact; no custom domain attached in this team. |
| emmanuelfunerals-website | https://www.emmanuelfunerals.com | 200; sampled JavaScript and available navigation routes responded. No forms/authenticated write test. |
| gettogether-website | https://www.gettogethercs.co.za | 200; sampled JavaScript and available navigation routes responded. No forms/authenticated write test. |
| imbewu-website | https://www.imbewuvend.com | www works; bare .com shows GoDaddy Launching Soon; both .co.za names lack A/CNAME. Vercel confirms apex/DNS conflicts. |
| jfj-electrical-website | https://www.jfjelectrical.co.za | ATTENTION: Afrihost Domain Registered page; Vercel deployment alias serves JFJ site. Both custom names misconfigured. |
| morsig-website | https://www.morsig.com | 200; sampled JavaScript and available navigation routes responded. No forms/authenticated write test. |
| piek-group-website | https://www.piekgroup.co.za | 200; sampled JavaScript and available navigation routes responded. No forms/authenticated write test. |
| raadzaal-website | https://www.raadzaal.co.za | 200; sampled JavaScript and available navigation routes responded. No forms/authenticated write test. |
| red-oak-rugby-table-league-app | https://red-oak-rugby-table-league-app.vercel.app | 200 + current JavaScript + valid TLS. Separate Supabase management project is outside this connection; no database-capacity guarantee. |
| redoak-website | https://www.redoakgroup.co.za | 200; sampled JavaScript and available navigation routes responded. No forms/authenticated write test. |
| safira-website | https://www.safirasa.com | 200; sampled JavaScript and available navigation routes responded. No forms/authenticated write test. |
| wisemangroup-website | https://wisemangroup-website.vercel.app | 200 + about/business-divisions/contact-us; no custom domain attached in this team. |
| CG Production House | https://www.cgproductionhouse.com | 200, real branded Wix site. |
| Cape Lumber website | https://capelumbermarketing.co.za | 200, existing real branded WordPress site. |

Public domain findings needing scoped owner action:

1. **JFJ:** both custom names resolve to `197.242.144.237` (parked page).
   Vercel recommends www CNAME `8dfa35636507432c.vercel-dns-017.com` and its current
   project-specific apex addresses. Review existing DNS/mail records and launch
   authority before changing only the web records. No wholesale nameserver move.
2. **Imbewu:** www .com correctly CNAMEs to
   `9c058ab0a98718cb.vercel-dns-017.com`; bare .com has old GoDaddy A records and
   conflicts. Restore exact apex-to-www service routing once authorized. .co.za
   names exist in Vercel configuration but have no web address records; confirm
   whether those alternate domains are intended before configuring them.
3. **Dynamics .com:** nameservers point to NameBright and www CNAME points to
   `traff-https.hugedomains.com`. Do not market this as a functioning CG domain or
   assume ownership from an old Vercel record. Keep sharing `www.cgdynamics.co.za`.

Vercel's `verified=true` project-domain record did not prove correct live DNS.
Actual HTTP content and current DNS/configuration override that stale inference.

24-hour 4xx samples largely show WordPress/autodiscover/webmail scanning, not
normal navigation. Piek's legacy `/images/logo.png` is 404, but the current root
references `/images/brand/logo-light.png`, not that old path. Do not label its
current header broken from the historical 404 metric. No security controls removed.

## 4. Supabase health and limits

Visible organization `CG's Pro Org` is **Pro**. Its two listed projects both report
**ACTIVE_HEALTHY**, and both health-advisor results contain no health notices.

| Project | Database bytes | Connections observed | Stored-object metadata |
|---|---:|---:|---|
| Dynamics `ehtjfntukiwbgptqgbzy` | 1,108,896,915 (~1.03 GiB) | 20 / 60 | No storage.objects rows; client media remains in OneDrive, not proven zero physical disk usage. |
| Hours `qcafdqwhwqaxjhdcugcs` | 56,298,643 (~53.69 MiB) | 19 / 60 | 22 payslip objects, 5,516,256 bytes; no file contents read. |

Connection counts are point-in-time all-process counts, not peak application
connection usage. Logical database bytes exclude some physical disk/WAL/backup
usage. No database-size cap or disk-exhaustion event was observed, but the
organization's egress/MAU/Edge Function/current-billing meters and exact provisioned
physical disk ceiling were not exposed by this connector and were not independently
verified. Do not claim all Supabase quotas or all projects are covered.

Red Oak Rugby's deployed public bundle identifies its separate project
`ekadmlzueolkyyadpyyi`. The existing Supabase management connection explicitly
refuses access. No token copying, account switching, privilege workaround or
anonymous database probe was used to bypass that boundary. Its project billing,
health and data-operation acceptance remain unverified.

Largest Dynamics relations: microsoft_sync_run_items ~346 MB,
microsoft_sync_job_sources ~218 MB, cron.job_run_details ~183 MB,
platform_metric_snapshots ~146 MB, platform_sync_runs ~78 MB. These are retention
review candidates, not permission to delete audit/history or run VACUUM FULL.

24-hour log window 5 November 06:30 UTCâ€“6 November 06:30 UTC:

- Hours: 1,482 edge requests; all 200/201/204 in the returned aggregate.
- Dynamics edge: 85,172 successful 2xx, 20 OAuth-token 400 and two auth 401.
- Dynamics function edge: 5,118 successful 2xx, three 405, three 502 and one 520.
  The four 5xx belong to the MCP endpoint. Current authenticated read-only calls
  worked. This is an intermittent connector error history, not a perfect result
  or proof of ongoing outage. No ERROR/CPUTime/Memory/WallClockTime function-log
  group was returned by the bounded follow-up query. Logs may arrive late.

Security and performance advisors returned the following grouped findings.
Callable SECURITY DEFINER warnings require reviewing each handler's own role/
ownership checks; they are not proof every RPC is vulnerable. RLS enabled with
no policy is often deliberate deny-by-default for server-only tables. Do not
blindly add policies, revoke all RPCs or remove indexes to silence the scanner.

| Project | Category | Finding | Level | Count |
|---|---|---|---|---:|
| Dynamics | security | [rls_enabled_no_policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | INFO | 43 |
| Dynamics | security | [function_search_path_mutable](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable) | WARN | 23 |
| Dynamics | security | [extension_in_public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public) | WARN | 1 |
| Dynamics | security | [anon_security_definer_function_executable](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) | WARN | 11 |
| Dynamics | security | [authenticated_security_definer_function_executable](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | WARN | 132 |
| Dynamics | security | [auth_leaked_password_protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) | WARN | 1 |
| Dynamics | performance | [unindexed_foreign_keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) | INFO | 167 |
| Dynamics | performance | [auth_rls_initplan](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan) | WARN | 47 |
| Dynamics | performance | [unused_index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) | INFO | 105 |
| Dynamics | performance | [multiple_permissive_policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies) | WARN | 206 |
| Dynamics | performance | [duplicate_index](https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index) | WARN | 1 |
| Dynamics | performance | [auth_db_connections_absolute](https://supabase.com/docs/guides/deployment/going-into-prod) | INFO | 1 |
| Hours | security | [function_search_path_mutable](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable) | WARN | 2 |
| Hours | security | [anon_security_definer_function_executable](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) | WARN | 14 |
| Hours | security | [authenticated_security_definer_function_executable](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | WARN | 39 |
| Hours | security | [auth_leaked_password_protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) | WARN | 1 |
| Hours | performance | [unindexed_foreign_keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) | INFO | 70 |
| Hours | performance | [auth_rls_initplan](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan) | WARN | 39 |
| Hours | performance | [unused_index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) | INFO | 31 |
| Hours | performance | [multiple_permissive_policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies) | WARN | 274 |
| Hours | performance | [auth_db_connections_absolute](https://supabase.com/docs/guides/deployment/going-into-prod) | INFO | 1 |

These are unresolved review items, not changes applied by this audit. In particular,
leaked-password protection is disabled in both projects and mutable function
search paths are reported (23 Dynamics / two Hours). Production auth/security/SQL
changes need the existing exact approval/review boundary.

## 5. Dynamics operational data health

Existing authenticated company-admin tools were used read-only; no refresh or
sync was forced.

- Meta: 47 mapped clients/assets, 76 mapped platform checkpoints = **20 PASS,
  55 PARTIAL, one STALE**. All 46 recently successful Facebook checkpoints are
  explicitly partial, not complete. The stale Facebook asset belongs to **AV Event
  Life**, already on the owner's hold list; last success 3 November 02:08 UTC,
  provider_error. No mapping or publication was changed.
- TikTok: all ten connected exact-account health checks return PASS/fresh/complete,
  latest successful refreshes 5 November 09:08â€“09:12 UTC. This is refresh coverage,
  not a claim that every metric is a comparable monthly total or every client is
  connected to TikTok.
- Google Ads: authorized; latest account sync **succeeded 5 November 22:00 UTC**,
  period through 5 November, 42 rows upserted. This is ingestion freshness, not an
  independent Google UI campaign reconciliation or campaign/spend change.
- Microsoft: latest reconciliation **PARTIAL**, 6 November 03:39 UTC; all six
  upstream source fetches complete, zero failed apply, **83 conflicts**. Eight
  shared-schedule dates checked, zero changed/held. Source fetching success does
  not prove conflict-free mirroring. Staff/Teams owner retains resolution.
- Red Oak weekly-specials automation's latest Go run (4 November) failed because
  `OPENCODE_GO_API_KEY` was unavailable to that repository. Earlier free-only runs
  succeeded; website still serves. No secret copied or new paid worker dispatched.

## 6. Completion boundaries and exact next actions

1. Get CA's answer to the exact 93-artifact deletion question; on approval refresh
   the manifest, delete only those IDs, then independently recount. Preserve two
   newest reports; no paid upgrade or billing-limit removal.
2. Resolve JFJ and Imbewu exact web-record routing under the existing DNS/launch
   approval gate. Do not disturb mail/MX/TXT or buy/claim Dynamics .com.
3. Review deployment/function storage per project with rollback requirements before
   any approved retention cleanup. Keep development local-first and no automatic
   deployment churn. Current budget risk is documented, not secretly removed.
4. Supabase owner dashboard needs exact current-cycle resource meters; Rugby
   requires the legitimate account/project connection to verify its backend.
5. Existing #505/#623/#451 owners retain provider completeness and Microsoft
   conflict closure. Four historical MCP 5xx deserve bounded triage, not blind
   redeployment or invented success. Strategies/content are a different owner lane.

Computer Use stopped itself because it could not confidently establish the active
Chrome URL. No alternate UI automation or auth-copy workaround was used. Therefore
no new visual, physical-phone or authenticated browser journey is certified by
this audit. HTTP/asset/API/database evidence is reported at its actual strength.

No blanket cap removal, unlimited spend, production cleanup, DNS/security mutation,
package publication or deployment is authorized by this report. Google Control
Centre's exact existing reference remains unavailable; no guessed tracker write.

Private raw evidence: `%TEMP%/cg-{github,http,route,app-bundle,tls}-health-20261106.json`,
`cg-vercel-metrics-20261106.json`, `cg-vercel-4xx-paths-20261106.json`,
`cg-vercel-git-guards-20261106.json`, and `cg-health-provider-billing-20261106.json`.
No privileged credentials, email headers or private file contents are included in
this committed report. No application runtime changes; docs-only, no deployment.
