# Launch-now browser-chat graphic design workflow

Last updated: 2026-09-09
Status: bridge system for immediate rollout while the deeper Dynamics integration is built.

## Purpose

Use the strongest current normal-browser ChatGPT creative surface without breaking CG's existing content/package/OneDrive architecture.

The bridge is deliberately replaceable. Preserve the strategy, tracking, freshness and QA standards as tools improve; do not preserve manual friction for its own sake.

## Canonical system relationship

`monthly_deliverables` remains Client Schedule truth.

Existing CG content types remain:

- `DP` — Designed Poster
- `F` — Photo
- `Video`
- `Reel`

Poster naming/storage must follow `poster-onedrive-naming-standard.md` and extend the existing video production grammar.

Stable DP production ID:

`YYYY_MM_CLIENT_DP_XX`

Example:

`2026_11_PIEK_DP_01`

Sub-brand is separate metadata, e.g. `brand_scope=ENGEN`; optional descriptive suffix comes after `__`.

Do not create a second social calendar, second package identity or assistant-only poster ID.

## Production split

- **CG Dynamics**: exact client/package/month/deliverable, strategy, approvals, usage/performance learning.
- **OneDrive**: canonical original media + canonical monthly poster production files.
- **Normal ChatGPT browser chat**: research, planning, asset selection, creative direction and generation.
- **Internal image generation**: rich art direction, composition, gradients, masks, texture, depth, effects and visual play.
- **Adobe/Photoshop-style tooling**: non-generative photo correction/crop/cutout/compositing where identity and source fidelity matter.
- **Canva**: creative history, exact type/logo finishing, editable handoff, staff amendments and exact-page linkage.

Do not use Python/layout rendering as the primary high-love poster engine.

## Canonical OneDrive poster tree

Monthly poster production lives alongside the existing client `Videos` hierarchy, not inside `CG Creative Assistant`.

```text
Clients/<Client>/Posters/
  <YYYY>/
    <YYYY_MM_MON>/
      00_MONTH_PLAN/
      01_SOURCE_EDITED/
      02_CHAT_PACK/
      03_WAVE_1/
      04_AMENDMENTS/
      05_APPROVED/
      06_CANVA_HANDOFF/
      07_ARCHIVE/
```

`CG Creative Assistant` is the supporting system layer:

```text
CG Creative Assistant/
  00_SYSTEM/
  01_ASSET_LIBRARY/
    READY_UNUSED/
    USED_REFERENCE/
    BLOCKED_DO_NOT_USE/
  02_STYLE_REFERENCES/
    <BRAND_SCOPE>/
  03_HISTORY/
```

Do not duplicate the canonical photo library just to populate the helper workspace. Keep durable OneDrive IDs/usage metadata in Dynamics long term.

## Brand/sub-brand reference rule

A parent client may contain multiple brands. Never mix them in one style-reference feed merely because they sit in one Canva design.

Example Piek scopes:

- `PIEK_GROUP`
- `ENGEN`
- `SASOL`
- `GET_TOGETHER`

For an Engen batch, use Engen references only. Existing Canva pages teach visual grammar and quality bar, not layouts to copy.

## Strategy phase — Wave 0

The staff planning chat begins with the selected client/month/package and may include a voice note/idea from KG, Ger-Marie, CA, Amonique or another authorised staff member.

The planning chat should:

1. read canonical Dynamics client/month/package context;
2. read previous strategy, approvals/rejections and relevant performance;
3. inspect exact brand-scope Canva history;
4. inspect usage history and OneDrive source media;
5. research current seasonal/local/category context when materially useful;
6. decide the monthly marketing mix before designing;
7. map every planned static item to its exact `DP1`, `DP2`, etc. deliverable;
8. assign the canonical production ID;
9. select fresh sources;
10. professionally prepare those sources before generation;
11. build the month Chat Pack and exact prompt.

The first month/client bootstrap is heavier. Every later month should resume from recorded state rather than repeat the entire audit.

## Source preparation rule

The generator/design batch should normally receive professionally edited production derivatives, not untouched raw camera files.

Raw/original remains in the client's normal photo hierarchy.

Prepared derivative example:

`01_SOURCE_EDITED/2026_11_PIEK_DP_01__SRC_EDITED_01.png`

Allowed non-generative prep:

- exposure/highlight/shadow correction;
- white balance/colour correction;
- crop/straightening;
- lens/perspective correction where appropriate;
- clarity/sharpness;
- temporary blemish/fresh scratch/redness cleanup;
- cutout/background cleanup where conceptually required.

Never alter permanent human identity features.

## Monthly Chat Pack

The whole planned month should be packaged together where practical so staff are not repeatedly doing setup work poster-by-poster.

`02_CHAT_PACK` contains:

```text
CHAT_ATTACH/
  edited source image(s) named by stable DP ID
  exact logos / partner assets
  exact relevant style-reference screenshots
PROMPT.txt
MANIFEST.csv
<YYYY_MM_CLIENT>_CHAT_PACK_vNN.zip
```

The ZIP is storage/transport. In the current browser product, staff should also multi-select the actual `CHAT_ATTACH` images into ChatGPT because the internal generator works best with surfaced image attachments.

## Prompt requirements

The monthly prompt must identify each poster by its exact stable ID and define for each:

- brand scope;
- target audience / buying moment;
- one useful proposition;
- intended emotion;
- stop-scroll reason;
- proof/source asset;
- headline/copy direction;
- exact image assignment;
- exact logo/partner requirements;
- design mechanism direction without cloning an old poster;
- intended next thought/action.

Batch-level instructions lock:

- exact brand colours/fonts/logos;
- real-human identity preservation;
- phone readability;
- visual richness/craft;
- no generic AI copy;
- no repeated template skeleton;
- grid balance;
- references are inspiration, not cloning targets.

## Generation — Wave 1

Use the internal image generator as the creative composition engine.

Generate the planned month as a batch where practical. Each item should be visually unique but visibly belong to the same brand system.

Candidate naming:

`YYYY_MM_CLIENT_DP_XX__W1_V01.png`

Wave 1 is internal CG review only. Current browser image generation does not reliably support a hidden `generate -> score -> reject -> regenerate` loop before the first result is surfaced.

## Amendment doctrine

Repeated generative editing can create visual drift and increasingly fake photography. Staff must classify the problem before changing anything.

### A — production correction: Canva/Adobe, no regeneration

Logo, typo, exact font, font size, spacing, brand colour, margin/alignment, small layout nudge.

### B — source-photo correction: return to original source

Crop, exposure, colour, blemish, cutout/background cleanup. Edit the original selected source non-generatively, then recompose if necessary.

### C — creative failure: fresh regeneration from source pack

Weak concept, generic/template-like composition, wrong emotion, wrong visual hierarchy, fundamental design miss.

Keep accepted DPs locked. For only failed DP IDs, reattach the exact original edited source + exact brand refs/logo + revised strategy instruction and generate a new clean candidate. Do not rely on the prior generated bitmap as the sole source.

Candidate naming can advance wave/version, e.g.:

`2026_11_PIEK_DP_03__W2_V01.png`

### D — minor effect change

Prefer a clean Canva/Adobe edit if it avoids regeneration.

## Approval / Canva handoff

Approved flat final:

`YYYY_MM_CLIENT_DP_XX__FINAL.png`

Use Canva for:

- exact typography;
- exact client/partner logos;
- small safe production adjustments;
- editable handoff;
- approval workflow;
- final export variants.

Canva image-to-design / Magic Layers may be useful to convert a strong external flat social design into editable elements. Treat it as a finishing/handoff route, not the primary art-direction generator.

Dynamics stores exact Canva `design_id` + page identity against the same `monthly_deliverables` item.

## Historical bootstrap / freshness

New client onboarding is a one-time audit:

1. inspect Canva POSTED/SCHEDULED history;
2. identify practical source imagery used;
3. match exact/near-duplicate OneDrive sources where possible;
4. record unmatched legacy/external assets honestly;
5. seed used/ready/blocked state;
6. seed the Dynamics media-usage ledger;
7. thereafter record every newly produced item automatically.

Freshness dimensions include exact source, perceptual duplicate, shoot/angle, person, product/service/topic, brand/location, headline/concept and creative mechanism.

## Month-to-month learning

Before each new month, read the previous month and relevant history:

- strategy;
- visual/content mix;
- approvals/rejections/amendments;
- source/person/product usage;
- client feedback;
- Meta/platform performance where available;
- boosted/paid-supported items;
- explicit reuse requests;
- current seasonal/local/category context.

Use performance as evidence, not as the only definition of marketing quality.

## Grid/mobile QA

Review each poster at phone size and the batch as a grid.

Reject when:

- text is too small;
- headline locations repeat mechanically;
- each poster shares the same skeleton;
- one person/product/photo dominates without reason;
- visual effects are repetitive;
- the batch feels random rather than related;
- the work resembles generic AI / PowerPoint / stock Canva;
- the brand is technically correct but there is no creative idea.

## Long-term system targets

Keep challenging the bridge implementation as capabilities improve:

- direct OneDrive/Dynamics image-reference ingestion into ChatGPT image generation;
- programmatic candidate scoring and hidden retry;
- Adobe/Photoshop compositing and exact-photo pipelines;
- Canva exact page insertion and Magic Layers reliability;
- perceptual hashing / vision embeddings for near-duplicate media;
- internal person repetition clustering without public identity naming;
- automatic Dynamics usage-ledger writes;
- Meta/platform creative-performance learning;
- automatic monthly Chat Pack construction;
- exact font/logo compositing;
- unified publish/schedule handoff through canonical Dynamics actions.

The final objective is a sustainable CG production system that improves with every month and remains useful even when a human designer elects to build the poster manually.
