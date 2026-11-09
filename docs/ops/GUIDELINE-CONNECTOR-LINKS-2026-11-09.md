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

## Exact release packet — NOT DEPLOYED

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
