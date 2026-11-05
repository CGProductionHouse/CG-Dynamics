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

## Next evidence gate

Before rendering either proof poster:

1. verify January package and schedule authority;
2. resolve each selected scope's exact logo variant, font family/weights and licensed local availability, colour values, and reference publication status;
3. choose exact rights-cleared OneDrive source photographs and run the creative ledger against historical work;
4. confirm branch/product/service facts and any people/vehicle/forecourt usage constraints;
5. create a layered proof from the approved brief, then test one isolated text amendment without changing source layers.

Desktop takeover is not part of the production workflow. Normal work should use company ChatGPT connectors plus headless local commands. A GUI editor may be opened only for a bounded compatibility or final human finishing check.
