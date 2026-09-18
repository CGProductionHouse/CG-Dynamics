# Poster OneDrive + naming standard

Last updated: 2026-09-09

## Purpose

Make static graphic-design production use the same canonical month/client/type/instance identity model already used by CG's video production and CG Dynamics Client Schedule.

This standard replaces pilot-only poster names such as `PIEK-ENGEN_2026-11_P01_*`. It must remain compatible with the existing package and Microsoft-import identity rules rather than creating a graphic-design-only naming language.

## Existing system this extends

`monthly_deliverables` remains the canonical monthly content record. Each deliverable owns its month, canonical type/code, instance number, scheduled date and immutable database ID.

Existing recognised content types are:

- `DP` — Designed Poster
- `F` / `PHOTO` — Photo
- `Video`
- `Reel`

Current Dynamics parser behaviour is important:

- `DP`, `F` and `PHOTO` are valid recurring deliverables only when numbered (`DP1`, `DP2`, `F1`, etc.);
- `Video` and `Reel` may be recognised unnumbered during legacy Microsoft import, but production files should still resolve to an exact numbered package instance before they receive a canonical production filename;
- staff must never invent a new DP instance outside the exact `monthly_deliverables` package slot.

The established intended OneDrive video production grammar is:

`Clients/<Client>/Videos/<YYYY>/<YYYY_MM_MON>/<YYYY_MM_CLIENT_VIDEO_XX>`

Historical example:

`2025_08_ECONO_VIDEO_02`

Static design extends this grammar instead of inventing a parallel identity system.

## Canonical designed-poster identity

For a recurring designed-poster deliverable:

`YYYY_MM_CLIENT_DP_XX`

Example:

`2026_11_PIEK_DP_01`

Rules:

- `YYYY` = deliverable month year.
- `MM` = two-digit deliverable month.
- `CLIENT` = canonical active-client short code configured/mapped in CG Dynamics. Never guess it from a display name when a configured code exists.
- `DP` = canonical Designed Poster type.
- `XX` = zero-padded `monthly_deliverables.instance_number`.
- `monthly_deliverables.id` remains the immutable database identity. The readable production ID is a stable operational key, not a replacement primary key.
- `scheduled_date` is stored in Dynamics/manifest and is not baked into the stable ID. A posting date may move without changing which package deliverable the creative represents.
- revisions never create a new stable production ID; Wave/version state follows after the stable ID.

Equivalent cross-media production identities are:

- `YYYY_MM_CLIENT_DP_XX`
- `YYYY_MM_CLIENT_F_XX`
- `YYYY_MM_CLIENT_VIDEO_XX`
- `YYYY_MM_CLIENT_REEL_XX`

This gives Dynamics, OneDrive and staff one readable grammar across production types.

## Sub-brand / branch scope

Do not corrupt the stable client/package identity because one client operates multiple brands, branches or locations.

Example: Piek Group is the canonical client; an individual DP may be for Engen, Sasol, Get Together or Piek Group corporate.

Store this separately as canonical metadata, for example:

- `brand_scope = ENGEN`
- `brand_scope = SASOL`
- `brand_scope = GET_TOGETHER`
- `brand_scope = PIEK_GROUP`

Branch/location is another field when needed and must not replace the client code either.

The optional human-readable suffix may use a double underscore after the stable ID:

`2026_11_PIEK_DP_01__ENGEN_SUMMER_PLANS.png`

Everything before `__` is the stable production ID. Everything after `__` is descriptive only and may change without breaking Dynamics linkage.

Do not make `ENGEN` replace `PIEK` in the canonical client-code position unless Engen becomes its own actual Dynamics client/package.

## Canonical OneDrive poster path

Poster production mirrors the Videos year/month model:

`Clients/<Client>/Posters/<YYYY>/<YYYY_MM_MON>/`

Inside the month, stage folders keep the batch readable while the stable ID keeps each deliverable distinct:

```text
Posters/
  2026/
    2026_11_NOV/
      00_MONTH_PLAN/
      01_SOURCE_EDITED/
      02_CHAT_PACK/
      03_WAVE_1/
      04_AMENDMENTS/
      05_APPROVED/
      06_CANVA_HANDOFF/
      07_ARCHIVE/
```

Do not create ten nested DP folders for a ten-poster package unless a future operational need proves that necessary.

## Canonical month tokens for new production

For newly created folders, use the locked English three-letter month token:

- `YYYY_01_JAN`
- `YYYY_02_FEB`
- `YYYY_03_MAR`
- `YYYY_04_APR`
- `YYYY_05_MAY`
- `YYYY_06_JUN`
- `YYYY_07_JUL`
- `YYYY_08_AUG`
- `YYYY_09_SEP`
- `YYYY_10_OCT`
- `YYYY_11_NOV`
- `YYYY_12_DEC`

Historical OneDrive naming has drifted (`MRT`, `SEPT`, date-only folders and other variants exist). Do not use that drift as the future standard.

### Historical-folder rule

Never guess that a generated canonical path is the same thing as an existing historical folder.

When resolving existing production:

1. list the real year/month children;
2. use durable OneDrive item IDs once mapping exists;
3. map historical naming variants explicitly;
4. never silently rename/move/delete historical media merely to satisfy this naming document;
5. only create the canonical future folder when it does not exist and the action is authorised.

This matches the production OneDrive direction in Issue #225: durable IDs are truth; readable names help humans but do not replace exact storage identity.

## Stage/file naming

Examples below use `2026_11_PIEK_DP_01`.

### Month strategy / plan

`2026_11_PIEK_DP_01__PLAN.json`

Contains at minimum:

- `monthly_deliverable_id`;
- stable production ID;
- brand scope + branch/location where relevant;
- audience/buying situation;
- primary content role;
- proposition;
- proof;
- intended emotion/action;
- hook/copy direction;
- source provenance;
- reuse reason if any;
- schedule linkage;
- plan/strategy version.

### Professionally edited source

`2026_11_PIEK_DP_01__SRC_EDITED_01.png`

The file placed in `01_SOURCE_EDITED` is already production-usable. It is not an untouched raw-camera file.

Raw/original photography remains in the client's canonical `Photos` hierarchy. The poster working source is a non-destructive derivative linked back to the original OneDrive item ID.

Allowed prep includes photographer-grade:

- exposure/highlight/shadow correction;
- white balance/colour correction;
- tasteful contrast/clarity/sharpness;
- crop/straightening;
- lens/perspective correction where appropriate;
- temporary blemish/fresh scratch/redness cleanup;
- background cutout/cleanup when the concept requires it.

Never alter permanent or identity-defining human features.

When multiple sources belong to one DP, increment only the source suffix:

- `...__SRC_EDITED_01.png`
- `...__SRC_EDITED_02.png`

### Monthly Chat Pack

`2026_11_PIEK_CHAT_PACK_v02.zip`

The Chat Pack is a batch artefact, not a new deliverable identity. It contains selected edited sources, exact logos/partner assets, only relevant brand-scope style references, manifest and prompt.

`CHAT_ATTACH/` contains the required visual files individually because normal browser image generation currently works best when the source/reference images are surfaced as actual image attachments.

### Generated candidate

`2026_11_PIEK_DP_01__W1_V01.png`

- `W1` = first internal generation wave;
- `V01` = first candidate/version within that wave.

### Creative regeneration

`2026_11_PIEK_DP_01__W2_V01.png`

A new creative wave means the concept/composition is being regenerated from the exact edited source + exact relevant references + revised strategy instruction. It is not a recursive edit of a drifting bitmap.

### Approved flat creative

`2026_11_PIEK_DP_01__FINAL.png`

If Canva/Adobe makes a production-only correction after approval, retain the same stable ID and record revision/version metadata rather than inventing a new DP slot.

### Canva

The exact Canva `design_id` plus page identity/index is stored against the same `monthly_deliverables` item. Where practical the page/export label begins with the stable production ID.

Do not title-match Canva when a durable design/page ID exists.

## Style-reference separation

A parent client may contain multiple distinct design systems. Do not feed mixed style references to the image generator.

`CG Creative Assistant/02_STYLE_REFERENCES/` should hold separate scopes such as:

```text
PIEK_GROUP/
ENGEN/
SASOL/
GET_TOGETHER/
```

The current Chat Pack copies only the relevant scope.

Use a small deliberate reference set (normally 3–6 strong examples), chosen to teach:

- font/type behaviour;
- colour balance;
- gradients/effects;
- masking/cutout behaviour;
- visual density;
- photo treatment;
- logo placement habits;
- overall craft/quality bar.

References are visual grammar, not layouts to reproduce.

## `CG Creative Assistant` relationship

`CG Creative Assistant` is not a second poster archive.

It is the durable system/helper layer:

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

Canonical monthly production lives in `Posters/<YYYY>/<YYYY_MM_MON>/`.

`READY_UNUSED` is a curated/reference state, not a duplicate canonical photography library. Long-term usage truth belongs in Dynamics using exact OneDrive IDs and media fingerprints.

## Monthly production sequence

1. Open the exact client/month/package in CG Dynamics.
2. Resolve the exact numbered DP slots (`DP1`, `DP2`, etc.) from `monthly_deliverables`.
3. Read previous strategy/results/client feedback and relevant performance.
4. Resolve each stable production ID (`YYYY_MM_CLIENT_DP_XX`).
5. Decide strategy and monthly mix before design.
6. Audit current Canva history and the usage ledger for repetition.
7. Select fresh real media from canonical OneDrive photography.
8. Professionally edit selected sources and save linked derivatives into `01_SOURCE_EDITED`.
9. Build one monthly Chat Pack with exact assets and brand-scope references only.
10. Generate the planned batch in normal ChatGPT where practical.
11. Save viable first candidates in `03_WAVE_1` using exact stable IDs.
12. Review each poster at phone size and review the batch as an Instagram grid.
13. Classify amendments before selecting a tool.
14. Finalise exact fonts, logos and fidelity-sensitive layers in Canva/Adobe.
15. Link the exact Canva page to the same Dynamics deliverable.
16. Record source usage, approval, schedule/post and later performance against that deliverable.

The next month resumes from this recorded state instead of repeating the initial bootstrap.

## Revision doctrine — avoid generative decay

Staff must classify a change before choosing a tool.

### A — production correction: do not regenerate

Examples:

- exact logo replacement;
- typo/copy correction;
- exact font;
- font size/spacing;
- small layout nudge;
- exact brand colour;
- margin/alignment.

Fix in Canva/Adobe.

### B — source-photo correction: return to source

Examples:

- crop;
- exposure;
- temporary blemish;
- colour;
- cutout/background cleanup.

Edit the original selected source non-generatively, then recompose if necessary. Do not keep editing a model-reconstructed person's face.

### C — creative concept/composition failure: fresh regeneration

Examples:

- weak concept;
- wrong visual hierarchy;
- generic/template-like poster;
- wrong emotional effect;
- composition fundamentally misses the brief.

Keep all accepted DPs locked. For only the failed DP ID(s), reattach the original edited source + exact relevant references + exact logo/asset pack + revised prompt and generate a fresh candidate. Do not use the prior generated poster as the only source unless deliberately preserving that composition is the goal and no fidelity-risk layer is involved.

### D — minor visual effect amendment

If a safe non-generative Canva/Adobe edit can fix it cleanly, use that. Regeneration is the last resort for small production changes.

## Dynamics fields / future ledger

Each poster production record should ultimately resolve:

- `monthly_deliverable_id`;
- stable production ID;
- client short code;
- month;
- `code = DP`;
- instance number;
- brand scope + branch/location where relevant;
- scheduled date;
- strategy/creative brief version;
- original source OneDrive item ID(s);
- edited-source OneDrive item ID(s);
- exact hash/perceptual/near-duplicate group;
- people/product/service/topic tags;
- reuse reason if any;
- Wave/candidate history;
- Canva `design_id` + exact page ID/index;
- approval state/timestamps;
- publish/schedule reference;
- later performance/learning notes.

Do not create a duplicate social calendar. `monthly_deliverables` remains schedule truth.

## Dummy-proof rule

Staff should eventually never type the canonical production ID manually. CG Dynamics derives it from the selected client, month, content type and package instance; OneDrive month/stage creation and Chat Pack generation use those canonical values automatically.
