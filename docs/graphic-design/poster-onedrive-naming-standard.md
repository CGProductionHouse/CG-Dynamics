# Poster OneDrive + naming standard

Last updated: 2026-09-09

## Purpose

Make static graphic-design production use the same canonical month/client/type/instance identity model already used by CG's video production and CG Dynamics Client Schedule.

This standard replaces the earlier pilot-only poster names such as `PIEK-ENGEN_2026-11_P01_*`.

## Existing system this extends

CG Dynamics already treats `monthly_deliverables` as the canonical monthly content record. Each deliverable has a month, code/deliverable type, instance number, scheduled date and immutable database ID. Existing recognised package/content types are:

- `DP` — Designed Poster
- `F` — Photo
- `Video`
- `Reel`

The existing OneDrive video standard is:

`Clients/<Client>/Videos/<YYYY>/<YYYY_MM_MON>/<YYYY_MM_CLIENT_VIDEO_XX>`

Example already in the Piek Group archive:

`2025_08_PIEK_VIDEO_01`

Static design must extend this convention instead of inventing a parallel identity system.

## Canonical poster identity

For a recurring designed-poster deliverable:

`YYYY_MM_CLIENT_DP_XX`

Example:

`2026_11_PIEK_DP_01`

Rules:

- `YYYY` = deliverable month year.
- `MM` = two-digit month.
- `CLIENT` = canonical active-client short code configured/mapped in CG Dynamics. Never guess from display name when a configured code exists.
- `DP` = canonical Designed Poster type.
- `XX` = zero-padded `monthly_deliverables.instance_number`.
- The immutable `monthly_deliverables.id` remains the database identity. The human-readable code is a stable production identifier, not a replacement database key.
- `scheduled_date` is stored in Dynamics/manifest and is NOT baked into the stable ID because a posting date may move without changing which package deliverable the file represents.

Equivalent cross-media identities are:

- `YYYY_MM_CLIENT_DP_XX`
- `YYYY_MM_CLIENT_F_XX`
- `YYYY_MM_CLIENT_VIDEO_XX`
- `YYYY_MM_CLIENT_REEL_XX`

This lets a future Dynamics parser and staff recognise all production files with one grammar.

## Sub-brand / branch scope

Do not corrupt the stable client/package identity merely because one client operates multiple brands or locations.

Example: Piek Group is the canonical client; a particular DP may be for Engen, Sasol, Get Together, or Piek Group corporate.

Store the sub-brand separately as canonical metadata:

- `brand_scope = ENGEN`
- `brand_scope = SASOL`
- `brand_scope = GET_TOGETHER`
- `brand_scope = PIEK_GROUP`

The optional human-readable file suffix may use a double underscore after the stable ID:

`2026_11_PIEK_DP_01__ENGEN_SUMMER_PLANS.png`

Everything before `__` is the stable production ID. Everything after `__` is descriptive only and may change without breaking Dynamics linkage.

Do not make `ENGEN` replace `PIEK` in the canonical client-code position unless Engen becomes its own actual Dynamics client record/package.

## OneDrive canonical production path

The poster production tree mirrors Videos:

`Clients/<Client>/Posters/<YYYY>/<YYYY_MM_MON>/`

The month folder is the production run/batch. Inside it use stage folders, with every file carrying its stable deliverable ID:

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

This deliberately avoids creating ten nested DP folders for a ten-poster package. The ID in the filename is enough to keep each deliverable distinct while the stage folders keep the month easy for staff to scan.

## Full-year structure

Create the canonical year once. Month folders follow the established client pattern:

- `YYYY_01_JAN`
- `YYYY_02_FEB`
- `YYYY_03_MAR`
- `YYYY_04_APR`
- `YYYY_05_MAY`
- `YYYY_06_JUN`
- `YYYY_07_JUL`
- `YYYY_08_AUG`
- `YYYY_09_SEPT`
- `YYYY_10_OCT`
- `YYYY_11_NOV`
- `YYYY_12_DEC`

Do not infer a standard from later staff naming drift. The canonical convention should be enforced by Dynamics so staff do not need to remember it.

## Stage/file naming

Examples for DP1:

### Month plan

`2026_11_PIEK_DP_01__PLAN.json`

Contains strategy, brand scope, audience, proposition, emotion, hook direction, proof, intended action, source provenance and schedule linkage.

### Professionally edited source

`2026_11_PIEK_DP_01__SRC_EDITED_01.png`

The source placed here is already production-usable. It is NOT an untouched raw-camera file.

Raw/original photography remains in the client's canonical `Photos` hierarchy. The poster working source is a non-destructive derivative.

Allowed prep includes photographer-grade:

- exposure/highlight/shadow correction;
- white balance/colour correction;
- tasteful contrast/clarity/sharpness;
- crop/straightening;
- lens/perspective correction where appropriate;
- temporary blemish/fresh scratch/redness cleanup;
- background cutout when the concept requires it.

Never alter permanent/identity-defining human features.

### Chat Pack

`2026_11_PIEK_CHAT_PACK_v02.zip`

The batch pack contains all selected edited sources + exact logos + only the relevant sub-brand style references + manifest.

`CHAT_ATTACH/` contains the same required visual files individually so normal ChatGPT browser chat can receive them as actual image references.

### Generated candidate

`2026_11_PIEK_DP_01__W1_V01.png`

### Creative regeneration

`2026_11_PIEK_DP_01__W2_V01.png`

Do not repeatedly edit a drifting AI bitmap. A creative regeneration starts again from the exact edited source + exact logo/reference pack + revised strategy instruction.

### Approved

`2026_11_PIEK_DP_01__FINAL.png`

### Canva

The exact Canva design/page mapping is stored against the same Dynamics deliverable. Where practical the Canva page/export label should begin with the stable ID.

## Style reference separation

A parent client may contain multiple design systems. Do not feed mixed style references to the image generator.

`CG Creative Assistant/02_STYLE_REFERENCES/` should hold separate scopes such as:

```text
PIEK_GROUP/
ENGEN/
SASOL/
GET_TOGETHER/
```

Each scope contains only strong relevant Canva screenshots/notes for that brand. The current monthly Chat Pack copies only the required reference set.

The goal is to learn brand grammar — fonts, colour balance, gradients, effects, masking, type behaviour, visual density, photo treatment and quality bar — without cloning any prior layout.

## `CG Creative Assistant` relationship

`CG Creative Assistant` is NOT a second poster archive.

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

`READY_UNUSED` is a curated/reference state, not a duplicate canonical photo library. Dynamics should eventually hold the actual usage ledger and exact OneDrive IDs.

## Monthly production sequence

1. Open/read the exact client and month in CG Dynamics.
2. Read previous month strategy/results/feedback and relevant performance where available.
3. Resolve the exact DP package slots (`DP1`, `DP2`, etc.) from `monthly_deliverables`.
4. Assign each stable production ID (`YYYY_MM_CLIENT_DP_XX`).
5. Decide strategy before design.
6. Audit current Canva history and usage ledger for repetition.
7. Select fresh real media from OneDrive.
8. Professionally edit the selected source photos and save them in `01_SOURCE_EDITED` with their DP IDs.
9. Build one monthly Chat Pack using only the required exact logos and brand-scope references.
10. Generate the whole planned batch in normal ChatGPT where practical.
11. Save first usable candidates in `03_WAVE_1` with exact IDs.
12. Review the batch as a mobile Instagram grid and against each strategy goal.
13. Handle amendments using the revision classes below.
14. Finalise exact fonts/logo/photo layer in Canva/Adobe.
15. Link exact Canva page to the same Dynamics deliverable.
16. Record source usage, approval, schedule/post and performance against that deliverable.

The next month starts from this recorded state instead of repeating the initial research/bootstrap.

## Revision doctrine — avoid generative decay

Staff must classify a change before choosing a tool.

### A — production correction: do NOT regenerate

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
- blemish;
- colour;
- cutout/background cleanup.

Edit the original selected source non-generatively, then recompose if necessary. Do not keep editing a model-reconstructed person's face.

### C — creative concept/composition failure: regenerate from scratch

Examples:

- weak concept;
- wrong visual hierarchy;
- poster feels generic/template-like;
- wrong emotional effect;
- composition fundamentally misses the brief.

Keep all approved posters locked. For only the failed DP ID(s), reattach the original edited source + exact relevant references + logo + revised prompt and generate a fresh candidate. Do NOT use the prior generated poster as the only source unless deliberately preserving that composition is the goal and there is no identity-risk layer.

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
- brand scope;
- scheduled date;
- strategy/creative brief version;
- source OneDrive item ID(s);
- edited-source item ID(s);
- perceptual/near-duplicate group;
- people/product/service/topic tags;
- reuse reason if any;
- Wave/candidate history;
- Canva `design_id` + exact page ID/index;
- approval state/timestamps;
- publish/schedule reference;
- later performance/learning notes.

Do not create a duplicate social calendar. `monthly_deliverables` remains schedule truth.

## Dummy-proof rule

Staff should eventually never type the canonical name manually. CG Dynamics derives it from the selected client, month, content type and package instance; OneDrive folder creation and Chat Pack generation should use those canonical values automatically.
