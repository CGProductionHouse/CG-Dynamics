# Graphic Design Asset Usage Ledger

Last updated: 2026-09-09

## Purpose

Prevent accidental repetition of client media and creative ideas, make poster production auditable, and give both ChatGPT and human designers a reliable answer to: **what has already been used, what is safe to use now, and why?**

This ledger is part of the existing CG Dynamics content system. It is not a second social calendar or a second media library.

## Source-of-truth hierarchy

- **CG Dynamics `monthly_deliverables`** = exact package/schedule item.
- **Canonical client OneDrive** = original media/file truth.
- **Poster month folder** = production derivatives/candidates/finals.
- **Canva exact design + page** = editable creative/history linkage.
- **Dynamics usage ledger** = long-term structured memory of source, usage, repetition and learning.
- **`CG Creative Assistant` OneDrive workspace** = human-friendly helper/curation surface, not canonical database truth.

## Bootstrap once per client

A client entering the Graphic Design Assistant lane gets one historical reconciliation before normal monthly production begins.

1. Resolve the exact active client and its canonical OneDrive/Canva mappings.
2. Separate any sub-brand/design scopes before analysis (e.g. Piek corporate, Engen, Sasol, Get Together).
3. Read the client's existing Canva marketing design(s), especially the `POSTED / SCHEDULED` area and relevant older approved work.
4. Catalogue published/scheduled poster pages using stable Canva `design_id` + page identity wherever available.
5. For each historic poster record:
   - visible hero/support imagery;
   - visible people without inventing identities;
   - product/service/topic;
   - branch/location;
   - headline/copy idea;
   - creative mechanism/layout family;
   - approximate publish/schedule date where supported.
6. Match used imagery back to canonical OneDrive where possible:
   - exact OneDrive item ID/file reference when known;
   - exact-content hash when bytes are available;
   - perceptual similarity for crops/resizes/re-exports;
   - capture-time/filename-sequence + visual similarity for burst groups;
   - visual review when automated matching is uncertain.
7. Mark unmatched historic imagery as `legacy_external` or `unresolved_legacy`; never fabricate provenance.
8. Seed the Dynamics usage ledger.
9. Populate only the practical human-helper state in `CG Creative Assistant`; do not copy the entire photography library.

The bootstrap is deliberately heavier. Once completed, future months record usage as they happen and should not repeat historical archaeology.

## `CG Creative Assistant` helper workspace

Use one consistent helper structure:

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

Canonical month production remains under:

`Clients/<Client>/Posters/<YYYY>/<YYYY_MM_MON>/`

### Operating principle

Do not destructively reorganise the client's canonical photography library just to make the assistant easier to use.

- Originals stay in existing `Photos`/client media folders.
- `READY_UNUSED` is a curated reference/state surface, not proof that an image is globally unused by itself.
- `USED_REFERENCE` helps staff see recent/important usage visually.
- `BLOCKED_DO_NOT_USE` records clear exclusions such as departed staff, obsolete products or client-requested restrictions without requiring deletion.
- Deletion of canonical media is a separate deliberate file-management action, never an automatic consequence of marking something blocked.

## Canonical content identity

Every usage record must resolve to the actual Dynamics deliverable.

Designed poster stable production ID:

`YYYY_MM_CLIENT_DP_XX`

Example:

`2026_11_PIEK_DP_01`

`monthly_deliverables.id` remains the immutable database identity. `brand_scope`, branch/location and descriptive topic stay separate metadata.

Do not use the retired pilot naming pattern (`CLIENT-SUBBRAND_YYYY-MM_P##_*`) as the canonical key.

## Minimum Dynamics ledger model

Each designed-poster item should eventually retain at least:

```text
monthly_deliverable_id
stable_production_id
client_id
client_short_code
brand_scope
branch_location
month
code = DP
instance_number
scheduled_at
posted_at
status

strategy_version
primary_objective
buying_situation
audience
primary_content_role
intended_emotion
single_minded_proposition
proof
headline
creative_mechanism
reuse_reason

source_media[]
  onedrive_drive_id
  original_onedrive_item_id
  edited_source_onedrive_item_id
  source_filename
  exact_hash
  perceptual_fingerprint
  near_duplicate_group
  shoot_group
  role = hero | support | background
  usage_confidence

people_usage_tags[]
product_service_tags[]
branch_location_tags[]
concept_tags[]

wave_candidates[]
canva_design_id
canva_page_id
canva_page_index
approval_state
approval_notes
publish_platform_refs[]
performance_summary
learning_notes
```

Implementation field names may differ, but the information boundary should remain.

## Freshness dimensions

Freshness is not one boolean.

### 1. Exact image

Detect via durable OneDrive item ID and/or exact content hash.

If it was already used, treat reuse as deliberate and require a reason.

### 2. Cropped/resized/re-exported duplicate

Use perceptual similarity plus visual confirmation. A source remains the same source even after crop, colour grade, resolution change or export.

### 3. Burst / near-duplicate / same shoot angle

Group adjacent or visually near-identical photographs using available capture metadata, filename sequence and visual similarity.

A slightly different frame from the same burst is not automatically fresh.

### 4. Same visible person

Do not build a hidden biometric identity database.

- Use staff/client-provided person tags when names are operationally needed.
- ChatGPT may flag visual repetition such as “the same visible staff member appears in several recent creatives” without naming them.
- If the business needs a named staff restriction, record that from explicit human/client knowledge, not inferred identity.

The goal is creative rotation and compliance, not person identification.

### 5. Same product/service/topic

Record semantic tags from the deliverable/brief and final creative.

A service may be repeated because the client requests it or because it becomes strategically relevant again, but the system should know that it is a repeat and demand a current reason.

### 6. Same branch/location

For multi-site clients, avoid unintentionally making one site look like the entire business. Track location representation alongside subject usage.

### 7. Same headline/concept

A new photograph does not make an old idea new. Track the core message/tension/hook separately from the media.

### 8. Same creative mechanism

Track the design idea, for example:

- giant headline over cutout person;
- split-screen comparison;
- dark gradient with floating product;
- handwritten/sticker annotation;
- editorial photo-led cover;
- newspaper/magazine ad treatment;
- map/location visual;
- meme/reaction format;
- offer/pricing architecture;
- collage;
- macro/scale play.

Do not let a month become multiple colour/image variants of one mechanism.

## Usage states

A practical asset may be treated as:

- `ready_unused` — no known conflicting recent use and suitable for selection;
- `used_recent` — already used recently; avoid by default;
- `used_historic` — used, but sufficiently old that strategic reuse may be considered;
- `near_duplicate_recent` — not exact same file but materially similar to a recent source;
- `blocked` — explicitly do not use;
- `legacy_external` — historic poster image not found in canonical OneDrive;
- `uncertain` — provenance/similarity unresolved; requires human/visual review.

Do not turn these into rigid time windows globally. What counts as “recent” depends on client posting volume, subject scarcity, campaign context and explicit client requests. The system should expose last-use evidence and make a reasoned choice.

## Reuse rule

Reuse is allowed only when the record contains a defensible reason, for example:

- explicit client request;
- campaign continuity;
- product/service is strategically relevant again;
- event/season makes the old source specifically useful;
- meaningful time has passed;
- source is uniquely strong/only viable evidence;
- deliberate reinterpretation creates a genuinely different execution.

“Could not find another photo” is not automatically sufficient if the client has unused media available.

## Candidate source selection score

Before selecting hero media, evaluate:

- freshness confidence;
- relevance to the exact strategy/message;
- current/seasonal relevance;
- visual quality;
- branch/location truth;
- person/product/service rotation;
- source fidelity/identity safety;
- crop/composition potential;
- room for phone-readable type;
- differentiation from recent Canva work;
- whether professional editing can make the source production-ready without faking it.

The best-looking photograph is not automatically the best poster source if it causes repetition or weak strategic fit.

## Historical matching confidence

Historic Canva-to-OneDrive matching should preserve uncertainty instead of forcing a false match.

Suggested confidence states:

- `exact` — same durable item/hash or clearly identical source;
- `high` — perceptually/visually the same source with crop/export differences;
- `probable` — likely near-duplicate/burst but not proven exact;
- `unresolved` — cannot safely map.

Only `exact`/`high` should normally block an image as an exact-source repeat automatically. `probable` should raise a review warning.

## Staff/manual-design parity

The ledger applies even when a designer chooses to build the poster manually from scratch.

Staff should:

1. choose media through the same freshness check;
2. use the same stable production ID;
3. save the professionally edited source into the month production folder;
4. link the final Canva page to the same deliverable;
5. record source/subject/concept usage;
6. let approval/posting/performance write back to the same record.

AI is optional. The production discipline is not.
