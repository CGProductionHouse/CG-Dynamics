# #433 W1: reviewed guidance in a real editable draft

## 7 October local finish continuation (supersedes local-check gaps below)

Found/fixed actual readback gap: `ideaToVideoInput` preserved angle, audience,
confirmation questions and trusted receipts in existing `content_guide_ideas.notes`,
but the document editor hid that saved context after reload. Compact staff-only
`SavedDirectorContext` now displays the existing objective/hook/notes as escaped
text. It explicitly calls this saved draft context, not freshly verified research
or a new recommendation. Empty context stays absent. No arbitrary source links,
client projection, new store or automatic field update. Existing explicit script
saves leave notes/objective/hook untouched.

Actual-editor local browser fixture reproduces a second defect: with an unkeyed
editor, previous-client proposed ideas survive a guideline switch. Content Workflow
now uses the same exact-guideline key as Full Content Guide. Counterfactual
`CG_REPRO_UNKEYED=1` fixture FAILS the isolation assertion; default fixture PASS
at 1440/375/390/430px, including reload, proposed-idea departure, escaped script/URL
notes, unchanged human script and no horizontal overflow/captured page errors.
Synthetic local-only auth/context/model response, not production role acceptance.
All non-fixture network is denied; no write buttons/provider calls are invoked.
Screenshots: local TEMP `cg-director-context-{width}.png` and
`cg-director-saved-{width}.png`; 375px context screenshot visually inspected.

Real Deno 2.5.1 import-closure check exposed 20 type errors hidden from Vite:
generic `ReturnType<typeof createClient>` inferred an unusable unknown schema;
the ungenerated joined-source query lacked its actual row type; AI diagnostics
omitted the existing `canonical` secret-source enum. Corrected with existing SDK
`SupabaseClient`, explicit DirectorCard query return shape and canonical shared
`ProviderSecretSource` type. No auth/query/filter/secret resolution/provider routing
behavior changed. `deno check --no-lock supabase/functions/suggest-content-videos/index.ts`
now PASS. Tool installed in disposable npm tool cache only; no production dependency
or lockfile added. Frontend build, scoped lint and diff remain required on head.
135 focused content/Director/knowledge/governance regressions PASS.
Final supported suite: 3,632 total /3,615 PASS /17 intentional skips /0 failures;
Windows Bash-only SES setup test explicitly excluded, not passed. Final local
TypeScript/Vite, TypeScript and Node/browser-script scoped lint, diff check and
real Deno import-closure check PASS. Existing >500k bundle warning unchanged.

Historical review-version binding remains the separately documented canonical
authority gap, not repaired by displaying a receipt. Actual protected Edge rollout,
authorized saved-data round-trip and semantic concept acceptance remain pending.
No Vercel, production mutation, model invocation, knowledge activation or publication.

## Bounded change

Content Director now uses the existing creative-director specialist contract and
retrieval plan, not the first 30 active cards or a second routing system. Server
selection requires exact shared/client scope, appropriate layer, relevant specialist,
known reviewed industry for industry cards, current linked-source trust, and an
unexpired approval date evaluated in Africa/Johannesburg. Null expiry retains the
existing policy; malformed dates and ambiguous scope fail closed. Source/card read
failure returns unavailable rather than substituting partial or generic retrieval.

Only the selected card IDs can resolve model `cg_knowledge` references. Model
approval flags, invented IDs and arbitrary URLs cannot create provenance. The
existing current-session external URI allowlist remains separate. Stored principles
are guidance, not fresh research, client facts, platform guarantees or forecasts.

Card ID/title, linked source ID/reference, evidence label, confidence, safe claim,
prohibited overclaim and observed card revision survive the existing manual and
worker draft-notes boundaries. Staff title, hook, creative angle and ordering are
preserved. The worker's existing RPC already stores angle in notes: its persistence
payload appends the receipt without changing the returned creative angle or SQL.
The staff evidence display is escaped text, never a model-supplied hyperlink.

No new store, schema, source/card approval, production invocation, deploy or strategy
publication. Existing user-token staff access and separately authenticated worker
contracts are unchanged. Local structural auth checks are not live auth acceptance.

## Known review-version gap: separate correction proposal

Repository effective activation authority is
`20260803090000_skill_card_review_workflow.sql`. It requires a linked acceptable
source, any historical approved review and last-reviewed date; it does not bind the
approval to a content hash/revision. Executable characterization demonstrates that
a material principle edit can still be selected while its status remains active.
`updated_at` in a receipt is an observed revision, NOT proof this revision was reviewed.

Separately scoped proposal: canonical material-card edits must invalidate active
approval until a human reviews that exact revision; activation/retrieval must bind
to the approved revision. Inspect live RPCs, review history and compatibility before
proposing the smallest additive migration. Preserve audit history; no blanket
backfill or automatic reapproval. This W1 PR does not apply that correction or
claim current production revision-bound approval. Current source downgrades are
checked at read time independently of the historical activation.

## Verification and acceptance boundaries

Six new executed regressions use the real selector, prompt/parser, manual
`ideaToVideoInput`, worker payload and shared UI receipt. They cover scoped/alias/
industry relevance, deterministic ordering, denied/malformed/expired cards, current
source downgrades, local-date parity, forged provenance, save/reload note carriers,
preserved human choices and the review-version characterization above.

Full repository tests, TypeScript/Vite, scoped lint and diff check are required on
the exact head. The Windows Bash-only SES setup fixture is explicitly excluded;
intentional skips are reported. Node Edge static/runtime regressions are not a
local Deno type check. No production DB round-trip, model-output entailment or
authenticated changed-preview acceptance is asserted from these tests.

Original branch verification: 3,622 total / 3,605 pass / 17 skip / zero failures.
4 October reconciliation includes guarded main `116c280f80370753d8d45eb4119e0f109d3beafb`.
TypeScript/Vite build and scoped ESLint pass locally; current-head suite receipts
are recorded in PR #677. No paid/cloud build is part of this verification.
Reconciled local run: 85 focused PASS; 3,628 total / 3,611 PASS / 17 intentional
skips / zero failures (Windows Bash-only SES fixture excluded). Diff check PASS.

After protected runtime rollout, acceptance must use a disposable authorized
guideline: one eligible/one denied source, human-selected hook/order, reload and
trace receipt; then assess whether the concept actually helps the client's goal.
Reject hallucinated client facts, unsupported uplift, internal note echo and a
stale/newer human-version overwrite. Do not publish or overwrite existing content.

W2 real placement/duration and targeted edits, W3 human task-level benchmarks,
review-version binding and substantive monthly-strategy synthesis remain distinct
work. Eligible citations do not establish semantic entailment or premium strategy.

## Deployment gate

7 October expanded entry-point verification: checking the full Assistant entry
revealed 94 inherited type errors beyond the previously checked router/helper
closure. Correct Supabase client typing resolves the erased generic schema;
optional legacy context/action argument typing and defensive action comparisons
now compile without changing emitted JavaScript. An executable transpilation
parity regression covers that boundary. Deno 2.5.1 checks both Assistant and
Director suggestion entries locally with `--no-lock`; no runtime deployment,
credential/config access or provider invocation is involved. This does not certify
historical knowledge review-version binding or semantic strategy quality.

Expanded-entry continuation: 514 focused PASS; full supported suite 3,633 total /
3,616 PASS /17 intentional skips /zero failures (Windows Bash-only SES fixture
excluded). Local TypeScript/Vite build, scoped entry lint and diff check PASS.

The #679 hosting policy supersedes the historical paused-project/fresh-Vercel gate.
Keep `vercel.json` Git deployments OFF. Local code verification and routine GitHub
review/merge do not authorize cloud builds or establish live production acceptance.
No Vercel action, configuration unpause, Edge deployment or credential copying is
part of this PR. The changed Edge runtime remains undeployed; a local Deno check
and legitimate authenticated save/reload acceptance are not claimed. Keep those
gaps explicit before any separately approved runtime release.
