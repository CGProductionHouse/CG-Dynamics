# #433 exact-content human review authority

Local implementation only. No migration applied, card reviewed/activated, model
call, production save, deployment or Vercel operation occurred in this lane.

## Reproduction and correction

The existing activation gate counted any historical approved review, including
activation/routing audit entries. Both review UIs lacked a snapshot revision.
Changing material content could therefore retain old approval. Three executable
retrieval regressions failed against the old modules before editing.

The additive `20261007102349_skill_card_review_revision_binding.sql` introduces
DB-owned SHA-256 material fingerprints on the existing card and review tables.
The fingerprint includes content, claim limits, source evidence, routing, expiry
and exact-client scope. Status, owner label, review date and audit timestamps do
not masquerade as new content. The DB computes it; callers cannot certify a
revision by assigning a hash. Material edits invalidate approval and return
active/reviewed cards to needs_review. Source-evidence edits also invalidate
linked approvals. Historical rows remain untouched/null, and old review rows
remain audit history; there is no bulk backfill/reapproval or second store.

Both existing review screens use the same atomic `skill_card_record_review` RPC
with the material hash from the exact displayed DB snapshot. It locks source
before card, rejects stale/source-changed snapshots before any edit/receipt,
applies only allowed wording/list edits, and records the resulting revision with
the authenticated admin's canonical profile. Review receipts are immutable;
monotonic per-card review timestamps resolve same-transaction ordering. The
latest human content decision—not a routing/activation audit—authorizes the
binding. Negative decisions remove approval. **Review never activates**, even
when reviewing a legacy row whose historical status is active.

The legacy detail read RPC projects the same existing row plus its computed
snapshot hash; it does not persist/backfill. Queue/readiness and frontend/Edge
retrieval require current exact reviewed content. Unbound historical active rows
are held for human review, not counted as current production-ready knowledge.
All production card read projections carry the binding, including Director,
Assistant/workflow, task context and existing monthly strategy consumers.
Existing specialist routing, source, expiry and exact-client restrictions remain.

The Edge closure also exposed inherited type-check problems: a generic
`ReturnType<typeof createClient>` inferred `never` for client contacts, and a
type-only reporting-platform import dragged browser DB types into the shared
strategy closure. Use the existing `SupabaseClient` contract and a pure canonical
platform type re-export; no runtime contact/strategy/report behavior is changed.

## Local proof

- New actual-module gates and both canonical/legacy review adapters; stale calls
  make no fallback insert/update/retry. Audit receipts cannot supply readiness.
- Disposable PostgreSQL, no network/ports/production credentials: actual
  migration, canonical RPCs, trigger and RLS execute; legacy/null history remains;
  edit+approval, material/source/routing/client-scope invalidation, negative
  decisions, forged/direct approvals, inactive admin/staff/client/service denial.
- Real two-session concurrent wording edits: first succeeds; stale second denies
  without overwriting the first or producing an accepted review receipt.
- Actual modern + legacy React screens at 1440/375/390/430 via
  `node scripts/skill-card-review-browser.mjs`: correct snapshot parameter,
  stale conflict/no write, note retained, explicit approval/no activation,
  no horizontal overflow or console/page error. External network is blocked;
  this is synthetic localhost acceptance, **not authenticated production proof**.
- Full supported suite: 3,699 total /3,682 PASS /17 intentional skips /0 fail,
  disposable SQL enabled; Windows Bash-only SES fixture explicitly excluded.
  Local TypeScript/Vite build and scoped lint/diff verified; five full Edge entry
  import closures checked with Deno 2.5.1, no lock/dependency change.

## Protected release packet — NOT executed

1. Verify exact production table/function types, existing grants/RLS, migration
   ledger and source fields against this migration. A mismatch stops rollout.
2. Separately authorize/apply this migration only. It replaces the canonical
   review RPC signature and queue result shape; there is no old four-argument
   approval overload. Old UI calls without a snapshot fail closed.
3. Verify null historical binding, unchanged historical receipts, admin-only
   snapshot/review, immutable human receipt, stale-view rejection and preserved
   existing source/client gate. Do not bulk approve existing cards.
4. Coordinately release the reviewed frontend and affected Edge consumers.
   New code querying absent binding columns must not be released first. No cron,
   provider, secret, OAuth, package/strategy or reporting-data change is needed.
5. Perform legitimate authenticated role/exact-client acceptance on that exact
   deployed code/schema. Review individual cards explicitly. Production semantic
   model/human benchmark execution remains separately authorized/unexecuted.

Stop on schema/RPC/grant mismatch, missing binding, stale review accepted, review
activating a card, forged actor or crossed client. Do not remove the gate or
backfill approvals to restore apparent readiness. Keep affected knowledge/model
use unavailable while repair is reviewed. Rollback must preserve the fail-closed
gate and history; reverting to historical approval authority is not safe.
