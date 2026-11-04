# Office two-shot forward handoff —28 October2026

## Source gate: actual movement before an effect

The next distinct gate was a genuine different-shot directional handoff. This study advances a **forward-motion cut with a bounded digital reframe**, not a filmed sideways whip, continuous place/action or exact tutorial replica. Existing motion-matched-speed family;45 families unchanged.

Two initially promising Egyptian carving/statue shots([45401](https://mixkit.co/free-stock-video/panning-shot-of-statues-of-the-egyptian-gods-at-a-45401/),[45396](https://mixkit.co/free-stock-video/close-up-panning-shot-of-ancient-hieroglyphics-in-egypt-45396/)) expose Restricted/personal-use-only720p versions; rejected before download. Three actual commercial Free License sources screened:

| Source | Exact original / native properties | Actual gate |
|---|---|---|
| [Fog2187](https://mixkit.co/free-stock-video/a-foggy-morning-in-the-forest-2187/) | `https://assets.mixkit.co/videos/2187/2187-720.mp4`,5686897bytes,720×1280/25fps456frames18.24s, SHA`bec557fe5f5e234340136619b0cb349e676483db023265bf337c9e6bfeb562b1` | Sideways pan. Robust feature-fit median centre displacement+0.03247frame-width/s, near-zero vertical/scale change. Reject pairing with forward-moving aerial for a sideways handoff. |
| [Open woodland50878](https://mixkit.co/free-stock-video/camera-glides-along-the-tall-pine-trees-on-a-sunny-50878/) | `https://assets.mixkit.co/videos/50878/50878-720.mp4`,4823592bytes,1280×720/24000/1001,360frames15.015s, SHA`a673913de1545f41ef7beaea6903d85364eebca97b8a6a520f1a942357f739e8` | Main motion is forward expansion(median+7.53%/s scale fit), despite discovery through a panning category. Useful for an open-view arrival, not a naturally captured horizontal whip. |
| [Canopy5040](https://mixkit.co/free-stock-video/huge-trees-in-a-large-green-forest-5040/) | `https://assets.mixkit.co/videos/5040/5040-720.mp4`,1280×720/30fps1203frames40.1s, SHA`ea27751d1ad382903511d2f4d0e25ddeddea26233f14ada5348e6fc58e676953` | Forward/upward move under trees, changing flare and trunks. Select source14–18s; earlier12s flare is outside this selection. Do not claim clipped sunlight detail recovered. |

Original page/bytes/hash receipts and full-source sampled contacts remain private. Initial source-motion screen uses bidirectionally checked LK features/robust similarity fit, not a claim of exact3D camera geometry. Actual camera image displacement differs from the camera's physical direction. Both chosen shots are illustrative licensed woodland; no verified same forest, route, date, country or filmed journey is claimed. Default client stabilisation/grade is not established by this mechanism study; deliberate source-camera motion is being measured, so it is not stabilised away.

## Actual recipe and controls

`skills/motion-matched-speed/render_forward_handoff_ab.py --canopy LOCAL_5040 --open-shot LOCAL_50878 --output-dir PRIVATE_DIR` reuses the existing lens-card encoder, installed OpenCV/NumPy/Pillow and FFmpeg. No new dependency/engine, client footage, optical-flow-generated frame or native-editor parameter claim.

Every final output is96frames540×960/24000/1001,4.004s; cut at48. Source identity asserted before decoding. Base crop[438,0,405,720] resizes to portrait; orientation remains upright. Source frames decoded by integer identity, not millisecond seeking. All sampled source-index arrays strictly increase and remain in range. No reflection, duplicate-frame hold or painted fill.

- `plain-cut`: nominal1× context: canopy480→539 and aerial144→191,48frames each. This uses shorter/later ranges, so it is **not** the source-identical curve control.
- `uniform-retime`: canopy420→540 and aerial144→216 uniformly mapped across48+48frames. Exact same endpoints as the ramp isolate curve changes. Inclusive samples span14→18s and6.006→9.009s; output duration remains4.004s.
- `forward-ramp`: monotone outgoing curve `t+a(t²−t)`, source-calibrated a=0.33710838; incoming `t+(t−t²)/3`. Expansion-only calibration did **not** make this a successful directional match: uncorrected outgoing moves up/right while incoming remains nearly level. Uniform retime's pre-encode expansion gap0.000235 is smaller than ramp0.001536; do not call the more elaborate ramp better.
- `settle-revision`: separate retime-only incoming coefficient1/6; same outgoing encoded cache. This does not repair the image-vector discrepancy.
- `zoom-margin-control`: same outgoing ramp cache, incoming source map fixed, one-pass direct-source1.12× crop supplies correction margin. No animated position/extra zoom. This is the matched control for the guided result.
- `guided-handoff`: preserve outgoing cache. Incoming cubic correction q=max(0,1−k/12)³ moves crop centre by source(+21.008,−20.711)px initially, with extra log zoom0.0095272, then reaches the fixed1.12× crop at incomingframe12. Parameters derive from outgoing/incoming measured motion over six-frame boundary samples. All inverse sample coordinates checked within real source. This is an **explicit digital crop correction**, not captured camera movement or registration of unrelated trees.
- `guided-revision`: change only settle duration12→16frames, deriving its bounded offset(+23.918,−23.580)px and extra log zoom0.010847. Same source maps/outgoing encoded cache; not a new skill. Proposed18frames exceeded the25px correction guard and was rejected;16passes without weakening the guard.

Separate shot caches encoded once and concatenated without picture re-encode protect the outgoing scene. Actual guided/revision decoded frames0–47 are **48/48exactly equal**. No later decoded frames match: despite equal pre-encode fixed-crop frames after incoming16, incoming encoder decisions drift across the shot. Never claim protected tail parity.

## Encoded output evidence, not a seamlessness score

| Actual encoded boundary metric | Fixed zoom control | Guided12f | Revised16f |
|---|---:|---:|---:|
| Centre motion-vector mismatch(px/output frame) |6.22830|0.30797|0.57375|
| Absolute log-expansion mismatch/frame |0.00139577|0.00002297|0.00057402|

These compare median robust similarity fits across outgoingframes41–47 and incoming48–54; they do not match content across the cut. Remaining roll difference in guided12f≈0.0863°/frame, different scene geometry/brightness and source parallax remain. Pre-encode centre gap6.22062→0.18643 differs from encoded6.22830→0.30797; prefer encoded receipt. Do not report0.19as the delivered metric or95%as artistic improvement. The16frame timing revision is mechanically valid but has a larger encoded motion mismatch than12frames; it is not promoted as better.

Seven final exports fully decode; frame rate/average, dimensions,96frames4.004s verified. Reduced encoded contacts cover opener, pre-cut, cut47/48, settle50/53/59/63, middle72 and end95; full-size guided47/48/53/63 and comparison boundary samples inspected. Source trunk/branches remain straight, pine remains in the moving portrait crop, no fill border/inverted orientation observed in sampled frames. The canopy-to-open-space cut reads as a change of view, not a continuous forest shot.540-wide source-limited detail/bright foliage and different light remain limitations; no cinematic-grade/retention claim. Actual local normal-speed ffplay completes exit0, not independent human/phone comfort. Silent output; no music/beat/heard cue approval. All per-frame maps, bounds, encoded QA/hashes and superseded iterations remain private under`work/research-continue/cross-shot`; final`forward-r05`only. Baked render/recipe, not native speed/crop keyframes/save/reopen or staff handover.

## Failures retained

First export batch reached encoding but JSON receipt failed on a NumPy int64 list. Explicit builtin integers repaired serialization. R02contains the four retime controls; R03/R04 partial guided runs stop at the rejected18frame correction; R05is the seven-output current set. Do not use earlier partial directories as current finals. The original retime-only ramp's worse result remains useful evidence; it was not replaced silently by the guided correction. No paid stock/credits, client/WhatsApp send, storage/account/security/hosting change or separate monitor.

## Current final output SHA256

- `plain-cut`: `62aa6752cb5d782fb1824260364e8f5d96daa670346b41090acb17fef74a3ecd`
- `uniform-retime`: `aabdcbe528fbda53a225d85cb25320da5bd99146e4625a6276b649276a198d93`
- `forward-ramp`: `6f0480a051cb96f4db073c3227b2334dcd2c09e14d958880f4238974687d6923`
- `settle-revision`: `f28fbdb3a2864d427da177d7d0b5c6a103429ce74b04914c60d31bee5d469856`
- `zoom-margin-control`: `dc6aa45082f7ca1779c1ee6d86d33f3a70a184e1120620939c4915af00d6fddc`
- `guided-handoff`: `c54797acbb38c43f8902ce8d6ee2d387235c62eed1ae5a25e0e7af15e21b0f06`
- `guided-revision`: `da9110bc5a26791f4021c5cea9381cefc697e0aa64ee5555afd01fc3e96b58be`

Owner-facing labelled fixed-zoom/guided/revision moving comparison and separate guided/revision MP4s are in office`outputs/Nolan-Research-20261028`. No research/client media in Git. Next distinct item is natural unkeyed moving-plane tracking; actual filmed sideways whip and independent sound/phone/native/staff/creative acceptance remain open.45families unchanged.
Validation: canonical skill and amended motion-matched-speed card pass quick_validate in process-only UTF-8 mode;45 families and306 local links checked, recipe AST parses and actual source/map/bounds/revision assertions execute. Seven actual exports pass full decode/probe and exact outgoing revision comparison. TypeScript/Vite build passes with the existing chunk-size warning; diff check passes. Canonical shared reference installed with backup/hash verification. No dependency, lockfile, production application or hosting change.
