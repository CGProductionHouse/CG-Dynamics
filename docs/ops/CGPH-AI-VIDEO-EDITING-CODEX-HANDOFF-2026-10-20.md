# CG Production House — AI video-editing implementation handoff

**Date:** 20 October 2026  
**Scope:** CG Production House internal Premiere Pro post-production.  
**Status:** Owner-directed implementation brief; not a claim that plugins are installed or licences purchased.
**Implementation issue:** [#856 — CGPH AI editing Codex implementation](https://github.com/CGProductionHouse/CG-Dynamics/issues/856). The issue is ready for an assigned coding agent; no agent run or workstation installation has been claimed.

## Owner direction update — 21 October 2026 (Nolan)

The owner has now approved a **progressive Nolan autonomous-editor goal**: Nolan should create increasingly complete **4K, source-linked, editable Premiere edits**; Franco and Sydney should primarily **review and correct**, with KG still preparing simpler timelines while that work is automated. Human approval, client authority, rights and publication gates remain mandatory. The earlier human-only final creative finishing instructions below describe the current demonstrated capability, **not Nolan's long-term ceiling**.

**Canonical expanded system + creative quality game plan:** [Nolan autonomous 4K editing, LAN-first storage, SD ingest, Premiere handover, backups, quality learning and milestones (21 October)](./CGPH-NOLAN-AUTONOMOUS-4K-EDITING-GAME-PLAN-2026-10-21.md).

This direction extends existing issue #856 and coordinates with PR #859 and #841/#450; no competing video workflow, application task registry or changes to protected OneDrive/Dynamics authorities. Nolan currently operates on the owner's MSI laptop; the already-owned powerful desktop is the planned dedicated workstation when available. **Inventory must verify actual installed parts and drives before purchases.** This is an owner plan only, not proof of a completed workstation or automation rollout.

## Decision

**22 October verified implementation update:** [Premiere API/bridge audit, duplicate baseline and recovery](CGPH-NOLAN-PREMIERE-INTEGRATION-AUDIT-2026-10-22.md). Prepared-media/XML assembly works; native effects/title/audio execution remains unverified. Initial storage failure resolved through owner-authorised cleanup; Adobe UDT 2.3.0.5 installed. Host discovery now awaits human Developer Mode enablement/restart. No unapproved third-party installation/purchase or production rollout.

**Existing subscriptions (owner-confirmed):** CG operates **two distinct Adobe Creative Cloud subscriptions** under separate logins, plus CapCut Pro. This is not evidence of a shared Adobe Teams tenancy or two plugin seats. Codex must check plugin licensing and workstation entitlements separately; no private sign-in or billing details belong in this public repo.

Use **released Adobe Premiere Pro** as the master editor, existing CapCut Pro for simple standalone social edits, and an evidence-ranked set of existing editing tools:

1. **Search and sort:** Premiere Media Intelligence (already included). **Jumper** is the preferred additional footage-search plugin where approved, on the strength of a real independent comparison.
2. **Dialogue assembly:** Premiere Text-Based Editing + **Paper Edit** (released in Premiere 26.5) to turn verified transcript selections into an editable sequence. **AutoEdit Creator Mode** may provide an optional first pass for English talking-head material; professional reviewer findings still require manual cleanup.
3. **Music-led editing:** **BeatEdit 2** to add music beat markers and arrange *preselected* shots using Premiere Automate to Sequence; it does not choose the best cinematic moments.
4. **Final cut:** CG's editor makes all narrative, aesthetic, audio, branding, colour, pacing and delivery decisions.

Do **not** promise that any current reviewed tool turns an arbitrary commercial prompt into a finished professional timeline without human creative editing.

## Independent evidence and official documentation

| Tool | Source and outcome | Implementation status |
|---|---|---|
| Jumper footage search | Iain Anderson, ProVideo Coalition (25 Feb 2026), tested Jumper, Premiere, Peakto, FCP with 142 clips. Jumper gave the most consistently useful visual results; Premiere came second. https://www.provideocoalition.com/visual-search-tools-compared/ | Preferred footage search plugin, **subject to licence approval**. A good search hit is not automatically the best shot. |
| Premiere Media Intelligence | Adobe search documentation: visual search/source ranges and transcript search; native visual analysis neither identifies named people nor performs OCR. https://helpx.adobe.com/premiere/desktop/organize-media/file-organization/media-intelligence-and-search-panel.html | Included baseline. |
| Premiere Paper Edit | Adobe released feature in 26.5; selectable transcript excerpts create a new editable sequence. https://helpx.adobe.com/ie/premiere/desktop/edit-projects/edit-video-using-text-based-editing/create-a-sequence-with-paper-edit.html | Included baseline for supported dialogue. |
| Premiere pause cleanup / Enhance Speech | Official stable documentation. https://helpx.adobe.com/premiere/desktop/edit-projects/edit-video-using-text-based-editing/detect-and-delete-pauses-in-transcripts.html and https://helpx.adobe.com/premiere/desktop/add-audio-effects/adjust-volume-and-levels/enhance-speech.html | Included, with human audio review. |
| AutoEdit Creator Mode | Premiere Gal hands-on review: useful editable rough cut, but missed repeats and long silences; independent editor-assisted review scored it 7/10 for spoken videos. https://www.autoeditai.net/blog/autoedit-creator-mode-premiere-gal-review and https://agent-finder.co/reviews/autoedit | **Optional dialogue-only route**, not an autonomous commercial editor. |
| BeatEdit 2 | Established Premiere plugin with beat markers and Automate to Sequence; published features and review available, but no rigorous independent comparison was found. https://aescripts.com/beatedit-for-premiere-pro/ | Optional for music-driven edits; label it beat detection, not AI selection. |
| Eddie AI | Creator/editor footage review was for **V3**, while **V4** runs on a new foundation and processes/uploads footage or proxies. https://www.patreon.com/premieregal/posts/eddie-ai-rough-151252141 and https://www.heyeddie.ai/help/what-is-eddie | **Not a core rollout component**. Do not transfer V3 creator validation to V4. |
| Premiere AI Assistant | Adobe explicitly labels it beta and says it is not recommended for client work yet. https://helpx.adobe.com/premiere/desktop/premiere-ai-assistant/overview.html | **Exclude** from active client edits. |
| FireCut Magic Cut | First-cut quality lacks a comparably robust independent commercial review in this research. https://www.firecut.ai/ | **Do not buy** on automation claims. |

**Afrikaans:** Adobe's published Premiere speech-to-text language list does not include Afrikaans. English/Afrikaans interviews, proper names and captions require human checking. https://helpx.adobe.com/premiere/desktop/add-text-images/insert-captions/languages-supported-by-speech-to-text.html

**Seat distribution:** A plugin installed on one computer is not automatically licensed for all Adobe users. Adobe supports compatible plugin deployment through Admin Console/CCX, but third-party activation remains governed by each vendor. Jumper states **one device per licence** and optional Pro analysis sharing. https://developer.adobe.com/uxp/guides/how-to/distribution/enterprise-distribution/ and https://getjumper.io/about

## Exact existing Dynamics/OneDrive workflow

Preserve existing `monthly_deliverables` Client Schedule → **one** Content Run and Content Guideline → verified existing client OneDrive media → canonical video editing/review/approval statuses → actual approved exports.

**Never create another task registry or new folder hierarchy.** Existing internal folders and naming are governed by `docs/current-product-game-plan.md`. Existing status transitions are in `src/lib/videoPipelineRules.ts`; #841 owns accepted-scope event-to-edit questions; #450 owns Content Production Autopilot. No invented jobs, deadlines, media links or statuses.

The editor opens the **exact** existing Content Guideline and the **existing** authorised source location. Raw OneDrive media stays strictly staff-only; client review files continue through the established human WhatsApp/approval process.

### Three production lanes

- **Talking heads/testimonials:** Find selects → transcribe supported dialogue → Paper Edit or licensed AutoEdit first-cut → review spoken quotes/takes → human story/B-roll/captions/audio finish → existing review.
- **Event highlights/reels:** Find and verify strong shots → selects sequence → BeatEdit/music markers and optional Automate to Sequence → human rhythmic/visual/story/sound finish → existing review.
- **Premium commercials:** Use search for faster locating; dialogue tools only where relevant. Human editor owns hero shots, sequencing, pacing, creative direction and final output. No claim of reliable fully autonomous commercial cutting.

Use **only** footage, claims, faces, logos and branding from the exact approved production. Never replace real client content with generated lookalikes.

## Codex implementation contract

Read `AGENTS.md`, `docs/ops/CG-DYNAMICS-OPS-HANDOVER.md`, `docs/ai-workforce/MASTER-AI-TOOLS-AND-WORKFLOW.md`, `docs/current-product-game-plan.md`, current main/open PRs and issues #841/#450 before touching code. Respect existing worker ownership and the hosting restriction #679.

1. **Create one workstation SOP:** released Premiere version; enable native Search/Media Intelligence, transcript and Paper Edit; exact short operator instructions for each of the three editing lanes.
2. **Create one plugin deployment/seat guide:** official installer links; OS/host compatibility; per-user/device entitlements; differences between Jumper standard and Pro; AutoEdit/BeatEdit optional licence gates. Do not claim installation or team-wide access without actual workstation readback.
3. **Create reusable Premiere project/sequence templates:** keep all originals and existing OneDrive folder conventions. Suggested **sequence labels only**: `<existing video name>_SELECTS`, `<existing video name>_ROUGH`, `<existing video name>_MASTER`. No destructive media restructuring.
4. **Dynamics handoff:** Reuse the existing staff-only Video Pipeline/Guideline/OneDrive-open actions; expose the SOP at the editing point only if needed. Do not build a new editor, plugin marketplace, approval system, AI provider endpoint, table or job list. Prefer no new app code if the current UI already provides exact guidance and links.
5. **Technical acceptance only:** confirm approved software launches, source media stays linked, editable sequence opens, both authorised editing workstations have legitimate access where required, optional plugins can be disabled without project loss, and canonical status/client protections remain intact. This is not a request to experiment with unreviewed vendors.
6. **Report truthful status:** source changes, tests/build/PR, any purchases or workstation access still needed, remaining human-only actions and approvals. GitHub documentation alone is **not** proof of live installation.

No automatic subscription purchases, private account credentials, client-footage uploads to new vendors, live Supabase writes or production deployments without owner approval. Maintain staff-only access to internal media. Link the resulting PR to the implementation issue rather than launching overlapping code missions.

**Definition of done:** repeatable documented Premiere-based workflow; externally validated features, two-seat deployment instructions, exact Dynamics handoff, reversible optional integrations, and no overstated AI editing promises.
