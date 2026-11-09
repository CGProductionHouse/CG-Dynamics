# Per-video client guideline review — 9 November 2026

Owner #896/#450, supervision #381. CA requested verification of the public
client-only presentation plus separate approval, amendment, decline and comment
tracking for each video. Existing public delivery/message previews stay intact.

## Reproduced and implemented

Native personal Chrome displayed the actual Germoparts guideline with branding,
four full scripts, lineup navigation and no admin/backend navigation. It had no
per-video response controls. Browser automation inventory was disabled, so the
legitimate native Chrome UI was used without changing Work/security settings.
Closed only the review tab created for this check; WhatsApp composer untouched.

The same accepted renderer now accepts optional review panels. Only the public
page enables them. Each video offers Approve idea, Request changes, Decline idea
and Comment; responses require a name, and changes/declines/comments require text.
The page shows reviewed-count and each video's current decision/history. Account
sign-in is a separate footer link, opens a new window without the bearer URL or
referrer, and does not grant account access. No custom icons or new dependencies.

The new private RLS ledger records an immutable published-video snapshot, exact
publication timestamp, position, self-reported reviewer name, action, comment,
request ID and server time. Public RPCs validate the existing capability and
publication; wrong/revoked/foreign links fail closed. Repeated request IDs are
idempotent; conflicting latest revisions fail; responses are bounded/rate limited.
Republishing requires fresh decisions and preserves staff history. No editorial,
production, package, calendar, Client Schedule or final-asset approval is mutated.
Anyone holding the link can respond/read its responses, clearly disclosed in the
form; this is not identity-verified sign-off or permission to post finished media.

Staff editor displays exact-run response history, including earlier-publication
and changed-script flags. Existing `list_content_guideline_videos` returns that
same evidence through the server-resolved actor; unavailable evidence is explicit
and cannot hide otherwise-readable scripts or be called approval. No new MCP
tool/scope or public staff-history endpoint.

## Verification

- Supported full suite: **4,293 total / 4,263 pass / 30 existing optional skips /
  zero failures**, 175.5s. Same12 unrelated Unix SES shell-mock tests excluded on
  Windows. Final18 focused checks also pass, including transport-failure isolation.
- Actual disposable PostgreSQL17 migration tests pass approve/change/decline/
  comment, separate-video state, exact text preservation, lost-response retry,
  changed-payload rejection, stale revision/version denial, republish reset/audit
  retention, revoked/wrong/foreign capabilities, anon/client/inactive/staff grants,
  private-table denial and rate limits. Two simultaneous decisions: exactly one
  succeeds, second receives an explicit conflict; no silent overwrite.
- Actual public page and staff response component in isolated loopback browser
  fixtures: **1440/375/390/430px pass**. Anonymous publishable-key transport only;
  no staff-session use, external requests, admin links or overflow. All four
  actions, required comments, literal HTML-like text, idempotent lost response,
  reload persistence, changed-version/revocation, historical staff flags and
  separate-account link pass. Synthetic fixture responses only; no fake production
  client approval. Sample screenshots `%TEMP%/cg-guideline-review-{width}.png`.
- TypeScript/Vite build and emitted public-page application bundle pass. Scoped
  TS/TSX and standalone JS lint, diff and MCP Deno check pass (existing extensionless
  imports plus validation-only Vite ImportMeta ambient declaration; not a hosted
  standalone whole-bundle type-check claim). Existing public live anonymous read
  still passes four exact original script hashes, client isolation and anonymous
  registry/management401.
- Official Supabase changelog/current function/RLS docs checked; no dependency,
  CLI or platform upgrade. CLI remains2.115.0; no migration version invented.

## Exact pending production packet

**NOT LIVE.** Source/verification only until CA approves this exact additive
review schema/backend/frontend release. Existing live MCPv81 and deployment
`dpl_EJr74MFsLf1uqmveHTZCqPQTyHFE` remain the rollback/serving baseline.

Reviewed #975/f6287a0527cff8b0065ce9c3c8cecdae274d746d is merged as
`f0a3447d0d2765e5c695bc6ad29f879af5ff9536`; final application/backend/script tree
matches the verified feature tree exactly. Final production-target LOCAL prebuild
and46-resource self-contained packaging pass; isolated built GET/HEAD also passes
actual Germoparts metadata/month/four-video count/logo, exact app shell and no
private scripts in initial HTML. No staged upload/promotion was performed. The
local installer pruned only optional peer lock entries; restored the unchanged
source lockfile, with no dependency change committed. CA's single exact release
approval question is pending; no laptop access or real-client test response needed.

Supabase project `ehtjfntukiwbgptqgbzy`: apply only
`20261109112347_guideline_video_client_review.sql` (one private table, two indexes,
five narrowly granted functions). No existing reader/publisher or client content
is rewritten, republished or approved. Existing `cg-dynamics-mcp` v81/40-file fresh
preflight matches the committed baseline for the three targeted files. Replace
only `index.ts`, `contentGuidelineActions.ts`, `toolCatalog.ts`; preserve37 other
hosted files/settings/authentication/secrets byte-for-byte. Candidate LF SHA256:

| File | SHA256 |
|---|---|
| index.ts | ec3810c3755c611d7447ad6fddf35a851a0075b41f522ced9f57e9ec3aea7fce |
| contentGuidelineActions.ts | 881e3761bf4055c9494fdcb0f521a47a15e4d578dcb4478e2fc72f7266de3dc7 |
| toolCatalog.ts | 2236a58d81c6991469cb26b63c74dd0ecfa986215c2e54ce9025a064bbf4cf2c |

Private baseline/candidate `%TEMP%/cg-guideline-review-mcp-*.json`; no capability
or live credential committed. Release order: schema/grants verification, existing
MCP three-file update/readback, verified locally prebuilt frontend stage, same
deployment promotion. Production acceptance is read-only schema/anonymous/current
guide/connector/UI verification; do not create test approval on a real client's
ideas. Preserve noindex/no-referrer/no-store and existing named preview metadata.

Vercel target unchanged: project `prj_jHVsExoStNjI7ikqlJyXZx26Ahuu`, team
`team_SK5vvWv1AIXFkPNV8JFYL205` (cg-dynamics-projects), production environment and
`www.cgdynamics.co.za`. One production-target locally built staged artifact plus
same-deployment promotion; no remote application compilation, extra preview,
hosting/DNS/budget/protection change. Preserve git deployment OFF. Reuse the
reviewed self-contained preview-function packaging helper after final prebuild.

Fresh9November11:41UTC current-cycle CLI report18October–10November estimates
total effective27.94061646798USD including14.8387096774USD Pro allocation; service
usage about13.10191USD, about6.89809USD of20USD included service credit remaining,
billed overage effectively zero. Metering is delayed; retain5USD serving reserve,
stop if incremental release estimate exceeds1USD or reserve is crossed. This is
a conservative stopping condition, not a budget-setting change or new spend ask.
Recheck target/drift/uptime before an authorized release; no blind retry loops.

Exact Google Control Centre remains unavailable from already-bounded discovery;
no guessed tracker. Update owning issue/#381/handover. Other agents' staff/Teams,
calendar, Nolan, graphic-design and monthly-strategy lanes are unchanged. Physical
phone/client identity acceptance and unrelated launch gates are not claimed.
