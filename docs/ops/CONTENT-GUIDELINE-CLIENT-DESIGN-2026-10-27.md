# Content Guideline client design and ChatGPT acceptance — #896

CA requested a premium branded guideline, a separate client link, easy normal
ChatGPT authoring in personal/company accounts, and the existing calendar chain.
Branch: `codex/guideline-client-design-20261027`. No Vercel or protected writes.

## Design and source references

Read the existing OneDrive **Toyota Content Guide.pdf** (23 September) and
**Wiseman Group Content Guide_SEPT.pdf** (22 September), discovered under their
exact client folders. They contain numbered concepts, full dialogue, scene
directions and end frames. These are design/workflow references, NOT permission
to publish old concepts, admit research or copy content between clients.

The actual shared `ContentGuidelineDocument` now supplies:

- CG-branded cover and the client's existing logo, actual filming date/month.
- Numbered video lineup with direct in-document jumps.
- Complete scripts on a high-contrast reading surface, preserving line breaks.
- Objective/opening and optional filming/visual direction; no empty-field noise.
- A client link copied from the published projection. Clipboard refusal exposes
  the correct selectable client URL rather than suggesting an admin address.

The existing staff editor has **View client layout / Back to editing**. It uses
only an explicit client-safe field projection of saved videos. Drafts are labelled
private and have no share button; unsaved staff edits survive preview. Existing
publishing remains deliberate and unchanged. For an exact published link, use
**Preview as client → Copy guideline link** on the required document.

Links use `/client/plan?tab=guidelines&month=…&guide=…`; client sign-in and the
existing server-pinned own-published-content RPC remain required. This is NOT a
new anonymous/bearer-token sharing system. No internal run name, notes, assignees,
production state, raw OneDrive references or IDs are added to the client view.

## Concrete normal ChatGPT defect and correction

Live read-only `resolve_project_context → get_my_assistant_bootstrap →
find_content_runs → list_content_guideline_videos` succeeded for the existing
company-admin connection. The exact CASE October run returned two videos and
`has_script=true`, but omitted both complete scripts and filming direction.
That made list/edit/read-back verification incomplete.

Regression RED reproduced `script === undefined`. The narrow staff Assistant
projection now returns the already-selected **script, shot_breakdown,
requirements and visual_notes**. Explicit fields only; no spread of internal
notes or storage fields. Tool guidance tells ChatGPT to read before editing,
write only named fields, and reread to verify. No tools/scopes/auth were added.
The projection is also used by readiness reads, so these now include that same
saved brief; client portal reads remain a separate, publication-bound RPC.

Canonical normal-chat workflow (no second paid AI generation):

1. Resolve the real Project context; retain it on every call.
2. Find the exact existing Content Run by canonical client/event/date.
3. Ensure its one guideline only when missing; list the saved videos first.
4. ChatGPT writes the draft using `add_content_guideline_video` or narrow
   `update_content_guideline_video` with an idempotency key. Do not invoke the
   separately provider-funded generator merely to save ChatGPT's wording.
5. Re-read and verify the complete saved text. Reorder through the existing
   canonical reorder action, not a fabricated video-number field.
6. Link only an existing same-client video/reel Client Schedule slot, or leave
   legitimately unallocated. Never create a shoot/date/contractual slot to fill
   a gap. CG Calendar's event/run relationship stays separate from posting dates.
7. A manager/admin reviews and deliberately publishes the full document, then
   copies its client link. MCP draft authoring cannot publish it.

## Verification boundaries

The local browser fixture uses actual presentation and staff editor components,
synthetic sample creative and a disposable browser profile. Screenshots are
clearly marked **DESIGN PREVIEW / SAMPLE CONTENT / NOT PUBLISHED**. No samples
are inserted into production or claimed as a client's approved creative.

Actual live reads confirmed missing context on some real runs: one had no exact
client, others no guideline/mapping, and CASE videos were unallocated. This
design pass does not claim to have repaired or published those protected records.
Existing calendar/staff reconciliation ownership remains separate.

Local tests exercise complete scripts, same-client linkage, actual update handler
preserving unrelated fields/refusing a foreign client, publication boundaries,
context policy, mobile navigation and private draft preview. They do not prove
both separate ChatGPT accounts' live consent/session state. Live write acceptance
requires an owner-approved exact draft and read-back in each real account.

The backend projection/tool-description change is SOURCE ONLY until the exact
`cg-dynamics-mcp` release is approved and hosted files/auth/settings are reviewed.
The frontend is likewise not deployed. No migration, live SQL/data, provider
generation, file/share permission, publication, Microsoft or Vercel change.

Existing PRs #867/#866/#842 own the return-to-review button; their action is not
duplicated here. No new dependency, schedule authority or Guideline document.

Security reference: [Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api).
Existing grant/RLS/role/publication boundaries remain intact. Changelog Markdown
fetch was unsupported by the web reader; no Supabase SDK/API/schema changed.

Final run totals and source revision are recorded in #896/the PR after completion.
