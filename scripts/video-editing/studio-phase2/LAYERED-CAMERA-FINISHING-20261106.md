# Authored depth planes and rigid-image camera movement — 6 November

This extends the existing `planar-3d-camera` family and `camera_plane.py`.
It prepares richer information/photo compositions without turning a photographed
person into a deforming mesh. This is a mechanism study, not a new client film.

## What is implemented

`depth_layer_rect` projects an explicit parallel image plane from its centre,
depth and world size. `render_depth_layers` composites independently authored RGBA
planes far to near with sampled camera motion. Near planes move further across
the frame than distant ones; each layer uses uniform scale plus translation.
Camera tilt, roll, image stretching and camera/plane crossings are rejected by
this route. The earlier perspective-camera API remains available for suitable
non-face artwork; it is not silently replaced.

RGB is premultiplied by alpha before interpolation, then composited with the
warped alpha. A test keeps translucent white edges white over a white background
instead of producing dark fringes. Fixed camera holds bypass needless sampling.
[OpenCV's affine transformation documentation](https://docs.opencv.org/4.x/da/d6e/tutorial_py_geometric_transformations.html)
describes the2x3 transform interface used here. Authored Z values are design
choices: no recovered subject depth, real room or physical cast-shadow claim.

## Use in a real assignment

- Choose a reveal that explains something: overview to detail, two genuine
  product options, or a person/photo beside the fact it supports. Do not spread
  a generic infographic into every brand or imply an invented client app.
- Supply existing approved client artwork/fonts and actual photo rights. Separate
  the background, intact photo, headings and useful annotations into persistent
  layer IDs. Keep photographed people in rigid image planes; background removal
  or foreground occlusion requires its own inspected matte evidence.
- Keep designed shadow and card in the same plane/group. The operator does not
  calculate physical contact lighting. Keep shadows restrained and check their
  entire moving boundary against type, faces, product and frame edges.
- Key readable holds around the move. Check actual glyph bounds over the whole
  path and exposure interval; a safe neutral frame is insufficient. Include
  overscan for flattened controls and any panning source plane.
- Bind the exact layers/source hashes, world sizes/depths, camera keys, focal
  value, shutter/sample count, frames, purpose and plain comparison in the
  existing story `skill_applications`. This composition treatment does not by
  itself satisfy the separate meaningful UI/state requirement.
- Sound is a fresh editorial choice. Slow parallax may need no whoosh at all.
  Actual music/voice/SFX and beat decisions must be auditioned in the final
  assignment; this silent graphic test does not clear those gates.

## Practice, failures and evidence

[Recipe](skills/planar-3d-camera/render_depth_study.py) uses original paper texture,
grid/rings, geometric illustration, title and focus badge with the existing
SIL-OFL Space Grotesk font. No downloaded stock/person, brand, paid service,
private upload or borrowed client artwork. It labels its illustration honestly.

The first four100frame540x960/25fps/4s outputs are retained as failed layout
controls under private `work/research-20261106/layered-depth-r01`:

- Original title width600world units put actual ink19.02px from the left edge
  at the peak camera pose, below this study's intended27px margin.
- A frame-sized flattened control exposed an empty right border during lateral
  motion. Its output decoding successfully did not make that border acceptable.
- R01→R02's single-badge depth revision preserved65/65 decoded opening frames,
  but does not repair either layout failure; those files are not current.

The corrected recipe uses title width540world units and an810x1440 overscanned
neutral composition before flattening. It renders a static control, a matched
flat-camera control, depth R03 and badge-only depth R04. Current exact output,
decoded comparison and edge/ink clearance results belong in the private final
QA and the existing progress checkpoint; inspect before promoting them.

Final inspection: all four current100frame encoded outputs fully decode, and
all400 ordered current frames plus full-size peak/ending samples were inspected.
Actual title-ink clearance is at least38.9443px across the complete current paths,
versus19.0186px in rejected R01/R02. The current encoded edges contain zero dark
empty-border pixels under this original light-background diagnostic; rejected
flat control reaches2040. This diagnostic is source-specific, not a general
rule that all frame edges must be light. R03→R04 opening parity is65/65 decoded
frames; all33 checked tail frames change. Four rejected earlier files and four
current files are retained, not eight passed outputs.

Temporal samples integrate camera motion. Independently animated badge depth
is held at its per-frame value through that exposure; separate layer-motion blur
has not been proved. Current raw geometry, camera keys, font/art hashes and
encoded frame hashes remain in `QA.json`; `ACCEPTANCE.json` keeps the margin,
edge, failure and protection results. [Inspection helper](skills/planar-3d-camera/inspect_depth_study.py)
rechecks all encoded edges and actual title alpha bounds rather than trusting a
neutral still. No code path automatically promotes the example to client use.

Five new tests cover differential depth displacement without aspect change,
premultiplied-edge compositing, deterministic depth occlusion, rejection of
stretch/tilt/crossing/duplicate IDs and sharp locked holds. Five earlier camera
tests retain perspective behavior. These are geometric/alpha protections,
not artistic acceptance.

No real-face, native AE/Premiere save/reopen, heard sound, physical-phone,
independent continuous normal-speed, client approval or MSI installation claim.
Raster MP4 plus original PNG planes and keys is a reproducible composition,
not a native staff-editable project.53 documented families remain53; next useful
gate is source-specific photo/footage application with exact brand assets and
normal-speed review, not another cosmetic rerender of this diagram.
