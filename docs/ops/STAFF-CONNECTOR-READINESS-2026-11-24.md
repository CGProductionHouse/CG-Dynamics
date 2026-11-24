# Staff connector and Microsoft readiness — 24 November 2026

Same isolated draft PR1005. Code checkpoint `755d0d26d1fe0abd640461b1102e85cc7c87ee03`.
CA authorised completing the company staff connector on MSI. No Vercel, migration,
provider/permission/secret changes, publishing, upstream Microsoft writes or fake
tasks/time entries. Other worktrees remain untouched. Content Autopilot stays OFF.

## Reconciliation completed

The existing transition had been **paused** since13November. Its last mirror was
12November23:41UTC. The normal Microsoft Import page now records Active, changed
24November18:10:31UTC. No direct SQL mutation was used.

One existing durable preview job `76af4b6f-4847-471a-8a9a-b74f7f586a9b` was resumed
by exact ID. The existing scheduled worker completed that same job and its
automatic apply; no second scheduler, manual overlapping apply or duplicate job.
Run `e874ca5e-7ce4-49d0-8b91-3af9e2fb2ddb` finished20:23:11SAST:

- 35 applied:13 Calendar creates,3 updates,1 cancellation;10 Planner creates,
  8 completions.
- 1,680 skipped:82 conflicts,1,206 completed operational history,51 unchanged
  Calendar and341 unchanged Planner records.
- 0 failed;0 remaining. Result **PARTIAL**, not healthy.
- 6,449 Client Schedule records excluded from automatic application. Eight already
  shared Cape dates checked,0 changed. Package/master data were not changed.

Six configured sources were fully enumerated:2025 CLIENTS SCHEDULE6110,
MASTER CLIENT TO DO182,Default operational Calendar67,CG Socials566,
Client Socials - July2026 339,To Do899:8,163 records total. Outlook coverage is
1November2026 through1February2027(exclusive),Johannesburg local time.
Protected-source enumeration/counts are not a claim that all6110 master checklist
details or package comparisons were enriched/reviewed.

Fresh supported staff `get_microsoft_sync_status` readback independently confirms
Active collection plus fresh PARTIAL reconciliation and these counts. All82
conflicts also exist in the canonical run-item journal; no383/381-style count gap.

## Connector correction released

Shared instructions previously told ordinary staff to call the company-admin-only
`run_microsoft_sync`, producing a genuine permission loop. Policy
`2026.11.24-scoped-reconciliation-6` now keeps normal exact-ID Teams writes in the
staff context, lets the existing automatic worker refresh Dynamics, and requires
status plus exact linked-task readback. Until acknowledged, report DYNAMICS SYNC
PENDING. Never switch identity, repeat a successful source write or create a copy.

Sync status reads lifecycle separately from historical freshness. Missing/failed
settings cannot imply Active; paused/ended collection cannot be healthy solely
because an older run is recent. Explicit preview calls are bounded to4 source
units, retain the same job ID and return IN_PROGRESS while collecting. Actual
source failures still fail. Preview success does not claim application.

MCP101 ACTIVE;75 independently read-back source files. Four owned files changed,
one shared pure helper added,70 old files byte-stable, including the parallel
Meta/publishing modules. Current hosted bundle SHA256:
`c22711f875e2a14a10a6c96e3f85c4b9aa9d718fe82d5cd3c41e4ab638259931`.
Fresh preflight matched MCP100/74files before the single release. Existing custom
OAuth/verify_jwt=false preserved; anonymous MCP POST401,OAuth metadata200.

## Actual acceptance and limits

All six active operational staff contexts(Alana,Christie-Ann,Franco,Ger-Marie,KG,
Sydney) passed exact-identity Day and CG Hours reads this session. No fabricated
write was used as proof. The installed company ChatGPT catalogue was refreshed.
A **new actual Franco CG Assistant Project chat** then read bootstrap,Day,Hours
and sync status successfully, returned the exact Franco identity/new policy and
correctly explained automatic reconciliation without admin impersonation.
The company Chrome/account is info@cgproductionhouse.com; its separate Business
workspace is visibly Deactivated. No billing/workspace/access change was made.

Independent live Teams and Dynamics reads also match one real linked task:
Dynamics `2f46dc73-b25b-466e-aa95-95bae069a20f`,Planner
`XiOQ-CKSHU2fbssC6mJ-wmUAMC4v`:exact plan/title,provider100%,Dynamics done.
This is read-only parity evidence, not a newly performed task-write/retry test.
Earlier genuine registration/retry receipts remain separate evidence.

460/460 focused serial checks across22 test files pass,0fail/0skip, including
actual disposable PostgreSQL actor/idempotency/calendar contracts. New8 lifecycle,
actual-handler/loader,bounded-runner and role-guidance tests pass. TypeScript/Vite
production build(app code present),scoped ESLint,diff,official Edge Runtime1.74.3
bundle and native shared-helper check pass. First run's fixture-env failure and
stale policy snapshot were corrected without deleting/skipping assertions.
No blanket full-runtime native type-check pass is claimed; prior source-only
support-module diagnostics remain documented in the guideline release receipt.

Frontend status/recovery-message repairs and earlier Calendar/Pipeline form fixes
remain **SOURCE ONLY** pending an authorised frontend release; no Vercel action.
This is not certification that every staff write/client/source is complete.

## Exact remaining holds

All82 are MASTER CLIENT TO DO records still0% complete in the source:

| Bucket | Held cards | Gap |
| --- | ---: | --- |
| RAADZAAL | 9 | No exact canonical client/approved alias |
| BIM3D | 8 | Same |
| LUMINOUS | 8 | Same |
| RZ PLANT HIRE | 8 | Same |
| ULTIMATE PICKLEBALL | 8 | Same |
| ENGEL & VOLKERS | 4 | Same |
| FLEURDAL MIDAS | 4 | Same |
| SUPA QUICK | 4 | Exact branch missing:DP1–DP4,4 Wednesday posters;undated |
| RECON TACTICAL | 4 | No exact canonical client/approved alias |
| DIGNITAS | 4 | Same |
| ETADI | 4 | Same |
| NOVUM GROUP | 4 | Same |
| PICKLERSPARK/PALETAS | 4 | Same |
| COSMETIC CONNECTION | 4 | Same |
| DIS PROPER | 3 | Same |
| NIKAN SOLAR | 1 | Same |
| ONDER DIE SNOR | 1 | Same |

CA's two source/client questions are pending. Do not label these historical,
complete,active clients or a particular Supa branch without confirmation. Do not
invent mappings/dates or remove audit records to make the health green.

Mail:the normal Gmail connector identifies m.productions.cg@gmail.com. Existing
preferred per-staff sender/signature readiness remains pending. Native company
Gmail for info@cgproductionhouse.com requires Google re-authentication(password
challenge). No sender alias/signature was verified or marked ready;no mail sent.
Owner sign-in is needed before checking existing approved send-as configuration.
Amonique/Nolan are absent from the current active staff directory;existing Project
names are not authority to reactivate accounts or grant permissions.

Private source manifests,rollback,qualification logs,exact parity and release
receipts:`C:/Users/chris/.codex/artifacts/staff-plugin-readiness-2026-11-24/`.
Google Control Centre exact destination remains unidentified;no guessed write.
