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
