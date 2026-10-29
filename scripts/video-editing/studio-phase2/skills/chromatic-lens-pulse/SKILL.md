---
name: nolan-chromatic-lens-pulse
description: Compare plain footage, a focal zoom, restrained radial/chromatic optics and an intentionally excessive control on one licensed moving shot.
---

# Chromatic lens pulse — mechanics tested, strong version rejected

28 October 2026. The [Wanderlust reference](../../WANDERLUST-DIARIES-STUDY-20261028.md) shows distorted scale and chromatic edges at frames92–124, with a separate rotational example at558–567. This reconstruction isolates a linear focal pulse; it does **not** reproduce the rotational version, a cross-shot transition or an exact CapCut preset.

`python render_ab.py --output-dir PRIVATE_DIR` uses existing Python/OpenCV/NumPy/Pillow and FFmpeg. Source: [Mixkit city follow #134](https://mixkit.co/free-stock-video/a-man-being-followed-walking-in-a-city-134/), existing licence record in [motion speed](../motion-matched-speed/SKILL.md), SHA256 `de17d355543cda1f396361d2e217ae115c9be5eb60efe22cce0fc6a3d517d54d`, source9–12s. Private outputs: `C:\Users\chris\Videos\CG-AI-Editing\Nolan-Skill-Practice\wanderlust-diaries\proofs\chromatic-lens`. No client/creator footage or new dependency.

Four 540×960,30fps,90-frame outputs compare plain, zoom-only, mild and strong. Existing manually inspected crop anchors preserve the moving subject; they are not automatic tracking. Frames24–35 use a sin-squared pulse. Mild combines an8% focal zoom, radial warp, edge-weighted RGB separation and nine spatial samples. Strong multiplies intensity by4. Samples stay inside the source; reflected border filling is not needed. Pre-encode frames outside the pulse are unchanged. The first run failed because OpenCV remap received a non-float32 coordinate map; explicit conversion repaired it.

Full peak frames and reduced four-way contacts inspected. **Reject strong on this source:** its head is pushed into the left crop and hood streaking hides detail. Mild is visibly more restrained but still softens the hood; zoom-only is a necessary simpler control, not an automatically inferior choice. Use optics only to clarify a justified transition/action; do not turn every cut into an effect. Both faces and copy need a protected readable region.

All four actual exports fully decode with90 frames. SHA256 mild `aa883782bdee0c713232dd66fce7505e3186a90fd3a80d7da270c1d87c0b974e`; strong `f2ca0bb62488bdf6cc3f96754f23567c4649efeb274de7bd46efd06a9f1692ff`. Parameters, source anchors and remaining hashes are in `evidence.json`. Silent; no audio verdict. Normal-speed comfort, physical-phone viewing, source-motivated two-shot use and native editable controls/reopen remain unverified. **Bounded mechanics, not creative mastery.**

Portability: pass `--source ABSOLUTE_LOCAL_ORIGINAL` on another PC instead of copying the MSI directory layout. The exact recorded SHA-256 remains mandatory. Use a private output directory; reacquire only the permitted source, never client/reference media from an external service.

## Office extension: real rotating source

[28October office study](../../OFFICE-ROTATION-HANDOFF-STUDY-20261028.md) adds `render_rotation_ab.py --source LOCAL_561 --output-dir PRIVATE_DIR`: source-checked upward tree roll, plain/zoom/rotation/shutter controls, protected centre and no out-of-source samples. Initial precision and inverse-sign failures retained/repaired. Four corrected90-frame exports decode; full encoded peak/reduced contacts inspected. Outer trunk distortion/soft branches remain visible; not an exact reference, native/phone/normal-speed or mastery claim. Rotation is now bounded mechanically tested; a genuine two-shot directional handoff remains open.


##29October native RGB/zoom extension

[Native RGB study](../../OFFICE-NATIVE-LENS-STUDY-20261029.md) uses already installed PremiereRGBSplit and Motion on cleared cityoriginal336–407landscape. Eight NEW72-frame native outputs/two72/72actual reopenpairs/25protectedframes. StrongH1/D2fringes rejected; reducedH.125/D.5fixed headhoodROIchange vszoom is32.24%lower than mildH.25/D.5. NamedH202 ANDundocumented8301change: strictsingle-stored-object gatefails, roleunknown. Constantzero0/72exact,offpulse0/61,tail1/36parity failures retained. Not native geometricLensDistortion/rotation/shutter/referencepreset parity or a face/phone/comfort/heard/creative/secondPC pass. One-PC native RGBcontrols/save-reopen now bounded demonstrated;45familiesunchanged.
