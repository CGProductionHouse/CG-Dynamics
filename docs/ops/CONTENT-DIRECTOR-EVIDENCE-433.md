# #433 W1: reviewed guidance in a real editable draft

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

The #679 hosting policy supersedes the historical paused-project/fresh-Vercel gate.
Keep `vercel.json` Git deployments OFF. Local code verification and routine GitHub
review/merge do not authorize cloud builds or establish live production acceptance.
No Vercel action, configuration unpause, Edge deployment or credential copying is
part of this PR. The changed Edge runtime remains undeployed; a local Deno check
and legitimate authenticated save/reload acceptance are not claimed. Keep those
gaps explicit before any separately approved runtime release.
