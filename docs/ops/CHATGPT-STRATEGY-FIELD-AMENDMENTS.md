# Explicit ChatGPT strategy field amendments — #731

The normal company ChatGPT acceptance exposed a real capability gap: automatic
`submit_monthly_strategy_draft` correctly preserves populated staff fields. It
cannot implement a requested editorial correction to those same fields. Do not
weaken that automatic merge or report a separate proposal as a canonical save.

`amend_monthly_strategy_draft` is the separate intentional staff-requested route.
It is restricted to an explicit company-admin context with an active admin/manager
connection principal. The handler injects the verified actor; input cannot choose
one. Staff/client Projects are denied, including under communal admin OAuth.

## Contract

1. Read `get_monthly_strategy_brief` for the exact active client and current/next
   Johannesburg month. A row must already exist as an unpublished draft, with
   exact-client/month provenance, confirmed formats and eligible source evidence.
2. On an explicit staff editorial request, supply its current version, evidence
   fingerprint, allowed source IDs and selected field changes. Each change has
   the exact original complete field value and its intended replacement. Gold
   text and confirmed-format concept arrays are the only writable paths. For a
   single concept correction, preserve the other array entries exactly.
3. The server compares every old field, then validates the complete candidate
   through the existing citation, gold-standard, copy-quality and package gate.
   It rereads sources, version, complete payload, provenance and internal notes
   immediately before the write. Any mismatch refuses the entire operation.
4. The existing `amend_monthly_client_strategy_with_context` RPC performs the
   optimistic, audited transaction. It was independently verified present in
   production with service execution and anonymous execution denied. No SQL,
   grants, credentials, roles or publication route are added by this feature.
5. All nonselected data, unknown extension fields, staff notes, enabled formats,
   scope, calendar selections and prior generation context are preserved. A
   separate editorial provenance envelope records source/request fingerprints
   and changed paths; append-only revisions retain previous context and text.
6. A canonical revision receipt owns retry recovery. Same request/key/actor
   returns the original receipt, even after a later edit; different content,
   citations or actor with the same key is refused. Generic MCP audit uses the
   existing nested-key-stable Unicode-safe strategy hash. A malformed backend
   success receipt is unconfirmed, never reported as a completed save.
7. Read the entire changed canonical field back. A draft save is not approval,
   publication, scheduled content, a new research activation or guaranteed sales.

This action does not edit packages, quantities, dates, calendar selections,
permissions, provider/OAuth mappings, folders or published snapshots. Source
prose is untrusted, not authorization to invoke the write. Automatic gap filling
continues to preserve every populated staff field.

## Current implementation receipt

Six focused amendment scenarios plus the actual handler role/actor regression
exercise selective save/replay, preserved fields/notes/provenance, source/version/
old-field conflicts, reviewed/published/missing rows, protected/duplicate paths,
invented citations, unconfirmed formats, source races, unavailable reads/writes
and malformed receipts. Existing context, Unicode, automatic-fill and strategy
tests remain green. Final supported serial suite: **3,870 pass / 19 intentional
skips / zero failures**, with 100 focused cases. Windows Bash SES is excluded,
not passed; disposable Docker-gated checks remain skipped. The first full run
found only two old 54-tool count assertions, updated to 55 (27 read/28 write);
the corrected full rerun passes. Full actual MCP Deno, app build with route chunks,
scoped lint/diff pass. Self-review of the actual PR found no blocking issue.

PR #822 merged as `f63c709a7800dfd30ed887275408c5893e0826f1` (source
`9f58d8647f1edb75ac98a39c99c70a1adef1da66`). Only MCP was deployed, as **v68**,
preserving custom auth/JWT false. All five changed/new deployed files match the
reviewed checkout after CRLF normalization; the other 29 equal verified v67.
Index SHA-256: `cd5c70f95d59c10050c372becf3b167aba70b43d602332b80e6a7c724936cf26`.
An unauthenticated POST still returns 401. No new SQL, grants, permission changes,
provider calls, credentials, paid generation or Vercel operation in this release.

The existing normal ChatGPT conversation initially could not discover the new
action despite the server release. Its exact existing plugin's **Refresh tools**
control was used and allowed to finish; account, OAuth scopes and permission mode
were unchanged. Reopening the same existing conversation then exposed the new
action; normal ChatGPT visibly confirmed the cache gate resolved and resumed the
existing proposal set. A new conversation or account reconnect was not needed in
this actual case. Amendment save/readback remains a separate acceptance receipt;
do not claim these field proposals saved merely because v68 is deployed.

For future metadata changes, follow the official [refresh procedure](https://developers.openai.com/plugins/deploy/connect-chatgpt#refresh-metadata):
refresh the existing connection and verify advertised changes; the documentation
also calls for a new conversation for affected tests. Never substitute raw HTTP,
SQL, copied credentials or automatic-overwrite behavior for a stale tool inventory.

## Completed normal-chat production acceptance

The same existing normal company chat completed **14 original editorial
corrections across 12 November drafts**, with full-field readback. Independent
SELECT-only canonical revision comparison confirms all 12 current versions,
draft/unpublished state, unchanged unselected strategy payload and unchanged prior
provenance. Exactly **11 concept positions and three gold-standard test fields**
changed, represented by 13 canonical field paths (CG's two video corrections share
one array). Every changed concept array retains its original length; every other
concept position is unchanged. No remaining corrections from this bounded batch.

The four earlier citation mismatches were reconciled to genuine current eligible
post/package evidence: Bouwer & Coetzee, Supa Quick BFN, CG Production House and
All Around PVC. The existing exact-client guides/plan also support the unchanged
proposals where noted in the chat. No source ID was invented or research activated.

Exact client/draft/revision/version/path/citation receipts and invariance results:
`strategy-review/2026-10-16-normal-chat-field-amendments.json`. This receipt prevents
replaying the old proposal artifact. It is **not** fleet client-launch approval,
strategy publication, calendar allocation or completion of recipient/asset gates.
