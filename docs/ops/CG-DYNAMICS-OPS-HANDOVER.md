# CG Dynamics Ops Handover

Last updated: 18 September 2026 SAST  
Status: CURRENT operating handover for ChatGPT coordinators, supervisors and coding agents  
Repository: `CGProductionHouse/CG-Dynamics`

## Purpose

This is the durable handover for continuing CG Dynamics operations without depending on private chat history.

A fresh ChatGPT/Codex/OpenCode session should be able to continue from GitHub + the shared Control Centre without asking CA to repeat project history, agent ownership, model routing, protected gates or current product state.

The minimum human prompt should be:

```text
Continue CG Dynamics ops from current GitHub truth.
```

That is enough only if the agent follows the bootstrap below.

## Continuous continuity maintenance — mandatory

This handover is a **living operational file**, not a one-time checkpoint.

Every future ChatGPT coordinator/new chat that materially changes CG Dynamics state must keep this file current as part of the same operating cycle.

Material changes include:

- a manual or autonomous owner starts/stops;
- a queued lane becomes active;
- a PR is created, materially advances, merges or is abandoned;
- production deployment state changes;
- a protected gate is crossed or newly introduced;
- a product/data authority changes;
- model/provider routing changes materially;
- a major rollout completes;
- a new integration lane becomes part of normal operations;
- the current lane snapshot becomes materially misleading.

Required write-back sequence after a material change:

1. update the owning issue/PR;
2. update Issue #381 if cross-lane state changed;
3. update the Google Control Centre / Dispatch Queue;
4. update this handover when its operating rules or current lane snapshot changed;
5. only then consider the handoff complete.

Do **not** wait for CA to remind the coordinator to update continuity.

Before a long chat ends, context becomes crowded, a new chat is likely, or CA says to continue in another chat:

1. refetch #381 + the Control Centre + current GitHub;
2. reconcile active/queued/completed ownership;
3. update this handover with any material drift;
4. leave a durable GitHub handoff;
5. ensure the next chat can continue from the one-line prompt without reconstructing history from conversation memory.

The hourly Supervisor must also check for **handover drift**. If the handover's operating rules or current-lane snapshot are materially stale, it should update them as routine docs-only ops when safe, or leave an explicit #381 handover-update requirement. It should not rewrite the file every hour when nothing material changed.

Keep this file concise and operational. Do not turn it into a chat transcript or append every minor event. Preserve stable rules; refresh the current-state sections.

Never put passwords, secrets, tokens, private credentials or generated credential lists in this handover.

## 1. Fresh-chat bootstrap, mandatory before acting

Do these in order:

1. Identify the exact repo: `CGProductionHouse/CG-Dynamics`.
2. Read `AGENTS.md`.
3. Read this file.
4. Read `docs/ai-workforce/MASTER-AI-TOOLS-AND-WORKFLOW.md`.
5. Read `docs/ai-workforce/AUTONOMOUS-CODING-ORCHESTRATION.md`.
6. Read GitHub Issue #381, **CG Systems Supervisor live report**, including the newest comments.
7. Read the Google Sheet **CG AI Model and Agent Control Centre**.
8. Refetch current GitHub `main`, open PRs, relevant issues, latest comments and GitHub Actions runs.
9. Reconcile GitHub state against the Control Centre before dispatching, coding, merging or reporting.
10. Only then choose the next action.

Do not ask CA to repeat information that can be recovered from these sources.

Do not use a chat summary, stale prompt or historical SHA as current truth when live GitHub/tracker state is available.

## 2. Control plane

### GitHub

GitHub is the durable source of truth for:

- committed code on `main`;
- active branch/PR ownership;
- issue scope and product decisions;
- implementation evidence;
- tests/checks;
- blockers;
- production rollout evidence;
- durable handoffs.

Primary supervisor thread:

- Issue #381: `CG Systems Supervisor live report`

The supervisor issue is not a replacement for owning issues/PRs. It is the cross-lane control-plane ledger.

### Google Control Centre

Spreadsheet:

- Name: **CG AI Model and Agent Control Centre**
- Spreadsheet ID: `1TC0qBhVoNQLSmd_jXHWT444Kl7s9qkhNv_2dG_zBvIg`

Important tabs:

- Dashboard
- Models
- Provider Accounts
- Projects
- Dispatch Queue
- Run Log
- Routing Rules

Interpretation:

- GitHub = code/product truth.
- Control Centre = worker ownership, capacity, routing and dispatch truth.

Both must agree.

If they disagree, refetch GitHub and reconcile the tracker. Never dispatch from stale tracker state.

## 3. Supervisor

Active automation:

- Title: **CG Dynamics Supervisor**
- Schedule: hourly
- Timezone: `Africa/Johannesburg`
- Automation ID: `6a9ef983c0548191be8a210d4cd73e56`

Every run must:

1. read Issue #381;
2. read Dashboard, Dispatch Queue, Run Log and Routing Rules;
3. refetch current main, relevant issues/PRs/comments and current workflow runs;
4. reconcile tracker vs GitHub;
5. register any CA manual coding agent that appeared since the prior run;
6. reserve that issue/file set from autonomous workers;
7. update completed/failed lanes with durable PR/SHA/run evidence;
8. release freed capacity correctly;
9. route safe unowned work to available approved capacity;
10. update #381 when owner, SHA, run, blocker, gate, production state or material direction changes.

The supervisor is an execution coordinator, not a reporting-only bot.

## 4. Ownership and anti-collision rules

One implementation owner per issue/file set.

Manual CA ownership always wins.

When CA launches a manual Codex/coding agent:

- immediately register it in Dispatch Queue;
- record issue/PR/branch ownership;
- reserve overlapping files from autonomous workers;
- do not dispatch a second agent into the same lane;
- when it finishes, record the PR/SHA/result and release capacity.

Continue an existing branch/PR when it already owns the work.

Do not create:

- duplicate PRs for the same mission;
- shadow implementations;
- parallel redesigns;
- a second data authority;
- a second client/task/calendar/strategy/store system when canonical truth already exists.

An old open PR is not automatically an active worker lane. Tracker + newest issue/PR comments decide whether it is active, parked, stale or superseded.

## 5. Model and worker routing

Always inspect current provider/model availability before relying on a hard-coded model.

Current preferred autonomous pattern:

1. OpenCode free primary, normally `opencode/nemotron-3-ultra-free`.
2. NVIDIA free/independent fallback, normally the current Nemotron Lightning route.
3. The separate CA-key NVIDIA bucket may run a second non-overlapping lane when healthy.

Hard rules:

- never spend OpenCode Zen credits for routine autonomous CG Dynamics work;
- do not use OpenCode Go unless CA explicitly chooses it;
- do not repeatedly hammer a rate-limited or broken lane;
- on provider/quota failure, reroute once to another approved independent free lane or stop cleanly;
- durable GitHub state is the memory between model attempts.

Manual Codex/ChatGPT agents may work in parallel with autonomous workers only on non-overlapping ownership.

## 6. Coding-agent prompt standard

GitHub should contain the real brief.

Manual prompts should be short.

Preferred pattern:

```text
CA MANUAL AGENT

Repo: CGProductionHouse/CG-Dynamics

Read AGENTS.md, the owning issue and current PR/main. GitHub is the full brief.

Own <issue/PR> only. Continue the existing lane. Verify, commit and push only if green.

Return completed / verification / commit / blockers.
```

Do not paste the entire project history into coding prompts when GitHub already contains it.

If the coordinator discovers a new requirement, update the owning GitHub issue first, update the Control Centre ownership/state, then give CA the short prompt.

## 7. Durable delivery standard

Do not call workflow green "progress" by itself.

A meaningful implementation checkpoint should normally include:

- pushed commit;
- owning PR or durable issue handoff;
- focused tests;
- build;
- changed-file lint where relevant;
- diff review;
- browser/role/device acceptance for user-facing work;
- exact production evidence if deployed.

Long-running agents should push an early durable checkpoint.

If an agent loops for roughly 15 to 20 minutes without durable output, narrow it to one small checkpoint instead of burning capacity.

## 8. Routine ops authority vs protected gates

CA delegated routine green ops merge/deploy authority to the coordinator on 18 September 2026.

Therefore routine, verified, non-protected code lanes do not need to stop only to ask CA "may I merge?".

Routine coordinator authority includes:

- mark ready;
- merge a clean reviewed PR;
- allow normal Vercel production deploy;
- verify production;
- update issues/tracker;
- fix a bounded regression if normal code-only scope and verification stay clean.

Still stop for protected gates unless CA separately and explicitly approved that exact action:

- production SQL/schema/data migrations;
- production reconciliation apply that mutates canonical business data;
- secrets/credentials;
- auth/provider permission changes;
- provider consent/submission;
- spend/purchases;
- payments/debit orders;
- DNS/domain ownership changes;
- external email/messages/publishing/sends;
- destructive data operations;
- destructive OneDrive actions;
- broad permission changes;
- CG Hours production setup/identity mapping/secrets;
- first real CG Hours live draft write.

Important distinction: a migration file in Git is not permission to apply it.

## 9. Current product authorities that must not drift

### Client Schedule

`monthly_deliverables` is canonical Client Schedule truth.

Do not replace it with:

- Planner;
- a second calendar;
- a strategy-specific schedule;
- OneDrive folder names.

Client Portal Plan/Calendar must reuse this truth.

### Monthly client strategy

Issue #391 established the canonical client+month strategy backend.

Client-visible strategy should be:

- exact client;
- exact selected month;
- published client-safe projection only.

Staff workflow is:

- meaningful baseline seed;
- staff review/amend;
- approve;
- explicit publish.

Never auto-publish.

### OneDrive naming

Canonical production folder authority:

```text
Clients/<Client>/Videos/<YYYY>/<YYYY_MM_MON>/<YYYY_MM_CLIENT_VIDEO_XX>
```

Use configured client short code and canonical helpers.

Never guess:

- short code;
- month label;
- sequence;
- separator/casing;
- a near-match folder.

If required naming context is missing, stop and surface the missing value.

Authority:

- `docs/onedrive-naming-authority.md`
- `src/lib/onedriveCanonical.ts`
- Issue #224 naming correction.

### Client Portal Library

Issue #396 owns the client-safe OneDrive library.

Canonical boundary:

```text
Clients/<Client>/A_ClientPortal_<ClientSlug>
```

Client-safe inner categories currently locked:

- Brand Identity
- Graphic Design
- Video
- Photography where relevant

Internal working/source/raw/admin folders stay outside the client-safe boundary.

Client access target is read/view/download only.

No anonymous public share by default.

### Staff Assistant runtime policy

Production Staff Assistant policy is currently:

`2026.09.18-coexistence-naming-3`

It includes the canonical OneDrive naming rule and stop-rather-than-guess behaviour.

Do not trust stale Project Instructions over live `get_my_assistant_bootstrap`.

## 10. Microsoft freshness rule

Issue #327 owns Morning Ops health/reconciliation.

As of 18 September 2026:

- company_admin context/bootstrap is healthy;
- CG Dynamics connector session failure was proven transient;
- Microsoft reconciliation remains stale/degraded;
- a reconciliation preview fetched 6,765 records but `2025 CLIENTS SCHEDULE` hit the 5,000-record safety cap;
- the latest successfully applied reconciliation remains 19 August 2026.

Until a successful reconciliation is applied:

- Microsoft/Planner/Outlook live data is freshness authority for Microsoft-backed work;
- Dynamics mirrors must be treated as stale;
- Dynamics-native work remains valid and must still be read;
- Staff Assistants should flag `SYNC STALE / SYNC FAILED` where relevant.

Do not hide the stale state.

## 11. Current lane snapshot

This section is an orientation snapshot only. Refetch GitHub + tracker before acting.

### Active

**#396 Client Portal Library**

- Owner: CA manual coding agent 1.
- Scope: bounded read-only Client Portal Library / Brand Hub foundation.
- Reuse the exact `A_ClientPortal_<ClientSlug>` boundary.
- Use durable OneDrive item IDs; never fuzzy filename identity.
- Do not expose raw drive IDs/internal paths/sibling folders.
- No real OneDrive sharing/permission mutation, production file move/copy or new naming convention in this checkpoint.
- First real client share remains a protected gate.

**#404 + CG-Hours #7 Client Registry Bridge**

- Owner: CA manual coding agent 2 across both repos.
- Scope: implementation + tests + one owning PR per repo only.
- No overlap with Dynamics #361/#376 or CG-Hours PR #3 Staff Logger.
- Production migration and initial JFJ Electrical / Neshora Oxygen / VCS Cleaning Solutions backfill remain protected apply gates.

Goal:

```text
CG Hours client create
-> durable outbox/retry
-> authenticated Dynamics ensure-client action
-> exact UUID mapping
```

Rules:

- no fuzzy name matching;
- no guessed Dynamics short_code;
- Dynamics becomes canonical identity/name authority after mapping;
- initial controlled backfill: JFJ Electrical, Neshora Oxygen, VCS Cleaning Solutions;
- production migration/data backfill remains CA-gated.

### Queued / ready to dispatch

No currently queued lane should be dispatched into #396 or #404/#7 while the manual owners above remain active. Re-read the Control Centre for any other safe unowned work.

### Recently completed production rollout

**#402 Client profile rollout**

- issue closed complete;
- 37 active portal mappings;
- final continuation created 35 accounts;
- 0 skipped;
- 0 failed;
- 0 remaining;
- 12 pre-existing users/accounts preserved, including Red Oak, AV Event Life, Braize and staff/admin accounts;
- exact-client isolation remained intact;
- no credentials were exposed or collected;
- no further code/migration/deploy was required for the final batch.

### Complete but not automatically equivalent to merged/live

**#395 / PR #398**

- implementation complete;
- current-month/sticky month;
- canonical monthly strategy activation;
- staff seed/review/approve/publish workspace;
- refetch PR state before deciding merge.

### Parked future

**#400 Client Billing Hub**

Future:

- Xero account/invoice projection;
- payment method;
- debit order;
- stronger user-specific client auth;
- audited admin support access.

Do not let #400 block current client portal rollout.

## 12. Client access rollout rules

Phase 1 client access is intentionally simple.

Current foundation:

- username or email login;
- supported server-side provisioning;
- exact client profile mapping;
- admin Client Access workspace;
- predictable Phase 1 starter credential convention approved by CA;
- no plaintext credential persistence.

Do not expose the starter password in automated browser inspection.

Provision/reset responses no longer return the password.

The admin UI can deliberately derive/copy login details only when a human/admin explicitly clicks the copy action.

Do not publish credential lists to GitHub, tracker or logs.

## 13. CG Hours integration rules

CG Hours ChatGPT logging remains draft-only.

Allowed after full production setup:

- authenticated staff member reads own allowed context;
- creates own draft hours;
- creates own draft travel/km;
- corrects/removes own draft records;
- success only after a durable CG Hours record ID/receipt.

Never allow ChatGPT to:

- submit a week;
- approve;
- reopen submitted work;
- run payroll;
- act as another staff member.

CG Hours production migration, mapping, secrets/config and first real live draft write remain protected gates unless CA explicitly approves them.

Do not let the new client-registry bridge overlap the Staff Logger PR/files.

## 14. Merge/deploy procedure for a routine green lane

Before merge:

1. refetch PR;
2. verify correct owner/scope;
3. verify current head;
4. verify mergeability;
5. inspect relevant checks/build/preview;
6. ensure no protected gate;
7. ensure no active overlapping writer.

Then:

1. mark ready if appropriate;
2. merge;
3. verify production deployment;
4. check runtime errors;
5. smoke the relevant production route;
6. update owning issue;
7. update Issue #381;
8. update Dispatch Queue with production evidence;
9. release capacity.

If the preview fails, fix it before merge. Do not wave through a red preview.

## 15. How to use free model capacity well

The supervisor should keep useful capacity moving, but only on safe unowned work.

Preferred sequence:

1. finish an existing owned PR if ownership is still active;
2. pick the highest-value queued safe lane;
3. reserve it in tracker before dispatch;
4. dispatch one owner;
5. require early durable evidence;
6. if failed with no checkpoint, diagnose before retry;
7. release or retain ownership explicitly.

Do not burn model capacity on:

- healthy status checks;
- a lane waiting for CA/provider permissions;
- a protected migration gate;
- a stale duplicate task;
- redesigning something already approved;
- broad retries after repeated no-output failure.

## 16. New-chat response standard

When CA says something like:

```text
Continue CG Dynamics ops.
```

the coordinator should not ask "what were we working on?"

It should:

1. recover current state using this handover;
2. read #381 + tracker;
3. inspect current active/manual lanes;
4. inspect freed capacity;
5. report only material current truth;
6. continue routine safe work automatically;
7. ask CA only for a genuine protected/manual decision.

CA-facing updates should stay compact.

Recommended structure:

```text
CG Dynamics - MASTER STATE
Active:
Moved:
Reliability:
Next:
CA gate:
```

Omit empty sections.

## 17. Control-plane hygiene

Every material handoff must leave durable evidence.

When state changes:

- update owning issue/PR;
- update #381 when cross-lane state changed;
- update Dispatch Queue;
- update this handover whenever its durable rules or current-state snapshot changed;
- include PR/SHA/run/deployment evidence;
- release/retain capacity honestly.

Do not leave a manual agent marked active after it completed.

Do not leave a failed autonomous lane looking healthy.

Do not leave a merged lane queued.

Do not treat old issue comments as current when a newer durable handoff exists.

## 18. Fast recovery checklist

If a future chat feels lost, do not rebuild context from CA's messages.

Run this recovery:

```text
repo -> AGENTS.md -> this handover -> #381 -> Control Centre
-> current main -> open PRs/issues -> current runs -> reconcile -> act
```

That is the CG Dynamics operating system.

A future chat is not finished with a material CG Dynamics handoff until the durable control plane **and this handover** are current.
