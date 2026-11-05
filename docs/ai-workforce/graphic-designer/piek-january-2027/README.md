# Piek January 2027 production pilot

This directory is the versioned proposal and evidence gate for issue #955. It does not contain final artwork or claim that January deliverables are scheduled.

## Current verified position

- Piek Group client ID: `ed7aa1ae-de21-4151-a8f9-54796b234c1f`.
- Latest observed package baseline: 12 designed posters and 4 professional videos.
- January 2027 Client Schedule query returned no rows. Every proposed poster therefore uses a provisional ID and `monthlyDeliverableId: null`.
- Four separate Canva Brand Kits were verified for Piek Group, Get Together, Engen and Sasol. They must never be blended into one generic Piek style.
- The authorised Canva connector can list those four kits and read the 352-page Piek history design directly from company ChatGPT. Routine brand/reference retrieval therefore does not require browser or desktop takeover; final creation, isolated amendment and export still require an end-to-end connector proof.
- One official Canva file per client: new production pages are edited directly inside verified In Progress/Templates or To Be Approved lanes. Temporary test copies must be consolidated back into the official file and removed after transfer verification. The guard checks registered page IDs and current lane positions; Drafts and Posted / Scheduled remain read-only.
- Existing OneDrive `CG Creative Assistant` folders remain the media/history authority. This work records locators rather than duplicating client assets in Git.

## Files

- `brand-pack-index.json` records the four brand scopes, source locators, sampled visual evidence and unresolved production gates.
- `january-strategy.proposal.json` contains the proposed 12-poster creative grid. It is strategy, not an approved calendar or final copy deck.

Validate the proposal from the repository root:

```powershell
node scripts/poster-studio/month-plan.mjs docs/ai-workforce/graphic-designer/piek-january-2027/january-strategy.proposal.json docs/ai-workforce/graphic-designer/piek-january-2027/brand-pack-index.json
```

Expected current result: 12 briefs, three per brand scope, 12 distinct mechanisms, no invented schedule IDs, and all artwork held behind unresolved brand/source/fact gates.

## Saved summer proof and capacity blocker — 5 November

The owner reviewed the Get Together summer candidate and explicitly authorised saving it. Canva committed transaction `8042824266452258728` into the existing temporary test design `DAHaDQgOO1M`, page 2 (`PBchP5dl0NZ3cp1l`). A fresh read-only transaction confirmed final `TAKE IT / SLOW.` wording, three native text elements and four separate photographic/logo elements; that verification transaction was cancelled without changes. Private source, previews and saved-state receipts remain outside Git. This is approval to save an internal candidate, not client publication or approval of the full month.

The authorised transfer of only that page before Drafts in `DAGcXGWhDhI` failed: `NOT_PERMITTED — Page limit reached`. The main file still reports 352 pages. [Canva documents a 350-page maximum](https://www.canva.com/en_gb/help/manage-pages/). Read-only inspection of working pages 24–49 found existing artwork/reference boards rather than a blank page. The To Be Approved divider is now verified at page ID `PBz6Ds1Q01l3g6ty` (observed index 41) and protected by the guard.

Do not retry an insert, delete protected history, overwrite another designer's work or create a second official project to bypass capacity. Retain the saved temporary file until an owner-approved capacity decision enables verified transfer. Its inherited presenter notes are still stale and must be corrected before production handoff; the current connector exposes notes read-only. Normal company ChatGPT creation/amend/export remains unverified.

## Remaining production gates

Before treating a saved proof as a production deliverable:

1. verify January package and schedule authority;
2. resolve each selected scope's exact logo variant, font family/weights and licensed local availability, colour values, and reference publication status;
3. choose exact rights-cleared OneDrive source photographs and run the creative ledger against historical work;
4. confirm branch/product/service facts and any people/vehicle/forecourt usage constraints;
5. retain the completed layered summer proof and isolated-amendment evidence, correct inherited notes, resolve main-file capacity and verify transferred layers;
6. prove normal company ChatGPT invocation and final export, then obtain human creative approval before scaling the month.

Desktop takeover is not part of the production workflow. Normal work should use company ChatGPT connectors plus headless local commands. A GUI editor may be opened only for a bounded compatibility or final human finishing check.
