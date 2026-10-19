# Client portal controlled live release — 19 October 2026

CA explicitly requested the outstanding client work and a conservative Vercel
push. This receipt supersedes the candidate's **not released** status, not its
remaining content/provider/recipient gates. Staff/Teams/calendar stays separate.

## Exact release

- Reviewed source-only PR #844 merged as `b357a4db1324032752438dcb07391eb1888c9450`.
  Its Git tree equals candidate `9f98a938`; runtime/test acceptance remains frozen
  `ff894eba`: 3979 total /3962 pass /17 declared skips /0 failures, stable source,
  TypeScript/Vite7,121JS chunks,19 local browser journeys, scoped lint/Deno/diff.
- Live frontend `dpl_AQTmhDsDPVwh3AXTeTUGPCvN9Wr1`:
  https://www.cgdynamics.co.za . Vercel inspect and the public entry
  `assets/index-CHvxSHg8.js` confirm the changed artifact, not the previous build.
- Exact frontend rollback: `dpl_5vXwcM7cU23T4SNQS9DdoMJsaCcq`.
- Existing `client-onboarding` backend is ACTIVE v44. Ten transitive source files
  read back byte-equivalent after newline normalization. Existing platform
  `verify_jwt=false` and internal active-user/profile checks preserved; no new
  secret names, dependency, schema, grant or provider configuration. v43 closure
  retained privately for rollback. Unauthenticated curation returns401; malformed
  null request400. Neither grants a client file access.

## Cost/availability controls actually used

Target `cg-dynamics`, project `prj_jHVsExoStNjI7ikqlJyXZx26Ahuu`, team
`team_SK5vvWv1AIXFkPNV8JFYL205`, production. Signed-in Billing showed18Oct–18Nov
cycle, included credit1.19/20USD, on-demand0/15USD, PauseON before release.
CA delegated minimization; retained minimum5USD client-site reserve and a
self-imposed1USD incremental release stop. No budget, DNS, hosting or add-on change.

One **local** production-target build, one `--prebuilt --prod --skip-domain`
upload, then promotion of that same deployment. Vercel inspect reports build0ms;
only2.5MB needed upload of the175static-file artifact. No cloud compilation,
second preview, source rebuild, forced retry or remote-cache workflow. Upload,
storage and serving are not promised free. No extra financial allowance invented.

Pulled Vite values were sensitive placeholders. Before building, matched the
existing public browser Supabase project/publishable key from the current live
bundle and verified `/auth/v1/settings`200. No privileged credential was fetched
or copied. Built artifact explicitly checked against this public configuration
and against fixture sentinel leakage. The CLI's install adjusted optional lockfile
entries locally; only those known CLI changes were restored with apply_patch;
no dependency change committed. The earlier fixture-configured dist was not uploaded.

Git automatic deployment staysOFF. Private-inventory predecessor branch/history
was not pushed. Public PR844 attachment attempted but app attachment limit100
refused; the ordinary GitHub PR URL remains authoritative. No attachment success
is claimed.

Before/after HEAD checks: Dynamics, Piek, All Around PVC, Emmanuel, Get Together,
Imbewu primary `.com`, Raadzaal and Red Oak all200. Point-in-time uptime only,
not form/commerce testing or an indefinite availability guarantee. Bounded new
deployment error-log scan returned no logs; this static-app check does not cover
Supabase or replace browser acceptance.

## Actual live readback

Staged artifact booted normally to its protected app login; no session/credentials
copied across origins. After promotion, the existing real company-admin session
loaded Clients and read-only exact-client preview. This is **admin preview**,
not a genuine client password/RLS or recipient-media acceptance claim.

Braize Overview, Plan/current-next month, confirmed-only package and Performance
were read. Mobile package showed8combined posters, no unknown-capacity cards;
October/November strategy navigation worked and unpublished November stayed held.
Piek Performance now renders the real published report instead of the reproduced
legacy-strategy crash. At375/390/430 actual tab viewport widths, page widths equal
viewport and mobile navigation remains visible. Temporary emulation was reset.
Browser extension message-channel errors were observed; do not claim all-console
silence. No application crash reproduced in these settled journeys.

A five-client rapid smoke initially read some asynchronous pages before settling;
blank/intermediate captures are **not acceptance**. Bounded network-aware follow-up
confirmed settled Agri-Secure, All Around PVC and Bat Hill examples, but an early
cross-navigation heading capture was also rejected. This is not a58client×alltab
production acceptance matrix. Earlier58Google/website and116strategy read-only
inventories remain valid source evidence, not a new all-client-role pass.

## Concrete remaining work — do not hide with a green release

1. **OneDrive app authorization:** live Braize admin library read returns503.
   Read-only DB proves its exact client-folder mapping exists, library row absent,
   and **no `microsoft_oauth_tokens` row for `onedrive_personal`**. Dynamics' server
   therefore has no delegated OneDrive consent to read these files. The connected
   ChatGPT/SharePoint account is a different authorization. Use the existing gated
   OneDrive setup/owner consent mechanism; never copy connector/browser tokens,
   guess setup secrets, publish raw shares or weaken fail-closed ancestry checks.
   Existing static secret/config readiness still needs owner verification.
   Then prepare disabled libraries, individually publish cleared files, enable
   the pilot and prove genuine client list/view/download/206/expiry/isolation;
   continue the reviewed cohort only after that. No assets/permissions/library
   records were written or enabled during this release. #3966264282379.
2. **Normal ChatGPT/content owner:** existing October/November strategy source
   admission, semantic review and publication remain; no duplicate paid generator
   or bulk publication. Piek editorial correction and report review remain exact
   content gates. New frontend availability does not publish missing information.
3. **Provider owners:** exact missing Instagram linkage and three mapped Google
   clients without campaign rows require real evidence; connected TikTok tokens
   do not certify complete analytics. Do not guess mappings, backfill numbers or
   treat conversions as certified sales. Optional website action telemetry stays
   unavailable until its separate owner completes activation.
4. **Separate staff lane:** Teams/calendar/source reconciliation and unpublished
   migrations remain its owner's rollout, not this frontend release. Latest peer
   head observed `d7b1a592`, clean and untouched; no combined release/test claim.
5. **CA/team:** actual password/login and physical-phone/client-by-client final
   acceptance explicitly retained by CA. AV/Red Oak held, Zooz prospective and
   LHP later must not be represented as failed required recurring launch scope.

No full client-launch certification or only-CA-review-left assertion. The code is
live; missing app authorization and unpublished business evidence are separate.
Google Control Centre exact reference remains unavailable; no guessed tracker or
replacement was created. Owning issues/#381 and canonical handover updated.
