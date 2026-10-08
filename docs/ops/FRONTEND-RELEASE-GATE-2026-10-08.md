# Dynamics frontend release gate — 8 October 2026

CA requested a clean, low-usage Vercel release **after** finishing the app. This
is permission to prepare a release, not evidence that the client-facing content
or shared-team spend reserve is ready. Do not relabel a local fixture pass as
client-role or semantic strategy acceptance.

## Frozen source and local proof

- Candidate `main`: `bbba236c59b5a0ca3b4497f3dfdfd836e4e0cba4`; app tree
  `64ad18eebe092bcb93fd75efac4f21087516bdb6`.
- Integrated local runner: 3,715 pass / 17 intentional skips / 0 fail;
  TypeScript, Vite and all nine actual-component responsive suites pass. Receipt
  `%TEMP%/cg-local-launch-bbba236c59b5.json`, SHA256
  `94c25f0e9e2bdfc285be7d0d1176faf11f2f0dde6bb18c787881197e8439269f`.
  The emitted `dist` has **synthetic** public configuration and must not be
  uploaded. Full ESLint: 0 errors, 17 existing warnings. Clean Git tree.
- Current repo has `git.deploymentEnabled=false`. Do not turn it on or create a
  cloud preview to obtain a check. Main is 67 commits/57 `src` paths ahead of
  the last observed production frontend; staged authenticated testing matters.

## Exact observed Vercel state (read-only snapshot, 08:42–08:47 UTC)

- Existing team `team_SK5vvWv1AIXFkPNV8JFYL205`, project
  `prj_jHVsExoStNjI7ikqlJyXZx26Ahuu` (`cg-dynamics`, Vite, Node 24).
- Billing cycle 18 September–18 October: included credit $20/$20 consumed;
  $10 on-demand team cap with **Pause ON**; current budget spend $3.22. Approx.
  $6.78 remains before the shared cap, **not** a development allowance. The
  dashboard separately displayed $3.05 on-demand charges; billing may lag.
  A maximum extra release spend and explicit client-site serving reserve have
  not yet been established. Re-read at action time.
- Current known-good production-target rollback candidate:
  `dpl_4zLdbHKXzHs8rDzyErJHtcZfUneE`, READY, source
  `8fb21a8c8f71429976c42c623f1119195874beb2`. Preserve it. Blocked
  preview deployments are not release evidence.
- Read-only HEAD returned HTTP 200 for `www.cgdynamics.co.za`,
  `www.piekgroup.co.za`, `emmanuelfunerals.com`, `www.allaroundpvc.co.za`,
  and `www.redoakgroup.co.za`. This is a timestamped sample, not future uptime
  assurance or a guarantee of every client site.

## One-build release procedure and hard stops

1. Recheck exact `main` SHA, local acceptance, backend compatibility, team,
   project, billing cycle/spend, approved incremental ceiling, client-site
   reserve, domains and known-good rollback **immediately before** a cloud step.
2. In a release window, create one production-configured local Build Output API
   artifact (`vercel build --prod`) using the existing private project link and
   environment flow. Never upload the synthetic runner `dist`; never expose or
   commit pulled credentials. Inspect artifact code/rewrites/public config and
   hash it. If prebuilt is incompatible, stop and choose **one** separately
   budgeted cloud-build alternative, not both.
3. Upload once with `vercel deploy --prebuilt --prod --skip-domain`. Keep live
   aliases on the known-good deployment. No preview build, `--force` or retries.
4. On the staged URL, perform legitimate authenticated admin and **real client
   role** read-only desktop/375px acceptance: exact-client isolation, published-
   only strategy/report/content, Plan/calendar/guidelines, Performance services,
   Approvals, Brand Hub, deep links, runtime console and no overflow. A staff
   Client View is useful but not a substitute for a client-role session. Stop
   before promotion if authentication or any truth/layout check fails.
5. Promote that same staged deployment, with no rebuild, only after all gates
   pass. Recheck the five sampled domains and actual live Dynamics behavior;
   keep automatic Git deployment OFF. If the new frontend fails, use only the
   captured compatible deployment for a reviewed rollback, not another build.

## Independent client-value gates (not solved by a frontend release)

- The 94 Sep/Oct target strategies remain 72 v3 drafts plus 22 held v2 drafts,
  zero approved/published. Historical `94 quality_review_passed` JSON is
  superseded by `STRATEGY-READINESS-SCREENING-TRUTH.md`, not a semantic pass.
  Exact-client review and protected approval/publication remain separate.
- Elcheck, JFJ Electrical, LHP Student Village & Block and VCS package
  quantities remain unknown; no blank-to-zero inference. LHP source terms and
  VCS price/stock/final terms remain owner-evidence gates.
- Zero published portal assets at the latest exact receipt. Genuine final files
  and exact deliverable associations require human review before publication.
  Knowledge cards also require individual reviewed activation.
- Provider/owner consent and the shared client-site uptime risk remain distinct
  gates. A green frontend cannot turn missing facts into verified metrics.

No Vercel build/upload/promotion, production data or provider action was
performed by this preflight.

## Staging receipt — 8 October, after CA go-ahead

- Exact clean source: `4072e40d1395960ecd434316eabee4c181666351`;
  no app-source change from the locally verified `bbba236c` candidate.
- The private Vercel production-env pull redacted both Sensitive-marked
  `VITE_SUPABASE_*` values as `[SENSITIVE]`. The local `vercel build --prod`
  output was therefore invalid and **was not uploaded**. Its generated env
  files were removed. Do not use that output for a later `--prebuilt` deploy.
- A dry run excluded `.env*`, `.vercel/output` and `dist` from source upload.
  Exactly one cloud build was made with
  `vercel deploy --prod --skip-domain --project prj_jHVsExoStNjI7ikqlJyXZx26Ahuu --scope cg-dynamics-projects --yes`.
  It is READY: `dpl_DyiXG9689oAjZUhEBbHEsL3AKLAi`,
  `https://cg-dynamics-fzavq49oa-cg-dynamics-projects.vercel.app`.
- `www.cgdynamics.co.za` still resolves to READY rollback target
  `dpl_4zLdbHKXzHs8rDzyErJHtcZfUneE`; do not create another deployment.
  Vercel did assign `cg-dynamics-cg-dynamics-projects.vercel.app` to the staged
  build despite `--skip-domain`. That Vercel-owned alias is **not** evidence of
  custom-domain promotion.
- Staged unauthenticated desktop and 375px login rendered; no captured console
  warnings/errors and `scrollWidth=clientWidth=375`. Authenticated admin/client
  routes are **not yet accepted**. A genuine client test account must sign in
  on the staged URL; never use a copied browser token or staff preview as a
  substitute. Five sampled canonical hosts returned HTTP 200 after staging.
- Refreshed shared-team spend: $3.50 before cloud build, $3.53 at first
  post-build readback, $10 Pause-ON cap. Billing may lag; re-read before any
  further release action and preserve the client-site reserve. No second build,
  retry, alias promotion, migration, production data or provider action.

Next: finish real client-role and staff staged read-only desktop/375px checks,
then promote **this same deployment only** if exact-client/published-only
truth, layout, runtime and reserve gates pass. Otherwise leave canonical
domains on `dpl_4zLdbHKXzHs8rDzyErJHtcZfUneE` and document the blocker.
