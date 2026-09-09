---
name: content-run-closeout
description: Use to close out a content run — retrieve its plan, capture planned-vs-captured feedback, record missed/cancelled reasons and reshoot/follow-up, and verify OneDrive uploads with VERIFIED / MISSING / PARTIAL / UNVERIFIED status. Refers to the MCP tool contract abstractly; does not implement closeout logic.
---

# Content-Run Closeout

Post-shoot closeout workflow for a content run. **All runtime logic — the content-run
plan, capture state, and exact OneDrive upload verification — lives in the CG Dynamics
MCP server (owned by the #313/#311 runtime lane).** This skill orchestrates the staff
conversation around those tools; it must **not** reimplement or duplicate that logic, and
must not perform OneDrive access itself.

## Trigger / user goal

- "I'm done with <client>'s shoot."
- "Close out today's content run for <client>."
- "Check whether today's footage is uploaded."

## Required inputs

- The exact `client` and the specific content run (date / run identifier) resolved via the
  MCP connection. Ask if it's ambiguous; never assume which run.

## Tool sequence (workflow level, abstract MCP contract)

1. Retrieve the **content-run plan** for the exact run (planned deliverables/items).
2. Walk planned vs captured with the staff member: for each planned item, capture whether
   it was captured, missed, or cancelled, and the reason for any miss/cancel.
3. Record field/client feedback, and any **reshoot / follow-up** needed.
4. Request the **OneDrive upload verification** for the run from the MCP tool. Report the
   tool's returned status per item; do not infer it:
   - **VERIFIED** — the mapped OneDrive location confirms the expected upload.
   - **MISSING** — expected upload not found in the mapped location.
   - **PARTIAL** — some expected items present, some absent.
   - **UNVERIFIED** — verification could not be performed (no mapping/permission/session);
     treat as *unknown*, never as success or as zero.
5. Summarise closeout state back to the staff member and note what still blocks completion.

## Output contract

- Planned-vs-captured table: item → captured / missed / cancelled (+ reason).
- Feedback + reshoot/follow-up list.
- Upload status per item using exactly the four states above, as returned by the tool.
- Explicit "what remains before this run is closed" line.

## Facts the model must not infer

- Whether a file is uploaded — only the MCP verification tool decides; never guess from
  the conversation.
- OneDrive folder paths, IDs, or URLs (never expose internal storage IDs/URLs).
- That a run is complete — completion is the live system's authority.
- Which run/plan applies — resolve it exactly.

## When to ask / stop

- Ambiguous run/client → ask which run before starting.
- Verification returns UNVERIFIED → report it as unknown and state what's needed
  (mapping/permission/connection); do not retry into a fabricated result or call it done.
- No connection or missing closeout/verification tool → say so and stop; do not simulate.

## Boundaries

- **Abstract tool contract only.** Do not duplicate #313 runtime logic or #307 OneDrive
  implementation; call the MCP tools and report their results.
- Exact-client, exact-run scope only.
- No shadow media-tracking or upload-verification system.
