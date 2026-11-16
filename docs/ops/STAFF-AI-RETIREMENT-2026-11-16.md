# Built-in staff AI retirement — 16 November 2026

## Continuation: usable model-free connector parity, still NOT LIVE

PR #995 now adds three tools (62 total:31read/31write) and a fifth plugin skill.
`get_marketing_knowledge` pages reviewed/current generic or specialist-targeted
Skill Cards, exact-client/exact-branch evidence, practical how-to guidance and the
existing ten specialist briefs. Optional platform/surface reads include only current
verified/observed platform knowledge, with limitations and freshness. No raw source
document/full-text retrieval or knowledge activation is exposed. Selected evidence
fields are neutralised/redacted; query errors remain unavailable, never empty success.

`read_marketing_artifacts` resolves an exact-client parent before versions/decisions/
transitions, returns bounded history pages and excludes private actor/provider fields.
`write_marketing_artifact` saves ChatGPT/Nolan-authored structured drafts and immutable
versions, or explicit human current-version decisions. It never invokes a provider.
Drafts require current reviewed exact-scope evidence and expected_version. Closed
artifacts cannot be overwritten; approve/reject stays manager/admin-only. Client
Projects cannot write legacy artifacts. Staff/company-admin writes bind the effective
active actor AND active connection; non-manager connections cannot impersonate others.

New UNAPPLIED migration `20261116160000_model_free_marketing_connector.sql` provides
one service-only transaction and private RLS receipt table: exact-client lock/version
checks, append-only history/audit and actor/key/hash replay committed together. Reused
keys with different inputs fail. Inactive actors are denied even for retries. Generic
MCP status receipts are bypassed for this tool so no successful replay loses original
IDs. No legacy helper, profile policy or RLS migration from #990 was changed. No
production database access or permission expansion occurred. #996 owns strategy-date
work; its runtime logic was not edited. Main1c1bd36 (#996) is integrated; both existing
January strategy rules and new catalog entries are verified together.

The earlier source-only preservation gap below is HISTORICAL and superseded for
these named workflows. This is not blanket parity: no legacy campaign reassignment,
raw-source/full-text browsing, knowledge activation, client-Project artifact writes,
provider generation or live connector/device acceptance is claimed. Existing campaign
bindings/history survive. Human review and source governance stay in their current
UI/role authority. Content Guidelines remain canonical ChatGPT-authored operations,
without a new Content Director/provider dependency.

Release packet now includes TWO new migrations plus the changed MCP index/catalog,
new marketingKnowledge module and its unchanged shared skill dependencies, in addition
to the two retired Edge handlers/frontend. Verify deployed migration/receipt permissions
and active actor/client/version denial before exposing write tools. Keep migration,
MCP, Edge and frontend undeployed until the final reviewed packet is approved. The
schema change adds no new authenticated/anon grants. Do not roll it back by deleting
history or receipts. Preserve My Assistant/staff_assistant_profiles and all Library
management surfaces. #679 hosting gates and legitimate browser/ChatGPT/Nolan acceptance
remain mandatory.

### Narrow ownership-summary guard (coordinated with #990)

The retired composer was the only caller of `loadOwnershipReviewSummary`; the RPC
remains callable, so removing the UI alone did not close inactive-session access.
None of the new MCP tools calls this RPC. PR #995 owns additive migration
`20261116170000_guard_assistant_ownership_summary.sql`; #990 owns shared policy/helper
work and confirmed it will not edit this function. The guard preserves `is_manager()`
and additionally requires the exact `auth.uid()` profile to be active. No shared
helper/policy, grants, result shape or historical rows change. Migration is UNAPPLIED.

`assistantOwnershipActiveAccount.test.mjs` executes the original and replacement RPC
in isolated PostgreSQL: original inactive manager access reproduced; patched inactive
manager/admin, staff/team, missing/null identity and anonymous access denied; active
manager/admin output unchanged and historical conflict retained. The helper fixture
intentionally remains role-only to prove this function protects itself independently
of #990. Hosted JWT/RLS integration remains a release gate.

### Continuation verification

Integrated runtime/source tree: merge `1c77695` includes main `1c1bd36` (#996).
Final focused suite:323pass/0fail/0skip (23.09s) on `1d01b83`, including the
ownership-summary regression. This includes the actual MCP
routing/canonical-key path, existing MCP context/client/operational/strategy contracts,
shared approval freshness, retirement guards, new knowledge/scope/redaction fixtures,
and real isolated PostgreSQL execution. SQL tests exercise atomic append/replay/conflict,
wrong-client/stale-version/unapproved/expired/foreign-scope evidence denial, explicit
human decisions, manager-only approval, history immutability, inactive-actor retry
refusal, connection impersonation denial and authenticated receipt/RPC denial.
The existing operational PostgreSQL fixture also ran (not skipped).

PGlite was installed only under `/tmp/cg-marketing-db`, with no production dependency
or lockfile change. The new module/catalog pass strict TypeScript against the existing
Supabase client types using a validation-only URL mapping. Scoped runtime lint and
final application build are recorded on the PR. These checks do not substitute for
native hosted Deno, real installed connector sessions or production migration acceptance.
The initial candidate's full-suite result below is historical; a new full-suite pass
is not claimed for this continuation. No paid generation or live writes performed.

## Original removal candidate and receipt (historical; see continuation above)

Status: SOURCE CANDIDATE ONLY. Not merged or deployed. Owner request: remove the
broken in-app model while preserving Dynamics operations through ChatGPT/Nolan.
Base: main `f89fefea70108bfe417953d00330476530aa9c4d`.
Branch: `codex/retire-staff-ai-20261116` in an isolated cloud worktree.

## Ownership and scope

Read AGENTS, the ops handover, master tooling/orchestration/prompt contracts,
continuity/page/product/milestone authorities, security/access rules, repository
feature-implementer/repo-auditor skills and #679 local-first release instructions.
Reviewed open PRs and latest #381 comments. No active retirement PR found.
#990 native Nolan workbook remains a separate draft; no Work/Nolan files changed.
#991 publishing, #956 designer, #981 editing handoffs, #984 brand panel and
onboarding lanes remain untouched. This does not reverse #993/#994 navigation or
client opening-viewport work. Existing checkout `work` was not modified.

## Traced removal

- `AdminLayout` lazy-mounted `GlobalAssistantComposer` on staff pages. Deleted that
  component and its exclusive `DailyAssistantCapture` panel, mount/fullscreen state
  and redundant reserved desktop space. Notification polling and mobile navigation stay.
- Deleted full `AssistantPage`. `/admin/assistant`, including bookmarked queries/hash,
  resolves with replace navigation to existing `/admin/my-assistant`; old prompt/record
  query strings are intentionally not forwarded or executed. Existing RequireStaff
  and profile gates remain. The target is the real daily-work/leads/Project-setup
  workspace, with an explicit retirement notice, not a new empty chat button.
- `/admin/marketing-ai` retains the same manager guard and saved-artifact/version/
  comparison/approval/history view. Removed request/routing/generate/regenerate/handoff
  controls. Marketing's `?section=ai`/existing tab state continues to resolve; its label
  is Saved artifacts. Human review RPCs remain, without automatic generation.
- `cg-assistant-chat` authenticates and validates active staff exactly as before, then
  returns HTTP410 `STAFF_AI_RETIRED` for chat/default/unknown actions. No prompt audit,
  model request or business write occurs. `marketing-workflow` returns the same code
  for `run` after its existing authentication and role checks. Cached generation
  requests therefore cannot spend or create new artifacts after the Edge rollout.
- Admin-only masked diagnostics/provider-health testing and specialist status remain
  under their existing gates. No provider health test was invoked in this work.
  Legacy server implementation helpers remain behind the retirement guard; this is
  bounded runtime retirement, not wholesale deletion of shared AI infrastructure.

## Preserved dependencies and connector evidence

The MCP runtime, catalog, OAuth, context isolation, operational receipts, permissions,
all four existing plugin skills, every migration, provider secret/configuration and
shared skill/router implementation are unchanged. The 59-tool catalog is unchanged.
The new dependency-graph regression walks actual relative imports from MCP and
rejects either retired HTTP entry point or a direct invoke of either function.

| Business capability | Retained external contract / evidence |
| --- | --- |
| Exact identity, daily brief, personal profile/preferences | `resolve_project_context`, `get_my_assistant_bootstrap`, `get_my_day`, `get_my_profile`, `update_my_preferences`; project-context and coexistence tests |
| Tasks, assignments, recurring work, notes/status | `list_my_tasks`, `get_task`, `create_task`, `update_task`, recurring tools; exact-actor/idempotency/operational-write tests |
| Calendar, Client Schedule, Microsoft reconciliation | calendar/schedule tools and `run_microsoft_sync`; coexistence, pagination and calendar-readiness tests; no authority merge |
| Exact-client creative context, monthly strategy | `get_client_context`, strategy brief/submit/amend tools; client-context and monthly-strategy tests |
| Guidelines, content planning, closeout and upload verification | existing guideline tools, `get_content_run_plan`, closeout/upload tools; catalog, content actions and retry-receipt tests |
| Leads and governed email drafts | lead tools and `compose_mail_draft`; no email-send permission added |
| Hours/travel | existing four staff logger tools; CG Hours regressions |
| Approved/current skill retrieval | `skilledAgents.ts`, standalone `get-client-context`, director knowledge and shared retrieval tests retained; stale/unapproved/client isolation gates unchanged |

`ai-router.ts` is still used by monthly strategy, meeting debrief, daily capture,
content-run voice debrief, suggest-content-videos and marketing-workflow.
`skilledAgents.ts` is still imported by directorKnowledge and marketing-workflow.
Deleting the directory or revoking providers globally would break these capabilities.
None of the shared model-backed business functions were invoked during validation.

### Honest parity limits

This proves retained source contracts and fixture behavior, not live ChatGPT/Nolan
acceptance or every account's installed tool catalog. MCP does not currently expose
raw legacy Marketing artifact CRUD or arbitrary shared Skill Card search as dedicated
named tools. We do not invent such tools or claim that external prose automatically
creates legacy artifact versions. Existing artifact review remains accessible in-app;
external drafting/strategy/guideline operations use their existing contracts. Voice
capture/chat-specific interaction is removed, not silently recreated as a new UI.
Confirm the owner's required external workflow coverage before release; if raw artifact
creation or unrestricted skill search is required, implement a separately reviewed,
scoped connector contract rather than re-enable the retired model. All source skills
and historical records are retained meanwhile.

## Validation

See the draft PR for final exact-head totals. New tests execute actual transpiled
HTTP handlers with synthetic auth and fail-fast provider/data/write dependencies.
They cover staff/team/manager/admin/owner410, missing authentication401, client and
inactive403, methods405 and OPTIONS, removed source/mounts, legacy routes, preserved
history controls, dependency closure and all four plugin skill files.
164 obsolete assertions/tests tied to the deleted UI were retired; independent SQL,
action/parser, shared router/knowledge and connector security tests remain. Their
replacement is retirement/connector coverage, not pretend acceptance of removed UI.

No real staff/client browser session, physical phone or live ChatGPT/Nolan action was
used. No production data, SQL, credential, provider configuration, desktop, permission,
cloud build or deployment operation was performed. Local dependency installation used
the existing lockfile with scripts disabled and a temporary cache; no dependency change.

## Exact release gates

1. Review this draft and resolve required external parity gaps above. Reconcile with
   latest main and active owners (especially shell/#990/#991) and rerun affected tests.
2. Obtain legitimate same-origin staff/manager/admin/client acceptance on the candidate:
   old assistant links, no floating composer or generation controls at desktop/phone
   widths, My Assistant setup/lead/day workflows, artifact read/compare/human review,
   notification navigation and unchanged role denial. No copied sessions/auth bypass.
3. Verify installed ChatGPT AND Nolan connectors using read-only real identity/bootstrap,
   tasks/calendar, exact-client context, guideline/closeout and hours reads. Mutating
   business acceptance needs explicit exact-record authority; no invented test records.
4. Owner-approved exact-SHA release packet under #679: target project/environment,
   fresh billing/headroom/reserve, maximum incremental spend, prior rollback deployment,
   one local prebuilt artifact/stage/promotion and affected-domain uptime evidence.
   Keep `vercel.json` git.deploymentEnabled=false. Push is not deploy authorization.
5. Separately approve the two additive migrations, changed MCP entry/catalog/module
   and the two retired Edge entry files with their shared dependency closures and
   unchanged JWT/auth settings. Apply reviewed migrations before exposing MCP writes;
   verify receipt permissions and active-account/exact-client/version denial, including
   the ownership-summary RPC. Verify retired Edge bytes and legitimate-role410 plus
   client/anonymous denial, with no provider usage or generation writes. Roll out Edge
   retirement before the frontend so stale generation requests fail closed.
6. Promote the reviewed frontend only after the above. Verify emitted/source assets,
   legacy-link handoff, absence of composer chunks and real staff/manager behavior.
   Old already-open bundles can still contain deterministic RPC UI until reloaded;
   require a normal reload/asset update, not revocation of shared business RPCs.
   Rollback is the prior approved frontend and exact prior Edge bundles, with history
   intact; restoring generation needs explicit owner decision.

Production status remains unchanged until an approved release executes. No automatic
merge/deploy. Google Control Centre's exact target is not available in the repository
handover; do not guess a tracker destination. Record the PR in #381 for continuity.

### Local verification receipt

- `npm run build`: PASS (TypeScript + Vite7, 25.83s). App code found in emitted
  assets (`client-schedule` in10 chunks); no deleted AssistantPage/composer/capture
  chunk remains. MyAssistantPage is intentionally retained. Existing chunk-size warning.
- `npm run lint`: exit0, zero errors and17 warnings (including existing hook/unused
  disable warnings). No lint suppressions added for this change.
- Targeted removal/navigation/marketing tests:109/109 pass. Final retirement + retained
  mobile utilities + portal-access fixture checks:29/29 pass, including16 retirement
  tests. No providers called.
- Connector/shared-skill parity group:420 total,419 pass, zero failed, one optional
  local PostgreSQL fixture skipped (`CG_LOCAL_PGLITE_MODULE` unavailable). Covers MCP
  context, catalog, action exposure, writes/receipts, coexistence, strategy, client
  context/review, shared retrieval/activation and CG Hours.
- Actual Marketing archive component SSR with existing AuthProvider/MemoryRouter:
  PASS retirement notice, client filter and history shell; generation form absent.
  Effects were not executed. This is rendered-source evidence, not browser/auth QA.
- Untouched-main baseline `tests/commandCentreNavigation.test.mjs`:13 total,11 pass,
  two stale `renderNav(false, closeMobile)` assertions fail after #993's searchable
  mobile navigation. Runtime is not reverted; this unrelated test file is unchanged.
- `git diff --check`: PASS. Fresh origin/main still f89fefea.
- Full final-source suite and exact commit receipt are recorded in the draft PR.
- Native Deno type checking, actual hosted Edge/JWT acceptance, authenticated browser
  and phone checks are NOT claimed. No history/localStorage/data deletion performed.
