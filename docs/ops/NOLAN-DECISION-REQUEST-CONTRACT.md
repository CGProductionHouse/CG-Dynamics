# Explicit decision requests: implementation contract (draft, not activated)

16 November 2026. Existing PR #990. This is preparation for a distinct Needs You
queue, not a rename of Assigned to you and not a live or deployed decision store.

## Implemented now

`src/lib/nolanDecisionRequests.ts` defines explicit source namespace, source ID,
expected revision, named recipient, question and idempotency key. The pure draft
producer strips caller-supplied actor/role/lifecycle fields. Receipt selection
requires a complete authorized snapshot, exact viewer and current source revision.
Invalid receipts, duplicate request IDs or missing current revisions are unavailable,
not a successful zero-work answer. Changed revisions do not show old questions as
current. No source task status is rewritten. No browser cache is authority.

This module is deliberately NOT imported by NolanOverview or a write screen.
Client-side validation and TypeScript types cannot establish permission. There is
no persistence RPC/table yet. No pending requests have been invented or created.

## Architecture evidence and rejected shortcuts

The daily-assistant capture producer records decision entries already completed.
Its private questions belong to the capture owner, not an explicitly selected
decision recipient. Schedule change requests have a requester and historical
reviewer; their pending manager pool is not a personal request. Task assignment,
administrator role, imported names and free-form notes are not substitutes.

## Next server producer slice

Use the existing authenticated Supabase/RPC pattern, but first settle the canonical
decision-request relation and its source-specific adapters in a reviewed migration.
Do not repurpose private assistant captures or duplicate task lifecycle records.

A server create RPC must:
1. Derive actor exclusively from auth.uid(), check active profile and exact
   authorized source access. Each namespace must have a fixed, reviewed relation
   and revision strategy; do not resolve arbitrary table names or URLs.
2. Require deliberate explicit recipient selection. Check active recipient and
   source visibility plus source-specific eligibility on the server. Manager role
   alone does not prove the recipient or actor is authorized to decide a matter.
3. Lock/re-read the source and compare expected revision atomically; stale UI
   drafts must fail without creating a request. A timestamp revision may be used
   only after validating that every relevant source edit reliably changes it.
4. Scope idempotency to authenticated actor. Repeating the same key/payload returns
   the original receipt; key/payload mismatch rejects. Do not invent duplicate
   pending requests on retry. Unique request IDs remain separate from source IDs:
   one source can legitimately carry several different questions.
5. Store server actor/time, explicit recipient, question, revision and audit trail.
   A request is a question only, not approval, publication or permission to apply.
6. Enforce recipient-scoped reads and narrowly authorized actor/source visibility
   with RLS. No browser-supplied role flags, service key or broad shared read.
7. Resolve/withdraw via separate checked RPCs with optimistic request revision.
   Only eligible recipient may resolve; requester withdrawal is distinct. Source
   changes invalidate pending revision eligibility without changing project state.
   Resolving a request must not automatically apply production changes.
8. Return paginated receipt AND current-source revision evidence under the same
   authorized contract. Any late-page/permission error fails the entire personal
   queue; never silently present partial reads as complete.

## Required acceptance before UI activation

Synthetic proposal/selection tests are not database or role acceptance. Require:
- Anonymous, inactive, staff, manager, administrator and unrelated-user read/write
  isolation, including actors who can see a source but not decide for recipient.
- Arbitrary source/recipient substitution, disabled profiles, revoked visibility.
- Concurrent source edits, response versus withdrawal races, current revision CAS.
- Idempotent retry, conflicting key reuse, duplicate/late-page failure.
- Complete-empty versus unavailable; account switches and delayed response races.
- Same-origin authenticated UI with explicit recipient/question preview and
  canonical source link; no credential forwarding or bypass.
- No production migrations or deployment under this draft preparation.

Current blocker is missing server-enforced canonical recipient/source authority
contract and disposable DB acceptance capability. Parent/owner may authorize
further draft migration implementation, but live rollout remains separately gated.
