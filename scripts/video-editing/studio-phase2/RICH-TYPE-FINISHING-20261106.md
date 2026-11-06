# Mixed-weight typography and protected wording revision — 6 November

This advances existing `kinetic-caption-finishing`, not a new family or engine.
CA wants stronger hierarchy, compact leading and designed words. Today's approved
Jenkor baseline and RC text-only amendments exposed why typography must survive
wording changes without a font reset, large line gaps or displaced baselines.

## Executed mechanism

`visual_treatments.layout_type_runs` accepts explicit lines of `(text, font, RGB)`
runs. Each line shares a real font baseline; next-line distance is measured from
the lowest visible ink to the next highest ink, including accents/descenders.
Each run keeps its supplied font instance/weight/size. Oversized copy fails with
a bounded layout error; there is no auto-shrink or replacement face.

`rich_type_reveal` renders those exact runs inside glyph-local windows with
explicit start times and sampled90degree graphic shutter. It changes no source
footage. Text remains raster motion, not native application text. Use explicit
line grouping, not arbitrary line breaks or a font-size rule applied to all brands.

## Actual output and rights

[Reproduction](skills/kinetic-caption-finishing/render_rich_type_study.py) uses
original procedural geometric artwork and fictional wording. Existing
SpaceGrotesk.ttf is SIL OFL1.1, copyright2020 Space Grotesk Project Authors;
font/license hashes are bound in the private QA. It is not a client font decision.
No stock, photographed person, brand logo, private upload or paid resource.

Three100-frame720x1280/25fps/4s silent H.264 outputs: immediate plain control,
designed sequential rise, then protected IDEAS→STORIES revision. Full decodes,
all300 ordered encoded frames and full-size final lettering were inspected.
All37 protected opening decoded frames match exactly; all60 checked tail frames
change. Codec was fixed-QP18, no B-frames, fixed GOP25/no scenecut/lookahead;
that parity is evidence for these files, not all independent H.264 encodes.
Private exact outputs/QA are work/research-20261106/rich-type.

Five executable tests cover mixed-size baselines, actual ink gap and descenders,
overflow/failures without substitution, glyph-bounded reveal/sharp hold and
unchanged early frames across a late wording revision. They test geometry and
protection, not design taste, engagement or comprehension.

## Retained limits and next gate

The plain control gives the whole message immediately; the sequential variant
withholds the last word until1.52s. This is not automatically a better hook.
The original practice stage is intentionally sparse and not an approved client
film or proof of poster-design mastery. Ordered frames show the reveal's states;
independent continuous normal-speed/phone review is still unproved. Silent means
no beat, music fit or heard sound verdict. No native save/reopen or MSI acceptance
claim. Next useful application needs a specific buyer/story/source and the exact
client's verified font/art; compare immediate information against the animated
version in that actual opening before retaining it.
