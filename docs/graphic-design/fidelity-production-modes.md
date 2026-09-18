# High-design production modes with exact client assets

Last updated: 2026-09-09

## Problem being solved

CG wants the internal image generator's stronger visual creativity without accepting the weaknesses of a fully flattened generative poster:

- reconstructed/changed real people;
- altered buildings/products/signage;
- fake/reinterpreted logos;
- distorted text or fake font texture;
- progressive degradation after repeated image edits.

Therefore the image generator should be treated as the creative art-direction engine, not automatically as the final production compositor.

## Mode A — exact-photo + generated design layers

Preferred when real-person/client-photo fidelity is critical.

### Flow

1. Professionally edit the exact real source non-generatively.
2. Create any required exact subject/background cutout with Adobe/Photoshop-style masking.
3. Give the generator the source/reference context and ask it to develop the graphic world / visual direction around the required subject placement.
4. Generate graphic/background/overlay components where practical rather than trusting a reconstructed human/logo as the final layer.
5. Composite the exact edited source/subject non-generatively over/into the generated visual system.
6. Add exact typography and exact logos in Canva/Adobe.
7. QA at phone size and as part of the monthly grid.

### Best for

- staff portraits;
- client/team members;
- products whose exact appearance matters;
- client premises/signage;
- branded vehicles/equipment;
- any factual visual that must not be invented.

### Principle

The generator can have fun with the world around the photograph. The photograph remains client truth.

## Mode B — full creative mockup -> Magic Layers -> exact replacement

Promising fast route when Canva image-to-design / Magic Layers separates the generated flat poster cleanly.

### Flow

1. Internal generator creates the high-design poster mockup using the exact strategy/source/style references.
2. Treat the generated human/photo/logo/text as temporary layout material only where exactness is uncertain.
3. Send the flat design through Canva image-to-design / Magic Layers.
4. Replace extracted/reconstructed photo element with the exact professionally edited source.
5. Replace logo with the original exact logo asset.
6. Replace all production typography with the exact client font/copy.
7. Keep useful generated graphics/effects/masks only where they do not falsify client truth.
8. QA final editable Canva page.

### Gate

If Magic Layers does not cleanly separate the key photo/text/logo elements, do not spend excessive time fighting it. Switch to Mode A or a manual high-value Canva/Adobe finish.

## Mode C — generator-direct final candidate

Allowed only for low-fidelity-risk creative where no real person/product/logo/legible exact typography is being trusted to generation, or where exact layers will still be overlaid afterward.

Never classify a generator-direct bitmap as final solely because it looks impressive.

## Typography

The generator may use typography compositionally to express hierarchy and energy, but production lettering must be checked for:

- exact wording;
- exact brand font;
- clean glyphs;
- no fake texture/artifacts;
- phone readability.

When the generator's text is visually useful but not production-safe, preserve its hierarchy/layout as a reference and recreate the text exactly in Canva/Adobe.

## Logo

The final logo layer is always the supplied original asset.

Even a visually accurate generated logo is not accepted as the production logo.

## Revision rule

Do not keep editing the full flattened generated poster when the issue is one exact production layer.

- text/logo -> replace exact layer;
- photo -> return to exact source layer;
- concept/composition -> fresh generation from the source pack;
- small effect -> safe Canva/Adobe adjustment.

This separation is how CG gets both high creative energy and reliable client truth.
