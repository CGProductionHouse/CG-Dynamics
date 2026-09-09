# CG Graphic Design Assistant — Status

Last updated: 2026-09-09
Branch: `feat/graphic-design-social-poster-lane`
Draft PR: #312

## Why this file exists

This is the continuation checkpoint for the CG Production House graphic-design system. A future ChatGPT conversation should be able to resume from this file plus the linked docs without relying on the original chat transcript or on CA repeating prior feedback.

## Read these next

- `docs/graphic-design/README.md`
- `docs/graphic-design/poster-onedrive-naming-standard.md`
- `docs/graphic-design/social-poster-workflow.md`
- `docs/graphic-design/launch-now-chat-pack-workflow.md`
- `docs/graphic-design/asset-usage-ledger.md`
- `docs/graphic-design/creative-strategy-gate.md`
- `docs/graphic-design/pilots/piek-engen-november-2026.md`

## North-star outcome

Build a repeatable normal-browser-ChatGPT graphic-design system that consistently produces client-approvable CG Production House social posters at scale. The system must add visible client value, restore creative craft to high-volume social design and improve over time from real usage/performance/feedback.

Routine production must remain usable from normal ChatGPT browser chat for CA and staff. Do not make ChatGPT Work mode a requirement.

The minimum quality expectation is not merely acceptable. The system should be configured tightly enough that strong, fresh, client-specific work is the normal result rather than an occasional lucky output.

## Canonical operating architecture

`CG Dynamics strategy + monthly deliverable -> OneDrive canonical poster month -> professionally edited source -> Chat Pack -> normal ChatGPT image-generation batch -> Wave 1 -> targeted amendment path -> exact Canva/Adobe production finish -> exact Canva page link -> approval/schedule/post -> usage + learning recorded`

Responsibilities:

- **CG Dynamics** = client/package/month truth, `monthly_deliverables`, strategy, approvals, eventual usage/performance ledger.
- **OneDrive** = canonical client media + canonical poster production files.
- **ChatGPT normal browser chat** = research, monthly planning, asset selection, creative direction and high-design generation.
- **Internal image generation** = strongest current creative composition engine; use for art direction, gradients, masks, depth, texture, effects and visual play.
- **Adobe/Photoshop-style tooling** = preferred non-generative precision path for real-photo correction/crop/cutout and identity-safe treatment.
- **Canva** = existing creative history, exact typography/logo finishing, editable handoff, staff amendments and exact-page production linkage.

Python/layout poster rendering is not the primary creative route. The first Piek/Engen pilot proved that it produces document-like work below CGPH's design standard.

## Existing CG naming/system alignment — LOCKED

This poster lane extends the existing CG production system instead of inventing a parallel one.

CG Dynamics already recognises monthly content types:

- `DP` — Designed Poster
- `F` — Photo
- `Video`
- `Reel`

The existing canonical video production grammar is:

`Clients/<Client>/Videos/<YYYY>/<YYYY_MM_MON>/<YYYY_MM_CLIENT_VIDEO_XX>`

The poster equivalent is now:

`Clients/<Client>/Posters/<YYYY>/<YYYY_MM_MON>/`

Stable poster production ID:

`YYYY_MM_CLIENT_DP_XX`

Piek example:

`2026_11_PIEK_DP_01`

The immutable `monthly_deliverables.id` remains the real database key. `CLIENT` comes from the configured client short code. `XX` is the zero-padded monthly deliverable instance. Scheduled/posting date remains separate because it may move without changing which deliverable the poster is.

For a parent client with multiple brands, keep the client identity stable and store brand scope separately. Example:

- canonical ID: `2026_11_PIEK_DP_01`
- `brand_scope = ENGEN`
- optional descriptive filename: `2026_11_PIEK_DP_01__ENGEN_SUMMER_PLANS.png`

Do not replace the canonical Piek client code with Engen/Sasol/Get Together unless that brand becomes its own actual Dynamics client/package.

See `poster-onedrive-naming-standard.md` for the full rules.

## Locked CA feedback — design quality

- Every poster must feel individually art-directed from scratch.
- A month's posters must complement each other in an Instagram grid without exposing one repeated template.
- Vary headline location, crop, photo scale, light/dark balance, negative space, visual mechanism, texture and graphic devices.
- Use gradients, depth, masks, glow, layered effects and visual play where they improve the concept.
- Existing Canva work is brand grammar / quality reference, not a layout to clone.
- Design mobile-first. Headline/key information must remain immediately readable on a phone.
- Output must not resemble generic AI, Word, PowerPoint or a stock Canva template.
- Design for a reason, not because the package says another poster is due.

## Locked CA feedback — strategy/copy

Every poster must answer before design:

1. Who exactly are we speaking to?
2. What real buying/use situation are we entering?
3. What is the one useful proposition?
4. Why should somebody stop scrolling?
5. What should they feel?
6. What real client truth/asset proves the idea?
7. What should they think/do next?
8. Why is it relevant now — month, season, place, client context?

Use the CG model:

`Business objective -> buying situation -> audience/problem -> single-minded proposition -> proof -> distinctive brand signals -> creative idea -> platform execution -> exposure/memory -> action -> verified outcome`

Reject vague AI wording. If a headline sounds profound but cannot explain its job, kill it.

## Locked CA feedback — humans / photography

- Real client photography first.
- Never alter identity-defining human features.
- Preserve facial structure, nose, eyes, body shape, age identity, beauty marks and normal permanent characteristics.
- Photographer-grade correction is allowed: exposure, white balance, crop, straightening, sharpness, temporary blemishes, obvious fresh scratches/redness and similar temporary issues.
- Prefer non-generative Adobe/Photoshop-style processing for the real human layer.
- The image generator is generative and can reconstruct pixels; do not treat it as a pixel-lock compositor for real people.

## Locked CA feedback — logos / typography

- Exact logos only. Never regenerate, approximate or reinterpret client/partner logos.
- Production typography uses exact client fonts.
- Do not accept distorted/AI-textured lettering.
- Preferred hybrid: generator creates the visual world and deliberate text zones; Canva/Adobe can apply exact type/logo assets afterward when needed.

## Professionally edited source is a production prerequisite

A selected source used for a DP should be prepared before it enters the generation/design batch.

Canonical raw/original stays in the client's normal Photos hierarchy.

The poster month receives a non-destructive production derivative in:

`Posters/<YYYY>/<YYYY_MM_MON>/01_SOURCE_EDITED/`

Example:

`2026_11_PIEK_DP_01__SRC_EDITED_01.png`

By the time staff or ChatGPT sees `SOURCE_EDITED`, the image should already look like a professionally photographed/edited source ready to design with. Do not dump raw camera files into the final production pack unless deliberately required.

## Brand/sub-brand reference isolation

Piek Group has multiple distinct visual/content systems. Never feed one mixed Piek Canva history to a generator and expect it to infer the correct sub-brand.

A live OneDrive style-reference structure now exists:

`Clients/Piek Group/CG Creative Assistant/02_STYLE_REFERENCES/`

with separate scopes:

- `PIEK_GROUP`
- `ENGEN`
- `SASOL`
- `GET_TOGETHER`

Each scope should hold only strong relevant Canva screenshots/style notes for that brand. A monthly Engen Chat Pack receives Engen references only; Get Together receives Get Together references only, etc.

References teach typography behaviour, colour balance, gradients/effects, masking, visual density, photography treatment and quality bar. They must not be copied.

## Canonical OneDrive poster production — live Piek pilot

Piek's real `Posters` folder previously had 2025 only. A canonical 2026 year and all twelve month folders have now been created to match the established CG month grammar:

`Clients/Piek Group/Posters/2026/2026_01_JAN ... 2026_12_DEC`

November now contains:

```text
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

The earlier pilot-only `PIEK-ENGEN_2026-11` assistant pack was preserved, not deleted, and moved into November `07_ARCHIVE/LEGACY_V1_CHAT_PACK` because canonical monthly production belongs under `Posters`, not under a parallel assistant archive.

`CG Creative Assistant` remains the system/helper layer for instructions, curated asset state, brand style references and history — not a second poster production archive.

## Freshness / no-repeat system

Track more than filenames:

- exact source OneDrive item;
- perceptual/near-duplicate image;
- burst/shoot/angle grouping;
- person(s) depicted;
- product/service/topic;
- branch/location;
- headline/concept;
- creative mechanism/layout;
- last-used date;
- canonical DP/F/Video/Reel deliverable;
- Canva exact page/design;
- publish/schedule record;
- reuse reason when applicable.

A repeated photo/service/person is allowed only for a deliberate reason: explicit client request, campaign necessity, seasonality, sufficient separation, or a genuinely new reinterpretation.

New-client onboarding requires a one-time historical Canva audit. Match posted/scheduled Canva creative to OneDrive exact/near-duplicate sources where possible, record unmatched legacy assets honestly, seed used/ready/blocked state, then record every new item automatically going forward.

Long term Dynamics is the canonical usage ledger. OneDrive remains human-friendly production/file truth.

## Month-to-month operating model

The first client setup is deliberately heavier. After bootstrap, each month is a continuation rather than a restart.

Before the next month's plan, ChatGPT should read:

- previous strategy and approved/rejected ideas;
- previous content/visual mix;
- source usage ledger;
- Canva recent work;
- client feedback/amendments;
- relevant Meta/platform performance available through Dynamics;
- boosted/paid-supported content;
- explicit client reuse/request history;
- current season/local/category context.

Do not equate likes/views with commercial effectiveness. Use performance as evidence alongside the business objective and brand-memory role.

## Monthly generation / mass-production model

The planning chat prepares the entire planned month, not just one poster at a time where avoidable.

For each DP slot it produces:

- canonical DP ID;
- exact brand scope;
- strategy/goal;
- approved hook/copy direction;
- exact selected edited source(s);
- exact logo/partner assets;
- relevant style references;
- manifest linkage.

Then `02_CHAT_PACK` carries the month's batch. Because normal browser image generation works best with actual visual attachments, the pack includes both a ZIP and `CHAT_ATTACH/` individual images for staff to multi-select into ChatGPT.

The generator should create the month's batch with deliberately different art-direction mechanisms while retaining brand grammar and grid balance.

## Amendment doctrine — avoid generative decay

Do not repeatedly ask the generator to edit the same generated bitmap until people/photos become progressively faker.

Classify the change first:

### A — production correction: no regeneration

Logo, typo, exact font, spacing, font size, brand colour, margin/alignment, small layout nudge -> Canva/Adobe.

### B — source photo correction: go back to source

Crop, colour, exposure, blemish, cutout/background cleanup -> edit the original selected source non-generatively, then recompose if required.

### C — creative concept/composition failure: fresh regeneration

Weak concept, generic/template feel, wrong emotion, wrong hierarchy, fundamentally wrong composition -> regenerate only that failed DP from the exact original edited source + exact reference pack + revised prompt. Keep approved posters locked. Do not use the previous drifting generated image as the sole source.

### D — minor visual effect change

If Canva/Adobe can fix it cleanly without regeneration, use that route.

This should be taught explicitly to staff so amendments remain predictable and image quality does not decay.

## Current browser-chat limitations

- Image generation remains generative; real people/logos are not guaranteed pixel-identical if asked to recreate them.
- Normal browser image generation does not reliably offer a hidden `generate -> inspect -> reject -> regenerate` QA loop before the user sees the first candidate. `03_WAVE_1` is therefore internal CG review, not client approval.
- A ZIP is a storage/transport artifact; actual source/reference images should currently also be attached individually via `CHAT_ATTACH/`.
- The final private ChatGPT <-> Dynamics connector is not yet the complete live source in every conversation.
- Exact Canva page insertion/handoff still needs production testing; Magic Layers/image-to-design is a promising finishing route, not the core creative engine.

## Piek / Engen November — current canonical identities

- `2026_11_PIEK_DP_01` — `brand_scope=ENGEN` — seasonal/local movement idea
- `2026_11_PIEK_DP_02` — `brand_scope=ENGEN` — human/service idea
- `2026_11_PIEK_DP_03` — `brand_scope=ENGEN` — convenience/quick-stop idea

Working hooks remain provisional until the v2 strategy/generation pack is locked:

- `BLOEM'S HEATING UP. SO ARE THE PLANS.`
- `THE FACE YOU WANT TO SEE WHEN THE FUEL LIGHT COMES ON.`
- `YOUR QUICK STOP SHOULD ACTUALLY BE QUICK.`

## Next concrete actions — current gate before first proper design run

1. Populate `02_STYLE_REFERENCES/ENGEN` with a small, deliberate set of current strong Engen Canva screenshots and style notes; keep Piek corporate/Sasol/Get Together separate.
2. Professionally edit the three selected November source photos non-generatively and save canonical derivatives into `Posters/2026/2026_11_NOV/01_SOURCE_EDITED` using the stable DP IDs.
3. Build November Chat Pack v2 from those edited sources + exact assets + Engen-only references + updated manifest/prompt.
4. Run a real high-design Wave 1 through normal ChatGPT internal image generation.
5. QA as individual mobile ads and as a three-up Instagram grid.
6. Send only failed DP IDs back through the correct amendment route; keep accepted work locked.
7. Test approved flat design -> Canva Magic Layers/image-to-design -> exact typography/logo finalisation -> exact Canva page linkage.
8. Feed every result back into the docs/system so the process becomes more reliable each month and for the next client.
