# Image Generator Batch Prompt Contract

Last updated: 2026-09-09

## Purpose

Provide a dummy-proof prompt structure for CG staff using normal ChatGPT browser chat to generate a monthly social-poster batch from a prepared OneDrive `CHAT_ATTACH` pack.

The prompt must control the model without strangling the creative result. The goal is strong graphic design using exact client inputs, not AI improvisation with fake people, logos or generic brand language.

## Before staff opens the image-generation chat

The planning/orchestration step must already have prepared:

- exact DP IDs;
- exact brand scope;
- professionally edited real source photos;
- exact logos/brand marks;
- 3–6 current relevant style-reference posters/screenshots where practical;
- approved/current fonts and colours;
- per-DP strategy and copy/headline requirements;
- freshness/repetition notes;
- output filenames.

Do not ask the image-generation chat to research the entire client from scratch if the planning chat has already done that work. Give it a clean production pack.

## Initial monthly batch prompt template

Use this as the base instruction and insert the month-specific manifest beneath it.

```text
You are designing a complete monthly social-poster batch for CG Production House.

Treat every attached file as intentional production input. Do not invent substitute people, logos, products, services, locations or client facts.

PRIMARY GOAL
Create genuinely high-end social graphic design that feels individually art-directed in Canva/Photoshop by a strong human designer. The work must stop a phone scroll, feel current and crafted, and never look like a Word/PowerPoint template or generic AI poster.

SOURCE FIDELITY
- Use only the real client photos explicitly assigned to each poster ID.
- Do not swap people/products/photos between poster IDs.
- Preserve real people faithfully. Do not alter identity-defining facial/body features.
- Do not beautify, reshape or reinterpret the person.
- Temporary photographic blemishes may be cleaned only to normal professional-retouching standard.
- Do not generate a fake replacement person when a real source person is provided.
- Do not reinterpret or redraw any supplied logo. Treat supplied logos as exact identity assets.

BRAND FIDELITY
- Learn the visual grammar from the supplied reference posters: typography behaviour, brand colours, gradients, glows, shapes, masking, photo treatment, visual density and general creative energy.
- Do NOT copy a previous layout.
- Do NOT make the monthly batch look like one repeated template.
- Use the supplied/current brand colours and font direction.
- Generated logo/text rendering is not final authority; keep critical identity/type areas clean enough for exact Canva/Adobe production correction afterwards.

DESIGN QUALITY
Have fun with the design. Use strong modern graphic-design craft where appropriate: layered depth, gradients, masks, cutouts, texture, glow, controlled shadows, pattern, framing, type scale and directional composition.

Each poster must feel designed from scratch while still clearly belonging to the same brand.

Across the monthly set, deliberately vary:
- headline position;
- photo crop/scale;
- composition;
- negative space;
- graphic mechanism;
- depth/effects;
- visual density.

Do not repeat the same headline location or card/grid layout across the batch.

PHONE-FIRST RULE
Every poster is primarily viewed on a phone. Headline and key message must be immediately readable at mobile feed size. Avoid tiny body copy and weak contrast.

COPY RULE
Use the exact supplied copy requirements. Do not replace clear human marketing copy with generic AI phrases. Every headline must have a clear audience, purpose and intended feeling/action.

OUTPUT RULE
Create each poster as its own finished 1080×1350 social design and preserve the exact poster ID in the response/order so staff can name it correctly.

Before creating a poster, honour the poster-specific source assignment and strategy below.

MONTH MANIFEST
[INSERT EACH DP ID + brand scope + assigned files + headline/copy + strategy + output filename here]
```

## Recommended per-DP manifest block

```text
POSTER ID: 2026_11_PIEK_DP_01
BRAND SCOPE: ENGEN
OUTPUT NAME: 2026_11_PIEK_DP_01__W1_V01.png
SOURCE PHOTOS: 2026_11_PIEK_DP_01__SRC_EDITED_01.jpg
EXACT LOGO: EXACT_LOGO__PIEK_GROUP.png
STYLE REFERENCES: ENGEN_REF_01.jpg, ENGEN_REF_02.jpg, ENGEN_REF_03.jpg
AUDIENCE: [specific audience]
OBJECTIVE: [what this post must achieve]
INTENDED REACTION: [what user should feel/think/do]
MAIN PROPOSITION: [single message]
HEADLINE: [approved headline or controlled headline direction]
SUPPORT COPY: [exact or optional]
CTA: [if required]
CURRENT/LOCAL CONTEXT: [e.g. November, Bloemfontein, warmer weather]
DO NOT REPEAT: [recent topic/person/layout/source notes]
CREATIVE DIRECTION: [poster-specific design idea, not a full layout prescription]
```

## Batch output review rule

The first generated set is `WAVE_1`, not automatically final.

Staff/ChatGPT must review:

- strategy effectiveness;
- visual craft;
- fidelity;
- phone readability;
- exact source use;
- fake text/logo artefacts;
- monthly grid repetition.

## Amendment decision tree

Before writing an amendment prompt, classify the problem.

### Production correction — do not regenerate

Examples:

- typo;
- exact logo;
- exact font;
- exact colour;
- small spacing/alignment adjustment;
- tiny visual-effect adjustment.

Fix in Canva/Adobe.

### Source-photo correction — edit the original source

Examples:

- exposure;
- crop;
- blemish;
- colour;
- cutout.

Return to the real source photo and create a new edited derivative. Do not repeatedly regenerate a reconstructed person.

### Creative failure — fresh regeneration

If the concept/composition is wrong, regenerate only that failed DP from the original prepared inputs.

Do not rely on the failed generated poster as the only visual source.

## Creative-regeneration prompt template

```text
START THIS POSTER AGAIN FROM THE ORIGINAL PREPARED SOURCES.

Poster ID: [ID]

Use the original professionally edited source photo(s), exact logo asset and the original brand-style references again. Do not build from the previous generated bitmap as the source of truth.

KEEP FROM THE ORIGINAL STRATEGY:
- Audience: [...]
- Objective: [...]
- Main proposition: [...]
- Intended reaction: [...]
- Required copy/headline: [...]

WHY WAVE 1 FAILED:
[one concise factual critique]

CORRECTION DELTA:
[what must change creatively]

DO NOT:
- repeat the failed composition;
- move to a generic template;
- change the real person's identity/features;
- redraw the logo;
- change the core message unless explicitly instructed.

Create a fresh poster concept from the original sources and save it as the next wave/candidate for this exact poster ID.
```

## Good amendment language

Good:

- `The idea is right but the composition is too corporate and flat. Restart from the original source. Make the person the dominant hero, use stronger depth/masking and give the headline more attitude. Do not reuse the previous layout.`
- `The concept is wrong. The post needs to communicate late-night convenience, not generic service. Restart DP03 from the original source and strategy with a sharper human hook.`

Bad:

- `Make it nicer.`
- `Can you tweak it?`
- `Try again.`
- `Keep editing this one until it works.`

## Multi-poster amendment rule

If a batch has ten posters and only DP03 and DP06 fail:

- lock the other eight;
- do not regenerate the whole month;
- reattach only the original inputs needed for DP03 and DP06 plus the relevant brand references;
- provide separate correction deltas;
- generate new candidates for those IDs only.

This prevents good work from drifting merely because another poster failed.

## Grid-awareness rule

When regenerating one failed poster, include a quick description or reference of the approved surrounding monthly set so the new candidate complements the grid without copying it.

Example:

`The approved month already contains one full-bleed photo poster with a top-left headline and one dark gradient poster with centered type. Do not use either of those mechanisms for this regeneration.`

## Final-production reminder

Image generation is the creative rendering layer, not the last authority for exact production identity.

Before final approval, verify/fix in Canva/Adobe where needed:

- exact logo;
- exact font;
- exact text/copy;
- exact brand colours;
- clean human-photo fidelity;
- export dimensions;
- stable DP filename/Canva page identity.
