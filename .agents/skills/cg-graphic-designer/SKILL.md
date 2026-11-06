---
name: cg-graphic-designer
description: Plan, audit, create, amend or review CG Production House poster and graphic-design work using exact client brand packs, source-faithful media, anti-repetition checks and layered local production. Use for single posters or monthly designed-poster batches; do not use for Nolan video editing or Picasso photo-library finishing.
---

# CG Graphic Designer

Produce professional, individually art-directed work from exact client evidence. A technically valid render is not creative approval.

## Authority and boundaries

- Resolve the exact client, package, Client Schedule rows, current strategy and approved feedback from CG Dynamics. Never invent a future deliverable ID or promote a draft strategy.
- Keep original brand/media files in OneDrive. A Brand Pack stores verified locators, hashes and rules, not a duplicate client database.
- Treat Canva as creative history, one-time brand discovery and an optional editor/output. Do not rescan giant designs for every job.
- Treat workflow sections inside a client's Canva master as operational permissions, not decoration. Historical `DRAFTS`, `POSTED` and `SCHEDULED` pages are read-only evidence and must never be edited, moved or deleted by the agent.
- Use normal company ChatGPT as the intended staff interface. Prefer connector calls and headless local job commands; direct desktop control is a bounded integration/debug exception, not routine production.
- Keep Nolan, Picasso, production publishing and Client Portal release lanes separate.

## Before design

1. Read the owning GitHub issue and current exact-client/month authority.
2. Fail closed if the exact logo, font licence/file, colour values, branch, product/service fact or source rights are unresolved.
3. Build or refresh the compact Brand Pack for the exact `client_id + brand_scope`; do not borrow a sibling brand kit.
4. Run the global creative ledger against source hashes/pHash, shoot/capture evidence, reviewer-supplied visible-person tags, products/services, branches, concepts, headlines and layout mechanisms. Never create face embeddings or a biometric identity database.
5. Write the strategic job before source selection: audience/moment, objective, tension, proposition, proof, desired response/action, current relevance, source need, distinctive mechanism, exclusions and one-sentence reason to exist.
6. Review the month as a grid. Balance scope/location, people/product/service/place, light/dark, density, type behaviour and mechanism. A different photograph does not make a repeated concept fresh.
7. Research the actual target month's season, local events, holidays and audience routines from current first-party sources. Give each brief a proposed creative window and distinguish calendar facts from audience hypotheses. Opening-week creative must fit that week's context. Recheck time-sensitive stock, offers, hours and events near release. Avoid forcing a seasonal theme onto every poster.

For Piek January 2027, read issue #955 and:

- `docs/ai-workforce/graphic-designer/piek-january-2027/brand-pack-index.json`
- `docs/ai-workforce/graphic-designer/piek-january-2027/january-strategy.proposal.json`
- `docs/ai-workforce/graphic-designer/piek-january-2027/canva-lane-policy.json`

Run the validator before treating the proposal as usable:

```powershell
node scripts/poster-studio/month-plan.mjs docs/ai-workforce/graphic-designer/piek-january-2027/january-strategy.proposal.json docs/ai-workforce/graphic-designer/piek-january-2027/brand-pack-index.json
node scripts/poster-studio/month-board.mjs docs/ai-workforce/graphic-designer/piek-january-2027/january-strategy.proposal.json <private-output.html>
```

## Source and repetition checks

Use `scripts/poster-studio/creative-ledger.mjs` for deterministic checks. Its JSON entries can describe human or AI-assisted posters, so Ger-Marie work and AI work share one memory.

For cropped-photo matching against Canva history previews, use `scripts/poster-studio/source-history-audit.py` on privately downloaded previews and selected originals. Inspect any geometrically supported matches. A negative result is limited to the supplied previews; tiny, heavily overlaid, missing or same-shoot images still require review. Do not mistake random texture correspondences for source reuse or use this tool to identify people.

```powershell
node scripts/poster-studio/creative-ledger.mjs fingerprint <image>
node scripts/poster-studio/creative-ledger.mjs check <ledger.json> <candidate.json> --out <receipt.json>
node scripts/poster-studio/creative-ledger.mjs record <ledger.json> <entry.json> --out <updated-ledger.json>
```

Preserve `approved`, `scheduled`, `posted`, `draft`, `discarded`, `internal-pilot-only` and `unresolved` states. Unknown history stays unresolved; never promise that an image is unused without adequate evidence. A flagged repeat can proceed only with an explicit, defensible campaign-continuity justification and human review.

For a verified parent-brand post using an actual subsidiary photograph, pass `--brand-pack <trusted-brand-pack-index.json>`. Only an exact-client reviewed `sourceScopeRules` entry permits that scope; a candidate cannot declare its own exemption, and sibling kits remain separate. Preserve unknown branch and person identities as unresolved instead of supplying a generic brand as a branch or assigning a different identity per image. Use the actual headline for headline comparison, not every caption/support line concatenated together.

Original media remains in canonical OneDrive `Photos`. The `CG Creative Assistant` folders are curated helper views only: `READY_UNUSED` is not proof of global non-use, `USED_REFERENCE` is recent/important visual evidence, and `BLOCKED_DO_NOT_USE` is a reversible exclusion signal rather than deletion authority. Poster-ready derivatives belong under the authorised month `01_SOURCE_EDITED` folder and retain original OneDrive item ID, hash and edit receipt. Apply the ledger equally to staff-created and AI-created Canva pages.

## Canva working-lane guard

For the active Piek master `DAHaD4mJnGY`, re-read the page list before every write and validate it with `scripts/poster-studio/canva-lane-guard.mjs`. The verified 5 November 2026 boundary IDs are versioned in `canva-lane-policy.json`; page numbers are observations only and may shift. Owner explicitly authorised this dated continuation after legacy `DAGcXGWhDhI` reached capacity. The legacy file remains read-only scheduled/posted history; do not redirect its existing export/schedule work or assume its calendar cutoff.

- Maintain one active official client Canva file. An owner-authorised dated continuation may coexist with its read-only legacy schedule/history file. Create and edit new production pages directly in the active file's verified working lanes. Register new job page IDs in the lane policy and validate every content-edit target against the current page list; a page moved into Drafts/Posted/Scheduled immediately loses edit eligibility.
- A separate working copy is optional for disposable tests only. Transfer useful finished work into the official file, verify the transferred editable layers, then remove the temporary copy. It must never become a second official client project. Copying a page does not authorise reuse of its photo, person, wording, concept or mechanism.
- `IN PROGRESS / TEMPLATES` and `TO BE APPROVED` are the only permitted destinations for new work. Both header IDs are now verified in the Piek lane policy. Divider pages remain read-only even if mistakenly registered as editable.
- Do not overwrite other designers' existing work or alter workflow divider pages. `DRAFTS` and `POSTED / SCHEDULED` are Amonique-controlled: never edit, move or delete their pages.
- New pages may be added in the verified working lane. For connector page-merge operations, re-resolve header IDs immediately beforehand and follow the tool's exact-operation approval requirement. This is a connector requirement, not a requirement to seek approval for every routine new-work content edit.
- Check page capacity before planning an insert. Canva's documented maximum is 350 pages; the legacy Piek file reports 352 and an actual approved insert failed with `Page limit reached`. The owner-authorised continuation was created below that limit. Never resolve capacity by silently deleting, moving or overwriting existing work or repeatedly retrying a rejected operation. Obtain an owner capacity decision before changing the official-file arrangement. Current merge tooling accepts only one operation per call despite its array schema; verify every result and page IDs before the next operation.
- For native text, resize width only and let Canva calculate height; text-height changes are rejected. Inspect every operation result, not only the top-level tool status. Preserve source element IDs and all non-target layers when correcting a partial failure. The current connector cannot edit presenter notes, font families, shadows or native effects; inherited notes must never be treated as final captions.
- Canva position is not Dynamics approval, Meta draft, scheduling or posting proof.

## Source-photo preparation

Resolve colour evidence before grading with `scripts/poster-studio/photo_colour.py`. Embedded ICC takes precedence. EXIF ColourSpace 1 identifies sRGB; uncalibrated 65535 alone identifies no usable profile. DCF InteroperabilityIndex R03 plus 65535 requires an actual Adobe RGB (1998) to sRGB conversion using the existing local Adobe ICC file. Do not mistake Pillow `.convert('RGB')` or attaching an sRGB profile for colour conversion. The Piek restocking JPEG exposed this real failure. Unknown/conflicting evidence must stop for review rather than silently gaining an sRGB tag. Keep the source, conversion receipt and versioned derivative; never redistribute the installed Adobe ICC file. Use actual colour conversion before exposure/WB/masking, not as a final retagging step.

Use Picasso's private local MCP/runner architecture for deterministic inspection, scene grouping, previews, conservative first-pass finishing and verification. Do not upload private source photos to a cloud batch editor. For poster-selected photos, create a separate derivative from the original, preserve dimensions/profile where appropriate, strip private metadata on review/export copies, and keep the original hash. Lightroom Classic remains the preferred professional finishing surface when a selected image needs scene-aware colour, masking or detailed correction; Photoshop is reserved for subtle temporary blemishes or difficult local cleanup on a duplicate. Automated grades and face/quality hints are review aids, never release approval.

Compare the original, finished photograph and final placement visually. A small global adjustment does not by itself establish professional finishing. Evaluate subject definition, tonal separation, colour, texture and local light at the actual poster crop; retain realistic scene atmosphere and source identity. Save versioned settings and before/after evidence. Treat owner feedback as a quality standard for subsequent work, without applying one identical grade or effect to every scene.

Owner rejected the 6 November Piek execution despite valid native layers and successful exports. Never repeat the warped-photo paper-plane treatment, arbitrary oval subject crop or tilted photo card as a substitute for art direction. Preserve photographic proportions with uniform scaling and deliberate cropping. Keep a person, product or venue's defining features intact. Use actual source silhouettes for subject/type overlap; review the mask at both placement size and HD. Shadows must explain a surface or contact, and texture must support that exact brand rather than conceal a weak photograph. Compare each revision against a specific native reference's hierarchy, tonal separation and layer relationships, not merely its layer count. Weak source selection requires a stronger verified source, not more effects.

## Composition and amendments

### Graphic execution standard from the Piek rework

Owner rejected the next revision for continued flatness, logo plates and unused space. A clean photo with a header and footer is not this client's full graphic language. Study the actual brand's native layer relationships: sculpted colour fields, selective gradients, halftone/paper texture, large live typography, real foreground cutouts and contact shadows. State the purpose of each device; do not copy historical photographs/offers or add the same decorative mechanism to every post. Preserve owner-supported directions rather than rebuilding the whole month indiscriminately.

- Inspect transparent logos on the actual intended background. Remove an unwanted source background only when the original mark, enclosed white lettering and coloured geometry remain intact. Integrate contrast into the composition; do not default to a small white rectangle behind each logo.
- Keep actual subject masks independent. Background removal can fail on a rack or choose only one canapé; inspect what was really extracted. Use a deliberate photographic composition when no useful subject can be separated. Do not claim successful extraction from a failed operation.
- A source-edge cut through a car, arm or pump must either reach the page bleed, be masked deliberately or be hidden by an intentional foreground graphic. Inspect every visible edge. Moving a full-canvas graphic upwards can reveal a hard bottom boundary; prepare continuous bleed rather than adding another arbitrary card.
- Read original native asset dimensions before placement. The real 1728×155 Engen footer was cropped in a 1080×116 frame despite apparently covering both page edges. Use a 1080×96.875 proportional frame and the existing brand background for bleed. Declare `sourceDimensions` on uncropped native assets; the packager checks source aspect with native half-pixel rounding tolerance. Thumbnail dimensions are not exact source dimensions.
- Re-inserting a vector/image puts it above existing layers. This can hide a logo or caption even if the same coordinates are used. If the API cannot restore the intended stacking, rebuild that one scene with the correct ordering; inspect the new preview before transfer.
- Check the full grid at phone size, then inspect real 2× exports for logo clipping, unreadable/occluded copy, bright halos and distorted masks. Successful native record checks do not establish creative approval. Keep old own drafts clearly superseded and excluded from the current export/delivery selection.

### Native Canva path without desktop takeover

The private HTML import path is now exercised with actual Piek drafts. Use `scripts/poster-studio/canva-native-package.mjs` to package a private structured scene: exact kit fonts/colours, clean source derivatives, independent images, live text, rectangles and explicitly bound native logo assets. Import through the authorised Canva connector's `design_file` field. This is a native composition import, not image-to-design guessing or a flattened-poster upload. Keep accurate `data-speaker-notes` and page labels in the package; the editing connector cannot fix inherited notes or set font families afterwards.

- Use prepared, metadata-clean review images; the packager rejects private EXIF/XMP/IPTC/text chunks, path escapes, remote image references, unverified fonts/colours and oversized input. ICC profiles stay intact. No public file hosting is needed or permitted.
- The observed import ceiling is 10 MiB. The shared packager leaves headroom at 9.5 MB; split pages or deliberately prepare image derivatives. Never flatten a poster, quietly destroy detail or repeatedly retry an over-limit file.
- Bind every native asset and check each operation's result. Vector assets cannot replace imported image frames: delete only the declared placeholder and insert the exact native vector asset. Raster logo replacement is supported. Recheck actual aspect, placement and contrast. Native import rounds fractional frame geometry by up to half a design pixel; identity/page scope remain exact and ambiguous matches fail.
- Explicit line breaks and `white-space:nowrap` avoid unwanted pre-import fallback-font wrapping. Retain the scene's font size/line height for amendments. Replacing text can recalculate its bounding box even when the restored pixels are unchanged; compare the target render and all non-target records rather than claiming full geometry identity.
- Existing template outline/shadow/font effects are not editable through this connector. Reject an unsuitable source instead of preserving it because the tool call succeeded. Required logos and brand devices may repeat; photo/person/shoot/concept repetition is assessed separately.
- Native filled vector panels may be visible in the rendered poster but absent from the connector's editable text/image list. A successful photo replacement therefore does not prove the old tilted frame/panel disappeared. Inspect the rendered page. If required shapes cannot be edited, cancel the trial and rebuild a clean native composition; never cover the defect with another arbitrary crop or call it fixed. Transfer only into the permitted working lane and clearly distinguish superseded agent drafts from current candidates. Do not delete protected or staff pages.
- Save authorised work at short checkpoints, read it back and retain a private source/asset/element receipt. An overnight transaction expired in the real pilot; local scenes/recipes preserved recovery. Avoid keeping the only finished work in a long-lived unsaved transaction.
- After a page merge, resolve actual page IDs and headline/asset records rather than assuming the requested source order was retained. In the real two-page transfer, returned pages appeared in reverse order. Page-list thumbnails also showed stale pre-insert artwork, including workflow headers under new page IDs. Use fresh transaction thumbnails for changed/transferred pages and compare semantic native records before claiming a saved design was verified. Reject a contact sheet made from mismatched cached previews.
- Follow the owner's existing save authority; do not ask repeatedly for routine internal saves. Page restructuring still needs grounded exact-operation authority. `planApprovedScaffoldReplacement` permits only an explicitly approved contiguous block of registered, superseded agent pages, with a fresh boundary read after deletion; it cannot remove staff work, headers, saved proofs or protected history.

### Finishing and delivery lessons

Owner feedback about washed-out images applies across the set. Evaluate actual source, derivative and final crop. A simple linear contrast pass increased clipping and was rejected; the accepted private pass uses endpoint-anchored luminance contrast and restrained detail within each source pixel's RGB headroom. Check clipping before upload, avoid crushed shadows/halos and keep already-good images natural. Never apply a uniform aggressive grade or describe existing JPEG clipping as recovered detail.

For mutable Piek branch facts, the owner explicitly confirms the current live `piekgroup.co.za` site as the authority; use current Get Together site facts for its venues. Unknown photo provenance is not solved by a plausible branch guess. The pilot replaced an uncertain burger source with a current-site night photograph and verified forecourt-hours claim. Keep detected repeated branches visible to monthly human review even when the photos/services differ.

Prepare captions from the current exact-client Dynamics guide: add to the artwork, use distinct scope voices, default to at most five relevant hashtags, and sign PICASSO when the owner requests it. For approval delivery, verify the requested sender and exact group, send the true HD poster and its caption in one message, then retain actual message evidence to avoid duplicate retries. A thumbnail is not an HD export. If the browser reports disabled and the connector has no export/send tool, record that exact blocker; never claim delivery or use a different account.

Approved finals belong only in the existing client-safe `A_ClientPortal_<ClientSlug>/Graphic Design/YYYY/YYYY_MM_MON` path, using `onedriveCanonical.ts` year/month builders and the existing staff-approved filename rule. Canva page naming is separate. Do not guess a client short code or posting date. Keep source/editable files and drafts internal. Promote only reviewed finals through the existing same-client portal asset workflow; link real January deliverable IDs when present, never fabricate one or imply a file upload created a Dynamics association.

### Layer contract

- Preserve exact photos, people, food, products, venues and logos as deterministic source layers. Never generatively reconstruct them unless the owner explicitly requests that change.
- Keep headline, support text, prices/dates, logo, photos, masks, vectors, textures, overlays and effects independently addressable with stable layer IDs.
- Use generation only for optional non-factual decorative assets or ideation, never as the sole poster composition engine.
- The scene JSON is versioned authority. Render locally to an editable SVG, review PNG and hash manifest. Call a PSD editable only after Photoshop reopens it and independent image/text/logo/mask layers pass inspection.
- For a price/date/headline amendment, change only the named layer and produce a comparison receipt. Preserve the prior version.
- Production fixes adjust exact type/logo/spacing/colour without regeneration. Source fixes return to the original photo. Creative failures restart only the failed poster from original sources and the approved brief.
- Consider genuine subject/typography overlap where it strengthens depth and legibility. Duplicate exact finished photo pixels into an independent transparent mask rather than reconstructing a sign, person or product. Preserve variety across the month; a cutout is an art-direction choice, not a mandatory template.
- Finish the background asset and crop before measuring foreground registration. Canva may change internal crop on asset replacement even when native element dimensions stay identical. Re-measure against the new background preview, then insert the aligned cutout; reject doubled edges and halos before review.
- Verify footer/background bleed in the rendered image, not only element dimensions. Raster assets can contain transparent padding. Extend the exact background colour without distorting logos or covering lettering; inspect both side edges and the complete bottom row. Disclose thumbnail-only verification when a full-resolution export is unavailable.

## Quality gate

Check at phone size and as a full grid:

- exact brand scope, logo, fonts and colours;
- source identity and rights;
- branch/product/service facts and UK English;
- hierarchy, legibility, depth, masking, gradients, texture and visual sophistication;
- no repeated person/source/shoot/concept/headline/mechanism without reviewed justification;
- no generic AI filler or flat slide/template appearance;
- isolated amendment integrity and version history.

Machine tests prove structure and provenance, not taste. Human CG creative approval is required before scaling a pilot or publishing. Never publish, schedule, send to a client, upload private source media to an external model, buy a tool or deploy a bridge without the relevant explicit authority.
