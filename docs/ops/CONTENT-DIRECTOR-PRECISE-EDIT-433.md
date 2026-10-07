# #433 W2 — real brief and precise saved-video correction

Local implementation only. No Vercel or provider invocation, schema change,
production save, strategy approval or publication.

## Contract

Reuse the canonical `content_guide_ideas` row: `platform` is placement, `format`
is delivery mode, and `requirements` is the staff production brief (including
duration where known). Existing `notes`/objective/hook remain unchanged by manual
script saves. Do not introduce a second brief store or infer a duration from a
missing field. The saved brief, not a blanket 30–75-second spoken-script default,
controls development. Unknown/conflicting details require confirmation.

The existing staff `develop` mode accepts bounded `targetFields` plus exact saved
video IDs. The handler reads only the exact client/guideline rows. A failed read,
unknown requested row, malformed field set or internal-worker targeted request
fails closed. Existing internal-worker full development/persistence remains the
same authority; its idempotency fingerprint is unchanged.

The server attaches `baseUpdatedAt` from the saved row; model-provided revisions
cannot create authority. Parsing removes all unrequested output fields. Staff see
saved/proposed text and explicitly accept or discard. “Propose CTA only” does not
write. Accepting that proposal updates only `cta`, never the hook/script/shots,
title/order, brief, schedule link or evidence receipt.

Manual video saves and proposal acceptance use the existing update helper with
an atomic `id + updated_at` comparison. Preserve the raw PostgreSQL timestamp
(including microseconds), not a rounded JavaScript Date. Missing revision or
concurrent change is a conflict, not permission to retry an overwrite. Local
drafts/proposals remain inspectable on conflict. Unsaved local edits block proposal
acceptance; edits entered during a pending save are not silently discarded.

## Reproduction and acceptance

Before edits, four new executable tests failed against the actual prompt/parser:
forced 30–75 seconds, discarded CTA-only response, missing saved context in targeted
prompt, and invalid-target field acceptance. Tests now cover these plus canonical
helper accept/reload, exact identity, microseconds, duplicate application, concurrent
human update, malformed/missing revision, fill-empty preservation and untouched
hook/script/shots/receipt/brief.

`scripts/director-precise-edit-browser.mjs` mounts the real staff editor and update
helper. Synthetic local storage/model response only, all other network denied.
At 1440/375/390/430 it verifies saved/proposed diff, CTA-only explicit acceptance,
reload, discard-without-write, concurrent CAS denial, preserved proposal, no body
overflow and no captured browser console/page errors. Screenshots remain in local
TEMP as `cg-director-precise-{width}.png`, not production evidence.

Run locally:

```powershell
$env:VITE_SUPABASE_URL='http://127.0.0.1:1'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='local-public-fixture'
node --test tests/contentDirectorPreciseEdits.test.mjs tests/contentDirectorModes.test.mjs tests/directorSavedContext.test.mjs tests/directorKnowledgeEvidence.test.mjs tests/contentGuidelineUsability.test.mjs tests/contentGuidelineScheduleBootstrap.test.mjs
$env:CG_PLAYWRIGHT_MODULE='<existing local Playwright module>'
node scripts/director-precise-edit-browser.mjs
npm run build
npm exec --yes --package=deno@2.5.1 -- deno check --no-lock supabase/functions/suggest-content-videos/index.ts
git diff --check
```

No production role/AI semantic acceptance claim: actual protected Edge rollout,
authenticated saved-row acceptance and human review of generated creative quality
remain separate. Old deployed responses without a saved revision cannot be accepted
by the new UI. Coordinate the eventual frontend/Edge release; do not bypass the
version guard. Hosting #679 remains OFF/local-first.

Final local verification: 50 focused PASS; full supported suite **3,678 total /
3,661 PASS /17 intentional skips /0 failures**, including disposable PostgreSQL
fixtures (Windows Bash-only SES fixture excluded, not passed). Fresh local
TypeScript/Vite build, scoped TS and explicit Node/browser lint, diff and full
Director Deno 2.5.1 `--no-lock` import closure PASS. Existing >500k bundle warning
unchanged; emitted app bundle contains the actual CTA-only control. All four
browser widths PASS; 375px screenshot visually inspected. No cloud build/deploy.
