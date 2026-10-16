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
tests remain green. Full MCP Deno, app build with route chunks and scoped lint
pass. Production deployment and normal-chat save acceptance are separate receipts;
this document alone does not claim either.

The pending existing proposal set has 14 changes across 12 clients. The normal
chat confirmed four packets contain source IDs outside the fresh brief's allowed
list (Bouwer & Coetzee, Supa Quick BFN, CG Production House, All Around PVC).
Reconcile only to genuine currently eligible evidence or retain that hold; never
invent a citation, activate source material, or relax the gate to complete a batch.
