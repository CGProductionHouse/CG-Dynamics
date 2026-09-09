# Launch-now browser-chat graphic design workflow

Last updated: 2026-09-09
Status: working bridge system for immediate rollout while the deeper Dynamics integration is built.

## Why this exists

The highest-quality design surface currently available in normal ChatGPT browser chat is the internal image generator, not the Python/layout route and not Canva's own AI generation. The launch-now system therefore packages the right inputs so the internal generator is constrained by real client assets, real strategy and recent CG design references.

This is deliberately a bridge workflow, not the end state.

## Core operating principle

Use AI for creative composition, not for inventing client truth.

The production split is:

- **CG Dynamics**: strategy, monthly package slot, client truth, usage ledger, approvals and later performance learning.
- **OneDrive**: canonical client photography/brand assets plus a staff-friendly `CG Creative Assistant` workspace.
- **ChatGPT internal image generation**: high-design art direction, composition, effects, gradients, texture, visual play and concept exploration.
- **Adobe/Photoshop-style tools**: crop, colour, retouching, cutouts and other precision edits where the real photograph/identity must remain exact.
- **Canva**: exact typography, exact logos, editable finishing, staff amendments, Magic Layers / image-to-design where useful, approval handoff and current creative history.

Do not use Python-layout rendering as the main creative route for high-love social posters.

## Important generative limitation

The internal image generator is generative. Reference images guide the output, but the model can reconstruct pixels. Therefore:

- do not trust it to preserve a real staff member or logo pixel-for-pixel merely because they were supplied as references;
- do not trust generated typography as production typography;
- do not let the model redraw client logos;
- where identity matters, preserve the real human photo as an exact imported/composited layer or use non-generative editing;
- use the generator heavily for the surrounding art direction, background, graphic effects, depth and visual system.

## Current browser-chat attachment reality

A ZIP is useful for OneDrive storage, handoff and portability, but **do not rely on attaching only the ZIP to the browser chat when the internal image generator needs visual references**. The image generator works best when the required images are surfaced as actual image attachments in the conversation.

Therefore every monthly `00_INPUT_PACK` should contain both:

- the packaged ZIP; and
- a `CHAT_ATTACH/` folder containing the individual images staff should multi-select into ChatGPT.

The staff launch action is:

1. open the month's `CHAT_ATTACH/` folder;
2. multi-select the exact photos/logo/reference screenshots and attach them to the normal ChatGPT conversation;
3. paste/upload the separate prompt text;
4. generate the batch.

If future ChatGPT versions can reliably unpack a ZIP directly into the image-generation reference surface, this manual multi-select step can be removed.

## Current QA limitation

In the current browser-chat image generation flow, ChatGPT cannot reliably run a hidden multi-step loop of `generate -> inspect -> reject -> regenerate` before the user sees the first result. The image-generation response is surfaced as the result of that turn.

Mitigation for launch-now:

1. improve the generation pack and prompt quality so the model is tightly constrained;
2. generate multiple deliberately varied candidates when appropriate;
3. treat Wave 1 as internal CG review, not client approval;
4. use the next chat turn for explicit QA/revision where needed;
5. continue researching a future generation/editing surface that supports programmatic candidate scoring and retry before delivery.

## Per-client OneDrive workspace

Working folder: `CG Creative Assistant` under the client folder.

Recommended structure:

```text
CG Creative Assistant/
  00_SYSTEM/
  01_ASSET_LIBRARY/
    READY_UNUSED/
    USED_REFERENCE/
    BLOCKED_DO_NOT_USE/
  02_MONTHLY_PACKS/
    CLIENT-SUBBRAND_YYYY-MM/
      00_INPUT_PACK/
        CHAT_ATTACH/
      01_PROMPT/
      02_WAVE_1/
      03_AMENDMENTS/
      04_APPROVED/
      05_CANVA_HANDOFF/
      06_ARCHIVE/
  03_HISTORY/
```

Canonical originals should remain in their normal client folders. The assistant workspace is a curated working layer and usage aid, not a replacement media library.

## New-client bootstrap audit

This is a one-time task per onboarded client:

1. inspect the existing Canva marketing design, especially POSTED/SCHEDULED history;
2. record all practical historic poster pages and the source images used;
3. match exact and near-duplicate images to OneDrive where possible;
4. record unmatched legacy/external images rather than guessing;
5. classify known media as USED_REFERENCE / BLOCKED / READY_UNUSED;
6. seed the Dynamics usage ledger;
7. thereafter record every new poster automatically.

## Freshness model

Track at least:

- exact source file/item ID;
- perceptual/near-duplicate group;
- shoot/burst/angle group;
- people depicted;
- product/service/topic;
- headline/concept;
- creative mechanism/layout;
- last-used date;
- poster/package slot;
- Canva design/page;
- platform/publish record;
- reuse reason when applicable.

Exact filename matching is insufficient. The system should later use perceptual image fingerprints / embeddings plus human-reviewed metadata to catch crops, burst shots and repeated people/scenes.

## Monthly Chat Pack

For each batch, build:

- one ZIP for storage/transport;
- one `CHAT_ATTACH/` folder containing the exact individual visual attachments;
- one separate prompt text file.

The package should contain:

```text
inputs/
  exact client/source photos
  exact logos / partner logos
  any approved graphic assets
references/
  3-6 recent strong CG/Canva poster screenshots
  optional grid/contact sheet
MANIFEST.csv
```

References are inspiration only. They teach the current brand grammar and quality bar but must not be copied.

The separate prompt contains:

- exact client/sub-brand/month;
- strategy gate;
- poster names / Dynamics slots;
- headline direction;
- source photo assignment per poster;
- emotional objective / audience / buying situation;
- locked brand rules;
- no-regenerated-logo rule;
- human identity rule;
- exact typography rule;
- mobile-first rule;
- batch/grid diversity rule;
- instruction to avoid generic AI copy and generic Canva-template composition.

## Universal naming

`CLIENT-SUBBRAND_YYYY-MM_P##_SHORT-TOPIC`

Example:

`PIEK-ENGEN_2026-11_P01_SUMMER-PLANS`

`P##` maps to the exact recurring package slot. `X##` is reserved for once-off work outside the package.

The same stable name should follow the poster through:

- generation pack;
- Wave 1 candidate;
- approved export;
- Canva design/page where practical;
- Dynamics schedule item;
- media-usage ledger;
- publish/schedule record.

## Wave workflow

### 00_INPUT_PACK
Exact generation inputs, packaged ZIP, `CHAT_ATTACH/` images and manifest.

### 01_PROMPT
Exact normal-browser-chat prompt.

### 02_WAVE_1
First candidates worth internal CG review. This is not client approval.

### 03_AMENDMENTS
Revisions / alternates / corrected typography or compositing.

### 04_APPROVED
CG-approved flat finals.

### 05_CANVA_HANDOFF
Editable Canva versions, links, exact final naming, final fonts/logos and any staff-adjustable copy.

A useful current Canva capability is image-to-design / Magic Layers: a strong flat social design produced outside Canva can be converted into editable Canva elements. Treat this as a finishing/handoff mechanism rather than the primary creative generator.

### 06_ARCHIVE
Rejected or superseded files retained only when useful for audit/learning.

## Content-strategy gate before image generation

Every poster must answer:

1. Who exactly are we speaking to?
2. What real buying/use situation are we entering?
3. What is the one useful proposition?
4. Why should anyone stop scrolling?
5. What should they feel?
6. What visual/client truth proves the message?
7. What should they think/do next?
8. Why is this relevant now in this month/place/context?

Use the existing CG marketing research model:

`Business objective -> buying situation -> audience/problem -> single-minded proposition -> proof -> distinctive brand signals -> creative idea -> platform execution -> exposure/memory -> action -> verified outcome`

Do not skip directly from client facts to a headline/design.

## Typography and logo strategy

The internal generator can create richer visual systems, but final typography must not depend on AI-rendered letters when the result contains distortion, strange texture or incorrect brand fonts.

Preferred launch-now approach:

- generator builds the high-design composition and creates clean intentional text zones;
- exact Sora/Inter or client-specific typography is applied in Canva/Adobe as a finishing layer;
- exact client/partner logos are imported afterward as original assets;
- any generator output containing distorted/incorrect logo text is rejected or covered/rebuilt, never accepted as final.

This is not a downgrade in design quality: the generator remains responsible for the visual idea, effects, composition, masks, texture, depth, gradients and energy; Canva/Adobe provide exact production typography and locked assets.

## Grid QA

Before a monthly batch is approved, view the posters together.

Reject the batch if:

- headline locations repeat mechanically;
- every poster uses the same template skeleton;
- the same photo/person/service dominates without reason;
- crops and visual mechanisms feel repetitive;
- the grid feels randomly inconsistent;
- the work looks like three variants generated from one prompt rather than three individually art-directed ads.

Consistency comes from brand assets, palette, typography, tone and quality — not repeated layout.

## Long-term research / build targets

The bridge system must be challenged continuously. Track improvements in:

- multimodal generators/editors with programmatic image-reference inputs;
- Adobe/Photoshop compositing and generated-fill workflows;
- Canva APIs / Magic Layers / exact page insertion;
- Illustrator / InDesign automation where useful;
- perceptual-hash and vision-embedding media deduplication;
- face/person clustering used only for internal repetition tracking, not identity naming;
- automatic Dynamics usage-ledger writes;
- Meta/platform performance ingestion and creative-performance comparison;
- hidden candidate QA/scoring/retry before staff see outputs;
- exact font/logo compositing pipelines;
- automatic monthly generation-pack creation from Dynamics + OneDrive + Canva.

The future goal is not to preserve today's workflow. It is to preserve CG's quality standard while replacing manual friction as AI capabilities improve.

## Piek / Engen pilot implementation

A real OneDrive pilot workspace now exists at:

`Clients/Piek Group/CG Creative Assistant/`

and the November monthly pack structure exists at:

`Clients/Piek Group/CG Creative Assistant/02_MONTHLY_PACKS/PIEK-ENGEN_2026-11/`

The first Chat Pack, manifest, prompt and individual `CHAT_ATTACH/` source files are stored there. The remaining v1 gap is adding 3-6 physical screenshots of selected recent Piek Canva posters into `CHAT_ATTACH/` / the ZIP before the pack is considered fully ready for the internal image generator.
