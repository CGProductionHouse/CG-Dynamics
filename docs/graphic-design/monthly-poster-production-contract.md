# Monthly Poster Production Contract

Last updated: 2026-09-09

## Purpose

Define one repeatable CG Production House workflow for Designed Posters (`DP`) from monthly planning through source selection, image generation, Canva finishing, approval, scheduling, publishing and learning.

This workflow must work whether ChatGPT generates the first creative candidate or a human designer creates it manually. AI is an accelerator inside the system, not the system itself.

## Canonical truth hierarchy

For poster work, use these sources in this order:

1. **CG Dynamics** — client identity, active package, `monthly_deliverables`, current client knowledge, strategy, restrictions, schedule, approval/publish state and later performance.
2. **OneDrive** — exact logos, original photos, professionally edited source derivatives, monthly production files and durable media provenance.
3. **Canva** — exact current visual history, brand/sub-brand design grammar, editable production work, exact design/page linkage and current poster workflow sections.
4. **Fresh research** — current season/local context, category/industry activity and platform/creative patterns where relevant.
5. **ChatGPT conversation** — temporary working discussion only. Important decisions must be written back to Dynamics/OneDrive/GitHub system records rather than living only in chat history.

## One monthly batch, many individual deliverables

Each client month is one production batch, but every poster keeps its own canonical deliverable identity.

Example month:

`Piek Group / November 2026`

Possible deliverables:

- `2026_11_PIEK_DP_01`
- `2026_11_PIEK_DP_02`
- `2026_11_PIEK_DP_03`

The month is planned together so the marketing mix and Instagram grid make sense, but each DP must have its own strategy, source media, creative mechanism and QA result.

## Canonical media identity

Use the existing Dynamics content grammar:

- `YYYY_MM_CLIENT_DP_XX`
- `YYYY_MM_CLIENT_F_XX`
- `YYYY_MM_CLIENT_VIDEO_XX`
- `YYYY_MM_CLIENT_REEL_XX`

`CLIENT` is the canonical client short code. `XX` is the zero-padded package/deliverable instance.

The immutable `monthly_deliverables.id` remains the true database identity.

Sub-brand/branch is separate metadata. Example:

`2026_11_PIEK_DP_01__ENGEN_SUMMER_PLANS`

`PIEK` remains the client identity; `ENGEN` is `brand_scope`.

## Canonical monthly OneDrive production tree

```text
Clients/<Client>/Posters/<YYYY>/<YYYY_MM_MON>/
  00_MONTH_PLAN/
  01_SOURCE_EDITED/
  02_CHAT_PACK/
  03_WAVE_1/
  04_AMENDMENTS/
  05_APPROVED/
  06_CANVA_HANDOFF/
  07_ARCHIVE/
```

The helper system is separate:

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

Do not make `CG Creative Assistant` a second media archive. Raw client photography stays in the normal Photos hierarchy; monthly production derivatives stay in Posters.

## Phase 0 — first-time client / brand bootstrap

This is intentionally heavier once and should not be repeated from zero every month.

### 0.1 Read client truth

Read:

- current Dynamics client knowledge;
- package composition;
- active products/services/locations;
- brand voice and caption rules;
- restrictions/claims/client preferences;
- previous strategy and known feedback;
- publishing-channel matrix.

### 0.2 Separate brand scopes

If one client owns multiple brands/sub-brands, treat each as an independent creative system.

Example Piek scopes:

- `PIEK_GROUP`
- `ENGEN`
- `SASOL`
- `GET_TOGETHER`

Do not feed Engen, Sasol and Get Together references into the same design prompt merely because the parent client is Piek Group.

### 0.3 Historical Canva audit

For each exact brand scope:

- inspect current/recent Canva pages;
- inspect the `POSTED / SCHEDULED` section;
- capture a representative visual record of strong previous work;
- record visual grammar: fonts, colour ratios, gradients, glows, shapes, masks, image treatment, density, type behaviour and brand devices;
- identify layouts/mechanisms that have been overused;
- identify previous poster copy/concepts that should not be repeated casually.

References teach the visual language. They are not templates to clone.

### 0.4 Historical source matching

Where possible, match Canva-used imagery back to OneDrive by:

1. exact source identity/filename/hash;
2. perceptual similarity;
3. same-shoot/near-duplicate grouping;
4. manual visual confirmation where required.

If an old Canva image no longer exists in OneDrive, still record it as historical used-reference evidence so the system does not assume it is fresh.

### 0.5 Build initial freshness state

Track at least:

- exact image;
- near duplicate / burst / same shoot;
- person;
- product/service/topic;
- concept/headline;
- layout/creative mechanism;
- last-use date;
- reuse reason where deliberately reused.

This is the foundation of the future Dynamics media-usage ledger.

## Phase 1 — monthly strategy

Before selecting images, build the month as a marketing mix.

### 1.1 Read the month

Read:

- exact `monthly_deliverables` slots;
- client requests/add-ons/moved slots;
- previous month strategy and outcomes;
- current season/local context;
- relevant current offers/services/events;
- current Meta/performance evidence where available;
- current Canva history and freshness ledger.

### 1.2 Assign every DP a job

Each DP must define:

- target audience;
- communication problem/opportunity;
- objective;
- one main proposition;
- intended emotion/reaction;
- reason to stop scrolling;
- proof/support;
- intended action/CTA;
- local/seasonal/current relevance where useful;
- brand scope;
- selected visual mechanism;
- topic freshness status.

If there is no defensible reason for a poster to exist, do not design filler merely to fill a package slot. Rework the idea until it creates real client value.

### 1.3 Headline gate

A proposed headline must survive these questions:

- Why are we saying this?
- Who are we saying it to?
- What should they feel, think or do afterwards?
- Is it specific enough to this client/context?
- Does it make sense immediately on a phone?
- Could the same line appear on 500 unrelated AI-generated ads?

If the last answer is yes, reject it.

## Phase 2 — source selection and professional prep

### 2.1 Select real media first

Prioritise real client-owned photography.

Select sources intentionally based on the strategy, not simply because a photo is attractive.

Reject or deprioritise:

- exact recently used image;
- near-identical image from the same burst when the scene would feel repeated;
- the same person repeatedly without reason;
- the same product/service too frequently;
- stale or irrelevant staff/products/locations;
- technically poor source when a stronger alternative exists.

### 2.2 Professional source edit

Every source placed in `01_SOURCE_EDITED` must already be usable by a designer.

Allowed non-generative processing:

- exposure/highlight/shadow correction;
- white balance and colour correction;
- contrast/clarity/sharpness;
- crop and straightening;
- lens/perspective correction;
- selective tonal correction;
- temporary blemish/fresh scratch/redness cleanup;
- background cutout/cleanup if required.

Never alter permanent identity-defining features of a person. Do not make a real person more “ideal”; make the photograph professionally finished.

### 2.3 Source provenance

Each edited derivative must link back to:

- original OneDrive item ID/path;
- exact DP ID(s) it was prepared for;
- edit version;
- person/product/service tags where relevant;
- freshness/reuse status.

## Phase 3 — monthly Chat Pack

Create one batch pack per brand scope or clearly separated multi-scope batch.

Required contents:

- professionally edited DP source images;
- exact logo/brand assets;
- 3–6 strong current style-reference poster screenshots per brand scope where practical;
- per-DP strategy/plan;
- one batch manifest/index;
- one image-generator prompt;
- `CHAT_ATTACH/` containing the visual inputs individually.

The ZIP is for transport/archive. Do not assume the internal image generator can visually inspect files hidden only inside the ZIP.

### Manifest minimum fields

Per DP:

- stable production ID;
- `monthly_deliverable_id` where available;
- brand scope;
- source filenames and OneDrive IDs;
- exact logo assets;
- allowed style-reference files;
- headline/copy requirements;
- objective/emotion/CTA;
- prohibited/repetition notes;
- scheduled date if known;
- output filename.

## Phase 4 — generation

### 4.1 Generate the month together where practical

A staff member may attach the complete prepared month set in one normal ChatGPT image-generation conversation so the model can understand the desired overall grid and brand relationship.

But each DP remains isolated by ID and source assignment.

### 4.2 Generation rules

The generator must be instructed to:

- use only the labelled real sources assigned to each DP;
- never swap people/products between DP IDs;
- preserve real people faithfully;
- never invent/reinterpret the exact logo;
- use exact references as visual grammar, not copied layouts;
- design every poster from scratch;
- vary heading location, crop, composition, depth, scale and visual mechanism;
- use richer Canva/Photoshop-like creative effects where appropriate: gradients, masking, cutouts, glows, texture, layered depth, light/shadow, pattern and intentional graphic devices;
- maintain phone-first readability;
- avoid fake AI texture in text/logo areas;
- avoid generic stock/AI people when real client photography exists;
- keep the monthly set complementary as a grid without looking templated.

### 4.3 Exact type/logo production reality

Generated typography and logos are not trusted as final production assets.

Where needed:

- use the generator for creative concept/composition;
- restore exact logo and exact type in Canva/Adobe;
- preserve the original photographic layer for identity-sensitive human imagery when generative reconstruction would create risk.

## Phase 5 — Wave 1 QA

`03_WAVE_1` means candidate, not approved.

Every poster must pass three gates.

### Gate A — strategy

- Does it fulfil the assigned objective?
- Does the headline mean something?
- Does the message feel human and client-specific?
- Does it create the intended emotion/reaction?
- Is the CTA/proposition clear enough?

### Gate B — creative design

- Would it stop the intended user on a phone?
- Does it feel intentionally designed rather than generated/template-based?
- Is hierarchy strong at 1080×1350/mobile scale?
- Is there enough visual love, craft and depth?
- Does it avoid looking like Word/PowerPoint?
- Is it meaningfully different from the client’s recent layouts?

### Gate C — fidelity / production

- correct person/source;
- no identity changes;
- exact logo or cleanly replaceable logo area;
- correct brand palette;
- exact type can be restored cleanly;
- no fake text artefacts;
- no incorrect products/locations/claims;
- margins/readability safe;
- output linked to the correct DP ID.

### Grid gate

Review the month together:

- no repeated heading position rhythm;
- no repeated photo crops unless deliberate;
- no repeated layout family dominating the batch;
- visual density varies naturally;
- the set complements itself in an Instagram grid;
- brand continuity remains obvious.

## Phase 6 — amendments without generative decay

Classify every change before choosing the tool.

### A. Production correction — Canva/Adobe, no regeneration

Use for:

- typo;
- exact logo;
- exact font;
- font size/spacing;
- exact brand colour;
- margin/alignment;
- small layout nudge.

### B. Source-photo correction — return to original edited source

Use for:

- crop;
- exposure;
- colour;
- blemish;
- cutout/background cleanup.

Never keep editing a model-reconstructed human photo.

### C. Creative failure — regenerate only the failed DP from source

Use for:

- weak concept;
- generic/template composition;
- wrong hierarchy;
- wrong emotional result;
- wrong visual mechanism.

Restart from:

- original professionally edited source(s);
- exact logo/reference assets;
- original strategy;
- an explicit amendment delta describing what failed and what must change.

Do not use the failed generated bitmap as the sole source.

### D. Minor effect amendment — prefer Canva/Adobe

Do not regenerate a strong poster merely to adjust a small glow, shadow, texture or spacing issue if a non-generative edit can fix it.

## Phase 7 — approved and Canva handoff

Once the creative candidate is accepted:

1. perform exact production corrections;
2. save approved output as `...__FINAL`;
3. place/rebuild in Canva as needed for editable type/logo/final production;
4. label the Canva page with the stable production ID where practical;
5. store exact Canva `design_id` + page ID/index against the matching Dynamics deliverable;
6. preserve source/media usage linkage.

Canva remains the practical team-editing and approval surface. The system must fit the existing visual stages:

- In Progress / Templates;
- To Be Approved;
- Drafts;
- Posted / Scheduled.

Dynamics remains the canonical workflow/state truth; Canva position is a useful visual signal, not proof of client approval or platform posting.

## Phase 8 — approval, publishing and history

After approval:

- record internal/client approval state;
- schedule/post through the correct client channel path;
- store platform/post reference where available;
- record actual published date;
- mark all source media used by that deliverable;
- move/record the relevant working files into archive/history without destroying provenance.

Never infer `posted` from Canva position alone.

## Phase 9 — monthly learning loop

Before the next month, retrieve:

- approval/rejection/amendment history;
- source-use recency;
- people/product/service/topic recency;
- client feedback;
- boost requests;
- Meta performance where available;
- unusually strong/weak creative results;
- repeated visual mechanisms.

Use performance as evidence, not a command to copy last month’s winner.

The desired result is cumulative intelligence: every month should require less rediscovery and produce better creative judgement.

## Manual designer compatibility

If a CG designer chooses to design a poster completely manually, they still follow the same system:

- canonical DP ID;
- monthly strategy;
- fresh/source-selected imagery;
- `01_SOURCE_EDITED` production source;
- no-repeat check;
- exact brand scope/style reference;
- Wave/approval/Canva linkage;
- usage ledger update.

This is deliberate. The production system must improve CG graphic design even on days when AI is not used.

## Definition of a production-ready month

A month is ready for generation/design only when:

- Dynamics slots are resolved;
- every DP has a stable ID and strategy;
- brand scopes are separated;
- historical/freshness check is complete enough to avoid obvious repetition;
- selected photos have professionally edited derivatives;
- exact logos are available;
- style references are current and brand-specific;
- Chat Pack/manifest is complete;
- every DP can be explained in one sentence: who it is for, why it exists and what it should make them feel/do.

A month is ready for approval/publishing only when:

- every poster passes strategy, creative, fidelity and grid QA;
- exact logo/type/copy is production-correct;
- source usage is recorded;
- exact Canva page is linked where Canva is used;
- approval and publishing state can be tracked against the same `monthly_deliverables` record.
