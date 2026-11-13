# Exact guideline links from company ChatGPT

Owner: #896; related narrow content tools #450; supervisor #381.

## Reproduced failure

Company ChatGPT's existing connection resolves as company-admin. Read-only live
`list_content_guideline_videos` found Germoparts' canonical draft and all four
complete saved scripts, but returned no navigation URL. The screenshot's refusal
to invent a link was therefore truthful; the connector response was incomplete.

- Client: `b6052710-417d-4b3b-8348-0f126bfea671`.
- Content Run: `72624865-e13d-4d98-af5d-211f6c837d21`, 10 November at 11:00.
- Guideline: `e4a541a8-e730-478c-812e-feb043d0ed71`, November 2026, **draft**.
- Verified existing staff route: https://www.cgdynamics.co.za/admin/content?tab=guidelines&client=b6052710-417d-4b3b-8348-0f126bfea671&guideline=e4a541a8-e730-478c-812e-feb043d0ed71

That route requires normal staff sign-in. It is not a public client share or an
approval/publication receipt. No client-facing link is fabricated for this draft.

## Reviewed change

Three existing MCP files only: `index.ts`, `contentGuidelineActions.ts`,
`toolCatalog.ts`. One UUID-validated, fixed-origin navigation helper supplies
`guideline_url`, an optional verified `content_run_url`, and explicit staff-access
wording. It accepts no caller origin, raw storage URL, title or guessed identity.

Existing successful ensure/read/readiness/add/update/reorder/link/generator
responses now contain the document link. Discovery and Content Run plan reads
include it inside `content_guideline`. Discovery refuses a mismatched guideline
client before returning document navigation. Failed saves still return errors,
not successful-save links. Existing authentication, roles, context guards,
idempotency, draft boundaries, scripts and tool schemas remain intact.

Tool descriptions tell normal ChatGPT to return the supplied clickable staff link
and read saved scripts back after amendments. Both personal/company installations
using this backend receive the runtime response fix; no separate ChatGPT model
API, instructions replacement or paid generation is required.

## Verification

- New actual-handler regression failed before the fix: live-shaped read lacked
  `guideline_url`. Seven regressions now pass: exact read/ensure/edit receipts,
  saved-script preservation, failed read/write refusal, malformed identity/query
  injection refusal, and exact-client discovery.
- Focused guideline/catalog/coexistence/navigation set: **122 pass, zero fail**.
- Broader MCP/content suites: **377 pass, one unrelated optional atomic-create
  PostgreSQL fixture skipped, zero fail**. No production-write test was run.
- App TypeScript/Vite build passes; 25 emitted app chunks contain known app text.
  Scoped ESLint and `git diff --check` pass. Existing Vite test harness HMR-port
  warning and build chunk-size/Browserslist warnings remain non-failing.
- Full repository MCP Deno import/type check passes with a validation-only
  `ImportMeta.env` ambient declaration, which the frontend normally gets from
  Vite. An unwrapped check reports only those two ambient errors. The isolated
  hosted bundle has existing omitted type-only Microsoft/report imports; no
  claim is made that its standalone type check passes. No new import dependency.
- No new authenticated browser/mobile acceptance is claimed for this backend
  response change. Existing frontend route/query contracts were checked in
  source and regression tests. The exact live connector response after release
  remains a required acceptance gate.

## Exact link release — LIVE v78

CA authorized finishing the connector and pushing live after #967 was merged.
Fresh preflight matched all40 v77 files; released only the three reviewed files
once. Independent hosted readback: **ACTIVE v78**, all40 candidate files exact,
37 preserved, authentication/settings unchanged. No Vercel operation.

Live company connector acceptance: list/readiness/Content Run plan/discovery all
return the same exact Germoparts staff guideline link. Draft status and all four
complete video projections remain byte-equivalent to the pre-release response.
The second connected account returns that same document too. Cape client scope
cannot read Germoparts' run. No client document was created/edited/published.

Additional legitimate read-only workflow checks passed: ready exact Germoparts
client context (zero coverage errors), Cape November strategy brief, Cape's eight
scheduled items with complete pagination, company daily view (zero source errors),
bootstrap/runtime policy and Christie-Ann's exact canonical staff CG Hours daily
read with logging options/travel. Staff identity was resolved from the actual
directory, not inferred from the communal administrator. No timesheet write.

## Link release packet (retained evidence; do not replay)

Baseline: Dynamics `ehtjfntukiwbgptqgbzy`, `cg-dynamics-mcp` **ACTIVE v77**,
40 hosted files, `verify_jwt=false`, no import map. Preserve its custom auth and
all existing settings. Source of the three replaced files matches current main
before this patch (normalizing only final whitespace). Candidate preserves the
other **37 hosted files byte-for-byte**; no repo-wide function upload.

Candidate SHA256 (LF source):

| File | SHA256 |
| --- | --- |
| index.ts | `704395ca0c218c528c90c413c29ecf6cc2b74eb94b436cab5ee02063af5cc276` |
| contentGuidelineActions.ts | `b3fab173b61ed3100a850d3804d928b3806c4ea9ee42525ba67fac158078800d` |
| toolCatalog.ts | `94860239e8b755a996ced2ab5f48dec79ae016036e4bab9e6c921d779fc13bd4` |

Private candidate/rollback evidence:
`%TEMP%/cg-guideline-links-20261109/`. Fresh hosted-version/file-hash preflight
must match v77 before any exact release. Stop on drift; do not overwrite another
owner's backend work. The three-file production replacement requires CA's exact
approval under AGENTS.md. No SQL, data, schema, provider, secret, permission,
client content, Teams/calendar or Vercel operation is included.

After approval: deploy this exact 40-file packet once, read back all hosted file
hashes/settings, then read Germoparts through the company connector. Require the
exact document/client/run URLs, draft status, same four scripts and no raw file
URL. Test client-scope refusal without content writes. Report live only after
those checks pass. Do not republish or rewrite the four videos to test links.

Germoparts' existing missing OneDrive short-code readiness warning is separate;
it does not prevent staff opening this saved guideline. No mapping was guessed.

## Follow-up LIVE v79: original saved results on guideline retries

Read-only production audit found39 successful ensure/add/update operations whose
generic idempotency ledger stored status only, with no result payload. Reproduced
with the actual dispatcher: a repeated successful add lost its original video ID
and URL; an old success was presented as though an original result was returned.

The existing private `mcp_idempotency_log.result_payload` column, current service
privileges and deployed `mcp_check_idempotency` replay contract were verified
read-only. No schema/RPC/permission change is needed. For only the six guideline
mutation tools, the backend now inserts the original response and both audit
principals together into that existing ledger. A receipt binds actor/tool/key
and the fixed-origin canonical document link. Confirmed retries return the same
saved IDs/links without repeating the mutation. Other lanes retain their existing
atomic/canonical replay paths; no staff/Teams/CG Hours write logic was replaced.

Historical status-only rows are not rewritten or guessed. They return an explicit
verification-required result and the next read action, without rerunning content
changes. A failed receipt save reports that work may already have completed;
the catch path no longer attempts a second receipt insert or loses the recovery
response when audit storage also fails. No raw database error detail is exposed
by the new receipt failure message.

Five new actual-dispatcher regression tests cover lost responses, all six tools,
legacy receipts, changed inputs, forged actor/key/tool/link and failed storage.
All three initial regressions failed before the fix. Broader MCP/content suite:
**382 pass, one unrelated optional PostgreSQL fixture skipped, zero fail**.
Supported full app suite: **4,242 pass / 30 optional skips / zero fail**, 4,272
total. Used loopback fixture environment and the existing Git OpenSSL binary.
The first unrestricted run's17 failures were local harness prerequisites: wrong
fixture origin, missing OpenSSL and Windows WSL Bash, not these backend changes.
The exact library fixture passes6/6 with its canonical loopback origin. Twelve
tests in the unrelated Unix SES-setup CLI-mock file were excluded from the final
supported run; its Windows Git-Bash retry did not complete in the bounded check
and only this agent's exact test-process tree was stopped. No SES/AWS production
setup or pass is claimed. Docker is stopped; optional local SQL fixtures skipped.
Build/emitted app chunks, repository Deno check with validation-only Vite ambient
types, scoped lint and diff pass. This does not make a business mutation and its
receipt a single DB transaction: uncertain/unacknowledged writes still require
reading existing state before any new mutation. No concurrency/atomicity claim.

Exact follow-up packet: v78 baseline40 files, replace only `index.ts` and
`contentGuidelineActions.ts`, preserve the other38 files byte-for-byte. Candidate
LF SHA256: index `ac53518081397be0f1ea8fadd09dddfd43154396732e7c67cc798357430b381f`;
helper `c819f1cf9d8ca7942db4903dbcebf1479ffbc60266c222f25e7f8b2c204160be`.
CA's current instruction authorized this reviewed connector repair and live
release. #968 /2179b10d merged after review and local verification. Fresh v78
preflight matched every hosted file; released the two-file packet once. Final
independent readback: **ACTIVE v79**, all40 files match the candidate, other38
preserved byte-for-byte, verify_jwt=false/import_map=false unchanged. Runtime
bundle SHA256 `f25fd077a5b4f1084e1fde0360fbac1d9b4aef510f1d11a00536a18b6a13e434`.

Legitimate live company connector acceptance used `ensure_content_guideline`
only on the already-verified existing Germoparts document, with one unique
verification key. Returned created=false, the correct existing guideline/run,
draft status, four videos, canonical staff links and original saved-result
receipt. Repeated exactly the same request once: semantically identical result
and receipt, no handler rerun/document/video creation. PostgreSQL JSONB changes
key order, so compare values, not raw serialization order. Independent SELECT
confirms exactly **one** matching audit row with its original result projection.
Final read matches all four pre-test scripts and draft status exactly.

The normal connector's private audit receipt is the only acceptance write; no
SQL mutation/schema/config/secret/permission/provider/client-content/Teams/
timesheet/Vercel changes. Historical39 status-only successes were not rewritten.
No new authenticated phone/browser or client-publication pass is claimed. This
closes the two reproduced connector faults, not every unrelated provider/content
or client-launch gate. Exact Google Control Centre target remains unavailable;
do not guess a write or claim it was updated.
