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

Original media remains in canonical OneDrive `Photos`. The `CG Creative Assistant` folders are curated helper views only: `READY_UNUSED` is not proof of global non-use, `USED_REFERENCE` is recent/important visual evidence, and `BLOCKED_DO_NOT_USE` is a reversible exclusion signal rather than deletion authority. Poster-ready derivatives belong under the authorised month `01_SOURCE_EDITED` folder and retain original OneDrive item ID, hash and edit receipt. Apply the ledger equally to staff-created and AI-created Canva pages.

## Canva working-lane guard

For the Piek master `DAGcXGWhDhI`, re-read the page list before every write and validate it with `scripts/poster-studio/canva-lane-guard.mjs`. The verified 5 November 2026 boundary IDs are versioned in `canva-lane-policy.json`; page numbers are observations only and may shift.

- Maintain one official client Canva file. Create and edit new production pages directly in its verified working lanes. Register new job page IDs in the lane policy and validate every content-edit target against the current page list; a page moved into Drafts/Posted/Scheduled immediately loses edit eligibility.
- A separate working copy is optional for disposable tests only. Transfer useful finished work into the official file, verify the transferred editable layers, then remove the temporary copy. It must never become a second official client project. Copying a page does not authorise reuse of its photo, person, wording, concept or mechanism.
- `IN PROGRESS / TEMPLATES` and `TO BE APPROVED` are the only permitted destinations for new work. Both header IDs are now verified in the Piek lane policy. Divider pages remain read-only even if mistakenly registered as editable.
- Do not overwrite other designers' existing work or alter workflow divider pages. `DRAFTS` and `POSTED / SCHEDULED` are Amonique-controlled: never edit, move or delete their pages.
- New pages may be added in the verified working lane. For connector page-merge operations, re-resolve header IDs immediately beforehand and follow the tool's exact-operation approval requirement. This is a connector requirement, not a requirement to seek approval for every routine new-work content edit.
- Check page capacity before planning an insert. Canva's documented maximum is 350 pages; the Piek master currently reports 352 and an actual approved insert failed with `Page limit reached`. Keep the saved temporary candidate until transfer succeeds. Never resolve capacity by silently deleting, moving or overwriting existing work, creating a second official file, or repeatedly retrying the rejected operation. Obtain an owner decision on capacity first.
- Canva position is not Dynamics approval, Meta draft, scheduling or posting proof.

## Source-photo preparation

Use Picasso's private local MCP/runner architecture for deterministic inspection, scene grouping, previews, conservative first-pass finishing and verification. Do not upload private source photos to a cloud batch editor. For poster-selected photos, create a separate derivative from the original, preserve dimensions/profile where appropriate, strip private metadata on review/export copies, and keep the original hash. Lightroom Classic remains the preferred professional finishing surface when a selected image needs scene-aware colour, masking or detailed correction; Photoshop is reserved for subtle temporary blemishes or difficult local cleanup on a duplicate. Automated grades and face/quality hints are review aids, never release approval.

## Composition and amendments

- Preserve exact photos, people, food, products, venues and logos as deterministic source layers. Never generatively reconstruct them unless the owner explicitly requests that change.
- Keep headline, support text, prices/dates, logo, photos, masks, vectors, textures, overlays and effects independently addressable with stable layer IDs.
- Use generation only for optional non-factual decorative assets or ideation, never as the sole poster composition engine.
- The scene JSON is versioned authority. Render locally to an editable SVG, review PNG and hash manifest. Call a PSD editable only after Photoshop reopens it and independent image/text/logo/mask layers pass inspection.
- For a price/date/headline amendment, change only the named layer and produce a comparison receipt. Preserve the prior version.
- Production fixes adjust exact type/logo/spacing/colour without regeneration. Source fixes return to the original photo. Creative failures restart only the failed poster from original sources and the approved brief.

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
