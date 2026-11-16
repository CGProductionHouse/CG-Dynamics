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

The pure generic proposal module is not a permission boundary. A separate narrow native-task RPC adapter and gated Needs You component are now implemented in this draft (see next-slice receipt below). No migration has been executed and no pending requests have been invented or created.

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


## Next-slice implementation receipt: explicit native-task workflow

Draft implementation now includes SQL at
docs/ops/sql/nolan_explicit_decision_requests.draft.sql (deliberately outside
automatic migration discovery), a native-task adapter and
NolanNeedsYou UI. The distinct lane does not replace Assigned to you.

Scope is deliberately limited to native command_centre_tasks. Existing
phase-security-admin-isolation.sql grants manager/admin source visibility; schema.sql
reserves profile updates to administrators. No external, Planner, video or monthly
deliverable record is guessed into this producer. Active administrators explicitly
choose an active manager/admin recipient; that makes a question addressed to the
person, not authority for them to approve publishing, money or production changes.

Persistence uses RLS plus no direct authenticated/anonymous table grants. Fixed
pg_catalog search_path SECURITY DEFINER RPCs derive auth.uid(), check active roles,
lock profiles and source rows on mutation, compare full-row JSON revision hashes,
and serialize actor-scoped idempotency keys. Key replay with changed material
payload rejects. Same valid retry returns the original receipt. Questions retain
server actor/time; closure records responder/time, response and incremented CAS
version. Repeated or concurrent closure must fail the stale-version/state check;
integer overflow rolls back rather than reusing a revision. Responses never mutate
the source task. Only requester may withdraw; only named recipient may answer a
still-current source question.

Reads return only own pending incoming/outgoing questions. More than 500 produces
an explicit coverage error rather than a truncated complete result. Source changes
and inactive recipients are disclosed; they cannot be resolved as current.
Closed requests remain persisted but this first UI shows pending only, not a full
history browser. A failed queue read is unavailable, not empty. Source deletion
is restricted while a decision record references it; retention behavior requires
review before rollout.

The UI gate NOLAN_DECISIONS_ACCEPTED is hardcoded false. Its disabled state is
rollout control, NOT backend security. Account/month-key remounting preserves
scope isolation. Admin draft form reads exact source/revision and eligible profiles,
requires explicit recipient/question and freezes edits after a create attempt so
an uncertain response is retried using the same idempotency key. Source links and
response actions are distinct; no task action is implicitly applied.

Validation: five source/synthetic tests passed using in-memory source, including
receipt validation and role/revision/idempotency code contracts. These are NOT
proof of SQL syntax, authorization or concurrency behavior. An opt-in disposable
PostgreSQL test is supplied with minimal synthetic canonical dependency tables;
it uses --pull=never, --network none, tmpfs, no host ports, no production credentials
and cleans only its exact generated container. It has NOT been executed because
no permitted working disposable DB is available. The real-schema full role matrix,
concurrent transactions and authenticated browser acceptance remain mandatory.
Do not activate the UI gate or apply migration until those checks are verified.

Independent review correction: draft SQL is stored outside supabase/migrations so ordinary deployment tooling cannot apply it merely because it exists in the PR. Promoting it to an executable migration requires reviewed acceptance and separate release authorization. Native command-centre links use the existing daily-tasks workspace, with the exact UUID shown separately; the Planner board-ID route is not reused or claimed as an exact task deep link.

Further source-review corrections: every RPC fixes timezone UTC for consistent JSON timestamp revision serialization; known SQL rejection codes release the draft for correction, while network/timeout/missing receipt errors retain the retry key and locked fields. These behaviors still require rendered and real-DB acceptance.
