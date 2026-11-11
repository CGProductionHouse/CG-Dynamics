# Register already-edited films in the existing Video Pipeline

11 November 2026. Continuation of #900. MSI's sixteen saved/read-back client
history updates and company task `7f413d31-17cd-4761-b2e9-a031c1343444` are the
backfill evidence. This repair is **not deployed**; missing live rows have not
been inserted by this branch.

## Existing workflow, no fabricated shoot

Active managers/admins see **Register existing film** on Content → Video Pipeline.
They select exact client, intended release month, established stable film
identity, actual filename/hash/revision, responsible editor, private media link,
evidence reference and dated authority. Evidence maps to editing, internal
review, owner approved-ready for client, client delivery or client approval.
There is no Posted option. The operator must inspect the actual evidence; a
dropdown selection does not verify WhatsApp/cloud bytes. Rejected and withdrawn
studies are not new current films.

Registration uses `content_guide_ideas`, authenticated RLS and the existing
primary key. No fake run/guideline, schedule slot, posting date or publication;
no new table, RPC, dependency, grant or privileged key. The manager-only control
does not replace database authorization or expand existing staff permissions.

Complete paginated client history, including archived records, is checked for
stable identity, same-month/title or exact hash. Matches are opened/reconciled,
never upserted. A deterministic client+identity UUID prevents simultaneous
same-identity inserts through the existing PK. Timeout/duplicate failures read
the winning row, never blindly retry a write. Separate readback verifies the
identity, notes, lifecycle, editor and null run/schedule links. An uncertain
readback is not reported as success.

Semantic duplicates entered concurrently with different identities, titles AND
hashes cannot be universally prevented without a reviewed server constraint.
Explicit source/history review remains mandatory. Archived matches are retained,
not restored/promoted automatically.

Ordinary edits default to **Keep current** and omit editor fields entirely.
Clear/reassign are explicit, including inactive/name-only editors. Name-only
editors can be filtered/searched without inventing a staff profile. Saves and
status transitions use the saved `updated_at`; stale records fail rather than
overwrite concurrent work. Pipeline reads now paginate fully.
Unrelated edits preserve the actual canonical film name, including an older
configured client code; a generic name is not silently regenerated when only
notes, links or the editor change.

## Verification and release

Tests cover no invented linkage, state distinctions, exact-client separation,
archived/legacy matches, revisions, partial scans, concurrency/timeout recovery,
failed readback, invalid inputs and editor preservation/filtering. In-memory
repositories only. Existing workflow/pipeline regressions, scoped lint and local
TypeScript/Vite build are required before push.

Local browser fixture: save/readback, registration reset and duplicate R17
blocking observed. Desktop1100 and phone390 had no horizontal overflow. Synthetic
practice company only, no production session/DB/media. This is not authenticated
production/RLS acceptance. Existing SQL source permits null-guideline records;
no SQL or migration was executed.

#981 owns exact queue handoffs/deep links; #984 owns brand rules. Those branches
were not edited. VideoPipelineTab overlap requires additive integration review.
Editorial library remains PR910. No new tracker, task board or calendar system.

Hosting #679 still applies: `git.deploymentEnabled=false` stays off. A reviewed,
CA-approved budgeted release must precede live use. Then register each missing
film from the saved client evidence, preserve existing Watch December/Action
Sports/PC/staff rows, and verify actual board readback. Older unknown approvals
stay unknown. Keep the ongoing reconciliation task in progress until then.
