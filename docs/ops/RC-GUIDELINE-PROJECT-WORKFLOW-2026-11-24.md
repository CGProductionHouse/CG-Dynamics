# Exact-client guideline workflow repair — 24 November 2026

Owner request: restore ordinary Content Guideline preparation and client sharing
from the internal RC-Polypipe ChatGPT Project. Existing #896 owns this workflow.
Work is isolated in `fix/rc-guideline-project-workflow`, from main `b524a9f9`.

## Reproduced defect

Live `find_content_runs` returns the owner's quoted staff-only error in a client
Project. Internal client Projects already author, amend and explicitly publish
their own guidelines. OAuth callers must still be active CG staff. A client
Project is an internal workspace pinned to a client, not a customer login.

Only read-only discovery moves from `STAFF_SUBJECT_TOOLS` to `CLIENT_SCOPED_TOOLS`.
Each call is still resolved independently. Foreign input is refused before reads.
The handler also fences deliverable lookup, run ownership and nested guideline,
video, folder and closeout reads to the same client. Malformed foreign results
are refused before names or navigation escape. Personal tasks, CG Hours,
calendar/linkage mutations and company-wide inventories retain their gates.
There is no new role, permission or customer access.

The first live authoring test also reproduced a second defect: the dispatcher
adds the proven `client_id` routing field, then the add/update handlers passed it
to strict video-field validation, which rejects client reassignment. Both handlers
now compare routing against the resolved run/video owner and remove only that
non-editable routing field before validation. The validators stay strict. The
failed live append created no video; its original retry key remains in use.

## Exact source recovered

Canonical RC-Polypipe: `4f6106de-c437-404e-8cef-fbe848de0665`.
Staff direction: `a2685141-92e3-47e1-9ff1-360e56882498`, recorded 24Nov06:50:24UTC.
Body MD5: `da42f58fc42aedba3cad96a1a74dcf48`.
Full-row MD5: `21dec273417af412a264433df2fba5c8`.

All eight Afrikaans scripts, cast lines, endings, visual directions, production
requirements and technical checks are intact. Initially no canonical RC guideline existed.
Three exact RC runs and their calendar events are cancelled. Two existing pipeline
films are unrelated. Do not overwrite or revive these records.

The existing schema and `createRun` helper allow an undated `planning` run.
Preparation must keep date, time, coverage month and calendar identity null until
supplied. Eight ideas do not establish eight monthly slots or a booking. Preserve
the source verbatim and technical checks as pending before filming.

Actual preparation: one source/hash/actor-guarded undated planning run
`c705cece-9e5c-4952-b217-73f3f9e5ee96`, and its one canonical draft guideline
`1f9eab52-8291-4733-bf1e-45e7fd9a0d8b`, ensured through the installed MCP app in
RC's client Project. Date/time/month/calendar remain null. This is an actual
narrow production preparation write, not a zero-write audit. Script save and
review publication acceptance are pending the authoring correction below.

## Local verification

- Six actual-dispatcher/handler regressions reproduced the live denial then pass:
  pinned discovery, foreign input/results, deliverable isolation, truthful read
  failure/empty states and retained unrelated denials.
- 132 focused repository tests pass: context/workspace/coexistence/OAuth/catalogue
  and guideline retry contracts. Local TypeScript/Vite build and scoped lint pass.
- Actual live-based candidate: 51 tests pass. Full bundle passes locally in the
  official cached Edge Runtime v1.74.3; no hosted build was used for validation.
- Health advisor has no health lints; logs are available. The deterministic policy
  refusal is not a provider-connection failure. Supabase's status banner is still
  monitoring an earlier API incident; no blind retry on an ambiguous write.
- The follow-up authoring regressions failed on the uncorrected real handlers,
  then pass after separating routing from editable fields: add, update, original
  retry receipts, changed-input conflict, foreign routing/video refusal, retained
  reserved-field guards and direct-handler mismatch refusal. Cumulative focused
  repository tests: 154/154. Live-based candidate tests: 58/58. Local production
  build, scoped lint, diff check and official Edge Runtime bundle pass.

## Exact backend release boundary

Project `ehtjfntukiwbgptqgbzy`, organisation `cgwucfjufkuunddzmuyf`.
Preimage MCPv90: 70 files, `verify_jwt=false`, no import map. Preserve the existing
custom OAuth/active-staff gate. Live includes other-agent publishing modules not
on main: **never deploy the Git function folder wholesale**.

Apply the reviewed patch to that exact live bundle. Only three files change:
`cg-dynamics-mcp/index.ts` (discovery handler), `projectContext.ts` (one tool
classification), `toolCatalog.ts` (description). Other 67 files are byte-identical,
including publishing/provider/OneDrive/strategy modules. Private rollback,
candidate and source manifest: `C:\Users\chris\.codex\artifacts\rc-guideline-workflow-2026-11-24`.

The owner authorised this urgent workflow correction in chat. Hold additional
spend at $0; no new resource, paid model or Vercel. Current company Chrome usage
read around08:01UTC: 14Nov–14Dec cycle,70,570/2M invocations,3.253/250GB egress,
0.005/100GB storage; quota not exceeded, display may lag1hour. Preserve 1M
invocations/100GBegress/10GBstorage headroom; max100 explicit acceptance calls.
Stop if fresh headroom or source cannot be verified.

Before ONE deployment, re-read all70 live files and refuse version/content drift.
Afterward verify every candidate source hash, auth settings, metadata200 and
unauthenticatedMCP401, then genuine installed exact-client/foreign-client calls.
If another release intervenes, stop. Roll back only this exact release, from its
saved preimage, if attributable acceptance fails and no newer release exists.

Record actual script-save/share acceptance separately. A review publication is
not client approval, filming, footage, delivery, posting or a scheduled date.
No migration, package, existing calendar, credential, permission, other-client
or other-agent data is part of this repair.

## Release receipts in progress

Discovery correction is live as MCPv91, bundle
`500abb5cc19b05a2c24a98e9b50b54a9ea6873a49721fbba209639655b6f1d0e`.
All70 deployed files independently matched the reviewed candidate. Actual installed
RC client-Project discovery works; foreign-client discovery is refused. OAuth
metadata/login return200 and unauthenticated MCP returns401.

The follow-up authoring candidate uses that exact v91 preimage: only `index.ts`
changes; the other69 files are byte-identical. Its index SHA256 is
`44c6994f1cb96df273fcf6b7f750ddbfae2c21e666bc6e5478da5d5c81b63389`.
Private v91 rollback and candidate are separately preserved. Re-read v91 before
deployment and verify actual save/readback/retry/share afterward. Do not deploy
Git main wholesale or overwrite the other lane's newer publishing modules.
