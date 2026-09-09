# Graphic Design Asset Usage Ledger

## Purpose

Prevent accidental repetition of client media and make the creative process auditable, staff-friendly and reusable across future ChatGPT conversations.

## Bootstrap once per client

A client entering the Graphic Design Assistant lane gets a one-time historical reconciliation.

1. Read the client's Canva marketing design(s), especially POSTED / SCHEDULED history.
2. Catalogue poster pages already published or scheduled.
3. For each page, identify the main photo(s), supporting media, visible people, product/service/topic and creative mechanism.
4. Match used photos back to OneDrive where possible.
   - exact filename/asset ID match when available;
   - exact-content hash when raw bytes are available;
   - perceptual/near-duplicate comparison for resized/cropped versions;
   - visual review when automated matching is uncertain.
5. Mark unmatched historic imagery as `legacy_external` rather than inventing provenance.
6. Seed the Dynamics ledger and staff-friendly OneDrive workspace.

## OneDrive workspace

Working folder name: `CG Creative Assistant`.

```text
CG Creative Assistant/
  00_README/
  01_READY_UNUSED/
  02_USED_REFERENCE/
  03_BLOCKED_DO_NOT_USE/
  04_CURRENT_MONTH/
  05_APPROVED_EXPORTS/
  manifests/
```

### Operating principle

Do not destructively reorganise the client's canonical photography library merely for the assistant. Canonical originals remain in the existing client photo folders. The creative-assistant workspace contains curated working copies/references, current-month selects, exports and manifests so staff can continue manually when needed.

### Staff behaviour

- remove clearly irrelevant/expired media from the canonical client library when authorised;
- alternatively mark it `blocked` immediately if deletion is not appropriate;
- keep READY_UNUSED clean enough that manual designers can safely pick from it;
- after a poster is approved/scheduled, move its workspace copy/reference to USED_REFERENCE and record the source asset in Dynamics.

## Dynamics ledger model

Each static content item should link to the exact schedule/deliverable slot and store at minimum:

```text
content_item_id
client_id
subbrand_id
month
package_slot
stable_poster_name
canva_design_id
canva_page_id_or_page_number
status
scheduled_at
posted_at
primary_objective
buying_situation
audience
intended_emotion
single_minded_proposition
creative_mechanism
headline
source_media[]
  onedrive_drive_id
  onedrive_item_id
  source_filename
  exact_hash
  perceptual_hash
  shoot_group
  role (hero/support/background)
people_usage_tags[]
product_service_tags[]
branch_location_tags[]
approval_notes
performance_summary
```

## Repetition controls

### Exact image

Detect via OneDrive item ID and content hash.

### Cropped/resized/re-exported duplicate

Use perceptual similarity and visual confirmation. The same source should remain recognised even if cropped, colour-corrected or exported at another resolution.

### Burst/near-duplicate

Group adjacent photos from the same shoot/sequence using capture time, filename sequence and visual similarity. Avoid presenting a near-identical burst frame as 'fresh'.

### Same person

Do not build a hidden identity/biometric naming system. Use staff/client-provided person tags when names are needed. During creative review, ChatGPT may also flag that the same visible person appears repeatedly without naming them. The goal is rotation, not identity recognition.

### Same product/service/topic

Record explicit semantic tags from the client schedule and design. Repetition is acceptable only with a reason and a fresh execution.

### Same creative mechanism

Track more than subject matter. Examples:

- giant headline over cutout person;
- split-screen before/after;
- dark gradient with floating product;
- handwritten sticker treatment;
- editorial photo-led cover;
- illustrated diagram;
- meme/reaction format;
- offer/pricing card.

Do not let a month become five colour variants of the same mechanism.

## Stable naming

Recurring package static:

`CLIENT-SUBBRAND_YYYY-MM_P##_[SHORT-TOPIC]`

Once-off:

`CLIENT-SUBBRAND_YYYY-MM_X##_[SHORT-TOPIC]`

Examples:

- `PIEK-ENGEN_2026-11_P01_SUMMER-TRAVEL`
- `REDOAK_2026-10_P03_LOADED-OMELETTE`

The package slot is stable even if the design is revised. Revision metadata belongs in version history, not by changing the slot identity.

## Selection score

Before selecting a hero photo, score candidates on:

- unused/freshness confidence;
- recency and current relevance;
- visual quality;
- fit to the exact message;
- branch/location truth;
- person/product rotation;
- crop/composition potential;
- mobile readability around the subject;
- brand/creative differentiation from recent work.

The 'best-looking photo' is not automatically the best poster source if it creates repetition or weak message fit.
