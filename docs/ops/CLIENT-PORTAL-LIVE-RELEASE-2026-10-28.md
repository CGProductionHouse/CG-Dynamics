# Client portal production release — 28 October 2026

## Live application

CA explicitly instructed this lane to finish the remaining executable work and
push live conservatively. The reviewed client frontend is now serving at
**https://www.cgdynamics.co.za**. This supersedes earlier “frontend source only”
checkpoints, not their separate content, consent or real-client acceptance gates.

| Release identity | Verified value |
| --- | --- |
| Repository/source | CGProductionHouse/CG-Dynamics, `7eb0473fd3001422d4459cc280ae59971c5985d4` |
| Tested source tree | `5cac91464efd69e433e9c4ae8a997695db489f90` |
| Production project | `cg-dynamics`, `prj_jHVsExoStNjI7ikqlJyXZx26Ahuu` |
| Team | `cg-dynamics-projects`, `team_SK5vvWv1AIXFkPNV8JFYL205` |
| Serving deployment | `dpl_7LxXqAEsdZhGVCdtWHjYSz8JfV3w` |
| Deployment URL | https://cg-dynamics-ejry51bk8-cg-dynamics-projects.vercel.app |
| Public entry | `/assets/index-lt0Evy8W.js` |
| Entry SHA256 | `110763ebf318538e1e5d9d8f742bda94d0188e9da623ff5aa3375edb1cdf6a6f` |
| Rollback retained | `dpl_Bzsrsj9nZA2zUFkyDfTMMktjJaJT` |

One local production-target prebuild, **one prebuilt production staging upload**
(`--skip-domain`, 2.5 MB differential), eight staged app-chunk hashes matched,
then promotion of that **same deployment** around 05:26 UTC / 07:26 SAST.
Original production remained serving until promotion. Inspect confirms READY and
zero cloud compilation duration. No retry, second deployment, preview, DNS,
budget, hosting/add-on change or documentation deployment. Git deployment remains
disabled. Static artifact: 175 files, 122 JS chunks, 41,446,799 bytes; no Functions
or crons. Manifest SHA256:
`713e98dcd266fc94538093852fc334e9383c2e2f3cfe86cc08e4773ea2683867`.
Public Supabase configuration matches the prior serving application; auth settings
HTTP 200 before/after. No fixture build was uploaded.

Fresh billing before staging: 18 October–18 November, included $7.35/$20,
on-demand $0/$15, Pause ON. Post-release signed-in read: included **$7.36/$20**,
on-demand **$0/$15**, Pause ON. These are delayed team counters, not attribution
of the one-cent change solely to this release or a promise of free hosting.
Existing $5 serving reserve and the stricter $1 incremental-release stop were
preserved; no further cloud operation is needed for this handoff.

## Local acceptance and repair

Frozen `fe9f22b4716be986a04ac0ef10738aead7bbe930` has the exact released Git tree:
**4,225 total / 4,201 pass / 24 explicit skips / zero failures, cancellations or
todo**. Mandatory disposable PostgreSQL fixtures executed. TypeScript/Vite actual
app build, all 20 canonical browser fixture scripts, separate guideline renderer/
editor checks at 1440/375/390/430, scoped frontend lint and diff checks passed.
These are local synthetic role/isolation/browser checks, not client passwords or
physical-device acceptance.

Initial attempts exposed stopped Docker, an unavailable OpenSSL PATH and a real
temporary PostgreSQL bootstrap-readiness race. Existing Docker was started and
existing Git OpenSSL added only to the test process PATH. Reviewed PR [#907](https://github.com/CGProductionHouse/CG-Dynamics/pull/907)
fixes only the revision fixture's final TCP readiness probe. No production SQL,
runtime dependency, application authorization or permission change. Earlier failed
receipts are retained; the final clean run is separate.

Private full receipt: `%TEMP%/cg-local-launch-fe9f22b4716b.json`, SHA256
`12C4137BD3F938171AE5F15D95A940FD95C4812A69835EA68C0DBA8BAFE12512`.
Release receipts/logs: `%TEMP%/cg-release28-*`; no credentials, private scripts or
client source documents are committed here. CLI-created optional dev-peer lock
pruning was restored; frozen lock and app/build dependency versions match.

## Actual post-promotion browser acceptance

Legitimate company Chrome admin session; no copied auth/session or impersonation:

- Piek Overview settled correctly; mobile 375/390/430 has labelled Overview,
  Plan, Performance, Approvals and More destinations, with Leads/Brand Hub under
  More; no page overflow. Desktop Elcheck review remains open at 1536 px.
- Plan exposes October and November only. Piek's private October strategy remains
  “under review”; releasing code did not publish its content. Active Elcheck
  package panel shows one professional video and six combined posters monthly,
  with no unknown/“To confirm” extras.
- Piek's published September Performance renders with its disclosed Sep 1–29
  metric window; incomplete comparisons remain unavailable.
- Saved All Around PVC guideline renders the full script through Scene 6 in
  the portal-style preview, including actual 390 px acceptance. It remains a
  labelled private saved-draft preview without a published share action.
- Piek Brand Hub's published PNG View opens a separate window and fully loads
  at 3375×4219; empty referrer, original exact-client portal preserved. Agent
  temporary mobile/image tabs closed normally. Native PDF extension rendering
  remains unverified; no protection bypass or false PDF success.
- The new Meta screen exposes **Reconnect Meta** and retains truthful partial
  metric and token-storage states. Latest visible insight refresh is 28 October.
- Seven checked hosts returned HTTP 200 before/after: www.cgdynamics.co.za,
  cgdynamics.co.za, www.piekgroup.co.za, www.allaroundpvc.co.za,
  emmanuelfunerals.com, www.redoakgroup.co.za and gettogethercs.co.za. This is the
  checked host set, not a fleet-wide availability certificate.
- Bounded exact-deployment error/fatal runtime-log query returned no entries;
  this does not certify all browser or Supabase activity.

## Remaining review and protected exceptions

Continue the existing [execution list](CLIENT-LAUNCH-EXECUTION-2026-10-25.md),
not another app rebuild or a duplicate all-client sweep. The code is live;
client invitations/publication are still exact-client decisions.

1. **Meta owner consent:** actual newly released UI still reports legacy storage.
   Bounded SELECT-only metadata confirms one connected token row, **one legacy /
   zero encrypted envelopes**, last connected 25 October 15:17 UTC, validated
   27 October 18:24 UTC. Hosted status v68 correctly projects that fact. This
   supersedes earlier conflicting encrypted-storage interpretations. The approved
   encryption readers/writer/key rollout remains deployed; re-consent through
   Reconnect Meta is required to replace the existing credential. No token value
   was returned, exported or backfilled, and no key/backend was changed. Do not
   remove the warning or claim encrypted-at-rest acceptance before read-back.
2. **Bohemia Quick Stop:** existing Facebook Page-access permission hold remains;
   no forced retries, scope expansion or guessed mapping. Other partial metrics
   remain partial, not fabricated zero. The prior exact-client Meta/TikTok/Google
   inventory remains the provider coverage record; no redundant bulk refresh.
3. **Content:** normal ChatGPT/source owner #731 retains exact October/November
   strategy admission/editorial/publication. Existing drafts and staff amendments
   were preserved; no blanket strategy approval or paid duplicate generator.
   Imported SecuriForce/PVC guidelines remain unpublished; event highlights do
   not require scripted guidelines. Client file/publication boundaries remain.
4. **Owner acceptance:** client password login and physical-phone tests stay with
   CA. Existing Case/Emoya/Germoparts native-PDF recipient/render exceptions are
   not passed by the successful PNG test. LHP remains later/once-off; AV/Red Oak
   held, Zooz excluded, Jodrico cohort owner-held. Staff/Teams/calendar ownership
   is separate and was not modified by this release.

No production schema/data/Edge/config/secret/provider/OAuth/mapping/permission,
package, strategy or asset-publication mutation was made in this release.
The already-live guideline and Hours MCP v74 fixes were not redeployed. Real
Hours narration→write→read-back remains unverified; do not invent timesheet rows
to obtain a green check. No staff chats or reminders changed.

Release authority and staged packet: [#679](https://github.com/CGProductionHouse/CG-Dynamics/issues/679#issuecomment-6461383748).
Owning launch #668, guideline #896, file access #396, provider #505 and supervisor
#381 receive this completion state. Google Control Centre exact reference remains
unavailable; no tracker update is claimed. This document is continuity only and
must not cause another Vercel deployment.
