# Runner speed map — exact endpoint and bounded skip repair

29 October 2026. This background-only study advances the existing motion-matched speed card with a real runner crossing a static park shot. It tests a 3-second normal span versus two 2-second source-index remaps and a protected rounding repair. This is a **one-shot frame-map proof**, not a cross-shot action match, a heard rhythm edit or a native-editor endpoint fix.

The exact [Mixkit #4831 park runner](https://mixkit.co/free-stock-video/view-of-a-park-while-a-girl-runs-across-4831/) item page permits commercial/personal use under its Stock Video Free License. Private original SHA-256 `66A9EFC3CD5F2F09D81207D6731F0297F95439A0711DD1F9A4EC128C9FB1BED6`; actual source 1280 × 720, 24000/1001 fps, 198 frames, silent. Selected source frames 112–183 show one continuous left-to-right crossing, including the exit. No invented intermediate frames, scene change, sound cue or optical flow were added.

## Plain control, maps and revision

Private source-specific `speed_runner.py`, `speed-receipt.json`, decoded contacts/stills and `speed-inspection.json` are in `work/research-continue/motion-trail-runner/`. The `speed-normal.mp4` control is byte-identical to the already rendered `hook-action-plain-r01.mp4` from the [hook screen](PARK-RUNNER-HOOK-SCREEN-20261029.md); it is **not counted as a new unique output**. Three other MP4s are new. All four fully decode at 1280 × 720, 24000/1001 fps, without black frames. All four share exactly the first 12 decoded frames.

| Private output | Frames | SHA-256 | Source-map finding |
| --- | ---: | --- | --- |
| `speed-normal.mp4` | 72 | `4af7f6be0684e118267c0edf1eaa978498976ed519d0523ac89f8b393d798abf` | Source 112–183, every frame. Reused plain control. |
| `speed-hard-middle.mp4` | 48 | `12236130f841e3fbf98fc281ae438d3277e6133239bcbab01ea7eb539490ffb1` | First 12 source frames at 1×, middle 24 outputs every second source frame, final 12 consecutive frames. 23 step-1 and 24 step-2 gaps; exact source endpoint 183. |
| `speed-smooth-middle-r02.mp4` | 48 | `895af792325f2f418439506aa40f5bc9c15887ac2f3ee05038ea338e4b7f9bbc` | Sine-weighted cumulative map with integer rounding, endpoint 183. **Reject one unintended three-source-frame gap** at output 29→30 (152→155); 24 step-1, 22 step-2, one step-3 gaps. |
| `speed-smooth-middle-r03.mp4` | 48 | `d3b1177b4856f2adab4030d3681ebf24051a66b96d2b3daf3435a5ba4faa24c6` | Protected R02 repair shifts source indices at outputs 30–37 by one, moving the extra skip to a later one-step gap. R02/R03 opening 30/30 decoded frames exact. All 47 gaps are step 1 or 2, no repeat/reversal, endpoint still 183. |

The decoded eight-position contact maps output frames to source indices for all four variants. Full-size R03 frames 36 and 47 were inspected: the runner remains in the frame during the crossing, then leaves naturally by the exact final source frame. Integer-map assertions prove source monotonicity and endpoint, while decoded-image checks prove the intended frame count and protected prefix. These checks do **not** prove that a 2-second compressed gait feels natural at normal playback. The first R02 three-frame skip was caught numerically before any creative promotion; R03 repairs this local map only.

The earlier **native Premiere** time-remap study still has its final-source 539→538 endpoint failure. This portable 112→183 source map does not repair the saved native project or establish native editability. A genuine two-shot action match, full-speed gait/comfort, physical-phone vertical composition, licensed/heard sound and second-PC relink remain open. Do not borrow this silent landscape rate curve as a preset for a client film.
