# Client Plan / published guidelines: local-only acceptance

Owning lane: #668, existing PR #674. No deployment or production-write mode.

## Reproduction and correction

Three executable reader regressions failed against the old direct cast: malformed
responses became successful empty state, private extra fields were retained, and
wrong-month rows were accepted. Existing RPC authorization is still the exact-client
security boundary; transport projection is defence in depth, not substitute RLS.
The reader preserves canonical script nulls and full ordered text. It rejects mixed
valid/invalid envelopes instead of silently displaying partial corrupted guidance.

The actual Plan page now keys only its read panel by client/month/tab. An in-flight
new scope cannot render the preceding scope's scripts under a new working month.
All three tab controls fit at 375px rather than clipping the third tab.
Null or blank scripts render an explicit unavailable statement, not a misleading
“Complete script” heading over empty space; no replacement script is invented.

## Executable browser check

Use the existing approved Playwright installation (no dependency install):

```powershell
$env:CG_PLAYWRIGHT_MODULE='C:/Users/chris/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
node scripts/client-plan-readonly-browser.mjs
```

This renders the actual components with synthetic authenticated-role/context fixtures
and localhost-only mocked reads. It does not access a real session, Supabase project,
provider or client. Unexpected network/RPC calls fail assertions. No write fixture
exists. The test covers desktop 1440px and mobile 375/390/430px, full scripts,
month/client transitions while reads are deliberately held, unavailable vs empty,
tab bounds/text, body overflow and page runtime exceptions. PNG screenshots go to
the OS temporary directory as `cg-plan-{width}.png`.
It also renders the actual desktop month grid/mobile agenda with synthetic planned
content and a published-guideline event. Clicking that event preserves exact preview
client, working month and opaque guideline key; the corresponding full script renders.
Calendar PNGs are `cg-plan-calendar-{width}.png`. This does not establish a portal
asset link for scheduled posts: that separate canonical linkage remains outstanding.

## Verification boundaries

123 focused tests pass across published guidelines, full-preview scope, Plan,
Content Guideline usability/Creative Intelligence/workflow and calendar release.
Full supported suite: 3,634 tests, 3,617 pass, 17 intentional skips, zero failures.
The Bash-only SES shell test is excluded on this Windows environment, not called
passed. Existing Git OpenSSL is placed on PATH for executable SES trust fixtures.
TypeScript/Vite build, scoped lint and diff check pass locally.

These results are NOT authenticated production acceptance, substantive strategy
approval, research knowledge activation, or proof that scheduled posts have exact
portal assets. Those require their canonical contracts/evidence. Keep Vercel Git
deployment disabled, do not deploy or apply migrations, and preserve all protected
gates. Nothing here writes guidelines, schedules, strategies, packages or reports.
