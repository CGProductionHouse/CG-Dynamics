# Graphic Design / Social Poster Lane — Continuation Status

Last updated: 2026-09-09

## Purpose

This file is the durable continuation checkpoint for the CG Production House graphic-design/social-poster system. Any future ChatGPT conversation working on this system should read this file first, then the linked docs in this folder, before asking CA to repeat prior feedback.

The objective is not merely to automate poster output. The objective is to create a repeatable, durable, increasingly intelligent production system that consistently produces work at or above CG Production House standard while reducing repetitive manual design labour.

## Canonical system position

- CG Dynamics remains the operational/source-of-truth layer.
- `monthly_deliverables` remains the Client Schedule truth.
- OneDrive remains the canonical media/file storage authority.
- Canva remains the editable creative-production/finishing workspace and exact-page linkage target.
- ChatGPT is the planning/orchestration/creative assistant layer.
- ChatGPT internal image generation is currently the strongest available creative rendering surface for rich visual design.
- Adobe/Photoshop-style tools should be preferred for non-generative photographic correction, cutouts, retouching and exact human-photo preservation.
- Normal browser ChatGPT must remain a viable staff workflow. Work mode must not become a requirement.

## Core CA quality lock

The system must never optimise for speed at the expense of client value. The output must feel like a person cared, researched, planned and designed it deliberately.

Required standard:

- every poster has a reason to exist;
- strategy precedes design;
- copy has a clear audience, purpose and intended emotional/behavioural result;
- no vague AI filler such as generic “elevate your experience” language;
- headlines must make sense instantly, earn attention and feel human;
- client-owned photography is preferred over generated replacement imagery;
- exact client logos are always used as source assets and are never regenerated or reinterpreted;
- real people must remain recognisably and faithfully themselves;
- permanent/identity-defining facial/body features are never changed;
- temporary photographic blemishes may be cleaned only to normal professional-retouching standard;
- every selected source photo should already be professionally corrected before it enters poster production;
- current brand fonts, colours, gradients, effects, density, masking behaviour and general visual grammar should be learned from the exact brand/sub-brand’s existing Canva work;
- references are for visual grammar, not cloning old layouts;
- posters in one month must feel individually art-directed rather than generated from one repeated template;
- the monthly set must be reviewed together as a mobile Instagram grid;
- heading placement, composition, crop and visual mechanism should vary across the set;
- phone-first readability is mandatory;
- a successful generation is not automatically an acceptable design;
- the system must improve from approvals, rejections, amendments, publishing results and future performance data.

## Production-quality lesson from the first Piek/Engen pilot

The first poster pilot used deterministic/Python-style composition and produced work CA described as looking like Word/PowerPoint design. That rendering route is NOT the preferred creative-production path for social posters.

Use deterministic layout/rendering only for support material such as contact sheets, manifests, QA boards or exact production utilities. For rich poster design, prefer the internal image generator with tightly controlled real source assets and exact reference material, followed by non-generative finishing where required.

## Current image-generation reality

The internal image generator is generative. Even when given a real photo as reference, it may reconstruct pixels. Therefore:

- do not assume pixel-lock preservation of a real human;
- where the person must remain exact, preserve the source photo as the real photographic layer and use non-generative editing/compositing around it where possible;
- do not trust generated logos or typography as production truth;
- exact logo and exact type should be corrected/placed in Canva or Adobe when necessary;
- the generator is used for the high-value creative composition, effects, masking, depth, texture, lighting treatment and ad direction, not as the final authority for exact identity assets.

Current connector limitation discovered in this pilot: images fetched from OneDrive through the connector do not automatically become eligible image-edit references in the internal image generator. For the launch-now workflow, the exact monthly visual inputs must therefore be surfaced as actual chat attachments. The monthly pack includes a `CHAT_ATTACH` set for this purpose.

## Canonical content-type and naming lock

CG Dynamics already recognises these content types:

- `DP` = Designed Poster
- `F` = Photo
- `Video`
- `Reel`

`DP`, `F`/`PHOTO` must be numbered in Client Schedule identity parsing. Video/Reel have some existing support for unnumbered legacy/import cases, but future production should still prefer canonical numbered identities where the package defines a slot.

The stable human-readable production ID for poster work is:

`YYYY_MM_CLIENT_DP_XX`

Example:

`2026_11_PIEK_DP_01`

Equivalent cross-media grammar:

- `YYYY_MM_CLIENT_DP_XX`
- `YYYY_MM_CLIENT_F_XX`
- `YYYY_MM_CLIENT_VIDEO_XX`
- `YYYY_MM_CLIENT_REEL_XX`

The immutable `monthly_deliverables.id` remains the database identity. The readable production ID is a stable file/workflow identity.

A posting date is NOT embedded in the stable production ID because dates may move while the package slot remains the same.

For multi-brand clients, preserve the canonical client code and store brand/sub-brand separately. Example:

`2026_11_PIEK_DP_01__ENGEN_SUMMER_PLANS.png`

Here `PIEK` is the client identity; `ENGEN` is the brand scope.

## Canonical OneDrive poster production path

Poster production mirrors the video year/month system:

`Clients/<Client>/Posters/<YYYY>/<YYYY_MM_MON>/`

Current canonical month production stages:

```text
00_MONTH_PLAN/
01_SOURCE_EDITED/
02_CHAT_PACK/
03_WAVE_1/
04_AMENDMENTS/
05_APPROVED/
06_CANVA_HANDOFF/
07_ARCHIVE/
```

The helper/system workspace remains separate:

```text
Clients/<Client>/CG Creative Assistant/
  00_SYSTEM/
  01_ASSET_LIBRARY/
    READY_UNUSED/
    USED_REFERENCE/
    BLOCKED_DO_NOT_USE/
  02_STYLE_REFERENCES/
    <BRAND_SCOPE>/
  03_HISTORY/
```

`CG Creative Assistant` is NOT a second poster archive. Canonical monthly work lives under `Posters/<YYYY>/<YYYY_MM_MON>/`.

## Month naming rule — clarified

The existing production system has historical language drift in month abbreviations. Piek Group’s live 2026 video folders include `2026_03_MRT`, while older/current documentation and other folders also use English month abbreviations such as `MAR`, `AUG`, `SEPT`.

Do NOT silently bulk-rename historical folders.

For future app-generated poster production, Dynamics should use one configured canonical month-token table and generate the folder name automatically. Until the app-level standard is formally ratified across all media, poster production should follow the exact canonical token configured for that client/system rather than staff typing month abbreviations manually.

The important invariant is the machine-readable `YYYY_MM` prefix; the human month token is display/operational convenience and must never be used as the sole identity key.

## Month-to-month operating model

This is a recurring monthly production system, not a one-off pack.

For each active client/month:

1. Read current Dynamics client truth and the exact month’s `monthly_deliverables`.
2. Read previous month strategy, approved/rejected creative notes and relevant performance.
3. Resolve package slots (`DP1`, `DP2`, etc.) and assign stable production IDs.
4. Separate strategy by exact brand/sub-brand where the client has multiple visual systems.
5. Audit recent/historical Canva work for the exact brand scope.
6. Audit the usage ledger/OneDrive for exact-photo, near-duplicate, person, product/service/topic and concept repetition.
7. Select fresh real client source media.
8. Create non-destructive professionally edited derivatives in `01_SOURCE_EDITED`.
9. Build the month’s `02_CHAT_PACK` with only the exact assets needed for that brand scope.
10. Generate the month as a batch where practical, while each DP retains its own strategy and identity.
11. Save first candidates in `03_WAVE_1`.
12. Review individually and as a mobile grid.
13. Route changes through the revision doctrine rather than repeatedly degrading generated images.
14. Finalise exact logo/font/copy/colour production details in Canva/Adobe.
15. Link the exact Canva design/page to the matching Dynamics deliverable.
16. Record source usage, approval, schedule/post state and later performance.
17. The next month begins from this durable state instead of restarting research from zero.

## Historical bootstrap / no-repeat system

For every client/brand scope being onboarded to this system, perform a one-time historical bootstrap:

1. Inspect Canva’s actual `POSTED / SCHEDULED` history and recent active work.
2. Capture/select the relevant previous poster pages as visual records.
3. Match poster imagery back to OneDrive where possible using exact filename/hash and perceptual similarity.
4. Record unmatched historical visuals as used-reference evidence even if the original source file is no longer in OneDrive.
5. Build usage memory across:
   - exact image;
   - near-duplicate/burst/same-shoot group;
   - person;
   - product/service/topic;
   - creative concept/headline;
   - visual mechanism/layout family.
6. From that point forward, every newly produced deliverable writes its source usage into the same ledger.

Reusing a photo is allowed only with a deliberate reason, for example:

- client specifically requests it;
- no viable alternative exists for the exact communication need;
- enough time has passed and the concept is materially reinterpreted;
- the same source is essential evidence/documentation.

The reuse reason should be recorded.

## Style-reference rule for multi-brand clients

Never feed mixed brand references into one generation pack.

For Piek Group, maintain separate style scopes such as:

- `PIEK_GROUP`
- `ENGEN`
- `SASOL`
- `GET_TOGETHER`

The client may share operational ownership while each brand keeps its own creative grammar, caption tone, visual references and marketing logic.

When preparing an Engen pack, include Engen references only unless a deliberate Piek corporate element is required.

## Source-photo prep standard

A source inside `01_SOURCE_EDITED` is production-ready, not raw.

Allowed non-generative prep:

- exposure/highlight/shadow correction;
- white balance/colour correction;
- tasteful contrast, clarity and sharpness;
- crop/straightening;
- lens/perspective correction;
- local tonal cleanup;
- temporary blemish/fresh scratch/redness cleanup where appropriate;
- background cutout/cleanup if needed by the design.

Never alter identity-defining human features. Never beautify a person into a different person.

Raw originals remain in the client’s normal Photos hierarchy. `01_SOURCE_EDITED` contains non-destructive derivatives linked back to those originals.

## Strategy gate before visual production

Each DP needs, at minimum:

- target audience;
- communication problem/opportunity;
- objective;
- single main proposition;
- intended emotion/reaction;
- reason to stop scrolling;
- proof/supporting fact;
- intended action/CTA;
- season/local/current relevance if applicable;
- fresh-vs-repeated topic check;
- selected source rationale;
- brand scope;
- references/style notes.

If the headline cannot answer “why are we saying this, to whom, and what should they feel/do afterwards?”, it is not ready for design.

## Batch-generation rule

The monthly batch may contain many posters in one ChatGPT image-generation session, but each DP must have its own labelled source set and brief.

The generator should be told explicitly:

- use only the named source(s) for that DP;
- do not swap people/products between deliverables;
- do not reinterpret logos;
- do not reuse one composition across the batch;
- maintain brand grammar while varying layout, headline position, crop, depth, effect and visual mechanism;
- preserve phone-first readability;
- output each DP as a separate identified design.

Batching is for efficiency, not template repetition.

## Revision doctrine — locked

### A. Production correction — do NOT regenerate

Examples: typo, exact font, logo replacement, colour value, spacing, margin, small alignment/layout nudge.

Fix in Canva/Adobe.

### B. Source-photo correction — return to original source

Examples: crop, exposure, blemish, colour, cutout/background cleanup.

Edit the selected original/edited derivative non-generatively. Do not keep editing a model-reconstructed person.

### C. Creative/composition failure — regenerate from scratch

Examples: weak concept, generic visual, wrong hierarchy, wrong emotion, wrong composition.

Lock all approved posters. For only the failed DP ID(s), restart from:

- original edited source(s);
- exact logo assets;
- exact relevant style references;
- original strategy;
- explicit correction delta.

Do not recursively regenerate from the previous generated bitmap as the sole source.

### D. Minor visual effect amendment

Prefer Canva/Adobe when the change can be made safely and cleanly. Regeneration is not the default for tiny production corrections.

## Wave workflow

`WAVE_1` means internal candidate generation, not “approved”.

Recommended flow:

- `03_WAVE_1` — first generated/design candidates;
- batch review — individually + mobile grid;
- approved candidates move to `05_APPROVED` after production corrections;
- failed creative candidates are listed in `04_AMENDMENTS` with a short correction delta and regenerated from source as Wave 2/new candidate;
- minor production corrections are performed in Canva/Adobe without creative regeneration;
- never overwrite/lose a previously approved candidate.

## Canva relationship

Canva remains important but is not the primary creative-thinking engine in the launch-now system.

Use Canva for:

- exact client fonts;
- exact logos;
- exact brand colours;
- editable text/copy;
- small composition corrections;
- production variants/export;
- client/staff editing;
- existing `In Progress → To Be Approved → Drafts → Posted/Scheduled` visual workflow;
- exact Canva design/page linkage back to Dynamics.

Where Canva image-to-design/Magic Layers can reliably convert an external flat poster into editable layers, it is worth testing as a handoff accelerator. Do not assume fidelity until proven.

## Performance-learning direction

Long term, strategy for each new month should inspect the prior month’s actual results where available through canonical Meta/Dynamics data.

Useful learning signals:

- reach/views;
- interactions;
- saves/shares/comments where available;
- click/conversion/boost relevance where available;
- client-requested boosts;
- unusually strong or weak poster performance;
- client approval/revision patterns;
- creative mechanism and topic associated with that performance.

Performance is evidence, not a command to clone the winner. The system should learn which topics, people, messages and creative mechanisms resonate while preserving freshness.

## Staff / ChatGPT project model

The planning chat should live in the relevant staff/client ChatGPT project and retrieve live Dynamics truth rather than relying on mutable chat memory.

Example flow:

- staff gives a voice note with ideas for November;
- ChatGPT reads Dynamics/client knowledge/schedule + previous strategy/performance + OneDrive + Canva history;
- ChatGPT creates the strategy and selects sources;
- ChatGPT prepares edited source assets + exact monthly Chat Pack + prompt in OneDrive;
- staff opens a normal ChatGPT image-generation chat, attaches the prepared `CHAT_ATTACH` files and prompt, and generates the batch;
- outputs move into the Wave system;
- Dynamics/OneDrive/Canva history makes the next month a continuation rather than a restart.

## Immediate implementation status

- Draft PR: #312 `Graphic design / social poster production lane`.
- Branch: `feat/graphic-design-social-poster-lane`.
- Documentation-only lane; no app runtime/schema/deploy changes are being made here without a later explicit implementation decision.
- Existing CG Dynamics issue #220 remains the canonical unified content-production direction for Canva exact-page linkage/approval/publishing.
- Existing issue #225 remains the canonical OneDrive naming-enforcement direction for production folders.
- Existing issue #224 remains the canonical AI content-strategy/content-run grounding direction and provides useful architecture principles for exact-client truth, approved CG knowledge and fresh research.
- Existing issue #308 remains the private ChatGPT ↔ Dynamics access direction.

## Current next work

Before calling the system “ready for laptop pilot”:

1. complete the Piek/Engen historical style-reference bootstrap with brand-scope separation;
2. prepare a true November multi-DP month plan using stable `YYYY_MM_CLIENT_DP_XX` IDs;
3. ensure each selected source has an edited production derivative and provenance;
4. produce the final `CHAT_ATTACH` + prompt/manifest pack;
5. test the internal image generator on the batch using the new strategy rules;
6. evaluate results as both individual posters and a grid;
7. record failed/approved candidate reasoning;
8. refine SOP only from observed failure modes, not theory;
9. later design the minimal Dynamics schema/tool contracts for the usage ledger and production-ID automation without creating a second schedule.

## Non-negotiable continuation rule

Future chats must read this file and the current PR #312 docs before asking CA to repeat the system, naming, human-photo rules, creative-standard feedback or launch-now workflow.
