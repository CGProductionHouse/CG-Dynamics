# PICASSO shared design standard — source qualification

25 November 2026 · #948 / existing draft #956 · `codex/graphic-designer-948`.
Reconciled `origin/main` b524a9f9 into the existing isolated worktree. Both sides'
ops notes and cache exclusions retained; shared/root dirty checkout untouched.

## Implemented

- One [official system](PICASSO-DESIGN-SYSTEM.md), linked from AGENTS, CLAUDE,
  master AI workflow, graphic-designer skill and company ChatGPT content skill.
- One pure TypeScript contract shared by UI, connector and local CLI, with a
  parity-tested model-neutral JSON checklist: 27 named, evidence-typed checks.
- Exact-client pack schema/validator, per-brand scopes, reviewed/draft status,
  review dates, logo hashes/variants/clear-space, real fonts/weights/licence refs,
  colour roles, visual language, photo/motion direction, claims and feedback.
- Proposed nullable `design_pack` on existing `client_brand_profiles`; no separate
  client/brand database, table, grants, RLS policy, privileged RPC or public access.
- Content operations expandable PICASSO panel: shared standard, format selector,
  explicit client/scope readiness, familiar brand/rules panel and manager-only
  validated metadata import/save. Conflict-fenced update, no automatic upsert.
- Existing `get_client_context` gains an additive read-only `picasso` packet for
  `image_edit`, `script`, `content_idea`, `general`, after existing guide readiness.
  Exact client + active house/client rules only, no parent/sibling fallback.
  Current guide/recorded updates fingerprint invalidates earlier reviews on change;
  unavailable recorded feedback holds the packet. Caption/footer retrieval stays
  its separate task-scoped authority. No new tool/catalog entry or model call.
- Local preflight hashes real artifact/caption bytes, binds pack/rules/brief/scope,
  rejects stale packets/reviews and missing/failed checks, and writes new receipts
  exclusively. Receipts show every result/reason/evidence. It does not render,
  authenticate external approvals, judge taste, send or publish.
- Conditional motion/playback/export, audio, print and final human-approval checks.
  No forced JPEG, mandatory sound, background removal or uniform visual style.

## Actual qualification

Observed local tools: Node24.16.0, TypeScript6.0.3, Vite7.3.6,
Deno2.9.6 and existing supabase-js2.106.2. No version upgrades or installations.

| Check | Result and scope |
| --- | --- |
| Focused + existing regressions | **73 tests pass, 0 failures/skips**: `picassoDesignSystem`, `brandRules`, `videoPipeline`, `mcpClientWorkspace`, `contentOps` |
| Local CLI | Actual temporary file bytes, initial hold skeleton, complete declared review, changed bytes, >24h packet and exclusive-write refusal exercised |
| Brand/access SQL | Actual cached `postgres:17-alpine`, disposable container, `--network=none`, no ports/config/secrets: manager write, staff read/no-write, client no-read/no-write, anon denied, foreign client/missing-field constraint rejection; existing RLS preserved |
| Actual React/browser | Isolated headless installed Chrome; **1440px and 390px**, exact scope, 27 items, motion applicability, import without auto-save, explicit manager save, conflict hold, staff no import, missing-schema hold, zero page errors/overflow/external requests |
| Type/build | `npm run build` (`tsc -b && vite build`) passes, app-bearing production bundle emitted locally |
| New helper types | Isolated TypeScript check passes; TS6 file-mode needs `--ignoreConfig` |
| Actual MCP closure | Cached Deno check passes with existing npm type mappings, browser `ImportMeta.env` declaration and `--sloppy-imports` for existing extensionless frontend imports; no dependency/production source workaround |
| Lint/diff | Scoped ESLint and changes relative to main checked; no new production dependencies |

The 73 count includes 16 PICASSO tests with multiple negative-case assertions.
Synthetic fixture declarations are **not** client art, current approved packs or
creative-quality approval. Browser proof exercises the real component with local
synthetic dependencies; it is not signed-in production/browser/phone acceptance.
SQL proof uses actual policies/triggers with fixture identities, not live accounts.
No paid service, new install, public hosting, client upload or incremental cost (R0).

Initial failures were retained and corrected: an inaccessible select name was
fixed with explicit accessible labels; older ContentOps tests needed process-only
dummy public Supabase env values; default Deno mode needed the existing frontend
ambient/type-import qualification. Original/final logs remain private under ignored
`artifacts/picasso-system-20261125/`, including actual rendered panel screenshots.
Do not replace production transport/types or publish dummy configuration to hide
those test-environment requirements. Existing Browserslist age and chunk-size
warnings remain; no unrelated dependency update was performed.

Reproduce the runtime checks with existing local tooling, no installs:

```powershell
# Process-only synthetic public fixture values for older pure ContentOps tests
$env:VITE_SUPABASE_URL='http://127.0.0.1:1'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='local-public-fixture'
node --test --test-concurrency=1 tests/picassoDesignSystem.test.mjs tests/brandRules.test.mjs tests/videoPipeline.test.mjs tests/mcpClientWorkspace.test.mjs tests/contentOps.test.mjs
node scripts/picasso-brand-pack-db-acceptance.mjs
$env:CG_PLAYWRIGHT_MODULE='C:/Projects/CG-Dynamics/node_modules/playwright/index.mjs'
node scripts/picasso-design-system-browser.mjs
npm run build
```

For Deno, use a local temporary config with `compilerOptions.types` pointing to
`interface ImportMeta { readonly env: Record<string,string|undefined> }` and mappings
of `https://esm.sh/@supabase/supabase-js@2` / bare `@supabase/supabase-js` to cached
`npm:@supabase/supabase-js@2.106.2`, plus remote `@2.49.8` to cached npm `@2.49.8`.
Run `npx --no-install deno check --cached-only --no-lock --sloppy-imports --config
<temporary-config> supabase/functions/cg-dynamics-mcp/index.ts`. This mirrors the
existing bounded qualification approach; it is not a deployment configuration.

## Protected lanes and rollout gates

No production migration, client data/brand seed, Edge/frontend deployment,
publishing or messaging occurred. Automatic Git deployment remains false (#679).
Base brand tables are recorded applied under 20261111064719: **do not replay them**.
Nolan #862/#910, Picasso photography #879, schedule/calendar/portal authorities and
all existing protected client Canva work are untouched by this implementation.

Open #1005 and #995 own other areas of the large MCP entry. This change is limited
to one import and one additive context member; no catalog/auth/guideline/retirement
rewrite. Reconcile those PRs before any merge/release. Shared ops record updated;
the canonical Google Control Centre target remains unidentified in existing ops
authority, so no guessed sheet or replacement tracker was written.

Next: source review/merge in the existing PR; separately authorised exact-column
and coordinated connector/UI rollout with actual multi-role acceptance; populate
one real client/scope from verified assets, resolving existing conflicts; run one
normal company ChatGPT request through current pack, actual artifact review and
receipt. **Everyday ChatGPT invocation and live enforcement remain unverified.**
The CLI is a prerequisite for agents, not an already-deployed interceptor for every
human upload/WhatsApp message. Client creative approval remains a human decision.
