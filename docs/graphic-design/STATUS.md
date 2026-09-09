# CG Graphic Design Assistant — Status

Last updated: 2026-09-09 15:12 SAST
Branch: `feat/graphic-design-social-poster-lane`
Draft PR: #312

## Why this file exists

This is the continuation checkpoint for the CG Production House graphic-design system. A future ChatGPT conversation should be able to resume from this file plus the linked docs without relying on the original chat transcript.

## Read these next

- `docs/graphic-design/README.md`
- `docs/graphic-design/social-poster-workflow.md`
- `docs/graphic-design/launch-now-chat-pack-workflow.md`
- `docs/graphic-design/pilots/piek-engen-november-2026.md`

## North-star outcome

Build a repeatable normal-browser-ChatGPT graphic-design system that consistently produces client-approvable CG Production House social posters at scale. The system must add client value, not merely reduce staff time.

Routine production must remain usable from normal ChatGPT chat. Do not make ChatGPT Work mode a requirement.

## Immediate production decision

The first Piek/Engen poster pilot proved that Python/layout rendering is not the right high-love design engine. It produced flat, document-like work that felt closer to PowerPoint/Word than CGPH graphic design.

The launch-now creative route is therefore:

`Dynamics/strategy -> OneDrive Chat Pack -> normal ChatGPT browser chat -> internal image generation for art direction -> Adobe/Photoshop-style precision photo treatment -> Canva exact typography/logo/editable finishing -> Wave 1 -> approval -> schedule/publish -> usage recorded`

The internal image generator is currently the strongest creative composition surface available in this chat product. Canva's own generation is not the primary art-direction engine; Canva is used as creative history + exact finishing/handoff.

## Locked CA feedback

### Design quality

- Every poster must feel individually art-directed from scratch.
- Monthly posters must complement one another in an Instagram grid without exposing one repeated template.
- Vary headline position, crop, light/dark balance, image scale, negative space, visual mechanism, texture and graphic effects.
- Use gradients, depth, masks, glow, layered effects and visual play where appropriate.
- Mobile-first readability is mandatory.
- Output must not look like generic AI, a Word document, a PowerPoint slide or a stock Canva template.
- Existing Canva work is inspiration / brand grammar only. Do not clone old layouts.

### Marketing/content

Every poster must answer before design:

1. who exactly is the audience;
2. what real buying/use situation is being entered;
3. the single useful proposition;
4. why the viewer should stop;
5. intended emotion;
6. proof in real client truth/assets;
7. desired next thought/action;
8. why it is relevant now in month/place/context.

Use the existing CG marketing model:

`Business objective -> buying situation -> audience/problem -> single-minded proposition -> proof -> distinctive brand signals -> creative idea -> platform execution -> exposure/memory -> action -> verified outcome`

Reject vague AI wording. A line that sounds profound but has no concrete meaning is not acceptable.

### Human photography

- Real client photos first.
- Never change identity-defining human features.
- Professional photographic correction is allowed: exposure, white balance, crop, sharpness, temporary blemish/fresh scratch/redness cleanup, etc.
- Preserve permanent traits such as beauty marks, facial structure, nose, eyes, body shape and age identity.
- Prefer non-generative Adobe/Photoshop-style processing for the actual human layer where identity preservation matters.

### Logos/fonts

- Exact logos only. Never redraw, approximate, reinterpret or regenerate client/partner logos.
- Production typography uses exact client fonts.
- Do not trust AI-rendered font texture/letterforms when they look distorted or incorrect.
- Preferred hybrid: use image generation for the high-design visual world and leave clean text zones when needed; apply exact typography and exact logo assets afterward in Canva/Adobe.

## Current important technical limitation

The internal image generator is generative: reference images guide it, but pixels can be reconstructed. It is not a guaranteed pixel-lock compositor for real people/logos.

Also, the current browser-chat image generation flow does not reliably support a hidden `generate -> inspect -> reject -> regenerate` loop before the first output is shown to the user. Wave 1 therefore remains an internal CG review stage.

This limitation is documented as something the long-term system should replace with programmatic candidate QA/retry when a better surface becomes available.

## Launch-now monthly Chat Pack

Each client/month should get:

- one attachable ZIP containing exact source photos, exact logos/brand assets, 3-6 recent Canva poster reference screenshots and `MANIFEST.csv`;
- one separate exact prompt `.txt` file;
- stable poster names tied to Dynamics package slots.

Naming:

`CLIENT-SUBBRAND_YYYY-MM_P##_SHORT-TOPIC`

Example:

`PIEK-ENGEN_2026-11_P01_SUMMER-PLANS`

## OneDrive workspace

A real pilot workspace has been created for Piek Group:

`Clients/Piek Group/CG Creative Assistant/`

Structure:

```text
00_SYSTEM/
01_ASSET_LIBRARY/
  READY_UNUSED/
  USED_REFERENCE/
  BLOCKED_DO_NOT_USE/
02_MONTHLY_PACKS/
  PIEK-ENGEN_2026-11/
    00_INPUT_PACK/
    01_PROMPT/
    02_WAVE_1/
    03_AMENDMENTS/
    04_APPROVED/
    05_CANVA_HANDOFF/
    06_ARCHIVE/
03_HISTORY/
```

The first `CG_Creative_Assistant_README.txt`, Piek/Engen generation prompt, manifest and v1 Chat Pack have been uploaded there.

The v1 Chat Pack still needs physical screenshots of the selected recent Canva posters before it is considered fully generator-ready; the current internal image generator cannot simply ingest a Canva design ID as an image reference.

## Freshness / no-repeat system

Track more than filenames:

- exact source asset;
- perceptual near-duplicate;
- same burst/shoot/angle;
- person(s) depicted;
- product/service/topic;
- headline/concept;
- creative mechanism/layout;
- last-used date;
- poster/package slot;
- Canva page/design;
- publish/schedule record;
- reuse reason where applicable.

New-client setup requires a one-time historical Canva audit. Match posted/scheduled Canva images to OneDrive where possible, record unmatched legacy assets honestly, seed USED_REFERENCE / READY_UNUSED / BLOCKED and then record every new poster automatically.

Long term, Dynamics becomes the canonical social/media usage ledger. OneDrive remains the human-friendly working surface.

## Performance-learning direction

Eventually each new month should read:

- previous month strategy;
- previous visual/content mix;
- Meta/platform performance exposed through Dynamics;
- comments/interactions;
- boosted/paid-supported posts;
- approval/rejection/amendment history;
- explicit client reuse requests.

Do not equate likes/views with commercial effectiveness. Use them as evidence alongside business objectives and brand-building needs.

## Piek / Engen November pilot — current concepts

P01 — `PIEK-ENGEN_2026-11_P01_SUMMER-PLANS`
- working hook: `BLOEM’S HEATING UP. SO ARE THE PLANS.`
- goal: anticipation + local relevance + movement
- source: Engen Northridge drone photo

P02 — `PIEK-ENGEN_2026-11_P02_FUEL-LIGHT`
- working hook: `THE FACE YOU WANT TO SEE WHEN THE FUEL LIGHT COMES ON.`
- goal: relatable reassurance + human service
- source: real Engen Crossing staff photo

P03 — `PIEK-ENGEN_2026-11_P03_QUICK-STOP`
- working hook: `YOUR QUICK STOP SHOULD ACTUALLY BE QUICK.`
- goal: practical relevance + slight knowing humour
- source: Engen Crossing convenience/store photo

## Next concrete actions

1. select/export 3-6 recent strong Piek Canva poster screenshots into the November `00_INPUT_PACK`;
2. rebuild Chat Pack v2 so it is completely ready to attach to a normal ChatGPT chat;
3. generate a real high-design Wave 1 using the internal image generator;
4. use exact typography/logo finishing and real-photo compositing rather than trusting regenerated text/logos/people;
5. test Canva image-to-design / Magic Layers as the editable handoff path for approved flat designs;
6. use the results to refine the prompt/system, not merely the individual posters;
7. continue researching better multimodal design/editing surfaces, deduplication, hidden QA and direct Dynamics integration.
