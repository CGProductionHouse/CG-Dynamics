# Fight trailer scene 2: hard cut versus blurred entry

**Result:** keep the [2.002 s hard-cut control](proof-fight-scene2-hard-cut.mp4) as the clearer technical handoff. Reject the [four-frame blurred-entry candidate](proof-fight-scene2-blurred-entry.mp4) for this pair: it softens the incoming boxer and glove without producing a true motion match. The [eight-sample A/B strip](proof-fight-scene2-comparison.png) makes that loss visible. This pair is labelled stock practice, not an event select or an approved trailer scene.

The first second is the existing [scene 1 stock proof](FIGHT-SCENE1-IMPACT-STUDY.md), Mixkit #40974 at source 5–6.001 s. The second second uses [Mixkit #40969, “Boxer is knocked out when getting hit in a ring”](https://mixkit.co/free-stock-video/boxer-is-knocked-out-when-getting-hit-in-a-ring-40969/), source 0–1.001 s, 1280×720 at 24000/1001 fps, SHA-256 `5d417cfd997899890a199c7f5ed3ab5fa7d7592e96a5bfeb511eb24349667298`. The [Mixkit video free licence](https://mixkit.co/license/modal/videoFree/) applies to this practice end product. The second shot is cropped to x=300–704 to keep the face and incoming glove inside 9:16; x=160 cut the face at the right edge and was rejected during source screen. Neither stock original is committed to Git.

`python render_fight_impact_scene.py` prepares the first shot and `python render_fight_second_strike.py` renders both scene 2 variants with existing FFmpeg. The blurred-entry variant applies an eight-pixel box blur to only the first 0.167 s (four frames) of the second shot; the hard-cut control leaves the incoming picture clear. Both share the same on-screen `STOCK PRACTICE` label and have **no audio**. Each MP4 fully decoded, has 48 frames, and lasts 2.002 s. Source and output hashes are checked/recorded below.

| Output | SHA-256 |
|---|---|
| Hard-cut control | `90f1c464b513d84b7353c69ad5bea03818dfddbabb91e9a5b3b0bb7d87ce6969` |
| Blurred entry | `d3b9529177d387d22de22045f6cd52a995fee900bb2aa93a128b61a4c5ec6fc4` |

The first 24 decoded RGB frames are not byte-identical because the two whole sequences were encoded separately; SSIM for that first second is 0.996520. Do not call it byte-protected. The visible A/B supports the narrower observation that only the incoming treatment was intentionally changed. The second source's page calls its full clip a knockout; the 1 s excerpt **does not establish an outcome**, and no knockout claim belongs in this practice or later event edit without source review.

This is also a **source-selection rejection** for a finished trailer. Both shots use a similar close view of the same staged boxer under different light; the hard cut is readable but does not clearly signal a distinct fight moment. A blur does not fix that. The event version needs a second independently timecoded hit with distinguishable fighter/action/geography, then a plain-cut versus transition comparison at normal speed. Use a whip or blur only if source camera movement naturally carries the eye across the cut and the first frames of the next strike remain legible. Sound design was outside this picture-only A/B and remains untested here.
