# Graphic Design / Social Poster Lane — Continuation Status

Last updated: 2026-09-09
Branch: `feat/graphic-design-social-poster-lane`
Draft PR: #312

## Purpose

This is the durable continuation checkpoint for the CG Production House graphic-design/social-poster system. Future ChatGPT conversations must read this file and the linked docs before asking CA to repeat prior feedback.

The objective is not merely to automate poster output. The objective is a repeatable, durable production system that consistently produces work at or above CG Production House standard while reducing repetitive manual design labour and giving designers more time for creative work.

Routine production must remain viable in normal browser ChatGPT. Do not make Work mode a requirement.

## Read these first

1. `docs/graphic-design/creative-strategy-gate.md`
2. `docs/graphic-design/poster-onedrive-naming-standard.md`
3. `docs/graphic-design/asset-usage-ledger.md`
4. `docs/graphic-design/monthly-chat-pack-contract.md`
5. `docs/graphic-design/staff-poster-production-sop.md`
6. `docs/graphic-design/launch-now-chat-pack-workflow.md`
7. `docs/graphic-design/pilots/piek-engen-november-2026.md`

## Canonical system position

- **CG Dynamics** remains the operational/source-of-truth layer.
- `monthly_deliverables` remains the Client Schedule/package truth.
- **OneDrive** remains canonical media/file storage authority.
- **Canva** remains creative history, exact production/editable finishing and exact-page linkage target.
- **ChatGPT** is the planning/orchestration/creative-assistant layer.
- **Internal image generation** is currently the strongest creative rendering surface for rich poster art direction.
- **Adobe/Photoshop-style tooling** is preferred for non-generative photographic correction, cutout, retouching and fidelity-sensitive real-human/photo work.
- **Normal browser ChatGPT** remains the launch-now staff interface.

Operating chain:

`Dynamics deliverable + client intelligence -> history/performance -> Canva brand scope -> OneDrive freshness -> professional source edit -> monthly Chat Pack -> internal image generation / human design -> Wave QA -> classified amendment -> Canva/Adobe production finish -> exact Canva page -> approval/schedule/post -> usage + learning back to Dynamics`

## Core CA quality lock

The system must never optimise speed at the expense of client value.

Required standard:

- every poster has a reason to exist;
- strategy precedes design;
- copy has a clear audience, purpose and intended emotional/behavioural result;
- no vague AI filler (`elevate your experience`, generic `trusted partner`, vague `human` claims etc.);
- headlines must make sense instantly and explain their marketing job without a paragraph of interpretation;
- client-owned photography is preferred over generated replacement imagery;
- exact client/partner logos are source assets and are never accepted as regenerated/reinterpreted production logos;
- real people remain faithfully themselves;
- permanent/identity-defining human features are not changed;
- temporary photographic blemishes may be cleaned only to normal professional-retouching standard;
- selected source photography is professionally corrected before poster production;
- brand fonts, colours, gradient/effect language, masking behaviour and overall visual grammar are learned from the exact brand/sub-brand's Canva work;
- references teach grammar, not layouts to clone;
- external advertising/editorial research may add freshness/mechanisms without redesigning the brand;
- monthly posters are individually art-directed, not one repeated template;
- the set is reviewed together as a phone-size Instagram grid;
- heading position, composition, crop, visual mechanism, density and light/dark balance vary deliberately;
- a successful render is not automatically acceptable design;
- the system learns from approvals, rejections, amendments, posting and performance.

## Lesson from first Piek/Engen pilot

The first poster pilot used deterministic/Python-style composition and produced work CA described as Word/PowerPoint-like. That route is **not** the primary social-poster creative engine.

Use deterministic rendering for support utilities such as manifests, contact sheets, QA boards and precise production helpers.

For high-love graphic design, prefer internal image generation with tightly controlled real sources/references, then deterministic Canva/Adobe fidelity finishing.

## Current image-generation reality

Internal image generation is generative. Even with a real photo reference, pixels may be reconstructed.

Therefore:

- do not assume pixel-lock preservation of a real human;
- preserve the real photographic source/layer wherever identity fidelity matters;
- use non-generative Adobe/Photoshop-style editing for crop/tone/cutout/retouch when possible;
- do not trust generated logos or lettering as production truth;
- exact logos and exact typography are verified/replaced in Canva/Adobe;
- use the generator for the high-value visual thinking: composition, effects, masks, depth, scale, hierarchy, texture, lighting and advertising mechanisms.

A two-pass production model is now locked:

1. **Creative composition pass** — internal image generation (or human designer).
2. **Fidelity/production pass** — Canva/Adobe exact logo, font, copy, colours and photo fidelity.

An excellent generated composition may pass creative approval while still needing deterministic logo/type replacement. It does not pass production approval until exact assets are checked.

Current connector limitation: OneDrive connector-fetched images do not reliably become direct internal-image-generator references. Launch-now workaround = monthly `CHAT_ATTACH` visual files surfaced as actual normal-chat attachments.

## Canonical content type / naming lock

CG Dynamics existing types:

- `DP` = Designed Poster
- `F` / `PHOTO` = Photo
- `Video`
- `Reel`

Existing import logic requires recurring `DP` and `F/PHOTO` schedule identities to be numbered (`DP1`, `DP2`, `F1`, etc.). A production poster must resolve to an exact existing numbered `monthly_deliverables` slot before receiving its stable file identity.

Stable poster production ID:

`YYYY_MM_CLIENT_DP_XX`

Example:

`2026_11_PIEK_DP_01`

Equivalent production grammar:

- `YYYY_MM_CLIENT_DP_XX`
- `YYYY_MM_CLIENT_F_XX`
- `YYYY_MM_CLIENT_VIDEO_XX`
- `YYYY_MM_CLIENT_REEL_XX`

Rules:

- immutable `monthly_deliverables.id` remains the database key;
- readable production ID is the stable human/file workflow identity;
- `CLIENT` comes from configured `clients.short_code` / canonical mapping;
- `XX` is zero-padded package instance;
- posting date is separate because it may change;
- sub-brand/branch is metadata, not a replacement client code.

Example:

```text
stable_production_id = 2026_11_PIEK_DP_01
brand_scope = ENGEN
branch_location = NORTHRIDGE
```

Optional descriptive suffix:

`2026_11_PIEK_DP_01__ENGEN_SUMMER_PLANS.png`

## Canonical new month-token rule

For newly created production folders use English three-letter tokens:

`JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC`

Historical OneDrive folders contain drift such as `MRT` and `SEPT`. Do not infer future standards from that drift and do not silently bulk-rename history.

Existing/historical resolution must list actual children and use durable OneDrive item IDs/mappings. Readable folder names help staff; durable storage identity is the machine truth.

Piek's empty pilot-created September poster folder was corrected from `2026_09_SEPT` to `2026_09_SEP`; historical folders elsewhere were not changed.

## Canonical OneDrive poster production

Poster tree:

`Clients/<Client>/Posters/<YYYY>/<YYYY_MM_MON>/`

Month stages:

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

Helper workspace remains separate:

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

`CG Creative Assistant` is not a second poster archive. Canonical production stays under `Posters`.

## Historical bootstrap / no-repeat system

Every client entering the lane gets a one-time bootstrap:

1. resolve exact client + brand scopes;
2. inspect Canva `POSTED / SCHEDULED` and useful approved history;
3. catalogue hero/support images, visible people, product/service/topic, branch, headline/concept and creative mechanism;
4. match media back to canonical OneDrive with durable IDs/exact hash/perceptual similarity/burst grouping/visual review;
5. preserve uncertainty (`legacy_external`, `unresolved`) instead of inventing provenance;
6. seed Dynamics usage memory + practical human helper state.

Freshness dimensions:

- exact source;
- crop/re-export duplicate;
- burst/near-duplicate/shoot angle;
- same visible person;
- product/service/topic;
- branch/location;
- headline/concept;
- creative mechanism/layout family;
- last use;
- reuse reason.

Do not build a hidden biometric identity database. Use staff/client-provided person tags when needed; ChatGPT may flag repeated visible people without naming them.

Reuse requires an explicit defensible reason (client request, campaign continuity, seasonality, meaningful separation, unique proof value, etc.).

Freshness has three independent layers:

1. message novelty;
2. media novelty;
3. execution/mechanism novelty.

## Strategy gate — locked

Every DP requires:

```text
Business objective
Buying situation / real moment
Audience
Audience tension/need/desire
Primary content role
Single-minded proposition
Proof / reason to believe
Desired emotional response
Desired next thought/action
Current month/place relevance
Distinctive brand assets
Source/media requirement
Creative mechanism
Headline candidates
Recent concepts/people/products/mechanisms to avoid
One-sentence reason this poster deserves to exist
```

Internal poster-job sentence:

> This poster is for **[specific audience/moment]**, and after seeing it we want them to **[feel/think/do one thing]** because **[specific client truth/proof]**.

If that sentence is weak, do not design yet.

Kill a headline if it is abstract, interchangeable, technically true but strategically pointless, unsupported by the visual, or requires explanation.

The words and visual should ideally need each other. A generic line + generic photo + client logo is not client-specific advertising.

## Style-reference isolation

Never feed mixed sub-brand references simply because they share a parent Canva design/account.

Piek scopes:

- `PIEK_GROUP`
- `ENGEN`
- `SASOL`
- `GET_TOGETHER`

Current helper path:

`Clients/Piek Group/CG Creative Assistant/02_STYLE_REFERENCES/<BRAND_SCOPE>/`

A generation pack should normally use 3–6 deliberately selected references from the correct scope only.

Teach:

- type behaviour;
- colour balance;
- gradients/effects;
- masking/cutouts;
- photography treatment;
- density/negative space;
- logo attribution;
- craft/quality.

Do not clone old layouts.

## Source-photo prep standard

A source in `01_SOURCE_EDITED` is production-ready, not raw.

Filename example:

`2026_11_PIEK_DP_01__SRC_EDITED_01.png`

Allowed non-generative prep:

- exposure/highlight/shadow;
- white balance/colour;
- tasteful contrast/clarity/sharpness;
- crop/straightening;
- lens/perspective correction;
- temporary blemish/fresh scratch/redness cleanup;
- cutout/background cleanup if conceptually required.

Raw originals remain in canonical Photos hierarchy and the derivative retains provenance to the original OneDrive item.

Adobe was tested on a real Engen staff photo during this pilot: subject handling + professional tonal correction preserved the person and validates the intended fidelity-safe source-prep route.

## Monthly Chat Pack contract — locked

Durable interface doc:

`docs/graphic-design/monthly-chat-pack-contract.md`

Launch-now structure:

```text
02_CHAT_PACK/
  CHAT_ATTACH/
    SOURCES/
    LOGOS/
    STYLE_REFERENCES/
    OPTIONAL_SUPPORT/
  PROMPT.txt
  MANIFEST.csv
  QA_NOTES.txt
  YYYY_MM_CLIENT_CHAT_PACK_vNN.zip
```

The ZIP is storage/transport. Staff also attach the actual visual files from `CHAT_ATTACH` into the normal ChatGPT image-generation chat.

Every DP manifest row explicitly maps:

- stable ID + `monthly_deliverable_id`;
- brand scope/branch;
- strategy/job;
- source file(s) + OneDrive provenance;
- logo assets;
- style-reference scope;
- headline direction;
- creative mechanism;
- repetition/avoidance notes;
- reuse reason if any.

The image-generation chat must never infer which photo belongs to which DP from file order.

## Batch generation rule

Batch the month where practical to reduce setup work, but every DP keeps its own source set and strategy.

Generator instruction must prevent:

- swapping people/products between deliverables;
- reinterpreting logos;
- cloning one composition repeatedly;
- tiny phone-unreadable typography;
- mixed sub-brand grammar;
- unsupported factual claims.

Batching is efficiency, not templating.

## Revision/amendment doctrine — locked

Do not recursively regenerate the same bitmap for every amendment.

### `PRODUCTION_FIX`

Logo, typo, exact font, spacing, colour, small alignment -> Canva/Adobe; no regeneration.

### `SOURCE_FIX`

Crop, tone, temporary blemish, cutout, photo fidelity -> return to original source and edit non-generatively.

### `CREATIVE_RESTART`

Weak/generic concept, wrong strategy expression, wrong hierarchy/emotion, repeated template mechanism, fundamental composition miss -> restart only that DP from:

- exact original edited source(s);
- exact logo/asset set;
- exact relevant style references;
- original strategy;
- explicit correction delta.

Do not use the failed generated bitmap as the sole new source.

### `EFFECT_FIX`

Small gradient/glow/mask/effect issue -> Canva/Adobe if cleanly possible.

Accepted DP IDs stay locked. Only failed DP IDs advance to a new Wave.

Correction delta example file:

`2026_11_PIEK_DP_03__W2_DELTA.txt`

It records what failed, why, what must remain, what must change and what must not be copied from the failed candidate.

## Approval-state distinction

Creative approval is not production approval.

Suggested sequence:

- `wave_1_review`;
- `creative_approved`;
- `production_finishing`;
- `production_approved`;
- `client_approved`;
- `scheduled`;
- `posted`.

Only `production_approved` or later means exact logo/font/copy/source fidelity has been verified.

## Month-to-month learning

Before each new month read:

- prior strategy and monthly mix;
- approved/rejected creatives;
- amendment reasons;
- media/person/product/service/branch use;
- Canva finals;
- client feedback;
- boosted/paid-supported items;
- relevant Meta/platform performance;
- enquiries/verified outcomes where available;
- current season/local/category context.

Performance is evidence, not a command to clone the previous winner.

## Current Piek / Engen November identifiers

- `2026_11_PIEK_DP_01` — `brand_scope=ENGEN` — seasonal/local movement;
- `2026_11_PIEK_DP_02` — `brand_scope=ENGEN` — human/service;
- `2026_11_PIEK_DP_03` — `brand_scope=ENGEN` — convenience/quick-stop.

Current working hooks are **provisional**, not approved:

- `BLOEM'S HEATING UP. SO ARE THE PLANS.`
- `THE FACE YOU WANT TO SEE WHEN THE FUEL LIGHT COMES ON.`
- `YOUR QUICK STOP SHOULD ACTUALLY BE QUICK.`

## Process tightening completed 2026-09-09

- aligned DP production naming with existing Dynamics parser/package identity;
- locked new month token to three-letter English including `SEP`;
- documented historical folder drift/durable-ID resolution instead of blind rename/guessing;
- removed retired pilot `CLIENT-SUBBRAND_YYYY-MM_P##` naming from usage ledger;
- expanded freshness from file-name checking to exact/perceptual/burst/person/product/branch/concept/mechanism memory;
- strengthened strategy around a poster-job sentence and actual human truth;
- added the three-layer novelty test (message + media + execution);
- formalised the monthly Chat Pack interface and explicit per-DP source mapping;
- formalised creative-composition vs fidelity-production passes;
- formalised correction-delta clean restarts to avoid generative decay;
- ensured human-designed posters follow the exact same production/ledger system;
- corrected Piek pilot September folder from `SEPT` to `SEP` while empty.

## Current next work before the first proper high-design Wave 1

1. Complete enough Piek/Engen historical bootstrap to identify strong Engen-only style refs and recent-used media.
2. Capture/select 3–6 Engen Canva references as generation-ready images.
3. Professionally prepare selected November source photos through Adobe/non-generative source editing and save canonical derivatives.
4. Build November Chat Pack v2 against `monthly-chat-pack-contract.md`.
5. Re-evaluate each November strategy/headline through the strengthened Creative Strategy Gate.
6. Run the proper normal-browser internal-image-generator Wave 1.
7. Review individual posters at phone size + the whole batch as a three-up grid.
8. Classify failures; restart only failed DP IDs cleanly.
9. Test approved flat -> Canva Magic Layers/image-to-design -> exact font/logo finish -> exact Canva page linkage.
10. Record real failure/success evidence before rolling this system to the next client.

## System relationship to existing Dynamics work

- Issue #220 remains canonical unified content-production / exact Canva-page / approval / publishing direction.
- Issue #224 remains canonical AI content strategy / exact-client grounding direction.
- Issue #225 remains canonical production OneDrive short-code/durable-ID/naming direction.
- Issue #308 remains private ChatGPT <-> Dynamics integration direction.
- PR #312 is the isolated graphic-design/social-poster design-system lane and must avoid colliding with those implementation owners.

## Non-negotiable continuation rule

Future chats must read this file and the current PR #312 graphic-design docs before asking CA to repeat naming, human-photo rules, quality feedback, strategy rules, launch-now pack structure or amendment doctrine.
