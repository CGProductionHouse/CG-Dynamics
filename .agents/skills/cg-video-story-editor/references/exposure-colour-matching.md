# Exposure and colour matching baseline

Owner direction, 28 October 2026: ordinary footage needs a deliberate exposure/colour pass and a coherent cinematic finish, rather than untouched shots jumping in brightness. Applies to every film and its cover; it is separate from stabilisation. Use the existing editor's colour controls or the proven local renderer, not another grading framework.

## Correct → match → look

1. Inspect the actual source and pipeline. Record source colour space/transfer metadata and the editor/timeline/output transform. Do not assume flat footage is log, apply a camera LUT to an unidentified clip, or treat HDR/log as ordinary display-ready SDR. For an SDR delivery, verify the intended SDR output and look for washed highlights, crushed blacks or unexpected saturation in the exact encoded file. Preserve originals.
2. Choose a representative, correctly exposed reference shot in the scene. Inspect early/middle/late selected frames and moving highlights; use the editor's waveform/RGB parade/vectorscope when available. Compare faces, neutral whites, product/material detail and relevant brand colours, not merely whole-frame average brightness. A dark interior and bright exterior should remain believable; matching is not flattening every shot to the same histogram.
3. Correct each source first: exposure/highlights/shadows, white balance/tint, contrast and saturation as needed. Recover only detail actually present. If roof, sky, fabric or skin is clipped, lowering gain only darkens the clipped patch; select a better exposure/range/angle, replace it, or record the source limitation. Avoid grey whites, orange/green skin, excessive lifted noise and crushed product detail.
4. Match adjacent shots in sequence. Alternate reference and candidate, then play each cut at normal speed. Remove distracting exposure, warmth or saturation jumps while retaining intentional location/light changes. Stabilisation, retiming, overlays and compositing can change the visible crop; judge the final selected image, not a different source frame.
5. Apply the film's coherent, restrained look **after** correction/matching, using approved brand/reference direction. “Cinematic” does not mandate teal/orange, a fixed LUT, vignette, grain, bars or reduced saturation. A clean natural treatment can be the right look for a bright shop or a product. Keep logos/graphic brand colours intact; don't bake an artistic camera grade indiscriminately over title/logo layers. Compare before/after and remove a look that hides the client's offering.
6. Inspect the exact export, including cover photo, at full resolution and phone size. Check first/middle/last frames, bright/dark transitions, faces, product/white detail, clipping, banding and perceived consistency. Watch the whole sequence at normal speed. Local scopes and clipping counts support review; they do not certify a pleasing grade or actual phone display behaviour.

## Check colour interpretation after assembly

Before stream-copy concatenation, compare the actual components' colour range,
matrix, transfer and primaries, including the supplied outro and generated fills.
Camera derivatives and logo movies can have different interpretation even when
their dimensions, frame rate and pixel format match. A concat file can inherit
the first component's interpretation across later components. Resolve mixed or
unknown interpretation before assembly; changing tags alone does not convert
sample values. Preserve the originals and compare independently decoded source
frames with the same instants in the assembled export.

Check an unobscured region at the correct scale and placement. Extra typography,
a fitted landscape animation, intentional lines and opaque overlays invalidate
a whole-frame equality comparison. Inspect actual paired frames before calling
a numerical difference a colour defect. Confirm final opacity before repairing
an intermediate that cannot appear in the export.

Count the actual decoded component frames and verify the source map through its
ending. A requested frame count is not proof that the source contains that many
moving frames. Record terminal holds explicitly; do not restore rejected lead-in
frames or silently invent motion to meet a planned duration.

The [3 November production receipt](https://github.com/CGProductionHouse/CG-Dynamics/issues/914#issuecomment-6596052146)
records four visible mixed-range outro repairs. Protected RGB prefixes were
preserved while the affected tails were rebuilt from independently decoded
components. A WiseRide intermediate mismatch was fully covered by all100 opaque
ending frames, so its final stayed unchanged. PSG's first two diagnostics wrongly
included mismatched geometry and a deliberate graphic line; those failed checks
were retained. These are bounded picture findings, not creative, audio, phone or
client approval. Recheck the final delivery encode as well as a private master.

## Record beside the existing shot manifest

`shot/source in-out | source/timeline/output transform | reference shot | correction values or preset + overrides | match judgement/evidence | look strength | retained-detail/source limits | exported frame/cut checked`

Record a camera source requiring no change as **inspected/matched, neutral settings**, with why; do not force arbitrary filter strength on already matching footage. Keep native controls editable when possible. For baked media, preserve the ungraded original, versioned processed file and exact recipe, and label the effect baked. No claim of native or cross-device colour editability without the actual reopen/export test.

Central Canvas office R02 (#904, 28 October) records source-specific tonal corrections and a replacement cover after the first cover appeared overexposed. That is a project receipt, not proof that all older films were graded, a universal look, or owner acceptance of the corrected export. This baseline is a production requirement; no new grading mastery or human listening/phone verdict is asserted by publishing it.
