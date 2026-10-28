# Full-shot phone-surface tracking and revision study —28 October2026

Continuation of office[PR910](https://github.com/CGProductionHouse/CG-Dynamics/pull/910), owning874/903, after[a12fc100 rotation/intake](OFFICE-ROTATION-HANDOFF-STUDY-20261028.md). Same45-family library; no new family, engine or mastery claim.

## Why this is a distinct next test

The existing[filmed-screen card](skills/filmed-last-frame/SKILL.md) already proved a short green-display insert and rejected its floating digital growth. This does not redo that growth. It extends surface attachment through the entire source, compares fixed/keyed/feature geometry, checks the last pose and performs a local text-only revision. It does not satisfy the physically filmed screen-to-location capture gate.

Source: existing transferred[Mixkit42630](https://mixkit.co/free-stock-video/copying-from-a-cell-phone-to-the-computer-42630/), commercial-use provenance in the prior card and[handover manifest](NOLAN-OFFICE-RESEARCH-ASSET-MANIFEST-20261028.json). SHA `0b1f1ec15a30b59fa06240b03adad50e3f6cef38ec6a3a8d8587d983644a7418`. All251 original1280×720 frames used at native24000/1001fps,10.468792s; no retime or generated frames. Portrait output540×960 uses source cropx380–784,full height; all251 display quadrilaterals stay inside it. Source has no audio. Original fictional FIELD NOTES/MAKE SPACE/FOR IDEAS artwork is generated locally; Arial Bold is a local Windows font, not redistributed. No client brand/footage/UI used.

Four transferred sources were screened at representative states before selection: phone, saw39691, coffee41865 and dark dancer1038. The saw's inspected3.5s frame has glove/dust over a narrow board with little clear title area, so it was not used for a speculative new plane-type render. This is limited source triage, not a claim to have rewatched every original end to end.

## Mechanisms and failures retained

1. Fixed first-frame geometry is a negative control: phone movement exposes green and crops the insert. No unsupported floating rectangle is grown over the holder.
2. Feature geometry seeds up to50 corners around the actual bezel, follows incremental Lucas–Kanade with forward/backward error<.65px, and fits homographies with1.2px RANSAC. Geometry after the first frame uses actual image features rather than refreshed key corners; the composite still uses the display's chroma alpha. **Not chroma-free tracking or natural person segmentation.** Best whole-shot mask overlap against the independent controlled key is minimum96.67%; maximum mean corner disagreement3.43 source pixels. These are source-specific diagnostic estimates, not human-labelled ground truth or acceptance. Visibly imperfect edges make this a drift control, not a reliable arbitrary-plane method.
3. Two materially different attempts to remove drift were worse: first-frame anchored flow with predicted homography initialisation,19px seed ring, reached minimum91.22% overlap; narrowing to9px reached87.11%. Keep both private251-frame analysis receipts. Do not repeat those parameters or call them improvements.
4. Early adaptive polygon simplification alternated4/5 vertices on rounded corners; tight edge windows also lost supporting samples. The final keyed path seeds edge neighborhoods with a minimum rectangle, fits four straight outer-envelope segments with Huber lines and intersects them. It uses central18–82% of each edge, keeping rounded corners out of the fit. Concave notch points are not a surface edge.
5. First actual full-size render exposed obvious green wedges above the insert because a top fit followed the notch. Convex display-envelope fitting repaired that. A subsequent full251-frame coverage scan found a stray distant green component: a broad HSV key is not semantic screen identity. Retain only the display's connected component before compositing. The worst coverage diagnostic had correctly refused the unrelated pixels rather than hiding them with background bleed.
6. Final graphic uses1% virtual-art overscan, only within actual keyed pixels. A guarded original-graphic background bleed refuses gaps≥4 source pixels; the final251-frame geometry scan found no missing display coverage. This never reflects/paints camera footage. Remove green anti-alias fringe only in a one-pixel outer band satisfying the explicit green test, without enlarging the matte over skin/rim. All other source pixels remain identical before encoding, asserted on every frame. Source hand/notch/bezel remain present; this is not a general matte proof.

Private iterations `phone-surface-proof`, `phone-surface-corrected` and `phone-surface-final` are labelled superseded. Current recipe/output is `phone-surface-r04`. Those directories and the two anchor analyses retain failures; no client or creator assets enter Git.

## Reproduce and revise

`python skills/scene-perspective-type/render_phone_surface_ab.py --source LOCAL_42630_MASTER --output-dir NEW_PRIVATE_DIR`

Source hash and native frame count/fps guard execute before rendering. Existing carpenter-plane FFmpeg writer is reused; no new renderer framework. Existing isolated Python3.12.14/OpenCV5.0.0/NumPy2.3.5/Pillow12.3.0/FFmpeg9.0.2. Optional process-only `OPENBLAS_NUM_THREADS=1`/`OMP_NUM_THREADS=2` bound local thread use; no global setting. Fonts cached in-process. Recipe keeps key/geometry, original artwork and revision logic separable in source; exports are baked, not editor-native projects.

Five outputs: original crop, fixed-plane negative, drifting feature control, keyed candidate and keyed revision. Only IDEAS→FOCUS changes in the revision from original frame120 onward. All earlier pre-encode frames are exactly equal; all protected source pixels remain equal. Actual encoded prefixes are **not** claimed identical:85 of first120 decoded frames match, with first codec-domain difference85 and final difference250. Encoder lookahead/rate decisions can propagate before the source edit; source-level isolation is separately asserted. No silent promotion of an array invariant to exact encoded-frame parity.

Output SHA256 (all five540×960,251frames,24000/1001fps,10.468792s,video only):

- `plain`: `d5e15a4cdac5bff8289edb63230199415448cadfc9f66f740862d68c43de88ac`
- `fixed-first-plane`: `28c19b0588c004681b42f31b34664718b5ab37956144951c82963668545e3bce`
- `feature-track`: `6aadec847161393a01ba631dbaf43ef91b4bfcc79be0d3e93b588c45cd538920`
- `keyed-plane`: `c409f83f3181b2381dde70511d7cac820fd282bc57fa5a316bbbd3c3d7efeb91`
- `keyed-revision`: `9ce6d7327955cae411a8caf7a7fb5fc209066120a7641c351c58680998662795`

## Actual inspection and remaining gates

All five final exports fully decode and frame-count/probe checks pass. Exact encoded frames0/120/217/250 were inspected at full portrait size for keyed, revision and feature variants, with reduced contacts spanning the full source; selected source/geometry boundaries were also checked. The top wedges are gone, main type remains readable, and the notch/hand/rim remain filmed. Small edge softness and source-specific registration remain concerns; this is a controlled-display candidate, not photoreal screen-replacement mastery.

A labelled moving fixed/feature/keyed comparison plus separate keyed/revision MP4s are in office outputs/Nolan-Research-20261028. Private source/results/row-by-row matrices and QA remain under work/research-continue; Git contains only recipes/docs. No full-speed desktop or physical-phone judgement is claimed: the previous occupied-desktop state was not cleared and no UI was used in this continuation. Silent source/research outputs do not meet hearing/music/beat gates. Native layer save/reopen/export and staff relink remain unverified.

Next useful gate is a genuinely natural unkeyed plane/clean foreground with sufficient features and a valid plate, or captured two-location device footage. Do not let this controlled key or drifting feature control clear those prerequisites. No client amendment, WhatsApp/public send, account/storage/security/hosting change, paid credit, new monitor or new dependency in this continuation.

Validation: canonical skill and both amended cards pass quick_validate with process-only UTF-8 mode; recipe parses and all source/geometry/protected-pixel/revision assertions execute.45 families match both status tables.299 local links across the checked study/cards/boards resolve. TypeScript/Vite build passes with its existing chunk-size warning; diff check passes. No repository dependency/lockfile change. Canonical shared skill is synced after review; exact new commit recorded in the owning issues.
