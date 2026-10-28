---
name: nolan-shot-stabilization
description: Assess and gently stabilize ordinary camera footage while preserving intentional motion, subject framing and editable source linkage.
---

# Shot stabilization — one useful real-shot proof, one unnecessary pass

Use this when choosing or finishing a handheld camera select. The owner wants ordinary footage stabilized by default, with an intentional rough sporting beat as a documented exception. **Inspect orientation and the whole selected span first.** A filter cannot fix an upside-down take, a poor in/out or a subject cropped from the portrait frame.

Compare the same exact source range before and after a restrained stabilization pass. Keep the original and correction recipe linked. Check the first, middle, last and busiest motion frames at full resolution and phone size, then watch the complete cut at normal speed. Preserve a deliberate pan, push or moving subject; reject crop loss, black edges, elastic geometry, a frozen camera feel or a filter that adds no perceptible value. Log exceptions in the shot manifest. If the processed shot is baked for handover, retain the unprocessed original, in/out, orientation, filter settings and editable timeline relationship.

## 27 October protected A/B

The protected Daisy R05 replacement is the real 30 fps portrait shop move `199A5251.MP4`, selected at source 0.10 s for 46 frames. The existing `render_r04.py` recipe orients it with `transpose=2`, then runs FFmpeg `vidstabdetect` (`shakiness=3`, `accuracy=15`, `stepsize=6`) and `vidstabtransform` (`smoothing=12`, `optzoom=1`, `zoom=2`). Original and transformed picture are kept outside Git in the private Daisy R05 folder; no client footage is in this skill package. The exact settings are an **example for this shot**, not a universal preset.

The diagnostic `analyze_ab.py` compared 46 equally framed 540×960 frames from the oriented source and the transformed select. Median side-band background drift remained leftward (−4.599 vs −4.263 px/frame), so the camera move was not locked off. The root-mean-square frame-to-frame change in that drift fell from **2.816 to 1.266 px**, about **55% lower**. A five-position 270×480 contact sheet shows the same cat-print cup/shelf action and no obvious black border or detached object; a full-size middle frame was inspected. The existing R05 film uses the corrected select and decoded. These are useful technical and sampled visual results. The source and final clip have **not** received an independent normal-speed physical-phone motion review here; this is not a general creative approval.

Negative control: an already smooth, commercially licensed [Mixkit #134 city follow](https://mixkit.co/free-stock-video/a-man-being-followed-walking-in-a-city-134/) was cut at source 7–12 s for a 120-frame silent portrait A/B. FFmpeg `deshake` reduced the same diagnostic only from **1.588 to 1.538 px**, about **3%**. The 270×480 contact sheet also shows the walker cut against the right edge at the opening in both versions. **Reject this portrait select and its unnecessary stabilization pass.** Stabilization cannot solve the framing problem. `vidstabtransform` on this practice source failed locally with no usable export after detection; the working `deshake` comparison is a fallback test, not an equivalence claim or a recommended setting. The original stock file and derivatives remain private.

`analyze_ab.py CONTROL.mp4 CANDIDATE.mp4 OUTPUT_DIR` writes a five-position phone-scale contact and a side-band corner-motion JSON. Its metric is only a signal: moving subjects, parallax, blur and crop changes can mislead it. It cannot certify smoothness, distortion, story fit, full-speed viewing or sound. Compare the real exported cut and listen independently before presenting a client film.

## Office native extension —29October2026

[Actual Warp Stabilizer study](../../OFFICE-NATIVE-STABILIZATION-STUDY-20261029.md) uses new licensed city336–407landscape frames, not the rejected portrait select or MSI Daisy source. Native plain/default50/PSR5/revision controls; six72-frame exports, both actual native reopen pairs72/72decoded equal and49/49protected revision. Default50crowds headroom and worsens side-band velocity-change;PSR5/104.3%autoscale lowers it22.8% for this span. Only nativeAdditionalScale changes for a small closing reframe. Retain plain/default controls and source/analysis dependencies. Fullspeed independent judgement, portrait/phone/heard/second-PC and creative acceptance remain unproved; no universal smoothing preset.
