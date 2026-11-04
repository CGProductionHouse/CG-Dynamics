# Office natural unkeyed plane study — 28 October 2026

Owner #903; research #874; same draft PR910 and shared library. Existing scene-perspective family advances with one bounded natural wood track. This is not a new family, tutorial completion, creative mastery or native editable handover. MSI client amendments, Central Canvas and storage workers remain untouched.

## Sources and rights

Live primary Mixkit item pages explicitly offered Stock Video Free License/commercial use; original page HTML, source bytes and receipts are private in `work/research-continue/unkeyed-plane`. No client media or externally uploaded private media. Three full sources sampled at one-second intervals before selection:

| Item | Source and screen | SHA256 |
|---|---|---|
| [1790 Smartphone and book](https://mixkit.co/free-stock-video/smartphone-and-book-1790/) | Original `https://assets.mixkit.co/videos/1790/1790-720.mp4`; 3,535,843 bytes, 1280×720, 24000/1001, 275 frames. Select native frames 0–95 only, 4.004 s. Real camera move over wood. Green phone area is reflected foliage; no colour key or screen geometry used. | `5d6ec13c437538c886b3a254eeaaed2a050f81907af1c224fac1f44696b5b859` |
| [3093 Stairwell](https://mixkit.co/free-stock-video/stairwell-with-cement-walls-and-an-elevator-3093/) | 3,684,342 bytes, 1280×720, 24000/1001, 288 frames. Low camera movement: not selected. | `06f6db78a79215041cc6f230771b1097eea4aaf3a2fb7c704c982e8739236e89` |
| [4236 Castle wall](https://mixkit.co/free-stock-video/castle-wall-4236/) | 2,290,287 bytes, 1280×720/24, 173 frames. Curved wall: reject a single global plane; existing signage untouched. | `6159996452f7e25a654a7d5ad10b9652f9b65559c495451a33a09b16d86a9d10` |

One web fetch returned429; ordinary public HTML request succeeded. No paid download, throttle loop or account change. Rights are for this research use, not permission to imply stock is a CG client/location.

## Construction and controls

Source-specific recipe: [render_unkeyed_wood_ab.py](skills/scene-perspective-type/render_unkeyed_wood_ab.py). Uses existing encoder helper; no new rendering engine. Licensed installed Arial Bold, no font redistributed. Four-corner initial placement `(600,615),(920,532),(1050,605),(710,705)` is manually art-directed, not solved 3D calibration. Wood-only feature region excludes raised book and reflective phone. SIFT mutual ratio0.7, train75%/held-out25%, robust homography1.7px. Refresh wood anchor features at24/48/72, composing local transforms to the reference plane. All96 quads remain convex/inside source. Centre travels −242.973px horizontally, −78.304px vertically.

Initial direct-reference trial looked plausible and had low held-out error, but late inliers occupied only44px vertical range and some corners extrapolated205px beyond support. Keep as weak-support diagnostic, not a claim of measured catastrophic drift. Refresh improves minimum inlier count to65 and minimum vertical spread135.392px; max held-out median0.346444source px. R02 seam-crossing corners extrapolated128.300px; repaired R03 corners still extrapolate up to51.282px: residual alone cannot establish absolute physical accuracy. The earlier R02 direct/refreshed final mean corner difference0.360px is agreement, not ground truth, and is not an R03 accuracy metric.

Independent image check rectifies actual moving wood into a512×176 plane patch, Gaussian0.7 then subtract Gaussian6 high pass,12px interior margin. R03 minimum tracked/reference NCC0.827214; final0.842570 versus fixed-placement final−0.038093. Earlier seam-crossing R02 minimum0.735205/final0.902820 used a different physical patch; do not compare those as algorithm improvement. This supports texture attachment across the selection, not a calibrated error bound. R03 maximum centre second difference0.9139px/frame² is logged, not proof of invisible jitter. Recipe refuses held-out median≥0.7px, fewer than30inliers, vertical span≤130px or patch NCC≤0.70.

Five actual 1280×720/24000/1001 H.264 exports,96frames/4.004s each:

- Plain: unchanged source control.
- Fixed ink: same first-frame plane held in camera space; slides along the grain as camera moves, fails physically attached goal.
- Tracked white: same tracked word,85%white coverage. Material comparison, not a universal rejection of white titles.
- Tracked ink: UNWIND,512×176 atlas, Gaussian alpha0.65px, multiplicative dark pigment0.68. Source grain/light retained; flat pigment has no invented cast shadow.
- Copy revision: same UNWIND through47, UNPLUG from48; track/material/timing preserved. Demonstrates requested word revision, not actual changing paint.

Every pre-encode source pixel outside warped glyph alpha is asserted exactly unchanged. Shared encoded48-frame prefix yields **48/48 identical decoded opening frames**,0/48 equal tail frames; no claim that later unchanged background remains bit-exact after H.264. Initial960×540 R01 and seam-crossing native R02 are superseded by repaired native R03; do not mix hashes.

## Actual inspection and limits

All five final files fully decode with FFmpeg. Native dimensions/rate/duration/count probed. All96 encoded ink frames inspected in reduced contact; fixed/tracked/revision samples include0/12, refresh boundaries23/24/25,47/48/49,71/72/73 and95. Full-size encoded last frame inspected: letter stroke/grain remain visible and no phone/book intersection in this selection. Natural camera movement and track were inspected through ordered encoded frames; do not equate a contact with independent normal-speed human review.

**Rejected material placement and actual repair:** R02 word crossed the recessed plank seam, so its flat projection could not model that depth. R03 moves the initial quad80 source pixels down, onto the uninterrupted near plank; re-renders all five variants and re-runs the track/patch/bounds/revision assertions. Actual full-size0/95 and all96 encoded contact frames show the ink below the seam without crossing it. This fixes this placement, not general depth-aware rendering. Grain modulation remains and no cast shadow is added; exact pigment optics/focus are not measured. For a recessed/deforming/curved surface use separate planes/depth or reject attachment. Small foreshortened lettering suits this restrained landscape experiment but is not proven vertical/mobile-readable. No portrait crop is approved. No full-shot275-frame claim, general curved/deforming surfaces, occlusion, native title/tracking layers/save/reopen, second-editor relink, hearing, physical-phone, human creative acceptance or retention claim. Silent; stock reflection is not a controlled-screen proof.

Private final evidence/encoded QA/contacts and superseded trials stay under `work/research-continue/unkeyed-plane/wood-r03-native`. Owner-facing candidate/revision/labelled comparison in office outputs. No WhatsApp/client send, purchases, paid/API credits or dependencies added.

## Final native-HD SHA256

- `plain`: `124341496b6ee44a775c2f0680e6c9618a1cc037e5e2474a643dffae5056b1c7`
- `fixed-ink`: `29c146a3df7c4cc4a27e3699f05a6db7077819b94dc12ba1f5d74a7e1ee52746`
- `tracked-white`: `102e2428b4ed0f92088274d85b06990322ec749f2166dc6bde1dcb2f3c03c9ef`
- `tracked-ink`: `bd6633042fc571eef1e0355b648eb1768df21732c1b6cc8d8085df72faf6cffa`
- `copy-revision`: `c2a906580be9bc1db199956771454f064f552c3c504ced76bcfc4035f6a3563a`

Next distinct queue item5: source-led kinetic type/remaining board mechanism. This repaired one-plane proof does not clear arbitrary surfaces, depth-aware rendering or native staff handover. Keep45 families, implemented controls, rejected/source-gated mechanisms and independent acceptance as separate counts.

Validation: canonical skill and amended scene card pass quick_validate;45 family cards and461 local links across cards/boards/current study resolve; recipe AST parses, actual source/geometry/feature/texture/pixel/revision assertions execute. Five full decodes, native-HD probe and48/48 decoded prefix pass. Labelled comparison decodes and frame72 inspected. TypeScript/Vite build passes with existing chunk-size warning; diff check passes. Single shared skill backed up/installed/hash CURRENT. No dependency or lockfile change.
